/**
 * /admin/profitability — internal profitability dashboard.
 *
 * Phase 381. Admin-only (gated by ADMIN_EMAILS env). Shows per-
 * workspace gross margin under the current month's usage, with the
 * warning surface from computePlanMargin() so the operator sees which
 * tenants are bleeding money before they bleed too much.
 *
 * Never visible to client users. Never linked from client surfaces.
 */

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  ArrowRightIcon,
  ChartBarIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  CpuChipIcon,
} from "@heroicons/react/24/outline";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin/auth";
import { prisma } from "@/lib/db";
import { planForStripeTier } from "@/lib/billing/planRegistry";
import {
  computePlanMargin,
  estimateStripeFee,
  type MarginWarningKind,
} from "@/lib/billing/computePlanMargin";
import { computeOverageRevenue } from "@/lib/billing/computeOverageRevenue";
import { formatCents } from "@/lib/billing/computeInvocationCost";

export const metadata: Metadata = {
  title: "Profitability · Admin",
};

export const dynamic = "force-dynamic";

const WARNING_LABEL: Record<MarginWarningKind, string> = {
  ai_cost_above_plan_price: "AI cost > plan price",
  ai_cost_above_50pct_of_plan_price: "AI cost > 50% of plan price",
  negative_gross_margin: "Negative gross margin",
  ai_credit_pool_exhausted: "AI credit pool exhausted",
  no_overage_revenue_on_overage_plan: "No overage revenue logged",
  enterprise_should_have_custom_contract: "Enterprise needs custom contract",
};

const WARNING_TONE: Record<MarginWarningKind, string> = {
  ai_cost_above_plan_price: "text-rose-300 bg-rose-500/10 border-rose-500/30",
  ai_cost_above_50pct_of_plan_price: "text-zinc-300 bg-white/10 border-white/30",
  negative_gross_margin: "text-rose-300 bg-rose-500/15 border-rose-500/40",
  ai_credit_pool_exhausted: "text-zinc-300 bg-white/[0.04] border-white/[0.08]",
  no_overage_revenue_on_overage_plan: "text-zinc-300 bg-white/10 border-white/30",
  enterprise_should_have_custom_contract: "text-zinc-400 bg-white/[0.04] border-white/[0.08]",
};

const periodKey = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;

// Operator estimates for fixed-cost allocation. These will move to a config
// table once the operator wants per-workspace tuning; for now they are
// reasonable platform-wide allocations.
const ALLOCATED_INFRA_CENTS = 2_000;    // $20 infra (DB, hosting, storage allocation)
const ALLOCATED_SUPPORT_CENTS_BY_TIER: Record<string, number> = {
  starter:    500,    // $5 — community support, low touch
  growth:     2_500,  // $25 — standard support
  business:   10_000, // $100 — priority support
  enterprise: 25_000, // $250 — dedicated success engineer
};

