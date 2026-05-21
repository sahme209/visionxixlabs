"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useState } from "react";
import { SocialProofRail } from "../_components/SocialProofRail";
import { MEMBERSHIP_PLANS, type MembershipPlanId } from "@/lib/pricing/membership";

type BillingPeriod = "monthly" | "annual";

// Tier ids on this page = MEMBERSHIP_PLANS ids + the free "trial" entry.
type TierId = "trial" | MembershipPlanId;

interface Tier {
  id: TierId;
  label: string;
  /**
   * Pricing source of truth:
   *  - "trial"  → free
   *  - "enterprise" → custom
   *  - everything else reads from MEMBERSHIP_PLANS, which matches the
   *    real Stripe Payment Link prices in env.
   */
  pricing: { kind: "free" } | { kind: "custom" } | { kind: "paid"; planId: MembershipPlanId };
  blurb: string;
  highlight?: boolean;
  rows: ReadonlyArray<{ label: string; value: string }>;
}

// Real Stripe Payment Link URLs synced via scripts/sync-stripe-pricing.mjs
// on 2026-05-21. Each fallback points at the live link for $149 / $899 /
// $3,499 monthly + $1,188 / $7,188 / $29,988 yearly. Env-overridable so
// staging can use test-mode links without code changes.
const STRIPE_LINKS: Record<"starter" | "growth" | "scale", { monthly: string; annual: string }> = {
  starter: {
    monthly: process.env.NEXT_PUBLIC_STRIPE_STARTER_MONTHLY || "https://buy.stripe.com/3cI4gAcfv6EO7qb15f6c006",
    annual:  process.env.NEXT_PUBLIC_STRIPE_STARTER_YEARLY  || "https://buy.stripe.com/3cI8wQ93j0gq7qb6pz6c007",
  },
  growth: {
    monthly: process.env.NEXT_PUBLIC_STRIPE_GROWTH_MONTHLY  || "https://buy.stripe.com/6oU28sbbre7gaCn7tD6c008",
    annual:  process.env.NEXT_PUBLIC_STRIPE_GROWTH_YEARLY   || "https://buy.stripe.com/00w6oI7ZffbkdOz9BL6c009",
  },
  scale: {
    monthly: process.env.NEXT_PUBLIC_STRIPE_SCALE_MONTHLY   || "https://buy.stripe.com/7sY9AUfrH0gqfWH6pz6c00a",
    annual:  process.env.NEXT_PUBLIC_STRIPE_SCALE_YEARLY    || "https://buy.stripe.com/eVqdRaa7nd3ceSD4hr6c00b",
  },
};

function ctaFor(tierId: Tier["id"], period: BillingPeriod): { href: string; label: string; external: boolean } {
  switch (tierId) {
    case "trial":
      return { href: "/dashboard/command-center", label: "Start trial →", external: false };
    case "enterprise":
      return { href: "/contact",                   label: "Talk to sales →", external: false };
    case "starter":
    case "growth":
    case "scale":
      return { href: STRIPE_LINKS[tierId][period], label: "Choose plan →",   external: true };
  }
}

