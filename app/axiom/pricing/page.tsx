"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckIcon, CloudIcon } from "@heroicons/react/24/outline";
import { Navigation } from "@/components/Navigation";
import { AXIOM_PLANS } from "@/lib/pricing/axiom";
import { SUPPORT_EMAIL } from "@/lib/constants/company";
import { Reveal } from "@/components/motion/Reveal";
import { Stagger } from "@/components/motion/Stagger";
import { Footer } from "@/components/Footer";

type BillingCycle = "monthly" | "yearly";

function getCardClass(planId: string, popular: boolean): string {
  if (popular) return "electric-card-featured";
  if (planId === "enterprise") return "electric-card-enterprise";
  return "electric-card";
}

export default function AxiomPricingPage() {
  const [billing, setBilling] = useState<BillingCycle>("monthly");

  return (
    <div className="min-h-screen bg-[#09090b] text-white relative overflow-hidden">
      <div className="absolute inset-0 bg-dots opacity-20 pointer-events-none" aria-hidden />
      <div className="absolute -top-40 left-1/4 w-[500px] h-[500px] rounded-full bg-blue-500/[0.04] blur-[120px] pointer-events-none" aria-hidden />
      <div className="absolute top-1/3 -right-40 w-[400px] h-[400px] rounded-full bg-indigo-500/[0.04] blur-[100px] pointer-events-none" aria-hidden />
      <div className="absolute bottom-20 left-10 w-72 h-72 rounded-full bg-cyan-600/[0.04] blur-[100px] pointer-events-none" aria-hidden />
      <div className="relative z-10">
        <Navigation />
        <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-20">
          <Link href="/axiom" className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-blue-400 mb-8 transition-colors">
            &larr; Back to Axiom
          </Link>

          {/* Hero — content-first */}
          <section className="relative overflow-hidden mb-16">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] spotlight-orb opacity-40 pointer-events-none" aria-hidden />
            <div className="relative text-center">
              <Reveal direction="up" blur delay={0}>
                <span className="huly-badge text-xs font-semibold text-blue-400 tracking-wide uppercase px-3 py-1 mb-6 inline-block">
                  Pricing
                </span>
              </Reveal>
              <Reveal direction="up" blur delay={0.1}>
                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-[-0.04em] text-white mb-4">
                  Axiom Pricing
                </h1>
              </Reveal>
              <Reveal direction="up" blur delay={0.15}>
                <p className="mt-4 text-zinc-400 text-lg max-w-2xl mx-auto leading-relaxed">
                  We believe cloud infrastructure tooling should be accessible to teams of every size. Start with read-only scanning free, then upgrade as you grow.
                </p>
              </Reveal>
              <Reveal direction="up" blur delay={0.25}>
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
              </Reveal>
            </div>
          </section>

          {/* Pricing cards — Electric Glow */}
          <Stagger delay={0.1} interval={0.08} className="grid md:grid-cols-3 gap-8">
            {Object.values(AXIOM_PLANS).map((plan) => {
              const monthlyPrice = plan.monthlyPrice;
              const yearlyTotal = plan.yearlyPrice;
              const yearlyMonthly = yearlyTotal != null ? Math.round(yearlyTotal / 12) : null;
              const price = billing === "monthly" ? monthlyPrice : yearlyMonthly;
              const isEnterprise = plan.id === "enterprise";
              const highlighted = plan.popular ?? false;
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
                    <p className="text-sm text-zinc-500 mt-1">{plan.description}</p>
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

                    {/* CTA button — solid white pill */}
                    <Link
                      href={isEnterprise ? `mailto:${SUPPORT_EMAIL}?subject=Axiom%20Enterprise` : "/operator/onboarding"}
                      className={`w-full py-3 rounded-full text-center font-semibold transition-all duration-300 block ${
                        highlighted
                          ? "bg-white text-zinc-900 hover:bg-zinc-100 shadow-[0_0_20px_rgba(255,255,255,0.1)]"
                          : isEnterprise
                            ? "border border-amber-500/25 text-amber-300 hover:bg-amber-500/10"
                            : "bg-white/[0.08] text-white hover:bg-white/[0.14] border border-white/[0.08]"
                      }`}
                    >
                      {isEnterprise ? "Contact sales" : "Run Axiom"}
                    </Link>

                    <ul className="space-y-3 flex-1 mt-8">
                      {plan.features.map((f) => (
                        <li key={f} className="flex items-start gap-2 text-sm text-zinc-400">
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
          <Reveal direction="up" blur delay={0.3}>
            <p className="mt-10 text-center text-sm text-zinc-500">
              All plans include read-only scanning. Agent and Enterprise add cognitive reasoning, execution, and governance.
            </p>
          </Reveal>
        </main>
      </div>
      <Footer />
    </div>
  );
}
