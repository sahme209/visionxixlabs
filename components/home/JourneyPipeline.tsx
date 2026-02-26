"use client";

import { useMemo } from "react";
import Link from "next/link";
import type { CaseTimeline } from "@/lib/types";

interface JourneyPipelineProps {
  currentStage?: string;
  formType?: string;
  priorityDate?: string | Date;
  timeline?: CaseTimeline | null;
  serviceCenter?: string;
  country?: string;
  processingPath?: string;
  /** When true, show muted pipeline with CTA (logged-out) */
  isTeaser?: boolean;
  /** When true, USCIS fetch failed (wrong IOE, unavailable) — show "Couldn't verify" instead of progress */
  caseStatusUnavailable?: boolean;
  /** When true, USCIS status is being fetched — show loading skeleton */
  caseStatusFetching?: boolean;
}

const STAGES_I130 = [
  { id: "uscis", label: "USCIS", keys: ["uscis"] },
  { id: "nvc", label: "NVC", keys: ["nvc", "dq", "approved"] },
  { id: "interview", label: "Interview", keys: ["medical", "interview"] },
  { id: "visa", label: "Visa", keys: ["visaIssued"] },
];

const STAGES_I129F = [
  { id: "noa2", label: "NOA2", keys: ["uscis"] },
  { id: "nvc", label: "NVC", keys: ["nvc", "dq", "approved"] },
  { id: "interview", label: "Interview", keys: ["medical", "interview"] },
  { id: "visa", label: "Visa", keys: ["visaIssued"] },
];

