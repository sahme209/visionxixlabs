"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckIcon, SparklesIcon, ArrowRightIcon } from "@heroicons/react/24/outline";
import { Navigation } from "@/components/Navigation";
import { BackgroundBlobs } from "@/components/BackgroundBlobs";
import { BUILDER_PLANS } from "@/lib/pricing/builder";
import { SUPPORT_EMAIL } from "@/lib/constants/company";
import { Reveal } from "@/components/motion/Reveal";
import { Stagger } from "@/components/motion/Stagger";

type BillingCycle = "monthly" | "yearly";

export default function BuilderPricingPage() {
  const [billing, setBilling] = useState<BillingCycle>("monthly");

  return (
    <div className="min-h-screen bg-[#09090b] relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 bg-grid-mesh opacity-10 pointer-events-none" aria-hidden />
      <div className="spotlight-orb absolute -top-40 left-1/3 w-[500px] h-[500px] rounded-full bg-violet-600/[0.06] blur-[140px] pointer-events-none" aria-hidden />
      <div className="absolute bottom-40 right-0 w-80 h-80 rounded-full bg-fuchsia-600/[0.04] blur-[120px] pointer-events-none" aria-hidden />

      <BackgroundBlobs />
      <Navigation />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-20 relative">
        <Link href="/builder" className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-violet-400 mb-8">
          ← Back to Builder
        </Link>

        <Reveal direction="up" blur delay={0.05}>
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-white tracking-[-0.04em]">
              Website Builder <span className="text-gradient">Pricing</span>
            </h1>
            <p className="mt-4 text-zinc-400 max-w-2xl mx-auto">
              AI website engine with optional cloud infrastructure add-ons: hosting, storage, CI/CD, monitoring.
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <button
                onClick={() => setBilling("monthly")}
                className={`btn-huly px-4 py-2 rounded-lg text-sm font-medium ${
                  billing === "monthly" ? "bg-violet-600 text-white" : "bg-zinc-700 text-zinc-400"
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setBilling("yearly")}
                className={`btn-huly px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 ${
                  billing === "yearly" ? "bg-violet-600 text-white" : "bg-zinc-700 text-zinc-400"
                }`}
              >
                Yearly
                <span className="huly-badge text-xs bg-emerald-500/30 text-emerald-300 px-2 py-0.5 rounded-full">Save 40%</span>
              </button>
            </div>
          </div>
        </Reveal>

        <Stagger delay={0.1} interval={0.08}>
          <div className="grid md:grid-cols-3 gap-6">
            {Object.values(BUILDER_PLANS).map((plan) => {
              const monthlyPrice = plan.monthlyPrice;
              const yearlyTotal = plan.yearlyPrice;
              const yearlyMonthly = yearlyTotal != null ? Math.round(yearlyTotal / 12) : null;
              const price = billing === "monthly" ? monthlyPrice : yearlyMonthly;
              return (
                <div
                  key={plan.id}
                  className={`animated-border card-inner-glow card-hover rounded-2xl border-2 p-6 flex flex-col ${
                    plan.popular
                      ? "border-violet-500 bg-violet-500/10 shadow-lg"
                      : "border-white/[0.06] bg-white/[0.02]"
                  }`}
                >
                  {plan.popular && (
                    <span className="huly-badge inline-block mb-4 px-3 py-1 rounded-full bg-violet-600 text-white text-xs font-semibold">
                      Most popular
                    </span>
                  )}
                  <h2 className="text-lg font-bold text-white tracking-[-0.04em]">{plan.name}</h2>
                  <p className="text-sm text-zinc-500 mt-1">{plan.description}</p>
                  <div className="mt-4 mb-6">
                    <span className="text-3xl font-bold text-white">${price}</span>
                    <span className="text-zinc-500">/mo</span>
                    {billing === "yearly" && yearlyTotal != null && (
                      <span className="text-xs text-zinc-600 ml-2">${yearlyTotal}/yr</span>
                    )}
                  </div>
                  <ul className="feature-list-animated space-y-3 flex-1">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm text-zinc-400">
                        <CheckIcon className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-6 pt-6 border-t border-white/[0.06]">
                    <Link
                      href={plan.id === "business" ? `mailto:${SUPPORT_EMAIL}?subject=Builder%20Business` : "/builder"}
                      className={`btn-huly block w-full py-3 rounded-xl text-center font-semibold transition-colors ${
                        plan.popular
                          ? "cta-glow bg-violet-600 text-white hover:bg-violet-700"
                          : "bg-white text-zinc-900 hover:bg-zinc-100"
                      }`}
                    >
                      {plan.id === "business" ? "Contact sales" : "Get started"}
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </Stagger>

        <div className="section-divider my-12" />

        <Reveal direction="up" blur delay={0.3}>
          <p className="mt-8 text-center text-sm text-zinc-500">
            One account. Shared authentication. <Link href="/axiom/pricing" className="text-violet-400 hover:underline">See Axiom pricing</Link> for autonomous cloud operations.
          </p>
        </Reveal>
      </main>
    </div>
  );
}
