"use client";

import { ArrowTrendingUpIcon, ArrowTrendingDownIcon, MinusIcon, LightBulbIcon } from "@heroicons/react/24/solid";
import Tooltip from "./Tooltip";
import OfficialBadge from "./OfficialBadge";
import AnimatedCounter from "./AnimatedCounter";

interface DataInsightCardProps {
  title: string;
  value: string | number;
  trend?: "up" | "down" | "neutral";
  trendValue?: string | number;
  description?: string;
  tooltip?: string;
  icon?: React.ReactNode;
  badge?: "official" | "verified" | "trusted";
  className?: string;
  highlight?: boolean;
}

export default function DataInsightCard({
  title,
  value,
  trend,
  trendValue,
  description,
  tooltip,
  icon,
  badge,
  className = "",
  highlight = false,
}: DataInsightCardProps) {
  const getTrendIcon = () => {
    switch (trend) {
      case "up":
        return <ArrowTrendingUpIcon className="w-4 h-4 text-green-600 dark:text-green-400" />;
      case "down":
        return <ArrowTrendingDownIcon className="w-4 h-4 text-red-600 dark:text-red-400" />;
      default:
        return <MinusIcon className="w-4 h-4 text-[var(--text-tertiary)]" />;
    }
  };

  const getTrendColor = () => {
    switch (trend) {
      case "up":
        return "text-green-600 dark:text-green-400";
      case "down":
        return "text-red-600 dark:text-red-400";
      default:
        return "text-[var(--text-secondary)]";
    }
  };

  return (
    <div
      className={`uscis-card p-5 transition-all duration-300 ${
        highlight ? "ring-2 ring-[var(--uscis-blue)]/30 shadow-lg" : ""
      } ${className}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {icon && <div className="flex-shrink-0">{icon}</div>}
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-[var(--text-primary)] truncate">{title}</h3>
            {tooltip && <Tooltip content={tooltip} iconOnly position="top" />}
          </div>
        </div>
        {badge && <OfficialBadge variant={badge} size="sm" />}
      </div>

      {/* Value */}
      <div className="mb-2">
        <div className="flex items-baseline gap-2">
          <span className={`text-2xl font-bold text-[var(--text-primary)] ${highlight ? "text-[var(--text-primary)]" : ""}`}>
            {typeof value === "number" ? (
              <AnimatedCounter value={value} />
            ) : (
              value
            )}
          </span>
          {trend && trendValue && (
            <div className={`flex items-center gap-1 ${getTrendColor()}`}>
              {getTrendIcon()}
              <span className="text-xs font-semibold">{trendValue}</span>
            </div>
          )}
        </div>
      </div>

      {/* Description */}
      {description && (
        <div className="flex items-start gap-2 mt-3 p-2.5 bg-[var(--bg-surface-alt)] rounded-lg border-l-2 border-[var(--uscis-blue)]">
          <LightBulbIcon className="w-4 h-4 text-[var(--text-primary)] flex-shrink-0 mt-0.5" />
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{description}</p>
        </div>
      )}
    </div>
  );
}
