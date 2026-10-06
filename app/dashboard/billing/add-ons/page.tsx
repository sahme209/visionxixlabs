/**
 * /dashboard/billing/add-ons — Phase 386.
 *
 * Lists every add-on package the current plan can purchase + the
 * workspace's purchase history. Operator clicks "Buy" → API initiates
 * a Stripe Checkout Session (stubbed today; real wiring when the
 * price IDs land).
 */

import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRightIcon,
  ShoppingCartIcon,
  BoltIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  UserGroupIcon,
  CircleStackIcon,
} from "@heroicons/react/24/outline";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import { readBillingPlan } from "@/lib/billing/tenantBillingStore";
import { planForStripeTier } from "@/lib/billing/planRegistry";
import { findAddOnsForPlan, type AddOnCategory } from "@/lib/billing/addOnCatalog";
import { effectiveEntitlements } from "@/lib/billing/effectiveEntitlements";
import { formatCents } from "@/lib/billing/computeInvocationCost";
import { PurchaseAddOnButton } from "@/components/billing/PurchaseAddOnButton";

export const metadata: Metadata = {
  title: "Add-ons · Axiom",
};

export const dynamic = "force-dynamic";

const CATEGORY_META: Record<AddOnCategory, { label: string; icon: typeof BoltIcon; tone: string }> = {
  ai_credits: { label: "AI credits",  icon: BoltIcon,         tone: "text-violet-300" },
  seats:      { label: "Seats",       icon: UserGroupIcon,    tone: "text-emerald-300" },
  connectors: { label: "Connectors",  icon: CircleStackIcon,  tone: "text-zinc-300" },
};

const STATUS_TONE: Record<string, string> = {
  pending:  "text-zinc-300 bg-white/10 border-white/30",
  paid:     "text-emerald-300 bg-emerald-500/10 border-emerald-500/30",
  refunded: "text-zinc-400 bg-white/[0.04] border-white/[0.08]",
  failed:   "text-rose-300 bg-rose-500/10 border-rose-500/30",
};

const periodKey = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;

