"use client";

import DataSourceIndicator from "./DataSourceIndicator";
import GradientIconBadge from "@/components/GradientIconBadge";
import { ChartBarIcon } from "@heroicons/react/24/solid";

interface NowTileProps {
  latest: number;
  previous: number;
  lastPD: string;
}

export default function NowTile({ latest, previous, lastPD }: NowTileProps) {
  const trendUp = latest > previous;
  const trendFlat = latest === previous;

  return (
    <div className="uscis-card">
      <div className="p-4">
        <div className="flex items-center gap-4">
          {/* Icon */}
          <GradientIconBadge icon={ChartBarIcon} color="emerald" size="md" />

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs text-[var(--text-secondary)]">Now</span>
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
            </div>
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-base font-semibold text-[var(--text-primary)]">
                {latest} Priority Dates
              </span>
              {trendFlat ? (
                <span className="text-xs font-semibold text-[var(--text-secondary)]">steady</span>
              ) : trendUp ? (
                <span className="text-xs font-semibold text-green-600 dark:text-green-400">
                  +{latest - previous}
                </span>
              ) : (
                <span className="text-xs font-semibold text-red-600 dark:text-red-400">
                  -{previous - latest}
                </span>
              )}
            </div>
            <p className="text-xs text-[var(--text-secondary)] mb-1">
              Last approved Priority Date: {lastPD}
            </p>
            <p className="text-xs text-[var(--text-secondary)] italic">
              Processing continues. These numbers update throughout the day.
            </p>
            <div className="mt-2">
              <DataSourceIndicator source="community" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