export default async function AdminProfitabilityPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email || !isAdminEmail(session.user.email)) {
    redirect("/login");
  }

  const period = periodKey(new Date());

  const summaries = await prisma.workspaceUsageSummary.findMany({
    where: { periodMonth: period },
    orderBy: { aiCostCents: "desc" },
    take: 100,
  }).catch(() => [] as Array<never>);

  const orgIds = summaries.map((s) => s.organizationId);
  const billings = orgIds.length > 0
    ? await prisma.tenantBillingPlan.findMany({
        where: { organizationId: { in: orgIds } },
      }).catch(() => [] as Array<never>)
    : [];
  const billingByOrg = new Map(billings.map((b) => [b.organizationId, b] as const));

  // Compute margin per workspace.
  const rows = summaries.map((s) => {
    const billing = billingByOrg.get(s.organizationId);
    const plan = planForStripeTier(billing?.tier);
    const supportCostCents = ALLOCATED_SUPPORT_CENTS_BY_TIER[plan.tier] ?? 0;
    const planPriceForFee = plan.monthlyPriceCents ?? 0;
    const paymentProcessingCents = planPriceForFee > 0 ? estimateStripeFee(planPriceForFee) : 0;
    // Phase 383 — derive overage revenue from AI cost vs plan pool.
    const overage = computeOverageRevenue({ plan, totalAICostCents: s.aiCostCents });
    const margin = computePlanMargin({
      plan,
      aiCostCents: s.aiCostCents,
      infraCostCents: ALLOCATED_INFRA_CENTS,
      paymentProcessingCents,
      supportCostCents,
      overageRevenueCents: overage.overageRevenueCents,
    });
    return { summary: s, plan, margin, overage };
  });

  // Aggregate totals.
  const totalRevenue = rows.reduce((acc, r) => acc + (r.margin.monthlyRevenueCents ?? 0), 0);
  const totalAICost = rows.reduce((acc, r) => acc + r.summary.aiCostCents, 0);
  const totalGrossMargin = rows.reduce((acc, r) => acc + (r.margin.grossMarginCents ?? 0), 0);
  const totalOverageRevenue = rows.reduce((acc, r) => acc + r.overage.overageRevenueCents, 0);
  const atRiskCount = rows.filter((r) =>
    r.margin.warnings.includes("negative_gross_margin") || r.margin.warnings.includes("ai_cost_above_plan_price")
  ).length;

  return (
    <div className="relative max-w-6xl">
      <div className="mb-6">
        <Link href="/admin" className="text-[11px] text-violet-300 hover:text-violet-200 inline-flex items-center gap-1">
          <ArrowRightIcon className="h-3 w-3 rotate-180" />
          Back to admin
        </Link>
      </div>

      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <ChartBarIcon className="h-4 w-4 text-zinc-400" />
          <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest">Profitability · admin only</p>
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-white tracking-[-0.04em] mb-2">
          {period} margin · <span className="text-gradient">{rows.length} workspaces</span>
        </h1>
        <p className="text-[13px] text-zinc-400 max-w-3xl leading-relaxed">
          Per-workspace gross margin under current AI usage + allocated infra + support + Stripe fees. Warning chips fire when a tenant is approaching or already at unprofitable usage. Internal data — never linked from client surfaces.
        </p>
      </div>

      <section className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-8">
        <SummaryStat label="Total revenue (MTD)" value={formatCents(totalRevenue)} tone="text-emerald-300" />
        <SummaryStat label="Overage revenue (MTD)" value={formatCents(totalOverageRevenue)} tone="text-violet-300" />
        <SummaryStat label="Total AI cost (MTD)" value={formatCents(totalAICost)} tone="text-zinc-300" />
        <SummaryStat label="Total gross margin" value={formatCents(totalGrossMargin)} tone={totalGrossMargin >= 0 ? "text-emerald-300" : "text-rose-300"} />
        <SummaryStat label="Workspaces at risk" value={String(atRiskCount)} tone={atRiskCount > 0 ? "text-rose-300" : "text-zinc-300"} icon={ExclamationTriangleIcon} />
      </section>

      <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest mb-3">// per-workspace margin</p>
      {rows.length === 0 ? (
        <section className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8 text-center">
          <CpuChipIcon className="h-6 w-6 text-zinc-500 mx-auto mb-3" />
          <p className="text-[13px] font-semibold text-white">No usage summaries for {period}.</p>
          <p className="text-[11.5px] text-zinc-500 mt-1 max-w-md mx-auto leading-snug">
            The summary table is rebuilt nightly from UsageEvent rows. Trigger a manual rebuild from the admin tools when needed.
          </p>
        </section>
      ) : (
        <section className="space-y-2">
          {rows.map(({ summary, plan, margin, overage }) => (
            <article key={summary.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
              <header className="flex items-center justify-between gap-3 flex-wrap mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[11px] font-mono text-zinc-200 truncate">{summary.organizationId}</span>
                  <span className="text-[9px] font-mono uppercase tracking-wider border rounded-full px-1.5 py-0.5 text-violet-300 bg-violet-500/10 border-violet-500/30">
                    {plan.displayName}
                  </span>
                  {overage.overageRevenueCents > 0 && (
                    <span className="text-[9px] font-mono uppercase tracking-wider border rounded-full px-1.5 py-0.5 text-violet-200 bg-violet-500/15 border-violet-500/40">
                      overage · {formatCents(overage.overageRevenueCents)}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-[10px] font-mono">
                  {margin.warnings.length === 0 ? (
                    <span className="inline-flex items-center gap-1 text-emerald-300">
                      <CheckCircleIcon className="h-3 w-3" />
                      healthy
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-rose-300">
                      <ExclamationTriangleIcon className="h-3 w-3" />
                      {margin.warnings.length} warning{margin.warnings.length === 1 ? "" : "s"}
                    </span>
                  )}
                </div>
              </header>

              <div className="grid grid-cols-2 md:grid-cols-6 gap-3 text-[10.5px] mb-2">
                <Field label="Revenue" value={margin.monthlyRevenueCents === null ? "Custom" : formatCents(margin.monthlyRevenueCents)} />
                <Field label="Overage rev" value={formatCents(overage.overageRevenueCents)} tone={overage.overageRevenueCents > 0 ? "text-violet-300" : "text-zinc-300"} />
                <Field label="AI cost" value={formatCents(summary.aiCostCents)} />
                <Field label="Infra+support" value={formatCents(ALLOCATED_INFRA_CENTS + (ALLOCATED_SUPPORT_CENTS_BY_TIER[plan.tier] ?? 0))} />
                <Field
                  label="Gross margin"
                  value={margin.grossMarginCents === null ? "—" : formatCents(margin.grossMarginCents)}
                  tone={margin.grossMarginCents === null ? "text-zinc-300" : margin.grossMarginCents >= 0 ? "text-emerald-300" : "text-rose-300"}
                />
                <Field
                  label="Margin %"
                  value={margin.grossMarginRatio === null ? "—" : `${Math.round(margin.grossMarginRatio * 100)}%`}
                  tone={margin.grossMarginRatio === null ? "text-zinc-300" : margin.grossMarginRatio >= 0.5 ? "text-emerald-300" : margin.grossMarginRatio >= 0 ? "text-zinc-300" : "text-rose-300"}
                />
              </div>

              {margin.warnings.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-2 border-t border-white/[0.04]">
                  {margin.warnings.map((w) => (
                    <span key={w} className={`text-[9px] font-mono uppercase tracking-wider border rounded-full px-1.5 py-0.5 ${WARNING_TONE[w]}`}>
                      {WARNING_LABEL[w]}
                    </span>
                  ))}
                </div>
              )}
            </article>
          ))}
        </section>
      )}

      <section className="mt-8 rounded-2xl border border-white/15 bg-white/[0.04] p-5">
        <p className="text-[10px] font-semibold text-zinc-300 uppercase tracking-widest mb-2">// margin allocation notes</p>
        <ul className="text-[12px] text-zinc-300 leading-relaxed list-disc list-inside marker:text-white/70 space-y-1">
          <li>Infra cost is allocated at $20/workspace/month — adjust in <code className="text-zinc-200">app/admin/profitability/page.tsx</code> when the per-tenant model lands.</li>
          <li>Support cost is allocated by plan tier: Starter $5, Growth $25, Business $100, Enterprise $250.</li>
          <li>Stripe fees estimated at 2.9% + 30¢ on the plan-price charge. Overage revenue is derived from MTD AI cost over the plan's included pool, multiplied by the plan's implicit markup (Growth ~2x, Business ~1.67x). Starter (hard_stop) and Enterprise (custom_contract) do not generate metered overage revenue here.</li>
          <li>Vendor rates (OpenAI / Anthropic) live in the AIProviderRate table; warning thresholds fire automatically when a tenant exceeds 50% or 100% of plan price in AI cost.</li>
        </ul>
      </section>
    </div>
  );
}

function SummaryStat({ label, value, tone, icon: Icon }: { label: string; value: string; tone: string; icon?: typeof CheckCircleIcon }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
      {Icon && <Icon className={`h-4 w-4 ${tone} mb-2`} />}
      <p className={`text-2xl font-bold tabular-nums ${tone}`}>{value}</p>
      <p className="text-[11px] text-zinc-400 mt-0.5">{label}</p>
    </div>
  );
}

function Field({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div>
      <p className="text-[9px] uppercase tracking-wider text-zinc-500">{label}</p>
      <p className={`font-mono mt-0.5 ${tone ?? "text-zinc-100"}`}>{value}</p>
    </div>
  );
}
