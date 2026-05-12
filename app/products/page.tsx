"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CheckCircleIcon,
  XCircleIcon,
  ArrowRightIcon,
  CpuChipIcon,
} from "@heroicons/react/24/outline";
import { Navigation } from "@/components/Navigation";
import { Reveal } from "@/components/motion/Reveal";
import { Stagger } from "@/components/motion/Stagger";
import { AnimatedButton } from "@/components/ui/AnimatedButton";
import { MEMBERSHIP_PLANS, INCLUDED_IN_EVERY_PLAN, ADDONS, type MembershipPlanId } from "@/lib/pricing/membership";
import { SUPPORT_EMAIL } from "@/lib/constants/company";

type BillingCycle = "monthly" | "yearly";

const STRIPE_LINKS = {
  starter: {
    monthly: process.env.NEXT_PUBLIC_STRIPE_STARTER_MONTHLY || "https://buy.stripe.com/8x25kE1ARe7gbGrcNX6c000",
    yearly: process.env.NEXT_PUBLIC_STRIPE_STARTER_YEARLY || "https://buy.stripe.com/bJe14o0wNgfofWH8xH6c003",
  },
  growth: {
    monthly: process.env.NEXT_PUBLIC_STRIPE_GROWTH_MONTHLY || "https://buy.stripe.com/bJe28s3IZ7ISbGr29j6c001",
    yearly: process.env.NEXT_PUBLIC_STRIPE_GROWTH_YEARLY || "https://buy.stripe.com/cNidRa4N3fbk5i301b6c004",
  },
  scale: {
    monthly: process.env.NEXT_PUBLIC_STRIPE_SCALE_MONTHLY || "https://buy.stripe.com/aFa28scfv9R0cKv9BL6c002",
    yearly: process.env.NEXT_PUBLIC_STRIPE_SCALE_YEARLY || "https://buy.stripe.com/bJeaEY5R77IS8uf5lv6c005",
  },
} as const;

function getStripeLink(planId: string, billing: BillingCycle): string | null {
  const plan = STRIPE_LINKS[planId as keyof typeof STRIPE_LINKS];
  if (!plan) return null;
  return plan[billing];
}

const PLAN_ORDER: MembershipPlanId[] = ["starter", "growth", "scale", "enterprise"];

const AXIOM_FEATURES: Record<MembershipPlanId, { included: string[]; excluded: string[] }> = {
  starter: {
    included: [
      "1 AWS account",
      "Read-only infrastructure scan",
      "Cost, security, and drift findings",
      "Prioritized recommendations",
      "Single scan per month",
      "Community support",
    ],
    excluded: [
      "Cognitive reasoning engine",
      "Execution plans + Terraform",
      "Governance policies",
    ],
  },
  growth: {
    included: [
      "3 cloud accounts",
      "Unlimited scans",
      "Cognitive reasoning engine",
      "Phased execution plans + Terraform",
      "Governance policies + approval gates",
      "Verified rollback on every change",
      "Slack + email alerts",
      "GitHub connector",
      "Priority support",
    ],
    excluded: [],
  },
  scale: {
    included: [
      "8 cloud accounts",
      "Unlimited scans",
      "Cognitive reasoning engine",
      "Daily automated scans + drift detection",
      "Execution plans + Terraform generation",
      "Governance + compliance policies",
      "AWS, Azure, GCP connectors",
      "Slack + email alerts + webhooks",
      "Priority support",
    ],
    excluded: [],
  },
  enterprise: {
    included: [
      "Unlimited cloud accounts",
      "Autonomous operations with trust ladder",
      "Daily compliance scans (SOC 2, ISO 27001)",
      "Custom Terraform modules",
      "SSO + audit logging",
      "Dedicated account manager",
      "SLA guarantee (99.9%)",
      "Compliance frameworks + policy packs",
    ],
    excluded: [],
  },
};

