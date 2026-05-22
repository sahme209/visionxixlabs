/**
 * Public /pricing — server-rendered, no auth required.
 *
 * Phase 381 rewrite: generated from PLAN_REGISTRY with honest,
 * concrete limits. Real numbers, no "Contact for price" on
 * non-enterprise tiers, no "Unlimited everything" copy.
 *
 * The new four-tier structure (Starter / Growth / Business /
 * Enterprise) supersedes the legacy trial-style pricing — but the
 * legacy TIER_CATALOG and Stripe webhook plumbing remain intact for
 * runtime gating. This page is purely the marketing surface.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { CheckIcon, ArrowRightIcon, ShieldCheckIcon, BoltIcon } from "@heroicons/react/24/outline";
import { PLAN_REGISTRY, type PlanTier } from "@/lib/billing/planRegistry";
import { formatCents } from "@/lib/billing/computeInvocationCost";

export const dynamic = "force-static";
export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Pricing — VisionXIXLabs",
  description: "Starter, Growth, Business, Enterprise. Honest limits. Real AI credits. No 'unlimited everything' theater.",
};

const TIER_TONE: Record<PlanTier, string> = {
  starter:    "border-sky-500/30",
  growth:     "border-violet-500/40 ring-2 ring-violet-400/20",
  business:   "border-amber-500/30",
  enterprise: "border-emerald-500/30",
};

function formatLimit(n: number | null, suffix = ""): string {
  if (n === null) return "Custom";
  if (n === 0) return "Not included";
  return `${n.toLocaleString()}${suffix}`;
}

function formatPrice(cents: number | null): string {
  if (cents === null) return "Custom";
  return `${formatCents(cents)}/mo`;
}

export default function PricingPage() {
  return (
    <main className="relative bg-zinc-950 text-zinc-100 min-h-screen">
      <div className="max-w-7xl mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 mb-4">
            <BoltIcon className="h-4 w-4 text-violet-400" />
            <p className="text-[10px] font-semibold text-violet-400 uppercase tracking-widest">Pricing</p>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white tracking-[-0.04em] mb-3">
            Four tiers. <span className="text-gradient">Real limits.</span>
          </h1>
          <p className="text-[15px] text-zinc-400 max-w-2xl mx-auto leading-relaxed">
            Every plan ships with a defined AI credit pool, agent quota, connector cap, and overage policy. We don't sell "unlimited everything" because that would mean we can't tell you when you've crossed into uneconomical territory — and you deserve to know.
          </p>
        </div>

        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
          {PLAN_REGISTRY.map((p) => (
            <article
              key={p.tier}
              className={`rounded-2xl border bg-white/[0.02] p-6 ${TIER_TONE[p.tier]}`}
            >
              <header className="mb-4">
                <p className="text-[10px] font-mono uppercase tracking-widest text-zinc-400 mb-1">
                  {p.displayName}
                </p>
                <p className="text-3xl font-bold text-white tabular-nums mb-1">
                  {formatPrice(p.monthlyPriceCents)}
                </p>
                {p.annualPriceCents !== null && p.monthlyPriceCents !== null && (
                  <p className="text-[11px] text-zinc-500">
                    or {formatCents(p.annualPriceCents)}/yr · save 20%
                  </p>
                )}
                <p className="text-[12px] text-zinc-300 leading-snug mt-3">{p.tagline}</p>
              </header>

              <Link
                href={p.tier === "enterprise" ? "/contact?reason=enterprise" : "/login"}
                className={`block w-full text-center text-[12px] font-medium px-3 py-2 rounded-lg mb-5 transition ${
                  p.tier === "growth"
                    ? "bg-violet-500/20 text-violet-100 border border-violet-500/40 hover:bg-violet-500/30"
                    : "bg-white/[0.04] text-zinc-200 border border-white/[0.08] hover:bg-white/[0.06]"
                }`}
              >
                {p.tier === "enterprise" ? "Talk to sales" : "Start with " + p.displayName}
                <ArrowRightIcon className="inline h-3 w-3 ml-1" />
              </Link>

              <ul className="space-y-2 text-[11.5px] text-zinc-300 leading-relaxed">
                {p.highlights.map((h, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <CheckIcon className="h-3.5 w-3.5 text-emerald-400 mt-[2px] shrink-0" />
                    <span>{h}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </section>

        <section className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 mb-10 overflow-x-auto">
          <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest mb-4">// detailed comparison</p>
          <table className="w-full text-[12px] text-zinc-300">
            <thead>
              <tr className="text-left text-zinc-500 text-[10px] uppercase tracking-wider border-b border-white/[0.08]">
                <th className="py-3 pr-4 font-medium">Limit</th>
                {PLAN_REGISTRY.map((p) => (
                  <th key={p.tier} className="py-3 px-3 font-medium text-zinc-300">{p.displayName}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              <ComparisonRow label="Seats" values={PLAN_REGISTRY.map((p) => formatLimit(p.entitlements.maxUsers))} />
              <ComparisonRow label="Workspaces" values={PLAN_REGISTRY.map((p) => formatLimit(p.entitlements.maxWorkspaces))} />
              <ComparisonRow label="Connectors" values={PLAN_REGISTRY.map((p) => formatLimit(p.entitlements.maxConnectors))} />
              <ComparisonRow label="Cloud accounts" values={PLAN_REGISTRY.map((p) => formatLimit(p.entitlements.maxCloudAccounts))} />
              <ComparisonRow label="Desktop agents" values={PLAN_REGISTRY.map((p) => formatLimit(p.entitlements.maxDesktopAgents))} />
              <ComparisonRow label="AI engineers enabled" values={PLAN_REGISTRY.map((p) => formatLimit(p.entitlements.maxAgentsEnabled))} />
              <ComparisonRow label="AI credits / month" values={PLAN_REGISTRY.map((p) => formatCents(p.entitlements.includedAICreditsCents))} />
              <ComparisonRow label="Agent runs / month" values={PLAN_REGISTRY.map((p) => formatLimit(p.entitlements.monthlyAgentRuns))} />
              <ComparisonRow label="Automation runs / month" values={PLAN_REGISTRY.map((p) => formatLimit(p.entitlements.monthlyAutomationRuns))} />
              <ComparisonRow label="Connector syncs / month" values={PLAN_REGISTRY.map((p) => formatLimit(p.entitlements.monthlyConnectorSyncs))} />
              <ComparisonRow label="Cloud scans / month" values={PLAN_REGISTRY.map((p) => formatLimit(p.entitlements.monthlyCloudScans))} />
              <ComparisonRow label="Reports / month" values={PLAN_REGISTRY.map((p) => formatLimit(p.entitlements.monthlyReports))} />
              <ComparisonRow label="Monitoring events / month" values={PLAN_REGISTRY.map((p) => formatLimit(p.entitlements.monitoringEventsPerMonth))} />
              <ComparisonRow label="Log retention" values={PLAN_REGISTRY.map((p) => `${p.entitlements.logRetentionDays} days`)} />
              <ComparisonRow label="Audit retention" values={PLAN_REGISTRY.map((p) => `${p.entitlements.auditLogRetentionDays} days`)} />
              <ComparisonRow label="Approval workflows" values={PLAN_REGISTRY.map((p) => p.entitlements.approvalWorkflows ? "✓" : "—")} />
              <ComparisonRow label="Incident management" values={PLAN_REGISTRY.map((p) => p.entitlements.incidentManagement ? "✓" : "—")} />
              <ComparisonRow label="Service catalog" values={PLAN_REGISTRY.map((p) => p.entitlements.serviceCatalog ? "✓" : "—")} />
              <ComparisonRow label="Pipelines" values={PLAN_REGISTRY.map((p) => p.entitlements.pipelines ? "✓" : "—")} />
              <ComparisonRow label="AI coding loop" values={PLAN_REGISTRY.map((p) => p.entitlements.aiCodingLoop ? "✓" : "—")} />
              <ComparisonRow label="SSO / SAML" values={PLAN_REGISTRY.map((p) => p.entitlements.sso ? "✓" : "—")} />
              <ComparisonRow label="Advanced RBAC" values={PLAN_REGISTRY.map((p) => p.entitlements.advancedRbac ? "✓" : "—")} />
              <ComparisonRow label="Custom connectors" values={PLAN_REGISTRY.map((p) => p.entitlements.customConnectors ? "✓" : "—")} />
              <ComparisonRow label="Private deployment" values={PLAN_REGISTRY.map((p) => p.entitlements.privateDeployment ? "✓" : "—")} />
              <ComparisonRow label="Support" values={PLAN_REGISTRY.map((p) => p.entitlements.supportLevel)} />
              <ComparisonRow label="Overage policy" values={PLAN_REGISTRY.map((p) => p.entitlements.overagePolicy.replace(/_/g, " "))} />
            </tbody>
          </table>
        </section>

        <section className="rounded-2xl border border-amber-500/15 bg-amber-500/[0.04] p-6">
          <div className="flex items-center gap-2 mb-3">
            <ShieldCheckIcon className="h-4 w-4 text-amber-400" />
            <p className="text-[10px] font-semibold text-amber-300 uppercase tracking-widest">// how AI usage is measured</p>
          </div>
          <ul className="text-[12.5px] text-zinc-300 leading-relaxed list-disc list-inside marker:text-amber-400/70 space-y-1.5 max-w-3xl">
            <li>Every model call is metered against the published provider rates (OpenAI + Anthropic — table updates when vendors change rates).</li>
            <li>Your dashboard shows real-time AI credit consumption with breakdowns by engineer, model, and workspace.</li>
            <li>The 70% / 90% / 100% thresholds trigger admin alerts so you decide what happens — never silent overage charges.</li>
            <li>Hard-stop on Starter; metered overage with retail markup on Growth / Business; custom contract terms on Enterprise.</li>
            <li>We expose the math because we want you to trust it — not because we want you to optimize for us.</li>
          </ul>
        </section>
      </div>
    </main>
  );
}

function ComparisonRow({ label, values }: { label: string; values: ReadonlyArray<string> }) {
  return (
    <tr>
      <td className="py-2.5 pr-4 text-zinc-400 text-[11.5px]">{label}</td>
      {values.map((v, i) => (
        <td key={i} className="py-2.5 px-3 font-mono text-[11.5px]">{v}</td>
      ))}
    </tr>
  );
}
