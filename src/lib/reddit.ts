// Minimal Reddit client via public endpoints + OAuth if provided.
import { env } from "@/lib/env";

export type RedditPost = {
  id: string;
  title: string;
  selftext?: string;
  url?: string;
  subreddit: string;
  author: string;
  permalink: string;
  num_comments: number;
};

export type RedditComment = {
  id: string;
  author: string;
  body: string;
  score: number;
};

// Narrow type definitions for Reddit's JSON
type RedditListingChild<T> = {
  kind: string;
  data: T;
};

type RedditSearchResponse = {
  data?: {
    children?: Array<RedditListingChild<RedditPost>>;
  };
};

type RedditCommentsChild = {
  kind: string; // "t1" for comment
  data: RedditComment;
};

type RedditPostAndCommentsResponse = [
  { data?: { children?: Array<RedditListingChild<RedditPost>> } },
  { data?: { children?: Array<RedditCommentsChild> } }
];

type RedditTokenResponse = {
  access_token: string;
  expires_in: number; // seconds
  token_type: string; // "bearer"
  scope?: string;
};

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getRedditAccessToken(): Promise<string | null> {
  const clientId = env.REDDIT_CLIENT_ID;
  const clientSecret = env.REDDIT_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  const now = Date.now();
  if (cachedToken && now < cachedToken.expiresAt - 60_000) {
    return cachedToken.token;
  }

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const form = new URLSearchParams();
  form.set("grant_type", "client_credentials");
  form.set("duration", "temporary");
  form.set("scope", "read");

  const res = await fetch("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent":
        "kurdish-linkedin-post-generator/1.0 (+https://github.com/Alannjaf/kurdish-linkedin-post-generator)",
      Accept: "application/json",
    },
    body: form.toString(),
    cache: "no-store",
  });
  if (!res.ok) {
    return null;
  }
  const json: RedditTokenResponse = await res.json();
  const token = json.access_token;
  const expiresAt = Date.now() + (json.expires_in ?? 3600) * 1000;
  cachedToken = { token, expiresAt };
  return token;
}

export async function searchReddit(
  query: string,
  limit = 15,
  sort: "hot" | "new" | "top" | "relevance" = "top",
  t: "hour" | "day" | "week" | "month" | "year" | "all" = "day"
): Promise<RedditPost[]> {
  const token = await getRedditAccessToken();
  const base = token ? "https://oauth.reddit.com" : "https://www.reddit.com";
  const u = new URL("/search.json", base);
  u.searchParams.set("q", query);
  u.searchParams.set("sort", sort);
  if (sort === "top") {
    u.searchParams.set("t", t);
  }
  u.searchParams.set("limit", String(limit));
  u.searchParams.set("raw_json", "1");
  const headers: Record<string, string> = {
    "User-Agent":
      "kurdish-linkedin-post-generator/1.0 (+https://github.com/Alannjaf/kurdish-linkedin-post-generator)",
    Accept: "application/json",
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(u.toString(), { cache: "no-store", headers });
  if (!res.ok) {
    let bodyText = "";
    try {
      bodyText = await res.text();
    } catch {
      // ignore
    }
    throw new Error(
      `Failed to fetch Reddit search (status ${res.status})${
        bodyText ? `: ${bodyText}` : ""
      }`
    );
  }
  const json: RedditSearchResponse = await res.json();
  const children = json?.data?.children ?? [];
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

export async function fetchPostWithComments(
  permalink: string
): Promise<{ post: RedditPost; comments: RedditComment[] }> {
  const token = await getRedditAccessToken();
  const base = token ? "https://oauth.reddit.com" : "https://www.reddit.com";
  const url = `${base}${permalink}.json?limit=100&raw_json=1`;
  const headers: Record<string, string> = {
    "User-Agent":
      "kurdish-linkedin-post-generator/1.0 (+https://github.com/Alannjaf/kurdish-linkedin-post-generator)",
    Accept: "application/json",
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(url, { cache: "no-store", headers });
  if (!res.ok) {
    let bodyText = "";
    try {
      bodyText = await res.text();
    } catch {
      // ignore
    }
    throw new Error(
      `Failed to fetch post/comments (status ${res.status})${
        bodyText ? `: ${bodyText}` : ""
      }`
    );
  }
  const json: RedditPostAndCommentsResponse = await res.json();

  const postData = json?.[0]?.data?.children?.[0]?.data;
  if (!postData) throw new Error("Post not found");
  const post: RedditPost = {
    id: postData.id,
    title: postData.title,
    selftext: postData.selftext,
    url: postData.url,
    subreddit: postData.subreddit,
    author: postData.author,
    permalink: postData.permalink,
    num_comments: postData.num_comments,
  };

  const commentsChildren = json?.[1]?.data?.children ?? [];
  const comments: RedditComment[] = commentsChildren
    .filter((c: RedditCommentsChild) => c.kind === "t1")
    .map((c: RedditCommentsChild) => {
      const d = c.data;
      const comment: RedditComment = {
        id: d.id,
        author: d.author,
        body: d.body,
        score: d.score,
      };
      return comment;
    });

  return { post, comments };
}
