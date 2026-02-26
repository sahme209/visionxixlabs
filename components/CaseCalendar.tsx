"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
  isToday,
  isWithinInterval,
  parseISO,
  differenceInDays,
} from "date-fns";
import { useProfile } from "@/hooks/useProfile";
import { getTimelineEstimate, getCalendarApprovalsByDate } from "@/lib/statsService";
import { CaseTimeline, TimelineStage } from "@/lib/types";

/** Compute days between viewDate month and today for fetch range */
function daysBetweenViewAndToday(viewDate: Date): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const view = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
  view.setHours(0, 0, 0, 0);
  return Math.ceil(Math.abs(today.getTime() - view.getTime()) / (24 * 60 * 60 * 1000)) + 60;
}

interface CaseCalendarProps {
  timeline?: CaseTimeline | null;
  className?: string;
}

export default function CaseCalendar({ timeline, className = "" }: CaseCalendarProps) {
  const { profile } = useProfile();
  const [viewDate, setViewDate] = useState(() => new Date());
  const [estimate, setEstimate] = useState<{
    earliest: Date;
    latest: Date;
    median: Date;
  } | null>(null);
  const [loading, setLoading] = useState(!!profile?.priorityDate);

  const priorityDate = profile?.priorityDate ? new Date(profile.priorityDate) : null;
  const today = useMemo(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return t;
  }, []);

  const [approvalsByDate, setApprovalsByDate] = useState<Record<string, { i130: number; i129f: number }>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const daysBack = Math.min(365, Math.max(90, daysBetweenViewAndToday(viewDate)));
        const data = await getCalendarApprovalsByDate(daysBack);
        if (!cancelled) setApprovalsByDate(data);
      } catch {
        if (!cancelled) setApprovalsByDate({});
      }
    })();
    return () => { cancelled = true; };
  }, [viewDate]);

  useEffect(() => {
    if (!profile?.priorityDate || !profile?.formType) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const pd = new Date(profile.priorityDate);
        const est = await getTimelineEstimate(
          profile.formType,
          pd,
          profile.serviceCenter
        );
        if (!cancelled) {
          setEstimate({
            earliest: est.earliest,
            latest: est.latest,
            median: est.median,
          });
        }
      } catch {
        if (!cancelled) setEstimate(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [profile?.priorityDate, profile?.formType, profile?.serviceCenter]);

  const milestones = useMemo(() => {
    const out: { date: Date; label: string }[] = [];
    if (!timeline?.stages) return out;
    for (const stage of timeline.stages as TimelineStage[]) {
      const raw = stage.earliestDate;
      if (!raw || stage.isCompleted) continue;
      const date = raw instanceof Date ? raw : typeof raw === "string" ? parseISO(raw) : new Date(raw);
      if (!isNaN(date.getTime())) {
        const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        if (d >= today) out.push({ date: d, label: stage.name });
      }
    }
    out.sort((a, b) => a.date.getTime() - b.date.getTime());
    return out.slice(0, 3);
  }, [timeline?.stages, today]);

  const monthStart = startOfMonth(viewDate);
  const monthEnd = endOfMonth(viewDate);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

  const days: Date[] = [];
  for (let d = new Date(calStart); d <= calEnd; d.setDate(d.getDate() + 1)) {
    days.push(new Date(d));
  }

  const toDateKey = useCallback((d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
  []);

  function getDayKind(date: Date): "today" | "priority" | "estimate" | "milestone" | "approval" | "none" {
    const dayOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    if (isToday(dayOnly)) return "today";
    if (priorityDate && isSameDay(dayOnly, new Date(priorityDate.getFullYear(), priorityDate.getMonth(), priorityDate.getDate())))
      return "priority";
    if (estimate) {
      const e = new Date(estimate.earliest.getFullYear(), estimate.earliest.getMonth(), estimate.earliest.getDate());
      const l = new Date(estimate.latest.getFullYear(), estimate.latest.getMonth(), estimate.latest.getDate());
      const m = new Date(estimate.median.getFullYear(), estimate.median.getMonth(), estimate.median.getDate());
      if (isSameDay(dayOnly, m) || isSameDay(dayOnly, e) || isSameDay(dayOnly, l)) return "estimate";
      if (isWithinInterval(dayOnly, { start: e, end: l })) return "estimate";
    }
    const m = milestones.find((x) => isSameDay(dayOnly, new Date(x.date.getFullYear(), x.date.getMonth(), x.date.getDate())));
    if (m) return "milestone";
    const key = toDateKey(dayOnly);
    const approvals = approvalsByDate[key];
    if (approvals && (approvals.i130 > 0 || approvals.i129f > 0)) return "approval";
    return "none";
  }

  function getDayTooltip(date: Date, kind: ReturnType<typeof getDayKind>): string {
    const dayOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    if (kind === "today") return `Today — ${format(dayOnly, "EEEE, MMMM d")}`;
    if (kind === "priority" && priorityDate)
      return `Priority date — ${format(priorityDate, "MMM d, yyyy")}`;
    if (kind === "estimate" && estimate)
      return `Estimated approval — ${format(estimate.earliest, "MMM d")} – ${format(estimate.latest, "MMM d, yyyy")}`;
    const m = milestones.find((x) => isSameDay(dayOnly, new Date(x.date.getFullYear(), x.date.getMonth(), x.date.getDate())));
    if (kind === "milestone" && m) return `${m.label} — ${format(m.date, "MMM d, yyyy")}`;
    if (kind === "approval") {
      const key = toDateKey(dayOnly);
      const approvals = approvalsByDate[key];
      if (approvals) {
        const parts: string[] = [];
        if (approvals.i130 > 0) parts.push(`${approvals.i130} I-130 approval${approvals.i130 !== 1 ? "s" : ""}`);
        if (approvals.i129f > 0) parts.push(`${approvals.i129f} I-129F approval${approvals.i129f !== 1 ? "s" : ""}`);
        if (parts.length) return `${format(dayOnly, "MMM d, yyyy")}: ${parts.join(", ")}`;
      }
    }
    return "";
  }

  const weekDays = ["S", "M", "T", "W", "T", "F", "S"];

  return (
    <div
      className={`rounded-3xl bg-[var(--bg-surface)] border border-[var(--border-color)]/40 shadow-sm overflow-hidden ${className}`}
    >
      {/* Header */}
      <div className="px-6 py-5 border-b border-[var(--border-color)]/30">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-[var(--text-primary)] tracking-tight">Key Dates</h3>
            <p className="text-sm text-[var(--text-secondary)] mt-0.5">
              {profile?.priorityDate ? "Your timeline at a glance" : "Add your priority date to see your timeline"}
            </p>
          </div>
          <div className="flex items-center gap-1 p-1 rounded-xl bg-[var(--bg-surface-alt)]/60">
            <button
              type="button"
              onClick={() => setViewDate((d) => subMonths(d, 1))}
              className="p-2 rounded-lg text-[var(--text-secondary)] hover:bg-white/60 hover:text-[var(--text-primary)] transition-colors"
              aria-label="Previous month"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span className="px-4 py-2 text-sm font-medium text-[var(--text-primary)] min-w-[140px] text-center">
              {format(viewDate, "MMMM yyyy")}
            </span>
            <button
              type="button"
              onClick={() => setViewDate((d) => addMonths(d, 1))}
              className="p-2 rounded-lg text-[var(--text-secondary)] hover:bg-white/60 hover:text-[var(--text-primary)] transition-colors"
              aria-label="Next month"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div className="p-6">
        <div className="grid lg:grid-cols-2 gap-8 items-start">
          {/* Left: Your dates — clean cards */}
          <div className="space-y-4">
            <h4 className="text-[13px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">
              Your dates
            </h4>

            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-16 rounded-2xl bg-[var(--bg-surface-alt)]/50 animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {/* Today */}
                <div className="flex items-center gap-4 p-4 rounded-2xl bg-[var(--bg-surface-alt)]/40 border border-[var(--border-color)]/30">
                  <div className="w-10 h-10 rounded-xl bg-[#007aff]/10 flex items-center justify-center shrink-0">
                    <span className="text-[#007aff] text-lg font-bold">{format(today, "d")}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-[var(--text-primary)]">Today</p>
                    <p className="text-sm text-[var(--text-secondary)]">{format(today, "EEEE, MMMM d")}</p>
                  </div>
                </div>

                {/* Priority date */}
                {priorityDate && (
                  <div className="flex items-center gap-4 p-4 rounded-2xl bg-[var(--bg-surface-alt)]/40 border border-[var(--border-color)]/30">
                    <div className="w-10 h-10 rounded-xl bg-[#007aff]/10 flex items-center justify-center shrink-0">
                      <span className="text-[#007aff] text-sm font-bold">{format(priorityDate, "d")}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-[var(--text-primary)]">Priority date</p>
                      <p className="text-sm text-[var(--text-secondary)]">{format(priorityDate, "MMM d, yyyy")}</p>
                    </div>
                  </div>
                )}

                {/* Estimate */}
                {estimate && (
                  <div className="flex items-center gap-4 p-4 rounded-2xl bg-[#34c759]/5 border border-[#34c759]/20">
                    <div className="w-10 h-10 rounded-xl bg-[#34c759]/10 flex items-center justify-center shrink-0">
                      <span className="text-[#34c759] text-sm font-bold">{format(estimate.median, "d")}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-[var(--text-primary)]">Estimated approval</p>
                      <p className="text-sm text-[var(--text-secondary)]">
                        {format(estimate.earliest, "MMM d")} – {format(estimate.latest, "MMM d, yyyy")}
                      </p>
                      <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
                        ~{Math.max(0, differenceInDays(estimate.median, today))} days from today
                      </p>
                    </div>
                  </div>
                )}

                {/* Milestones */}
                {milestones.map((m) => (
                  <div key={m.label} className="flex items-center gap-4 p-4 rounded-2xl bg-[var(--bg-surface-alt)]/40 border border-[var(--border-color)]/30">
                    <div className="w-10 h-10 rounded-xl bg-[#af52de]/10 flex items-center justify-center shrink-0">
                      <span className="text-[#af52de] text-sm font-bold">{format(m.date, "d")}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-[var(--text-primary)] line-clamp-1">{m.label}</p>
                      <p className="text-sm text-[var(--text-secondary)]">{format(m.date, "MMM d, yyyy")}</p>
                    </div>
                  </div>
                ))}

                {!profile?.priorityDate && (
                  <p className="text-sm text-[var(--text-tertiary)] py-4 text-center">
                    Complete your profile to see your priority date and estimates.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Right: Minimal calendar — taller to fill empty space */}
          <div className="min-h-[420px] flex flex-col">
            <h4 className="text-[13px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider mb-4">
              Calendar
            </h4>
            <div className="rounded-2xl border border-[var(--border-color)]/30 bg-[var(--bg-surface-alt)]/20 p-5 min-h-[380px] flex flex-col flex-1">
              <div className="grid grid-cols-7 gap-2 flex-1 min-h-[320px]">
                {weekDays.map((wd) => (
                  <div key={wd} className="text-center text-[11px] font-medium text-[var(--text-tertiary)] py-1">
                    {wd}
                  </div>
                ))}
                {days.map((date) => {
                  const kind = getDayKind(date);
                  const inMonth = isSameMonth(date, viewDate);
                  const tooltip = getDayTooltip(date, kind);
                  return (
                    <div
                      key={date.toISOString()}
                      title={tooltip}
                      className={`
                        aspect-square max-w-[52px] w-full mx-auto rounded-xl flex items-center justify-center text-sm font-medium transition-colors cursor-default
                        ${!inMonth ? "opacity-30" : ""}
                        ${kind === "today" ? "bg-[#007aff] text-white" : ""}
                        ${kind === "priority" ? "bg-[#007aff]/15 text-[#007aff] font-semibold" : ""}
                        ${kind === "estimate" ? "bg-[#34c759]/15 text-[#34c759] font-semibold" : ""}
                        ${kind === "milestone" ? "bg-[#af52de]/15 text-[#af52de] font-semibold" : ""}
                        ${kind === "approval" ? "bg-orange-500/15 text-orange-700 dark:text-orange-400 font-semibold" : ""}
                        ${kind === "none" && inMonth ? "text-[var(--text-primary)] hover:bg-[var(--bg-surface-alt)]/60" : ""}
                        ${kind !== "none" ? "hover:ring-2 hover:ring-offset-1 hover:ring-[var(--text-tertiary)]/30" : ""}
                      `}
                    >
                      {format(date, "d")}
                    </div>
                  );
                })}
              </div>
              <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t border-[var(--border-color)]/30">
                <span className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#007aff]" /> Today
                </span>
                {priorityDate && (
                  <span className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#007aff]/50" /> Priority
                  </span>
                )}
                {estimate && (
                  <span className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#34c759]/70" /> Estimate
                  </span>
                )}
                {milestones.length > 0 && (
                  <span className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#af52de]/70" /> Milestone
                  </span>
                )}
                <span className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                  <span className="w-2.5 h-2.5 rounded-full bg-orange-500/70" /> Approvals (I-130 / I-129F)
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