const comparisonRows = [
  { feature: "Cloud accounts", starter: "1", growth: "3", scale: "8", enterprise: "Unlimited" },
  { feature: "Infrastructure scans", starter: "1/month", growth: "Unlimited", scale: "Unlimited", enterprise: "Unlimited" },
  { feature: "Cognitive reasoning", starter: "—", growth: "Full 9-phase loop", scale: "Full 9-phase loop", enterprise: "Full 9-phase loop" },
  { feature: "Execution plans", starter: "—", growth: "Generate + apply", scale: "Generate + apply", enterprise: "Custom modules" },
  { feature: "Governance & safety", starter: "—", growth: "Approval gates", scale: "Approval + compliance", enterprise: "Trust ladder + policies" },
  { feature: "Automated monitoring", starter: "—", growth: "Weekly", scale: "Daily", enterprise: "Daily" },
  { feature: "Cloud connectors", starter: "—", growth: "GitHub", scale: "AWS, Azure, GCP", enterprise: "Unlimited" },
  { feature: "Alerts", starter: "—", growth: "Slack + email", scale: "Slack + email + webhooks", enterprise: "Slack + email + PagerDuty" },
  { feature: "Support", starter: "Community", growth: "Priority email", scale: "Priority", enterprise: "Dedicated manager" },
  { feature: "Audit logging", starter: "—", growth: "30 days", scale: "90 days", enterprise: "Unlimited" },
  { feature: "SSO", starter: "—", growth: "—", scale: "—", enterprise: "SAML + OIDC" },
];

