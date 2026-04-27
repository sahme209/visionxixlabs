"use client";

import Link from "next/link";
import {
  CheckCircleIcon,
  ArrowRightIcon,
  CpuChipIcon,
} from "@heroicons/react/24/outline";
import { Reveal } from "@/components/motion/Reveal";
import { Stagger } from "@/components/motion/Stagger";
import { AnimatedButton } from "@/components/ui/AnimatedButton";

const plans = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    badge: null,
    description: "See your risk score. No strings attached.",
    features: [
      { text: "1 cloud connection", included: true },
      { text: "Resilience score (0-100)", included: true },
      { text: "AI architecture recommendation", included: true },
      { text: "Security scan (read-only)", included: true },
      { text: "Single analysis per month", included: true },
      { text: "Community support", included: true },
      { text: "Terraform generation", included: false },
      { text: "Automated monitoring", included: false },
    ],
    cta: "Start Free",
    ctaHref: "/auth/signup?plan=free&redirect=/operator/onboarding",
    highlighted: false,
  },
  {
    name: "Pro",
    price: "$149",
    period: "/month",
    badge: "Most popular",
    description: "Deploy and monitor multi-cloud infrastructure.",
    features: [
      { text: "3 cloud connections", included: true },
      { text: "Unlimited analyses", included: true },
      { text: "Terraform generation + execution", included: true },
      { text: "Weekly automated scans", included: true },
      { text: "Cost impact analysis", included: true },
      { text: "Axiom AI assistant", included: true },
      { text: "Slack + email alerts", included: true },
      { text: "Priority support", included: true },
    ],
    cta: "Start 14-day free trial",
    ctaHref: "/auth/signup?plan=pro&redirect=/operator/onboarding",
    highlighted: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    badge: null,
    description: "For teams managing critical production systems.",
    features: [
      { text: "Unlimited cloud connections", included: true },
      { text: "Active-Active architecture support", included: true },
      { text: "Daily compliance scans", included: true },
      { text: "Custom Terraform modules", included: true },
      { text: "SSO + audit logging", included: true },
      { text: "Dedicated account manager", included: true },
      { text: "SLA guarantee (99.9%)", included: true },
      { text: "On-call architecture review", included: true },
    ],
    cta: "Contact sales",
    ctaHref: "/contact?ref=operator-enterprise",
    highlighted: false,
  },
];

