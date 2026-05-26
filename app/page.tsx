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
import { AnimatedButton } from "@/components/ui/AnimatedButton";
import { RealisticFogBackground } from "@/components/ui/realistic-fog-background";
import { MotherboardBackdrop } from "@/components/ui/MotherboardBackdrop";
import { Spotlight } from "@/components/motion/Spotlight";
import { SpotlightCard } from "@/components/motion/SpotlightCard";
import { ScrollRevealText } from "@/components/motion/ScrollRevealText";
import { FeatureRow } from "@/components/marketing/FeatureRow";
import { MagneticButton } from "@/components/motion/MagneticButton";
import { CountUp } from "@/components/motion/CountUp";
import { TextReveal } from "@/components/motion/TextReveal";
import { TiltCard } from "@/components/motion/TiltCard";
import { Marquee } from "@/components/motion/Marquee";
import { GradientBorder } from "@/components/motion/GradientBorder";
import { DrippingBeam } from "@/components/motion/DrippingBeam";
import { TestimonialsCarousel } from "@/components/TestimonialsCarousel";
import { FAQAccordion } from "@/components/FAQAccordion";
import { DesktopShowcase } from "@/components/home/DesktopShowcase";
import { HomepageDemoAnimation } from "@/components/marketing/HomepageDemoAnimation";
import { Footer } from "@/components/Footer";
import {
  CurrencyDollarIcon,
  LockClosedIcon,
  ArrowPathIcon,
  BoltIcon,
  CloudArrowUpIcon,
  EyeIcon,
  CommandLineIcon,
  ChartBarIcon,
  DocumentCheckIcon,
} from "@heroicons/react/24/outline";
import { listProviders, capabilitySummary } from "@/lib/cloud/providerRegistry";
import { primaryCta, secondaryCta, fallbackCta } from "@/lib/product/ctaMap";

const axiomFAQ = [
  {
    question: "What does Axiom actually do?",
    answer:
      "Axiom is an autonomous cloud operations agent. It connects to your AWS account via a read-only IAM role, scans your infrastructure, runs a 12-step autonomous loop to identify and prioritize issues (cost waste, security gaps, drift, misconfigurations), generates phased execution plans with Terraform code, and learns from outcomes. Nothing changes without your explicit approval.",
  },
  {
    question: "Does Axiom modify my infrastructure?",
    answer:
      "Never without your approval. Scans are always read-only. When you upgrade to the Agent tier, Axiom generates execution plans — but every change requires your explicit approval, includes a pre-verified rollback strategy, and is logged with a full audit trail.",
  },
  {
    question: "What clouds are supported?",
    answer:
      "AWS has full support — scan, plan, and execution. Azure and GCP currently support scan-only analysis, with plan and execution capabilities on the roadmap.",
  },
  {
    question: "How does Axiom keep my infrastructure safe?",
    answer:
      "Axiom uses a governance framework with trust levels, blast radius limits, approval gates, and compliance policies. The agent can never self-escalate its own autonomy level. High-risk changes always require human approval.",
  },
  {
    question: "How long does setup take?",
    answer:
      "About 5 minutes. Create a read-only IAM role in AWS, paste the Role ARN, and Axiom starts scanning. Your first findings report is ready in under a minute.",
  },
  {
    question: "What access does Axiom need?",
    answer:
      "Axiom uses an assume-role model — you create a read-only IAM role in your AWS account and we assume it to scan. No access keys are stored. You can revoke access anytime from your AWS console.",
  },
  {
    question: "Does Axiom learn from past actions?",
    answer:
      "Yes. Axiom records the outcome of every action — whether it succeeded or failed, for which resource and action type. If a resource has a prior failure, it automatically downgrades future recommendations from auto-fix to human review. This outcome memory makes the agent safer over time.",
  },
];

const TRUST_LOGOS = [
  "Read-only IAM roles", "Zero stored credentials", "Approval-gated execution", "Immutable audit trail",
  "Pre-verified rollback", "Blast radius limits", "Terraform-native IaC", "Outcome memory engine",
  "Continuous drift monitoring", "Compliance-aware scanning",
];

