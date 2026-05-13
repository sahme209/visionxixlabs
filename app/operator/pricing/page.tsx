"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CheckCircleIcon,
  XCircleIcon,
  ArrowRightIcon,
  CpuChipIcon,
  SparklesIcon,
  ChatBubbleLeftRightIcon,
  EnvelopeIcon,
} from "@heroicons/react/24/outline";
import { Navigation } from "@/components/Navigation";
import { Reveal } from "@/components/motion/Reveal";
import { Footer } from "@/components/Footer";
import { Stagger } from "@/components/motion/Stagger";
import { AnimatedButton } from "@/components/ui/AnimatedButton";
import { MEMBERSHIP_PLANS, ADDONS, type MembershipPlanId } from "@/lib/pricing/membership";
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
  { feature: "Cognitive reasoning", starter: "—", growth: "Full 12-step loop", scale: "Full 12-step loop", enterprise: "Full 12-step loop" },
  { feature: "Execution plans", starter: "—", growth: "Generate + apply", scale: "Generate + apply", enterprise: "Custom modules" },
  { feature: "Governance & safety", starter: "—", growth: "Approval gates", scale: "Approval + compliance", enterprise: "Trust ladder + policies" },
  { feature: "Automated monitoring", starter: "—", growth: "Weekly", scale: "Daily", enterprise: "Daily" },
  { feature: "Cloud connectors", starter: "—", growth: "GitHub", scale: "AWS, Azure, GCP", enterprise: "Unlimited" },
  { feature: "Alerts", starter: "—", growth: "Slack + email", scale: "Slack + email + webhooks", enterprise: "Slack + email + PagerDuty" },
  { feature: "Support", starter: "Community", growth: "Priority email", scale: "Priority", enterprise: "Dedicated manager" },
  { feature: "Audit logging", starter: "—", growth: "30 days", scale: "90 days", enterprise: "Unlimited" },
  { feature: "SSO", starter: "—", growth: "—", scale: "—", enterprise: "SAML + OIDC" },
];

function getCardClass(planId: MembershipPlanId, highlighted: boolean): string {
  if (highlighted) return "electric-card-featured";
  if (planId === "enterprise") return "electric-card-enterprise";
  return "electric-card";
}

