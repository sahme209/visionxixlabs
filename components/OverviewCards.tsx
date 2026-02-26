"use client";

import Image from "next/image";
import Tooltip from "./Tooltip";
import AnimatedCounter from "./AnimatedCounter";
import DataSourceIndicator from "./DataSourceIndicator";
import { SECTION_IMAGES, ICON_IMAGES } from "@/lib/images";

interface OverviewCardProps {
  icon: string;
  title: string;
  value: string;
  isLive?: boolean;
  accent: string;
  tooltip?: string;
}

function SmallStatCard({ icon, title, value, isLive = false, accent, tooltip }: OverviewCardProps) {
  const bgImage = icon === "calendar" ? SECTION_IMAGES.calendar : icon === "speedometer" ? SECTION_IMAGES.office : icon === "clock" ? SECTION_IMAGES.checklist : SECTION_IMAGES.documents;
  const iconImg = icon === "calendar" ? ICON_IMAGES.calendar : icon === "speedometer" ? ICON_IMAGES.office : icon === "clock" ? ICON_IMAGES.checklist : ICON_IMAGES.documents;

  return (
    <div className="uscis-card p-3 h-24 group hover:shadow-md transition-all duration-200 relative overflow-hidden">
      <div className="absolute inset-0 opacity-[0.04]">
        <Image src={bgImage} alt="" fill className="object-cover" sizes="200px" />
      </div>
      <div className="relative flex items-start justify-between mb-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="w-6 h-6 rounded overflow-hidden flex-shrink-0 border border-[var(--border-color)]/50">
            <Image src={iconImg} alt="" width={24} height={24} className="w-full h-full object-cover" />
          </div>
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <span className="text-xs text-[var(--text-secondary)] font-medium truncate">{title}</span>
            {tooltip && (
              <Tooltip content={tooltip} iconOnly position="top" />
            )}
          </div>
        </div>
        {isLive && (
          <div className="flex items-center gap-1 flex-shrink-0">
            <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-[10px] text-green-600 dark:text-green-400 font-medium">Live</span>
          </div>
        )}
      </div>
      <p className="relative text-sm font-semibold text-[var(--text-primary)] line-clamp-2 leading-tight">
        {typeof value === "string" && /^\d+/.test(value) ? (
          <AnimatedCounter value={parseInt(value.replace(/,/g, "")) || 0} />
        ) : (
          value
        )}
      </p>
    </div>
  );
}

interface OverviewCardsProps {
  latestPD: string;
  pace: string;
  avgTime: string;
  backlog: string;
}

export default function OverviewCards({ latestPD, pace, avgTime, backlog }: OverviewCardsProps) {
  return (
    <div className="spacing-md">
      <div className="flex items-center spacing-sm mb-2">
        <h3 className="text-subhead font-semibold text-[var(--text-primary)]">Processing Overview</h3>
        <Tooltip 
          content="Real-time processing statistics based on official USCIS data and community-reported approvals. Updated daily."
          iconOnly 
          position="top"
        />
      </div>
      <div className="grid grid-cols-2 spacing-md">
        <SmallStatCard
          icon="calendar"
          title="Latest Priority Date"
          value={latestPD || "Calculating..."}
          isLive={!!latestPD}
          accent="#0071e3"
          tooltip="The most recent Priority Date currently being processed. This is the date USCIS is currently working on for approvals."
        />
        <SmallStatCard
          icon="speedometer"
          title="Processing Pace"
          value={pace || "Calculating..."}
          isLive={!!pace && pace !== "—"}
          accent="#1E88E5"
          tooltip="Average number of days processed per day. Higher pace means faster processing. Based on recent approval patterns."
        />
        <SmallStatCard
          icon="clock"
          title="Avg Processing Time"
          value={avgTime || "Analyzing..."}
          isLive={!!avgTime && avgTime !== "—"}
          accent="#F57C00"
          tooltip="Average time from Priority Date to approval for similar cases. This is an estimate based on historical data."
        />
        <SmallStatCard
          icon="exclamation"
          title="Total Backlog"
          value={backlog || "11.3M+ cases"}
          isLive={false}
          accent="#C62828"
          tooltip="Total number of pending cases in the USCIS system. This includes all form types and processing centers."
        />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <DataSourceIndicator source="community" />
        <DataSourceIndicator source="calculated" />
      </div>
    </div>
  );
}

