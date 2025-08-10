import { NextRequest, NextResponse } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
import { z } from "zod";

// Reddit types for server-side processing
interface RedditPost {
  id: string;
  title: string;
  selftext: string;
  url: string;
  subreddit: string;
  author: string;
  permalink: string;
  num_comments: number;
}

interface RedditListingChild<T> {
  kind: string;
  data: T;
}

interface RedditSearchResponse {
  data?: {
    children?: Array<RedditListingChild<RedditPost>>;
  };
}

// Try multiple Reddit endpoints to bypass network blocks
const REDDIT_ENDPOINTS = [
  "https://www.reddit.com",
  "https://old.reddit.com",
  "https://reddit.com",
];

async function tryRedditEndpoint(
  baseUrl: string,
  path: string
): Promise<Response> {
  const url = `${baseUrl}${path}`;
  const res = await fetch(url, {
    cache: "no-store",
    headers: {
      "User-Agent":
        "kurdish-linkedin-post-generator/1.0 (+https://github.com/Alannjaf/kurdish-linkedin-post-generator)",
      Accept: "application/json",
    },
  });
  return res;
}

async function searchReddit(
  query: string,
  limit = 15,
  sort: "hot" | "new" | "top" | "relevance" = "top",
  t: "hour" | "day" | "week" | "month" | "year" | "all" = "day"
): Promise<RedditPost[]> {
  // Try different search endpoints
  const searchPaths = [
    `/search.json?q=${encodeURIComponent(query)}&sort=${sort}&limit=${limit}${
      sort === "top" ? `&t=${t}` : ""
    }`,
    `/r/all/search.json?q=${encodeURIComponent(
      query
    )}&sort=${sort}&limit=${limit}${sort === "top" ? `&t=${t}` : ""}`,
    `/search.json?q=${encodeURIComponent(
      query
    )}&sort=${sort}&limit=${limit}&raw_json=1${
      sort === "top" ? `&t=${t}` : ""
    }`,
  ];

  for (const baseUrl of REDDIT_ENDPOINTS) {
    for (const path of searchPaths) {
      try {
        const res = await tryRedditEndpoint(baseUrl, path);
        if (res.ok) {
          const json: RedditSearchResponse = await res.json();
          const children = json?.data?.children ?? [];
          if (children.length > 0) {
            return children.map((c: RedditListingChild<RedditPost>) => {
              const d = c.data;
              const post: RedditPost = {
                id: d.id,
                title: d.title,
                selftext: d.selftext,
                url: d.url,
                subreddit: d.subreddit,
                author: d.author,
                permalink: d.permalink,
                num_comments: d.num_comments,
              };
              return post;
            });
          }
        }
      } catch (error) {
        console.warn(`Failed to fetch from ${baseUrl}${path}:`, error);
        continue;
      }
    }
  }

  // If all endpoints fail, try a different approach - fetch from popular subreddits
  const popularSubreddits = [
    "programming",
    "technology",
    "science",
    "news",
    "worldnews",
  ];
  for (const subreddit of popularSubreddits) {
    for (const baseUrl of REDDIT_ENDPOINTS) {
      try {
        const res = await tryRedditEndpoint(
          baseUrl,
          `/r/${subreddit}/hot.json?limit=${limit}`
        );
        if (res.ok) {
          const json: RedditSearchResponse = await res.json();
          const children = json?.data?.children ?? [];
          if (children.length > 0) {
            // Filter posts that match the query (case-insensitive)
            const queryLower = query.toLowerCase();
            const filteredPosts = children
              .filter((c: RedditListingChild<RedditPost>) => {
                const d = c.data;
                return (
                  d.title.toLowerCase().includes(queryLower) ||
                  d.selftext.toLowerCase().includes(queryLower)
                );
              })
              .slice(0, limit);

            if (filteredPosts.length > 0) {
              return filteredPosts.map((c: RedditListingChild<RedditPost>) => {
                const d = c.data;
                const post: RedditPost = {
                  id: d.id,
                  title: d.title,
                  selftext: d.selftext,
                  url: d.url,
                  subreddit: d.subreddit,
                  author: d.author,
                  permalink: d.permalink,
                  num_comments: d.num_comments,
                };
                return post;
              });
            }
          }
        }
      } catch (error) {
        console.warn(`Failed to fetch from ${baseUrl}/r/${subreddit}:`, error);
        continue;
      }
    }
  }

  throw new Error(
    "All Reddit endpoints failed. The service may be temporarily unavailable."
  );
}

const schema = z.object({
  q: z.string().min(1),
  sort: z.enum(["hot", "new", "top", "relevance"]).optional(),
  t: z.enum(["hour", "day", "week", "month", "year", "all"]).optional(),
  titleOnly: z.union([z.literal("true"), z.literal("false")]).optional(),
});

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "";
  const sort =
    (searchParams.get("sort") as "hot" | "new" | "top" | "relevance") ||
    "relevance";
  const t =
    (searchParams.get("t") as
      | "hour"
      | "day"
      | "week"
      | "month"
      | "year"
      | "all") || "day";
  const titleOnly = (searchParams.get("titleOnly") ?? "true") as
    | "true"
    | "false";
  const parsed = schema.safeParse({ q, sort, t, titleOnly });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query" }, { status: 400 });
  }
  try {
    const tVal = parsed.data.t ?? "day";

    const baseQuery = parsed.data.q.trim();
    const onlyTitle = parsed.data.titleOnly === "true";
    const opQuery = onlyTitle ? `title:${baseQuery}` : baseQuery;

    const runSearch = async (
      timeWindow: "hour" | "day" | "week" | "month" | "year" | "all",
      whichSort: "hot" | "new" | "top" | "relevance"
    ) => {
      const list = await searchReddit(opQuery, 50, whichSort, timeWindow);
      const tokens = parsed.data.q
        .toLowerCase()
        .split(/\s+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 2);
      if (!tokens.length) return list;

      type P = { title?: string; selftext?: string };
      const titleOf = (p: P) => (p.title || "").toLowerCase();
      const bodyOf = (p: P) => (p.selftext || "").toLowerCase();
      const haystack = (p: P) =>
        onlyTitle ? titleOf(p) : `${titleOf(p)} ${bodyOf(p)}`;

      // Try strict (all tokens), then relaxed (any token)
      const all = list.filter((p: P) =>
        tokens.every((tkn) => haystack(p).includes(tkn))
      );
      if (all.length) return all;
      const any = list.filter((p: P) =>
        tokens.some((tkn) => haystack(p).includes(tkn))
      );
      return any.length ? any : list;
    };

    // Attempt with requested t, then progressively relax timeframe if needed
    // Prefer relevance first
    let filtered = await runSearch(tVal, "relevance");
    if (!filtered.length) {
      filtered = await runSearch(tVal, "top");
    }
    if (!filtered.length) {
      for (const nextT of ["week", "month", "year", "all"] as const) {
        if (nextT === tVal) continue;
        filtered = await runSearch(nextT, "relevance");
        if (filtered.length) break;
        filtered = await runSearch(nextT, "top");
        if (filtered.length) break;
      }
    }

    return NextResponse.json({ posts: filtered });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