export default function OperatorPricingPage() {
  const [billing, setBilling] = useState<BillingCycle>("monthly");

  return (
    <div className="min-h-screen bg-[#09090b] text-white relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] spotlight-orb opacity-30 pointer-events-none" aria-hidden />
      <div className="absolute inset-0 bg-dots opacity-20 pointer-events-none" aria-hidden />
      <div className="absolute -top-60 -right-60 w-[500px] h-[500px] rounded-full bg-blue-600/[0.04] blur-[120px] pointer-events-none" aria-hidden />
      <div className="absolute -bottom-60 -left-60 w-[500px] h-[500px] rounded-full bg-indigo-600/[0.04] blur-[120px] pointer-events-none" aria-hidden />
      <div className="absolute top-40 right-0 w-[600px] h-[400px] rounded-full bg-cyan-500/[0.03] blur-[140px] pointer-events-none" aria-hidden />
      <Navigation />

      {/* Header — content-first philosophy section */}
      <section className="pt-36 pb-8 text-center px-4 relative">
        <div className="beam-sweep absolute inset-0 pointer-events-none" aria-hidden />

        <Reveal>
          <p className="text-sm font-semibold text-blue-400 mb-4 tracking-wide uppercase">
            Pricing
          </p>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6 tracking-tight">
            Simple, transparent pricing
          </h1>
        </Reveal>

        <Reveal delay={0.1}>
          <p className="text-zinc-400 text-lg sm:text-xl max-w-2xl mx-auto leading-relaxed mb-4">
            We believe that great cloud infrastructure tooling should be accessible to teams of all sizes.
            Start free, upgrade when your team is ready.
          </p>
          <p className="text-zinc-500 text-base max-w-xl mx-auto leading-relaxed">
            Every plan includes a 7-day free trial. No credit card required to start.
            Cancel anytime before your trial ends.
          </p>
        </Reveal>

        {/* Billing Toggle — Huly-style pill */}
        <Reveal delay={0.2}>
          <div className="mt-10 inline-flex items-center rounded-full border border-white/[0.08] bg-white/[0.02] p-1 backdrop-blur-sm">
            <button
              onClick={() => setBilling("monthly")}
              className={`px-6 py-2.5 rounded-full text-sm font-medium transition-all duration-300 ${
                billing === "monthly"
                  ? "bg-white text-zinc-900 shadow-sm"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBilling("yearly")}
              className={`px-6 py-2.5 rounded-full text-sm font-medium transition-all duration-300 flex items-center ${
                billing === "yearly"
                  ? "bg-white text-zinc-900 shadow-sm"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              Yearly
              <span className="ml-1.5 text-emerald-400 text-xs font-semibold">Save 40%</span>
            </button>
          </div>
        </Reveal>
      </section>

      {/* Plan Cards — Electric Glow Style */}
      <section className="pb-28 pt-10 px-4">
        <Stagger className="grid md:grid-cols-2 xl:grid-cols-4 gap-8 max-w-7xl mx-auto items-start" interval={0.08}>
          {PLAN_ORDER.map((planId) => {
            const plan = MEMBERSHIP_PLANS[planId];
            const axiom = AXIOM_FEATURES[planId];
            const isEnterprise = planId === "enterprise";
            const monthlyPrice = plan.monthlyPrice;
            const yearlyTotal = plan.yearlyPrice;
            const yearlyMonthly = yearlyTotal != null ? Math.round(yearlyTotal / 12) : null;
            const price = billing === "monthly" ? monthlyPrice : yearlyMonthly;
            const highlighted = plan.popular ?? false;

            return (
              <div
                key={planId}
                className={`group relative flex flex-col ${getCardClass(planId, highlighted)}`}
              >
                {/* Ambient glow orb behind featured card */}
                {highlighted && (
                  <div className="absolute -inset-4 rounded-3xl bg-violet-500/[0.06] blur-2xl pointer-events-none" aria-hidden />
                )}

                {highlighted && (
                  <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-10 text-xs font-semibold text-violet-300 bg-violet-500/15 border border-violet-500/25 px-4 py-1 rounded-full flex items-center gap-1.5 whitespace-nowrap">
                    <SparklesIcon className="h-3 w-3" />
                    Most popular
                  </span>
                )}

                {/* Content */}
                <div className="relative p-8 flex flex-col flex-1 z-10">
                  <h3 className="text-xl font-bold mt-1">{plan.name}</h3>
                  <p className="text-xs text-blue-400 font-medium mt-1">{plan.axiom.label}</p>

                  {/* Price display */}
                  <div className="mt-6 flex items-baseline">
                    {isEnterprise ? (
                      <span className="text-5xl font-bold tracking-tight">Custom</span>
                    ) : (
                      <>
                        <span className="text-2xl font-medium text-zinc-400 align-super">$</span>
                        <span className="text-5xl font-bold tracking-tight">{price}</span>
                        <span className="text-sm text-zinc-500 ml-1">/mo</span>
                        {billing === "yearly" && yearlyTotal != null && (
                          <span className="ml-2 text-xs text-zinc-600">${yearlyTotal}/yr</span>
                        )}
                      </>
                    )}
                  </div>

                  <p className="text-sm text-zinc-400 mt-4 mb-8 leading-relaxed">{plan.description}</p>

                  {/* CTA button — solid white pill */}
                  {isEnterprise ? (
                    <a
                      href={`mailto:${SUPPORT_EMAIL}?subject=Axiom - Enterprise`}
                      className="w-full inline-flex items-center justify-center gap-2 rounded-full border border-amber-500/25 px-4 py-3 text-sm font-semibold text-amber-300 hover:bg-amber-500/10 transition-all duration-300"
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
                          className={`w-full inline-flex items-center justify-center gap-2 rounded-full px-4 py-3 text-sm font-semibold transition-all duration-300 ${
                            highlighted
                              ? "btn-amber-shimmer"
                              : "bg-white/[0.08] text-white hover:bg-white/[0.14] border border-white/[0.08]"
                          }`}
                        >
                          Start free trial
                          <ArrowRightIcon className="h-3.5 w-3.5" />
                        </a>
                      ) : (
                        <AnimatedButton
                          href="/auth/signup?redirect=/operator/onboarding"
                          variant={highlighted ? "primary" : "secondary"}
                          className="w-full justify-center rounded-full"
                        >
                          Start free trial
                          <ArrowRightIcon className="h-3.5 w-3.5" />
                        </AnimatedButton>
                      );
                    })()
                  )}

                  {/* Feature list */}
                  <ul className="space-y-3 mt-8 flex-1">
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
                </div>
              </div>
            );
          })}
        </Stagger>
      </section>

      {/* Comparison Table */}
      <section className="pb-24 px-4">
        <div className="max-w-6xl mx-auto">
          <Reveal>
            <h2 className="text-2xl font-bold text-center mb-12">Compare plans</h2>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="rounded-2xl border border-white/[0.06] overflow-hidden backdrop-blur-sm">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-white/[0.03] border-b border-white/[0.06]">
                    <th className="text-left px-6 py-4 font-semibold text-zinc-300">Feature</th>
                    <th className="text-center px-4 py-4 font-semibold text-zinc-400">Starter</th>
                    <th className="text-center px-4 py-4 font-semibold relative">
                      <span className="text-violet-400">Growth</span>
                      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-px bg-gradient-to-r from-transparent via-violet-500/50 to-transparent" />
                    </th>
                    <th className="text-center px-4 py-4 font-semibold text-zinc-300">Scale</th>
                    <th className="text-center px-4 py-4 font-semibold text-zinc-300">Enterprise</th>
                  </tr>
                </thead>
                <tbody>
                  {comparisonRows.map((row, i) => (
                    <tr
                      key={row.feature}
                      className={`border-t border-white/[0.04] transition-colors duration-300 hover:bg-white/[0.02] ${i % 2 !== 0 ? "bg-white/[0.01]" : ""}`}
                      style={{ animation: `fadeInUp 0.5s cubic-bezier(0.22, 1, 0.36, 1) ${0.05 * i}s both` }}
                    >
                      <td className="px-6 py-3.5 text-sm text-zinc-300 font-medium">{row.feature}</td>
                      <td className="px-4 py-3.5 text-center text-sm text-zinc-500">{row.starter}</td>
                      <td className="px-4 py-3.5 text-center text-sm text-white font-medium">{row.growth}</td>
                      <td className="px-4 py-3.5 text-center text-sm text-zinc-300">{row.scale}</td>
                      <td className="px-4 py-3.5 text-center text-sm text-zinc-400">{row.enterprise}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Add-ons */}
      <section className="pb-24 px-4">
        <div className="max-w-3xl mx-auto">
          <Reveal>
            <h2 className="text-2xl font-bold text-center mb-10">Add-ons</h2>
          </Reveal>
          <Stagger className="grid sm:grid-cols-2 gap-4" interval={0.06}>
            {ADDONS.map((addon) => (
              <div
                key={addon.name}
                className="electric-card group p-6 transition-all duration-500 hover:-translate-y-1"
              >
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-zinc-200">{addon.name}</span>
                    <span className="text-sm font-bold text-white">
                      +${billing === "monthly" ? addon.monthly : addon.yearly}
                      <span className="text-zinc-500 text-xs font-normal ml-0.5">/mo</span>
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </Stagger>
        </div>
      </section>

      {/* Footer CTA */}
      <section className="pb-24 px-4">
        <div className="max-w-2xl mx-auto">
          <Reveal>
            <div className="glass-cta-card bg-white/[0.02] backdrop-blur-sm p-10 text-center">
              <div className="relative z-10">
                <ChatBubbleLeftRightIcon className="h-8 w-8 text-blue-400 mx-auto mb-4" />
                <h2 className="text-2xl font-bold mb-3">Still have questions?</h2>
                <p className="text-zinc-400 text-sm mb-8 max-w-md mx-auto leading-relaxed">
                  Our engineering team can walk you through Axiom, discuss your infrastructure, and help you pick the right plan.
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                  <a
                    href={`mailto:${SUPPORT_EMAIL}?subject=Axiom - Pricing Question`}
                    className="inline-flex items-center gap-2 rounded-full bg-white px-7 py-3 text-sm font-semibold text-zinc-900 hover:bg-zinc-100 transition-colors shadow-[0_0_20px_rgba(255,255,255,0.08)]"
                  >
                    <EnvelopeIcon className="h-4 w-4" />
                    Contact us
                  </a>
                  <a
                    href={`mailto:${SUPPORT_EMAIL}?subject=Axiom - Talk to an Engineer`}
                    className="inline-flex items-center gap-2 text-sm font-medium text-zinc-400 hover:text-white transition-colors"
                  >
                    Talk to an engineer
                    <ArrowRightIcon className="h-3.5 w-3.5" />
                  </a>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 border-t border-white/[0.04] text-center px-4 relative overflow-hidden">
        <div className="absolute inset-0 diagonal-streak opacity-10 pointer-events-none" aria-hidden />
        <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full bg-blue-500/5 blur-[100px] pointer-events-none" aria-hidden />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full bg-indigo-500/5 blur-[100px] pointer-events-none" aria-hidden />
        <Reveal>
          <h2 className="text-3xl font-bold mb-5 relative">Ready to scan your cloud?</h2>
          <p className="text-zinc-400 mb-10 relative max-w-md mx-auto">7 days free on any paid plan. Cancel anytime.</p>
          <a
            href="/auth/signup?redirect=/operator/onboarding"
            className="btn-amber-shimmer inline-flex items-center gap-2 rounded-full px-8 py-3.5 text-sm font-semibold relative"
          >
            Start Free Trial
            <ArrowRightIcon className="h-4 w-4" />
          </a>
        </Reveal>
      </section>

      <Footer />
    </div>
  );
}
