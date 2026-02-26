"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useProfile } from "@/hooks/useProfile";
import { useAuth } from "@/contexts/AuthContext";
import { calculateWeeklySummary, WeeklySummaryData } from "@/lib/services/weeklySummaryService";
import { format, startOfWeek } from "date-fns";
import {
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "@heroicons/react/24/outline";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";
import SkeletonLoader from "./SkeletonLoader";
import { SECTION_IMAGES, EMPTY_STATE_IMAGES } from "@/lib/images";
import GradientIconBadge from "@/components/GradientIconBadge";
import { ChartBarIcon } from "@heroicons/react/24/solid";

export default function WeeklySummary() {
  const { profile } = useProfile();
  const { user } = useAuth();
  const [summary, setSummary] = useState<WeeklySummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedWeek, setSelectedWeek] = useState<Date>(new Date());

  useEffect(() => {
    async function loadSummary() {
      if (!profile || !user || !profile.priorityDate) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const weekStart = startOfWeek(selectedWeek, { weekStartsOn: 1 });
        const data = await calculateWeeklySummary(profile, weekStart);
        setSummary(data);
      } catch (err) {
        console.error("Error loading weekly summary:", err);
        setError("Failed to load weekly summary. Please try again.");
      } finally {
        setLoading(false);
      }
    }

    loadSummary();
  }, [profile, user, selectedWeek]);

  if (!user || !profile || !profile.priorityDate) {
    return (
      <div className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-color)] shadow-[var(--shadow-sm)] p-8 sm:p-12 text-center relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.05]">
          <Image src={EMPTY_STATE_IMAGES.profile} alt="" fill className="object-cover" sizes="400px" />
        </div>
        <div className="mx-auto mb-4">
          <GradientIconBadge icon={ChartBarIcon} color="emerald" size="lg" />
        </div>
        <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-1">Weekly Summary</h3>
        <p className="text-sm text-[var(--text-secondary)] max-w-xs mx-auto">
          Complete your profile to see your personalized weekly summary.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-color)] shadow-[var(--shadow-sm)] p-6 sm:p-8 relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.04]">
          <Image src={SECTION_IMAGES.calendar} alt="" fill className="object-cover" sizes="600px" />
        </div>
        <div className="relative flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold text-[var(--text-primary)] tracking-tight">
              Your Weekly Summary
            </h2>
            <p className="text-sm text-[var(--text-tertiary)] mt-0.5">Loading...</p>
          </div>
        </div>
        <div className="relative">
          <SkeletonLoader />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-color)] shadow-[var(--shadow-sm)] p-8 text-center">
        <ExclamationTriangleIcon className="w-12 h-12 text-[var(--text-tertiary)] mx-auto mb-4" />
        <p className="text-sm text-[var(--text-secondary)]">{error}</p>
      </div>
    );
  }

  if (!summary) return null;

  const weekStartFormatted = format(summary.weekStart, "MMM d");
  const weekEndFormatted = format(summary.weekEnd, "MMM d, yyyy");
  const canGoNext = selectedWeek < new Date();

  const percentileVal = summary.userPositionChange.percentile;
  const totalTracked = summary.userPositionChange.currentWeekRank + summary.userPositionChange.casesAhead;
  const queueProgress = totalTracked > 0 ? (100 * (totalTracked - summary.userPositionChange.currentWeekRank)) / totalTracked : 0;
  const hasCenterCountryData = (summary.serviceCenterStats.approvals > 0 || summary.countryStats.approvals > 0);

  return (
    <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] shadow-sm hover:shadow-md transition-shadow overflow-hidden relative">
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none">
        <Image src={SECTION_IMAGES.calendar} alt="" fill className="object-cover" sizes="600px" />
      </div>

      {/* Compact header */}
      <div className="relative px-4 sm:px-6 pt-4 sm:pt-5 pb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-[var(--text-primary)]">Your Weekly Summary</h2>
          <p className="text-xs text-[var(--text-tertiary)] mt-0.5">{weekStartFormatted} – {weekEndFormatted}</p>
          <p className="text-xs text-[var(--text-secondary)]">
            A quick weekly snapshot of movement around your case and similar cases.
          </p>
        </div>
        <div className="flex items-center gap-0.5 bg-[var(--bg-surface-alt)] rounded-lg p-0.5">
          <button onClick={() => setSelectedWeek((d) => { const p = new Date(d); p.setDate(p.getDate() - 7); return p; })} className="p-2 rounded-md hover:bg-white dark:hover:bg-[var(--bg-surface)] transition-colors" aria-label="Previous week">
            <ChevronLeftIcon className="w-4 h-4 text-[var(--text-secondary)]" />
          </button>
          <span className="text-[11px] font-medium text-[var(--text-secondary)] px-2">Week</span>
          <button onClick={() => canGoNext && setSelectedWeek((d) => { const n = new Date(d); n.setDate(n.getDate() + 7); return n <= new Date() ? n : d; })} disabled={!canGoNext} className={`p-2 rounded-md transition-colors ${canGoNext ? "hover:bg-white dark:hover:bg-[var(--bg-surface)]" : "opacity-40 cursor-not-allowed"}`} aria-label="Next week">
            <ChevronRightIcon className="w-4 h-4 text-[var(--text-secondary)]" />
          </button>
        </div>
      </div>

      {/* Row 1: Approvals donut + Approvals by day – side by side, balanced */}
      <div className="relative px-4 sm:px-6 pb-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl bg-[var(--bg-surface-alt)]/60 border border-[var(--border-color)]/60 p-4 flex items-center gap-4">
          <div className="relative w-28 h-28 flex-shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={summary.totalApprovals > 0
                    ? [
                        { name: "Similar", value: summary.similarCasesApproved, color: "#059669" },
                        { name: "Others", value: Math.max(0, summary.totalApprovals - summary.similarCasesApproved), color: "#94a3b8" },
                      ].filter((d) => d.value > 0)
                    : [{ name: "None", value: 1, color: "#e2e8f0" }]}
                  cx="50%" cy="50%" innerRadius={36} outerRadius={52}
                  paddingAngle={2} dataKey="value" stroke="var(--bg-surface)" strokeWidth={2}
                  isAnimationActive animationDuration={500}
                >
                  {(summary.totalApprovals > 0 ? [{ value: summary.similarCasesApproved, color: "#059669" }, { value: Math.max(0, summary.totalApprovals - summary.similarCasesApproved), color: "#94a3b8" }].filter((d) => d.value > 0) : [{ value: 1, color: "#e2e8f0" }]).map((e, i) => <Cell key={i} fill={e.color} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span className="text-2xl font-bold text-[var(--text-primary)] tabular-nums">{summary.totalApprovals}</span>
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">Total approvals</p>
            <p className="text-sm text-[var(--text-secondary)] mt-1">
              {summary.similarCasesApproved} similar to your case this week.
            </p>
            <p className="text-[10px] text-[var(--text-tertiary)] mt-0.5">
              A quick sense of how much real activity we’re seeing around cases like yours.
            </p>
          </div>
        </div>

        {(summary.approvalsByDay ?? []).length > 0 && (
          <div className="rounded-xl bg-[var(--bg-surface-alt)]/60 border border-[var(--border-color)]/60 p-4">
            <p className="text-[11px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider mb-2">Approvals by day</p>
            <div className="h-24">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={summary.approvalsByDay} margin={{ top: 2, right: 2, left: -8, bottom: 0 }}>
                  <XAxis dataKey="label" tick={{ fontSize: 9, fill: "var(--text-secondary)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 9, fill: "var(--text-secondary)" }} width={20} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-color)", borderRadius: "8px", fontSize: "11px" }} formatter={(v) => [`${Number(v ?? 0)} approval${Number(v ?? 0) === 1 ? "" : "s"}`, ""]} />
                  <Bar dataKey="count" fill="#059669" radius={[3, 3, 0, 0]} maxBarSize={24} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* Row 2: Metrics – 4 compact cards */}
      <div className="relative px-4 sm:px-6 pb-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] p-3">
          <p className="text-[10px] font-medium text-[var(--text-tertiary)] uppercase tracking-wider mb-2">Percentile</p>
          <p className="text-[11px] text-[var(--text-secondary)] mb-2">Where you rank among similar cases</p>
          <div className="flex items-center gap-2">
            <div className="relative w-10 h-10 flex-shrink-0 rounded-full bg-[#059669]">
              <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90 absolute inset-0">
                {/* Light base ring for Apple-like look */}
                <path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="#e5e7eb"
                  strokeWidth="2.5"
                />
                {percentileVal > 0 && (
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="#059669"
                    strokeWidth="2.5"
                    strokeDasharray={`${percentileVal} 100`}
                    strokeLinecap="round"
                  />
                )}
              </svg>
              <span
                className="absolute inset-0 flex items-center justify-center text-[10px] font-bold drop-shadow-md z-10"
                style={{ color: "#ffffff", textShadow: "0 0 2px rgba(0,0,0,0.5)" }}
              >
                {percentileVal.toFixed(0)}%
              </span>
            </div>
            {summary.userPositionChange.percentileChange !== 0 && (
              <span className={`text-[10px] flex items-center gap-0.5 ${summary.userPositionChange.percentileChange > 0 ? "text-[var(--uscis-green)]" : "text-red-500"}`}>
                {summary.userPositionChange.percentileChange > 0 ? <ArrowTrendingUpIcon className="w-3.5 h-3.5" /> : <ArrowTrendingDownIcon className="w-3.5 h-3.5" />}
                {summary.userPositionChange.percentileChange > 0 ? "+" : ""}{summary.userPositionChange.percentileChange.toFixed(1)}%
              </span>
            )}
          </div>
          <p className="text-[10px] text-[var(--text-tertiary)] mt-2 leading-snug">
            Higher % means you&apos;re ahead of more cases in your cohort.
          </p>
        </div>

        <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] p-3">
          <p className="text-[10px] font-medium text-[var(--text-tertiary)] uppercase tracking-wider mb-2">Queue rank</p>
          <p className="text-sm font-semibold text-[var(--text-primary)] tabular-nums">#{summary.userPositionChange.currentWeekRank}</p>
          <p className="text-[10px] text-[var(--text-tertiary)]">of {totalTracked}</p>
          <p className="text-[10px] text-[var(--text-tertiary)] mt-0.5">
            Where you sit among tracked cases with similar priority dates.
          </p>
          <div className="mt-2 h-1.5 rounded-full bg-[var(--bg-surface-alt)] overflow-hidden">
            <div className="h-full rounded-full bg-[var(--uscis-blue)] transition-all" style={{ width: `${Math.min(100, queueProgress)}%` }} />
          </div>
        </div>

        <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] p-3">
          <p className="text-[10px] font-medium text-[var(--text-tertiary)] uppercase tracking-wider mb-2">Avg processing</p>
          <p className="text-sm font-semibold text-[var(--text-primary)] tabular-nums">{summary.averageProcessingTime}</p>
          <p className="text-[10px] text-[var(--text-tertiary)]">days</p>
          <p className="text-[10px] text-[var(--text-tertiary)] mt-0.5">
            Typical time similar cases have taken recently from filing to approval.
          </p>
          <div className="mt-2 h-1.5 rounded-full bg-[var(--bg-surface-alt)] overflow-hidden">
            <div className="h-full rounded-full bg-[var(--uscis-blue)]/80" style={{ width: `${Math.min(100, (summary.averageProcessingTime / 500) * 100)}%` }} />
          </div>
        </div>

        <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] p-3">
          <p className="text-[10px] font-medium text-[var(--text-tertiary)] uppercase tracking-wider mb-2">Estimate</p>
          <p className="text-sm font-semibold text-[var(--text-primary)] tabular-nums">{format(summary.timelineUpdate.currentEstimate, "MMM d")}</p>
          <p className="text-[10px] text-[var(--text-tertiary)]">{summary.timelineUpdate.confidence}</p>
          <p className="text-[10px] text-[var(--text-tertiary)] mt-0.5">
            The current approval window we’re aiming for based on this week’s data.
          </p>
        </div>
      </div>

      {/* Row 3: Service Center & Country – compact cards when low data, bar chart when meaningful */}
      <div className="relative px-4 sm:px-6 pb-4">
        <p className="text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider mb-2">Service center & country</p>
        {hasCenterCountryData ? (
          <div className="h-24 rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] p-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={[
                  { name: summary.serviceCenterStats.name || "Center", approvals: summary.serviceCenterStats.approvals, avgDays: summary.serviceCenterStats.averageProcessingTime },
                  { name: summary.countryStats.country || "Country", approvals: summary.countryStats.approvals, avgDays: summary.countryStats.averageProcessingTime },
                ]}
                layout="vertical"
                margin={{ top: 0, right: 16, left: 60, bottom: 0 }}
              >
                <XAxis type="number" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={56} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-color)", borderRadius: "8px", fontSize: "11px" }} formatter={(v, _n, p) => [`${Number(v ?? 0)} approvals · avg ${(p?.payload as { avgDays?: number })?.avgDays ?? 0} days`, ""]} />
                <Bar dataKey="approvals" fill="#3B82F6" radius={[0, 3, 3, 0]} maxBarSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface-alt)]/50 p-3">
              <p className="text-[10px] text-[var(--text-tertiary)]">{summary.serviceCenterStats.name || "Center"}</p>
              <p className="text-sm font-semibold text-[var(--text-primary)]">{summary.serviceCenterStats.approvals} approvals</p>
              <p className="text-[10px] text-[var(--text-tertiary)]">avg {summary.serviceCenterStats.averageProcessingTime} days</p>
            </div>
            <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface-alt)]/50 p-3">
              <p className="text-[10px] text-[var(--text-tertiary)]">{summary.countryStats.country || "Country"}</p>
              <p className="text-sm font-semibold text-[var(--text-primary)]">{summary.countryStats.approvals} approvals</p>
              <p className="text-[10px] text-[var(--text-tertiary)]">avg {summary.countryStats.averageProcessingTime} days</p>
            </div>
          </div>
        )}
      </div>

      {/* Timeline change badge */}
      {summary.timelineUpdate.daysChanged !== 0 && (
        <div className="px-4 sm:px-6 pb-4">
          <div
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium ${
              summary.timelineUpdate.daysChanged < 0
                ? "bg-[var(--uscis-green)]/10 text-[var(--uscis-green)]"
                : "bg-[var(--uscis-blue)]/10 text-[var(--text-primary)]"
            }`}
          >
            {summary.timelineUpdate.daysChanged < 0 ? (
              <ArrowTrendingUpIcon className="w-4 h-4" />
            ) : (
              <ArrowTrendingDownIcon className="w-4 h-4" />
            )}
            {summary.timelineUpdate.daysChanged < 0 ? "Moved up" : "Extended"} by{" "}
            {Math.abs(summary.timelineUpdate.daysChanged)} days
          </div>
        </div>
      )}

      {/* Highlights */}
      {summary.highlights.length > 0 && (
        <div className="px-4 sm:px-6 pb-4">
          <h3 className="text-xs font-semibold text-[var(--text-primary)] mb-2">Key highlights</h3>
          <ul className="space-y-2">
            {summary.highlights.map((h, i) => (
              <li key={i} className="flex items-start gap-2">
                <CheckCircleIcon className="w-4 h-4 text-[var(--uscis-green)] flex-shrink-0 mt-0.5" />
                <span className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed">{h}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Recommendations */}
      {summary.recommendations.length > 0 && (
        <div className="px-4 sm:px-6 pb-4">
          <h3 className="text-xs font-semibold text-[var(--text-primary)] mb-2">Recommendations</h3>
          <div className="space-y-2">
            {summary.recommendations.map((rec, i) => (
              <div
                key={i}
                className="flex items-start gap-2 p-3 rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface-alt)]/50"
              >
                {rec.type === "action" ? (
                  <InformationCircleIcon className="w-4 h-4 text-[var(--text-primary)] flex-shrink-0 mt-0.5" />
                ) : rec.type === "warning" ? (
                  <ExclamationTriangleIcon className="w-4 h-4 text-[var(--uscis-accent-soft)] flex-shrink-0 mt-0.5" />
                ) : (
                  <InformationCircleIcon className="w-4 h-4 text-[var(--text-tertiary)] flex-shrink-0 mt-0.5" />
                )}
                <div>
                  <h4 className="text-sm font-semibold text-[var(--text-primary)]">{rec.title}</h4>
                  <p className="text-xs text-[var(--text-secondary)] mt-1 leading-relaxed">{rec.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="px-4 sm:px-6 py-3 border-t border-[var(--border-color)]">
        <p className="text-[11px] text-[var(--text-tertiary)]">
          Generated {format(summary.generatedAt, "MMM d, yyyy 'at' h:mm a")}
        </p>
      </div>
    </div>
  );
}