function getCurrentStepIndex(currentStage: string | undefined, stages: typeof STAGES_I130): number {
  if (!currentStage) return 0;
  const lower = currentStage.toLowerCase();
  for (let i = 0; i < stages.length; i++) {
    if (stages[i].keys.some((k) => lower === k)) return i;
  }
  return 0;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function JourneyPipeline({
  currentStage,
  formType,
  priorityDate,
  timeline,
  serviceCenter,
  country,
  processingPath,
  isTeaser,
  caseStatusUnavailable,
  caseStatusFetching,
}: JourneyPipelineProps) {
  const stages = formType?.toUpperCase() === "I-129F" ? STAGES_I129F : STAGES_I130;
  const currentStep = useMemo(
    () => (caseStatusUnavailable ? -1 : getCurrentStepIndex(currentStage, stages)),
    [currentStage, stages, caseStatusUnavailable]
  );

  // Progress bar: center of current step, or 100% on last step; 0% when caseStatusUnavailable
  const progressPercent =
    caseStatusUnavailable || currentStep < 0
      ? 0
      : stages.length > 0
        ? currentStep >= stages.length - 1
          ? 100
          : ((currentStep + 0.5) / stages.length) * 100
        : 0;

  // Current stage date range from timeline
  const currentStageDates = useMemo(() => {
    if (!timeline?.stages?.length) return null;
    const currentOrNext = timeline.stages.find((s) => s.isCurrent || !s.isCompleted);
    if (!currentOrNext) return null;
    return {
      name: currentOrNext.name,
      earliest: new Date(currentOrNext.earliestDate),
      latest: new Date(currentOrNext.latestDate),
    };
  }, [timeline]);

  const priorityDateFormatted =
    priorityDate &&
    (typeof priorityDate === "string" ? new Date(priorityDate) : priorityDate) &&
    !isNaN((typeof priorityDate === "string" ? new Date(priorityDate) : priorityDate).getTime())
      ? formatDate(typeof priorityDate === "string" ? new Date(priorityDate) : priorityDate)
      : null;

  const formLabel = formType ? (formType.toUpperCase() === "I-129F" ? "I-129F" : formType.toUpperCase()) : null;
  const pathLabel = processingPath ? (processingPath === "Consular" ? "Consular" : "AOS") : null;
  const nextStageLabel = currentStep >= 0 && currentStep < stages.length - 1 ? stages[currentStep + 1]?.label : null;
  const currentStageLabel = currentStep >= 0 ? (stages[currentStep]?.label ?? "—") : "—";

  // When USCIS is fetching, show loading state
  if (caseStatusFetching && !isTeaser) {
    return (
      <div className="rounded-xl card-see-through overflow-hidden">
        <div className="px-4 py-4 sm:px-5 sm:py-5">
          <h3 className="text-sm font-bold text-[var(--text-primary)] tracking-tight">Where you are</h3>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5 mb-4">Your case stage in the process.</p>
          <div className="flex items-center justify-center py-8">
            <div className="flex flex-col items-center gap-3">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--uscis-blue)]" />
              <p className="text-sm text-[var(--text-secondary)]">Fetching case status...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // When USCIS fetch failed, show a helpful message instead of progress
  if (caseStatusUnavailable && !isTeaser) {
    return (
      <div className="rounded-xl card-see-through overflow-hidden transition-shadow duration-300">
        <div className="px-4 py-4 sm:px-5 sm:py-5">
          <h3 className="text-sm font-bold text-[var(--text-primary)] tracking-tight">Where you are</h3>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5 mb-4">Your case stage in the process.</p>
          <div className="rounded-xl bg-[var(--bg-surface-alt)] border border-[var(--border-color)] p-5">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-[var(--uscis-blue)]/10 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-[var(--text-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--text-primary)]">Status unavailable right now</p>
                <p className="text-xs text-[var(--text-secondary)] mt-1 leading-relaxed">
                  We couldn&apos;t load your case status from USCIS. Double-check your receipt number or try again during business hours (M–F, 7AM–8PM ET). Your progress will appear here once we can verify your case.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl card-see-through overflow-hidden transition-all duration-300">
      {/* Data strip — row 1 */}
      {!isTeaser && (priorityDateFormatted || formLabel || currentStageDates) && (
        <div className="px-4 py-3 sm:px-5 sm:py-3.5 bg-[var(--bg-surface-alt)] border-b border-[var(--border-color)]">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px]">
            {priorityDateFormatted && (
              <span className="flex items-center gap-2">
                <span className="text-[var(--text-tertiary)] font-medium uppercase tracking-wider">Priority date</span>
                <span className="font-semibold text-[var(--text-primary)]">{priorityDateFormatted}</span>
              </span>
            )}
            {formLabel && (
              <span className="flex items-center gap-2">
                <span className="text-[var(--text-tertiary)] font-medium uppercase tracking-wider">Form</span>
                <span className="font-semibold text-[var(--text-primary)]">{formLabel}</span>
              </span>
            )}
            {currentStageDates && (
              <span className="flex items-center gap-2">
                <span className="text-[var(--text-tertiary)] font-medium uppercase tracking-wider">Est. {currentStageDates.name}</span>
                <span className="font-semibold text-[var(--text-primary)]">
                  {formatDate(currentStageDates.earliest)} – {formatDate(currentStageDates.latest)}
                </span>
              </span>
            )}
          </div>
          {/* Row 2: service center, country, path */}
          {(serviceCenter || country || pathLabel) && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-2 pt-2 border-t border-[var(--border-color)]/60 text-[10px]">
              {serviceCenter && (
                <span className="flex items-center gap-1.5">
                  <span className="text-[var(--text-tertiary)]">Service center</span>
                  <span className="font-medium text-[var(--text-primary)]">{serviceCenter}</span>
                </span>
              )}
              {country && (
                <span className="flex items-center gap-1.5">
                  <span className="text-[var(--text-tertiary)]">Country</span>
                  <span className="font-medium text-[var(--text-primary)]">{country}</span>
                </span>
              )}
              {pathLabel && (
                <span className="flex items-center gap-1.5">
                  <span className="text-[var(--text-tertiary)]">Path</span>
                  <span className="font-medium text-[var(--text-primary)]">{pathLabel}</span>
                </span>
              )}
            </div>
          )}
        </div>
      )}

      <div className="px-4 py-4 sm:px-5 sm:py-5">
        <div className="flex items-end justify-between gap-3 mb-5">
          <div>
            <h3 className="text-base font-bold text-[var(--text-primary)] tracking-tight">
              {isTeaser ? "Your journey" : "Where you are"}
            </h3>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              {isTeaser
                ? "See your stage and estimated dates when you sign in."
                : "Your case stage in the process."}
            </p>
          </div>
          {!isTeaser && (
            <div className="text-right shrink-0">
              <div className="inline-flex items-baseline gap-0.5 px-3 py-1.5 rounded-lg bg-[var(--uscis-blue)]/10 border border-[var(--uscis-blue)]/20">
                <span className="text-lg sm:text-xl font-bold text-[var(--text-primary)] tabular-nums">{currentStep + 1}</span>
                <span className="text-sm font-medium text-[var(--text-tertiary)]">/{stages.length}</span>
              </div>
              <p className="text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider mt-1.5">
                Step
              </p>
            </div>
          )}
        </div>

        {/* Progress track */}
        <div className="relative pt-1">
          <div className="absolute top-1/2 left-0 right-0 h-1.5 -translate-y-1/2 rounded-full bg-[var(--bg-surface-alt)]" />
          <div
            className="absolute top-1/2 left-0 h-1.5 -translate-y-1/2 rounded-full bg-gradient-to-r from-[var(--uscis-blue)] via-[var(--uscis-blue-light)] to-[var(--uscis-blue-dark)] transition-all duration-500 ease-out"
            style={{
              width: isTeaser ? "0%" : `${Math.min(100, progressPercent)}%`,
            }}
          />
          <div className="relative flex justify-between w-full">
            {stages.map((stage, index) => {
              const isCompleted = !isTeaser && index < currentStep;
              const isCurrent = !isTeaser && index === currentStep;
              return (
                <div
                  key={stage.id}
                  className="flex flex-col items-center shrink-0 z-10"
                >
                  <div
                    className={`
                      w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center
                      border-2 transition-all duration-300
                      ${isTeaser
                        ? "bg-[var(--bg-surface-alt)] border-[var(--border-color)]"
                        : isCurrent
                          ? "bg-gradient-to-br from-[var(--uscis-blue)] to-[var(--uscis-blue-dark)] border-[var(--uscis-blue)] text-white shadow-lg shadow-[var(--uscis-blue)]/25 ring-4 ring-[var(--uscis-blue)]/20"
                          : isCompleted
                            ? "bg-[var(--uscis-green)]/15 border-[var(--uscis-green)] text-[var(--uscis-green)] dark:text-emerald-400"
                            : "bg-[var(--bg-surface)] border-[var(--border-color)] text-[var(--text-tertiary)]"
                      }
                    `}
                  >
                    {isCompleted ? (
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" aria-hidden>
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      <span className={`text-sm font-bold ${isCurrent ? "text-white" : ""}`} style={isCurrent ? { color: "#fff" } : undefined}>{index + 1}</span>
                    )}
                  </div>
                  <span
                    className={`
                      mt-2.5 text-[11px] sm:text-xs font-semibold text-center max-w-[4rem] sm:max-w-none leading-tight
                      ${isTeaser
                        ? "text-[var(--text-tertiary)]"
                        : isCurrent
                          ? "text-[var(--text-primary)]"
                          : isCompleted
                            ? "text-[var(--uscis-green)] dark:text-emerald-400"
                            : "text-[var(--text-tertiary)]"
                      }
                    `}
                  >
                    {stage.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Current / Next line */}
        {!isTeaser && (
          <div className="mt-5 pt-4 border-t border-[var(--border-color)]/60 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs">
            <span className="flex items-center gap-1.5">
              <span className="text-[var(--text-tertiary)] font-medium">Current</span>
              <span className="font-semibold text-[var(--text-primary)]">{currentStageLabel}</span>
            </span>
            {nextStageLabel && (
              <>
                <span className="text-[var(--text-tertiary)]">·</span>
                <span className="flex items-center gap-1.5">
                  <span className="text-[var(--text-tertiary)] font-medium">Next</span>
                  <span className="font-semibold text-[var(--text-primary)]">{nextStageLabel}</span>
                </span>
              </>
            )}
            <span className="text-[var(--text-tertiary)] ml-auto">
              {currentStep + 1} of {stages.length} stages
            </span>
          </div>
        )}

        {isTeaser && (
          <Link
            href="/login"
            className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)] hover:underline focus:outline-none focus:ring-2 focus:ring-[var(--uscis-blue)]/30 rounded"
          >
            Sign in to see your stage and dates
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        )}
      </div>
    </div>
  );
}
