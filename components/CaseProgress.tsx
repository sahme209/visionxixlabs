"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { SparklesIcon } from "@heroicons/react/24/outline";
import { PremiumUpsell } from "./PremiumUpsell";
import DataSourceIndicator from "./DataSourceIndicator";

interface CaseProgressProps {
  priorityDate?: Date;
  formType?: string;
  customPace?: number;
  currentLatestPD?: Date | null;
  isSubscribed?: boolean;
  isPremiumGated?: boolean;
}

// Enhanced Progress Ring Component with better styling - Larger size
function ProgressRing({ progress, isComplete }: { progress: number; isComplete: boolean }) {
  const [animatedProgress, setAnimatedProgress] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedProgress(Math.min(Math.max(progress, 0), 1));
    }, 100);
    return () => clearTimeout(timer);
  }, [progress]);

  const clampedProgress = Math.min(Math.max(animatedProgress, 0), 1);
  const circumference = 2 * Math.PI * 56; // Larger radius for bigger circles
  const strokeDasharray = circumference;
  const strokeDashoffset = circumference - clampedProgress * circumference;

  // Professional iOS-style colors - subtle and authentic
  const strokeColor = isComplete
    ? "#34C759" // iOS green
    : clampedProgress < 0.33
    ? "#FF3B30" // iOS red
    : clampedProgress < 0.66
    ? "#FF9500" // iOS orange
    : "#34C759"; // iOS green for high progress

  return (
    <div className="relative w-32 h-32">
      <svg className="w-32 h-32 transform -rotate-90" viewBox="0 0 120 120">
        {/* Background ring with adaptive color */}
        <circle
          cx="60"
          cy="60"
          r="56"
          fill="none"
          stroke={isComplete ? "#22C55E40" : "currentColor"}
          strokeWidth="12"
          className="text-slate-200 dark:text-slate-700"
        />
        {/* Progress ring with shadow */}
        <circle
          cx="60"
          cy="60"
          r="56"
          fill="none"
          stroke={strokeColor}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={strokeDasharray}
          strokeDashoffset={strokeDashoffset}
          className="transition-all duration-700 ease-out"
          style={{
            filter: `drop-shadow(0 4px 12px ${strokeColor}50)`,
          }}
        />
      </svg>
    </div>
  );
}

/**
 * Case Progress Component - Premium feature
 * Shows 3 rings: Progress %, Case Age, Queue Status
 */
