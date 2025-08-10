// Minimal Reddit client using JSONP alternative endpoints
// Reddit supports fetching JSON data by appending .json to URLs
// This can bypass some network blocks and doesn't require OAuth

export interface RedditPost {
  id: string;
  title: string;
  selftext: string;
  url: string;
  subreddit: string;
  author: string;
  permalink: string;
  num_comments: number;
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

export async function searchReddit(
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

export async function fetchPostWithComments(
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
