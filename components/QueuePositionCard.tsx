"use client";

import React from "react";
import Image from "next/image";
import { useState, useEffect } from "react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip as RechartsTooltip } from "recharts";
import { QueuePositionEngine } from "@/lib/calculations/queuePosition";
import { calculateQueuePositionFromRealData } from "@/lib/services/queuePositionService";
import { ClockIcon, CheckCircleIcon, ArrowUpIcon, ArrowDownIcon } from "@heroicons/react/24/solid";
import { positionHistoryService, PositionMovementMetrics, PositionSnapshot } from "@/lib/services/positionHistoryService";
import { positionTrendAnalyzer, PaceTrendAnalysis } from "@/lib/services/positionTrendAnalyzer";
import { useAuth } from "@/contexts/AuthContext";
import Tooltip from "./Tooltip";
import SkeletonLoader from "./SkeletonLoader";
import { SECTION_IMAGES, ICON_IMAGES } from "@/lib/images";

interface QueuePositionCardProps {
  userPriorityDate?: Date;
  currentLatestPD?: Date | null;
  formType?: string;
  processingPath?: string;
}

function formatNumber(num: number): string {
  return num.toLocaleString();
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function monthsBetween(earlier: Date, later: Date): number {
  return (later.getFullYear() - earlier.getFullYear()) * 12 + (later.getMonth() - earlier.getMonth());
}

function formatLastUpdated(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

  if (diffHours < 1) {
    return "Just now";
  } else if (diffHours < 24) {
    return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
  } else {
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) {
      return "Yesterday";
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return formatDate(date);
    }
  }
}