export default function CaseProgress({
  priorityDate,
  formType = "I-130",
  customPace = 1.0,
  currentLatestPD,
  isSubscribed = false,
  isPremiumGated = true,
}: CaseProgressProps) {
  // Calculate Progress % (Ring 1)
  const progressPercentage = useMemo(() => {
    if (!priorityDate || !currentLatestPD) {
      return 0.5;
    }

    const estimatedApproval = new Date(priorityDate);
    estimatedApproval.setDate(estimatedApproval.getDate() + 404);

    const start = currentLatestPD;
    const end = estimatedApproval;

    if (end <= start) {
      return 1.0;
    }

    const now = new Date();
    const elapsed = Math.max(
      0,
      Math.floor((Math.min(now.getTime(), end.getTime()) - start.getTime()) / (1000 * 60 * 60 * 24))
    );
    const total = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

    return Math.min(Math.max(elapsed / total, 0), 1);
  }, [priorityDate, currentLatestPD, customPace, formType]);

  // Calculate Case Age (Ring 2)
  const caseAgeProgress = useMemo(() => {
    if (!priorityDate) return 0;

    const daysSincePD = Math.floor((Date.now() - priorityDate.getTime()) / (1000 * 60 * 60 * 24));
    const maxDays = 730;
    return Math.min(daysSincePD / maxDays, 1);
  }, [priorityDate]);

  const caseAgeDays = useMemo(() => {
    if (!priorityDate) return 0;
    return Math.floor((Date.now() - priorityDate.getTime()) / (1000 * 60 * 60 * 24));
  }, [priorityDate]);

  // Calculate Queue Status (Ring 3)
  const queueProgress = useMemo(() => {
    if (!priorityDate || !currentLatestPD) {
      return 0.5;
    }

    if (priorityDate <= currentLatestPD) {
      return 1.0;
    }

    const daysBehind = Math.floor(
      (priorityDate.getTime() - currentLatestPD.getTime()) / (1000 * 60 * 60 * 24)
    );
    const effectiveDaysBehind = Math.floor(daysBehind / Math.max(customPace, 0.1));
    const maxDaysBehind = 365;

    return Math.max(0, 1 - effectiveDaysBehind / maxDaysBehind);
  }, [priorityDate, currentLatestPD, customPace]);

  const queueStatus = useMemo(() => {
    if (!priorityDate || !currentLatestPD) {
      return "Unknown";
    }

    if (priorityDate <= currentLatestPD) {
      return "Current";
    }

    const daysBehind = Math.floor(
      (priorityDate.getTime() - currentLatestPD.getTime()) / (1000 * 60 * 60 * 24)
    );
    const adjusted = Math.ceil(daysBehind / Math.max(customPace, 0.1));
    return `${adjusted} days`;
  }, [priorityDate, currentLatestPD, customPace]);

  if (!priorityDate) {
    return null;
  }

  return (
    <div className="relative rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] shadow-sm overflow-hidden">
      {/* Sleek Header */}
      <div className="px-6 py-5 border-b border-[var(--border-color)] bg-[var(--bg-surface-alt)]/50">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--uscis-blue)] to-[var(--uscis-blue-dark)] shadow-sm">
            <SparklesIcon className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="text-base font-bold text-[var(--text-primary)]">Case Progress</h3>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">Track your advancement</p>
          </div>
          {isSubscribed && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/10 border border-green-500/20">
              <div className="h-1.5 w-1.5 rounded-full bg-green-500"></div>
              <span className="text-xs font-semibold text-green-600">Live</span>
            </div>
          )}
        </div>
      </div>

      <div className="relative p-6 sm:p-8">
        {/* Premium Overlay */}
        {isPremiumGated && !isSubscribed ? (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-[var(--bg-surface)]/98 backdrop-blur-sm">
            <div className="text-center p-8 max-w-md">
              <PremiumUpsell
                title="Track Your Progress in Real-Time"
                subtitle="See how close you are to approval"
                features={["Visual Progress Tracking", "Advanced Processing Analytics", "Queue Position Insights", "Predictive Timeline Forecasts"]}
                ctaText="Subscribe to Unlock"
                variant="centered"
              />
            </div>
          </div>
        ) : null}

        {/* Content - Only show if subscribed */}
        {(!isPremiumGated || isSubscribed) && (
          <div className="space-y-6">
            {/* Overall Progress - Sleek and Clean */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-[var(--text-primary)]">Overall Progress</h4>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-bold text-[var(--text-primary)]">
                    {Math.round(progressPercentage * 100)}%
                  </span>
                </div>
              </div>
              <div className="relative h-3 bg-[var(--bg-surface-alt)] rounded-full overflow-hidden">
                <div
                  className="absolute inset-y-0 left-0 rounded-full transition-all duration-1000 ease-out bg-gradient-to-r from-[var(--uscis-blue)] to-[var(--uscis-blue-dark)]"
                  style={{ width: `${Math.min(progressPercentage * 100, 100)}%` }}
                />
              </div>
            </div>

            {/* Three Progress Metrics - Ultra Clean Design */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Progress Card 1 */}
              <div className="relative rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface-alt)]/50 p-5 hover:bg-[var(--bg-surface-alt)] transition-colors">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">Approval</h4>
                    <span className="text-lg font-bold text-[var(--text-primary)]">
                      {Math.round(progressPercentage * 100)}%
                    </span>
                  </div>
                  <div className="relative h-1.5 bg-[var(--bg-surface)] rounded-full overflow-hidden">
                    <div
                      className="absolute inset-y-0 left-0 bg-[var(--uscis-blue)] rounded-full transition-all duration-1000 ease-out"
                      style={{ width: `${Math.min(progressPercentage * 100, 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-[var(--text-secondary)]">
                    {progressPercentage >= 0.75 ? "Final stages" : progressPercentage >= 0.5 ? "In progress" : "Early stage"}
                  </p>
                </div>
              </div>

              {/* Case Age Card 2 */}
              <div className="relative rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface-alt)]/50 p-5 hover:bg-[var(--bg-surface-alt)] transition-colors">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">Case Age</h4>
                    <span className="text-lg font-bold text-[var(--text-primary)]">
                      {caseAgeDays}
                    </span>
                  </div>
                  <div className="relative h-1.5 bg-[var(--bg-surface)] rounded-full overflow-hidden">
                    <div
                      className="absolute inset-y-0 left-0 bg-slate-400 rounded-full transition-all duration-1000 ease-out"
                      style={{ width: `${Math.min((caseAgeDays / 365) * 100, 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-[var(--text-secondary)]">
                    {caseAgeDays < 90 ? "Recently filed" : caseAgeDays < 180 ? "Processing" : caseAgeDays < 365 ? "Active review" : "Extended wait"}
                  </p>
                </div>
              </div>

              {/* Queue Status Card 3 */}
              <div className="relative rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface-alt)]/50 p-5 hover:bg-[var(--bg-surface-alt)] transition-colors">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">PD Status</h4>
                    <span className={`text-lg font-bold ${
                      queueProgress >= 1.0 
                        ? "text-green-600" 
                        : queueProgress >= 0.5
                        ? "text-[var(--text-primary)]"
                        : "text-orange-600"
                    }`}>
                      {queueStatus}
                    </span>
                  </div>
                  <div className="relative h-1.5 bg-[var(--bg-surface)] rounded-full overflow-hidden">
                    <div
                      className={`absolute inset-y-0 left-0 rounded-full transition-all duration-1000 ease-out ${
                        queueProgress >= 1.0
                          ? "bg-green-600"
                          : queueProgress >= 0.5
                          ? "bg-[var(--uscis-blue)]"
                          : "bg-orange-600"
                      }`}
                      style={{ width: `${Math.min(queueProgress * 100, 100)}%` }}
                    />
                  </div>
                  <p className={`text-xs ${
                    queueProgress >= 1.0
                      ? "text-green-600"
                      : queueProgress >= 0.5
                      ? "text-[var(--text-secondary)]"
                      : "text-orange-600"
                  }`}>
                    {queueProgress >= 1.0 ? "Current" : queueProgress >= 0.5 ? "Getting close" : "In queue"}
                  </p>
                </div>
              </div>
            </div>

            {/* Footer Info */}
            <div className="pt-4 border-t border-[var(--border-color)]">
              <div className="flex flex-wrap justify-center gap-3">
                <DataSourceIndicator source="calculated" />
                <DataSourceIndicator source="community" />
              </div>
              <p className="text-xs text-center text-[var(--text-secondary)] mt-3">
                Estimates based on processing trends. Not a guarantee.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
