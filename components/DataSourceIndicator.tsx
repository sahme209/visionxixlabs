"use client";

import { ShieldCheckIcon, ClockIcon } from "@heroicons/react/24/solid";

interface DataSourceIndicatorProps {
  source: "official" | "community" | "calculated";
  lastUpdated?: Date;
  className?: string;
}

export default function DataSourceIndicator({
  source,
  lastUpdated,
  className = "",
}: DataSourceIndicatorProps) {
  const sourceConfig = {
    official: {
      label: "Official USCIS Data",
      icon: ShieldCheckIcon,
      color: "text-[var(--text-primary)]",
      bg: "bg-[var(--uscis-blue)]/10",
      border: "border-[var(--uscis-blue)]/20",
    },
    community: {
      label: "Community Reported",
      icon: ShieldCheckIcon,
      color: "text-green-600 dark:text-green-400",
      bg: "bg-green-50 dark:bg-green-950/30",
      border: "border-green-200 dark:border-green-800",
    },
    calculated: {
      label: "Calculated Estimate",
      icon: ClockIcon,
      color: "text-[var(--text-primary)] dark:text-blue-400",
      bg: "bg-[var(--uscis-blue)]/10 dark:bg-blue-950/30",
      border: "border-[var(--uscis-blue)]/20 dark:border-blue-800",
    },
  };

  const config = sourceConfig[source];
  const Icon = config.icon;

  const formatLastUpdated = (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1) return "Just now";
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border ${config.bg} ${config.border} ${className}`}
    >
      <Icon className={`w-4 h-4 ${config.color}`} />
      <span className={`text-xs font-semibold ${config.color}`}>{config.label}</span>
      {lastUpdated && (
        <>
          <span className="text-[var(--text-tertiary)]">•</span>
          <span className="text-xs text-[var(--text-secondary)]">{formatLastUpdated(lastUpdated)}</span>
        </>
      )}
    </div>
  );
}
