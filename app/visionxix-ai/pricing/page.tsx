"use client";

import { useState } from "react";
import Link from "next/link";
import { Footer } from "@/components/Footer";

// Stripe Payment Links — env vars override per plan/billing; fallback to plan defaults.
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

function getStripeLink(planId: string, billing: "monthly" | "yearly"): string | null {
  const plan = STRIPE_LINKS[planId as keyof typeof STRIPE_LINKS];
  if (!plan) return null;
  return plan[billing === "monthly" ? "monthly" : "yearly"];
}
import {
  CheckIcon,
  SparklesIcon,
  BoltIcon,
  RocketLaunchIcon,
  BuildingOffice2Icon,
  ArrowRightIcon,
} from "@heroicons/react/24/outline";
import { SUPPORT_EMAIL } from "@/lib/constants/company";
import { Navigation } from "@/components/Navigation";
import { Reveal } from "@/components/motion/Reveal";
import { Stagger } from "@/components/motion/Stagger";
import { MEMBERSHIP_PLANS, INCLUDED_IN_EVERY_PLAN, ADDONS } from "@/lib/pricing/membership";

type BillingCycle = "monthly" | "yearly";

/** Build plans from canonical membership config */
const PLANS = (["starter", "growth", "scale", "enterprise"] as const).map((id) => {
  const p = MEMBERSHIP_PLANS[id];
  return {
    id,
    name: p.name,
    monthlyPrice: p.monthlyPrice,
    yearlyPrice: p.yearlyPrice,
    desc: p.description,
    popular: p.popular ?? false,
    features: p.features,
  };
});

