"use client";

import { useEffect, useState } from "react";
import { useProfile } from "@/hooks/useProfile";
import { getTimelineEstimate } from "@/lib/statsService";
import { format, differenceInDays, isAfter, isBefore } from "date-fns";

export default function ApprovalCountdownTimer() {
  const { profile } = useProfile();
  const [timelineEstimate, setTimelineEstimate] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [daysUntil, setDaysUntil] = useState<number | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const [confidenceRange, setConfidenceRange] = useState<{ earliest: Date | null; latest: Date | null }>({ earliest: null, latest: null });

  useEffect(() => {
    async function loadTimeline() {
      if (!profile?.priorityDate || !profile?.formType) {
        setLoading(false);
        return;
      }

      try {
        const priorityDate = new Date(profile.priorityDate);
        const estimate = await getTimelineEstimate(
          profile.formType,
          priorityDate,
          profile.serviceCenter
        );

        setTimelineEstimate(estimate);

        // Calculate days until most likely approval
        const today = new Date();
        const mostLikely = estimate.median || estimate.latest;
        
        if (mostLikely) {
          const days = differenceInDays(mostLikely, today);
          setDaysUntil(Math.max(0, days));
        }

        // Set confidence range
        setConfidenceRange({
          earliest: estimate.earliest || null,
          latest: estimate.latest || null,
        });

        // Calculate progress (based on case age vs typical processing time)
        const caseAge = differenceInDays(today, priorityDate);
        const typicalDays = profile.formType === "I-130" ? 450 : 300;
        const progressPercent = Math.min(100, Math.max(0, (caseAge / typicalDays) * 100));
        setProgress(progressPercent);
      } catch (error) {
        console.error("Error loading timeline estimate:", error);
      } finally {
        setLoading(false);
      }
    }

    loadTimeline();
  }, [profile]);

  if (loading || !profile?.priorityDate || !timelineEstimate) {
    return null;
  }

  const formatDate = (date: Date | null) => {
    if (!date) return "N/A";
    return format(date, "MMM d, yyyy");
  };

  const getConfidenceText = () => {
    if (!confidenceRange.earliest || !confidenceRange.latest) return "";
    if (confidenceRange.earliest.getTime() === confidenceRange.latest.getTime()) {
      return `Expected: ${formatDate(confidenceRange.earliest)}`;
    }
    return `${formatDate(confidenceRange.earliest)} - ${formatDate(confidenceRange.latest)}`;
  };

  return (
    <div className="uscis-card border-2 border-[var(--uscis-blue)]/20 bg-gradient-to-br from-blue-50/50 via-white to-indigo-50/50 dark:from-blue-900/10 dark:via-[var(--bg-surface)] dark:to-indigo-900/10">
      <div className="p-2.5 sm:p-6">
        {/* Header */}
        <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-4">
          <div className="w-8 h-8 sm:w-14 sm:h-14 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg flex-shrink-0">
            <svg
              className="w-4 h-4 sm:w-7 sm:h-7 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm sm:text-lg font-bold text-[var(--text-primary)] mb-0 sm:mb-1">
              <span className="hidden sm:inline">Approval Countdown</span>
              <span className="sm:hidden">Countdown</span>
            </h3>
            <p className="text-[10px] sm:text-sm text-[var(--text-secondary)] hidden sm:block">
              <span className="hidden sm:inline">Days until your estimated approval</span>
              <span className="sm:hidden">Days until approval</span>
            </p>
          </div>
        </div>

        {/* Countdown Display */}
        <div className="text-center mb-2 sm:mb-4">
          <div className="mb-1 sm:mb-2">
            <span className="text-3xl sm:text-6xl md:text-7xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent">
              {daysUntil !== null ? daysUntil : "—"}
            </span>
            <span className="text-base sm:text-2xl font-semibold text-[var(--text-secondary)] ml-1 sm:ml-2">
              days
            </span>
          </div>
          <p className="text-[10px] sm:text-base text-[var(--text-secondary)]">
            {getConfidenceText() || "Calculating..."}
          </p>
        </div>

        {/* Progress Bar */}
        <div className="mb-2 sm:mb-4">
          <div className="flex items-center justify-between mb-1 sm:mb-2">
            <span className="text-[10px] sm:text-sm font-medium text-[var(--text-secondary)]">
              Progress
            </span>
            <span className="text-[10px] sm:text-sm font-bold text-[var(--text-primary)]">
              {Math.round(progress)}%
            </span>
          </div>
          <div className="w-full h-2 sm:h-3 bg-[var(--bg-surface-alt)] rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Confidence Info */}
        {timelineEstimate.confidence && (
          <div className="flex items-center justify-center gap-1 sm:gap-2 text-[9px] sm:text-sm text-[var(--text-secondary)]">
            <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="hidden sm:inline">
              {timelineEstimate.confidence === "high" && "High confidence estimate"}
              {timelineEstimate.confidence === "medium" && "Medium confidence estimate"}
              {timelineEstimate.confidence === "low" && "Low confidence estimate"}
              {timelineEstimate.method && ` • ${timelineEstimate.method}`}
            </span>
            <span className="sm:hidden">
              {timelineEstimate.confidence === "high" ? "High" : timelineEstimate.confidence === "medium" ? "Med" : "Low"}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