export default function QueuePositionCard({
  userPriorityDate,
  currentLatestPD,
  formType = "I-130",
  processingPath = "Consular",
}: QueuePositionCardProps) {
  const [result, setResult] = useState<ReturnType<typeof QueuePositionEngine.calculateQueuePosition> | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(false);
  const [movementMetrics, setMovementMetrics] = useState<PositionMovementMetrics | null>(null);
  const [paceAnalysis, setPaceAnalysis] = useState<PaceTrendAnalysis | null>(null);
  const [positionHistory, setPositionHistory] = useState<PositionSnapshot[]>([]);
  const [isLoadingMovement, setIsLoadingMovement] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    if (!userPriorityDate) {
      return;
    }

    // Only calculate for I-130 Consular and I-129F
    const formTypeUpper = formType.toUpperCase().trim();
    const pathUpper = processingPath.toUpperCase().trim();
    if (!((formTypeUpper === "I-130" && pathUpper === "CONSULAR") || formTypeUpper === "I-129F")) {
      return;
    }

    setIsLoading(true);

    // Use real backend data to calculate queue position (same as iOS)
    calculateQueuePositionFromRealData(userPriorityDate, formType, processingPath)
      .then((realDataResult) => {
        if (realDataResult.isCurrent) {
          // User's PD is current based on real data
          setResult({
            position: null,
            positionRange: null,
            daysRemaining: 0,
            status: "current",
            confidence: "high",
            context: realDataResult.context,
            lastUpdated: new Date(),
          });
        } else if (realDataResult.position !== null && realDataResult.latestPD) {
          // Calculate days remaining
          const daysBetween = Math.floor(
            (userPriorityDate.getTime() - realDataResult.latestPD.getTime()) / (1000 * 60 * 60 * 24)
          );

          // Calculate position range (±10%)
          const positionVariance = Math.floor(realDataResult.position * 0.1);
          const minPosition = Math.max(50, realDataResult.position - positionVariance);
          const maxPosition = Math.min(50000, realDataResult.position + positionVariance);

          // Determine confidence
          let confidence: "high" | "medium" | "low";
          if (daysBetween <= 30) {
            confidence = "high";
          } else if (daysBetween <= 90) {
            confidence = "medium";
          } else {
            confidence = "low";
          }

          setResult({
            position: realDataResult.position,
            positionRange: { min: minPosition, max: maxPosition },
            daysRemaining: daysBetween,
            status: "waiting",
            confidence,
            context: realDataResult.context,
            lastUpdated: new Date(),
          });
        } else {
          // Unable to calculate
          setResult(null);
        }
        setIsLoading(false);
      })
      .catch((error) => {
        console.error("[QueuePositionCard] Error calculating queue position:", error);
        setResult(null);
        setIsLoading(false);
      });
  }, [userPriorityDate, formType, processingPath]);

  // Load movement data when result is available (no sub required)
  useEffect(() => {
    if (result && user && result.position !== null) {
      loadMovementData();
    }
  }, [result, user]);

  const loadMovementData = async () => {
    if (!user || !result || result.position === null) return;

    setIsLoadingMovement(true);

    try {
      // Get position history
      const history = await positionHistoryService.getPositionHistory(
        user.uid,
        formType,
        30
      );
      setPositionHistory(history);

      // Save current position snapshot
      const percentile = calculatePercentile(result.position, 10000); // Approximate
      await positionHistoryService.savePositionSnapshot(
        user.uid,
        formType,
        result.position,
        percentile,
        result.daysRemaining,
        null,
        new Date()
      );

      // Create current snapshot
      const currentSnapshot = {
        id: "current",
        formType,
        position: result.position,
        percentile,
        daysRemaining: result.daysRemaining,
        currentPD: null,
        calculatedAt: new Date(),
      };

      // Calculate movement metrics
      const metrics = positionHistoryService.calculateMovementMetrics(
        currentSnapshot,
        history
      );

      // Analyze pace trend
      const pace = positionTrendAnalyzer.analyzePaceTrend(
        history,
        result.position,
        null
      );

      setMovementMetrics(metrics);
      setPaceAnalysis(pace);
    } catch (error: unknown) {
      const err = error as { code?: string; message?: string };
      const isPermissionError =
        err?.code === "permission-denied" ||
        (typeof err?.message === "string" &&
          (err.message.toLowerCase().includes("permission") ||
            err.message.toLowerCase().includes("insufficient")));
      const isIndexError =
        err?.code === "failed-precondition" ||
        (typeof err?.message === "string" && err.message.toLowerCase().includes("index"));
      if (isPermissionError) {
        console.warn("[QueuePositionCard] Position history unavailable (permissions). Movement metrics hidden.");
      } else if (isIndexError) {
        console.warn("[QueuePositionCard] Position history index not ready. Movement metrics hidden.");
      } else {
        console.error("[QueuePositionCard] Error loading movement data:", error);
      }
    } finally {
      setIsLoadingMovement(false);
    }
  };

  const calculatePercentile = (position: number, totalCases: number): number => {
    if (totalCases <= 0) return 50.0;
    return ((position - 1) / totalCases) * 100.0;
  };

  if (!userPriorityDate) {
    return null;
  }

  // Only show for I-130 Consular and I-129F
  const formTypeUpper = formType.toUpperCase().trim();
  const pathUpper = processingPath.toUpperCase().trim();
  if (!((formTypeUpper === "I-130" && pathUpper === "CONSULAR") || formTypeUpper === "I-129F")) {
    return null;
  }

  return (
    <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-4 sm:p-6 shadow-sm hover:shadow-md transition-shadow overflow-hidden relative">
      <div className="absolute inset-0 opacity-[0.04]">
        <Image src={SECTION_IMAGES.office} alt="" fill className="object-cover" sizes="600px" />
      </div>
      {/* Header — Apple-style compact */}
      <div className="relative mb-3 flex items-start gap-3">
        <div className="flex h-10 w-10 rounded-xl overflow-hidden border border-[var(--border-color)] flex-shrink-0 bg-[var(--bg-surface-alt)]">
          <Image src={ICON_IMAGES.chart} alt="" width={40} height={40} className="w-full h-full object-cover" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-[var(--text-primary)]">Queue Position</h3>
            <Tooltip content="Your estimated place in the processing queue based on your Priority Date and real-time approval data." iconOnly position="top" />
          </div>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">Where you stand among similar cases</p>
        </div>
      </div>

      {/* On-track summary */}
      {currentLatestPD && (
        <div className="relative">
          <OnTrackSummary userPriorityDate={userPriorityDate} currentLatestPD={currentLatestPD} formType={formType} />
        </div>
      )}

      {/* Content — no subscription required */}
      <div className="relative">
      {isLoading ? (
        <LoadingView />
      ) : result ? (
        <QueuePositionContent 
          result={result} 
          userPriorityDate={userPriorityDate}
          movementMetrics={movementMetrics}
          paceAnalysis={paceAnalysis}
          positionHistory={positionHistory}
        />
      ) : (
        <EmptyState formType={formType} processingPath={processingPath} />
      )}
      </div>
    </div>
  );
}

