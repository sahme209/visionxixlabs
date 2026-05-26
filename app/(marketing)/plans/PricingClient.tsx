"use client";

/**
 * Phase 438 — public pricing pivot.
 *
 * REPLACED the prior fixed-plan SaaS cards (Starter $149 / Growth $899
 * / Scale $3,499 + Stripe Payment Links) with engagement-options copy.
 *
 * Real client cost depends on actual cloud usage, AI volume, automation
 * runs, monitoring fan-out, and support level — none of which we can
 * promise on a marketing page. Showing a hard-coded number was at best
 * confusing, at worst misleading once cloud-connected reality didn't
 * match.
 *
 * Public pricing now:
 *   - explains the model (your cloud cost + VisionXIXLabs ops layer)
 *   - offers three engagement shapes WITHOUT hard prices
 *   - routes every CTA to demo / contact / estimate-after-login
 *
 * Stripe Payment Links + MEMBERSHIP_PLANS are NOT removed from the
 * codebase — they still power internal upgrade flows, but no longer
 * appear publicly with a fake hard number.
 */

import { motion } from "framer-motion";
import Link from "next/link";
import { SocialProofRail } from "../_components/SocialProofRail";
import { SpotlightCard } from "@/components/motion/SpotlightCard";

interface EngagementOption {
  id: "starter-assessment" | "growth-operations" | "enterprise-operations";
  label: string;
  /** One-line value claim — what the operator gets out of it. */
  blurb: string;
  /** Best-fit copy — when this option makes sense. */
  bestFor: string;
  /** What's included at a high level — no SLAs, no SKUs. */
  includes: ReadonlyArray<string>;
  /** Visible price strap — never a number. */
  priceStrap: string;
  highlight?: boolean;
}

const OPTIONS: ReadonlyArray<EngagementOption> = [
  {
    id: "starter-assessment",
    label: "Starter Assessment",
    blurb: "Connect one cloud, get an estimate, see your savings surface.",
    bestFor: "Teams kicking the tires — first AWS / Azure / GCP scan, first read of where money is leaking.",
    includes: [
      "Read-only cloud scan",
      "Cost + posture report",
      "Estimate after connection",
      "No commit — exit any time",
    ],
    priceStrap: "Free during trial · usage-aware after",
  },
  {
    id: "growth-operations",
    label: "Growth Operations",
    blurb: "Multi-cloud, scheduled scans, automation runs, and the on-call escalation loop.",
    bestFor: "Operators running multiple workloads — sticky errors page on-call, drafts go through Approval Packets, audit log everywhere.",
    includes: [
      "AWS + Azure + GCP connectors",
      "Scheduled scans + drift detection",
      "Approval-gated automation runs",
      "Alert escalation w/ on-call routing",
      "Slack + email integrations",
    ],
    priceStrap: "Custom — estimate after cloud connection",
    highlight: true,
  },
  {
    id: "enterprise-operations",
    label: "Enterprise Operations",
    blurb: "Self-host, SOC2-aligned, dedicated success manager, signed Terraform.",
    bestFor: "Org-wide rollouts with compliance constraints — RBAC, dual-control gates, dedicated SLA, BYO AI provider.",
    includes: [
      "Self-host option",
      "Dual-control approvals",
      "Custom retention + audit export",
      "Dedicated success manager",
      "SLA + escalation contract",
    ],
    priceStrap: "Quoted per engagement",
  },
];

type CtaKind = "primary" | "secondary";

interface Cta {
  href: string;
  label: string;
  kind: CtaKind;
}

const PRIMARY_CTAS: ReadonlyArray<Cta> = [
  { href: "/demo", label: "Book a demo", kind: "primary" },
  { href: "/contact?topic=quote", label: "Request a quote", kind: "secondary" },
  { href: "/login", label: "Estimate after login", kind: "secondary" },
];

function ctaFor(option: EngagementOption): { href: string; label: string; external: boolean } {
  if (option.id === "enterprise-operations") {
    return { href: "/contact?topic=enterprise", label: "Talk to sales →", external: false };
  }
  return { href: "/demo", label: "Book a demo →", external: false };
}

