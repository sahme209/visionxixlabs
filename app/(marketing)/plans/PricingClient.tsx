"use client";

/**
 * Public pricing page — explanatory, not card-gated.
 *
 * Phase 438 first removed the misleading fixed numbers. This pass
 * removes the "book a demo to find out" wall: visitors get a full
 * explanation of the pricing model right here, with optional CTAs
 * (not required gates).
 *
 * The model: client pays (1) their actual cloud provider bill,
 * unchanged, billed by the provider — plus (2) a usage-aware
 * VisionXIXLabs operations fee. This page explains both buckets
 * in plain language and lists exactly what we charge for.
 *
 * No hard numbers on this page — every dollar amount depends on
 * scanned usage. But every category is named, every charge basis is
 * explained, and the estimate flow is described step-by-step so a
 * visitor can decide whether to engage without a sales call.
 */

import { motion } from "framer-motion";
import Link from "next/link";
import { SocialProofRail } from "../_components/SocialProofRail";

/* ──────────────────────────────────────────────────────────────────
   Content tables.
   ────────────────────────────────────────────────────────────── */

interface ChargeCategory {
  label: string;
  basis: string;
  example: string;
}

const VXL_CHARGES: ReadonlyArray<ChargeCategory> = [
  {
    label: "Platform base",
    basis: "Monthly fee for access to the platform.",
    example: "Covers dashboard, audit log, security baseline, and read-only scans.",
  },
  {
    label: "Workspace seats",
    basis: "Per active operator on the workspace.",
    example: "Only counted on humans who actually sign in during the billing period.",
  },
  {
    label: "AI engineers enabled",
    basis: "Per AI engineer (Cloud, Incident, Security, FinOps, etc.) you activate.",
    example: "You only pay for the agents you turn on; unused agents are zero.",
  },
  {
    label: "Automation runs",
    basis: "Per workflow / remediation script / Terraform plan execution.",
    example: "First N runs included at each engagement level; overage metered.",
  },
  {
    label: "AI usage",
    basis: "Per million tokens to OpenAI / Anthropic / your-own provider.",
    example: "Included quota covers normal operations; heavy use is metered and capped.",
  },
  {
    label: "Monitoring volume",
    basis: "Per GB of logs / metrics / traces ingested by the platform.",
    example: "Scoped to what we actually store; you can exclude noisy sources.",
  },
  {
    label: "Cloud management",
    basis: "Percentage of cloud spend OR per managed resource — whichever is lower.",
    example: "We never charge more than the rule that benefits you more.",
  },
  {
    label: "Support / managed ops",
    basis: "Tier-based: self-serve, business hours, 24/7, dedicated success manager.",
    example: "You pick the level. No hidden minimums.",
  },
  {
    label: "Enterprise custom",
    basis: "Bespoke line items for self-host, dual-control, custom retention.",
    example: "Only on enterprise engagements; everything is itemized.",
  },
];

interface EstimateStep {
  n: number;
  label: string;
  detail: string;
}

const ESTIMATE_FLOW: ReadonlyArray<EstimateStep> = [
  { n: 1, label: "Sign in",                 detail: "Create a workspace. No card required to look around." },
  { n: 2, label: "Connect a cloud (read-only)", detail: "AWS / Azure / GCP — read-only, no write scopes ever asked for." },
  { n: 3, label: "Discovery scan",          detail: "We scan resources, services, regions, and recent usage. No data leaves your control." },
  { n: 4, label: "Estimate appears",        detail: "Cloud provider line items + VisionXIXLabs operations layer, side by side." },
  { n: 5, label: "Pick a service level",    detail: "Adjust what's enabled — AI engineers, automation depth, monitoring scope, support tier." },
  { n: 6, label: "Approve the quote",       detail: "Usage caps and approval gates land before activation. No surprise overruns." },
];

interface EngagementShape {
  label: string;
  whoFor: string;
  typical: string;
  whatYouGet: ReadonlyArray<string>;
  charge: string;
}

const ENGAGEMENTS: ReadonlyArray<EngagementShape> = [
  {
    label: "Starter Assessment",
    whoFor: "Single team, one cloud, kicking the tires.",
    typical: "First scan, find the wasted-spend surface, see what observability looks like.",
    whatYouGet: [
      "Read-only AWS / Azure / GCP scan",
      "Cost + posture report",
      "FinOps recommendations queue (drafts only)",
      "Slack integration",
    ],
    charge: "Free during trial · usage-aware after activation.",
  },
  {
    label: "Growth Operations",
    whoFor: "Operators running multiple workloads or multiple clouds.",
    typical: "Scheduled scans, automation runs, on-call alerting, approval-gated remediation.",
    whatYouGet: [
      "AWS + Azure + GCP connectors",
      "Scheduled scans + drift detection",
      "Approval-gated automation",
      "Sticky-error → on-call alert escalation",
      "Slack + email + webhook integrations",
    ],
    charge: "Custom — estimate after cloud connection. Platform base + metered VxL line items.",
  },
  {
    label: "Enterprise Operations",
    whoFor: "Compliance-constrained org-wide rollouts.",
    typical: "Self-hosted, dual-control, signed Terraform, dedicated success manager, SLA contract.",
    whatYouGet: [
      "Self-host option",
      "Dual-control approvals",
      "Custom retention + audit export",
      "RBAC and SAML",
      "Dedicated SLA + escalation contract",
    ],
    charge: "Quoted per engagement. Itemized bespoke line items.",
  },
];

