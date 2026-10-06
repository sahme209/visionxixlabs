"use client";

/**
 * Tiny pending-approvals badge for the dashboard topbar. Polls
 * /api/dashboard/summary once on mount and renders 'N pending'
 * (or '!N pending' when any are high-risk) as a quiet link to
 * the approval queue. Hidden when the count is zero so the
 * topbar stays calm.
 */

import { useEffect, useState } from "react";
import Link from "next/link";

export function PendingApprovalsBadge() {
  const [pending, setPending] = useState(0);
  const [highRisk, setHighRisk] = useState(0);

  useEffect(() => {
    fetch("/api/dashboard/summary")
      .then((r) => r.json())
      .then((data: { ok?: boolean; pendingApprovals?: number; highRiskApprovals?: number }) => {
        if (data?.ok) {
          setPending(data.pendingApprovals ?? 0);
          setHighRisk(data.highRiskApprovals ?? 0);
        }
      })
      .catch(() => {});
  }, []);

  if (pending === 0) return null;
  const urgent = highRisk > 0;
  return (
    <Link
      href="/dashboard/approvals"
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-mono transition-colors ${
        urgent
          ? "border-white/30 text-zinc-200 hover:border-white/50"
          : "border-white/[0.10] text-zinc-300 hover:border-white/[0.18]"
      }`}
      title={urgent ? `${highRisk} high-risk` : undefined}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${urgent ? "bg-zinc-400" : "bg-zinc-400"}`} />
      {pending} pending
    </Link>
  );
}
