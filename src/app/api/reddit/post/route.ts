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

interface RedditComment {
  id: string;
  body: string;
  author: string;
  score: number;
  created_utc: number;
}

interface RedditListingChild<T> {
  kind: string;
  data: T;
}

interface RedditCommentsChild {
  kind: string;
  data: {
    id: string;
    body: string;
    author: string;
    score: number;
    created_utc: number;
  };
}

type RedditPostAndCommentsResponse = [
  { data?: { children?: Array<RedditListingChild<RedditPost>> } },
  { data?: { children?: Array<RedditCommentsChild> } }
];

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

async function fetchPostWithComments(
  permalink: string
): Promise<{ post: RedditPost; comments: RedditComment[] }> {
  for (const baseUrl of REDDIT_ENDPOINTS) {
    try {
      const url = `${baseUrl}${permalink}.json?limit=100`;
      const res = await fetch(url, {
        cache: "no-store",
        headers: {
          "User-Agent":
            "kurdish-linkedin-post-generator/1.0 (+https://github.com/Alannjaf/kurdish-linkedin-post-generator)",
          Accept: "application/json",
        },
      });

      if (res.ok) {
        const json: RedditPostAndCommentsResponse = await res.json();
        const postData = json[0]?.data?.children?.[0]?.data;
        const commentsData = json[1]?.data?.children ?? [];

        if (postData) {
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

          const comments: RedditComment[] = commentsData.map((c) => ({
            id: c.data.id,
            body: c.data.body,
            author: c.data.author,
            score: c.data.score,
            created_utc: c.data.created_utc,
          }));

          return { post, comments };
        }
      }
    } catch (error) {
      console.warn(`Failed to fetch post from ${baseUrl}:`, error);
      continue;
    }
  }

  throw new Error(
    "Failed to fetch post and comments from all Reddit endpoints"
  );
}

const schema = z.object({
  permalink: z.string().min(1),
});

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const permalink = searchParams.get("permalink") ?? "";
  const parsed = schema.safeParse({ permalink });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid permalink" }, { status: 400 });
  }
  try {
    const { post, comments } = await fetchPostWithComments(
      parsed.data.permalink
    );
    return NextResponse.json({ post, comments });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