// On-track summary (consolidated from OnTrackCard)
function OnTrackSummary({
  userPriorityDate,
  currentLatestPD,
  formType,
}: {
  userPriorityDate: Date;
  currentLatestPD: Date;
  formType: string;
}) {
  const user = new Date(userPriorityDate);
  const latest = new Date(currentLatestPD);
  user.setHours(0, 0, 0, 0);
  latest.setHours(0, 0, 0, 0);
  const monthsAhead = monthsBetween(latest, user);
  const formatPD = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  let status: { message: string; sub: string; dotClass: string };
  if (user.getTime() <= latest.getTime()) {
    status = {
      message: "Your priority date is ahead of recent approvals—you may hear soon.",
      sub: `Recent approvals at ${formatPD(latest)}. Your PD: ${formatPD(user)}.`,
      dotClass: "bg-green-500",
    };
  } else if (monthsAhead <= 3) {
    status = {
      message: "You're getting close. Recent approvals are a few months ahead of your PD.",
      sub: `Current approvals at ${formatPD(latest)}. Your PD: ${formatPD(user)} (~${monthsAhead} mo behind).`,
      dotClass: "bg-indigo-600",
    };
  } else {
    status = {
      message: "You're in the queue. System is processing cases before your PD.",
      sub: `Recent approvals at ${formatPD(latest)}. Your PD: ${formatPD(user)} (~${monthsAhead} mo).`,
      dotClass: "bg-blue-500",
    };
  }
  const formLabel = formType?.toUpperCase() === "I-129F" ? "I-129F" : "I-130";
  return (
    <div className="rounded-lg bg-[var(--bg-surface-alt)]/50 px-3 py-2.5 mb-3 border border-[var(--border-color)]/50">
      <div className="flex items-center gap-2.5">
        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${status.dotClass}`} />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-[var(--text-primary)] leading-snug">{status.message}</p>
          <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">{status.sub}</p>
        </div>
      </div>
    </div>
  );
}

// Loading View (matches iOS loadingView)
function LoadingView() {
  return <SkeletonLoader variant="card" className="mb-6" />;
}

// Empty State (matches iOS emptyState)
function EmptyState({ formType, processingPath }: { formType: string; processingPath: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-5 text-center">
      <ClockIcon className="w-8 h-8 text-[var(--text-secondary)]" />
      <span className="text-sm text-[var(--text-secondary)]">Calculating position</span>
      <p className="max-w-xs text-xs text-[var(--text-secondary)]">
        Make sure you have a priority date set and your form type is I-130 (Consular) or I-129F
      </p>
    </div>
  );
}

// Queue Position Content (matches iOS queuePositionContent)
function QueuePositionContent({
  result,
  userPriorityDate,
  movementMetrics,
  paceAnalysis,
  positionHistory,
}: {
  result: NonNullable<ReturnType<typeof QueuePositionEngine.calculateQueuePosition>>;
  userPriorityDate: Date;
  movementMetrics?: PositionMovementMetrics | null;
  paceAnalysis?: PaceTrendAnalysis | null;
  positionHistory?: PositionSnapshot[];
}) {
  const getConfidenceColor = () => {
    switch (result.confidence) {
      case "high":
        return "bg-green-500";
      case "medium":
        return "bg-orange-500";
      case "low":
        return "bg-blue-500";
    }
  };

  const getConfidenceText = () => {
    switch (result.confidence) {
      case "high":
        return "High confidence";
      case "medium":
        return "Medium confidence";
      case "low":
        return "Low confidence";
    }
  };

  // Chart data: position over time (last 7 snapshots, newest first, reverse for chart)
  const positionChartData = (positionHistory || [])
    .filter((s) => s.position != null)
    .slice(0, 7)
    .reverse()
    .map((s) => ({
      label: s.calculatedAt.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }),
      position: s.position!,
    }));

  return (
    <div className="space-y-4">
      {/* Position Display or Current Status */}
      {result.status === "current" ? (
        <CurrentStatusDisplay />
      ) : result.position ? (
        <PositionDisplay position={result.position} result={result} />
      ) : null}

      {/* Charts + Movement — consolidated Apple-style layout */}
      {(positionChartData.length > 0 || movementMetrics) && (
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            {positionChartData.length > 0 && (
              <div className="flex-1 rounded-lg p-3 border border-[var(--border-color)]/50 bg-[var(--bg-surface-alt)]/50">
                <p className="text-[11px] font-medium text-[var(--text-secondary)] mb-2">Position over time</p>
                <div className="w-full h-20 min-w-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={positionChartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                      <XAxis dataKey="label" tick={{ fontSize: 9, fill: "var(--text-secondary)" }} axisLine={{ stroke: "var(--border-color)" }} tickLine={false} />
                      <YAxis tick={{ fontSize: 9, fill: "var(--text-secondary)" }} width={28} axisLine={false} tickLine={false} allowDecimals={false} tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : String(v))} />
                      <RechartsTooltip contentStyle={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-color)", borderRadius: "8px", fontSize: "11px" }} formatter={(value: number | undefined) => [`#${formatNumber(value ?? 0)}`, "Position"]} labelFormatter={(label) => label ?? ""} />
                      <Bar dataKey="position" fill="var(--uscis-blue)" fillOpacity={0.8} radius={[4, 4, 0, 0]} maxBarSize={20} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
            {(movementMetrics?.positionChange7Days != null || movementMetrics?.positionChange30Days != null) && (
              <div className="rounded-lg px-4 py-3 border border-[var(--border-color)]/50 bg-[var(--bg-surface-alt)]/50 flex items-center gap-4 shrink-0">
                {movementMetrics.positionChange7Days != null && (
                  <div className="flex items-center gap-2">
                    {movementMetrics.positionChange7Days > 0 ? <ArrowUpIcon className="w-5 h-5 text-green-500" /> : movementMetrics.positionChange7Days < 0 ? <ArrowDownIcon className="w-5 h-5 text-red-500" /> : <div className="w-5 h-5 rounded-full bg-blue-500/30" />}
                    <span className={`text-sm font-semibold tabular-nums ${movementMetrics.positionChange7Days > 0 ? "text-green-600" : movementMetrics.positionChange7Days < 0 ? "text-red-600" : "text-[var(--text-primary)]"}`}>
                      {movementMetrics.positionChange7Days > 0 ? "+" : ""}{movementMetrics.positionChange7Days}
                    </span>
                    <span className="text-[11px] text-[var(--text-secondary)]">7d</span>
                  </div>
                )}
                {movementMetrics.positionChange30Days != null && (
                  <div className="flex items-center gap-2 border-l border-[var(--border-color)]/50 pl-4">
                    {movementMetrics.positionChange30Days > 0 ? <ArrowUpIcon className="w-5 h-5 text-green-500" /> : movementMetrics.positionChange30Days < 0 ? <ArrowDownIcon className="w-5 h-5 text-red-500" /> : <div className="w-5 h-5 rounded-full bg-blue-500/30" />}
                    <span className={`text-sm font-semibold tabular-nums ${movementMetrics.positionChange30Days > 0 ? "text-green-600" : movementMetrics.positionChange30Days < 0 ? "text-red-600" : "text-[var(--text-primary)]"}`}>
                      {movementMetrics.positionChange30Days > 0 ? "+" : ""}{movementMetrics.positionChange30Days}
                    </span>
                    <span className="text-[11px] text-[var(--text-secondary)]">30d</span>
                  </div>
                )}
              </div>
            )}
          </div>
          {paceAnalysis && (
            <div className="rounded-lg px-3 py-2.5 border border-[var(--border-color)]/50 bg-[var(--bg-surface-alt)]/50">
              <p className="text-[11px] font-medium text-[var(--text-primary)]">{paceAnalysis.paceDescription}</p>
              <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">{paceAnalysis.trendDescription}</p>
            </div>
          )}
        </div>
      )}

      {/* Context + Footer — single compact block */}
      <div className="rounded-lg px-3 py-2.5 border border-[var(--border-color)]/50 bg-[var(--bg-surface-alt)]/30">
        <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">{result.context}</p>
        <div className="flex items-center gap-2 mt-2 pt-2 border-t border-[var(--border-color)]/50">
          <div className={`h-1.5 w-1.5 rounded-full ${getConfidenceColor()}`} />
          <span className="text-[11px] text-[var(--text-secondary)]">{getConfidenceText()} · {formatLastUpdated(result.lastUpdated)}</span>
        </div>
      </div>
    </div>
  );
}

