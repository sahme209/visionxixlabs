"use client";

import React from "react";
import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { CaseTimeline, TimelineStage } from "@/lib/types";
import { generateTimeline } from "@/lib/services/timelineService";
import {
  BuildingOfficeIcon,
  BuildingOffice2Icon,
  PaperAirplaneIcon,
  CalendarIcon,
  LockClosedIcon,
  InformationCircleIcon,
} from "@heroicons/react/24/solid";
import { PremiumUpsell } from "./PremiumUpsell";

interface TimelineViewProps {
  timeline?: CaseTimeline | null;
  formType?: string;
  priorityDate?: Date;
  country?: string;
  processingPath?: "Consular" | "AOS";
  currentStage?: string;
  customPace?: number;
  isSubscribed?: boolean; // For premium gating
  isPremiumGated?: boolean; // Whether to show premium blur overlay
  /** When true, USCIS fetch failed — show "Couldn't verify" instead of timeline */
  caseStatusUnavailable?: boolean;
  /** When true, USCIS status is being fetched — show loading skeleton */
  caseStatusFetching?: boolean;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateCaseTracker(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateRange(earliest: Date, latest: Date): string {
  if (earliest.getTime() === latest.getTime()) {
    return formatDate(earliest);
  }
  return `${formatDate(earliest)} - ${formatDate(latest)}`;
}

// Case Tracker–style timeline: flat list, date | line+dot | event (like screenshot)
function CaseTrackerTimeline({
  stages,
  expandedStageId,
  onStageToggle,
}: {
  stages: TimelineStage[];
  expandedStageId: string | null;
  onStageToggle: (stageId: string) => void;
}) {
  return (
    <div className="relative">
      {/* Vertical line - runs through dot column, matches grid */}
      <div
        className="absolute top-6 bottom-6 w-px bg-[var(--border-color)] left-[7rem] sm:left-[7.5rem]"
        aria-hidden="true"
      />

      <div className="relative">
        {stages.map((stage) => {
          const isCompleted = stage.isCompleted;
          const isCurrent = stage.isCurrent;
          const displayDate = stage.earliestDate || stage.latestDate;
          const dateLabel = displayDate
            ? stage.earliestDate && stage.latestDate && stage.earliestDate.getTime() !== stage.latestDate.getTime()
              ? `${formatDate(stage.earliestDate)} – ${formatDate(stage.latestDate)}`
              : formatDateCaseTracker(displayDate)
            : "Date TBD";

          return (
            <div
              key={stage.id}
              className="grid grid-cols-[5.5rem_2rem_1fr] sm:grid-cols-[6.5rem_2rem_1fr] gap-x-3 py-4 first:pt-1 last:pb-1 cursor-pointer hover:opacity-90 transition-opacity items-start"
              onClick={() => onStageToggle(stage.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onStageToggle(stage.id)}
            >
              {/* Left: Date */}
              <div className="pr-2 text-right">
                <span className="text-xs font-semibold tabular-nums text-orange-600 dark:text-orange-500 leading-tight">
                  {dateLabel}
                </span>
              </div>

              {/* Center: Dot on line */}
              <div className="flex justify-center pt-0.5">
                <div
                  className={`h-3 w-3 rounded-full shrink-0 ${
                    isCompleted
                      ? "bg-[var(--uscis-green)]"
                      : isCurrent
                      ? "bg-[var(--uscis-blue)] ring-4 ring-[var(--uscis-blue)]/25"
                      : "bg-orange-400 dark:bg-orange-500"
                  }`}
                >
                  {isCompleted && (
                    <svg className="h-full w-full text-white p-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
              </div>

              {/* Right: Event text */}
              <div className="min-w-0">
                <p className="text-sm text-[var(--text-primary)] leading-snug">
                  {stage.description}
                </p>
                {isCurrent && (
                  <span className="inline-block mt-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-primary)]">
                    Current
                  </span>
                )}

                {expandedStageId === stage.id && stage.earliestDate && stage.latestDate && (
                  <div className="mt-2 rounded bg-white/60 dark:bg-white/10 p-2 text-[11px]">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <span className="text-[10px] font-medium uppercase text-[var(--text-tertiary)]">Earliest</span>
                        <div className="font-semibold tabular-nums">{formatDate(stage.earliestDate)}</div>
                      </div>
                      <div>
                        <span className="text-[10px] font-medium uppercase text-[var(--text-tertiary)]">Latest</span>
                        <div className="font-semibold tabular-nums">{formatDate(stage.latestDate)}</div>
                      </div>
                    </div>
                    {stage.dataSource && <p className="mt-2 text-[var(--text-tertiary)]">{stage.dataSource}</p>}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Wrapper for NVC/Embassy tabs - same Case Tracker style
function AgencySectionCard({
  title,
  icon,
  description,
  color,
  stages,
  expandedStageId,
  onStageToggle,
  isPremiumGated = false,
  isSubscribed = false,
}: {
  title: string;
  icon: string;
  description: string;
  color: string;
  stages: TimelineStage[];
  expandedStageId: string | null;
  onStageToggle: (stageId: string) => void;
  isPremiumGated?: boolean;
  isSubscribed?: boolean;
}) {
  const hasPastDate = (title === "NVC" || title === "Embassy") && stages.some((stage) => {
    if (!stage.latestDate) return false;
    return stage.latestDate < new Date();
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2.5 pb-2">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: `${color}18` }}>
          {icon === "building.2.fill" && <BuildingOfficeIcon className="w-3.5 h-3.5" style={{ color }} />}
          {icon === "building.2" && <BuildingOffice2Icon className="w-3.5 h-3.5" style={{ color }} />}
          {icon === "airplane.departure" && <PaperAirplaneIcon className="w-3.5 h-3.5" style={{ color }} />}
        </div>
        <div>
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">{title}</h3>
          <p className="text-[11px] text-[var(--text-secondary)]">{description}</p>
        </div>
      </div>
      <CaseTrackerTimeline stages={stages} expandedStageId={expandedStageId} onStageToggle={onStageToggle} />

      {hasPastDate && (
        <div className="mt-4 p-3 rounded-lg bg-white/50 dark:bg-white/5">
          <div className="flex items-start gap-2 mb-1.5">
            <InformationCircleIcon className="w-3.5 h-3.5 text-[var(--text-primary)] shrink-0 mt-0.5" />
            <p className="text-[11px] font-medium text-[var(--text-primary)]">Date has passed? Next steps:</p>
          </div>
          <ul className="text-[10px] text-[var(--text-secondary)] space-y-0.5 ml-5 list-disc">
            <li><Link href="/tools/expedite" className="text-[var(--text-primary)] hover:underline">Expedite options</Link> or contact USCIS</li>
            <li><a href="https://www.uscis.gov/tools/meet-emma-our-virtual-assistant" target="_blank" rel="noopener noreferrer" className="text-[var(--text-primary)] hover:underline">USCIS Emma</a></li>
            <li><a href="mailto:support@visionxixlabs.com?subject=VisaNova" className="text-[var(--text-primary)] hover:underline">Email us</a></li>
          </ul>
          <p className="text-[9px] text-[var(--text-tertiary)] mt-1.5 pt-1.5 border-t border-[var(--border-color)]">Not legal advice.</p>
        </div>
      )}
    </div>
  );
}

export default function TimelineView({
  timeline: providedTimeline,
  formType,
  priorityDate,
  country,
  processingPath = "Consular",
  currentStage,
  customPace,
  isSubscribed = false,
  isPremiumGated = false,
  caseStatusUnavailable = false,
  caseStatusFetching = false,
}: TimelineViewProps) {
  const [expandedStageId, setExpandedStageId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"uscis" | "nvc" | "embassy">("uscis");

  // Generate timeline if not provided (using async backend data)
  const [timeline, setTimeline] = useState<CaseTimeline | null>(providedTimeline || null);

  useEffect(() => {
    if (providedTimeline) {
      setTimeline(providedTimeline);
      return;
    }

    if (formType && priorityDate) {
      const loadTimeline = async () => {
        try {
          const generatedTimeline = await generateTimeline(
            formType,
            priorityDate,
            country,
            processingPath,
            customPace,
            currentStage
          );
          setTimeline(generatedTimeline);
        } catch (error) {
          console.error("Error generating timeline:", error);
          setTimeline(null);
        }
      };
      loadTimeline();
    } else {
      setTimeline(null);
    }
  }, [providedTimeline, formType, priorityDate, country, processingPath, customPace, currentStage]);

  // When USCIS is fetching, show loading state
  if (caseStatusFetching) {
    return (
      <div className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-color)] shadow-[var(--shadow-sm)] overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--border-color)]">
          <h3 className="text-base font-semibold text-[var(--text-primary)] tracking-tight">Your Case Timeline</h3>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">Estimated stages based on USCIS processing data</p>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-3">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--uscis-blue)]" />
            <p className="text-sm text-[var(--text-secondary)]">Fetching case status...</p>
          </div>
        </div>
      </div>
    );
  }

  // When USCIS fetch failed (wrong IOE, unavailable), show a helpful message instead of timeline
  if (caseStatusUnavailable) {
    return (
      <div className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-color)] shadow-[var(--shadow-sm)] overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--border-color)]">
          <h3 className="text-base font-semibold text-[var(--text-primary)] tracking-tight">Your Case Timeline</h3>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">Estimated stages based on USCIS processing data</p>
        </div>
        <div className="p-6">
          <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface-alt)] p-5">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-[var(--uscis-blue)]/10 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-[var(--text-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--text-primary)]">Timeline paused</p>
                <p className="text-xs text-[var(--text-secondary)] mt-1 leading-relaxed">
                  We couldn&apos;t verify your case status from USCIS. Please confirm your receipt number or try again during business hours (M–F, 7AM–8PM ET). Once we can reach USCIS, your timeline will appear here.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!timeline || timeline.stages.length === 0) {
    return (
      <div className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-color)] shadow-[var(--shadow-sm)] overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--border-color)]">
          <h3 className="text-base font-semibold text-[var(--text-primary)] tracking-tight">Your Case Timeline</h3>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">Estimated stages based on USCIS processing data</p>
        </div>
        <div className="p-8 text-center">
          <p className="text-sm text-[var(--text-secondary)] mb-5 max-w-sm mx-auto">
            Complete your profile to see your personalized processing timeline and estimated dates.
          </p>
          <Link
            href="/profile-setup"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[var(--uscis-blue)] text-white text-sm font-semibold rounded-lg hover:bg-[var(--uscis-blue-dark)] transition-colors"
          >
            Complete Profile
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </Link>
        </div>
      </div>
    );
  }

