import { NextResponse } from "next/server";

interface RedditPost {
  id: string;
  title: string;
  url: string;
  permalink: string;
  createdAt: string;
  author: string;
  score: number;
  numComments: number;
  flair?: string;
  isSelf: boolean;
  selfText?: string;
  // Marks our synthetic "visit the community" item so the UI can treat it differently
  isFallback?: boolean;
}

interface RedditListingResponse {
  data: {
    children: {
      data: {
        id: string;
        title: string;
        url: string;
        permalink: string;
        author: string;
        score: number;
        num_comments: number;
        created_utc: number;
        link_flair_text?: string;
        is_self: boolean;
        selftext?: string;
      };
    }[];
  };
}

async function fetchListing(endpoint: string): Promise<RedditPost[]> {
  const res = await fetch(endpoint, {
    headers: {
      // Reddit requires a descriptive UA for API/script access
      "User-Agent": "VisaNova/1.0 (https://visanova.app)",
    },
    // Keep this reasonably fresh so the feed doesn't feel stale
    next: { revalidate: 120 },
  });

  if (!res.ok) {
    console.error("[reddit visa-pause] Non-OK status from Reddit:", res.status, res.statusText, "for", endpoint);
    return [];
  }

  const json = (await res.json()) as RedditListingResponse;

  const posts = json.data.children
    .map((child): RedditPost | null => {
      const d = child.data;
      if (!d || !d.title) return null;

      const createdAt = new Date(d.created_utc * 1000).toISOString();

      return {
        id: d.id,
        title: d.title.trim(),
        url: d.url,
        permalink: `https://www.reddit.com${d.permalink}`,
        createdAt,
        author: d.author,
        score: d.score,
        numComments: d.num_comments,
        flair: d.link_flair_text || undefined,
        isSelf: d.is_self,
        selfText: d.selftext?.trim() || undefined,
      };
    })
    .filter((p): p is RedditPost => !!p);

  return posts;
}

async function fetchSubredditPosts(): Promise<RedditPost[]> {
  try {
    // Try multiple listing types so we almost always have content.
    const endpoints = [
      "https://www.reddit.com/r/i130_75CountryPause/hot.json?limit=10&raw_json=1",
      "https://www.reddit.com/r/i130_75CountryPause/new.json?limit=10&raw_json=1",
      "https://www.reddit.com/r/i130_75CountryPause/top.json?limit=10&t=week&raw_json=1",
    ];

    const allPosts: RedditPost[] = [];
    const seen = new Set<string>();

    for (const endpoint of endpoints) {
      const batch = await fetchListing(endpoint);
      for (const p of batch) {
        if (!seen.has(p.id)) {
          seen.add(p.id);
          allPosts.push(p);
        }
      }
      if (allPosts.length >= 5) break;
    }

    if (allPosts.length === 0) {
      // As a last resort, return a single friendly fallback item so
      // the UI never looks totally empty.
      const now = new Date().toISOString();
      return [
        {
          id: "fallback-visanova-community",
          title: "Visit the Visa Pause community on Reddit",
          url: "https://www.reddit.com/r/i130_75CountryPause/",
          permalink: "https://www.reddit.com/r/i130_75CountryPause/",
          createdAt: now,
          author: "community",
          score: 0,
          numComments: 0,
          flair: "Community",
          isSelf: false,
          selfText: undefined,
          isFallback: true,
        },
      ];
    }

    // Sort by newest first and take the top 5 for a tight feed.
    allPosts.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    return allPosts.slice(0, 5);
  } catch (error) {
    console.error("[reddit visa-pause] Failed to fetch subreddit posts:", error);
    return [];
  }
}

export async function GET() {
  const posts = await fetchSubredditPosts();

  return NextResponse.json(
    {
      posts,
      lastFetched: new Date().toISOString(),
      source: "https://www.reddit.com/r/i130_75CountryPause/",
    },
    {
      headers: {
        // Make this update frequently so users see fresh posts quickly.
        "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300",
      },
    }
  );
}

