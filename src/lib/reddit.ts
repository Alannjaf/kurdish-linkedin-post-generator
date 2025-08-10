// Minimal Reddit client via public endpoints + OAuth if provided.

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

export async function searchReddit(
  query: string,
  limit = 15,
  sort: "hot" | "new" | "top" | "relevance" = "top",
  t: "hour" | "day" | "week" | "month" | "year" | "all" = "day"
): Promise<RedditPost[]> {
  const u = new URL("https://www.reddit.com/search.json");
  u.searchParams.set("q", query);
  u.searchParams.set("sort", sort);
  if (sort === "top") {
    u.searchParams.set("t", t);
  }
  u.searchParams.set("limit", String(limit));
  const res = await fetch(u.toString(), {
    cache: "no-store",
    headers: {
      // Reddit requires a unique and descriptive User-Agent for API access
      "User-Agent":
        "kurdish-linkedin-post-generator/1.0 (+https://github.com/Alannjaf/kurdish-linkedin-post-generator)",
      Accept: "application/json",
    },
  });
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
  const url = `https://www.reddit.com${permalink}.json?limit=100`;
  const res = await fetch(url, {
    cache: "no-store",
    headers: {
      "User-Agent":
        "kurdish-linkedin-post-generator/1.0 (+https://github.com/Alannjaf/kurdish-linkedin-post-generator)",
      Accept: "application/json",
    },
  });
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
