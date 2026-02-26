"use client";

import { useMemo } from "react";

interface OnTrackCardProps {
  userPriorityDate: Date;
  currentLatestPD: Date | null;
  formType: string;
}

function formatPD(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function monthsBetween(earlier: Date, later: Date): number {
  const m = (later.getFullYear() - earlier.getFullYear()) * 12 + (later.getMonth() - earlier.getMonth());
  return m;
}

export default function OnTrackCard({ userPriorityDate, currentLatestPD, formType }: OnTrackCardProps) {
  const result = useMemo(() => {
    if (!currentLatestPD) return null;
    const user = new Date(userPriorityDate);
    const latest = new Date(currentLatestPD);
    user.setHours(0, 0, 0, 0);
    latest.setHours(0, 0, 0, 0);
    const userTime = user.getTime();
    const latestTime = latest.getTime();
    const monthsAhead = monthsBetween(latest, user); // positive if user PD is after latest
    const monthsBehind = monthsBetween(user, latest); // positive if user PD is before latest
    if (userTime <= latestTime) {
      return {
        status: "ahead" as const,
        message: "Your priority date is ahead of recent approvals—you may hear soon.",
        sub: `Recent approvals are at ${formatPD(latest)}. Your PD: ${formatPD(user)}.`,
        dotClass: "bg-green-500",
      };
    }
    if (monthsAhead <= 3) {
      return {
        status: "close" as const,
        message: "You're getting close. Recent approvals are a few months ahead of your PD.",
        sub: `Current approvals at ${formatPD(latest)}. Your PD: ${formatPD(user)} (~${monthsAhead} mo behind).`,
        dotClass: "bg-indigo-600",
      };
    }
    return {
      status: "waiting" as const,
      message: "You're in the queue. System is processing cases before your PD.",
      sub: `Recent approvals at ${formatPD(latest)}. Your PD: ${formatPD(user)} (~${monthsAhead} mo).`,
      dotClass: "bg-blue-500",
    };
  }, [userPriorityDate, currentLatestPD]);

  if (!result) return null;

  const formLabel = formType?.toUpperCase() === "I-129F" ? "I-129F" : "I-130";

  return (
    <div className="rounded-xl card-see-through p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1.5 ${result.dotClass}`} />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider mb-1">
            Am I on track? · {formLabel}
          </p>
          <p className="text-sm font-semibold text-[var(--text-primary)] mb-1">
            {result.message}
          </p>
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
            {result.sub}
          </p>
        </div>
      </div>
    </div>
  );
}
