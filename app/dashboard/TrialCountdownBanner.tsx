"use client";

/**
 * Trial countdown banner.
 *
 * Renders a slim ribbon at the top of every dashboard page when the
 * tenant's plan is in 'trialing' state. Auto-hides on the billing
 * page itself (operators don't need the nag on the page they're
 * already on). Click-through scrolls to the upgrade options.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClockIcon, ArrowRightIcon } from "@heroicons/react/24/outline";

interface PlanRecord {
  tier: string;
  status: string;
  trialDaysRemaining: number;
  spec: { label: string };
}

export function TrialCountdownBanner() {
  const pathname = usePathname() ?? "";
  const [plan, setPlan] = useState<PlanRecord | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/billing/plan", { credentials: "include" })
      .then((r) => r.json())
      .then((j: { ok?: boolean; data?: { plan: PlanRecord } }) => {
        if (cancelled) return;
        if (j.ok && j.data?.plan) setPlan(j.data.plan);
      })
      .catch(() => { /* silent — banner is non-essential */ });
    return () => { cancelled = true; };
  }, []);

  // Hide while loading, on the billing page itself, and when not in trial.
  if (!plan) return null;
  if (pathname.startsWith("/dashboard/billing")) return null;
  if (plan.status !== "trialing") return null;

  const days = plan.trialDaysRemaining;
  const urgent = days <= 3;
  const cls = urgent
    ? "border-rose-500/30 bg-rose-500/[0.06] text-rose-100"
    : "border-white/30 bg-white/[0.05] text-zinc-100";

  return (
    <div className={`rounded-xl border ${cls} px-3 py-2 mb-4 text-[12px] flex items-center gap-2 flex-wrap`}>
      <ClockIcon className="h-3.5 w-3.5 shrink-0" />
      <span className="font-mono text-[10px] uppercase tracking-wider opacity-70">trial</span>
      <span>
        {days > 0
          ? `${days} day${days === 1 ? "" : "s"} left on ${plan.spec.label}`
          : `${plan.spec.label} expired — upgrade to keep autonomy running`}
      </span>
      <Link
        href="/dashboard/billing"
        className="ml-auto inline-flex items-center gap-1 font-medium underline-offset-2 hover:underline"
      >
        See plans <ArrowRightIcon className="h-3 w-3" />
      </Link>
    </div>
  );
}
