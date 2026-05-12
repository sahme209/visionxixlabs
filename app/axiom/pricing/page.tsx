"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckIcon, CloudIcon } from "@heroicons/react/24/outline";
import { Navigation } from "@/components/Navigation";
import { AXIOM_PLANS } from "@/lib/pricing/axiom";
import { SUPPORT_EMAIL } from "@/lib/constants/company";
import { Reveal } from "@/components/motion/Reveal";
import { Stagger } from "@/components/motion/Stagger";

type BillingCycle = "monthly" | "yearly";

export default function AxiomPricingPage() {
  const [billing, setBilling] = useState<BillingCycle>("monthly");

  return (
    <div className="min-h-screen bg-[#09090b] text-white relative overflow-hidden">
      <div className="absolute inset-0 bg-dots opacity-20" aria-hidden />
      <div className="absolute inset-0 noise-grain pointer-events-none" aria-hidden />
      {/* Floating blur orbs */}
      <div className="absolute -top-40 left-1/4 w-[500px] h-[500px] rounded-full bg-violet-500/[0.06] blur-[120px]" aria-hidden />
      <div className="absolute top-1/3 -right-40 w-[400px] h-[400px] rounded-full bg-fuchsia-500/[0.05] blur-[100px]" aria-hidden />
      <div className="absolute bottom-20 left-10 w-72 h-72 rounded-full bg-violet-600/[0.06] blur-[100px] pointer-events-none" aria-hidden />
      <div className="relative z-10">
        <Navigation />
        <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-20">
          <Link href="/axiom" className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-violet-400 mb-8 transition-colors">
            &larr; Back to Axiom
          </Link>

          {/* Hero */}
          <section className="relative overflow-hidden mb-12">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] spotlight-orb opacity-40" aria-hidden />
            <div className="relative text-center">
              <Reveal direction="up" blur delay={0}>
                <span className="huly-badge text-xs font-semibold text-violet-400 tracking-wide uppercase px-3 py-1 mb-6 inline-block">
                  Pricing
                </span>
              </Reveal>
              <Reveal direction="up" blur delay={0.1}>
                <h1 className="text-4xl sm:text-5xl font-bold tracking-[-0.04em] text-white mb-4">
                  Axiom <span className="text-gradient">Pricing</span>
                </h1>
              </Reveal>
              <Reveal direction="up" blur delay={0.2}>
                <p className="mt-4 text-zinc-400 max-w-2xl mx-auto">
                  Start with read-only scanning. Upgrade to the full autonomous agent with cognitive reasoning, execution plans, and governance as you scale.
                </p>
              </Reveal>
              <Reveal direction="up" blur delay={0.3}>
                <div className="mt-6 flex justify-center gap-3">
                  <button
                    onClick={() => setBilling("monthly")}
                    className={`btn-huly px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      billing === "monthly" ? "bg-violet-600 text-white shadow-lg shadow-violet-500/20" : "bg-white/[0.03] text-zinc-400 border border-white/[0.06] hover:border-white/[0.12]"
                    }`}
                  >
                    Monthly
                  </button>
                  <button
                    onClick={() => setBilling("yearly")}
                    className={`btn-huly px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-all ${
                      billing === "yearly" ? "bg-violet-600 text-white shadow-lg shadow-violet-500/20" : "bg-white/[0.03] text-zinc-400 border border-white/[0.06] hover:border-white/[0.12]"
                    }`}
                  >
                    Yearly
                    <span className="huly-badge text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5">Save 40%</span>
                  </button>
                </div>
              </Reveal>
            </div>
          </section>

          <div className="section-divider mb-12" />

          {/* Pricing cards */}
          <Stagger delay={0.1} interval={0.08} className="grid md:grid-cols-3 gap-6">
            {Object.values(AXIOM_PLANS).map((plan) => {
              const monthlyPrice = plan.monthlyPrice;
              const yearlyTotal = plan.yearlyPrice;
              const yearlyMonthly = yearlyTotal != null ? Math.round(yearlyTotal / 12) : null;
              const price = billing === "monthly" ? monthlyPrice : yearlyMonthly;
              const isEnterprise = plan.id === "enterprise";
              return (
                <div
                  key={plan.id}
                  className={`animated-border card-inner-glow card-hover rounded-2xl border-2 p-6 flex flex-col transition-all ${
                    plan.popular
                      ? "border-violet-500/50 bg-violet-500/[0.06] shadow-lg shadow-violet-500/10"
                      : "border-white/[0.06] bg-white/[0.02]"
                  }`}
                >
                  {plan.popular && (
                    <span className="huly-badge inline-block mb-4 px-3 py-1 bg-violet-600 text-white text-xs font-semibold">
                      Most popular
                    </span>
                  )}
                  <h2 className="text-lg font-bold text-white">{plan.name}</h2>
                  <p className="text-sm text-zinc-500 mt-1">{plan.description}</p>
                  <div className="mt-4 mb-6">
                    {isEnterprise ? (
                      <span className="text-2xl font-bold text-white">Custom</span>
                    ) : (
                      <>
                        <span className="text-3xl font-bold text-gradient">${price}</span>
                        <span className="text-zinc-500">/mo</span>
                        {billing === "yearly" && yearlyTotal != null && (
                          <span className="text-xs text-zinc-600 ml-2">${yearlyTotal}/yr</span>
                        )}
                      </>
                    )}
                  </div>
                  <ul className="feature-list-animated space-y-3 flex-1">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm text-zinc-400">
                        <CheckIcon className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-6 pt-6 border-t border-white/[0.06]">
                    <Link
                      href={isEnterprise ? `mailto:${SUPPORT_EMAIL}?subject=Axiom%20Enterprise` : "/cloud-operator"}
                      className={`btn-huly block w-full py-3 rounded-xl text-center font-semibold transition-all ${
                        plan.popular
                          ? "cta-glow bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-lg shadow-violet-500/20 hover:shadow-violet-500/30"
                          : "bg-white/[0.03] border border-white/[0.06] text-zinc-300 hover:bg-white/[0.05] hover:border-white/[0.12]"
                      }`}
                    >
                      {isEnterprise ? "Contact sales" : "Run Axiom"}
                    </Link>
                  </div>
                </div>
              );
            })}
          </Stagger>
          <Reveal direction="up" blur delay={0.3}>
            <p className="mt-8 text-center text-sm text-zinc-500">
              All plans include read-only scanning. Agent and Enterprise add cognitive reasoning, execution, and governance.
            </p>
          </Reveal>
        </main>
      </div>
    </div>
  );
}
