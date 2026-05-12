"use client";

import Link from "next/link";
import Image from "next/image";
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
import {
  CurrencyDollarIcon,
  LockClosedIcon,
  ArrowPathIcon,
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
        className="ambient-particle w-1.5 h-1.5 bg-violet-400/40"
        style={{ top: "15%", left: "20%", animationDelay: "0s", animationDuration: "14s" }}
      />
      <div
        className="ambient-particle w-1 h-1 bg-fuchsia-400/30"
        style={{ top: "30%", right: "25%", animationDelay: "-3s", animationDuration: "11s" }}
      />
      <div
        className="ambient-particle w-2 h-2 bg-violet-300/20"
        style={{ top: "55%", left: "65%", animationDelay: "-6s", animationDuration: "16s" }}
      />
      <div
        className="ambient-particle w-1 h-1 bg-fuchsia-300/30"
        style={{ top: "70%", left: "35%", animationDelay: "-9s", animationDuration: "13s" }}
      />
      <div
        className="ambient-particle w-1.5 h-1.5 bg-violet-500/25"
        style={{ top: "45%", right: "15%", animationDelay: "-4s", animationDuration: "15s" }}
      />
    </div>
  );
}

/* ── Section divider ─────────────────────────────────────────── */
function SectionDivider() {
  return <div className="section-divider" />;
}

/* ── Social icon SVGs ────────────────────────────────────────── */
function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
    </svg>
  );
}

function LinkedInIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
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
              <div className="absolute inset-0 beam-sweep rounded-2xl" aria-hidden />
              <AnimatedButton
                href="/operator/onboarding"
                variant="primary"
                className="btn-huly cta-glow shadow-lg shadow-violet-500/20 relative z-10"
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
              <p className="text-sm font-semibold text-violet-400 mb-3 tracking-wide uppercase">
                What Axiom Delivers
              </p>
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Operational intelligence, not dashboards
              </h2>
              <p className="text-zinc-400 max-w-xl mx-auto">
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
                  <div className={`group glow-border-card animated-border card-inner-glow card-hover ${card.accentClass} rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 h-full backdrop-blur-sm hover:border-white/[0.12] transition-colors relative`}>
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
            <p className="text-sm font-semibold text-violet-400 mb-3 tracking-wide uppercase">
              Platform Support
            </p>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Multi-cloud support
            </h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { name: "AWS", status: "Full support", statusColor: "bg-emerald-500", textAccent: "text-amber-500", desc: "Scan, plan, and execute" },
              { name: "Azure", status: "Scan only", statusColor: "bg-amber-500", textAccent: "text-blue-400", desc: "Plan and execute on roadmap" },
              { name: "GCP", status: "Scan only", statusColor: "bg-amber-500", textAccent: "text-red-400", desc: "Plan and execute on roadmap" },
              { name: "Terraform", status: "Auto-generated", statusColor: "bg-violet-500", textAccent: "text-violet-400", desc: "IaC plans with rollback" },
            ].map((p) => (
              <div key={p.name} className="animated-border card-inner-glow card-hover rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 text-center hover:border-white/[0.12] transition-colors">
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
              <p className="text-sm font-semibold text-violet-400 mb-3 tracking-wide uppercase">
                Use Cases
              </p>
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                How customers use Axiom
              </h2>
              <p className="text-zinc-400 max-w-xl mx-auto">
                From cutting cloud spend to hardening security posture and preventing drift — Axiom operates across the full stack.
              </p>
            </div>
          </Reveal>
          <Stagger delay={0.1} interval={0.08} className="grid md:grid-cols-3 gap-5">
            {/* Cost Optimization */}
            <div className="glass-card animated-border card-accent-emerald rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 hover:border-emerald-500/20 transition-colors relative group">
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
            <div className="glass-card animated-border card-accent-red rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 hover:border-red-500/20 transition-colors relative group">
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
            <div className="glass-card animated-border card-accent-violet rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 hover:border-violet-500/20 transition-colors relative group">
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

      {/* ── CTA ────────────────────────────────────────────────────── */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        <div className="absolute inset-0 diagonal-streak opacity-40" aria-hidden />
        {/* Dual glow orbs with higher opacity */}
        <div className="absolute -top-20 -right-20 w-[500px] h-[500px] rounded-full bg-violet-600/12 blur-[150px]" aria-hidden />
        <div className="absolute -bottom-20 -left-20 w-[500px] h-[500px] rounded-full bg-fuchsia-600/12 blur-[150px]" aria-hidden />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] rounded-full bg-violet-500/5 blur-[100px]" aria-hidden />
        <div className="relative max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-5xl font-bold mb-5 tracking-[-0.04em]">
            Your cloud, operated by an<br className="hidden sm:block" />
            agent <span className="text-gradient">you control</span>
          </h2>
          <p className="text-zinc-400 text-lg mb-10 max-w-lg mx-auto">
            Connect your AWS account. Axiom scans, reasons, plans, and executes — nothing changes until you approve.
          </p>
          <div className="flex flex-wrap justify-center gap-4 mb-4">
            <Link
              href="/operator/onboarding"
              className="cta-white-glow inline-flex items-center gap-2 px-8 py-4 bg-white text-zinc-900 rounded-xl font-semibold text-sm shadow-lg hover:bg-zinc-100 transition-colors"
            >
              Run Axiom
              <ArrowRightIcon className="h-4 w-4" />
            </Link>
            <Link
              href="/operator/pricing"
              className="inline-flex items-center gap-2 px-8 py-4 border border-white/[0.12] text-zinc-300 rounded-xl font-semibold text-sm hover:bg-white/5 hover:border-white/20 transition-colors"
            >
              View plans
            </Link>
          </div>
          <p className="text-xs text-zinc-600 mb-6">No credit card required</p>
          <a
            href="mailto:support@visionxixlabs.com"
            className="text-sm text-zinc-500 hover:text-white transition-colors"
          >
            support@visionxixlabs.com
          </a>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <footer className="py-16 px-4 sm:px-6 lg:px-8">
        {/* Gradient line divider */}
        <div className="gradient-line mb-16" />
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-4 gap-10 mb-12">
            <div className="md:col-span-2">
              <div className="flex items-center space-x-3 mb-5">
                <Image
                  src="/vision-xix-logo.png"
                  alt="Vision XIX Labs"
                  width={32}
                  height={32}
                  className="rounded-lg"
                />
                <span className="text-lg font-bold text-gradient">
                  Vision XIX Labs
                </span>
              </div>
              <p className="text-zinc-500 text-sm leading-relaxed max-w-sm mb-6">
                Axiom is an autonomous cloud operations agent. It scans, reasons, plans, and executes — with governance, rollback, and full audit trail. You stay in control.
              </p>
              {/* Social links */}
              <div className="flex items-center gap-3">
                <a
                  href="https://github.com/visionxixlabs"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="social-link"
                  aria-label="GitHub"
                >
                  <GitHubIcon className="h-4 w-4" />
                </a>
                <a
                  href="https://linkedin.com/company/visionxixlabs"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="social-link"
                  aria-label="LinkedIn"
                >
                  <LinkedInIcon className="h-4 w-4" />
                </a>
                <a
                  href="https://x.com/visionxixlabs"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="social-link"
                  aria-label="X (Twitter)"
                >
                  <XIcon className="h-4 w-4" />
                </a>
              </div>
            </div>
            <div>
              <h4 className="font-semibold mb-4 text-sm">Product</h4>
              <ul className="space-y-2.5 text-sm text-zinc-500">
                <li><Link href="/operator/onboarding" className="hover:text-white transition-colors">Run Axiom</Link></li>
                <li><Link href="/operator/pricing" className="hover:text-white transition-colors">Pricing</Link></li>
                <li><Link href="/axiom" className="hover:text-white transition-colors">About Axiom</Link></li>
                <li><Link href="/axiom/operations" className="hover:text-white transition-colors">Operations</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4 text-sm">Company</h4>
              <ul className="space-y-2.5 text-sm text-zinc-500">
                <li><Link href="/contact" className="hover:text-white transition-colors">Contact</Link></li>
                <li><a href="mailto:support@visionxixlabs.com" className="hover:text-white transition-colors">Support</a></li>
                <li><Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link></li>
                <li><Link href="/terms" className="hover:text-white transition-colors">Terms</Link></li>
                <li><Link href="/security" className="hover:text-white transition-colors">Security</Link></li>
              </ul>
            </div>
          </div>

          {/* Made with passion tagline */}
          <div className="text-center mb-8">
            <p className="text-xs text-zinc-600">Made with passion in NYC</p>
          </div>

          {/* Bottom bar with dot separators */}
          <div className="gradient-line mb-8" />
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-zinc-600 text-sm">
              &copy; {new Date().getFullYear()} Vision XIX Labs LLC. All rights reserved.
            </p>
            <div className="flex items-center gap-2 text-sm text-zinc-600">
              <Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link>
              <span className="text-zinc-700">&middot;</span>
              <Link href="/terms" className="hover:text-white transition-colors">Terms</Link>
              <span className="text-zinc-700">&middot;</span>
              <Link href="/security" className="hover:text-white transition-colors">Security</Link>
            </div>
          </div>
        </div>
      </footer>
      </div>
    </div>
  );
}