// Position Display — Apple-style compact (single position source, ring + bar)
function PositionDisplay({
  position,
  result,
}: {
  position: number;
  result: NonNullable<ReturnType<typeof QueuePositionEngine.calculateQueuePosition>>;
}) {
  const safePosition = Math.max(1, position);
  const queueScale = 25000;
  const progressPct = Math.min(98, Math.max(2, (1 - safePosition / queueScale) * 100));
  const ringProgress = Math.min(95, progressPct);

  return (
    <div className="space-y-3">
      <div className="rounded-lg bg-[var(--bg-surface-alt)]/50 border border-[var(--border-color)]/50 p-4">
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <div className="relative flex-shrink-0">
            <svg viewBox="0 0 36 36" className="w-20 h-20 sm:w-24 sm:h-24 -rotate-90">
              <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="var(--border-color)" strokeWidth="2.5" opacity={0.25} />
              <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="url(#queueRingGrad)" strokeWidth="2.5" strokeLinecap="round" strokeDasharray={`${ringProgress}, 100`} strokeDashoffset="0" className="transition-all duration-700" />
              <defs>
                <linearGradient id="queueRingGrad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#007aff" stopOpacity={0.7} />
                  <stop offset="100%" stopColor="#005293" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center rounded-full bg-[var(--uscis-blue)]">
              <span className="text-[10px] font-medium text-white/90">#</span>
              <span className="text-base sm:text-lg font-bold text-white tabular-nums leading-none">{formatNumber(safePosition)}</span>
            </div>
          </div>
          <div className="flex-1 w-full min-w-0">
            <p className="text-[11px] text-[var(--text-secondary)] mb-1.5">{Math.round(progressPct)}% to front of queue</p>
            <div className="h-2.5 w-full rounded-full bg-[var(--border-color)]/25 overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${progressPct}%`, background: "linear-gradient(to right, rgba(0, 122, 255, 0.5), rgba(0, 82, 147, 0.95))" }} />
            </div>
            {(result.positionRange?.min && result.positionRange?.max) || result.daysRemaining ? (
              <p className="text-[11px] text-[var(--text-tertiary)] mt-1.5">
                {result.positionRange?.min && result.positionRange?.max ? `#${formatNumber(result.positionRange.min)}–${formatNumber(result.positionRange.max)}` : null}
                {result.positionRange?.min && result.daysRemaining ? " · " : null}
                {result.daysRemaining ? `${result.daysRemaining}d until PD current` : null}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

// Current Status Display (matches iOS currentStatusDisplay)
function CurrentStatusDisplay() {
  return (
    <div className="flex items-start gap-2.5">
      <CheckCircleIcon className="w-6 h-6 text-green-500 flex-shrink-0 mt-0.5" />
      <div>
        <h4 className="text-lg font-bold text-[var(--text-primary)]">Your Priority Date is Current</h4>
        <p className="mt-1 text-[13px] text-[var(--text-secondary)]">
          Your case is in the active processing queue
        </p>
      </div>
    </div>
  );
}