const comparisonRows = [
  { feature: "Cloud connections", free: "1", pro: "3", enterprise: "Unlimited" },
  { feature: "Resilience analyses", free: "1/month", pro: "Unlimited", enterprise: "Unlimited" },
  { feature: "Security scans", free: "Read-only", pro: "Read-only + alerts", enterprise: "Compliance-grade" },
  { feature: "Terraform execution", free: "—", pro: "Generate + apply", enterprise: "Custom modules" },
  { feature: "Automated monitoring", free: "—", pro: "Weekly", enterprise: "Daily" },
  { feature: "AI assistant (Axiom)", free: "—", pro: "Full access", enterprise: "Full access" },
  { feature: "Alerts", free: "—", pro: "Slack + email", enterprise: "Slack + email + PagerDuty" },
  { feature: "Support", free: "Community", pro: "Priority email", enterprise: "Dedicated manager" },
  { feature: "Audit logging", free: "—", pro: "30 days", enterprise: "Unlimited" },
  { feature: "SSO", free: "—", pro: "—", enterprise: "SAML + OIDC" },
];

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Nav */}
      <nav className="border-b border-slate-800/50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <Link href="/operator" className="flex items-center gap-2">
            <CpuChipIcon className="h-7 w-7 text-violet-400" />
            <span className="font-bold text-lg">Cloud Operator</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/auth/signin" className="text-sm text-slate-400 hover:text-white">Sign in</Link>
            <AnimatedButton href="/auth/signup?redirect=/operator/onboarding" variant="primary" className="text-sm px-4 py-2">
              Start Free
            </AnimatedButton>
          </div>
        </div>
      </nav>

      {/* Header */}
      <section className="pt-20 pb-12 text-center">
        <Reveal>
          <h1 className="text-3xl sm:text-4xl font-bold mb-4">Simple, transparent pricing</h1>
          <p className="text-slate-400 text-lg max-w-xl mx-auto">
            Start free with a full resilience analysis. Upgrade when you&apos;re ready to deploy and monitor.
          </p>
        </Reveal>
      </section>

      {/* Plan Cards */}
      <section className="pb-20 px-4">
        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          <Stagger>
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`rounded-2xl border p-8 flex flex-col ${
                plan.highlighted
                  ? "border-violet-500/40 bg-violet-950/10 ring-1 ring-violet-500/20 relative"
                  : "border-slate-800 bg-slate-900/50"
              }`}
            >
              {plan.badge && (
                <span className="absolute -top-3 left-6 text-xs font-semibold text-violet-300 bg-violet-500/15 border border-violet-500/25 px-3 py-1 rounded-full">
                  {plan.badge}
                </span>
              )}
              <h3 className="text-xl font-bold mt-1">{plan.name}</h3>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-4xl font-bold">{plan.price}</span>
                {plan.period && <span className="text-slate-500 text-sm">{plan.period}</span>}
              </div>
              <p className="text-sm text-slate-400 mt-3 mb-6">{plan.description}</p>
              <ul className="space-y-3 flex-1">
                {plan.features.map((f) => (
                  <li key={f.text} className="flex items-start gap-2.5 text-sm">
                    <CheckCircleIcon className={`h-4 w-4 mt-0.5 flex-shrink-0 ${f.included ? "text-emerald-400" : "text-slate-700"}`} />
                    <span className={f.included ? "text-slate-300" : "text-slate-600 line-through"}>{f.text}</span>
                  </li>
                ))}
              </ul>
              <AnimatedButton
                href={plan.ctaHref}
                variant={plan.highlighted ? "primary" : "secondary"}
                className="mt-8 w-full justify-center"
              >
                {plan.cta}
                <ArrowRightIcon className="h-3.5 w-3.5" />
              </AnimatedButton>
            </div>
          ))}
          </Stagger>
        </div>
      </section>

      {/* Comparison Table */}
      <section className="pb-20 px-4">
        <div className="max-w-5xl mx-auto">
          <Reveal>
            <h2 className="text-2xl font-bold text-center mb-10">Compare plans</h2>
          </Reveal>
          <div className="rounded-xl border border-slate-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-900/80">
                  <th className="text-left px-6 py-4 font-semibold text-slate-300">Feature</th>
                  <th className="text-center px-4 py-4 font-semibold text-slate-300">Free</th>
                  <th className="text-center px-4 py-4 font-semibold text-violet-300">Pro</th>
                  <th className="text-center px-4 py-4 font-semibold text-slate-300">Enterprise</th>
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map((row, i) => (
                  <tr key={row.feature} className={i % 2 === 0 ? "bg-slate-950" : "bg-slate-900/30"}>
                    <td className="px-6 py-3 text-slate-400">{row.feature}</td>
                    <td className="px-4 py-3 text-center text-slate-500">{row.free}</td>
                    <td className="px-4 py-3 text-center text-slate-300 font-medium">{row.pro}</td>
                    <td className="px-4 py-3 text-center text-slate-400">{row.enterprise}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 border-t border-slate-800/50 text-center px-4">
        <Reveal>
          <h2 className="text-2xl font-bold mb-4">Ready to find out your score?</h2>
          <p className="text-slate-400 mb-8">No credit card required. Free forever plan includes full analysis.</p>
          <AnimatedButton href="/auth/signup?redirect=/operator/onboarding" variant="primary" className="px-8 py-3">
            Start Free
            <ArrowRightIcon className="h-4 w-4" />
          </AnimatedButton>
        </Reveal>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800/50 py-10 px-4">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <CpuChipIcon className="h-5 w-5 text-violet-400" />
            <span className="font-semibold text-sm">Cloud Operator</span>
            <span className="text-xs text-slate-600 ml-2">by Vision XIX Labs</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-slate-500">
            <Link href="/privacy" className="hover:text-slate-300">Privacy</Link>
            <Link href="/terms" className="hover:text-slate-300">Terms</Link>
            <Link href="/contact" className="hover:text-slate-300">Contact</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