const FAQ: ReadonlyArray<{ q: string; a: string }> = [
  {
    q: "Why no public price list?",
    a: "Your real cost depends on actual cloud usage, AI volume, automation runs, monitoring fan-out, and support level. A fake fixed number on this page would be wrong the moment you connect a cloud. We'd rather show you a real estimate after a read-only scan.",
  },
  {
    q: "What do I actually pay?",
    a: "Two things: (1) your cloud provider charges you for AWS / Azure / GCP usage directly — that bill is between you and the provider, never marked up by us; (2) VisionXIXLabs charges a platform + operations fee based on what you actually run with us.",
  },
  {
    q: "Can I see the numbers before committing?",
    a: "Yes. Connect one cloud account in read-only mode, let us run a scan, and the estimator surfaces your projected monthly cost — split into the provider line item and our operations layer. No commit required to see it.",
  },
  {
    q: "Is there an enterprise tier?",
    a: "Yes — self-host, dual-control approvals, SOC2-aligned controls, dedicated success manager, signed Terraform. Quoted per engagement.",
  },
  {
    q: "What if I outgrow the estimate?",
    a: "Usage caps are configurable. We warn before you cross a threshold and require approval for the bump — no silent overruns.",
  },
];

export function PricingClient() {
  return (
    <div className="relative">
      {/* Calm ambient atmosphere */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[600px] z-0 overflow-hidden">
        <div className="ambient-drift absolute -top-32 left-1/2 -translate-x-1/2 w-[900px] h-[480px] rounded-full bg-white/[0.04] blur-[140px]" />
      </div>

      {/* Hero ────────────────────────────────────────────────────── */}
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
          Custom pricing,<br />based on your cloud.
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="body-lede text-zinc-400 mt-6 max-w-2xl"
        >
          Your real cost depends on what you run. Connect AWS, Azure, or GCP in read-only mode and we&apos;ll show you the actual numbers — your cloud provider bill plus our operations layer, split out line-by-line.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-10 flex flex-wrap items-center gap-3"
        >
          {PRIMARY_CTAS.map((cta) => (
            <Link
              key={cta.href}
              href={cta.href}
              className={
                cta.kind === "primary"
                  ? "magnetic-sheen inline-flex items-center gap-2 rounded-full px-5 py-3 text-[13.5px] font-medium bg-white text-zinc-950 hover:bg-zinc-100 transition-colors"
                  : "inline-flex items-center gap-2 rounded-full px-5 py-3 text-[13.5px] font-medium border border-white/[0.1] text-zinc-200 hover:bg-white/[0.04] hover:border-white/[0.18] transition-colors"
              }
            >
              {cta.label} →
            </Link>
          ))}
        </motion.div>
      </section>

      {/* Cost model strip ────────────────────────────────────────── */}
      <section className="relative z-10 mx-auto max-w-5xl px-6 md:px-10 pb-12">
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] p-6 md:p-8">
          <p className="kicker-mono">// what you actually pay</p>
          <h2 className="display-headline text-white mt-4">Two line items. Nothing hidden.</h2>
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
              <p className="text-[11px] font-mono uppercase tracking-[0.18em] text-zinc-500 mb-2">1. Your cloud provider</p>
              <p className="text-[14px] text-white font-semibold mb-1">AWS / Azure / GCP usage</p>
              <p className="text-[12.5px] text-zinc-400 leading-relaxed">
                Billed directly by the provider. We never mark this up, and we never re-bill you for it.
              </p>
            </div>
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
              <p className="text-[11px] font-mono uppercase tracking-[0.18em] text-zinc-500 mb-2">2. VisionXIXLabs operations</p>
              <p className="text-[14px] text-white font-semibold mb-1">Platform + AI + automation + support</p>
              <p className="text-[12.5px] text-zinc-400 leading-relaxed">
                One usage-aware bill from us. Platform fee + AI runs + automation runs + monitoring + your support tier.
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="relative z-10 mx-auto max-w-5xl px-6 md:px-10">
        <div className="hairline-divider" />
      </div>

      {/* Engagement options — NO PRICES ─────────────────────────── */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 md:px-10 py-16">
        <div className="text-center mb-12">
          <p className="kicker-mono">Engagement options</p>
          <h2 className="display-headline text-white mt-3">Three shapes. One pricing model.</h2>
          <p className="mt-4 text-[14px] text-zinc-400 max-w-2xl mx-auto">
            Every engagement is usage-aware. The shape changes the depth of automation, the integrations available, and the support contract — not the way you&apos;re billed.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-6 items-stretch">
          {OPTIONS.map((opt, i) => {
            const cta = ctaFor(opt);
            const ctaClass = opt.highlight
              ? "magnetic-sheen w-full inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-[13.5px] font-medium bg-white text-zinc-950 hover:bg-zinc-100 transition-colors"
              : "w-full inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-[13.5px] font-medium border border-white/[0.1] text-zinc-200 hover:bg-white/[0.04] hover:border-white/[0.18] transition-colors";
            return (
              <motion.div
                key={opt.id}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.25 }}
                transition={{ duration: 0.5, delay: i * 0.06 }}
                className={opt.highlight ? "md:scale-[1.03] md:z-10" : ""}
              >
                <SpotlightCard
                  className={[
                    "relative h-full rounded-[20px] bg-[#0a0a0c] flex flex-col p-7",
                    opt.highlight ? "pricing-featured-glow" : "border border-white/[0.06] glow-edge",
                  ].join(" ")}
                >
                  {opt.highlight && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center px-3 py-1 rounded-full bg-white text-zinc-950 text-[9.5px] font-mono uppercase tracking-[0.22em] font-medium z-10">
                      Most common
                    </span>
                  )}

                  <div className="relative z-10 flex-1 flex flex-col">
                    <p className="kicker-mono">{opt.label}</p>

                    <p className="mt-5 text-[15px] text-white leading-snug font-medium">
                      {opt.blurb}
                    </p>

                    <div className="mt-4 inline-flex">
                      <span className="text-[10.5px] font-mono uppercase tracking-[0.18em] text-zinc-500 border border-white/[0.08] rounded-full px-2.5 py-1">
                        {opt.priceStrap}
                      </span>
                    </div>

                    <p className="mt-5 text-[12.5px] text-zinc-400 leading-relaxed">
                      <span className="text-zinc-300">Best for —</span> {opt.bestFor}
                    </p>

                    <div className="my-6 hairline-divider" />

                    <ul className="space-y-3 flex-1">
                      {opt.includes.map((line) => (
                        <li key={line} className="flex items-start gap-2.5">
                          <span aria-hidden className="mt-1.5 w-1 h-1 rounded-full bg-white/40 flex-shrink-0" />
                          <p className="text-[12.5px] text-zinc-200 leading-snug">{line}</p>
                        </li>
                      ))}
                    </ul>

                    <div className="mt-7">
                      <Link href={cta.href} className={ctaClass}>
                        {cta.label}
                      </Link>
                    </div>
                  </div>
                </SpotlightCard>
              </motion.div>
            );
          })}
        </div>

        {/* Trust strip */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-2 text-[11px] font-mono uppercase tracking-[0.22em] text-zinc-500">
          <span className="inline-flex items-center gap-2">
            <span className="status-dot breathe" />
            Read-only cloud connection
          </span>
          <span>No commit during trial</span>
          <span>Usage caps + approval gates</span>
          <span>Cloud bill never marked up</span>
        </div>
      </section>

      <div className="relative z-10 mx-auto max-w-5xl px-6 md:px-10">
        <div className="hairline-divider" />
      </div>

      <SocialProofRail />

      {/* FAQ ──────────────────────────────────────────────────────── */}
      <section className="relative z-10 mx-auto max-w-3xl px-6 md:px-10 pb-24 pt-16">
        <p className="kicker-mono text-center">Common questions</p>
        <h3 className="display-headline text-white mt-3 text-center">
          What people ask before booking a demo.
        </h3>
        <div className="mt-10 space-y-5">
          {FAQ.map((f, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 0.45, delay: i * 0.04 }}
              className="rounded-xl border border-white/[0.06] bg-white/[0.015] p-5"
            >
              <p className="text-[13.5px] text-white font-medium">{f.q}</p>
              <p className="mt-2 text-[13px] text-zinc-400 leading-relaxed">{f.a}</p>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="relative z-10 mx-auto max-w-3xl px-6 md:px-10 pb-24 text-center">
        <p className="kicker-mono">Always included</p>
        <h3 className="display-headline text-white mt-4">
          Every engagement ships with the full safety contract.
        </h3>
        <p className="mt-5 text-[15px] text-zinc-400 leading-relaxed">
          Approval-only-no-execution. Closed-union safety. Audited every transition. Never hidden behind a tier.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/demo"
            className="magnetic-sheen inline-flex items-center gap-2 rounded-full px-5 py-3 text-[13.5px] font-medium bg-white text-zinc-950 hover:bg-zinc-100 transition-colors"
          >
            Book a demo →
          </Link>
          <Link
            href="/contact?topic=quote"
            className="inline-flex items-center gap-2 rounded-full px-5 py-3 text-[13.5px] font-medium border border-white/[0.1] text-zinc-200 hover:bg-white/[0.04] hover:border-white/[0.18] transition-colors"
          >
            Request a quote →
          </Link>
        </div>
      </section>
    </div>
  );
}
