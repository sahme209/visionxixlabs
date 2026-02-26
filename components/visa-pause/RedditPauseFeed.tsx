"use client";

import { useEffect, useState } from "react";
import { ArrowTopRightOnSquareIcon, ChevronDownIcon, ChevronUpIcon, ArrowPathIcon } from "@heroicons/react/24/outline";

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
  isFallback?: boolean;
}

interface ApiResponse {
  posts: RedditPost[];
  lastFetched: string;
  source: string;
}

interface LatestSubredditComment {
  id: string;
  body: string;
  author: string;
  score: number;
  createdAt: string;
  permalink: string;
  postTitle: string;
  postId: string;
}

function CommentRow({ c }: { c: RedditComment }) {
  const timeStr = c.createdAt
    ? new Date(c.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : "";
  return (
    <div
      className="rounded-lg border border-[var(--border-color)]/60 bg-[var(--bg-surface)]/80 px-3 py-2.5 text-[12px]"
      style={{ marginLeft: `${Math.min(c.depth, 3) * 12}px` }}
    >
      <div className="flex flex-wrap items-center gap-2 text-[10px] text-[var(--text-tertiary)] mb-1">
        <span className="font-semibold text-[var(--text-secondary)]">u/{c.author}</span>
        <span>•</span>
        <span>{c.score} ↑</span>
        {timeStr && <span>•</span>}
        {timeStr && <span>{timeStr}</span>}
      </div>
      <p className="text-[var(--text-secondary)] leading-snug whitespace-pre-wrap break-words">{c.body}</p>
      {c.replies?.length ? (
        <div className="mt-2 space-y-2">
          {c.replies.map((r) => (
            <CommentRow key={r.id} c={r} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function LatestCommentRow({ c }: { c: LatestSubredditComment }) {
  const timeStr = c.createdAt
    ? new Date(c.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : "";
  return (
    <a
      href={c.permalink}
      target="_blank"
      rel="noopener noreferrer"
      className="block rounded-lg border border-[var(--border-color)]/60 bg-[var(--bg-surface)]/80 px-3 py-2.5 text-[12px] hover:bg-[var(--bg-surface)]/90 transition-colors"
    >
      <div className="flex flex-wrap items-center gap-2 text-[10px] text-[var(--text-tertiary)] mb-1">
        <span className="font-semibold text-[var(--text-secondary)]">u/{c.author}</span>
        <span>•</span>
        <span>{c.score} ↑</span>
        {timeStr && <span>•</span>}
        {timeStr && <span>{timeStr}</span>}
      </div>
      <p className="text-[var(--text-secondary)] leading-snug line-clamp-2 break-words">{c.body}</p>
      {c.postTitle && (
        <p className="mt-1 text-[10px] text-[var(--text-tertiary)] truncate">→ {c.postTitle}</p>
      )}
    </a>
  );
}

export default function RedditPauseFeed() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, RedditComment[]>>({});
  const [loadingComments, setLoadingComments] = useState<Record<string, boolean>>({});
  const [refreshingComments, setRefreshingComments] = useState<Record<string, boolean>>({});
  const [latestComments, setLatestComments] = useState<LatestSubredditComment[]>([]);
  const [loadingLatestComments, setLoadingLatestComments] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch("/api/visa-pause/reddit");
        if (!res.ok) {
          throw new Error(`Request failed: ${res.status}`);
        }

        const json = (await res.json()) as ApiResponse;
        if (!cancelled) {
          setData(json);
        }
      } catch (e) {
        if (!cancelled) {
          console.error("[RedditPauseFeed] error", e);
          setError("Could not load community updates right now.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!data) return;
    let cancelled = false;
    setLoadingLatestComments(true);
    fetch("/api/visa-pause/reddit/latest-comments")
      .then((res) => res.json())
      .then((json: { comments?: LatestSubredditComment[] }) => {
        if (!cancelled && Array.isArray(json.comments)) {
          setLatestComments(json.comments.slice(0, 10));
        }
      })
      .catch(() => {
        if (!cancelled) setLatestComments([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingLatestComments(false);
      });
    return () => {
      cancelled = true;
    };
  }, [data]);

  const loadComments = async (postId: string, isRefresh = false) => {
    if (postId === "fallback-visanova-community") return;
    if (isRefresh) {
      setRefreshingComments((prev) => ({ ...prev, [postId]: true }));
    } else {
      setLoadingComments((prev) => ({ ...prev, [postId]: true }));
    }
    try {
      const res = await fetch(`/api/visa-pause/reddit/comments/${postId}`);
      const json = (await res.json()) as { comments: RedditComment[] };
      setComments((prev) => ({ ...prev, [postId]: json.comments ?? [] }));
    } catch {
      setComments((prev) => ({ ...prev, [postId]: [] }));
    } finally {
      setLoadingComments((prev) => ({ ...prev, [postId]: false }));
      setRefreshingComments((prev) => ({ ...prev, [postId]: false }));
    }
  };

  const toggleExpand = (postId: string) => {
    if (postId === "fallback-visanova-community") return;
    setExpandedId((prev) => (prev === postId ? null : postId));
    if (expandedId !== postId && !comments[postId]) {
      void loadComments(postId);
    }
  };

  if (loading && !data) {
    return (
      <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-5 sm:p-6 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-bold text-[var(--text-primary)]">Community check‑ins</h3>
          <span className="text-[11px] text-[var(--text-tertiary)]">Loading…</span>
        </div>
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="rounded-lg border border-[var(--border-color)]/60 bg-[var(--bg-surface-alt)]/70 p-3 animate-pulse"
            >
              <div className="h-3 w-3/4 rounded bg-[var(--bg-surface)] mb-2" />
              <div className="h-3 w-1/3 rounded bg-[var(--bg-surface)] mb-1.5" />
              <div className="h-3 w-1/4 rounded bg-[var(--bg-surface)]" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error || !data || data.posts.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-5 sm:p-6 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-base font-bold text-[var(--text-primary)]">Community check‑ins</h3>
        </div>
        <p className="text-sm text-[var(--text-secondary)]">
          {error ??
            "No recent posts from the community yet. Check back soon or share your experience in the Visa Pause subreddit."}
        </p>
      </div>
    );
  }

  const { posts, lastFetched, source } = data;
  const lastFetchedLabel = lastFetched
    ? new Date(lastFetched).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "";

  return (
    <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-5 sm:p-6 shadow-sm">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div>
          <h3 className="text-base font-bold text-[var(--text-primary)]">Community check‑ins</h3>
          <p className="text-xs text-[var(--text-secondary)]">
            Latest posts and comments from{" "}
            <a
              href={source}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--text-primary)] font-semibold hover:underline"
            >
              r/i130_75CountryPause
            </a>
          </p>
        </div>
        {lastFetchedLabel && (
          <span className="text-[10px] text-[var(--text-tertiary)] whitespace-nowrap">Updated {lastFetchedLabel}</span>
        )}
      </div>

      <div className="space-y-3">
        {posts.map((post) => {
          const isExpanded = expandedId === post.id;
          const postComments = comments[post.id] ?? [];
          const isLoadingComments = loadingComments[post.id];
          const isRefreshingComments = refreshingComments[post.id];

          return (
            <div
              key={post.id}
              className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface-alt)]/60 overflow-hidden"
            >
              <div className="flex items-start gap-3 px-3 py-3.5 sm:px-4 sm:py-4">
                <div className="mt-0.5 h-2 w-2 rounded-full bg-[var(--text-tertiary)] flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <a
                      href={post.permalink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-semibold text-[var(--text-primary)] leading-snug line-clamp-2 hover:underline"
                    >
                      {post.title}
                    </a>
                    <a
                      href={post.permalink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-shrink-0 text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                      aria-label="Open on Reddit"
                    >
                      <ArrowTopRightOnSquareIcon className="w-4 h-4" />
                    </a>
                  </div>
                  {!post.isFallback ? (
                    <>
                      <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-[var(--text-tertiary)]">
                        {post.flair && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[var(--bg-surface)] border border-[var(--border-color)] text-[10px] font-semibold uppercase tracking-wide">
                            {post.flair}
                          </span>
                        )}
                        <span>u/{post.author}</span>
                        <span>•</span>
                        <span>{post.score} upvotes</span>
                        <span>•</span>
                        <span>{post.numComments} comments</span>
                      </div>
                      {post.numComments > 0 && !post.isFallback && (
                        <button
                          type="button"
                          onClick={() => toggleExpand(post.id)}
                          className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-semibold text-[var(--text-primary)] hover:text-[var(--uscis-blue)]"
                        >
                          {isExpanded ? (
                            <>
                              <ChevronUpIcon className="w-4 h-4" />
                              Hide comments
                            </>
                          ) : (
                            <>
                              <ChevronDownIcon className="w-4 h-4" />
                              Show comments
                            </>
                          )}
                        </button>
                      )}
                    </>
                  ) : (
                    <p className="mt-1.5 text-[11px] text-[var(--text-tertiary)]">
                      Open Reddit to see live threads, comments, and upvotes from others affected by the pause.
                    </p>
                  )}
                </div>
              </div>

              {isExpanded && !post.isFallback && (
                <div className="border-t border-[var(--border-color)]/60 px-3 py-3 sm:px-4 sm:py-3 bg-[var(--bg-surface)]/50">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-semibold text-[var(--text-secondary)]">Comments</span>
                    <button
                      type="button"
                      onClick={() => loadComments(post.id, true)}
                      disabled={!!isRefreshingComments}
                      className="inline-flex items-center gap-1 text-[10px] font-semibold text-[var(--text-primary)] hover:text-[var(--uscis-blue)] disabled:opacity-50"
                    >
                      <ArrowPathIcon className={`w-3.5 h-3.5 ${isRefreshingComments ? "animate-spin" : ""}`} />
                      Load new comments
                    </button>
                  </div>
                  {isLoadingComments && postComments.length === 0 ? (
                    <div className="flex items-center gap-2 py-4 text-[11px] text-[var(--text-tertiary)]">
                      <span className="inline-block h-4 w-4 rounded-full border-2 border-[var(--border-color)] border-t-[var(--text-primary)] animate-spin" />
                      Loading comments…
                    </div>
                  ) : postComments.length === 0 ? (
                    <p className="py-2 text-[11px] text-[var(--text-tertiary)]">No comments yet.</p>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {postComments.map((c) => (
                        <CommentRow key={c.id} c={c} />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Latest comments from the subreddit — shown when posts exist or fallback */}
      <div className="mt-5 pt-4 border-t border-[var(--border-color)]/60">
        <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-2">Latest comments</h4>
        {loadingLatestComments && latestComments.length === 0 ? (
          <div className="flex items-center gap-2 py-4 text-[11px] text-[var(--text-tertiary)]">
            <span className="inline-block h-4 w-4 rounded-full border-2 border-[var(--border-color)] border-t-[var(--text-primary)] animate-spin" />
            Loading comments…
          </div>
        ) : latestComments.length === 0 ? (
          <p className="text-[11px] text-[var(--text-tertiary)] py-2">
            No recent comments yet. Check back or{" "}
            <a href={source} target="_blank" rel="noopener noreferrer" className="font-semibold hover:underline">
              open Reddit
            </a>{" "}
            to join the conversation.
          </p>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {latestComments.map((c) => (
              <LatestCommentRow key={c.id} c={c} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
