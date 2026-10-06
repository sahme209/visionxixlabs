/**
 * /dashboard/billing/usage — client billing dashboard (organization-scoped).
 *
 * Phase 381. Shows the workspace operator:
 *   - Current plan + entitlements
 *   - Month-to-date AI credit consumption (from WorkspaceUsageSummary)
 *   - Remaining included usage with 70% / 90% / 100% threshold cues
 *   - Recent UsageEvent rows for transparency
 *   - Overage policy and upgrade hint when applicable
 *
 * Internal margin / cost-attribution numbers are NOT shown here —
 * those live on the admin-only /admin/profitability page.
 */

import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRightIcon,
  BoltIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ChartBarIcon,
  CpuChipIcon,
} from "@heroicons/react/24/outline";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import { readBillingPlan } from "@/lib/billing/tenantBillingStore";
import { planForStripeTier } from "@/lib/billing/planRegistry";
import { formatCents } from "@/lib/billing/computeInvocationCost";

export const metadata: Metadata = {
  title: "Usage & billing · Axiom",
};

export const dynamic = "force-dynamic";

const periodKey = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;

export default async function BillingUsagePage() {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId) {
    return <div className="p-8 text-sm text-zinc-300">Sign in required.</div>;
  }
  const orgId = String(ctx.organizationId);
  const period = periodKey(new Date());

  // Current plan via Stripe billing record → map to PlanRegistry.
  const billing = await readBillingPlan(orgId).catch(() => null);
  const plan = planForStripeTier(billing?.tier);

  // Pull MTD summary. Falls back to zeros when no events yet this month.
  const summary = await prisma.workspaceUsageSummary.findUnique({
    where: { organizationId_periodMonth: { organizationId: orgId, periodMonth: period } },
  }).catch(() => null);

  // Last 10 usage events for transparency.
  const recent = await prisma.usageEvent.findMany({
    where: { organizationId: orgId },
    orderBy: { createdAt: "desc" },
    take: 10,
  }).catch(() => [] as Array<never>);

  const includedCents = plan.entitlements.includedAICreditsCents;
  const aiCostCents = summary?.aiCostCents ?? 0;
  const usedRatio = includedCents > 0 ? Math.min(1, aiCostCents / includedCents) : 0;
  const usedPct = Math.round(usedRatio * 100);
  const remainingCents = Math.max(0, includedCents - aiCostCents);

  const thresholdTone =
    usedRatio >= 1    ? "text-rose-300"    :
    usedRatio >= 0.9  ? "text-rose-300"    :
    usedRatio >= 0.7  ? "text-zinc-300"   :
                        "text-emerald-300";

  return (
    <div className="relative max-w-5xl">
      <div className="mb-6">
        <Link href="/dashboard" className="text-[11px] text-zinc-300 hover:text-white inline-flex items-center gap-1">
          <ArrowRightIcon className="h-3 w-3 rotate-180" />
          Back to dashboard
        </Link>
      </div>

      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <ChartBarIcon className="h-4 w-4 text-zinc-500" />
          <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest">Usage & billing</p>
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-white tracking-[-0.04em] mb-2">
          {plan.displayName} plan · <span className="text-gradient">{period}</span>
        </h1>
        <p className="text-[13px] text-zinc-400 max-w-2xl leading-relaxed">
          {plan.tagline} You're on {plan.displayName}. AI credits, automation, monitoring, and report quotas all reset on the 1st of each month.
        </p>
      </div>

      {/* AI credit pool — the big number */}
      <section className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 mb-6">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
          <div className="flex items-center gap-2">
            <BoltIcon className="h-4 w-4 text-violet-300" />
            <p className="text-[11px] font-semibold text-white">AI credit pool</p>
          </div>
          <span className={`text-[10px] font-mono uppercase tracking-wider ${thresholdTone}`}>
            {usedPct}% used
          </span>
        </div>

        <div className="flex items-baseline gap-3 mb-3 flex-wrap">
          <p className={`text-4xl font-bold tabular-nums ${thresholdTone}`}>{formatCents(aiCostCents)}</p>
          <p className="text-[13px] text-zinc-500">of {formatCents(includedCents)} included</p>
        </div>

        <div className="w-full h-2 bg-white/[0.04] rounded-full overflow-hidden mb-3">
          <div
            className={`h-full rounded-full ${
              usedRatio >= 1    ? "bg-rose-500"    :
              usedRatio >= 0.9  ? "bg-rose-500"    :
              usedRatio >= 0.7  ? "bg-zinc-500"   :
                                  "bg-emerald-500"
            }`}
            style={{ width: `${Math.max(0, Math.min(100, usedPct))}%` }}
          />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[11px] mt-4 pt-4 border-t border-white/[0.06]">
          <Stat label="Remaining" value={formatCents(remainingCents)} />
          <Stat label="Invocations" value={(summary?.aiInvocationCount ?? 0).toLocaleString()} />
          <Stat label="Input tokens" value={Number(summary?.aiInputTokens ?? 0).toLocaleString()} />
          <Stat label="Output tokens" value={Number(summary?.aiOutputTokens ?? 0).toLocaleString()} />
        </div>

        {usedRatio >= 1 && plan.entitlements.overagePolicy === "hard_stop" && (
          <p className="mt-4 pt-4 border-t border-white/[0.06] text-[12px] text-rose-200 leading-relaxed">
            <ExclamationTriangleIcon className="h-4 w-4 inline mr-1.5 -mt-0.5" />
            Your AI credit pool is exhausted. New AI invocations are blocked until next month, or upgrade to a plan with metered overage billing.
          </p>
        )}
        {usedRatio >= 0.7 && usedRatio < 1 && (
          <p className="mt-4 pt-4 border-t border-white/[0.06] text-[12px] text-zinc-200 leading-relaxed">
            <ExclamationTriangleIcon className="h-4 w-4 inline mr-1.5 -mt-0.5" />
            Heads up — you've used {usedPct}% of your monthly AI credits. {plan.entitlements.overagePolicy === "hard_stop" ? "Starter plans hard-stop at 100% — upgrade to enable overage." : "Overage will bill automatically at retail markup."}
          </p>
        )}
      </section>

      {/* Other entitlement counters */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
        <UsageCard label="Agent runs"
          used={summary?.agentRunCount ?? 0}
          limit={plan.entitlements.monthlyAgentRuns} />
        <UsageCard label="Automation runs"
          used={summary?.automationRunCount ?? 0}
          limit={plan.entitlements.monthlyAutomationRuns} />
        <UsageCard label="Connector syncs"
          used={summary?.connectorSyncCount ?? 0}
          limit={plan.entitlements.monthlyConnectorSyncs} />
        <UsageCard label="Cloud scans"
          used={summary?.cloudScanCount ?? 0}
          limit={plan.entitlements.monthlyCloudScans} />
        <UsageCard label="Reports"
          used={summary?.reportCount ?? 0}
          limit={plan.entitlements.monthlyReports} />
        <UsageCard label="Overage policy"
          used={0}
          limit={null}
          textOverride={plan.entitlements.overagePolicy.replace(/_/g, " ")} />
      </section>

      {/* Recent activity */}
      <section className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 mb-6">
        <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest mb-3">// recent activity</p>
        {recent.length === 0 ? (
          <div className="text-center py-6">
            <CpuChipIcon className="h-5 w-5 text-zinc-500 mx-auto mb-2" />
            <p className="text-[12px] text-zinc-400">No usage events recorded yet this month.</p>
          </div>
        ) : (
          <ul className="space-y-1.5">
            {recent.map((e) => (
              <li key={e.id} className="rounded-lg border border-white/[0.04] bg-white/[0.015] px-3 py-2 flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2 min-w-0">
                  <CpuChipIcon className="h-3 w-3 text-violet-300 shrink-0" />
                  <span className="text-[11px] font-mono text-zinc-200 truncate">{e.eventKind.replace(/_/g, " ")}</span>
                  {e.model && <span className="text-[10px] font-mono text-zinc-500 truncate">· {e.model}</span>}
                </div>
                <div className="flex items-center gap-3 text-[10px] font-mono text-zinc-500">
                  {(e.inputTokens > 0 || e.outputTokens > 0) && (
                    <span>{e.inputTokens.toLocaleString()} in · {e.outputTokens.toLocaleString()} out</span>
                  )}
                  <span className="text-zinc-300">{formatCents(e.costCents)}</span>
                  <span>{e.createdAt.toISOString().slice(0, 16).replace("T", " ")}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Add-ons CTA — surfaces when approaching the credit pool ceiling */}
      {plan.tier !== "enterprise" && usedRatio >= 0.5 && (
        <section className="rounded-2xl border border-white/[0.08] bg-white/[0.015] p-5 mb-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <p className="text-[12px] font-semibold text-white mb-1">Don't want to upgrade? Buy a top-up.</p>
              <p className="text-[11.5px] text-zinc-400 leading-snug">
                Add-on packs deliver more AI credits or extra seats this month — usually a better fit than jumping to the next tier when you only need a temporary boost.
              </p>
            </div>
            <Link
              href="/dashboard/billing/add-ons"
              className="inline-flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 rounded-lg bg-violet-500/20 text-violet-100 border border-violet-500/40 hover:bg-violet-500/30 transition"
            >
              Browse add-ons
              <ArrowRightIcon className="h-3 w-3" />
            </Link>
          </div>
        </section>
      )}

      {/* Plan upgrade hint */}
      {plan.tier !== "enterprise" && (
        <section className="rounded-2xl border border-white/[0.08] bg-white/[0.015] p-5">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <p className="text-[12px] font-semibold text-white mb-1">Need more credits or more seats?</p>
              <p className="text-[11.5px] text-zinc-400 leading-snug">
                Compare every plan side-by-side on the public pricing page. Enterprise customers get custom AI usage pools, SSO, and a dedicated success engineer.
              </p>
            </div>
            <Link
              href="/pricing"
              className="inline-flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 rounded-lg bg-violet-500/20 text-violet-100 border border-violet-500/40 hover:bg-violet-500/30 transition"
            >
              See all plans
              <ArrowRightIcon className="h-3 w-3" />
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</p>
      <p className="text-[13px] font-mono text-zinc-100 mt-0.5">{value}</p>
    </div>
  );
}

function UsageCard({ label, used, limit, textOverride }: { label: string; used: number; limit: number | null; textOverride?: string }) {
  const display = textOverride
    ?? (limit === null ? "Custom" : `${used.toLocaleString()} / ${limit.toLocaleString()}`);
  const ratio = limit !== null && limit > 0 ? Math.min(1, used / limit) : 0;
  const tone =
    !limit                     ? "text-zinc-300"    :
    ratio >= 0.9               ? "text-rose-300"    :
    ratio >= 0.7               ? "text-zinc-300"   :
                                 "text-emerald-300";
  return (
    <article className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
      <p className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 mb-2">{label}</p>
      <p className={`text-[15px] font-semibold tabular-nums ${tone}`}>{display}</p>
      {limit !== null && limit > 0 && !textOverride && (
        <div className="w-full h-1 bg-white/[0.04] rounded-full overflow-hidden mt-2">
          <div
            className={`h-full rounded-full ${
              ratio >= 0.9 ? "bg-rose-500" : ratio >= 0.7 ? "bg-zinc-500" : "bg-emerald-500"
            }`}
            style={{ width: `${Math.max(0, Math.min(100, Math.round(ratio * 100)))}%` }}
          />
        </div>
      )}
    </article>
  );
}
