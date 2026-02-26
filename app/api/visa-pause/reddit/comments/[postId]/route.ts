import { NextRequest, NextResponse } from "next/server";

interface RedditComment {
  id: string;
  body: string;
  author: string;
  score: number;
  createdAt: string;
  permalink: string;
  depth: number;
  replies?: RedditComment[];
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
    depth?: number;
    replies?: string | { data: { children: RedditCommentChild[] } };
  };
}

function flattenComments(children: RedditCommentChild[], depth = 0): RedditComment[] {
  const result: RedditComment[] = [];
  for (const child of children) {
    if (child?.kind === "more") continue; // "load more" placeholder
    const d = child?.data;
    if (!d || d.body == null || d.body === "" || d.body === "[removed]" || d.body === "[deleted]") continue;
    const repliesData = typeof d.replies === "object" && d.replies != null && !Array.isArray(d.replies) && "data" in d.replies
      ? (d.replies as { data?: { children?: RedditCommentChild[] } }).data?.children
      : undefined;
    const replies = repliesData?.length ? flattenComments(repliesData, depth + 1) : undefined;
    result.push({
      id: d.id,
      body: String(d.body).trim(),
      author: d.author || "[deleted]",
      score: d.score ?? 0,
      createdAt: new Date(d.created_utc * 1000).toISOString(),
      permalink: d.permalink ? `https://www.reddit.com${d.permalink}` : "",
      depth: d.depth ?? depth,
      replies: replies?.length ? replies : undefined,
    });
  }
  return result;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  const { postId } = await params;
  if (!postId || postId === "fallback-visanova-community") {
    return NextResponse.json({ comments: [] }, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" } });
  }

  try {
    const url = `https://www.reddit.com/r/i130_75CountryPause/comments/${postId}.json?raw_json=1&limit=50`;
    const res = await fetch(url, {
      headers: { "User-Agent": "VisaNova/1.0 (https://visanova.app)" },
      next: { revalidate: 120 },
    });
    if (!res.ok) {
      return NextResponse.json({ comments: [] }, { headers: { "Cache-Control": "public, s-maxage=60" } });
    }
    const json = (await res.json()) as unknown[];
    if (!Array.isArray(json) || json.length < 2) {
      return NextResponse.json({ comments: [] }, { headers: { "Cache-Control": "public, s-maxage=60" } });
    }
    const commentListing = json[1] as { data?: { children?: RedditCommentChild[] } };
    const children = commentListing?.data?.children ?? [];
    const comments = flattenComments(children);
    return NextResponse.json(
      { comments, postId },
      { headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300" } }
    );
  } catch (e) {
    console.error("[reddit comments] fetch error:", e);
    return NextResponse.json({ comments: [] }, { headers: { "Cache-Control": "public, s-maxage=60" } });
  }
}