  // Group stages by agency (USCIS, NVC, Embassy)
  const uscisStages = timeline.stages.filter((s) => s.stageType === "uscis");
  const nvcStages = timeline.stages.filter((s) => s.stageType === "nvc");
  const embassyStages = timeline.stages.filter((s) => s.stageType === "embassy");

  const handleStageToggle = (stageId: string) => {
    setExpandedStageId(expandedStageId === stageId ? null : stageId);
  };

  const tabs: { id: "uscis" | "nvc" | "embassy"; label: string; stages: TimelineStage[]; requiresPremium: boolean }[] = [
    { id: "uscis", label: "USCIS", stages: uscisStages, requiresPremium: false },
    { id: "nvc", label: "NVC", stages: nvcStages, requiresPremium: true },
    { id: "embassy", label: "EMBASSY", stages: embassyStages, requiresPremium: true },
  ];

  return (
    <div className="relative rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-color)] shadow-[var(--shadow-sm)] overflow-hidden">
      {/* Header — Case Tracker style */}
      <div className="px-4 sm:px-5 py-4 border-b border-[var(--border-color)]/50 bg-white/50 dark:bg-white/5">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--bg-surface-alt)] border border-[var(--border-color)]">
            <CalendarIcon className="w-5 h-5 text-[var(--text-primary)]" />
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-bold text-[var(--text-primary)] tracking-tight">Your Case Timeline</h3>
            <p className="text-[11px] text-[var(--text-secondary)] mt-1">Estimated stages from filing to visa</p>
          </div>
          <span className="ml-auto text-[10px] font-semibold uppercase tracking-wider text-[var(--text-primary)] bg-[var(--uscis-blue)]/10 px-2.5 py-1.5 rounded-lg border border-[var(--uscis-blue)]/20 shrink-0">
            Based on USCIS data
          </span>
        </div>
      </div>

      {/* Tabs: USCIS | NVC | EMBASSY */}
      <div className="border-b border-[var(--border-color)]/50 bg-white/40 dark:bg-white/5">
        <div className="flex" role="tablist">
          {tabs.map((tab) => {
            if (tab.stages.length === 0) return null;
            const isActive = activeTab === tab.id;
            const isLocked = tab.requiresPremium && !isSubscribed;
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex-1 min-w-0 px-3 sm:px-4 py-3 sm:py-3.5 text-xs sm:text-sm font-semibold tracking-tight
                  transition-all duration-200
                  ${isActive
                    ? "text-[var(--text-primary)] border-b-2 border-[var(--uscis-blue)] bg-white/60 dark:bg-white/10"
                    : isLocked
                    ? "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/30 dark:hover:bg-white/5"
                  }
                `}
              >
                <span className="flex items-center justify-center gap-1.5">
                  {tab.label}
                  {isLocked && <LockClosedIcon className="w-3 h-3" />}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Agency Content — Case Tracker style, see-through panel */}
      <div className="relative px-4 sm:px-5 py-4 sm:py-5 min-h-[300px] bg-white/30 dark:bg-white/5">
        {/* USCIS tab — flat timeline like Case Tracker screenshot */}
        {activeTab === "uscis" && uscisStages.length > 0 && (
          <CaseTrackerTimeline
            stages={uscisStages}
            expandedStageId={expandedStageId}
            onStageToggle={handleStageToggle}
          />
        )}

        {/* NVC tab content */}
        {activeTab === "nvc" && nvcStages.length > 0 && (
          <div className="relative min-h-[300px]">
            {!isSubscribed ? (
              <div className="flex items-center justify-center py-8 px-4">
                <div className="w-full max-w-md">
                  <PremiumUpsell
                    title="See Your NVC Timeline"
                    subtitle="Unlock complete NVC stages and estimates"
                    features={["Complete NVC Timeline", "Accurate Processing Estimates", "Real-time Status Updates"]}
                    ctaText="Subscribe to Unlock"
                    variant="centered"
                  />
                </div>
              </div>
            ) : (
              <AgencySectionCard
                title="NVC"
                icon="building.2"
                description="National Visa Center processes your case after USCIS approval"
                color="#F97316"
                stages={nvcStages}
                expandedStageId={expandedStageId}
                onStageToggle={handleStageToggle}
                isPremiumGated={false}
                isSubscribed={true}
              />
            )}
          </div>
        )}

        {/* Embassy tab content */}
        {activeTab === "embassy" && embassyStages.length > 0 && (
          <div className="relative min-h-[300px]">
            {!isSubscribed ? (
              <div className="flex items-center justify-center py-8 px-4">
                <div className="w-full max-w-md">
                  <PremiumUpsell
                    title="See Your Embassy Timeline"
                    subtitle="Unlock embassy processing stages and interview estimates"
                    features={["Embassy Processing Stages", "Interview Date Estimates", "Visa Issuance Timeline"]}
                    ctaText="Subscribe to Unlock"
                    variant="centered"
                  />
                </div>
              </div>
            ) : (
              <AgencySectionCard
                title="Embassy"
                icon="airplane.departure"
                description="Your local embassy/consulate handles the final steps"
                color="#10B981"
                stages={embassyStages}
                expandedStageId={expandedStageId}
                onStageToggle={handleStageToggle}
                isPremiumGated={false}
                isSubscribed={true}
              />
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 sm:px-5 py-3 border-t border-[var(--border-color)]/50 bg-white/40 dark:bg-white/5 flex items-center gap-2.5 text-[var(--text-tertiary)]">
        <InformationCircleIcon className="w-4 h-4 shrink-0 opacity-70" />
        <p className="text-[10px] leading-relaxed">
          Estimates based on USCIS processing data. Actual times may vary. Not legal advice.
        </p>
      </div>
    </div>
  );
}