const TIERS: readonly Tier[] = [
  {
    id: "trial",
    label: "Trial",
    pricing: { kind: "free" },
    blurb: "Open the cockpit, wire one cloud, run the council against a sandbox.",
    rows: [
      { label: "Operators",              value: "1" },
      { label: "Autonomy cycles / day",  value: "100" },
      { label: "AI provider chain",      value: "free providers only" },
      { label: "Integrations",           value: "Slack webhook" },
      { label: "Compliance packets",     value: "—" },
      { label: "Approval-only contract", value: "✓" },
    ],
  },
  {
    id: "starter",
    label: "Starter",
    pricing: { kind: "paid", planId: "starter" },
    blurb: "One workspace, one human approver, every safety contract.",
    rows: [
      { label: "Operators",              value: "1" },
      { label: "AI operations / month",  value: "6,000" },
      { label: "AI provider chain",      value: "free providers only" },
      { label: "Integrations",           value: "Slack + embed" },
      { label: "Refresh cadence",        value: "manual" },
      { label: "Approval-only contract", value: "✓" },
    ],
  },
  {
    id: "growth",
    label: "Growth",
    pricing: { kind: "paid", planId: "growth" },
    blurb: "Phased execution plans, Terraform generation, GitHub connector — the operator's tier.",
    highlight: true,
    rows: [
      { label: "Operators",              value: "up to 5 team members" },
      { label: "AI operations / month",  value: "15,000" },
      { label: "AI provider chain",      value: "all 9 free providers" },
      { label: "Integrations",           value: "Slack + Teams + Zendesk + Intercom" },
      { label: "Refresh cadence",        value: "auto · monthly" },
      { label: "Approval-only contract", value: "✓" },
    ],
  },
  {
    id: "scale",
    label: "Scale",
    pricing: { kind: "paid", planId: "scale" },
    blurb: "AWS + Azure + GCP connectors, weekly auto-refresh, daily scan, API + webhooks.",
    rows: [
      { label: "Operators",              value: "up to 15 team members" },
      { label: "AI operations / month",  value: "60,000" },
      { label: "AI provider chain",      value: "all + BYO key" },
      { label: "Integrations",           value: "all + API + webhooks" },
      { label: "Refresh cadence",        value: "auto · weekly + daily scan" },
      { label: "Approval-only contract", value: "✓ · signed Terraform" },
    ],
  },
  {
    id: "enterprise",
    label: "Enterprise",
    pricing: { kind: "custom" },
    blurb: "Self-host, SOC2-ready, RBAC, audit logs, dedicated success manager + SLA.",
    rows: [
      { label: "Operators",              value: "unlimited" },
      { label: "AI operations / month",  value: "custom volume" },
      { label: "AI provider chain",      value: "self-host any provider" },
      { label: "Integrations",           value: "everything + custom" },
      { label: "Refresh cadence",        value: "auto · daily" },
      { label: "Approval-only contract", value: "✓ + dual-control gate" },
    ],
  },
];

const usd = (n: number): string => `$${n.toLocaleString("en-US")}`;

interface PricingDisplay {
  display: string;            // "Free" | "Custom" | "$35" | "$21"
  suffix: string | null;      // "/ month" | null
  saveCopy: string | null;    // "billed annually · save 40%" when relevant
}

function pricingFor(tier: Tier, period: BillingPeriod): PricingDisplay {
  if (tier.pricing.kind === "free") return { display: "Free", suffix: null, saveCopy: null };
  if (tier.pricing.kind === "custom") return { display: "Custom", suffix: null, saveCopy: null };

  const plan = MEMBERSHIP_PLANS[tier.pricing.planId];
  const monthly = plan.monthlyPrice ?? 0;
  const yearly = plan.yearlyPrice ?? monthly * 12;

  if (period === "monthly") {
    return { display: usd(monthly), suffix: "/ month", saveCopy: null };
  }
  // Annual mode: show the effective monthly cost so the comparison is
  // honest, plus a "billed annually · save X%" badge that reflects the
  // ACTUAL discount baked into the yearly Stripe price.
  const monthlyAnnualEquiv = Math.round(yearly / 12);
  const fullYear = monthly * 12;
  const savePct = fullYear > 0 ? Math.round(((fullYear - yearly) / fullYear) * 100) : 0;
  return {
    display: usd(monthlyAnnualEquiv),
    suffix: "/ month",
    saveCopy: savePct > 0 ? `${usd(yearly)} billed annually · save ${savePct}%` : `${usd(yearly)} billed annually`,
  };
}

