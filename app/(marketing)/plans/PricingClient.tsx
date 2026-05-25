"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useState } from "react";
import { SocialProofRail } from "../_components/SocialProofRail";
import { MEMBERSHIP_PLANS, type MembershipPlanId } from "@/lib/pricing/membership";
import { SpotlightCard } from "@/components/motion/SpotlightCard";

type BillingPeriod = "monthly" | "annual";

// Tier ids on this page = MEMBERSHIP_PLANS ids. Trial product retired —
// new tenants land on the dashboard with no plan and pick a paid tier.
type TierId = MembershipPlanId;

interface Tier {
  id: TierId;
  label: string;
  /**
   * Pricing source of truth:
   *  - "enterprise" → custom
   *  - everything else reads from MEMBERSHIP_PLANS, which matches the
   *    real Stripe Payment Link prices in env.
   */
  pricing: { kind: "custom" } | { kind: "paid"; planId: MembershipPlanId };
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
      {/* Calm ambient atmosphere — single drifting white pool, no aurora. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[600px] z-0 overflow-hidden">
        <div className="ambient-drift absolute -top-32 left-1/2 -translate-x-1/2 w-[900px] h-[480px] rounded-full bg-white/[0.04] blur-[140px]" />
      </div>

      {/* ── Hero ──────────────────────────────────────────────────── */}
      <section className="relative z-10 mx-auto max-w-5xl px-6 md:px-10 pt-24 pb-12">
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="kicker-mono"
        >
          Pricing
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="display-headline-lg text-white mt-5"
        >
          One team. One bill.
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="body-lede text-zinc-400 mt-6 max-w-2xl"
        >
          Every tier ships with the full safety contract — approval-only-no-execution, closed-union safety, sha-256 rationale rows. Higher tiers unlock more operators, more integrations, and stricter approver-role policies.
        </motion.p>

        {/* Billing toggle — calm pill, white selected state, no indigo glow */}
        <div className="mt-10 inline-flex items-center rounded-full border border-white/[0.08] bg-white/[0.015] p-1">
          {(["monthly", "annual"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              aria-pressed={period === p}
              className={[
                "px-4 py-1.5 text-[12px] font-mono uppercase tracking-[0.22em] rounded-full transition-colors",
                period === p ? "bg-white text-zinc-950" : "text-zinc-400 hover:text-white",
              ].join(" ")}
            >
              {p === "annual" ? "Annual · save 40%" : "Monthly"}
            </button>
          ))}
        </div>
      </section>

      {/* ── Hairline before the tiers ─────────────────────────────── */}
      <div className="relative z-10 mx-auto max-w-5xl px-6 md:px-10">
        <div className="hairline-divider" />
      </div>

      {/* ── Tiers — huly.io vertical full-width row layout ────────── */}
      <section className="relative z-10 mx-auto max-w-5xl px-6 md:px-10 py-12">
        <div className="flex flex-col gap-3">
          {TIERS.map((t, i) => {
            const p = pricingFor(t, period);
            const cta = ctaFor(t.id, period);
            const ctaClass = "magnetic-sheen inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-[14px] font-medium bg-white text-zinc-950 hover:bg-zinc-100 transition-colors whitespace-nowrap";
            return (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.25 }}
                transition={{ duration: 0.5, delay: i * 0.06 }}
              >
                <SpotlightCard
                  className={[
                    "glow-edge relative rounded-2xl border bg-white/[0.012] px-6 md:px-8 py-7 md:py-8 transition-colors hover:border-white/[0.12]",
                    t.highlight ? "border-white/[0.14]" : "border-white/[0.05]",
                  ].join(" ")}
                >
                  {t.highlight ? (
                    <span className="absolute -top-3 left-8 inline-flex items-center px-3 py-1 rounded-full bg-white text-zinc-950 text-[9.5px] font-mono uppercase tracking-[0.22em] font-medium">
                      Most popular
                    </span>
                  ) : null}

                  <div className="grid grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)_220px] gap-x-10 gap-y-6 items-start relative z-10">
                    {/* Column 1 — name + blurb */}
                    <div>
                      <p className="kicker-mono">{t.label}</p>
                      <p className="mt-3 text-[14.5px] text-zinc-300 leading-relaxed">
                        {t.blurb}
                      </p>
                    </div>

                    {/* Column 2 — features in 2-column dense grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3.5 lg:border-l lg:border-white/[0.05] lg:pl-10">
                      {t.rows.map((r) => (
                        <div key={r.label}>
                          <p className="text-[9.5px] font-mono uppercase tracking-[0.18em] text-zinc-500">
                            {r.label}
                          </p>
                          <p className="mt-1 text-[12.5px] text-zinc-200 leading-snug">
                            {r.value}
                          </p>
                        </div>
                      ))}
                    </div>

                    {/* Column 3 — price + CTA */}
                    <div className="lg:text-right lg:border-l lg:border-white/[0.05] lg:pl-10 flex flex-col lg:items-end">
                      <p className="text-[34px] md:text-[38px] font-medium tabular-nums text-white leading-none">
                        {p.display}
                        {p.suffix ? (
                          <span className="text-[12px] text-zinc-500 font-normal ml-1">{p.suffix}</span>
                        ) : null}
                      </p>
                      {p.saveCopy ? (
                        <p className="mt-1.5 text-[10.5px] font-mono uppercase tracking-[0.18em] text-zinc-500">
                          {p.saveCopy}
                        </p>
                      ) : null}
                      <div className="mt-5 w-full lg:w-auto">
                        {cta.external ? (
                          <a
                            href={cta.href}
                            className={ctaClass}
                            target="_blank"
                            rel="noopener noreferrer"
                            data-stripe-tier={t.id}
                            data-stripe-period={period}
                          >
                            {cta.label}
                          </a>
                        ) : (
                          <Link href={cta.href} className={ctaClass}>
                            {cta.label}
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                </SpotlightCard>
              </motion.div>
            );
          })}
        </div>

        {/* Trust strip — quieter mono row, no green dot */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-2 text-[11px] font-mono uppercase tracking-[0.22em] text-zinc-500">
          <span className="inline-flex items-center gap-2">
            <span className="status-dot breathe" />
            Secure checkout via Stripe
          </span>
          <span>Cancel anytime</span>
          <span>No setup fee</span>
          <span>VAT handled at checkout</span>
        </div>
      </section>

      <div className="relative z-10 mx-auto max-w-5xl px-6 md:px-10">
        <div className="hairline-divider" />
      </div>

      <SocialProofRail />

      <section className="relative z-10 mx-auto max-w-3xl px-6 md:px-10 pb-24 pt-16 text-center">
        <p className="kicker-mono">Always included</p>
        <h3 className="display-headline text-white mt-4">
          Every tier ships with the full safety contract.
        </h3>
        <p className="mt-5 text-[15px] text-zinc-400 leading-relaxed">
          We don&apos;t unlock safety guarantees behind a paywall. If you can sign in, you get approval-only-no-execution.
        </p>
      </section>
    </div>
  );
}
