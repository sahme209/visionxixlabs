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
import { TestimonialsCarousel } from "@/components/TestimonialsCarousel";
import { FAQAccordion } from "@/components/FAQAccordion";
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
  "AWS Partner", "SOC 2 Type II", "ISO 27001", "GDPR", "Terraform",
  "Read-only IAM", "Approval Gates", "Immutable Audit", "Rollback Ready", "Outcome Memory",
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
      <div className="absolute inset-0 bg-grid-mesh opacity-40" aria-hidden />
      <div className="relative z-10">
      <Navigation />

      {/* ── Hero ───────────────────────────────────────────────────── */}
      <section className="pt-32 pb-24 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        <RealisticFogBackground backgroundColor="transparent" opacity={0.3} darken contained />
        {/* Hero-specific grid mesh overlay */}
        <div className="absolute inset-0 hero-grid-mesh opacity-60" aria-hidden />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] spotlight-orb opacity-60" aria-hidden />
        <div className="absolute top-40 -right-40 w-[500px] h-[500px] rounded-full bg-violet-600/5 blur-[120px]" aria-hidden />
        <div className="absolute top-60 -left-40 w-[400px] h-[400px] rounded-full bg-fuchsia-600/5 blur-[120px]" aria-hidden />
        <div className="hero-beam-vertical" aria-hidden />

        {/* Floating ambient particles */}
        <AmbientParticles />

        {/* Hero noise grain overlay */}
        <div className="hero-noise-grain" aria-hidden />

        <div className="max-w-4xl mx-auto text-center relative">
          <Reveal direction="up" blur>
            <span className="badge-shimmer badge-shimmer-border inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.08] text-zinc-300 text-sm font-medium mb-8 backdrop-blur-sm cursor-default">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Autonomous Cloud Operations
            </span>
          </Reveal>
          <Reveal direction="up" blur delay={0.04}>
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold mb-6 leading-[1.05] tracking-[-0.04em]">
              {["Infrastructure", "intelligence"].map((word, i) => (
                <span key={word} className={`hero-word hero-word-${i}`}>{word} </span>
              ))}
              <br className="hidden sm:block" />
              {["that", "operates"].map((word, i) => (
                <span key={word} className={`hero-word hero-word-${i + 2}`}>{word} </span>
              ))}
              <span className="hero-word hero-word-4 text-gradient">autonomously.</span>
            </h1>
          </Reveal>
          <Reveal direction="up" delay={0.06}>
            <p className="text-lg md:text-xl text-zinc-400 mb-10 max-w-2xl mx-auto leading-relaxed">
              Axiom scans your cloud, identifies issues, reasons about priority and risk, generates execution plans, and applies approved changes — with continuous drift monitoring and outcome learning.
            </p>
          </Reveal>
          <Stagger delay={0.12}>
            {/* Beam sweep effect behind CTA buttons */}
            <div className="relative flex flex-wrap justify-center gap-4 mb-10">
              <div className="absolute inset-0 beam-sweep rounded-2xl pointer-events-none" aria-hidden />
              <AnimatedButton
                href="/operator/onboarding"
                variant="primary"
                className="btn-amber-shimmer cta-glow shadow-lg shadow-violet-500/20 relative z-10 rounded-full text-zinc-900 font-semibold"
              >
                Run Axiom
                <ArrowRightIcon className="ml-2 h-4 w-4" />
              </AnimatedButton>
              <AnimatedButton
                href="/axiom"
                variant="ghost"
                className="border-white/10 text-zinc-300 hover:bg-white/5 hover:border-white/20 relative z-10"
              >
                How it works
              </AnimatedButton>
            </div>
          </Stagger>
          <Reveal direction="up" delay={0.2}>
            <p className="text-sm text-zinc-500">
              Read-only by default · No changes without your approval · Full audit trail
            </p>
          </Reveal>
          <Reveal direction="up" delay={0.3}>
            <div className="mt-8 flex flex-wrap justify-center gap-x-8 gap-y-2 text-xs text-zinc-500">
              {["Assume-role model", "Approval enforcement", "Rollback capability", "Immutable audit trail"].map((item) => (
                <span key={item} className="flex items-center gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-emerald-500" />
                  {item}
                </span>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Section Divider ────────────────────────────────────────── */}
      <SectionDivider />

      {/* ── Trust Marquee ──────────────────────────────────────────── */}
      <section className="py-8 overflow-hidden relative">
        <div className="absolute inset-0 bg-white/[0.01]" aria-hidden />
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

      {/* ── Capabilities ───────────────────────────────────────────── */}
      <section className="py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <Reveal direction="up">
            <div className="text-center mb-16">
              <p className="text-sm font-semibold text-violet-400 mb-4 tracking-wide uppercase">
                What Axiom Delivers
              </p>
              <h2 className="text-4xl md:text-5xl font-bold mb-5 tracking-[-0.04em]">
                Operational intelligence.<br className="hidden sm:block" />
                <span className="text-zinc-500">Not dashboards.</span>
              </h2>
              <p className="text-zinc-400 text-lg max-w-xl mx-auto">
                Axiom doesn&apos;t show you charts. It scans, reasons, and acts — then reports what it did and why.
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
                metric: "99.9% SLA",
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
          <div className="text-center mb-12">
            <p className="text-sm font-semibold text-violet-400 mb-4 tracking-wide uppercase">
              Platform Support
            </p>
            <h2 className="text-4xl md:text-5xl font-bold mb-4 tracking-[-0.04em]">
              Multi-cloud.<br className="hidden sm:block" />
              <span className="text-zinc-500">One agent.</span>
            </h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { name: "AWS", status: "Full support", statusColor: "bg-emerald-500", textAccent: "text-amber-500", desc: "Scan, plan, and execute" },
              { name: "Azure", status: "Scan only", statusColor: "bg-amber-500", textAccent: "text-blue-400", desc: "Plan and execute on roadmap" },
              { name: "GCP", status: "Scan only", statusColor: "bg-amber-500", textAccent: "text-red-400", desc: "Plan and execute on roadmap" },
              { name: "Terraform", status: "Auto-generated", statusColor: "bg-violet-500", textAccent: "text-violet-400", desc: "IaC plans with rollback" },
            ].map((p) => (
              <div key={p.name} className="animated-border card-inner-glow card-hover card-shine-sweep card-reactive rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 text-center hover:border-white/[0.12] transition-colors">
                <div className={`text-xl font-bold mb-2 ${p.textAccent}`}>{p.name}</div>
                <div className="flex items-center justify-center gap-1.5 mb-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${p.statusColor}`} />
                  <span className="text-xs font-medium text-zinc-400">{p.status}</span>
                </div>
                <div className="text-xs text-zinc-500">{p.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
      </AnimateOnScroll>

      {/* ── Section Divider ────────────────────────────────────────── */}
      <SectionDivider />

      {/* ── Platform Features Grid (Huly-style icon grid) ─────────── */}
      <section className="py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <Reveal direction="up" blur>
            <div className="text-center mb-16">
              <h2 className="text-4xl md:text-5xl font-bold tracking-[-0.04em] mb-4">
                Everything you need.<br />
                <span className="text-zinc-500">Nothing you don&apos;t.</span>
              </h2>
              <p className="text-zinc-400 text-lg max-w-xl mx-auto">
                A complete cloud operations platform — from scanning to execution.
              </p>
            </div>
          </Reveal>
          <Stagger delay={0.1} interval={0.06} className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              { icon: EyeIcon, title: "Deep Visibility", desc: "Full infrastructure snapshot across cost, security, and configuration state." },
              { icon: CpuChipIcon, title: "AI Reasoning", desc: "12-step cognitive loop that prioritizes and plans — not just alerts." },
              { icon: CommandLineIcon, title: "Terraform Generation", desc: "Auto-generated IaC with dependency-aware phased execution plans." },
              { icon: ShieldCheckIcon, title: "Governance & Safety", desc: "Approval gates, blast radius limits, and compliance policy enforcement." },
              { icon: ChartBarIcon, title: "Outcome Learning", desc: "Every action recorded. Failed actions auto-downgrade future recommendations." },
              { icon: DocumentCheckIcon, title: "Audit Trail", desc: "Immutable log of every scan, plan, approval, and execution." },
            ].map((feature) => {
              const Icon = feature.icon;
              return (
                <Reveal key={feature.title} direction="up">
                  <div className="group flex items-start gap-4 p-1">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0 group-hover:bg-blue-500/15 transition-colors">
                      <Icon className="h-5 w-5 text-blue-400" />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-white mb-1">{feature.title}</h3>
                      <p className="text-sm text-zinc-500 leading-relaxed">{feature.desc}</p>
                    </div>
                  </div>
                </Reveal>
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
            <div className="text-center mb-16">
              <p className="text-sm font-semibold text-violet-400 mb-4 tracking-wide uppercase">
                Use Cases
              </p>
              <h2 className="text-4xl md:text-5xl font-bold mb-5 tracking-[-0.04em]">
                Built for real<br className="hidden sm:block" />
                <span className="text-zinc-500">infrastructure problems.</span>
              </h2>
              <p className="text-zinc-400 text-lg max-w-xl mx-auto">
                From cutting cloud spend to hardening security posture and preventing drift — Axiom operates across the full stack.
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

      {/* ── CTA — Huly "Join the Movement" style ────────────────── */}
      <section className="py-32 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        <div className="absolute inset-0 diagonal-streak opacity-40" aria-hidden />
        <div className="absolute -top-20 -right-20 w-[500px] h-[500px] rounded-full bg-violet-600/12 blur-[150px]" aria-hidden />
        <div className="absolute -bottom-20 -left-20 w-[500px] h-[500px] rounded-full bg-fuchsia-600/12 blur-[150px]" aria-hidden />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] rounded-full bg-violet-500/5 blur-[100px]" aria-hidden />

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
              Join the<br />Movement
            </h2>
            <p className="text-zinc-400 text-lg mb-8 max-w-md leading-relaxed">
              Connect your AWS account. Axiom scans, reasons, plans, and executes — nothing changes until you approve.
            </p>
            <div className="flex flex-wrap justify-center md:justify-start gap-4">
              <Link
                href="/operator/onboarding"
                className="btn-amber-shimmer inline-flex items-center gap-2 px-7 py-3.5 bg-white text-zinc-900 rounded-full font-semibold text-sm shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:bg-zinc-100 transition-colors"
              >
                Run Axiom
                <ArrowRightIcon className="h-4 w-4" />
              </Link>
              <Link
                href="/operator/pricing"
                className="inline-flex items-center gap-2 px-7 py-3.5 border border-white/[0.12] text-zinc-300 rounded-full font-semibold text-sm hover:bg-white/5 hover:border-white/20 transition-colors"
              >
                View plans
              </Link>
            </div>
            <p className="text-xs text-zinc-600 mt-4">No credit card required</p>
          </div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <Footer />
      </div>
    </div>
  );
}