export function PricingClient() {
  const [period, setPeriod] = useState<BillingPeriod>("monthly");

  return (
    <div className="relative">
      <div className="pointer-events-none fixed inset-0 z-0 opacity-50">
        <div className="absolute -top-1/4 left-1/4 h-[70vh] w-[55vw] rounded-full bg-gradient-to-br from-violet-500/15 via-indigo-500/10 to-transparent blur-3xl" />
      </div>

      <section className="relative z-10 mx-auto max-w-6xl px-6 md:px-10 pt-20 pb-8">
        <motion.span
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[10px] font-mono uppercase tracking-widest text-indigo-300"
        >
          pricing
        </motion.span>
        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mt-5 text-4xl md:text-6xl font-bold tracking-[-0.04em] leading-[1.05]"
        >
          One team.{" "}
          <span className="bg-gradient-to-r from-indigo-300 to-violet-300 bg-clip-text text-transparent">
            One bill.
          </span>
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-5 max-w-2xl text-[16px] text-zinc-400 leading-relaxed"
        >
          Every tier ships with the full safety contract — approval-only-no-execution,
          closed-union safety, sha-256 rationale rows. Higher tiers unlock more
          operators, more integrations, and stricter approver-role policies.
        </motion.p>

        <div className="mt-8 inline-flex items-center rounded-full border border-white/10 bg-white/[0.02] p-1">
          {(["monthly", "annual"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              aria-pressed={period === p}
              className={[
                "px-3 py-1.5 text-[12px] font-mono uppercase tracking-widest rounded-full transition",
                period === p ? "bg-indigo-500 text-white" : "text-zinc-400 hover:text-white",
              ].join(" ")}
            >
              {p === "annual" ? "annual · save 40%" : "monthly"}
            </button>
          ))}
        </div>
      </section>

      <section className="relative z-10 mx-auto max-w-6xl px-6 md:px-10 pb-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
          {TIERS.map((t, i) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.5, delay: i * 0.05 }}
              className={[
                "relative rounded-2xl border p-5 md:p-6 flex flex-col",
                t.highlight
                  ? "border-indigo-500/40 bg-indigo-500/[0.06] shadow-[0_0_28px_rgba(99,102,241,0.18)]"
                  : "border-white/[0.06] bg-white/[0.02]",
              ].join(" ")}
            >
              {t.highlight ? (
                <span className="absolute -top-2.5 left-5 inline-flex items-center gap-1 rounded-full bg-indigo-500 px-2.5 py-0.5 text-[9.5px] font-mono uppercase tracking-widest text-white shadow-[0_0_18px_rgba(99,102,241,0.45)]">
                  most popular
                </span>
              ) : null}

              <p className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">{t.label}</p>
              {(() => {
                const p = pricingFor(t, period);
                return (
                  <>
                    <p className="mt-3 text-2xl md:text-3xl font-bold tabular-nums">
                      {p.display}
                      {p.suffix ? (
                        <span className="text-[12px] text-zinc-500 font-normal ml-1">{p.suffix}</span>
                      ) : null}
                    </p>
                    {p.saveCopy ? (
                      <p className="mt-1 text-[10.5px] font-mono uppercase tracking-widest text-emerald-300/80">
                        {p.saveCopy}
                      </p>
                    ) : null}
                  </>
                );
              })()}
              <p className="mt-3 text-[12px] text-zinc-400 leading-snug">{t.blurb}</p>

              <ul className="mt-5 space-y-3 flex-1">
                {t.rows.map((r) => (
                  <li key={r.label}>
                    <p className="text-[9.5px] font-mono uppercase tracking-[0.16em] text-zinc-500">
                      {r.label}
                    </p>
                    <p className="mt-1 text-[12.5px] text-zinc-200 leading-snug">
                      {r.value}
                    </p>
                  </li>
                ))}
              </ul>

              {(() => {
                const cta = ctaFor(t.id, period);
                const className = [
                  "mt-6 inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-[12.5px] font-medium transition",
                  t.highlight
                    ? "bg-indigo-500 text-white hover:bg-indigo-400 shadow-[0_0_22px_rgba(99,102,241,0.45)]"
                    : "border border-white/10 text-zinc-200 hover:bg-white/[0.06] hover:border-white/20",
                ].join(" ");
                // External Stripe Payment Links open in a new tab so the
                // operator's pricing-page state is preserved (toggle, scroll).
                // Internal routes (trial / contact) stay client-routed.
                return cta.external ? (
                  <a
                    href={cta.href}
                    className={className}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-stripe-tier={t.id}
                    data-stripe-period={period}
                  >
                    {cta.label}
                  </a>
                ) : (
                  <Link href={cta.href} className={className}>
                    {cta.label}
                  </Link>
                );
              })()}
            </motion.div>
          ))}
        </div>

        {/* Trust strip — clarify checkout vendor + safety contract */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[11px] font-mono uppercase tracking-widest text-zinc-500">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            secure checkout via stripe
          </span>
          <span>cancel anytime</span>
          <span>no setup fee</span>
          <span>vat handled at checkout</span>
        </div>
      </section>

      <SocialProofRail />

      <section className="relative z-10 mx-auto max-w-3xl px-6 md:px-10 pb-20 text-center">
        <h3 className="text-xl md:text-2xl font-semibold tracking-tight">
          Every tier ships with the full safety contract.
        </h3>
        <p className="mt-2 text-[14px] text-zinc-400">
          We don't unlock safety guarantees behind a paywall. If you can sign in, you get approval-only-no-execution.
        </p>
      </section>
    </div>
  );
}