interface SafetyRule {
  label: string;
  detail: string;
}

const SAFETY_RULES: ReadonlyArray<SafetyRule> = [
  {
    label: "Cloud bill never marked up",
    detail: "Your AWS / Azure / GCP charges are billed by the provider, full stop. We never touch your provider bill or add a percentage.",
  },
  {
    label: "Usage caps with approval gates",
    detail: "Every metered category has a configurable cap. When usage approaches the cap, we surface a warning. You approve any bump before it lands.",
  },
  {
    label: "No unlimited AI claims",
    detail: "AI usage is metered. You can see exactly how many tokens were consumed, by which agent, for which task. Heavy use has a hard cap.",
  },
  {
    label: "No silent overruns",
    detail: "If a forecast risks exceeding your cap, the platform pauses the metered category and asks for approval before continuing.",
  },
  {
    label: "Quotes are itemized",
    detail: "Every quote breaks out cloud line items, VxL line items, and assumptions. You see how each number was reached.",
  },
  {
    label: "Estimates are clearly labeled",
    detail: "Prices pulled from cached or estimated catalogs are flagged. Sandbox-only prices can never be used in a real quote.",
  },
];

interface FaqEntry {
  q: string;
  a: string;
}

const FAQ: ReadonlyArray<FaqEntry> = [
  {
    q: "Why no public price list?",
    a: "Real cost depends on actual cloud usage, AI volume, automation runs, monitoring fan-out, and support level. A fixed number on this page would be wrong the moment you connected a cloud. So we let you connect first and see the real estimate.",
  },
  {
    q: "What do I actually pay?",
    a: "Two line items. (1) Your cloud provider bill — AWS, Azure, or GCP — paid directly to them, never marked up by us. (2) A VisionXIXLabs operations bill from us, which is a usage-aware sum of the categories listed above.",
  },
  {
    q: "Can I see numbers without talking to sales?",
    a: "Yes. Sign in, connect a cloud in read-only mode, let the discovery scan run. The estimator inside the app shows your projected monthly cost split by line item.",
  },
  {
    q: "Do I have to commit to see the estimate?",
    a: "No. The trial supports a read-only scan with no card. You see the estimate, decide whether the operations layer is worth it, then activate the service tiers you want.",
  },
  {
    q: "What's the smallest realistic VxL operations bill?",
    a: "Platform base + minimal AI usage + a single connector. Real number depends on your workspace, but it's the same shape: platform base, then metered categories at low volume.",
  },
  {
    q: "What's the most expensive line item usually?",
    a: "It varies. For small workloads, the platform base dominates. For high-traffic accounts with large log/metric volumes, monitoring tends to be the biggest VxL line. For automation-heavy workflows, it's automation runs + AI usage.",
  },
  {
    q: "What if my usage spikes?",
    a: "Every metered category has a cap. The platform warns you before approaching it and pauses the metered category if a forecast would breach it. You always approve any bump.",
  },
  {
    q: "Is there an enterprise tier?",
    a: "Yes — self-host, dual-control approvals, custom retention, SAML/RBAC, dedicated success manager. Quoted per engagement and every line item is itemized.",
  },
];

/* ──────────────────────────────────────────────────────────────────
   Component.
   ────────────────────────────────────────────────────────────── */

