import Link from "next/link";
import { redirect } from "next/navigation";

import { AccountBillingPanel } from "@/components/auth/AccountBillingPanel";
import { currentContext } from "@/lib/auth/currentContext";
import { isAdminOrOwner } from "@/lib/auth/platformAdmin";
import { checkDeploymentQuota } from "@/lib/billing/deploymentQuota";
import { PUBLIC_PLAN_CATALOG, isSelfServiceBillingEnabled } from "@/lib/billing/publicPlanCatalog";
import { describeStripeStatus } from "@/lib/billing/stripeHelper";
import { readBillingPlan } from "@/lib/billing/tenantBillingStore";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

function currentPeriod(now = new Date()) {
  return {
    key: `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`,
    start: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
  };
}

function money(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

function planIdFor(tier: string, status: string) {
  if (status !== "active") return "free" as const;
  if (tier === "enterprise") return "enterprise" as const;
  if (tier === "starter" || tier === "growth") return "pro" as const;
  return "free" as const;
}

export default async function ControlUsageBillingPage() {
  const context = await currentContext();
  if (!context.isAuthenticated || !context.organizationId || !context.email) redirect("/auth/signin?callbackUrl=/control/usage-billing");
  const organizationId = String(context.organizationId);
  const canManage = isAdminOrOwner({ email: context.email, roles: context.roles });
  const period = currentPeriod();
  const billing = await readBillingPlan(organizationId);
  const publicPlanId = planIdFor(billing.tier, billing.status);
  const publicPlan = PUBLIC_PLAN_CATALOG.find((plan) => plan.id === publicPlanId)!;
  const stripe = describeStripeStatus();

  let unavailable = false;
  let members = 0;
  let usage = { calls: 0, inputTokens: 0, outputTokens: 0, billedCents: 0, pendingCalls: 0 };
  let paidCreditCents = 0;
  let transactions: Array<{ id: string; sku: string; pricePaidCents: number; deliveredAICreditsCents: number; reversedAICreditsCents: number; status: string; createdAt: Date }> = [];
  let deployment = await checkDeploymentQuota(prisma, organizationId);
  try {
    const [memberCount, usageAggregate, pendingCalls, creditPurchases, recentTransactions] = await Promise.all([
      prisma.orgMembership.count({ where: { organizationId, acceptedAt: { not: null } } }),
      prisma.usageEvent.aggregate({ where: { organizationId, eventKind: "ai_invocation", createdAt: { gte: period.start } }, _count: { _all: true }, _sum: { inputTokens: true, outputTokens: true, billedCents: true } }),
      prisma.usageEvent.count({ where: { organizationId, eventKind: "ai_invocation", billingStatus: "pending", createdAt: { gte: period.start } } }),
      prisma.addOnPurchase.findMany({
        where: { organizationId, status: { in: ["paid", "partially_refunded"] }, periodMonth: period.key, validFor: "current_month" },
        select: { deliveredAICreditsCents: true, reversedAICreditsCents: true },
      }),
      prisma.addOnPurchase.findMany({ where: { organizationId }, orderBy: { createdAt: "desc" }, take: 12, select: { id: true, sku: true, pricePaidCents: true, deliveredAICreditsCents: true, reversedAICreditsCents: true, status: true, createdAt: true } }),
    ]);
    members = memberCount;
    usage = { calls: usageAggregate._count._all, inputTokens: usageAggregate._sum.inputTokens ?? 0, outputTokens: usageAggregate._sum.outputTokens ?? 0, billedCents: usageAggregate._sum.billedCents ?? 0, pendingCalls };
    paidCreditCents = creditPurchases.reduce(
      (total, purchase) => total + Math.max(0, purchase.deliveredAICreditsCents - purchase.reversedAICreditsCents),
      0,
    );
    transactions = recentTransactions;
  } catch {
    unavailable = true;
    deployment = { allowed: false, planId: null, used: null, limit: null, remaining: 0, reason: "deployment_quota_unavailable" };
  }
  const paidSeats = billing.seatQuantity ?? (publicPlanId === "free" ? publicPlan.includedSeats ?? 0 : 0);
  const includedAiCredits = publicPlan.monthlyAiCreditCents * (publicPlan.aiCreditBasis === "paid_seat" ? Math.max(1, paidSeats) : 1);
  const totalAiCredits = includedAiCredits + paidCreditCents;
  const remainingAiCredits = Math.max(0, totalAiCredits - usage.billedCents);

  return (
    <div className="max-w-5xl">
      <p className="text-[11px] uppercase tracking-[0.2em] text-[#ff783d]">Organization authority</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-[-0.045em] sm:text-4xl">Usage & billing</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">Subscription state, seats, deployments, and Gateway usage come from the organization backend. Checkout return pages never grant entitlements.</p>

      {unavailable && <div role="alert" className="mt-8 border-y border-white/[0.08] py-5 text-sm text-zinc-400">Some authoritative usage records are unavailable. Missing values are not estimated.</div>}

      <div className="mt-10 grid gap-5 lg:grid-cols-[0.72fr_1fr]">
        <AccountBillingPanel planLabel={publicPlan.name} status={billing.status} billingEnabled={isSelfServiceBillingEnabled()} canManage={canManage} hasStripeCustomer={Boolean(billing.stripeCustomerId)} />
        <section className="rounded-2xl border border-white/[0.08] bg-[#171717] p-5 sm:p-7" aria-labelledby="allowance-heading">
          <div className="flex items-center justify-between gap-3"><div><p className="text-[10px] uppercase tracking-[0.18em] text-zinc-600">Current period</p><h2 id="allowance-heading" className="mt-2 text-xl font-medium">Allowances</h2></div><span className="text-xs text-zinc-500">{period.key}</span></div>
          <dl className="mt-6 grid gap-5 sm:grid-cols-2">
            <div><dt className="text-xs text-zinc-500">Organization seats</dt><dd className="mt-2 text-2xl tabular-nums">{members} <span className="text-sm text-zinc-600">/ {paidSeats || "—"}</span></dd></div>
            <div><dt className="text-xs text-zinc-500">Counted deployments</dt><dd className="mt-2 text-2xl tabular-nums">{deployment.used ?? "—"} <span className="text-sm text-zinc-600">/ {deployment.limit ?? "unlimited"}</span></dd></div>
            <div><dt className="text-xs text-zinc-500">AI credit available</dt><dd className="mt-2 text-2xl tabular-nums">{money(remainingAiCredits)}</dd><p className="mt-1 text-[11px] text-zinc-600">{money(totalAiCredits)} verified pool</p></div>
            <div><dt className="text-xs text-zinc-500">Gateway calls</dt><dd className="mt-2 text-2xl tabular-nums">{usage.calls}</dd><p className="mt-1 text-[11px] text-zinc-600">{usage.pendingCalls} awaiting cost settlement</p></div>
          </dl>
        </section>
      </div>

      <section className="mt-6 rounded-2xl border border-white/[0.08] bg-[#171717] p-5 sm:p-7" aria-labelledby="usage-heading">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><h2 id="usage-heading" className="text-lg font-medium">AI usage</h2><p className="mt-1 text-xs text-zinc-500">Customer debit is settled from Vercel Gateway generation cost; pending generations are never presented as free.</p></div><span className="text-sm font-medium">{money(usage.billedCents)} settled</span></div>
        <dl className="mt-5 grid gap-px overflow-hidden rounded-xl border border-white/[0.07] bg-white/[0.07] sm:grid-cols-3">
          {[["Input tokens", usage.inputTokens.toLocaleString()], ["Output tokens", usage.outputTokens.toLocaleString()], ["Paid top-ups", money(paidCreditCents)]].map(([label, value]) => <div key={label} className="bg-[#151515] p-4"><dt className="text-xs text-zinc-600">{label}</dt><dd className="mt-2 text-base tabular-nums text-zinc-200">{value}</dd></div>)}
        </dl>
      </section>

      <section className="mt-6" aria-labelledby="transactions-heading">
        <div className="flex items-end justify-between gap-3"><div><h2 id="transactions-heading" className="text-lg font-medium">Credit transactions</h2><p className="mt-1 text-xs text-zinc-500">Only Stripe-verified paid records increase available credits.</p></div>{canManage && <Link href="/plans" className="text-xs text-[#ff783d] hover:text-[#ff9a6d]">Review plans →</Link>}</div>
        <div className="mt-3 overflow-hidden rounded-xl border border-white/[0.08] bg-[#171717]">
          {transactions.length === 0 ? <p className="px-5 py-6 text-sm text-zinc-500">No credit transactions recorded.</p> : transactions.map((transaction) => {
            const creditsSettled = transaction.status === "paid" || transaction.status === "partially_refunded";
            const netCredits = creditsSettled ? Math.max(0, transaction.deliveredAICreditsCents - transaction.reversedAICreditsCents) : 0;
            const creditLabel = transaction.status === "pending" ? "Awaiting payment" : creditsSettled ? `Credits ${money(netCredits)}${transaction.reversedAICreditsCents > 0 ? " after refund" : ""}` : "No credits applied";
            return <div key={transaction.id} className="flex flex-col justify-between gap-2 border-b border-white/[0.06] px-5 py-4 last:border-b-0 sm:flex-row sm:items-center"><div><p className="text-sm text-zinc-200">{transaction.sku.replaceAll("_", " ")}</p><p className="mt-1 text-[11px] text-zinc-600">{transaction.createdAt.toLocaleString()} · {transaction.status}</p></div><p className="text-xs text-zinc-400">Paid {money(transaction.pricePaidCents)} · {creditLabel}</p></div>;
          })}
        </div>
      </section>

      <div className="mt-8 border-y border-white/[0.08] py-5 text-xs leading-5 text-zinc-500">Stripe mode: {stripe.mode}. AI credit checkout is intentionally locked until one-time payment fulfillment, refunds, and webhook replay handling are verified. No placeholder checkout is offered.</div>
    </div>
  );
}