export default function VisionXIXAIPricingPage() {
  const [billing, setBilling] = useState<BillingCycle>("monthly");

  return (
    <div className="min-h-screen bg-[#09090b] relative overflow-hidden">
      {/* Background layers */}
      <div className="fixed inset-0 bg-dots opacity-20 pointer-events-none" aria-hidden />
      <div className="fixed inset-0 noise-grain pointer-events-none" aria-hidden />
      <Navigation />

      {/* Hero */}
      <section className="pt-28 pb-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[500px] spotlight-orb opacity-35 pointer-events-none" aria-hidden />
        <div className="absolute -top-32 -right-20 w-72 h-72 rounded-full bg-fuchsia-600/8 blur-[100px] pointer-events-none" aria-hidden />
        <div className="absolute bottom-0 -left-20 w-60 h-60 rounded-full bg-violet-600/8 blur-[90px] pointer-events-none" aria-hidden />
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <Reveal direction="up" blur delay={0.05}>
            <h1 className="text-4xl sm:text-5xl font-bold text-white tracking-[-0.04em]">
              One membership. <span className="text-gradient">Full stack.</span>
            </h1>
          </Reveal>
          <Reveal direction="up" blur delay={0.1}>
            <p className="mt-6 text-xl text-zinc-400 max-w-2xl mx-auto">
              One membership for everything: Axiom, Website Builder, AI assistants, Cloud Studio, and cloud guidance. Production-ready, white-label included.
            </p>
          </Reveal>
          <Reveal direction="up" blur delay={0.15}>
            <div className="mt-8 flex items-center justify-center gap-3">
              <button
                onClick={() => setBilling("monthly")}
                className={`btn-huly px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  billing === "monthly"
                    ? "bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white"
                    : "text-zinc-400 hover:bg-white/[0.04]"
                }`}
              >
                Pay monthly
              </button>
              <button
                onClick={() => setBilling("yearly")}
                className={`btn-huly px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                  billing === "yearly"
                    ? "bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white"
                    : "text-zinc-400 hover:bg-white/[0.04]"
                }`}
              >
                Pay yearly
                <span className="huly-badge text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full">
                  Save 40%
                </span>
              </button>
            </div>
            <p className="mt-2 text-sm text-zinc-500">7 days free, then charged. Cancel anytime before trial ends.</p>
          </Reveal>
          <Reveal direction="up" blur delay={0.2}>
            <div className="mt-12 glass-card rounded-2xl border border-white/[0.06] p-6 text-left max-w-3xl mx-auto">
              <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-500 mb-3">Included in every plan</h2>
              <ul className="feature-list-animated grid sm:grid-cols-2 gap-3 text-sm text-zinc-300">
                {INCLUDED_IN_EVERY_PLAN.map((item) => (
                  <li key={item} className="flex items-center gap-2">
                    <CheckIcon className="h-5 w-5 text-emerald-500 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </div>
      </section>

      <div className="section-divider" />

      {/* Plans Grid */}
      <section id="plans" className="pb-20 px-4 sm:px-6 lg:px-8 scroll-mt-28">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-6">
            <Stagger delay={0.1} interval={0.06}>
              {PLANS.map((plan) => {
                const monthlyPrice = plan.monthlyPrice;
                const yearlyTotal = plan.yearlyPrice;
                const yearlyMonthly = yearlyTotal != null ? Math.round(yearlyTotal / 12) : null;
                const price = billing === "monthly" ? monthlyPrice : yearlyMonthly;
                const isEnterprise = plan.id === "enterprise";
                return (
                  <div
                    key={plan.id}
                    className={`animated-border card-inner-glow card-hover relative rounded-2xl border-2 p-6 flex flex-col ${
                      plan.popular
                        ? "border-violet-500 bg-violet-500/10 shadow-lg shadow-violet-500/10"
                        : "border-white/[0.06] bg-white/[0.02]"
                    }`}
                  >
                    {plan.popular && (
                      <span className="huly-badge absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 text-xs font-semibold text-white">
                        Most popular
                      </span>
                    )}
                    <h2 className="text-lg font-bold text-white">{plan.name}</h2>
                    <p className="text-sm text-zinc-500 mt-1">{plan.desc}</p>
                    <div className="mt-4 mb-6">
                      {isEnterprise ? (
                        <div className="flex items-baseline gap-1">
                          <span className="text-2xl font-bold text-white">Custom</span>
                        </div>
                      ) : (
                        <div className="flex items-baseline gap-1">
                          <span className="text-3xl font-bold text-gradient">${price}</span>
                          <span className="text-zinc-500">/mo</span>
                          {billing === "yearly" && yearlyTotal != null && (
                            <span className="text-xs text-zinc-600 ml-2">${yearlyTotal}/yr</span>
                          )}
                        </div>
                      )}
                    </div>
                    <ul className="feature-list-animated space-y-2 flex-1">
                      {plan.features.map((f) => (
                        <li key={f} className="flex items-start gap-2 text-sm text-zinc-400">
                          <CheckIcon className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                          {f}
                        </li>
                      ))}
                    </ul>
                    <div className="mt-6 pt-6 border-t border-white/[0.06]">
                      {isEnterprise ? (
                        <a
                          href={`mailto:${SUPPORT_EMAIL}?subject=Vision XIX AI - Enterprise`}
                          className="btn-huly block w-full rounded-xl border-2 border-violet-600 px-4 py-3 text-center text-sm font-semibold text-violet-400 hover:bg-violet-500/10 transition-colors"
                        >
                          Contact sales
                        </a>
                      ) : (
                        (() => {
                          const stripeLink = getStripeLink(plan.id, billing);
                          return stripeLink ? (
                            <a
                              href={stripeLink}
                              rel="noopener noreferrer"
                              className="btn-huly cta-glow block w-full rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 py-3 text-center text-sm font-semibold text-white hover:shadow-lg hover:shadow-violet-500/30 transition-all"
                            >
                              Start free trial
                            </a>
                          ) : (
                            <Link
                              href="/auth/signup"
                              className="btn-huly cta-glow block w-full rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 py-3 text-center text-sm font-semibold text-white hover:shadow-lg hover:shadow-violet-500/30 transition-all"
                            >
                              Start free trial
                            </Link>
                          );
                        })()
                      )}
                    </div>
                  </div>
                );
              })}
            </Stagger>
          </div>

          <div className="mt-16 max-w-4xl mx-auto">
            <Reveal direction="up" blur>
              <h2 className="text-xl font-bold text-white mb-4 tracking-[-0.04em]">What each plan <span className="text-gradient">delivers</span></h2>
              <p className="text-sm text-zinc-400 mb-4">
                One membership unlocks Axiom, Website Builder, AI assistants, Cloud Studio, and automation. Capabilities scale with your plan.
              </p>
            </Reveal>
            <Reveal direction="up" blur delay={0.1}>
              <div className="glass-card rounded-xl border border-white/[0.06] overflow-hidden mb-12">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                      <th className="text-left py-3 px-4 font-semibold text-white">Product</th>
                      <th className="text-left py-3 px-4 font-semibold text-white">Starter ($35)</th>
                      <th className="text-left py-3 px-4 font-semibold text-white">Growth ($75)</th>
                      <th className="text-left py-3 px-4 font-semibold text-white">Scale ($249)</th>
                      <th className="text-left py-3 px-4 font-semibold text-white">Enterprise</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-white/[0.04]">
                      <td className="py-3 px-4 font-medium text-zinc-300">Axiom Cloud Operator</td>
                      <td className="py-3 px-4 text-zinc-400">Analysis only</td>
                      <td className="py-3 px-4 text-zinc-400">Roadmap, configs, GitHub</td>
                      <td className="py-3 px-4 text-zinc-400">Drift, trends, AWS/Azure/GCP</td>
                      <td className="py-3 px-4 text-zinc-400">Strategic advisory</td>
                    </tr>
                    <tr className="border-b border-white/[0.04]">
                      <td className="py-3 px-4 font-medium text-zinc-300">Cloud Studio</td>
                      <td className="py-3 px-4 text-zinc-400">Summary</td>
                      <td className="py-3 px-4 text-zinc-400">Full output, downloads</td>
                      <td className="py-3 px-4 text-zinc-400">Full + priority</td>
                      <td className="py-3 px-4 text-zinc-400">Custom support</td>
                    </tr>
                    <tr className="border-b border-white/[0.04]">
                      <td className="py-3 px-4 font-medium text-zinc-300">Website Builder</td>
                      <td className="py-3 px-4 text-zinc-400">3 revisions, preview</td>
                      <td className="py-3 px-4 text-zinc-400">Production deploy, CDN</td>
                      <td className="py-3 px-4 text-zinc-400">Priority deploy</td>
                      <td className="py-3 px-4 text-zinc-400">Custom, SLA</td>
                    </tr>
                    <tr className="border-b border-white/[0.04]">
                      <td className="py-3 px-4 font-medium text-zinc-300">Automation</td>
                      <td className="py-3 px-4 text-zinc-400">--</td>
                      <td className="py-3 px-4 text-zinc-400">GitHub PR, connectors</td>
                      <td className="py-3 px-4 text-zinc-400">Full access</td>
                      <td className="py-3 px-4 text-zinc-400">Full access</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </Reveal>

            <Reveal direction="up" blur>
              <h2 className="text-xl font-bold text-white mb-4 tracking-[-0.04em]"><span className="text-gradient">Add-ons</span></h2>
            </Reveal>
            <Reveal direction="up" blur delay={0.1}>
              <div className="glass-card rounded-xl border border-white/[0.06] p-6">
                <div className="space-y-4">
                  {ADDONS.map((addon) => (
                    <div key={addon.name} className="flex items-center justify-between py-2 border-b border-white/[0.04] last:border-0">
                      <span className="text-zinc-300">{addon.name}</span>
                      <span className="font-semibold text-white">
                        +${billing === "monthly" ? addon.monthly : addon.yearly}
                        <span className="text-zinc-500 text-sm font-normal">/mo</span>
                      </span>
                    </div>
                  ))}
                </div>
                <p className="mt-4 text-xs text-zinc-500">White-label branding is included in all plans. No extra fee.</p>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      <div className="section-divider" />

      {/* Why unified */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 relative">
        <div className="absolute inset-0 bg-grid-mesh opacity-20 pointer-events-none" aria-hidden />
        <div className="max-w-4xl mx-auto relative z-10">
          <Reveal direction="up" blur>
            <h2 className="text-2xl font-bold text-center text-white mb-12 tracking-[-0.04em]">
              Why a unified membership <span className="text-gradient">beats point solutions</span>
            </h2>
          </Reveal>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <Stagger delay={0.1} interval={0.06}>
              {[
                { icon: SparklesIcon, title: "Production-grade", desc: "Built for reliability, not demos. Your data, your cloud." },
                { icon: BoltIcon, title: "White-label included", desc: "No +$39 add-on. Your brand, zero extra cost." },
                { icon: RocketLaunchIcon, title: "More value per $", desc: "More operations, pages, and projects per dollar." },
                { icon: BuildingOffice2Icon, title: "Enterprise-ready", desc: "SOC2-ready, RBAC, optional self-host." },
              ].map((item) => (
                <div key={item.title} className="animated-border card-inner-glow card-hover group rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 text-center">
                  <item.icon className="h-8 w-8 text-violet-400 mx-auto mb-2" />
                  <p className="font-semibold text-white">{item.title}</p>
                  <p className="text-sm text-zinc-500 mt-1">{item.desc}</p>
                </div>
              ))}
            </Stagger>
          </div>
        </div>
      </section>

      <div className="section-divider" />

      {/* Final CTA */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[300px] spotlight-orb opacity-20 pointer-events-none" aria-hidden />
        <div className="max-w-3xl mx-auto text-center relative z-10">
          <Reveal direction="up" blur>
            <h2 className="text-2xl font-bold text-white mb-4 tracking-[-0.04em]">One plan. <span className="text-gradient">All services.</span></h2>
            <p className="text-zinc-400 mb-8">
              Get Axiom, Website Builder, AI assistants, and cloud guidance — one membership. 7 days free, then charged. Cancel anytime.
            </p>
          </Reveal>
          <Reveal direction="up" blur delay={0.1}>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/visionxix-ai-assistant"
                className="cta-glow btn-huly inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 px-6 py-3 text-base font-semibold text-white hover:shadow-lg hover:shadow-violet-500/30 transition-all"
              >
                Try live demo
                <ArrowRightIcon className="h-5 w-5" />
              </Link>
              <Link
                href="/visionxix-ai/pricing#plans"
                className="btn-huly inline-flex items-center gap-2 rounded-full border-2 border-violet-600 px-6 py-3 text-base font-semibold text-violet-400 hover:bg-violet-500/10 transition-colors"
              >
                View plans
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Floating blur orbs */}
      <div className="absolute bottom-1/4 left-10 w-72 h-72 bg-violet-600/10 rounded-full blur-3xl pointer-events-none" aria-hidden />
      <div className="absolute bottom-1/3 right-0 w-96 h-96 bg-fuchsia-600/[0.06] rounded-full blur-3xl pointer-events-none" aria-hidden />

      <Footer />
    </div>
  );
}