export default async function AddOnsPage() {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId) {
    return <div className="p-8 text-sm text-zinc-300">Sign in required.</div>;
  }
  const orgId = String(ctx.organizationId);
  const period = periodKey(new Date());

  const billing = await readBillingPlan(orgId).catch(() => null);
  const plan = planForStripeTier(billing?.tier);
  const catalog = findAddOnsForPlan(plan);
  const eff = await effectiveEntitlements(orgId, plan);

  const purchases = await prisma.addOnPurchase.findMany({
    where: { organizationId: orgId },
    orderBy: { createdAt: "desc" },
    take: 30,
  }).catch(() => [] as Array<never>);

  return (
    <div className="relative max-w-5xl">
      <div className="mb-6">
        <Link href="/dashboard/billing/usage" className="text-[11px] text-zinc-300 hover:text-white inline-flex items-center gap-1">
          <ArrowRightIcon className="h-3 w-3 rotate-180" />
          Back to usage
        </Link>
      </div>

      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <ShoppingCartIcon className="h-4 w-4 text-zinc-500" />
          <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest">Add-ons · {plan.displayName} plan</p>
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-white tracking-[-0.04em] mb-2">
          Top up. <span className="text-gradient">Without changing plans.</span>
        </h1>
        <p className="text-[13px] text-zinc-400 max-w-2xl leading-relaxed">
          Buy more AI credits for the current month, or add a seat or connector that persists. Operator-friendly discount vs upgrading to the next tier — you only pay for what you need.
        </p>
      </div>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-8">
        <Stat label="Applied AI credits"
          value={formatCents(eff.appliedAICreditsCents)}
          sub={`Period ${period}`}
          tone="text-violet-300" />
        <Stat label="Applied seats"
          value={String(eff.appliedSeats)}
          sub={eff.appliedSeats > 0 ? "Permanent until cancelled" : "—"}
          tone="text-emerald-300" />
        <Stat label="Applied connectors"
          value={String(eff.appliedConnectors)}
          sub={eff.appliedConnectors > 0 ? "Permanent until cancelled" : "—"}
          tone="text-zinc-300" />
      </section>

      <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest mb-3">// available add-ons</p>
      <section className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-10">
        {catalog.map((a) => {
          const meta = CATEGORY_META[a.category];
          const Icon = meta.icon;
          return (
            <article key={a.sku} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 hover:border-white/[0.10] transition-colors">
              <header className="flex items-center gap-2 mb-2 flex-wrap">
                <Icon className={`h-4 w-4 ${meta.tone}`} />
                <p className={`text-[10px] font-mono uppercase tracking-wider ${meta.tone}`}>{meta.label}</p>
                <span className="text-[9px] font-mono uppercase tracking-wider text-zinc-500 ml-auto">
                  {a.validFor === "current_month" ? `${period}` : "permanent"}
                </span>
              </header>
              <h3 className="text-[15px] font-semibold text-white mb-1">{a.displayName}</h3>
              <p className="text-[12px] text-zinc-400 mb-3 leading-snug">{a.tagline}</p>

              <dl className="grid grid-cols-2 gap-2 text-[11px] mb-4 pt-3 border-t border-white/[0.04]">
                <div>
                  <dt className="text-[9px] uppercase tracking-wider text-zinc-500">Price</dt>
                  <dd className="text-[14px] font-bold text-white">{formatCents(a.priceCents)}</dd>
                </div>
                <div>
                  <dt className="text-[9px] uppercase tracking-wider text-zinc-500">You receive</dt>
                  <dd className="text-[12px] font-mono text-zinc-200">
                    {a.deliveredAICreditsCents > 0 && <>{formatCents(a.deliveredAICreditsCents)} credits</>}
                    {a.deliveredSeats > 0 && <>{a.deliveredSeats} seat{a.deliveredSeats === 1 ? "" : "s"}</>}
                    {a.deliveredConnectors > 0 && <>{a.deliveredConnectors} connector{a.deliveredConnectors === 1 ? "" : "s"}</>}
                  </dd>
                </div>
              </dl>

              <PurchaseAddOnButton sku={a.sku} label={`Buy for ${formatCents(a.priceCents)}`} />
            </article>
          );
        })}
      </section>

      <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest mb-3">// purchase history</p>
      {purchases.length === 0 ? (
        <section className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8 text-center">
          <ClockIcon className="h-6 w-6 text-zinc-500 mx-auto mb-3" />
          <p className="text-[13px] font-semibold text-white">No purchases yet.</p>
          <p className="text-[11.5px] text-zinc-500 mt-1 max-w-md mx-auto leading-snug">
            When you buy an add-on it will appear here with its status and effective period.
          </p>
        </section>
      ) : (
        <ul className="space-y-2 mb-8">
          {purchases.map((p) => {
            const tone = STATUS_TONE[p.status] ?? STATUS_TONE.pending;
            return (
              <li key={p.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
                <div className="flex items-center justify-between gap-3 flex-wrap mb-1">
                  <p className="text-[12px] font-mono text-white">{p.sku}</p>
                  <span className={`text-[9px] font-mono uppercase tracking-wider border rounded-full px-1.5 py-0.5 ${tone}`}>
                    {p.status}
                  </span>
                </div>
                <div className="flex items-center gap-3 flex-wrap text-[10px] font-mono text-zinc-500">
                  <span>{formatCents(p.pricePaidCents)}</span>
                  <span>{p.periodMonth}</span>
                  <span>{p.validFor.replace(/_/g, " ")}</span>
                  <span>by {p.purchasedBy}</span>
                  <span className="ml-auto">{p.createdAt.toISOString()}</span>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <section className="rounded-2xl border border-white/15 bg-white/[0.04] p-5">
        <p className="text-[10px] font-semibold text-zinc-300 uppercase tracking-widest mb-2">// how add-ons work</p>
        <ul className="text-[12px] text-zinc-300 leading-relaxed list-disc list-inside marker:text-white/70 space-y-1">
          <li>AI credit packs apply to the current month — they roll off at the next billing cycle.</li>
          <li>Seat + connector add-ons are recurring monthly until cancelled.</li>
          <li><CheckCircleIcon className="h-3 w-3 inline mr-1 -mt-0.5 text-emerald-300" />Operator pays at a discount vs the underlying retail rate; we still preserve margin.</li>
          <li><ExclamationTriangleIcon className="h-3 w-3 inline mr-1 -mt-0.5 text-zinc-300" />Stripe Checkout for add-ons is wired in stub mode today; rows land as <span className="font-mono text-zinc-200">pending</span> until the operator completes payment.</li>
        </ul>
      </section>
    </div>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
      <p className={`text-2xl font-bold tabular-nums ${tone}`}>{value}</p>
      <p className="text-[11px] text-zinc-400 mt-0.5">{label}</p>
      {sub && <p className="text-[10px] text-zinc-500 mt-1">{sub}</p>}
    </div>
  );
}
