"use client";

export function BackgroundBlobs() {
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden -z-10">
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
    </div>
  );
}
