import { NextResponse } from "next/server";

export interface LatestRedditComment {
  id: string;
  body: string;
  author: string;
  score: number;
  createdAt: string;
  permalink: string;
  postTitle: string;
  postId: string;
}

interface RedditCommentChild {
  kind: string;
  data: {
    id: string;
    body?: string;
    author: string;
    score: number;
    created_utc: number;
    permalink?: string;
    link_id?: string;
    link_title?: string;
  };
}

export async function GET() {
  try {
    const url = "https://www.reddit.com/r/i130_75CountryPause/comments.json?limit=20&raw_json=1";
    const res = await fetch(url, {
      headers: { "User-Agent": "VisaNova/1.0 (https://visanova.app)" },
      next: { revalidate: 120 },
    });
    if (!res.ok) return NextResponse.json({ comments: [] }, { headers: { "Cache-Control": "public, s-maxage=60" } });

    const json = (await res.json()) as { data?: { children?: RedditCommentChild[] } };
    const children = json?.data?.children ?? [];

    const comments: LatestRedditComment[] = children
      .map((child) => {
        const d = child?.data;
        if (!d || !d.body || d.body === "[removed]" || d.body === "[deleted]") return null;
        const postId = (d.link_id || "").replace("t3_", "");
        return {
          id: d.id,
          body: String(d.body).trim().slice(0, 500),
          author: d.author || "[deleted]",
          score: d.score ?? 0,
          createdAt: new Date(d.created_utc * 1000).toISOString(),
          permalink: d.permalink ? `https://www.reddit.com${d.permalink}` : `https://www.reddit.com/r/i130_75CountryPause/comments/${postId}/_/${d.id}`,
          postTitle: d.link_title?.slice(0, 100) || "Post",
          postId,
        };
      })
      .filter((c): c is LatestRedditComment => !!c);

    return NextResponse.json(
      { comments, source: "https://www.reddit.com/r/i130_75CountryPause/" },
      { headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300" } }
    );
  } catch (e) {
    console.error("[reddit latest-comments]", e);
    return NextResponse.json({ comments: [] }, { headers: { "Cache-Control": "public, s-maxage=60" } });
  }
}
