"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useState } from "react";
import { SocialProofRail } from "../_components/SocialProofRail";

type BillingPeriod = "monthly" | "annual";

interface Tier {
  id: "trial" | "starter" | "growth" | "scale" | "enterprise";
  label: string;
  monthlyUsd: number | "contact";
  blurb: string;
  highlight?: boolean;
  rows: ReadonlyArray<{ label: string; value: string }>;
}

// Real Stripe checkout links — overridable per environment, with the
// production fallbacks that were previously held by /operator/pricing.
const STRIPE_LINKS: Record<"starter" | "growth" | "scale", { monthly: string; annual: string }> = {
  starter: {
    monthly: process.env.NEXT_PUBLIC_STRIPE_STARTER_MONTHLY || "https://buy.stripe.com/8x25kE1ARe7gbGrcNX6c000",
    annual:  process.env.NEXT_PUBLIC_STRIPE_STARTER_YEARLY  || "https://buy.stripe.com/bJe14o0wNgfofWH8xH6c003",
  },
  growth: {
    monthly: process.env.NEXT_PUBLIC_STRIPE_GROWTH_MONTHLY  || "https://buy.stripe.com/bJe28s3IZ7ISbGr29j6c001",
    annual:  process.env.NEXT_PUBLIC_STRIPE_GROWTH_YEARLY   || "https://buy.stripe.com/cNidRa4N3fbk5i301b6c004",
  },
  scale: {
    monthly: process.env.NEXT_PUBLIC_STRIPE_SCALE_MONTHLY   || "https://buy.stripe.com/aFa28scfv9R0cKv9BL6c002",
    annual:  process.env.NEXT_PUBLIC_STRIPE_SCALE_YEARLY    || "https://buy.stripe.com/bJeaEY5R77IS8uf5lv6c005",
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
    monthlyUsd: 0,
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
    monthlyUsd: 990,
    blurb: "One workspace, one human approver, every safety contract.",
    rows: [
      { label: "Operators",              value: "3" },
      { label: "Autonomy cycles / day",  value: "1,000" },
      { label: "AI provider chain",      value: "free providers + GitHub Models" },
      { label: "Integrations",           value: "Slack + Teams webhooks" },
      { label: "Compliance packets",     value: "monthly" },
      { label: "Approval-only contract", value: "✓" },
    ],
  },
  {
    id: "growth",
    label: "Growth",
    monthlyUsd: 2900,
    blurb: "Multi-tenant, multi-cloud, SSO, full Outlook + Teams integrations.",
    highlight: true,
    rows: [
      { label: "Operators",              value: "10" },
      { label: "Autonomy cycles / day",  value: "10,000" },
      { label: "AI provider chain",      value: "all 9 free providers + BYO key" },
      { label: "Integrations",           value: "Slack + Teams + Outlook + Gmail + PagerDuty" },
      { label: "Compliance packets",     value: "weekly + on-demand" },
      { label: "Approval-only contract", value: "✓" },
    ],
  },
  {
    id: "scale",
    label: "Scale",
    monthlyUsd: 7900,
    blurb: "Strict-all-roles boundary defaults, data-plane workflows, signed Terraform required.",
    rows: [
      { label: "Operators",              value: "50" },
      { label: "Autonomy cycles / day",  value: "unlimited" },
      { label: "AI provider chain",      value: "all + Cloudflare Workers AI" },
      { label: "Integrations",           value: "all + custom webhook signer" },
      { label: "Compliance packets",     value: "real-time stream" },
      { label: "Approval-only contract", value: "✓ + signed Terraform required" },
    ],
  },
  {
    id: "enterprise",
    label: "Enterprise",
    monthlyUsd: "contact",
    blurb: "Self-host, FedRAMP path, dedicated tenant isolation, audit log streaming.",
    rows: [
      { label: "Operators",              value: "unlimited" },
      { label: "Autonomy cycles / day",  value: "unlimited" },
      { label: "AI provider chain",      value: "self-host any provider" },
      { label: "Integrations",           value: "everything + air-gapped option" },
      { label: "Compliance packets",     value: "continuous + signed by your KMS key" },
      { label: "Approval-only contract", value: "✓ + dual-control gate" },
    ],
  },
];

const ANNUAL_DISCOUNT = 0.85; // 15% off when billed annually
const usd = (n: number): string => `$${n.toLocaleString("en-US")}`;

export function PricingClient() {
  const [period, setPeriod] = useState<BillingPeriod>("monthly");
  const factor = period === "annual" ? ANNUAL_DISCOUNT : 1;

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
              {p === "annual" ? "annual · −15%" : "monthly"}
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
                "rounded-2xl border p-5 flex flex-col",
                t.highlight
                  ? "border-indigo-500/40 bg-indigo-500/[0.06] shadow-[0_0_28px_rgba(99,102,241,0.18)]"
                  : "border-white/[0.06] bg-white/[0.02]",
              ].join(" ")}
            >
              <p className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">{t.label}</p>
              <p className="mt-3 text-2xl md:text-3xl font-bold tabular-nums">
                {t.monthlyUsd === "contact"
                  ? "Custom"
                  : t.monthlyUsd === 0
                  ? "Free"
                  : usd(Math.round(t.monthlyUsd * factor))}
                {typeof t.monthlyUsd === "number" && t.monthlyUsd > 0 && (
                  <span className="text-[12px] text-zinc-500 font-normal ml-1">/ month</span>
                )}
              </p>
              <p className="mt-2 text-[12px] text-zinc-400 leading-snug">{t.blurb}</p>

              <ul className="mt-4 space-y-1.5 flex-1">
                {t.rows.map((r) => (
                  <li key={r.label} className="text-[12px] flex items-start gap-2">
                    <span className="text-emerald-300 mt-[1px]">·</span>
                    <span className="text-zinc-400 w-32 flex-shrink-0">{r.label}</span>
                    <span className="text-zinc-200 font-mono">{r.value}</span>
                  </li>
                ))}
              </ul>

              {(() => {
                const cta = ctaFor(t.id, period);
                const className = [
                  "mt-5 inline-flex items-center justify-center gap-2 rounded-full px-3 py-2 text-[12px] font-medium transition",
                  t.highlight
                    ? "bg-indigo-500 text-white hover:bg-indigo-400"
                    : "border border-white/10 text-zinc-200 hover:bg-white/[0.06]",
                ].join(" ");
                // External Stripe checkout opens in the same tab so the
                // browser back-button returns to the pricing page; internal
                // routes (trial / contact) stay client-routed.
                return cta.external ? (
                  <a href={cta.href} className={className} rel="noopener">
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
