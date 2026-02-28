"use client";

import { useState } from "react";
import Link from "next/link";

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
import { BackgroundBlobs } from "@/components/BackgroundBlobs";
import { AnimateOnScroll } from "@/components/AnimateOnScroll";
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-violet-50/30 to-fuchsia-50/20 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 relative">
      <BackgroundBlobs />
      <Navigation />

      <AnimateOnScroll>
      <section className="pt-28 pb-12 px-4 sm:px-6 lg:px-8 relative">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl sm:text-5xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            One membership. Full stack.
          </h1>
          <p className="mt-6 text-xl text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
            Cloud, AI, and automation — unified. Axiom, chatbots, website builder, and cloud guidance in every plan. Production-ready, white-label included.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <button
              onClick={() => setBilling("monthly")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                billing === "monthly"
                  ? "bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              Pay monthly
            </button>
            <button
              onClick={() => setBilling("yearly")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                billing === "yearly"
                  ? "bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              Pay yearly
              <span className="text-xs bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full">
                Save 40%
              </span>
            </button>
          </div>
          <p className="mt-2 text-sm text-slate-500">7 days free, then charged. Cancel anytime before trial ends.</p>
          <div className="mt-12 rounded-2xl border-2 border-slate-200/80 dark:border-slate-700/80 bg-slate-50/50 dark:bg-slate-800/50 p-6 text-left max-w-3xl mx-auto">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">Included in every plan</h2>
            <ul className="grid sm:grid-cols-2 gap-3 text-sm text-slate-700 dark:text-slate-300">
              {INCLUDED_IN_EVERY_PLAN.map((item) => (
                <li key={item} className="flex items-center gap-2">
                  <CheckIcon className="h-5 w-5 text-emerald-500 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
      </AnimateOnScroll>

      <AnimateOnScroll>
      <section id="plans" className="pb-20 px-4 sm:px-6 lg:px-8 scroll-mt-28">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-6">
            {PLANS.map((plan) => {
              const price = billing === "monthly" ? plan.monthlyPrice : plan.yearlyPrice;
              const isEnterprise = plan.id === "enterprise";
              return (
                <div
                  key={plan.id}
                  className={`card-hover relative rounded-2xl border-2 p-6 flex flex-col ${
                    plan.popular
                      ? "border-violet-500 bg-violet-50/50 dark:bg-violet-950/30 shadow-lg shadow-violet-500/10"
                      : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                  }`}
                >
                  {plan.popular && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 text-xs font-semibold text-white">
                      Most popular
                    </span>
                  )}
                  <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">{plan.name}</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{plan.desc}</p>
                  <div className="mt-4 mb-6">
                    {isEnterprise ? (
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-bold text-slate-900 dark:text-slate-100">Custom</span>
                      </div>
                    ) : (
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-bold text-slate-900 dark:text-slate-100">${price}</span>
                        <span className="text-slate-500 dark:text-slate-400">
                          /mo
                          {billing === "yearly" && <span className="text-xs ml-0.5">(billed annually)</span>}
                        </span>
                      </div>
                    )}
                  </div>
                  <ul className="space-y-2 flex-1">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400">
                        <CheckIcon className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-700">
                    {isEnterprise ? (
                      <a
                        href={`mailto:${SUPPORT_EMAIL}?subject=Vision XIX AI - Enterprise`}
                        className="block w-full rounded-xl border-2 border-violet-600 px-4 py-3 text-center text-sm font-semibold text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-colors"
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
                            className="block w-full rounded-xl bg-violet-600 px-4 py-3 text-center text-sm font-semibold text-white hover:bg-violet-700 transition-colors"
                          >
                            Start free trial
                          </a>
                        ) : (
                          <Link
                            href="/auth/signup"
                            className="block w-full rounded-xl bg-violet-600 px-4 py-3 text-center text-sm font-semibold text-white hover:bg-violet-700 transition-colors"
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
          </div>

          <div className="mt-16 max-w-4xl mx-auto">
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-4">What each plan delivers</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
              One membership unlocks Axiom, Cloud Studio, Website Builder, Chatbots, and Automation. Capabilities scale with your plan.
            </p>
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden mb-12">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                    <th className="text-left py-3 px-4 font-semibold text-slate-900 dark:text-slate-100">Product</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-900 dark:text-slate-100">Starter ($35)</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-900 dark:text-slate-100">Growth ($75)</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-900 dark:text-slate-100">Scale ($249)</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-900 dark:text-slate-100">Enterprise</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-slate-100 dark:border-slate-800">
                    <td className="py-3 px-4 font-medium text-slate-700 dark:text-slate-300">Axiom Cloud Operator</td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400">Analysis only</td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400">Roadmap, configs, GitHub</td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400">Drift, trends, AWS/Azure/GCP</td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400">Strategic advisory</td>
                  </tr>
                  <tr className="border-b border-slate-100 dark:border-slate-800">
                    <td className="py-3 px-4 font-medium text-slate-700 dark:text-slate-300">Cloud Studio</td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400">Summary</td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400">Full output, downloads</td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400">Full + priority</td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400">Custom support</td>
                  </tr>
                  <tr className="border-b border-slate-100 dark:border-slate-800">
                    <td className="py-3 px-4 font-medium text-slate-700 dark:text-slate-300">Automation (Remediation)</td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400">—</td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400">GitHub PR, connectors</td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400">Full access</td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400">Full access</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-4">Add-ons</h2>
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6">
              <div className="space-y-4">
                {ADDONS.map((addon) => (
                  <div key={addon.name} className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800 last:border-0">
                    <span className="text-slate-700 dark:text-slate-300">{addon.name}</span>
                    <span className="font-semibold text-slate-900 dark:text-slate-100">
                      +${billing === "monthly" ? addon.monthly : addon.yearly}
                      <span className="text-slate-500 text-sm font-normal">/mo</span>
                    </span>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-xs text-slate-500">White-label branding is included in all plans. No extra fee.</p>
            </div>
          </div>
        </div>
      </section>
      </AnimateOnScroll>

      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-slate-50 dark:bg-slate-800/50">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-center text-slate-900 dark:text-slate-100 mb-12">
            Why a unified membership beats point solutions
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="card-hover group rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 text-center">
              <SparklesIcon className="h-8 w-8 text-violet-600 mx-auto mb-2 icon-bounce" />
              <p className="font-semibold text-slate-900 dark:text-slate-100">Production-grade</p>
              <p className="text-sm text-slate-500 mt-1">Built for reliability, not demos. Your data, your cloud.</p>
            </div>
            <div className="card-hover group rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 text-center">
              <BoltIcon className="h-8 w-8 text-violet-600 mx-auto mb-2 icon-bounce" />
              <p className="font-semibold text-slate-900 dark:text-slate-100">White-label included</p>
              <p className="text-sm text-slate-500 mt-1">No +$39 add-on. Your brand, zero extra cost.</p>
            </div>
            <div className="card-hover group rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 text-center">
              <RocketLaunchIcon className="h-8 w-8 text-violet-600 mx-auto mb-2 icon-bounce" />
              <p className="font-semibold text-slate-900 dark:text-slate-100">More value per $</p>
              <p className="text-sm text-slate-500 mt-1">More messages and pages at comparable or lower price.</p>
            </div>
            <div className="card-hover group rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 text-center">
              <BuildingOffice2Icon className="h-8 w-8 text-violet-600 mx-auto mb-2 icon-bounce" />
              <p className="font-semibold text-slate-900 dark:text-slate-100">Enterprise-ready</p>
              <p className="text-sm text-slate-500 mt-1">SOC2-ready, RBAC, optional self-host.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-4">One plan. All services.</h2>
          <p className="text-slate-600 dark:text-slate-400 mb-8">
            Get Axiom, chatbots, website builder, and cloud guidance — one membership. 7 days free, then charged. Cancel anytime.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/visionxix-ai-assistant"
              className="cta-glow btn-huly inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 px-6 py-3 text-base font-semibold text-white hover:shadow-lg hover:shadow-violet-500/30"
            >
              Try live demo
              <ArrowRightIcon className="h-5 w-5" />
            </Link>
            <Link
              href="/visionxix-ai/pricing#plans"
              className="inline-flex items-center gap-2 rounded-full border-2 border-violet-600 px-6 py-3 text-base font-semibold text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-900/20"
            >
              View plans
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200 dark:border-slate-700 py-8 px-4">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <Link href="/" className="text-sm text-slate-600 dark:text-slate-400 hover:text-violet-600">
            Vision XIX Labs
          </Link>
          <div className="flex gap-6 text-sm text-slate-600 dark:text-slate-400">
            <Link href="/visionxix-ai/pricing#plans" className="font-semibold text-violet-600">
              Plans & Membership
            </Link>
            <Link href="/visionxix-ai" className="hover:text-violet-600">
              Product
            </Link>
            <Link href="/visionxix-ai/features" className="hover:text-violet-600">
              Features
            </Link>
            <Link href="/visionxix-ai-assistant" className="hover:text-violet-600">
              Demo
            </Link>
            <a href={`mailto:${SUPPORT_EMAIL}`} className="hover:text-violet-600">
              Contact
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
