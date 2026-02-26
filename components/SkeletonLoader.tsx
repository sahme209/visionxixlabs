"use client";

interface SkeletonLoaderProps {
  variant?: "card" | "text" | "list" | "chart";
  lines?: number;
  className?: string;
}

export default function SkeletonLoader({
  variant = "card",
  lines = 3,
  className = "",
}: SkeletonLoaderProps) {
  if (variant === "card") {
    return (
      <div className={`uscis-card p-6 ${className}`}>
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl loading-shimmer"></div>
            <div className="flex-1 space-y-2">
              <div className="h-4 w-3/4 rounded loading-shimmer"></div>
              <div className="h-3 w-1/2 rounded loading-shimmer"></div>
            </div>
          </div>
          <div className="space-y-2">
            {Array.from({ length: lines }).map((_, i) => (
              <div key={i} className="h-3 rounded loading-shimmer" style={{ width: `${100 - i * 10}%` }}></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (variant === "chart") {
    return (
      <div className={`uscis-card p-6 ${className}`}>
        <div className="space-y-4">
          <div className="h-4 w-1/3 rounded loading-shimmer"></div>
          <div className="h-48 rounded-lg loading-shimmer"></div>
          <div className="flex gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex-1 h-16 rounded loading-shimmer"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (variant === "list") {
    return (
      <div className={`space-y-3 ${className}`}>
        {Array.from({ length: lines }).map((_, i) => (
          <div key={i} className="uscis-card p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg loading-shimmer"></div>
              <div className="flex-1 space-y-2">
                <div className="h-4 w-2/3 rounded loading-shimmer"></div>
                <div className="h-3 w-1/2 rounded loading-shimmer"></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Text variant
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="h-4 rounded loading-shimmer" style={{ width: `${100 - i * 5}%` }}></div>
      ))}
    </div>
  );
}
