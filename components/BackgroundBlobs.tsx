"use client";

export function BackgroundBlobs() {
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden -z-10">
      {/* Dot grid — Huly subtle texture */}
      <div
        className="absolute inset-0 bg-dots opacity-50"
        aria-hidden
      />
      {/* Grid mesh overlay — Huly-style */}
      <div
        className="absolute inset-0 bg-grid-mesh opacity-40"
        aria-hidden
      />
      {/* Violet blob */}
      <div
        className="absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full bg-violet-300/30 dark:bg-violet-600/10 blur-3xl animate-blob"
        aria-hidden
      />
      {/* Fuchsia blob */}
      <div
        className="absolute -bottom-40 -left-40 w-[500px] h-[500px] rounded-full bg-fuchsia-300/25 dark:bg-fuchsia-600/10 blur-3xl animate-blob-delayed"
        aria-hidden
      />
      {/* Subtle center accent */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full bg-violet-200/20 dark:bg-violet-700/5 blur-3xl animate-blob"
        style={{ animationDelay: "-2s" }}
        aria-hidden
      />
      {/* Top spotlight — Huly hero gradient */}
      <div
        className="absolute inset-x-0 top-0 h-[60vh] spotlight-orb"
        aria-hidden
      />
      {/* Extra accent orb — bottom right */}
      <div
        className="absolute -bottom-20 right-1/4 w-[300px] h-[300px] rounded-full bg-fuchsia-400/15 dark:bg-fuchsia-500/5 blur-3xl animate-blob"
        style={{ animationDelay: "-6s" }}
        aria-hidden
      />
    </div>
  );
}