export default function PricingPage() {
  const [billing, setBilling] = useState<BillingCycle>("monthly");

  return (
    <div className="min-h-screen bg-[#09090b] text-slate-100 relative overflow-hidden">
      {/* Background effects */}
      <div className="spotlight-orb absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] pointer-events-none" />
      <div className="bg-grid-mesh absolute inset-0 pointer-events-none" />
      <Navigation />

      {/* Header */}
      <section className="pt-28 pb-12 text-center px-4 relative">
        <Reveal>
          <div className="flex items-center justify-center gap-2 mb-6">
            <CpuChipIcon className="h-7 w-7 text-violet-400" />
            <span className="font-bold text-lg">Axiom Cloud Operations</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold mb-4 tracking-[-0.04em]">
            Simple, <span className="text-gradient">transparent pricing</span>
          </h1>
          <p className="text-zinc-400 text-lg max-w-xl mx-auto">
            Start with a full resilience analysis. Upgrade when you&apos;re ready to deploy and monitor.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <button
              onClick={() => setBilling("monthly")}
              className={`btn-huly px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                billing === "monthly"
                  ? "bg-violet-600 text-white"
                  : "text-zinc-400 hover:bg-white/[0.03]"
              }`}
            >
              Pay monthly
            </button>
            <button
              onClick={() => setBilling("yearly")}
              className={`btn-huly px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                billing === "yearly"
                  ? "bg-violet-600 text-white"
                  : "text-zinc-400 hover:bg-white/[0.03]"
              }`}
            >
              Pay yearly
              <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full">
                Save 40%
              </span>
            </button>
          </div>
          <p className="mt-2 text-sm text-zinc-500">7 days free, then charged. Cancel anytime before trial ends.</p>
        </Reveal>
      </section>

      <div className="section-divider max-w-6xl mx-auto my-4" />

      {/* Plan Cards */}
      <section className="pb-20 px-4 relative">
        <Stagger className="grid md:grid-cols-2 xl:grid-cols-4 gap-6 max-w-6xl mx-auto">
            {PLAN_ORDER.map((planId) => {
              const plan = MEMBERSHIP_PLANS[planId];
              const axiom = AXIOM_FEATURES[planId];
              const isEnterprise = planId === "enterprise";
              const price = billing === "monthly" ? plan.monthlyPrice : plan.yearlyPrice;
              const highlighted = plan.popular ?? false;

              return (
                <div
                  key={planId}
                  className={`rounded-2xl border p-8 flex flex-col glass-card animated-border card-inner-glow ${
                    highlighted
                      ? "border-violet-500/40 ring-1 ring-violet-500/20 relative"
                      : "border-white/[0.06]"
                  }`}
                >
                  {highlighted && (
                    <span className="huly-badge absolute -top-3 left-6 text-xs font-semibold text-violet-300 px-3 py-1 rounded-full">
                      Most popular
                    </span>
                  )}
                  <h3 className="text-xl font-bold mt-1">{plan.name}</h3>
                  <p className="text-xs text-violet-400 font-medium mt-1">{plan.axiom.label}</p>
                  <div className="mt-4 flex items-baseline gap-1">
                    {isEnterprise ? (
                      <span className="text-4xl font-bold">Custom</span>
                    ) : (
                      <>
                        <span className="text-4xl font-bold">${price}</span>
                        <span className="text-zinc-500 text-sm">
                          /mo
                          {billing === "yearly" && <span className="text-xs ml-0.5">(billed annually)</span>}
                        </span>
                      </>
                    )}
                  </div>
                  <p className="text-sm text-zinc-400 mt-3 mb-6">{plan.description}</p>
                  <ul className="space-y-3 flex-1">
                    {axiom.included.map((f) => (
                      <li key={f} className="flex items-start gap-2.5 text-sm">
                        <CheckCircleIcon className="h-4 w-4 mt-0.5 flex-shrink-0 text-emerald-400" />
                        <span className="text-zinc-300">{f}</span>
                      </li>
                    ))}
                    {axiom.excluded.map((f) => (
                      <li key={f} className="flex items-start gap-2.5 text-sm">
                        <XCircleIcon className="h-4 w-4 mt-0.5 flex-shrink-0 text-zinc-700" />
                        <span className="text-zinc-600 line-through">{f}</span>
                      </li>
                    ))}
                  </ul>
                  {isEnterprise ? (
                    <a
                      href={`mailto:${SUPPORT_EMAIL}?subject=Cloud Operator - Enterprise`}
                      className="btn-huly mt-8 w-full inline-flex items-center justify-center gap-2 rounded-xl border border-violet-500/30 px-4 py-3 text-sm font-semibold text-violet-300 hover:bg-violet-900/20 transition-colors"
                    >
                      Contact sales
                      <ArrowRightIcon className="h-3.5 w-3.5" />
                    </a>
                  ) : (
                    (() => {
                      const stripeLink = getStripeLink(planId, billing);
                      return stripeLink ? (
                        <a
                          href={stripeLink}
                          rel="noopener noreferrer"
                          className={`btn-huly mt-8 w-full inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-colors ${
                            highlighted
                              ? "bg-violet-600 text-white hover:bg-violet-700 cta-glow"
                              : "bg-white/[0.03] text-slate-200 hover:bg-white/[0.06]"
                          }`}
                        >
                          Start free trial
                          <ArrowRightIcon className="h-3.5 w-3.5" />
                        </a>
                      ) : (
                        <AnimatedButton
                          href="/auth/signup"
                          variant={highlighted ? "primary" : "secondary"}
                          className="mt-8 w-full justify-center"
                        >
                          Start free trial
                          <ArrowRightIcon className="h-3.5 w-3.5" />
                        </AnimatedButton>
                      );
                    })()
                  )}
                </div>
              );
            })}
        </Stagger>
      </section>

      <div className="section-divider max-w-6xl mx-auto my-4" />

      {/* Comparison Table */}
      <section className="pb-20 px-4 relative">
        <div className="max-w-6xl mx-auto">
          <Reveal>
            <h2 className="text-2xl font-bold text-center mb-10 tracking-[-0.04em]">Compare <span className="text-gradient">plans</span></h2>
          </Reveal>
          <div className="rounded-xl border border-white/[0.06] overflow-x-auto glass-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-white/[0.02]">
                  <th className="text-left px-6 py-4 font-semibold text-zinc-300">Feature</th>
                  <th className="text-center px-4 py-4 font-semibold text-zinc-300">Starter</th>
                  <th className="text-center px-4 py-4 font-semibold text-violet-300">Growth</th>
                  <th className="text-center px-4 py-4 font-semibold text-zinc-300">Scale</th>
                  <th className="text-center px-4 py-4 font-semibold text-zinc-300">Enterprise</th>
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map((row, i) => (
                  <tr key={row.feature} className={i % 2 === 0 ? "bg-[#09090b]" : "bg-white/[0.02]"}>
                    <td className="px-6 py-3 text-zinc-400">{row.feature}</td>
                    <td className="px-4 py-3 text-center text-zinc-500">{row.starter}</td>
                    <td className="px-4 py-3 text-center text-zinc-300 font-medium">{row.growth}</td>
                    <td className="px-4 py-3 text-center text-zinc-300">{row.scale}</td>
                    <td className="px-4 py-3 text-center text-zinc-400">{row.enterprise}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Add-ons */}
      <section className="pb-20 px-4 relative">
        <div className="max-w-3xl mx-auto">
          <Reveal>
            <h2 className="text-2xl font-bold text-center mb-8 tracking-[-0.04em]">Add-ons</h2>
          </Reveal>
          <div className="rounded-xl border border-white/[0.06] glass-card p-6">
            <div className="space-y-4">
              {ADDONS.map((addon) => (
                <div key={addon.name} className="flex items-center justify-between py-2 border-b border-white/[0.06] last:border-0">
                  <span className="text-zinc-300">{addon.name}</span>
                  <span className="font-semibold text-slate-100">
                    +${billing === "monthly" ? addon.monthly : addon.yearly}
                    <span className="text-zinc-500 text-sm font-normal">/mo</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Included in every plan */}
      <section className="pb-20 px-4 relative">
        <div className="max-w-3xl mx-auto">
          <Reveal>
            <div className="rounded-2xl border border-white/[0.06] glass-card p-8">
              <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-500 mb-4">Included in every plan</h2>
              <ul className="grid sm:grid-cols-2 gap-3 text-sm text-zinc-300">
                {INCLUDED_IN_EVERY_PLAN.map((item) => (
                  <li key={item} className="flex items-center gap-2">
                    <CheckCircleIcon className="h-5 w-5 text-emerald-400 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </div>
      </section>

      <div className="section-divider max-w-6xl mx-auto my-4" />

      {/* CTA */}
      <section className="py-20 border-t border-white/[0.06] text-center px-4 relative">
        <Reveal>
          <h2 className="text-2xl font-bold mb-4 tracking-[-0.04em]">Ready to <span className="text-gradient">scan your cloud</span>?</h2>
          <p className="text-zinc-400 mb-8">7 days free on any paid plan. Cancel anytime.</p>
          <AnimatedButton href="/operator/onboarding" variant="primary" className="px-8 py-3 cta-glow">
            Start Free Trial
            <ArrowRightIcon className="h-4 w-4" />
          </AnimatedButton>
        </Reveal>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/[0.06] py-10 px-4">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <CpuChipIcon className="h-5 w-5 text-violet-400" />
            <span className="font-semibold text-sm">AI Cloud Operator</span>
            <span className="text-xs text-zinc-600 ml-2">by Vision XIX Labs</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-zinc-500">
            <Link href="/privacy" className="hover:text-zinc-300">Privacy</Link>
            <Link href="/terms" className="hover:text-zinc-300">Terms</Link>
            <Link href="/security" className="hover:text-zinc-300">Security</Link>
            <Link href="/contact" className="hover:text-zinc-300">Contact</Link>
          </div>
        </div>
      </footer>

      {/* Floating blur orbs */}
      <div className="absolute bottom-1/4 left-10 w-72 h-72 bg-violet-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/3 right-0 w-96 h-96 bg-fuchsia-600/8 rounded-full blur-3xl pointer-events-none" />
    </div>
  );
}
