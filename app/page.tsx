"use client";

import Link from "next/link";
import {
  ArrowRightIcon,
  MagnifyingGlassIcon,
  CpuChipIcon,
  ShieldCheckIcon,
} from "@heroicons/react/24/outline";
import { Navigation } from "../components/Navigation";
import { EnterpriseTrustSignals } from "@/components/EnterpriseTrustSignals";
import { AnimateOnScroll } from "@/components/AnimateOnScroll";
import { ServicePipeline } from "@/components/ServicePipeline";
import { Reveal } from "@/components/motion/Reveal";
import { Stagger } from "@/components/motion/Stagger";
import { SpotlightCard } from "@/components/motion/SpotlightCard";
import { ScrollRevealText } from "@/components/motion/ScrollRevealText";
import { FeatureRow } from "@/components/marketing/FeatureRow";
import { CountUp } from "@/components/motion/CountUp";
import { TextReveal } from "@/components/motion/TextReveal";
import { FAQAccordion } from "@/components/FAQAccordion";
import { DesktopShowcase } from "@/components/home/DesktopShowcase";
import { MobileHome } from "@/components/home/MobileHome";
import { HomepageDemoAnimation } from "@/components/marketing/HomepageDemoAnimation";
import { Footer } from "@/components/Footer";
import { primaryCta, secondaryCta, fallbackCta } from "@/lib/product/ctaMap";

const axiomFAQ = [
  {
    question: "What does Axiom actually do?",
    answer:
      "Axiom Agent is a downloadable operations workspace for release and cloud teams. It captures deployment intake, runs readiness checks, builds versioned playbooks, coordinates approvals, guides execution, validates outcomes, and collects evidence for closure. AWS connectivity uses an assume-role model; availability for every provider and action is shown in the product.",
  },
  {
    question: "Does Axiom modify my infrastructure?",
    answer:
      "Axiom separates analysis from write actions and requires the configured approval policy before an execution step can proceed. Generated Terraform and CLI artifacts remain reviewable. Local Terraform apply is disabled until the approval architecture is fully verified; failed or unavailable operations must remain visible as failures, not simulated success.",
  },
  {
    question: "What clouds are supported?",
    answer:
      "AWS has an implemented assume-role connection that requires customer and broker configuration; its current inventory and security scan are preview-grade, and generated execution artifacts remain dry-run/review only. Azure and GCP currently provide credential-format validation and preview analysis. Their live SDK validation and provider-specific execution paths are not released.",
  },
  {
    question: "How does Axiom keep my infrastructure safe?",
    answer:
      "Axiom uses a governance framework with trust levels, blast radius limits, approval gates, and compliance policies. The agent can never self-escalate its own autonomy level. High-risk changes always require human approval.",
  },
  {
    question: "How long does setup take?",
    answer:
      "Setup time depends on your identity provider, permissions, and integrations. Install the app, authenticate through the secure desktop flow, configure an AWS assume-role or another available connector, verify access, and review the first readiness result before enabling operational actions.",
  },
  {
    question: "What access does Axiom need?",
    answer:
      "Axiom uses an assume-role model — you create a read-only IAM role in your AWS account and we assume it to scan. No access keys are stored. You can revoke access anytime from your AWS console.",
  },
  {
    question: "Does Axiom learn from past actions?",
    answer:
      "The application-side outcome-memory module records success and failure metadata in the audit store and can downgrade a recommendation when the same resource has failed before. Its retention and deletion controls are not yet complete, and this behavior has not been verified as an end-to-end released desktop workflow.",
  },
];

const TRUST_LOGOS = [
  "Assume-role AWS access", "Explicit approval gates", "Persisted audit history", "Redacted operational logs",
  "Workspace isolation", "Feature-gated connectors", "Human-confirmed AI output", "Terraform artifact review",
  "Isolated sample-data sandbox", "No browser control plane",
];

const HERO_ASSURANCES = [
  ["01", "Human approval"],
  ["02", "Visible execution"],
  ["03", "Audit-ready evidence"],
] as const;