/* ── Floating ambient particles ──────────────────────────────── */
function AmbientParticles() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
      <div
        className="ambient-particle w-1.5 h-1.5 bg-blue-400/40"
        style={{ top: "15%", left: "20%", animationDelay: "0s", animationDuration: "14s" }}
      />
      <div
        className="ambient-particle w-1 h-1 bg-fuchsia-400/30"
        style={{ top: "30%", right: "25%", animationDelay: "-3s", animationDuration: "11s" }}
      />
      <div
        className="ambient-particle w-2 h-2 bg-indigo-300/20"
        style={{ top: "55%", left: "65%", animationDelay: "-6s", animationDuration: "16s" }}
      />
      <div
        className="ambient-particle w-1 h-1 bg-fuchsia-300/30"
        style={{ top: "70%", left: "35%", animationDelay: "-9s", animationDuration: "13s" }}
      />
      <div
        className="ambient-particle w-1.5 h-1.5 bg-cyan-500/25"
        style={{ top: "45%", right: "15%", animationDelay: "-4s", animationDuration: "15s" }}
      />
    </div>
  );
}

/* ── Section divider — calm huly.io hairline that fades at the edges */
function SectionDivider() {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="hairline-divider" />
    </div>
  );
}

export default function Home() {
  return (
    <div className="min-h-screen bg-[#0a0a0d] text-white relative">
      <div className="absolute inset-0 bg-grid-mesh opacity-40 pointer-events-none" aria-hidden />
      <div className="relative z-10">
      <Navigation />

      {/* ── Hero ───────────────────────────────────────────────────── */}
      <section className="pt-24 sm:pt-28 md:pt-32 pb-16 sm:pb-20 md:pb-24 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        {/* Heavy decoratives — all hidden on mobile so the hero scrolls smoothly.
            Each of these is a fillrate-heavy element (large filter:blur, full-section
            SVG / canvas, infinite CSS animation) and stacking them tanks first paint
            + scroll perf on phones. Desktop stack is unchanged. */}
        <div className="hidden md:block">
          <RealisticFogBackground backgroundColor="transparent" opacity={0.3} darken contained />
          <MotherboardBackdrop radius={420} tint="violet" baseOpacity={0.05} peakOpacity={0.22} />
          <div className="absolute inset-0 hero-grid-mesh opacity-40 pointer-events-none" aria-hidden />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] spotlight-orb opacity-60 pointer-events-none" aria-hidden />
          <div className="absolute top-40 -right-40 w-[500px] h-[500px] rounded-full bg-violet-600/5 blur-[120px] pointer-events-none" aria-hidden />
          <div className="absolute top-60 -left-40 w-[400px] h-[400px] rounded-full bg-fuchsia-600/5 blur-[120px] pointer-events-none" aria-hidden />
          <div className="hero-beam-vertical pointer-events-none" aria-hidden />
          <div className="hero-beam-flare pointer-events-none" aria-hidden />
          <div className="hero-beam-converge pointer-events-none" aria-hidden />
          <AmbientParticles />
          <div className="hero-noise-grain" aria-hidden />
          <Spotlight tint="violet" size={680} intensity={0.9} />
        </div>

        {/* Light-weight mobile-only backdrop: one static gradient orb, zero animation,
            zero filter:blur, zero JS — paints once and never repaints. */}
        <div
          className="md:hidden absolute -top-32 left-1/2 -translate-x-1/2 w-[420px] h-[420px] pointer-events-none"
          aria-hidden
          style={{
            background: "radial-gradient(circle, rgba(139, 92, 246, 0.18) 0%, transparent 65%)",
          }}
        />

        {/* Calm ambient atmosphere — three drifting pools (violet · coral · cyan)
            giving the hero a 'living dark' Huly-style aurora without an
            animated beam parade. The coral pool is the new accent. */}
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="ambient-drift absolute top-[-180px] left-1/2 -translate-x-1/2 w-[900px] h-[520px] rounded-full bg-violet-500/[0.07] blur-[140px]" />
          <div className="ambient-drift absolute top-[60px] right-[2%] w-[520px] h-[400px] rounded-full bg-rose-500/[0.06] blur-[130px]" style={{ animationDelay: "-8s" }} />
          <div className="ambient-drift absolute top-[260px] left-[-6%] w-[380px] h-[300px] rounded-full bg-cyan-500/[0.035] blur-[120px]" style={{ animationDelay: "-16s" }} />
          <div className="ambient-drift absolute top-[120px] right-[40%] w-[320px] h-[260px] rounded-full bg-fuchsia-500/[0.035] blur-[120px]" style={{ animationDelay: "-12s" }} />
        </div>

        <div className="max-w-6xl mx-auto relative">
          <div className="grid lg:grid-cols-[1.05fr_1fr] gap-12 lg:gap-20 items-center">
            {/* Left — editorial hero, now using the calm design system. */}
            <div className="relative z-10">
              <Reveal direction="up" blur>
                <span className="inline-flex items-center gap-2 mb-8 px-3 py-1.5 rounded-full border border-rose-400/30 bg-gradient-to-r from-rose-500/[0.10] via-fuchsia-500/[0.06] to-violet-500/[0.10] text-[11.5px] font-medium text-zinc-200 backdrop-blur-sm">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-70" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-rose-300" />
                  </span>
                  <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-rose-200/90">01 / 09</span>
                  <span className="text-zinc-500">·</span>
                  Axiom · cloud operations agent
                </span>
              </Reveal>
              <h1 className="display-headline-lg text-white break-words mb-7">
                <TextReveal text="Your cloud" splitBy="char" stagger={18} startDelay={120} className="block" />
                <span className="block relative">
                  <TextReveal text="runs itself." splitBy="char" stagger={18} startDelay={420} className="relative inline-block" />
                  {/* Coral underline accent — Huly's signature warm hairline under the punch word */}
                  <span
                    aria-hidden
                    className="absolute left-0 -bottom-1 h-[3px] w-[58%] rounded-full bg-gradient-to-r from-rose-400 via-fuchsia-400 to-transparent opacity-90"
                  />
                </span>
              </h1>
              <Reveal direction="up" delay={0.06}>
                <p className="body-lede text-zinc-400 mb-10">
                  Axiom scans your infrastructure, reasons about cost and security, drafts Terraform changes, and ships them — with human approval. Up to 30–40% lower cloud spend in optimized accounts.
                </p>
              </Reveal>
              <Reveal direction="up" delay={0.12}>
                <div className="relative z-20 flex flex-wrap items-center gap-x-6 gap-y-3">
                  <Link
                    href="/operator/onboarding"
                    className="magnetic-sheen inline-flex items-center gap-2.5 px-7 py-3.5 rounded-full bg-white text-zinc-950 text-[14.5px] font-medium hover:bg-zinc-100 transition-colors shadow-[0_0_30px_-10px_rgba(255,255,255,0.4)]"
                  >
                    See Axiom in action
                    <ArrowRightIcon className="h-4 w-4 opacity-60" />
                  </Link>
                  <Link
                    href="/demo"
                    className="link-underline-soft text-[14px] text-zinc-400 hover:text-white transition-colors"
                  >
                    Try the demo
                  </Link>
                </div>
              </Reveal>
              <Reveal direction="up" delay={0.2}>
                <div className="mt-10 pt-7 relative flex flex-wrap gap-x-8 gap-y-3 text-[12px] text-zinc-500">
                  <span className="hairline-divider absolute inset-x-0 top-0" aria-hidden />
                  {["Assume-role model", "Human approval gates", "Immutable audit trail"].map((item) => (
                    <span key={item}>{item}</span>
                  ))}
                </div>
              </Reveal>
            </div>

            {/* Right — product walkthrough wrapped in a cursor-aware
                SpotlightCard with a glow-edge top highlight. A small
                floating audit card overlaps the top-right corner —
                Huly's "detail floats out of the product" composition. */}
            <Reveal direction="up" delay={0.15}>
              <div className="relative hidden lg:block">
                <SpotlightCard
                  className="glow-edge rounded-2xl border border-white/[0.04] bg-white/[0.012] p-6 backdrop-blur-sm"
                >
                  <HomepageDemoAnimation />
                </SpotlightCard>

                {/* Floating audit overlay — top-right, breaks out of the frame */}
                <div
                  className="absolute -top-5 -right-5 z-20 w-[220px] rounded-xl border border-white/[0.08] bg-[#0b0b0e]/95 backdrop-blur-xl p-3 shadow-[0_20px_50px_-15px_rgba(244,114,182,0.25)] hidden xl:block"
                  style={{ animation: "ambient-drift 9s ease-in-out infinite" }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-300" />
                    </span>
                    <p className="text-[9.5px] font-mono uppercase tracking-[0.16em] text-emerald-300/90">Audit · live</p>
                  </div>
                  <p className="text-[12px] font-semibold text-white leading-tight">Plan #142 approved</p>
                  <p className="text-[10.5px] text-zinc-400 mt-1 leading-snug">Rollback verified · sha-256 rationale persisted · blast radius 1 service.</p>
                  <div className="mt-2 flex items-center gap-1.5 text-[9.5px] font-mono text-zinc-500">
                    <span>18:42 UTC</span>
                    <span>·</span>
                    <span className="text-rose-300/90">payments-api</span>
                  </div>
                </div>

                {/* Floating metric chip — bottom-left, breaks out the other side */}
                <div
                  className="absolute -bottom-4 -left-5 z-20 rounded-full border border-white/[0.08] bg-[#0b0b0e]/95 backdrop-blur-xl px-3.5 py-1.5 shadow-[0_15px_40px_-15px_rgba(168,85,247,0.35)] hidden xl:flex items-center gap-2"
                  style={{ animation: "ambient-drift 11s ease-in-out infinite", animationDelay: "-4s" }}
                >
                  <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-violet-300/90">MTTR</span>
                  <span className="font-semibold text-white text-[12.5px] tabular-nums">11 min</span>
                  <span className="text-zinc-600">·</span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-cyan-300/80">Spend ↓</span>
                  <span className="font-semibold text-white text-[12.5px] tabular-nums">37%</span>
                </div>
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
        <div className="max-w-5xl mx-auto">
          <Reveal direction="up" delay={0.05}>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 sm:gap-x-6 gap-y-8 sm:gap-y-10">
              {[
                { idx: "01", value: 35,  suffix: "%", duration: 1600, label: "Avg cloud spend cut" },
                { idx: "02", value: 60,  suffix: "s", duration: 1400, label: "First findings report" },
                { idx: "03", value: 3,   suffix: "",  duration: 1200, label: "Clouds wired today" },
                { idx: "04", value: 100, suffix: "%", duration: 1500, label: "Approval-gated execution" },
              ].map((s) => (
                <div key={s.idx} className="relative pl-3 sm:pl-4 border-l border-white/[0.06]">
                  <p className="text-[10px] sm:text-[11px] font-mono tabular-nums text-rose-300/85 tracking-[0.2em] mb-2">
                    {s.idx} <span className="text-zinc-700">/</span> <span className="text-zinc-600">04</span>
                  </p>
                  <p className="text-3xl sm:text-4xl md:text-5xl font-bold text-white tracking-[-0.04em] tabular-nums">
                    <CountUp to={s.value} suffix={s.suffix} duration={s.duration} />
                  </p>
                  <p className="text-[10px] sm:text-[11px] text-zinc-500 uppercase tracking-[0.16em] sm:tracking-[0.18em] mt-2 leading-tight">{s.label}</p>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      <section className="py-10 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <Reveal direction="up" blur delay={0.05}>
            <p className="text-center text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-5">
              Built for
            </p>
          </Reveal>
          <Stagger delay={0.1} interval={0.06} className="flex flex-wrap justify-center gap-3">
            {[
              "YC-backed startups",
              "Series A–C teams",
              "Platform engineering",
              "FinOps teams",
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

        <div className="max-w-5xl mx-auto">
          <Reveal direction="up" blur>
            <div className="mb-12 sm:mb-14">
              <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-zinc-500 mb-6 inline-flex items-center gap-3">
                <span className="text-rose-300/90 tabular-nums">02</span>
                <span className="h-px w-6 bg-gradient-to-r from-rose-400/60 to-transparent" />
                The team you&apos;d otherwise be paying for
              </p>
              <h2 className="text-[34px] sm:text-[44px] md:text-[52px] font-medium tracking-[-0.025em] leading-[1.05] text-white max-w-3xl">
                A $<CountUp to={5.27} duration={2000} decimals={2} />M per year team. <span className="text-zinc-500">Most teams don&apos;t have it.</span>
              </h2>
              <ScrollRevealText
                as="p"
                className="mt-6 max-w-2xl text-[15px] leading-relaxed"
                text="The fully-loaded annual cost of hiring the engineering and operations bench most companies need but never ship. Axiom doesn't replace that team — it gives the team you already have AI-assisted coverage across every discipline below, with a human approval before any change runs."
              />
            </div>
          </Reveal>

          {/* Discipline grid — curated 12 to fit a compact home-page block */}
          <Stagger delay={0.1} interval={0.04} className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-3">
            {[
              { name: "Cloud Architect",     rate: "$260k+/yr", scope: "Multi-cloud topology + boundaries" },
              { name: "Security Engineer",   rate: "$240k+/yr", scope: "Threat model + secret hygiene" },
              { name: "ML Engineer",         rate: "$245k+/yr", scope: "Provider routing + fallback" },
              { name: "AI Researcher",       rate: "$260k+/yr", scope: "Council weighting + drift" },
              { name: "Kubernetes Engineer", rate: "$225k+/yr", scope: "Workload + control-plane drift" },
              { name: "SRE / On-call",       rate: "$225k+/yr", scope: "Error budgets + paging" },
              { name: "AWS Specialist",      rate: "$220k+/yr", scope: "CloudTrail + IAM least-priv" },
              { name: "Mobile Engineer",     rate: "$220k+/yr", scope: "Push + offline + deep-link" },
              { name: "Incident Commander",  rate: "$220k+/yr", scope: "Approval staging + rollback" },
              { name: "Compliance Officer",  rate: "$200k+/yr", scope: "SOC 2 + GDPR evidence" },
              { name: "Build / CI Engineer", rate: "$195k+/yr", scope: "Gating + deploy windows" },
              { name: "Customer Success",    rate: "$170k+/yr", scope: "Trial → growth conversion" },
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
                href="/disciplines"
                className="inline-flex items-center gap-2 rounded-full bg-white text-zinc-950 px-6 py-3 text-[14px] font-medium hover:bg-zinc-100 transition-colors"
              >
                See all 26 disciplines
                <ArrowRightIcon className="h-4 w-4 opacity-60" />
              </Link>
              <Link
                href="/plans"
                className="text-[14px] text-zinc-400 hover:text-white transition-colors"
              >
                See pricing
              </Link>
              <p className="text-[12px] text-zinc-500">Twelve of twenty-six shown.</p>
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
                text="Axiom scans your infrastructure, reasons about what matters, builds execution plans, and applies approved changes — then learns from outcomes."
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
                metric: "3 clouds",
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
                metric: "12-step loop",
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
                desc: "Enterprise-grade safety — approval gates, blast radius limits, verified rollback, and immutable audit trail.",
                items: [
                  { dot: "bg-emerald-400/60", text: "Human approval for high-risk changes" },
                  { dot: "bg-emerald-400/60", text: "Pre-verified rollback strategies" },
                  { dot: "bg-emerald-400/60", text: "Outcome learning and safety gates" },
                ],
              },
            ].map((card, i) => {
              const Icon = card.icon;
              return (
                <Reveal key={card.title} direction="up" delay={i * 0.06}>
                  <SpotlightCard className="glow-edge rounded-2xl border border-white/[0.05] bg-white/[0.012] p-7 h-full hover:border-white/[0.1] transition-colors">
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
        headline={<>Twelve steps from <span className="text-zinc-500">scan to ship</span>.</>}
        body={
          <>Axiom runs a 12-step cognitive loop: observe the cloud, interpret findings, reason about priority, plan dependency-aware execution, and learn from outcomes. Every step is auditable.</>
        }
        bullets={[
          { label: "Phase 1 — Observe", description: "Multi-region inventory, cost waste detection, security drift" },
          { label: "Phase 2 — Reason", description: "Council-weighted priority, blast radius, ROI estimation" },
          { label: "Phase 3 — Plan", description: "Phased Terraform with dependency graph + rollback strategy" },
          { label: "Phase 4 — Approve · Execute · Learn", description: "Human gate, audited execution, outcome scoring" },
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
        headline={<>One agent. <span className="text-zinc-500">Every cloud.</span></>}
        body={
          <>Axiom&apos;s provider-abstraction layer normalizes AWS, Azure, and GCP into a unified operational model. One scan, one reasoning loop, one execution plan — no matter where your workloads live.</>
        }
        bullets={[
          { label: "Amazon Web Services", description: "Full operations · CloudFormation one-click connect · assume-role" },
          { label: "Microsoft Azure", description: "Reader role · service principal via Cloud Shell · ARM-aware" },
          { label: "Google Cloud Platform", description: "Service account · Cloud Shell tutorial · project-scoped" },
          { label: "Terraform native output", description: "Auto-generated IaC with dependency graphs + rollback strategies" },
        ]}
        mediaSide="left"
        media={
          <div className="p-8 lg:p-10 space-y-3">
            {listProviders().map((p) => {
              const isOperational = p.status === "operational";
              const summary = capabilitySummary(p.provider);
              return (
                <div key={p.provider} className="flex items-center gap-3 py-2.5 px-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                  <div className="w-9 h-9 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center flex-shrink-0">
                    <span className="text-[11px] font-mono text-zinc-300">{p.shortName}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-white truncate">{p.displayName}</p>
                    <p className="text-[11px] text-zinc-500 truncate">
                      {isOperational ? "Full operations" : `${summary.live + summary.preview} live · ${summary.building + summary.planned} expanding`}
                    </p>
                  </div>
                  <span className={`w-1.5 h-1.5 rounded-full breathe ${isOperational ? "bg-emerald-400" : "bg-zinc-500"}`} />
                </div>
              );
            })}
          </div>
        }
      />

      {/* ── Section Divider ────────────────────────────────────────── */}
      <SectionDivider />

      {/* ── Governance + safety — huly.io FeatureRow ────────────────── */}
      <FeatureRow
        kicker={<><span className="text-rose-300/90 tabular-nums">06</span><span className="mx-2 inline-block h-px w-6 align-middle bg-gradient-to-r from-rose-400/60 to-transparent" />Governance & safety</>}
        headline={<>Approval-gated. <span className="text-zinc-500">Always.</span></>}
        body={
          <>Every change passes a human approval gate. Blast radius is capped, compliance policy enforced, rollback pre-verified, and every action recorded in an immutable audit trail.</>
        }
        bullets={[
          { label: "Approval required", description: "No write action runs without explicit human sign-off" },
          { label: "Blast radius limits", description: "Plans that touch more than N resources are auto-staged" },
          { label: "Rollback verified", description: "Every plan ships with a tested rollback path before approval" },
          { label: "Immutable audit", description: "SHA-256 rationale rows · who · what · why · when" },
        ]}
        mediaSide="right"
        media={
          <div className="p-8 lg:p-10 space-y-3">
            {[
              { label: "Approval required", value: "Enforced", dot: "bg-emerald-400" },
              { label: "Blast radius", value: "< 5 resources", dot: "bg-amber-400" },
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

      {/* ── Testimonials ───────────────────────────────────────────── */}
      <Reveal direction="up">
        <TestimonialsCarousel />
      </Reveal>

      {/* ── FAQ ────────────────────────────────────────────────────── */}
      <AnimateOnScroll>
      <section id="faq" className="py-24 px-4 sm:px-6 lg:px-8" aria-labelledby="faq-heading">
        <div className="max-w-3xl mx-auto">
          <p className="kicker-mono text-center">Questions answered</p>
          <h2 id="faq-heading" className="display-headline text-white text-center mt-4 mb-14">
            Frequently asked questions
          </h2>
          <FAQAccordion items={axiomFAQ} />
        </div>
      </section>
      </AnimateOnScroll>

      {/* ── Closing CTA banner — huly.io 'Join the Movement' style ───── */}
      <section className="py-32 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        {/* Coral + white drifting pools — the warm bookend to the cool hero */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
          <div className="ambient-drift absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[820px] h-[520px] rounded-full bg-white/[0.04] blur-[140px]" />
          <div className="ambient-drift absolute top-[20%] left-[10%] w-[420px] h-[320px] rounded-full bg-rose-500/[0.06] blur-[130px]" style={{ animationDelay: "-7s" }} />
          <div className="ambient-drift absolute bottom-[10%] right-[8%] w-[360px] h-[280px] rounded-full bg-violet-500/[0.05] blur-[120px]" style={{ animationDelay: "-13s" }} />
        </div>

        <div className="relative max-w-3xl mx-auto text-center">
          <span className="inline-flex items-center gap-2 mx-auto mb-8 px-3 py-1.5 rounded-full border border-rose-400/30 bg-gradient-to-r from-rose-500/[0.10] via-fuchsia-500/[0.06] to-violet-500/[0.10] text-[11.5px] font-medium text-zinc-200 backdrop-blur-sm">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-70" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-rose-300" />
            </span>
            <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-rose-200/90">09 / 09</span>
            <span className="text-zinc-500">·</span>
            5 minutes to first scan
          </span>
          <h2 className="display-headline-lg text-white">
            Your first scan takes 5 minutes.
          </h2>
          <ScrollRevealText
            as="p"
            className="body-lede mt-6 mx-auto"
            text="Connect a read-only IAM role. Axiom delivers your infrastructure intelligence report — cost savings, security findings, and execution plan — before your coffee gets cold."
          />

          <div className="mt-10 mb-10 max-w-md mx-auto">
            <div className="hairline-divider" />
          </div>

          <div className="flex flex-col md:flex-row items-center justify-center gap-x-8 gap-y-3 mb-10 text-[12px] font-mono uppercase tracking-[0.22em] text-zinc-500">
            <span>No credit card</span>
            <span className="hidden md:inline text-zinc-700">·</span>
            <span>Read-only access</span>
            <span className="hidden md:inline text-zinc-700">·</span>
            <span>Revoke anytime</span>
          </div>

          <div className="flex flex-wrap justify-center items-center gap-x-6 gap-y-3">
            {(() => {
              const primary = primaryCta("homepage_cta");
              const secondary = secondaryCta("homepage_cta");
              const fallback = fallbackCta("homepage_cta");
              return (
                <>
                  {primary && (
                    <Link
                      href={primary.href}
                      className="magnetic-sheen inline-flex items-center gap-2.5 px-7 py-3.5 rounded-full bg-white text-zinc-950 text-[14.5px] font-medium hover:bg-zinc-100 transition-colors shadow-[0_0_30px_-10px_rgba(255,255,255,0.4)]"
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

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <Footer />
      </div>
    </div>
  );
}
