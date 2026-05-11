"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckIcon, CloudIcon } from "@heroicons/react/24/outline";
import { Navigation } from "@/components/Navigation";
import { BackgroundBlobs } from "@/components/BackgroundBlobs";
import { AXIOM_PLANS } from "@/lib/pricing/axiom";
import { SUPPORT_EMAIL } from "@/lib/constants/company";

type BillingCycle = "monthly" | "yearly";

export default function AxiomPricingPage() {
  const [billing, setBilling] = useState<BillingCycle>("monthly");

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 relative">
      <BackgroundBlobs />
      <Navigation />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-20">
        <Link href="/axiom" className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 hover:text-violet-600 dark:hover:text-violet-400 mb-8">
          ← Back to Axiom
        </Link>
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-slate-900 dark:text-slate-100">
            Axiom Pricing
          </h1>
          <p className="mt-4 text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
            Start with read-only scanning. Upgrade to the full autonomous agent with cognitive reasoning, execution plans, and governance as you scale.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <button
              onClick={() => setBilling("monthly")}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${
                billing === "monthly" ? "bg-violet-600 text-white" : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400"
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBilling("yearly")}
              className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 ${
                billing === "yearly" ? "bg-violet-600 text-white" : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400"
              }`}
            >
              Yearly
              <span className="text-xs bg-emerald-500/30 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full">Save 40%</span>
            </button>
          </div>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {Object.values(AXIOM_PLANS).map((plan) => {
            const price = billing === "monthly" ? plan.monthlyPrice : plan.yearlyPrice;
            const isEnterprise = plan.id === "enterprise";
            return (
              <div
                key={plan.id}
                className={`rounded-2xl border-2 p-6 flex flex-col ${
                  plan.popular
                    ? "border-violet-500 bg-violet-50/50 dark:bg-violet-950/30 shadow-lg"
                    : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                }`}
              >
                {plan.popular && (
                  <span className="inline-block mb-4 px-3 py-1 rounded-full bg-violet-600 text-white text-xs font-semibold">
                    Most popular
                  </span>
                )}
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">{plan.name}</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{plan.description}</p>
                <div className="mt-4 mb-6">
                  {isEnterprise ? (
                    <span className="text-2xl font-bold text-slate-900 dark:text-slate-100">Custom</span>
                  ) : (
                    <>
                      <span className="text-3xl font-bold text-slate-900 dark:text-slate-100">${price}</span>
                      <span className="text-slate-500 dark:text-slate-400">/mo{billing === "yearly" && " (billed yearly)"}</span>
                    </>
                  )}
                </div>
                <ul className="space-y-3 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400">
                      <CheckIcon className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>
                <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-700">
                  <Link
                    href={isEnterprise ? `mailto:${SUPPORT_EMAIL}?subject=Axiom%20Enterprise` : "/cloud-operator"}
                    className={`block w-full py-3 rounded-xl text-center font-semibold transition-colors ${
                      plan.popular
                        ? "bg-violet-600 text-white hover:bg-violet-700"
                        : "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-200"
                    }`}
                  >
                    {isEnterprise ? "Contact sales" : "Run Axiom"}
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-8 text-center text-sm text-slate-500 dark:text-slate-400">
          All plans include read-only scanning. Agent and Enterprise add cognitive reasoning, execution, and governance.
        </p>
      </main>
    </div>
  );
}
