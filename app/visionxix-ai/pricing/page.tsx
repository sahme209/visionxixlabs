"use client";

import { useState } from "react";
import Link from "next/link";
import { Footer } from "@/components/Footer";

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
  return plan[billing];
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

function getCardClass(planId: string, popular: boolean): string {
  if (popular) return "electric-card-featured";
  if (planId === "enterprise") return "electric-card-enterprise";
  return "electric-card";
}

export default function VisionXIXAIPricingPage() {
  const [billing, setBilling] = useState<BillingCycle>("monthly");

  return (
    <div className="min-h-screen bg-[#09090b] relative overflow-hidden">
      <div className="fixed inset-0 bg-dots opacity-20 pointer-events-none" aria-hidden />
      <div className="absolute -top-32 -right-20 w-72 h-72 rounded-full bg-blue-600/[0.05] blur-[100px] pointer-events-none" aria-hidden />
      <div className="absolute bottom-0 -left-20 w-60 h-60 rounded-full bg-indigo-600/[0.05] blur-[90px] pointer-events-none" aria-hidden />
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full bg-cyan-500/[0.03] blur-[140px] pointer-events-none" aria-hidden />
      <Navigation />

      {/* Hero — content-first */}
      <section className="pt-28 pb-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[500px] spotlight-orb opacity-35 pointer-events-none" aria-hidden />
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <Reveal direction="up" blur delay={0.05}>
            <p className="text-sm font-semibold text-blue-400 mb-4 tracking-wide uppercase">Pricing</p>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white tracking-[-0.04em] mb-4">
              One membership. Full stack.
            </h1>
          </Reveal>
          <Reveal direction="up" blur delay={0.1}>
            <p className="mt-4 text-xl text-zinc-400 max-w-2xl mx-auto leading-relaxed">
              We believe in making powerful tools accessible. One membership unlocks Axiom, Website Builder, AI assistants, Cloud Studio, and cloud guidance. Start free, cancel anytime.
            </p>
          </Reveal>
          <Reveal direction="up" blur delay={0.15}>
            <div className="mt-8 inline-flex items-center rounded-full border border-white/[0.08] bg-white/[0.02] p-1 backdrop-blur-sm">
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
            <p className="mt-3 text-sm text-zinc-600">7 days free, then charged. Cancel anytime before trial ends.</p>
          </Reveal>
          <Reveal direction="up" blur delay={0.2}>
            <div className="mt-12 rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm p-6 text-left max-w-3xl mx-auto">
              <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-500 mb-3">Included in every plan</h2>
              <ul className="grid sm:grid-cols-2 gap-3 text-sm text-zinc-300">
                {INCLUDED_IN_EVERY_PLAN.map((item) => (
                  <li key={item} className="flex items-center gap-2">
                    <CheckIcon className="h-4 w-4 text-emerald-400 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </div>
      </section>

      <div className="section-divider" />

      {/* Plans Grid — Electric Glow */}
      <section id="plans" className="pb-20 pt-12 px-4 sm:px-6 lg:px-8 scroll-mt-28">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-8">
            <Stagger delay={0.1} interval={0.06}>
              {PLANS.map((plan) => {
                const monthlyPrice = plan.monthlyPrice;
                const yearlyTotal = plan.yearlyPrice;
                const yearlyMonthly = yearlyTotal != null ? Math.round(yearlyTotal / 12) : null;
                const price = billing === "monthly" ? monthlyPrice : yearlyMonthly;
                const isEnterprise = plan.id === "enterprise";
                const highlighted = plan.popular;
                return (
                  <div
                    key={plan.id}
                    className={`group relative flex flex-col ${getCardClass(plan.id, highlighted)}`}
                  >
                    {highlighted && (
                      <div className="absolute -inset-4 rounded-3xl bg-indigo-500/[0.06] blur-2xl pointer-events-none" aria-hidden />
                    )}
                    {highlighted && (
                      <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-10 text-xs font-semibold text-indigo-300 bg-indigo-500/15 border border-indigo-500/25 px-4 py-1 rounded-full whitespace-nowrap">
                        Most popular
                      </span>
                    )}
                    <div className="relative p-8 flex flex-col flex-1 z-10">
                      <h2 className="text-xl font-bold text-white">{plan.name}</h2>
                      <p className="text-sm text-zinc-500 mt-1">{plan.desc}</p>
                      <div className="mt-6 mb-6">
                        {isEnterprise ? (
                          <span className="text-4xl font-bold text-white">Custom</span>
                        ) : (
                          <>
                            <span className="text-2xl font-medium text-zinc-400 align-super">$</span>
                            <span className="text-4xl font-bold text-white">{price}</span>
                            <span className="text-zinc-500 ml-1">/mo</span>
                            {billing === "yearly" && yearlyTotal != null && (
                              <span className="text-xs text-zinc-600 ml-2">${yearlyTotal}/yr</span>
                            )}
                          </>
                        )}
                      </div>

                      {/* CTA — solid white pill */}
                      {isEnterprise ? (
                        <a
                          href={`mailto:${SUPPORT_EMAIL}?subject=Vision XIX AI - Enterprise`}
                          className="w-full py-3 rounded-full text-center font-semibold border border-amber-500/25 text-amber-300 hover:bg-amber-500/10 transition-all duration-300 block"
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
                              className={`w-full py-3 rounded-full text-center font-semibold transition-all duration-300 block ${
                                highlighted
                                  ? "bg-white text-zinc-900 hover:bg-zinc-100 shadow-[0_0_20px_rgba(255,255,255,0.1)]"
                                  : "bg-white/[0.08] text-white hover:bg-white/[0.14] border border-white/[0.08]"
                              }`}
                            >
                              Start free trial
                            </a>
                          ) : (
                            <Link
                              href="/auth/signup"
                              className={`w-full py-3 rounded-full text-center font-semibold transition-all duration-300 block ${
                                highlighted
                                  ? "bg-white text-zinc-900 hover:bg-zinc-100 shadow-[0_0_20px_rgba(255,255,255,0.1)]"
                                  : "bg-white/[0.08] text-white hover:bg-white/[0.14] border border-white/[0.08]"
                              }`}
                            >
                              Start free trial
                            </Link>
                          );
                        })()
                      )}

                      <ul className="space-y-2.5 flex-1 mt-8">
                        {plan.features.map((f) => (
                          <li key={f} className="flex items-start gap-2 text-sm">
                            <CheckIcon className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                            <span className="text-zinc-300">{f}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                );
              })}
            </Stagger>
          </div>

          <div className="mt-16 max-w-4xl mx-auto">
            <Reveal direction="up" blur>
              <h2 className="text-xl font-bold text-white mb-4 tracking-[-0.04em]">What each plan delivers</h2>
              <p className="text-sm text-zinc-400 mb-4">
                One membership unlocks Axiom, Website Builder, AI assistants, Cloud Studio, and automation. Capabilities scale with your plan.
              </p>
            </Reveal>
            <Reveal direction="up" blur delay={0.1}>
              <div className="rounded-2xl border border-white/[0.06] overflow-hidden backdrop-blur-sm mb-12">
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
              <h2 className="text-xl font-bold text-white mb-4 tracking-[-0.04em]">Add-ons</h2>
            </Reveal>
            <Reveal direction="up" blur delay={0.1}>
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm p-6">
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
        <div className="max-w-4xl mx-auto relative z-10">
          <Reveal direction="up" blur>
            <h2 className="text-2xl font-bold text-center text-white mb-12 tracking-[-0.04em]">
              Why a unified membership beats point solutions
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
                <div key={item.title} className="electric-card group p-5 text-center">
                  <div className="relative z-10">
                    <item.icon className="h-8 w-8 text-blue-400 mx-auto mb-2" />
                    <p className="font-semibold text-white">{item.title}</p>
                    <p className="text-sm text-zinc-500 mt-1">{item.desc}</p>
                  </div>
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
            <h2 className="text-2xl font-bold text-white mb-4 tracking-[-0.04em]">One plan. All services.</h2>
            <p className="text-zinc-400 mb-8">
              Get Axiom, Website Builder, AI assistants, and cloud guidance — one membership. 7 days free, then charged. Cancel anytime.
            </p>
          </Reveal>
          <Reveal direction="up" blur delay={0.1}>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/visionxix-ai-assistant"
                className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-base font-semibold text-zinc-900 hover:bg-zinc-100 transition-all shadow-[0_0_20px_rgba(255,255,255,0.1)]"
              >
                Try live demo
                <ArrowRightIcon className="h-5 w-5" />
              </Link>
              <Link
                href="/visionxix-ai/pricing#plans"
                className="inline-flex items-center gap-2 rounded-full border border-white/[0.1] px-6 py-3 text-base font-semibold text-zinc-400 hover:text-white hover:border-white/[0.2] transition-colors"
              >
                View plans
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      <Footer />
    </div>
  );
}
