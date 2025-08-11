// Minimal Reddit client using CORS proxy to bypass network blocks
// Uses corsproxy.io to proxy Reddit API requests and avoid CORS/network issues

export interface RedditPost {
  id: string;
  title: string;
  selftext: string;
  url: string;
  subreddit: string;
  author: string;
  permalink: string;
  num_comments: number;
  score: number;
  created_utc: number;
}

export interface RedditComment {
  id: string;
  body: string;
  author: string;
  score: number;
  created_utc: number;
}

export interface RedditListingChild<T> {
  kind: string;
  data: T;
}

export interface RedditSearchResponse {
  data?: {
    children?: Array<RedditListingChild<RedditPost>>;
  };
}

export interface RedditCommentsChild {
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

// CORS proxy to bypass Reddit's CORS restrictions and network blocks
const CORS_PROXY = "https://corsproxy.io/?";

async function fetchWithProxy(url: string): Promise<Response> {
  const proxyUrl = `${CORS_PROXY}${encodeURIComponent(url)}`;
  return fetch(proxyUrl, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });
}

export async function searchReddit(
  query: string,
  limit = 15,
  sort: "hot" | "new" | "top" | "relevance" = "top",
  t: "hour" | "day" | "week" | "month" | "year" | "all" = "day"
): Promise<RedditPost[]> {
  try {
    // Try different search endpoints
    const searchUrls = [
      `https://www.reddit.com/search.json?q=${encodeURIComponent(
        query
      )}&sort=${sort}&limit=${limit}${sort === "top" ? `&t=${t}` : ""}`,
      `https://www.reddit.com/r/all/search.json?q=${encodeURIComponent(
        query
      )}&sort=${sort}&limit=${limit}${sort === "top" ? `&t=${t}` : ""}`,
      `https://www.reddit.com/search.json?q=${encodeURIComponent(
        query
      )}&sort=${sort}&limit=${limit}&raw_json=1${
        sort === "top" ? `&t=${t}` : ""
      }`,
    ];

    for (const url of searchUrls) {
      try {
        const res = await fetchWithProxy(url);
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
                score: d.score ?? 0,
                created_utc:
                  (d as unknown as { created_utc?: number }).created_utc ?? 0,
              };
              return post;
            });
          }
        }
      } catch (error) {
        console.warn(`Failed to fetch from ${url}:`, error);
        continue;
      }
    }

    // If search fails, try fetching from popular subreddits and filtering
    const popularSubreddits = [
      "programming",
      "technology",
      "science",
      "news",
      "worldnews",
    ];
    for (const subreddit of popularSubreddits) {
      try {
        const url = `https://www.reddit.com/r/${subreddit}/hot.json?limit=${limit}`;
        const res = await fetchWithProxy(url);
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
                  score: d.score ?? 0,
                  created_utc:
                    (d as unknown as { created_utc?: number }).created_utc ?? 0,
                };
                return post;
              });
            }
          }
        }
      } catch (error) {
        console.warn(`Failed to fetch from r/${subreddit}:`, error);
        continue;
      }
    }

    throw new Error(
      "All Reddit endpoints failed. The service may be temporarily unavailable."
    );
  } catch (error) {
    throw new Error(
      `Failed to search Reddit: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

export async function fetchPostWithComments(
  permalink: string
): Promise<{ post: RedditPost; comments: RedditComment[] }> {
  try {
    const url = `https://www.reddit.com${permalink}.json?limit=100`;
    const res = await fetchWithProxy(url);

    if (!res.ok) {
      throw new Error(`Failed to fetch post (status ${res.status})`);
    }

    const json: RedditPostAndCommentsResponse = await res.json();
    const postData = json[0]?.data?.children?.[0]?.data;
    const commentsData = json[1]?.data?.children ?? [];

    if (!postData) {
      throw new Error("Post not found");
    }

    const post: RedditPost = {
      id: postData.id,
      title: postData.title,
      selftext: postData.selftext,
      url: postData.url,
      subreddit: postData.subreddit,
      author: postData.author,
      permalink: postData.permalink,
      num_comments: postData.num_comments,
      score: (postData as { score?: number }).score ?? 0,
      created_utc: (postData as { created_utc?: number }).created_utc ?? 0,
    };

    const comments: RedditComment[] = commentsData
      .filter(
        (c) =>
          c.kind === "t1" &&
          c.data.body !== "[deleted]" &&
          c.data.body !== "[removed]"
      )
      .map((c) => ({
        id: c.data.id,
        body: c.data.body,
        author: c.data.author,
        score: c.data.score,
        created_utc: c.data.created_utc,
      }))
      .slice(0, 20); // Limit to top 20 comments

    return { post, comments };
  } catch (error) {
    throw new Error(
      `Failed to fetch post and comments: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}