const HERO_FRAME_METADATA = [
  ["Control", "Approval gated"],
  ["State", "Explicit outcomes"],
  ["Evidence", "Persisted trail"],
] as const;

const PROVIDER_AVAILABILITY = [
  { id: "aws", shortName: "AWS", displayName: "Amazon Web Services", detail: "Connection implemented · customer configuration required", tone: "bg-amber-400" },
  { id: "azure", shortName: "AZ", displayName: "Microsoft Azure", detail: "Format validation + preview analysis · execution planned", tone: "bg-zinc-500" },
  { id: "gcp", shortName: "GCP", displayName: "Google Cloud", detail: "Format validation + preview analysis · execution planned", tone: "bg-zinc-500" },
] as const;

/* ── Section divider — coral-tinted hairline with center diamond, Huly-style */
function SectionDivider() {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
      <div className="hairline-divider-coral" />
    </div>
  );
}

export default function Home() {
  return (
    <div className="min-h-screen bg-[#0a0a0d] text-white relative">
      <div className="absolute inset-0 bg-grid-mesh opacity-[0.08] pointer-events-none" aria-hidden />
      <div className="relative z-10">
      <Navigation />

      <MobileHome />
      <div className="hidden md:block">

      {/* ── Hero ───────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden px-6 pb-24 pt-32 lg:px-10 lg:pb-28 lg:pt-36">
        <div className="absolute inset-0 hero-grid-mesh opacity-[0.08] pointer-events-none" aria-hidden />
        <div className="hero-atmosphere pointer-events-none absolute inset-0" aria-hidden />
        <div className="hero-noise-grain opacity-[0.14]" aria-hidden />

        <div className="relative mx-auto max-w-[1400px]">
          <div className="grid items-center gap-16 xl:grid-cols-[minmax(0,0.92fr)_minmax(560px,1.08fr)] xl:gap-20">
            <div className="relative z-10 max-w-[690px]">
              <Reveal direction="up" blur>
                <div className="mb-7 flex items-center gap-3">
                  <span className="h-1.5 w-1.5 rounded-full bg-brand-coral shadow-[0_0_16px_rgba(244,114,182,0.7)]" />
                  <p className="mono-label text-zinc-400">
                    Axiom <span className="mx-1.5 text-zinc-600">·</span> Deployment operations workspace
                  </p>
                </div>
              </Reveal>

              <h1 className="mb-8 max-w-[670px] font-display text-[clamp(3.4rem,4.4vw,4.8rem)] font-medium leading-[0.98] tracking-[-0.052em] text-white">
                <TextReveal text="Your request" splitBy="word" stagger={80} startDelay={100} className="block" />
                <TextReveal text="becomes the" splitBy="word" stagger={80} startDelay={280} className="block text-zinc-100" />
                <span className="relative inline-block pb-2">
                  <TextReveal text="playbook." splitBy="word" stagger={80} startDelay={440} />
                  <span aria-hidden className="absolute bottom-0.5 left-0 h-px w-[72%] bg-gradient-to-r from-brand-coral via-violet-400/70 to-transparent" />
                </span>
              </h1>

              <Reveal direction="up" delay={0.06}>
                <p className="max-w-[620px] text-[18px] leading-[1.58] tracking-[-0.012em] text-zinc-400">
                  Turn deployment intake into a versioned, approval-gated playbook—then guide execution, validate production, and preserve the evidence required to close with confidence.
                </p>
              </Reveal>

              <Reveal direction="up" delay={0.12}>
                <div className="relative z-20 mt-9 flex flex-wrap items-center gap-4">
                  <Link href="/download" className="btn-press inline-flex min-h-12 items-center justify-center gap-2.5 rounded-full px-7 py-3.5 text-[14.5px] font-semibold tracking-tight">
                    Download Axiom Agent
                    <ArrowRightIcon className="h-4 w-4 opacity-60" />
                  </Link>
                  <Link href="/demo" className="btn-ghost-press inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-6 py-3.5 text-[14px] font-medium tracking-tight">
                    Explore the isolated demo
                  </Link>
                </div>
              </Reveal>

              <Reveal direction="up" delay={0.18}>
                <div className="mt-10 grid max-w-[620px] grid-cols-3 border-y border-white/[0.07] py-5">
                  {HERO_ASSURANCES.map(([number, label], index) => (
                    <div key={number} className={`min-w-0 ${index > 0 ? "border-l border-white/[0.07] pl-5" : "pr-5"}`}>
                      <span className="block text-[10px] font-mono tracking-[0.18em] text-brand-coral/80">{number}</span>
                      <span className="mt-1.5 block text-[12px] font-medium leading-snug text-zinc-300">{label}</span>
                    </div>
                  ))}
                </div>
              </Reveal>
            </div>

            <Reveal direction="up" delay={0.12}>
              <div className="relative hidden xl:block">
                <div className="absolute -inset-12 -z-10 rounded-full bg-violet-500/[0.08] blur-[90px]" aria-hidden />
                <SpotlightCard className="hero-product-shell overflow-hidden rounded-[28px] p-2.5">
                  <div className="flex items-center justify-between px-4 pb-3 pt-2">
                    <div>
                      <p className="text-[11px] font-semibold tracking-[-0.01em] text-zinc-200">Axiom Agent walkthrough</p>
                      <p className="mt-0.5 text-[10px] text-zinc-500">Installed workspace · illustrative data</p>
                    </div>
                    <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/15 bg-emerald-400/[0.06] px-3 py-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 shadow-[0_0_10px_rgba(110,231,183,0.65)]" />
                      <span className="text-[9px] font-mono uppercase tracking-[0.16em] text-emerald-200/80">Sample workspace</span>
                    </div>
                  </div>
                  <HomepageDemoAnimation />
                  <div className="grid grid-cols-3 gap-px overflow-hidden rounded-b-[18px] bg-white/[0.06]">
                    {HERO_FRAME_METADATA.map(([label, value]) => (
                      <div key={label} className="bg-[#0c0c0f] px-4 py-3">
                        <span className="block text-[9px] font-mono uppercase tracking-[0.16em] text-zinc-600">{label}</span>
                        <span className="mt-1 block text-[11px] font-medium text-zinc-300">{value}</span>
                      </div>
                    ))}
                  </div>
                </SpotlightCard>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── Section Divider ────────────────────────────────────────── */}
      <SectionDivider />

      {/* ── Desktop Showcase (Huly-style big product reveal) ──────── */}
      <DesktopShowcase />

      {/* ── Section Divider ────────────────────────────────────────── */}
      <SectionDivider />

      {/* ── Trust Marquee ──────────────────────────────────────────── */}
      <section className="py-12 overflow-hidden relative">
        <div className="absolute inset-0 bg-white/[0.01] pointer-events-none" aria-hidden />
        {/* Coral hairlines at top + bottom of the marquee, fading at edges */}
        <div aria-hidden className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-coral/25 to-transparent" />
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-brand-violet/25 to-transparent" />
        <div className="relative">
          <p className="text-center text-[10px] font-mono uppercase tracking-[0.22em] text-zinc-500 mb-5">
            Trust posture <span className="text-zinc-700 mx-1">·</span> baked-in safety primitives
          </p>
          <div className="relative overflow-hidden">
            {/* Fade masks on left/right so the marquee scrolls in/out softly */}
            <div aria-hidden className="absolute left-0 top-0 bottom-0 w-24 z-10 bg-gradient-to-r from-[#0a0a0d] to-transparent pointer-events-none" />
            <div aria-hidden className="absolute right-0 top-0 bottom-0 w-24 z-10 bg-gradient-to-l from-[#0a0a0d] to-transparent pointer-events-none" />
            <div className="marquee-track">
              {[...TRUST_LOGOS, ...TRUST_LOGOS].map((logo, i) => (
                <span key={i} className="inline-flex items-center gap-2 text-[12.5px] font-medium text-zinc-400 whitespace-nowrap tracking-wide">
                  <span className="h-1 w-1 rounded-full bg-brand-coral/60" aria-hidden />
                  {logo}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Section Divider ────────────────────────────────────────── */}
      <SectionDivider />

      {/* ── Built For ─────────────────────────────────────────────── */}
      {/* Huly-style animated outcomes strip — numbers count up on scroll */}
      <section className="py-10 sm:py-14 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <Reveal direction="up" delay={0.05}>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 sm:gap-x-6 gap-y-10 sm:gap-y-12">
              {[
                { idx: "01", value: 1, suffix: "", duration: 800, label: "Intake & readiness" },
                { idx: "02", value: 2, suffix: "", duration: 900, label: "Approval & playbook" },
                { idx: "03", value: 3, suffix: "", duration: 1000, label: "Execution & validation" },
                { idx: "04", value: 4, suffix: "", duration: 1100, label: "Evidence & closure" },
              ].map((s) => (
                <div key={s.idx} className="relative pl-4 sm:pl-5 border-l border-white/[0.05]">
                  <p className="mono-label text-brand-coral/75 mb-3">
                    {s.idx} <span className="text-zinc-700">/</span> <span className="text-zinc-600">04</span>
                  </p>
                  <p className="spec-stat-value text-white text-4xl sm:text-5xl md:text-6xl font-display">
                    <CountUp to={s.value} duration={s.duration} />
                    {s.suffix && <span className="spec-stat-unit">{s.suffix}</span>}
                  </p>
                  <p className="spec-stat-label mt-3">{s.label}</p>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      <section className="py-10 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <Reveal direction="up" blur delay={0.05}>
            <p className="text-center text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-5">
              Built for
            </p>
          </Reveal>
          <Stagger delay={0.1} interval={0.06} className="flex flex-wrap justify-center gap-3">
            {[
              "Release managers",
              "Platform engineering",
              "Cloud operations",
              "Change approvers",
            ].map((label) => (
              <span
                key={label}
                className="huly-badge hover-lift text-zinc-400 border-white/[0.06] text-xs px-4 py-1.5 cursor-default"
              >
                {label}
              </span>
            ))}
          </Stagger>
        </div>
      </section>

      {/* ── Section Divider ────────────────────────────────────────── */}
      <SectionDivider />

      {/* ── What you'd otherwise be paying for ─────────────────────── */}
      {/* Visceral cost-of-team visualization. Mirrors /disciplines but
          curated to the 12 highest-impact roles so the home page hits
          quickly. Total is summed from the rates below so it stays
          honest. */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 relative">
        {/* Calm ambient — single low-opacity wash, no aurora */}
        <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden>
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[820px] h-[420px] rounded-full bg-white/[0.015] blur-[140px]" />
        </div>

        <div className="max-w-6xl mx-auto">
          <Reveal direction="up" blur>
            <div className="mb-12 sm:mb-14">
              <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-zinc-500 mb-6 inline-flex items-center gap-3">
                <span className="text-rose-300/90 tabular-nums">02</span>
                <span className="h-px w-6 bg-gradient-to-r from-rose-400/60 to-transparent" />
                One governed operational thread
              </p>
              <h2 className="text-[34px] sm:text-[44px] md:text-[52px] font-medium tracking-[-0.025em] leading-[1.05] text-white max-w-3xl">
                Coordinate every handoff. <span className="text-zinc-500">Keep people in control.</span>
              </h2>
              <ScrollRevealText
                as="p"
                className="mt-6 max-w-2xl text-[15px] leading-relaxed"
                text="Axiom Agent does not replace your engineering or change-management teams. It gives them one installed workspace for intake, permissions, approvals, guided work, validation, evidence, and follow-up."
              />
            </div>
          </Reveal>

          {/* Discipline grid — curated 12 to fit a compact home-page block */}
          <Stagger delay={0.1} interval={0.04} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-3">
            {[
              { name: "Deployment intake",   rate: "Request", scope: "Scope, ownership, dependencies, and environment" },
              { name: "Readiness",           rate: "Preflight", scope: "Permissions, credentials, prerequisites, and risk" },
              { name: "Versioned playbook",  rate: "Plan", scope: "Ordered actions with owners and expected outcomes" },
              { name: "Approval gates",      rate: "Decision", scope: "Human sign-off and separation of duties" },
              { name: "Scheduling",          rate: "Window", scope: "Change windows, dependencies, and coordination" },
              { name: "Guided execution",    rate: "Run", scope: "Approved steps with visible status and failures" },
              { name: "Retries & rollback",  rate: "Recover", scope: "Explicit recovery paths—never silent success" },
              { name: "Validation",          rate: "Verify", scope: "Expected results, deferred checks, and follow-ups" },
              { name: "Evidence collection", rate: "Record", scope: "Artifacts, decisions, timestamps, and provenance" },
              { name: "Audit history",       rate: "Review", scope: "Who did what, when, and with which authorization" },
              { name: "Reports & exports",   rate: "Share", scope: "Openable output for operators and reviewers" },
              { name: "Closure",             rate: "Complete", scope: "Final sign-off, unresolved work, and ownership" },
            ].map((d) => (
              <SpotlightCard
                key={d.name}
                className="rounded-xl border border-white/[0.05] bg-white/[0.012] p-4 hover:border-white/[0.1] transition-colors"
              >
                <div className="relative z-10">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[13px] font-medium text-zinc-100 leading-tight">{d.name}</p>
                    <span className="text-[10px] font-mono text-zinc-500 whitespace-nowrap flex-shrink-0">{d.rate}</span>
                  </div>
                  <p className="mt-2 text-[11.5px] text-zinc-500 leading-snug">{d.scope}</p>
                </div>
              </SpotlightCard>
            ))}
          </Stagger>

          <Reveal direction="up" delay={0.1}>
            <div className="mt-12 flex flex-wrap items-center gap-x-6 gap-y-3">
              <Link
                href="/capabilities"
                className="inline-flex items-center gap-2 rounded-full bg-white text-zinc-950 px-6 py-3 text-[14px] font-medium hover:bg-zinc-100 transition-colors"
              >
                Explore product capabilities
                <ArrowRightIcon className="h-4 w-4 opacity-60" />
              </Link>
              <Link
                href="/plans"
                className="text-[14px] text-zinc-400 hover:text-white transition-colors"
              >
                See pricing
              </Link>
              <p className="text-[12px] text-zinc-500">Twelve stages shown from intake through closure.</p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Section Divider ────────────────────────────────────────── */}
      <SectionDivider />

      {/* ── Capabilities ───────────────────────────────────────────── */}
      <section className="py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <Reveal direction="up">
            <div className="mb-14">
              <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-zinc-500 mb-6 inline-flex items-center gap-3">
                <span className="text-rose-300/90 tabular-nums">03</span>
                <span className="h-px w-6 bg-gradient-to-r from-rose-400/60 to-transparent" />
                Operational intelligence
              </p>
              <h2 className="text-[34px] sm:text-[44px] md:text-[52px] font-medium mb-5 tracking-[-0.025em] leading-[1.05] text-white">
                It doesn&apos;t alert. <span className="text-zinc-500">It operates.</span>
              </h2>
              <ScrollRevealText
                as="p"
                className="text-[15.5px] max-w-2xl leading-relaxed"
                text="Axiom turns operational inputs into reviewable plans, routes required approvals, guides supported execution adapters, and records validation and evidence. Availability and failures stay visible at each stage."
              />
            </div>
          </Reveal>
          <div className="grid md:grid-cols-3 gap-5">
            {[
              {
                dot: "bg-violet-500",
                accentClass: "card-accent-violet",
                title: "Deep Scanning",
                icon: MagnifyingGlassIcon,
                metric: "Availability shown",
                desc: "Full infrastructure snapshot — cost waste, security gaps, misconfigurations, and drift from desired state.",
                items: [
                  { dot: "bg-violet-400/60", text: "Cost optimization and rightsizing" },
                  { dot: "bg-violet-400/60", text: "Security findings with severity scoring" },
                  { dot: "bg-violet-400/60", text: "Continuous drift detection" },
                ],
              },
              {
                dot: "bg-fuchsia-500",
                accentClass: "card-accent-fuchsia",
                title: "Autonomous Reasoning",
                icon: CpuChipIcon,
                metric: "Source-aware",
                desc: "AI reasoning engine that prioritizes findings, builds dependency-aware execution plans, and generates Terraform code.",
                items: [
                  { dot: "bg-fuchsia-400/60", text: "Multi-phase cognitive reasoning" },
                  { dot: "bg-fuchsia-400/60", text: "Phased plans with dependency graphs" },
                  { dot: "bg-fuchsia-400/60", text: "Terraform and CLI code generation" },
                ],
              },
              {
                dot: "bg-emerald-500",
                accentClass: "card-accent-emerald",
                title: "Governed Execution",
                icon: ShieldCheckIcon,
                metric: "Audited",
                desc: "Governance controls connect approval gates, scoped execution, rollback planning, and persisted audit evidence.",
                items: [
                  { dot: "bg-emerald-400/60", text: "Human approval for high-risk changes" },
                  { dot: "bg-emerald-400/60", text: "Explicit rollback plans and recovery status" },
                  { dot: "bg-emerald-400/60", text: "Outcome learning and safety gates" },
                ],
              },
            ].map((card, i) => {
              const Icon = card.icon;
              return (
                <Reveal key={card.title} direction="up" delay={i * 0.06}>
                  <SpotlightCard className="surface-glass rounded-2xl p-7 h-full hover:border-white/[0.10] transition-colors">
                    <div className="relative z-10">
                      <div className="flex items-center gap-3 mb-5">
                        <Icon className="h-4 w-4 text-zinc-400" />
                        <h3 className="text-[15px] font-medium text-white">{card.title}</h3>
                        <span className="ml-auto kicker-mono">{card.metric}</span>
                      </div>
                      <p className="text-[14px] text-zinc-400 mb-6 leading-relaxed">{card.desc}</p>
                      <ul className="text-[13.5px] text-zinc-500 space-y-2.5">
                        {card.items.map((item) => (
                          <li key={item.text}>{item.text}</li>
                        ))}
                      </ul>
                    </div>
                  </SpotlightCard>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Section Divider ────────────────────────────────────────── */}
      <SectionDivider />

      <EnterpriseTrustSignals />

      {/* ── Section Divider ────────────────────────────────────────── */}
      <SectionDivider />

      {/* ── How it works — huly.io FeatureRow ───────────────────────── */}
      <FeatureRow
        kicker={<><span className="text-rose-300/90 tabular-nums">04</span><span className="mx-2 inline-block h-px w-6 align-middle bg-gradient-to-r from-rose-400/60 to-transparent" />How Axiom operates</>}
        headline={<>From request to <span className="text-zinc-500">verified closure</span>.</>}
        body={
          <>Inside the installed app, teams turn deployment intake into a versioned playbook, complete readiness checks, collect approvals, guide execution, validate outcomes, and preserve evidence for closure.</>
        }
        bullets={[
          { label: "Intake & readiness", description: "Capture scope, dependencies, ownership, permissions, and preflight checks" },
          { label: "Approval & playbook", description: "Version the request, resolve gates, and produce a guided execution sequence" },
          { label: "Execute & validate", description: "Run approved steps, surface failures honestly, retry safely, and track deferred checks" },
          { label: "Evidence & closure", description: "Collect outcomes, audit history, exports, follow-ups, and final sign-off" },
        ]}
        mediaSide="right"
        media={
          <div className="p-8 lg:p-10">
            <ServicePipeline />
          </div>
        }
      />

      {/* ── Section Divider ────────────────────────────────────────── */}
      <SectionDivider />

      {/* ── Multi-cloud — huly.io FeatureRow (alternates, media on left) ── */}
      <FeatureRow
        kicker={<><span className="text-rose-300/90 tabular-nums">05</span><span className="mx-2 inline-block h-px w-6 align-middle bg-gradient-to-r from-rose-400/60 to-transparent" />Multi-cloud intelligence</>}
        headline={<>One operating model. <span className="text-zinc-500">Provider-specific availability.</span></>}
        body={
          <>Axiom uses a shared provider model while keeping released behavior explicit. Connector code, customer configuration, live discovery, and write execution are separate milestones—not one generic “supported” badge.</>
        }
        bullets={[
          { label: "Amazon Web Services", description: "Assume-role connector implemented · live use requires broker and customer configuration · analysis is preview-grade" },
          { label: "Microsoft Azure", description: "Credential-format validation and preview analysis · live SDK validation and execution not released" },
          { label: "Google Cloud Platform", description: "Credential-format validation and preview analysis · live SDK validation and execution not released" },
          { label: "Execution", description: "Generated artifacts are review-only today; local apply is disabled by the desktop safety contract" },
        ]}
        mediaSide="left"
        media={
          <div className="p-8 lg:p-10 space-y-3">
            {PROVIDER_AVAILABILITY.map((p) => (
                <div key={p.id} className="flex items-center gap-3 py-2.5 px-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                  <div className="w-9 h-9 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center flex-shrink-0">
                    <span className="text-[11px] font-mono text-zinc-300">{p.shortName}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-white truncate">{p.displayName}</p>
                    <p className="text-[11px] text-zinc-500">{p.detail}</p>
                  </div>
                  <span className={`w-1.5 h-1.5 rounded-full ${p.tone}`} />
                </div>
            ))}
          </div>
        }
      />

      {/* ── Section Divider ────────────────────────────────────────── */}
      <SectionDivider />

      {/* ── Governance + safety — huly.io FeatureRow ────────────────── */}
      <FeatureRow
        kicker={<><span className="text-rose-300/90 tabular-nums">06</span><span className="mx-2 inline-block h-px w-6 align-middle bg-gradient-to-r from-rose-400/60 to-transparent" />Governance & safety</>}
        headline={<>Human-controlled. <span className="text-zinc-500">Policy-enforced.</span></>}
        body={
          <>Write actions follow the configured approval and permission policy. The app exposes scope, rollback planning, validation, and persisted audit evidence so reviewers can see what actually happened.</>
        }
        bullets={[
          { label: "Approval required", description: "No write action runs without explicit human sign-off" },
          { label: "Blast radius limits", description: "The planning kernel splits oversized steps and blocks invalid scope; released cloud mutation enforcement is not yet verified" },
          { label: "Rollback planning", description: "Recovery steps and their verification state remain explicit" },
          { label: "Audit evidence", description: "Persisted actor, action, rationale, timestamps, and outcomes" },
        ]}
        mediaSide="right"
        media={
          <div className="p-8 lg:p-10 space-y-3">
            {[
              { label: "Approval required", value: "Enforced", dot: "bg-emerald-400" },
              { label: "Blast radius", value: "Configured per plan", dot: "bg-amber-400" },
              { label: "Rollback verified", value: "Ready", dot: "bg-emerald-400" },
              { label: "Audit trail", value: "Immutable · SHA-256", dot: "bg-emerald-400" },
            ].map((row) => (
              <div key={row.label} className="flex items-center justify-between py-3 px-4 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                <span className="text-[12.5px] text-zinc-400">{row.label}</span>
                <span className="inline-flex items-center gap-2 text-[12.5px] text-zinc-100 font-medium">
                  <span className={`w-1.5 h-1.5 rounded-full ${row.dot}`} />
                  {row.value}
                </span>
              </div>
            ))}
            <pre className="mt-2 rounded-xl border border-white/[0.04] bg-black/40 p-4 font-mono text-[10.5px] text-zinc-400 leading-relaxed">
{`resource "aws_instance" "web" {
  instance_type = "t3.medium"
  # rightsized from m5.xlarge by Axiom plan #142
}`}
            </pre>
          </div>
        }
      />

      {/* ── Section Divider ────────────────────────────────────────── */}
      <SectionDivider />

      {/* ── FAQ ────────────────────────────────────────────────────── */}
      <AnimateOnScroll>
      <section id="faq" className="py-24 px-4 sm:px-6 lg:px-8" aria-labelledby="faq-heading">
        <div className="max-w-6xl mx-auto">
          <p className="kicker-mono text-center">Questions answered</p>
          <h2 id="faq-heading" className="display-headline text-white text-center mt-4 mb-14">
            Frequently asked questions
          </h2>
          <FAQAccordion items={axiomFAQ} />
        </div>
      </section>
      </AnimateOnScroll>

      {/* ── Closing CTA banner — huly.io 'Join the Movement' style ───── */}
      <section className="py-20 sm:py-32 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        {/* Coral + white drifting pools — the warm bookend to the cool hero */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden hidden md:block" aria-hidden>
          <div className="ambient-drift absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[820px] h-[520px] rounded-full bg-white/[0.04] blur-[140px]" />
          <div className="ambient-drift absolute top-[20%] left-[10%] w-[420px] h-[320px] rounded-full bg-rose-500/[0.06] blur-[130px]" style={{ animationDelay: "-7s" }} />
          <div className="ambient-drift absolute bottom-[10%] right-[8%] w-[360px] h-[280px] rounded-full bg-violet-500/[0.05] blur-[120px]" style={{ animationDelay: "-13s" }} />
        </div>

        <div className="relative max-w-6xl mx-auto text-center">
          <span className="inline-flex items-center gap-2 mx-auto mb-8 px-3 py-1.5 rounded-full border border-rose-400/30 bg-gradient-to-r from-rose-500/[0.10] via-fuchsia-500/[0.06] to-violet-500/[0.10] text-[11.5px] font-medium text-zinc-200 backdrop-blur-sm">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-70" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-rose-300" />
            </span>
            <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-rose-200/90">09 / 09</span>
            <span className="text-zinc-500">·</span>
            Downloadable operations workspace
          </span>
          <h2 className="display-headline-lg text-white">
            Turn a request into a governed playbook.
          </h2>
          <ScrollRevealText
            as="p"
            className="body-lede mt-6 mx-auto"
            text="Use the downloadable Axiom workspace to capture scope, approvals, execution steps, validation, evidence, rollback, and closure in one versioned operational record."
          />

          <div className="mt-10 mb-10 max-w-md mx-auto">
            <div className="hairline-divider" />
          </div>

          <div className="flex flex-col md:flex-row items-center justify-center gap-x-8 gap-y-3 mb-10 text-[12px] font-mono uppercase tracking-[0.22em] text-zinc-500">
            <span>Desktop application</span>
            <span className="hidden md:inline text-zinc-700">·</span>
            <span>Approval gated</span>
            <span className="hidden md:inline text-zinc-700">·</span>
            <span>Audit ready</span>
          </div>

          <div className="flex flex-col sm:flex-row justify-center items-stretch sm:items-center gap-3 sm:gap-x-6">
            {(() => {
              const primary = primaryCta("homepage_cta");
              const secondary = secondaryCta("homepage_cta");
              const fallback = fallbackCta("homepage_cta");
              return (
                <>
                  {primary && (
                    <Link
                      href={primary.href}
                      className="btn-press inline-flex items-center justify-center gap-2.5 px-7 py-3.5 rounded-full text-[14.5px] font-semibold tracking-tight"
                    >
                      {primary.label}
                      <ArrowRightIcon className="h-4 w-4 opacity-60" />
                    </Link>
                  )}
                  {secondary && (
                    <Link
                      href={secondary.href}
                      className="link-underline-soft text-[14px] text-zinc-400 hover:text-white transition-colors"
                    >
                      {secondary.label}
                    </Link>
                  )}
                  {fallback && (
                    <Link
                      href={fallback.href}
                      className="link-underline-soft text-[13px] text-zinc-500 hover:text-zinc-200 transition-colors"
                    >
                      {fallback.label}
                    </Link>
                  )}
                </>
              );
            })()}
          </div>
        </div>
      </section>

      </div>

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <Footer />
      </div>
    </div>
  );
}