export function PricingClient() {
  return (
    <div className="relative">
      {/* Calm ambient atmosphere */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[600px] z-0 overflow-hidden">
        <div className="ambient-drift absolute -top-32 left-1/2 -translate-x-1/2 w-[900px] h-[480px] rounded-full bg-white/[0.04] blur-[140px]" />
      </div>

      {/* Hero ────────────────────────────────────────────────────── */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 md:px-10 pt-24 pb-12">
        <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="kicker-mono">
          Pricing
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="display-headline-lg text-white mt-5"
        >
          Custom pricing,<br />based on your cloud.
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="body-lede text-zinc-400 mt-6"
        >
          We don&apos;t publish hard SaaS prices because the real number depends on what you run. This page explains exactly how the pricing model works, what we charge for, and how the estimate is calculated — no demo required.
        </motion.p>
      </section>

      {/* The model — two-bucket explanation ──────────────────────── */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 md:px-10 pb-16">
        <p className="kicker-mono">// the pricing model</p>
        <h2 className="display-headline text-white mt-4">Two buckets. Nothing hidden.</h2>
        <p className="mt-4 text-[14px] text-zinc-400 leading-relaxed">
          Your monthly cost is the sum of two clean line items. We make it visually obvious so you can audit it line by line.
        </p>

        <div className="mt-8 space-y-4">
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6">
            <div className="flex items-baseline gap-3 mb-2">
              <span className="text-[11px] font-mono uppercase tracking-[0.18em] text-zinc-500">Bucket 1</span>
              <h3 className="text-[16px] text-white font-semibold">Your cloud provider</h3>
            </div>
            <p className="text-[13.5px] text-zinc-300 leading-relaxed">
              AWS, Azure, or GCP charges you directly for the compute, storage, networking, and managed services you actually use. That bill is between you and the provider. <span className="text-white font-medium">We never mark it up. We never re-bill it. We never touch your provider invoice.</span>
            </p>
          </div>

          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6">
            <div className="flex items-baseline gap-3 mb-2">
              <span className="text-[11px] font-mono uppercase tracking-[0.18em] text-zinc-500">Bucket 2</span>
              <h3 className="text-[16px] text-white font-semibold">VisionXIXLabs operations</h3>
            </div>
            <p className="text-[13.5px] text-zinc-300 leading-relaxed">
              One usage-aware bill from us — platform access, AI engineers, automation runs, monitoring volume, and your chosen support tier. Each category is metered separately so you see exactly what drives the total.
            </p>
          </div>
        </div>
      </section>

      <div className="relative z-10 mx-auto max-w-6xl px-6 md:px-10">
        <div className="hairline-divider" />
      </div>

      {/* What VxL charges for — full breakdown ───────────────────── */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 md:px-10 py-16">
        <p className="kicker-mono">// what visionxixlabs charges for</p>
        <h2 className="display-headline text-white mt-4">Every line item, explained.</h2>
        <p className="mt-4 text-[14px] text-zinc-400 leading-relaxed">
          The VxL operations bill is the sum of these nine categories. You only pay for the ones you actually use; unused categories are zero.
        </p>

        <div className="mt-8 rounded-2xl border border-white/[0.06] bg-white/[0.015] overflow-hidden">
          {VXL_CHARGES.map((c, i) => (
            <div
              key={c.label}
              className={[
                "p-5 md:p-6 grid grid-cols-1 md:grid-cols-[200px_1fr] gap-3 md:gap-6",
                i > 0 ? "border-t border-white/[0.05]" : "",
              ].join(" ")}
            >
              <div>
                <p className="text-[13.5px] text-white font-semibold">{c.label}</p>
              </div>
              <div>
                <p className="text-[13px] text-zinc-300 leading-relaxed">{c.basis}</p>
                <p className="mt-1.5 text-[12px] text-zinc-500 leading-relaxed">{c.example}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="relative z-10 mx-auto max-w-6xl px-6 md:px-10">
        <div className="hairline-divider" />
      </div>

      {/* How the estimate works — numbered flow ──────────────────── */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 md:px-10 py-16">
        <p className="kicker-mono">// how the estimate works</p>
        <h2 className="display-headline text-white mt-4">Sign in. Connect. See real numbers.</h2>
        <p className="mt-4 text-[14px] text-zinc-400 leading-relaxed">
          Six steps. No sales call required. The whole flow is reversible — disconnect any time, and the read-only scope means we never had write access in the first place.
        </p>

        <ol className="mt-8 space-y-4">
          {ESTIMATE_FLOW.map((s) => (
            <motion.li
              key={s.n}
              initial={{ opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 0.4, delay: s.n * 0.04 }}
              className="rounded-xl border border-white/[0.06] bg-white/[0.015] p-5 flex items-start gap-4"
            >
              <span className="text-[11px] font-mono text-zinc-500 mt-1 shrink-0 w-6 text-center tabular-nums">
                {String(s.n).padStart(2, "0")}
              </span>
              <div className="flex-1">
                <p className="text-[14px] text-white font-medium">{s.label}</p>
                <p className="mt-1 text-[12.5px] text-zinc-400 leading-relaxed">{s.detail}</p>
              </div>
            </motion.li>
          ))}
        </ol>
      </section>

      <div className="relative z-10 mx-auto max-w-6xl px-6 md:px-10">
        <div className="hairline-divider" />
      </div>

      {/* Engagement shapes — explanatory paragraphs, not cards ───── */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 md:px-10 py-16">
        <p className="kicker-mono">// engagement shapes</p>
        <h2 className="display-headline text-white mt-4">Three common shapes.</h2>
        <p className="mt-4 text-[14px] text-zinc-400 leading-relaxed">
          Same pricing model for all three — the shape only changes how deep the operations layer goes and how strict the support contract is.
        </p>

        <div className="mt-8 space-y-6">
          {ENGAGEMENTS.map((e) => (
            <motion.div
              key={e.label}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.45 }}
              className="rounded-2xl border border-white/[0.06] bg-white/[0.015] p-6"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-3 mb-4">
                <h3 className="text-[16px] text-white font-semibold">{e.label}</h3>
                <span className="text-[10.5px] font-mono uppercase tracking-[0.18em] text-zinc-500 border border-white/[0.08] rounded-full px-2.5 py-1">
                  {e.charge}
                </span>
              </div>
              <p className="text-[13px] text-zinc-300 leading-relaxed">
                <span className="text-zinc-400">Who it&apos;s for —</span> {e.whoFor}
              </p>
              <p className="mt-2 text-[13px] text-zinc-300 leading-relaxed">
                <span className="text-zinc-400">Typical use —</span> {e.typical}
              </p>
              <div className="mt-4">
                <p className="text-[10.5px] font-mono uppercase tracking-[0.18em] text-zinc-500 mb-2">// what's included</p>
                <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1.5">
                  {e.whatYouGet.map((line) => (
                    <li key={line} className="flex items-start gap-2.5 text-[12.5px] text-zinc-200">
                      <span aria-hidden className="mt-1.5 w-1 h-1 rounded-full bg-white/40 flex-shrink-0" />
                      <span className="leading-snug">{line}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      <div className="relative z-10 mx-auto max-w-6xl px-6 md:px-10">
        <div className="hairline-divider" />
      </div>

      {/* Pricing safety — usage caps, no-overrun rules ───────────── */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 md:px-10 py-16">
        <p className="kicker-mono">// pricing safety</p>
        <h2 className="display-headline text-white mt-4">Six rules we don&apos;t break.</h2>
        <p className="mt-4 text-[14px] text-zinc-400 leading-relaxed">
          The pricing model only works if it&apos;s predictable. These are the guarantees the platform enforces, audited per workspace.
        </p>

        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
          {SAFETY_RULES.map((r) => (
            <div key={r.label} className="rounded-xl border border-white/[0.06] bg-white/[0.015] p-5">
              <p className="text-[13.5px] text-white font-semibold mb-1.5">{r.label}</p>
              <p className="text-[12.5px] text-zinc-400 leading-relaxed">{r.detail}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="relative z-10 mx-auto max-w-6xl px-6 md:px-10">
        <div className="hairline-divider" />
      </div>

      <SocialProofRail />

      {/* FAQ ──────────────────────────────────────────────────────── */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 md:px-10 pb-16 pt-16">
        <p className="kicker-mono">// common questions</p>
        <h2 className="display-headline text-white mt-4">What people ask first.</h2>

        <div className="mt-8 space-y-4">
          {FAQ.map((f, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 6 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.5 }}
              transition={{ duration: 0.35, delay: i * 0.025 }}
              className="rounded-xl border border-white/[0.06] bg-white/[0.015] p-5"
            >
              <p className="text-[13.5px] text-white font-medium">{f.q}</p>
              <p className="mt-2 text-[13px] text-zinc-400 leading-relaxed">{f.a}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Soft footer — optional next steps, not gates ────────────── */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 md:px-10 pb-24 pt-8">
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] p-6 md:p-8">
          <p className="kicker-mono">// when you&apos;re ready</p>
          <h3 className="display-headline text-white mt-3">No pressure. Pick whichever fits.</h3>
          <p className="mt-4 text-[13.5px] text-zinc-400 leading-relaxed">
            Three paths. None of them are required to read this page.
          </p>
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-3 text-[13px]">
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <p className="text-white font-medium mb-1">See your real estimate</p>
              <p className="text-zinc-400 text-[12.5px] leading-relaxed mb-3">Sign in, connect a cloud read-only, let the scan run.</p>
              <Link href="/login" className="text-[12.5px] text-zinc-200 hover:text-white underline underline-offset-4 decoration-white/30">
                Estimate after login →
              </Link>
            </div>
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <p className="text-white font-medium mb-1">Want a tailored quote</p>
              <p className="text-zinc-400 text-[12.5px] leading-relaxed mb-3">Tell us your stack, we&apos;ll write a quote you can audit.</p>
              <Link href="/contact?topic=quote" className="text-[12.5px] text-zinc-200 hover:text-white underline underline-offset-4 decoration-white/30">
                Request a quote →
              </Link>
            </div>
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <p className="text-white font-medium mb-1">Walk through with us</p>
              <p className="text-zinc-400 text-[12.5px] leading-relaxed mb-3">Live demo on a real workspace. Optional.</p>
              <Link href="/demo" className="text-[12.5px] text-zinc-200 hover:text-white underline underline-offset-4 decoration-white/30">
                Book a demo →
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
