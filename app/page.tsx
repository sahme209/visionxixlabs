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

/* ── Section divider ─────────────────────────────────────────── */
function SectionDivider() {
  return <div className="section-divider" />;
}

export default function Home() {
  return (
    <div className="min-h-screen bg-[#09090b] text-white relative">
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

        {/* Center DrippingBeam — only one shows on mobile, with fewer drops + smaller height
            to keep the animation budget low. Two side beams remain hidden on mobile. */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 pointer-events-none" aria-hidden>
          {/* Mobile config: 3 drops, 460px, slower (less rAF churn). */}
          <div className="md:hidden">
            <DrippingBeam tint="violet" dropCount={3} heightClass="h-[460px]" width={3} durationSec={4.2} />
          </div>
          {/* Desktop config: full 7 drops, 640px. */}
          <div className="hidden md:block">
            <DrippingBeam tint="violet" dropCount={7} heightClass="h-[640px]" width={4} durationSec={3.4} />
          </div>
        </div>
        <div className="hidden md:block absolute top-10 left-[28%] pointer-events-none opacity-50" aria-hidden>
          <DrippingBeam tint="cyan" dropCount={4} heightClass="h-[500px]" width={3} durationSec={4.6} />
        </div>
        <div className="hidden md:block absolute top-20 right-[28%] pointer-events-none opacity-50" aria-hidden>
          <DrippingBeam tint="fuchsia" dropCount={4} heightClass="h-[520px]" width={3} durationSec={5.2} />
        </div>

        <div className="max-w-6xl mx-auto relative">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Left: Text Content */}
            <div className="relative z-10">
              <Reveal direction="up" blur>
                <span className="badge-shimmer badge-shimmer-border inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.08] text-zinc-300 text-sm font-medium mb-8 backdrop-blur-sm cursor-default">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Autonomous Cloud Operations
                </span>
              </Reveal>
              <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold mb-6 leading-[1.08] sm:leading-[1.05] tracking-[-0.03em] sm:tracking-[-0.04em] break-words">
                <TextReveal text="Your cloud" splitBy="char" stagger={22} startDelay={120} className="block" />
                <span className="block">
                  <TextReveal text="runs itself " splitBy="char" stagger={22} startDelay={420} />
                  <span className="text-gradient">
                    <TextReveal text="now." splitBy="char" stagger={28} startDelay={780} />
                  </span>
                </span>
              </h1>
              <Reveal direction="up" delay={0.06}>
                <p className="text-dim-paragraph text-base sm:text-lg md:text-xl mb-8 sm:mb-10 max-w-lg leading-relaxed">
                  Axiom is an AI-assisted operations agent that scans your cloud infrastructure, <span className="dim-1">reasons about cost and security, generates Terraform execution plans,</span> <span className="dim-2">and applies operator-approved changes — with cost savings of up to 30–40% reported in optimized cases.</span>
                </p>
              </Reveal>
              <Stagger delay={0.12}>
                <div className="relative z-20 flex flex-wrap gap-4 mb-8">
                  <MagneticButton strength={10} radius={140}>
                    <AnimatedButton
                      href="/operator/onboarding"
                      variant="primary"
                      className="btn-amber-shimmer cta-glow shadow-lg shadow-violet-500/20 relative z-10 rounded-full text-zinc-900 font-semibold"
                    >
                      SEE IN ACTION
                      <ArrowRightIcon className="ml-2 h-4 w-4" />
                    </AnimatedButton>
                  </MagneticButton>
                  <MagneticButton strength={6} radius={120}>
                    <AnimatedButton
                      href="/demo"
                      variant="ghost"
                      className="border-violet-500/30 bg-violet-500/[0.06] text-violet-100 hover:bg-violet-500/[0.12] hover:border-violet-400/50 relative z-10"
                    >
                      Try the demo
                    </AnimatedButton>
                  </MagneticButton>
                  <MagneticButton strength={6} radius={120}>
                    <AnimatedButton
                      href="/axiom"
                      variant="ghost"
                      className="border-white/10 text-zinc-300 hover:bg-white/5 hover:border-white/20 relative z-10"
                    >
                      How it works
                    </AnimatedButton>
                  </MagneticButton>
                </div>
              </Stagger>
              <Reveal direction="up" delay={0.2}>
                <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-zinc-500">
                  {["Assume-role model", "Approval enforcement", "Rollback capability", "Immutable audit trail"].map((item) => (
                    <span key={item} className="flex items-center gap-1.5">
                      <span className="w-1 h-1 rounded-full bg-emerald-500" />
                      {item}
                    </span>
                  ))}
                </div>
              </Reveal>
            </div>

            {/* Right: Animated product walkthrough — 9-step cursor-driven demo */}
            <Reveal direction="up" delay={0.15}>
              <div className="relative hidden lg:block">
                <HomepageDemoAnimation />
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
      <section className="py-8 overflow-hidden relative">
        <div className="absolute inset-0 bg-white/[0.01] pointer-events-none" aria-hidden />
        <div className="relative overflow-hidden">
          <div className="marquee-track">
            {[...TRUST_LOGOS, ...TRUST_LOGOS].map((logo, i) => (
              <span key={i} className="text-sm font-medium text-zinc-600 whitespace-nowrap tracking-wide">
                {logo}
              </span>
            ))}
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
            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 sm:gap-x-6 gap-y-6 sm:gap-y-8 text-center">
              <div>
                <p className="text-3xl sm:text-4xl md:text-5xl font-bold text-white tracking-[-0.04em]">
                  <CountUp to={35} suffix="%" duration={1600} />
                </p>
                <p className="text-[10px] sm:text-[11px] text-zinc-500 uppercase tracking-[0.16em] sm:tracking-[0.18em] mt-2 leading-tight">Avg cloud spend cut</p>
              </div>
              <div>
                <p className="text-3xl sm:text-4xl md:text-5xl font-bold text-white tracking-[-0.04em]">
                  <CountUp to={60} suffix="s" duration={1400} />
                </p>
                <p className="text-[10px] sm:text-[11px] text-zinc-500 uppercase tracking-[0.16em] sm:tracking-[0.18em] mt-2 leading-tight">First findings report</p>
              </div>
              <div>
                <p className="text-3xl sm:text-4xl md:text-5xl font-bold text-white tracking-[-0.04em]">
                  <CountUp to={3} duration={1200} />
                </p>
                <p className="text-[10px] sm:text-[11px] text-zinc-500 uppercase tracking-[0.16em] sm:tracking-[0.18em] mt-2 leading-tight">Clouds wired today</p>
              </div>
              <div>
                <p className="text-3xl sm:text-4xl md:text-5xl font-bold text-white tracking-[-0.04em]">
                  <CountUp to={100} suffix="%" duration={1500} />
                </p>
                <p className="text-[10px] sm:text-[11px] text-zinc-500 uppercase tracking-[0.16em] sm:tracking-[0.18em] mt-2 leading-tight">Approval-gated execution</p>
              </div>
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
      <section className="py-24 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        {/* Aurora glow */}
        <div className="pointer-events-none absolute inset-0 -z-10 opacity-80">
          <div className="absolute -top-1/3 left-1/4 h-[60vh] w-[55vw] rounded-full bg-gradient-to-br from-violet-500/15 via-fuchsia-500/8 to-transparent blur-3xl" />
          <div className="absolute bottom-0 right-1/4 h-[50vh] w-[45vw] rounded-full bg-gradient-to-tl from-cyan-500/10 to-transparent blur-3xl" />
        </div>

        <div className="max-w-6xl mx-auto">
          <Reveal direction="up" blur>
            <div className="text-center mb-10 sm:mb-12">
              <p className="text-[11px] sm:text-xs font-semibold text-fuchsia-300/80 mb-3 sm:mb-4 tracking-[0.18em] uppercase">
                the team you'd otherwise be paying for
              </p>
              <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold tracking-[-0.03em] sm:tracking-[-0.04em] leading-[1.05]">
                A{" "}
                <span className="bg-gradient-to-r from-fuchsia-300 via-violet-300 to-indigo-300 bg-clip-text text-transparent tabular-nums">
                  $<CountUp to={5.27} duration={2000} decimals={2} />M
                </span>
                {" "}per year team.{" "}
                <span className="text-zinc-500 block sm:inline">Most teams don't have it.</span>
              </h2>
              <p className="mt-5 sm:mt-6 max-w-2xl mx-auto text-zinc-400 text-[15px] sm:text-base leading-relaxed">
                The fully-loaded annual cost of hiring the engineering and operations bench
                most companies need but never ship. Axiom doesn't replace that team —{" "}
                <span className="text-zinc-200">it gives the team you already have AI-assisted coverage across every discipline below</span>,
                with a human approval before any change runs.
              </p>
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
              <div
                key={d.name}
                className="group rounded-xl border border-white/[0.06] bg-white/[0.015] p-3.5 sm:p-4 hover:border-fuchsia-500/30 hover:bg-white/[0.03] transition"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[12.5px] sm:text-[13px] font-semibold text-white leading-tight">{d.name}</p>
                  <span className="text-[10px] font-mono text-fuchsia-300/80 whitespace-nowrap flex-shrink-0">{d.rate}</span>
                </div>
                <p className="mt-1.5 text-[11px] sm:text-[11.5px] text-zinc-500 leading-snug">{d.scope}</p>
              </div>
            ))}
          </Stagger>

          <Reveal direction="up" delay={0.1}>
            <div className="mt-10 sm:mt-12 text-center">
              <p className="text-[11px] sm:text-xs text-zinc-500 mb-5">
                Twelve of twenty-six disciplines shown. See the full list, each linked to the
                cockpit module that supports it.
              </p>
              <div className="inline-flex flex-wrap items-center justify-center gap-3">
                <Link
                  href="/disciplines"
                  className="inline-flex items-center gap-2 rounded-full bg-violet-500 px-5 py-2.5 text-[13px] font-medium text-white shadow-[0_0_24px_rgba(139,92,246,0.45)] hover:bg-violet-400 transition"
                >
                  See all 26 disciplines
                  <ArrowRightIcon className="h-3.5 w-3.5" />
                </Link>
                <Link
                  href="/plans"
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.02] px-5 py-2.5 text-[13px] font-medium text-zinc-200 hover:bg-white/[0.06] transition"
                >
                  See pricing
                </Link>
              </div>
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
            <div className="mb-12 sm:mb-16">
              <p className="text-xs sm:text-sm font-semibold text-violet-400 mb-3 sm:mb-4 tracking-wide uppercase">
                Operational Intelligence
              </p>
              <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-4 sm:mb-5 tracking-[-0.03em] sm:tracking-[-0.04em] leading-[1.1]">
                It doesn&apos;t alert.{" "}
                <span className="text-zinc-500">It operates.</span>
              </h2>
              <p className="text-dim-paragraph text-base sm:text-lg max-w-2xl leading-relaxed">
                Axiom scans your infrastructure, reasons about what matters, <span className="dim-1">builds execution plans, and applies approved changes</span> <span className="dim-2">— then learns from outcomes.</span>
              </p>
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
                  <TiltCard maxTilt={6} scale={1.012} glare>
                  <div className={`group glow-border-card animated-border card-inner-glow card-hover card-shine-sweep card-reactive warm-bottom-glow ${card.accentClass} rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 h-full backdrop-blur-sm hover:border-white/[0.12] transition-colors relative`}>
                    <div className="card-accent-overlay" />
                    <div className="relative z-10">
                      <div className="flex items-center gap-2.5 mb-4">
                        <span className="relative flex items-center justify-center">
                          <span className={`w-2 h-2 rounded-full ${card.dot} group-hover:status-dot-pulse`} />
                          <span className={`absolute inset-[-3px] rounded-full ${card.dot} opacity-0 group-hover:opacity-40 group-hover:animate-ping`} />
                        </span>
                        <Icon className={`h-5 w-5 icon-bounce ${card.dot === "bg-violet-500" ? "text-violet-400" : card.dot === "bg-fuchsia-500" ? "text-fuchsia-400" : "text-emerald-400"}`} />
                        <h3 className="text-base font-semibold">{card.title}</h3>
                        <span className="metric-counter ml-auto">{card.metric}</span>
                      </div>
                      <p className="text-sm text-zinc-400 mb-5 leading-relaxed">{card.desc}</p>
                      <ul className="text-sm text-zinc-500 space-y-2">
                        {card.items.map((item) => (
                          <li key={item.text} className="flex items-center gap-2">
                            <span className={`w-1 h-1 rounded-full ${item.dot}`} />
                            {item.text}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  </TiltCard>
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

      {/* ── How it works ───────────────────────────────────────────── */}
      <AnimateOnScroll>
        <section id="how-it-works" className="py-24 px-4 sm:px-6 lg:px-8">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <span className="huly-badge text-violet-400 border-violet-500/20 mb-4 inline-block">
                4 Phases · 12 Steps
              </span>
              <p className="text-sm font-semibold text-violet-400 mb-3 tracking-wide uppercase">
                How Axiom Operates
              </p>
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                The autonomous loop
              </h2>
              <p className="text-zinc-400 max-w-lg mx-auto">
                12 steps from connection to continuous operation. Every step is auditable.
              </p>
            </div>
            <ServicePipeline />
          </div>
        </section>
      </AnimateOnScroll>

      {/* ── Section Divider ────────────────────────────────────────── */}
      <SectionDivider />

      {/* ── Multi-cloud ────────────────────────────────────────────── */}
      <AnimateOnScroll>
      <section className="py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <div className="mb-12">
            <p className="text-sm font-semibold text-violet-400 mb-4 tracking-wide uppercase">
              Multi-Cloud Intelligence
            </p>
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-4 tracking-[-0.04em]">
              One agent.{" "}
              <span className="text-zinc-500">Every cloud.</span>
            </h2>
            <p className="text-dim-paragraph text-lg max-w-2xl leading-relaxed">
              Axiom&apos;s provider-abstraction layer normalizes infrastructure <span className="dim-1">across AWS, Azure, and GCP into a unified operational model.</span>
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-5 mb-5">
            {listProviders().map((p) => {
              const accent =
                p.provider === "aws" ? { text: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20", dot: "bg-emerald-400" } :
                p.provider === "azure" ? { text: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20", dot: "bg-blue-400" } :
                { text: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20", dot: "bg-red-400" };
              const summary = capabilitySummary(p.provider);
              const isOperational = p.status === "operational";
              const docsHref = p.authModel.docsHref;
              return (
                <a
                  key={p.provider}
                  href={docsHref}
                  className="block animated-border card-inner-glow card-hover card-shine-sweep rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 hover:border-white/[0.12] transition-colors group"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`w-10 h-10 rounded-xl ${accent.bg} border ${accent.border} flex items-center justify-center`}>
                      <span className={`text-sm font-bold ${accent.text}`}>{p.shortName}</span>
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-white">{p.displayName}</div>
                      <div className="flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${accent.dot} ${isOperational ? "" : "animate-pulse"}`} />
                        <span className={`text-[10px] font-semibold uppercase tracking-wider ${isOperational ? "text-emerald-400/80" : "text-zinc-500"}`}>
                          {isOperational ? "Full operations" : `${summary.live + summary.preview} live · ${summary.building + summary.planned} expanding`}
                        </span>
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-zinc-500 mb-4 leading-relaxed">{p.statusCopy}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {p.capabilities.slice(0, 8).map((cap) => {
                      const isLive = cap.status === "live" || cap.status === "preview";
                      const isBuilding = cap.status === "building" || cap.status === "planned";
                      return (
                        <span
                          key={cap.key}
                          title={cap.description}
                          className="inline-flex items-center gap-1 text-[10px] text-zinc-500 bg-white/[0.03] border border-white/[0.04] rounded-full px-2 py-0.5"
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${isLive ? "bg-emerald-400" : isBuilding ? "bg-amber-400/80" : "bg-zinc-700"}`} />
                          {cap.label.split(" ")[0]}
                        </span>
                      );
                    })}
                  </div>
                  <p className="mt-3 text-[10px] text-zinc-600 group-hover:text-zinc-400 transition-colors">
                    Read setup guide →
                  </p>
                </a>
              );
            })}
          </div>
          <div className="animated-border card-inner-glow rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
                <span className="text-sm font-bold text-violet-400">TF</span>
              </div>
              <div>
                <div className="text-sm font-semibold text-white">Terraform Native</div>
                <p className="text-xs text-zinc-500">Every execution plan generates validated IaC with dependency graphs and rollback strategies.</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-violet-400" />
              <span className="text-[10px] font-semibold text-violet-400/80 uppercase tracking-wider">Auto-generated</span>
            </div>
          </div>
        </div>
      </section>
      </AnimateOnScroll>

      {/* ── Section Divider ────────────────────────────────────────── */}
      <SectionDivider />

      {/* ── Platform Features (Huly-style 2x2 bento grid) ─────────── */}
      <section className="py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <Reveal direction="up" blur>
            <div className="mb-16">
              <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-[-0.04em] mb-4">
                Everything you need.{" "}
                <span className="text-zinc-500">Nothing you don&apos;t.</span>
              </h2>
              <p className="text-dim-paragraph text-lg max-w-xl leading-relaxed">
                A complete cloud operations platform <span className="dim-1">— from scanning to execution to continuous monitoring.</span>
              </p>
            </div>
          </Reveal>
          <Stagger delay={0.1} interval={0.08} className="grid md:grid-cols-2 gap-4">
            {[
              {
                icon: EyeIcon,
                title: "Deep Visibility.",
                desc: "Full infrastructure snapshot across cost, security, and configuration state. See everything — miss nothing.",
                visual: (
                  <div className="flex items-center gap-3 mt-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /><span className="text-[11px] text-zinc-500">142 resources scanned</span></div>
                      <div className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-amber-400" /><span className="text-[11px] text-zinc-500">14 findings detected</span></div>
                      <div className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-red-400" /><span className="text-[11px] text-zinc-500">4 critical issues</span></div>
                    </div>
                    <div className="w-16 h-16 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                      <span className="text-2xl font-bold text-emerald-400">A+</span>
                    </div>
                  </div>
                ),
              },
              {
                icon: CpuChipIcon,
                title: "AI Reasoning.",
                desc: "12-step cognitive loop that prioritizes and plans — not just alerts. Thinks like a senior cloud engineer.",
                visual: (
                  <div className="mt-4 flex gap-1.5">
                    {["Observe", "Interpret", "Reason", "Plan", "Execute", "Learn"].map((step, i) => (
                      <div key={step} className={`flex-1 h-1.5 rounded-full ${i < 4 ? "bg-violet-500" : i < 5 ? "bg-violet-500/40" : "bg-white/[0.06]"}`} />
                    ))}
                  </div>
                ),
              },
              {
                icon: CommandLineIcon,
                title: "Terraform Generation.",
                desc: "Auto-generated IaC with dependency-aware phased execution plans and pre-verified rollback strategies.",
                visual: (
                  <div className="mt-4 rounded-lg bg-black/40 border border-white/[0.04] p-3 font-mono text-[10px] text-zinc-500 leading-relaxed">
                    <span className="text-violet-400">resource</span> <span className="text-amber-400">&quot;aws_instance&quot;</span> <span className="text-zinc-600">{`{`}</span><br />
                    {"  "}<span className="text-zinc-400">instance_type</span> = <span className="text-emerald-400">&quot;t3.medium&quot;</span><br />
                    {"  "}<span className="text-zinc-600"># rightsized from m5.xlarge</span><br />
                    <span className="text-zinc-600">{`}`}</span>
                  </div>
                ),
              },
              {
                icon: ShieldCheckIcon,
                title: "Governance & Safety.",
                desc: "Approval gates, blast radius limits, compliance policy enforcement, and immutable audit trail.",
                visual: (
                  <div className="mt-4 space-y-2">
                    {[
                      { label: "Approval required", status: "Enforced", color: "text-emerald-400" },
                      { label: "Blast radius", status: "< 5 resources", color: "text-amber-400" },
                      { label: "Rollback verified", status: "Ready", color: "text-emerald-400" },
                    ].map((row) => (
                      <div key={row.label} className="flex items-center justify-between text-[11px]">
                        <span className="text-zinc-500">{row.label}</span>
                        <span className={`${row.color} font-medium`}>{row.status}</span>
                      </div>
                    ))}
                  </div>
                ),
              },
            ].map((feature) => {
              const Icon = feature.icon;
              return (
                <div key={feature.title} className="huly-feature-card group">
                  <div className="p-6">
                    <div className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center mb-4 group-hover:bg-white/[0.06] transition-colors">
                      <Icon className="h-5 w-5 text-zinc-400 group-hover:text-white transition-colors" />
                    </div>
                    <h3 className="text-lg font-bold text-white mb-2">{feature.title}</h3>
                    <p className="text-sm text-zinc-500 leading-relaxed">{feature.desc}</p>
                    {feature.visual}
                  </div>
                </div>
              );
            })}
          </Stagger>
        </div>
      </section>

      {/* ── Section Divider ────────────────────────────────────────── */}
      <SectionDivider />

      {/* ── Testimonials ───────────────────────────────────────────── */}
      <Reveal direction="up">
        <TestimonialsCarousel />
      </Reveal>

      {/* ── Section Divider ────────────────────────────────────────── */}
      <SectionDivider />

      {/* ── How Customers Use Axiom ──────────────────────────────── */}
      <section className="py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <Reveal direction="up" blur>
            <div className="mb-16">
              <p className="text-sm font-semibold text-violet-400 mb-4 tracking-wide uppercase">
                Use Cases
              </p>
              <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-5 tracking-[-0.04em]">
                Built for real{" "}
                <span className="text-zinc-500">infrastructure problems.</span>
              </h2>
              <p className="text-dim-paragraph text-lg max-w-2xl leading-relaxed">
                From cutting cloud spend to hardening security posture <span className="dim-1">and preventing drift — Axiom operates across the full stack.</span>
              </p>
            </div>
          </Reveal>
          <Stagger delay={0.1} interval={0.08} className="grid md:grid-cols-3 gap-5">
            {/* Cost Optimization */}
            <div className="glass-card animated-border card-accent-emerald card-shine-sweep card-reactive warm-bottom-glow rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 hover:border-emerald-500/20 transition-colors relative group">
              <div className="card-accent-overlay" />
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                    <CurrencyDollarIcon className="h-5 w-5 text-emerald-400 icon-bounce" />
                  </div>
                  <h3 className="text-base font-semibold">Cost Optimization</h3>
                </div>
                <ul className="text-sm text-zinc-400 space-y-2.5">
                  <li className="flex items-start gap-2">
                    <span className="w-1 h-1 rounded-full bg-emerald-400/60 mt-2 flex-shrink-0" />
                    Identify idle resources, oversized instances, and unused volumes
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-1 h-1 rounded-full bg-emerald-400/60 mt-2 flex-shrink-0" />
                    Generate rightsizing plans with estimated monthly savings
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-1 h-1 rounded-full bg-emerald-400/60 mt-2 flex-shrink-0" />
                    Continuous cost drift monitoring after changes
                  </li>
                </ul>
              </div>
            </div>
            {/* Security Hardening */}
            <div className="glass-card animated-border card-accent-red card-shine-sweep card-reactive warm-bottom-glow rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 hover:border-red-500/20 transition-colors relative group">
              <div className="card-accent-overlay" />
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-9 h-9 rounded-lg bg-red-500/10 flex items-center justify-center">
                    <LockClosedIcon className="h-5 w-5 text-red-400 icon-bounce" />
                  </div>
                  <h3 className="text-base font-semibold">Security Hardening</h3>
                </div>
                <ul className="text-sm text-zinc-400 space-y-2.5">
                  <li className="flex items-start gap-2">
                    <span className="w-1 h-1 rounded-full bg-red-400/60 mt-2 flex-shrink-0" />
                    Detect open security groups, public buckets, and IAM misconfigs
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-1 h-1 rounded-full bg-red-400/60 mt-2 flex-shrink-0" />
                    Severity-scored findings with remediation Terraform code
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-1 h-1 rounded-full bg-red-400/60 mt-2 flex-shrink-0" />
                    Compliance-aware scanning for SOC 2 and ISO 27001
                  </li>
                </ul>
              </div>
            </div>
            {/* Drift Prevention */}
            <div className="glass-card animated-border card-accent-violet card-shine-sweep card-reactive warm-bottom-glow rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 hover:border-violet-500/20 transition-colors relative group">
              <div className="card-accent-overlay" />
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-9 h-9 rounded-lg bg-violet-500/10 flex items-center justify-center">
                    <ArrowPathIcon className="h-5 w-5 text-violet-400 icon-bounce" />
                  </div>
                  <h3 className="text-base font-semibold">Drift Prevention</h3>
                </div>
                <ul className="text-sm text-zinc-400 space-y-2.5">
                  <li className="flex items-start gap-2">
                    <span className="w-1 h-1 rounded-full bg-violet-400/60 mt-2 flex-shrink-0" />
                    Baseline snapshots compared on every scheduled scan
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-1 h-1 rounded-full bg-violet-400/60 mt-2 flex-shrink-0" />
                    Field-level diff with classification by category
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-1 h-1 rounded-full bg-violet-400/60 mt-2 flex-shrink-0" />
                    Auto-generate remediation plans to restore desired state
                  </li>
                </ul>
              </div>
            </div>
          </Stagger>
        </div>
      </section>

      {/* ── Section Divider ────────────────────────────────────────── */}
      <SectionDivider />

      {/* ── ReleaseOps Callout ─────────────────────────────────────── */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        <div className="absolute -top-20 right-20 w-[500px] h-[300px] rounded-full bg-violet-600/[0.04] blur-[120px] pointer-events-none" aria-hidden />
        <div className="absolute -bottom-20 left-20 w-[400px] h-[300px] rounded-full bg-amber-500/[0.04] blur-[120px] pointer-events-none" aria-hidden />
        <div className="max-w-6xl mx-auto">
          <Reveal direction="up" blur>
            <Link
              href="/axiom/releaseops"
              className="block rounded-3xl border border-violet-500/15 bg-gradient-to-br from-violet-500/[0.05] via-transparent to-amber-500/[0.03] p-8 sm:p-10 lg:p-12 hover:border-violet-500/30 transition-all group relative overflow-hidden"
            >
              <div className="absolute -top-12 -right-12 w-64 h-64 rounded-full bg-violet-500/[0.08] blur-[60px] pointer-events-none" aria-hidden />
              <div className="absolute -bottom-12 -left-12 w-64 h-64 rounded-full bg-amber-500/[0.06] blur-[60px] pointer-events-none" aria-hidden />
              <div className="relative grid lg:grid-cols-5 gap-8 items-center">
                <div className="lg:col-span-3">
                  <div className="flex items-center gap-2 mb-4">
                    <ShieldCheckIcon className="h-4 w-4 text-violet-400" />
                    <span className="text-[10px] font-semibold text-violet-400 uppercase tracking-widest">
                      Axiom · ReleaseOps
                    </span>
                    <span className="text-[9px] font-semibold text-amber-400 bg-amber-500/15 border border-amber-500/30 rounded-full px-1.5 py-px uppercase tracking-wider">
                      New capability
                    </span>
                  </div>
                  <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-[-0.04em] mb-4">
                    Deployment governance.{" "}
                    <span className="text-zinc-500">Operational intelligence.</span>
                  </h2>
                  <p className="text-dim-paragraph text-base lg:text-lg max-w-2xl leading-relaxed mb-6">
                    The AI-native release governance and deployment intelligence layer of Axiom. <span className="dim-1">Coordinates releases across GitHub, GitLab, Azure DevOps, Jenkins, Terraform, and ServiceNow.</span> <span className="dim-2">Quantified readiness · approval orchestration · drift detection · rollback verification.</span>
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <span className="inline-flex items-center gap-2 text-amber-300 font-semibold text-sm group-hover:gap-3 transition-all">
                      Explore Axiom ReleaseOps
                      <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </div>
                </div>
                {/* Capability tiles */}
                <div className="lg:col-span-2 grid grid-cols-2 gap-2.5">
                  {[
                    { label: "GitHub · GitLab · Azure DevOps", icon: CommandLineIcon },
                    { label: "Terraform governance", icon: DocumentCheckIcon },
                    { label: "Rollback readiness", icon: ArrowPathIcon },
                    { label: "Approval orchestration", icon: ShieldCheckIcon },
                  ].map((tile) => {
                    const Icon = tile.icon;
                    return (
                      <div key={tile.label} className="rounded-xl bg-black/30 border border-white/[0.06] p-3.5">
                        <div className="w-8 h-8 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mb-2">
                          <Icon className="h-4 w-4 text-violet-400" />
                        </div>
                        <p className="text-xs text-zinc-300 leading-snug font-medium">{tile.label}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </Link>
          </Reveal>
        </div>
      </section>

      {/* ── Section Divider ────────────────────────────────────────── */}
      <SectionDivider />

      {/* ── FAQ ────────────────────────────────────────────────────── */}
      <AnimateOnScroll>
      <section id="faq" className="py-24 px-4 sm:px-6 lg:px-8" aria-labelledby="faq-heading">
        <div className="max-w-3xl mx-auto">
          <h2 id="faq-heading" className="text-center text-3xl md:text-4xl font-bold mb-12">
            Frequently asked questions
          </h2>
          <FAQAccordion items={axiomFAQ} />
        </div>
      </section>
      </AnimateOnScroll>

      {/* ── Section Divider ────────────────────────────────────────── */}
      <SectionDivider />

      {/* ── Desktop App Teaser ──────────────────────────────────── */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-violet-600/[0.02] to-transparent pointer-events-none" aria-hidden />
        <div className="max-w-5xl mx-auto">
          <Reveal direction="up" blur>
            <div className="mb-12">
              <span className="badge-shimmer badge-shimmer-border inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-medium mb-4 backdrop-blur-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Preview Build · Available Now
              </span>
              <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-4 tracking-[-0.04em]">
                Axiom on your{" "}
                <span className="text-gradient">desktop.</span>
              </h2>
              <p className="text-dim-paragraph text-lg max-w-2xl leading-relaxed">
                A native command center for autonomous cloud operations. <span className="dim-1">Secure local execution, real-time monitoring, and approval workflows</span> <span className="dim-2">— without opening a browser.</span>
              </p>
            </div>
          </Reveal>
          <Stagger delay={0.1} interval={0.08} className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
            {[
              { icon: CommandLineIcon, title: "Local Execution", desc: "Run Terraform and CLI operations from a secure local agent." },
              { icon: ShieldCheckIcon, title: "Approval Center", desc: "Review and approve execution plans with full audit context." },
              { icon: ChartBarIcon, title: "Live Monitoring", desc: "Real-time infrastructure health, drift alerts, and cost tracking." },
              { icon: BoltIcon, title: "Instant Notifications", desc: "Native alerts for scan results, findings, and approval requests." },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 hover:border-white/[0.12] transition-colors">
                  <div className="w-9 h-9 rounded-lg bg-violet-500/10 flex items-center justify-center mb-3">
                    <Icon className="h-4.5 w-4.5 text-violet-400" />
                  </div>
                  <h3 className="text-sm font-semibold text-white mb-1">{item.title}</h3>
                  <p className="text-xs text-zinc-500 leading-relaxed">{item.desc}</p>
                </div>
              );
            })}
          </Stagger>
          <Reveal direction="up" delay={0.2}>
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] p-8 text-center relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-violet-600/[0.03] via-transparent to-fuchsia-600/[0.03] pointer-events-none" aria-hidden />
              <div className="relative">
                <div className="flex items-center justify-center gap-6 mb-6">
                  {["macOS", "Windows", "Linux"].map((os) => (
                    <span key={os} className="text-sm font-medium text-zinc-400 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-violet-500/40" />
                      {os}
                    </span>
                  ))}
                </div>
                <p className="text-zinc-500 text-sm mb-5 max-w-md mx-auto">
                  Built with Tauri for minimal footprint, native performance, and enterprise-grade security. Your infrastructure data never leaves your machine.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <Link
                    href="/download"
                    className="btn-amber-shimmer inline-flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-semibold"
                  >
                    Download Axiom Agent
                    <ArrowRightIcon className="h-3.5 w-3.5" />
                  </Link>
                  <Link
                    href="/download"
                    className="inline-flex items-center gap-2 px-5 py-2.5 border border-white/[0.12] text-zinc-300 rounded-full text-sm font-medium hover:bg-white/5 hover:border-white/20 transition-all duration-200"
                  >
                    View all platforms
                  </Link>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Section Divider ────────────────────────────────────────── */}
      <SectionDivider />

      {/* ── CTA ────────────────────────────────────────────────────── */}
      <section className="py-32 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        <div className="absolute inset-0 diagonal-streak opacity-40 pointer-events-none" aria-hidden />
        <div className="absolute -top-20 -right-20 w-[500px] h-[500px] rounded-full bg-violet-600/12 blur-[150px] pointer-events-none" aria-hidden />
        <div className="absolute -bottom-20 -left-20 w-[500px] h-[500px] rounded-full bg-fuchsia-600/12 blur-[150px] pointer-events-none" aria-hidden />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] rounded-full bg-violet-500/5 blur-[100px] pointer-events-none" aria-hidden />

        <div className="relative max-w-4xl mx-auto flex flex-col md:flex-row items-center gap-12">
          {/* Glowing orb — Huly-style */}
          <div className="relative w-48 h-48 md:w-64 md:h-64 shrink-0">
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-violet-600/20 via-blue-500/15 to-fuchsia-600/20 blur-[40px] animate-pulse" />
            <div className="absolute inset-4 rounded-full bg-gradient-to-br from-violet-500/30 via-blue-400/20 to-fuchsia-500/30 blur-[20px]" />
            <div className="absolute inset-8 rounded-full border border-white/[0.08] bg-[#09090b]/60 backdrop-blur-xl flex items-center justify-center">
              <BoltIcon className="h-12 w-12 text-violet-400/80" />
            </div>
            <div className="ripple-ring" />
            <div className="ripple-ring" />
            <div className="ripple-ring" />
          </div>

          {/* Content */}
          <div className="text-center md:text-left">
            <h2 className="text-4xl md:text-5xl font-bold mb-5 tracking-[-0.04em]">
              Your first scan<br />takes <span className="text-gradient">5 minutes.</span>
            </h2>
            <p className="text-zinc-400 text-lg mb-4 max-w-md leading-relaxed">
              Connect a read-only IAM role. Axiom delivers your infrastructure intelligence report — cost savings, security findings, and execution plan — before your coffee gets cold.
            </p>
            <div className="flex flex-wrap gap-x-6 gap-y-1.5 text-sm text-zinc-500 mb-8 justify-center md:justify-start">
              <span className="flex items-center gap-1.5"><span className="w-1 h-1 rounded-full bg-emerald-500" />No credit card</span>
              <span className="flex items-center gap-1.5"><span className="w-1 h-1 rounded-full bg-emerald-500" />Read-only access</span>
              <span className="flex items-center gap-1.5"><span className="w-1 h-1 rounded-full bg-emerald-500" />Revoke anytime</span>
            </div>
            <div className="flex flex-wrap justify-center md:justify-start gap-4">
              {(() => {
                const primary = primaryCta("homepage_cta");
                const secondary = secondaryCta("homepage_cta");
                const fallback = fallbackCta("homepage_cta");
                return (
                  <>
                    {primary && (
                      <Link
                        href={primary.href}
                        className="btn-amber-shimmer inline-flex items-center gap-2 px-7 py-3.5 rounded-full font-semibold text-sm transition-colors"
                      >
                        {primary.label}
                        <ArrowRightIcon className="h-4 w-4" />
                      </Link>
                    )}
                    {secondary && (
                      <Link
                        href={secondary.href}
                        className="inline-flex items-center gap-2 px-7 py-3.5 border border-white/[0.12] text-zinc-300 rounded-full font-semibold text-sm hover:bg-white/5 hover:border-white/20 transition-colors"
                      >
                        {secondary.label}
                        <ArrowRightIcon className="h-4 w-4" />
                      </Link>
                    )}
                    {fallback && (
                      <Link
                        href={fallback.href}
                        className="inline-flex items-center gap-2 px-4 py-3.5 text-zinc-500 hover:text-zinc-300 text-sm transition-colors"
                      >
                        {fallback.label}
                      </Link>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <Footer />
      </div>
    </div>
  );
}
