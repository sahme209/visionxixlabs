"use client";

import { useState } from "react";
import Link from "next/link";

function getStripeLink(planId: string, billing: "monthly" | "yearly"): string | null {
  const m = billing === "monthly";
  if (planId === "starter") return (m ? process.env.NEXT_PUBLIC_STRIPE_STARTER_MONTHLY : process.env.NEXT_PUBLIC_STRIPE_STARTER_YEARLY) || null;
  if (planId === "growth") return (m ? process.env.NEXT_PUBLIC_STRIPE_GROWTH_MONTHLY : process.env.NEXT_PUBLIC_STRIPE_GROWTH_YEARLY) || null;
  if (planId === "scale") return (m ? process.env.NEXT_PUBLIC_STRIPE_SCALE_MONTHLY : process.env.NEXT_PUBLIC_STRIPE_SCALE_YEARLY) || null;
  return null;
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

type BillingCycle = "monthly" | "yearly";

const PLANS = [
  {
    id: "starter",
    name: "Starter",
    monthlyPrice: 35,
    yearlyPrice: 252,
    desc: "For small sites and solo founders",
    popular: false,
    features: [
      "1 chatbot",
      "Up to 6k messages / month",
      "Up to 2,500 pages",
      "Manual refresh",
      "1 team member",
      "White-label branding included",
      "95+ languages",
      "Lead capture",
      "Embed on your site",
    ],
  },
  {
    id: "growth",
    name: "Growth",
    monthlyPrice: 75,
    yearlyPrice: 540,
    desc: "For growing teams and multiple sites",
    popular: true,
    features: [
      "Up to 3 chatbots",
      "Up to 15k messages / month",
      "Up to 15,000 pages",
      "Auto refresh (monthly)",
      "Up to 5 team members",
      "White-label branding included",
      "Integrations (Zendesk, Intercom, Crisp)",
      "Full API access",
      "Rate limiting",
      "95+ languages",
      "Lead capture + escalation to human",
      "Conversation analytics",
    ],
  },
  {
    id: "scale",
    name: "Scale",
    monthlyPrice: 249,
    yearlyPrice: 1794,
    desc: "For high-traffic sites and agencies",
    popular: false,
    features: [
      "Up to 8 chatbots",
      "Up to 60k messages / month",
      "Up to 80,000 pages",
      "Auto refresh (weekly)",
      "Auto scan (daily)",
      "Up to 15 team members",
      "White-label branding included",
      "Integrations + API + Webhooks",
      "Priority support",
      "95+ languages",
      "Lead capture + escalation to human",
      "Conversation analytics + email summaries",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    monthlyPrice: null,
    yearlyPrice: null,
    desc: "Custom volume, your cloud, SOC2-ready",
    popular: false,
    features: [
      "Unlimited chatbots",
      "Custom message volume",
      "Up to 500k+ pages",
      "Auto refresh (daily)",
      "Unlimited team members",
      "Optional self-host / your cloud",
      "SOC2-ready, RBAC, audit logs",
      "Custom integrations",
      "Dedicated success manager",
      "SLA",
    ],
  },
];

const ADDONS = [
  { name: "Extra 10k messages", monthly: 25, yearly: 180 },
  { name: "Extra 25k messages", monthly: 49, yearly: 353 },
];

export default function VisionXIXAIPricingPage() {
  const [billing, setBilling] = useState<BillingCycle>("monthly");

  return (
    <div className="min-h-screen bg-white dark:bg-slate-900">
      <Navigation />

      <section className="pt-28 pb-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl sm:text-5xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            Simple, transparent pricing
          </h1>
          <p className="mt-6 text-xl text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
            Production-ready AI support that pays for itself in saved support time. White-label included — no extra fee.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <button
              onClick={() => setBilling("monthly")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                billing === "monthly"
                  ? "bg-indigo-600 text-white"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              Pay monthly
            </button>
            <button
              onClick={() => setBilling("yearly")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                billing === "yearly"
                  ? "bg-indigo-600 text-white"
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
        </div>
      </section>

      <section id="plans" className="pb-20 px-4 sm:px-6 lg:px-8 scroll-mt-28">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-6">
            {PLANS.map((plan) => {
              const price = billing === "monthly" ? plan.monthlyPrice : plan.yearlyPrice;
              const isEnterprise = plan.id === "enterprise";
              return (
                <div
                  key={plan.id}
                  className={`relative rounded-2xl border-2 p-6 flex flex-col ${
                    plan.popular
                      ? "border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/30 shadow-lg shadow-indigo-500/10"
                      : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                  }`}
                >
                  {plan.popular && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-indigo-600 text-xs font-semibold text-white">
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
                        className="block w-full rounded-xl border-2 border-indigo-600 px-4 py-3 text-center text-sm font-semibold text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
                      >
                        Contact sales
                      </a>
                    ) : (
                      (() => {
                        const stripeLink = getStripeLink(plan.id, billing);
                        return stripeLink ? (
                          <a
                            href={stripeLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block w-full rounded-xl bg-indigo-600 px-4 py-3 text-center text-sm font-semibold text-white hover:bg-indigo-700 transition-colors"
                          >
                            Start free trial
                          </a>
                        ) : (
                          <Link
                            href="/auth/signup"
                            className="block w-full rounded-xl bg-indigo-600 px-4 py-3 text-center text-sm font-semibold text-white hover:bg-indigo-700 transition-colors"
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

          <div className="mt-16 max-w-3xl mx-auto">
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

      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-slate-50 dark:bg-slate-800/50">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-center text-slate-900 dark:text-slate-100 mb-12">
            Why Vision XIX AI beats generic chatbots
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 text-center">
              <SparklesIcon className="h-8 w-8 text-indigo-600 mx-auto mb-2" />
              <p className="font-semibold text-slate-900 dark:text-slate-100">Production-grade</p>
              <p className="text-sm text-slate-500 mt-1">Built for reliability, not demos. Your data, your cloud.</p>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 text-center">
              <BoltIcon className="h-8 w-8 text-indigo-600 mx-auto mb-2" />
              <p className="font-semibold text-slate-900 dark:text-slate-100">White-label included</p>
              <p className="text-sm text-slate-500 mt-1">No +$39 add-on. Your brand, zero extra cost.</p>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 text-center">
              <RocketLaunchIcon className="h-8 w-8 text-indigo-600 mx-auto mb-2" />
              <p className="font-semibold text-slate-900 dark:text-slate-100">More value per $</p>
              <p className="text-sm text-slate-500 mt-1">More messages and pages at comparable or lower price.</p>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 text-center">
              <BuildingOffice2Icon className="h-8 w-8 text-indigo-600 mx-auto mb-2" />
              <p className="font-semibold text-slate-900 dark:text-slate-100">Enterprise-ready</p>
              <p className="text-sm text-slate-500 mt-1">SOC2-ready, RBAC, optional self-host.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-4">Start your 7-day free trial</h2>
          <p className="text-slate-600 dark:text-slate-400 mb-8">
            Choose a plan above to go to checkout. 7 days free, then charged. Cancel anytime.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/visionxix-ai-assistant"
              className="inline-flex items-center gap-2 rounded-full bg-indigo-600 px-6 py-3 text-base font-semibold text-white hover:bg-indigo-700"
            >
              Try live demo
              <ArrowRightIcon className="h-5 w-5" />
            </Link>
            <Link
              href="/visionxix-ai/pricing#plans"
              className="inline-flex items-center gap-2 rounded-full border-2 border-indigo-600 px-6 py-3 text-base font-semibold text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
            >
              View plans
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200 dark:border-slate-700 py-8 px-4">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <Link href="/" className="text-sm text-slate-600 dark:text-slate-400 hover:text-indigo-600">
            Vision XIX Labs
          </Link>
          <div className="flex gap-6 text-sm text-slate-600 dark:text-slate-400">
            <Link href="/visionxix-ai" className="hover:text-indigo-600">
              Product
            </Link>
            <Link href="/visionxix-ai/features" className="hover:text-indigo-600">
              Features
            </Link>
            <Link href="/visionxix-ai-assistant" className="hover:text-indigo-600">
              Demo
            </Link>
            <a href={`mailto:${SUPPORT_EMAIL}`} className="hover:text-indigo-600">
              Contact
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
