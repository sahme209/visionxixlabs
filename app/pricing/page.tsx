/**
 * Public /pricing — server-rendered, no auth required.
 *
 * Generated from the same TIER_CATALOG the in-product billing page
 * reads, so marketing pricing never drifts from product tiers.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { CheckIcon, ArrowRightIcon, ShieldCheckIcon } from "@heroicons/react/24/outline";
import { TIER_CATALOG, type BillingTier } from "@/lib/billing/tierCatalog";

export const dynamic = "force-static";
export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Pricing — Axiom Agent | Vision XIX Labs",
  description: "Starter · Growth · Enterprise. Honest, capped, drift-free pricing for the cross-cloud AGI ops platform.",
};

const TIER_TONE: Record<BillingTier, string> = {
  trial:       "border-zinc-500/30",
  starter:     "border-sky-500/30",
  growth:      "border-violet-500/40 ring-2 ring-violet-400/20",
  enterprise:  "border-emerald-500/30",
};

const TIER_PRICE_HINT: Record<BillingTier, string> = {
  trial:       "Free · 14 days",
  starter:     "Contact for price",
  growth:      "Contact for price",
  enterprise:  "Talk to sales",
};

function formatCap(n: number): string {
  return n < 0 ? "Unlimited" : n.toLocaleString();
}

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-200 relative">
      <header className="border-b border-white/[0.06] sticky top-0 z-10 bg-[#09090b]/80 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between">
          <Link href="/" className="font-bold text-white tracking-[-0.04em]">Axiom</Link>
          <div className="flex items-center gap-3 text-[12px]">
            <Link href="/docs/surfaces" className="text-zinc-300 hover:text-white">Docs</Link>
            <Link href="/dashboard" className="text-zinc-300 hover:text-white">Open dashboard →</Link>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <p className="text-[10px] font-mono text-cyan-300/80 uppercase tracking-widest mb-2">// pricing · honest caps · no asterisks</p>
          <h1 className="text-4xl md:text-5xl font-bold text-white tracking-[-0.045em] leading-[1.05] mb-3">
            Pay for the <span className="text-gradient">surface area</span> you use.
          </h1>
          <p className="text-[15px] text-zinc-400 max-w-2xl mx-auto leading-relaxed">
            Every tier has hard daily caps shown right here. Cancel anytime, VAT handled at checkout, invoices on every charge.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-10">
          {TIER_CATALOG.filter((t) => t.tier !== "trial").map((t) => (
            <div key={t.tier} className={`rounded-2xl border ${TIER_TONE[t.tier]} bg-white/[0.02] p-5 flex flex-col`}>
              <div className="mb-3">
                <p className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">{t.tier}</p>
                <p className="text-[22px] font-bold text-white">{t.label}</p>
                <p className="text-[12px] text-zinc-400 mt-0.5">{TIER_PRICE_HINT[t.tier]}</p>
              </div>
              <p className="text-[12px] text-zinc-300 leading-relaxed mb-3 flex-1">{t.description}</p>

              <ul className="space-y-1.5 text-[11px] font-mono text-zinc-300 mb-4">
                <Bullet label="Autonomy cycles/day" value={formatCap(t.caps.autonomyCyclesPerDay)} />
                <Bullet label="Staged runbooks"     value={formatCap(t.caps.stagedRunbooks)} />
                <Bullet label="Outbound/day"        value={formatCap(t.caps.outboundPerDay)} />
                <Bullet label="Cloud connectors"    value={formatCap(t.caps.cloudConnectors)} />
              </ul>

              {t.tier === "enterprise" ? (
                <a
                  href="mailto:sales@axiom.dev?subject=Enterprise%20plan"
                  className="inline-flex items-center justify-center gap-1.5 text-[12px] font-medium px-3 py-2 rounded-lg bg-emerald-500/15 text-emerald-200 border border-emerald-500/30 hover:bg-emerald-500/20"
                >
                  Talk to sales <ArrowRightIcon className="h-3 w-3" />
                </a>
              ) : (
                <Link
                  href="/dashboard/billing"
                  className="inline-flex items-center justify-center gap-1.5 text-[12px] font-medium px-3 py-2 rounded-lg bg-violet-500/15 text-violet-200 border border-violet-500/30 hover:bg-violet-500/20"
                >
                  Upgrade in dashboard <ArrowRightIcon className="h-3 w-3" />
                </Link>
              )}
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.04] p-5 flex items-start gap-3 max-w-3xl mx-auto">
          <ShieldCheckIcon className="h-5 w-5 text-emerald-300 mt-0.5 shrink-0" />
          <div>
            <p className="text-[11px] font-mono text-emerald-300/80 uppercase tracking-[0.18em] mb-1">// honest billing</p>
            <p className="text-[13px] text-emerald-100 font-semibold leading-snug">
              Every cap shown here is enforced server-side. No usage-based surprises.
            </p>
            <p className="text-[12px] text-zinc-300 leading-relaxed mt-1">
              When a tenant hits its tier cap, the loop pauses and notifies operators — it never quietly
              over-runs and bills you for it.
            </p>
          </div>
        </div>
      </main>

      <footer className="border-t border-white/[0.06] py-6 mt-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-[11px] font-mono text-zinc-500 flex items-center justify-end">
          <Link href="/docs/surfaces" className="text-cyan-300 hover:text-cyan-200">Browse surface catalog →</Link>
        </div>
      </footer>
    </div>
  );
}

function Bullet({ label, value }: { label: string; value: string }) {
  return (
    <li className="flex items-center gap-1.5">
      <CheckIcon className="h-3 w-3 text-emerald-300 shrink-0" />
      <span className="text-zinc-500">{label}:</span>
      <span className="text-white ml-auto">{value}</span>
    </li>
  );
}
