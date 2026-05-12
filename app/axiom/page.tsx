"use client";

import Link from "next/link";
import { Footer } from "@/components/Footer";
import {
  CloudIcon,
  ChartBarIcon,
  ShieldCheckIcon,
  BoltIcon,
  ArrowRightIcon,
  CpuChipIcon,
  EyeIcon,
  ArrowPathIcon,
  DocumentCheckIcon,
  CheckCircleIcon,
  LockClosedIcon,
  ClockIcon,
  ServerStackIcon,
  CommandLineIcon,
  ExclamationTriangleIcon,
  MagnifyingGlassIcon,
} from "@heroicons/react/24/outline";
import { Navigation } from "@/components/Navigation";
import { Reveal } from "@/components/motion/Reveal";
import { Stagger } from "@/components/motion/Stagger";

// ---------------------------------------------------------------------------
// Workflow steps — the 12-step autonomous loop
// ---------------------------------------------------------------------------

const WORKFLOW_STEPS = [
  { label: "Connect", icon: CloudIcon, desc: "Link AWS, Azure, or GCP with read-only IAM roles" },
  { label: "Scan", icon: MagnifyingGlassIcon, desc: "Deep infrastructure inventory across all regions" },
  { label: "Identify", icon: ExclamationTriangleIcon, desc: "Surface cost waste, security gaps, and drift" },
  { label: "Reason", icon: CpuChipIcon, desc: "AI-native analysis of risk, impact, and priority" },
  { label: "Plan", icon: DocumentCheckIcon, desc: "Generate phased execution plans with rollback" },
  { label: "Generate", icon: CommandLineIcon, desc: "Produce Terraform, CLI scripts, or SDK actions" },
  { label: "Approve", icon: ShieldCheckIcon, desc: "Human-in-the-loop approval with full context" },
  { label: "Apply", icon: BoltIcon, desc: "Execute approved changes with pre-verified safety" },
  { label: "Verify", icon: CheckCircleIcon, desc: "Post-apply verification confirms expected state" },
  { label: "Audit", icon: LockClosedIcon, desc: "Immutable audit trail with before/after state" },
  { label: "Monitor", icon: EyeIcon, desc: "Continuous drift detection against known baselines" },
  { label: "Learn", icon: ArrowPathIcon, desc: "Outcome memory informs future recommendations" },
];

// ---------------------------------------------------------------------------
// Capability sections
// ---------------------------------------------------------------------------

const CAPABILITIES = [
  {
    title: "Autonomous scanning",
    subtitle: "Deep infrastructure intelligence",
    desc: "Full resource inventory across regions and services. Cost signals, security posture, resilience scoring, and resource lifecycle analysis — generated from real cloud SDK data, not shallow metadata.",
    points: [
      "Multi-region resource discovery (EC2, S3, IAM, VPC, RDS, Lambda)",
      "Real-time cost signal derivation with confidence scoring",
      "Resilience posture assessment with regional concentration analysis",
      "Scheduled scans with automatic drift comparison",
    ],
    icon: ServerStackIcon,
  },
  {
    title: "Execution safety",
    subtitle: "Every action is reversible",
    desc: "Before any change is applied, Axiom runs prechecks, simulates dry runs, estimates blast radius, and generates rollback plans. Nothing executes without verified safety and explicit approval.",
    points: [
      "Pre-execution prechecks with blocking/warning tiers",
      "Dry run simulation with downtime and rollback complexity estimates",
      "Per-action rollback plan with state capture",
      "Post-apply verification confirms the change achieved expected state",
    ],
    icon: ShieldCheckIcon,
  },
  {
    title: "Intelligent prioritization",
    subtitle: "Not just what to fix — what to fix first",
    desc: "Findings are ranked by a multi-signal priority model: severity, confidence, estimated savings, risk level, blast radius, and organizational preferences. Auto-fix candidates are separated from approval-required actions.",
    points: [
      "Preference-aware priority scoring with organization overrides",
      "Autopilot modes: Observe, Recommend, or Execute",
      "Outcome-aware safety gates — prior failures block auto-fix",
      "Ignored-resource filtering respects organizational policy",
    ],
    icon: ChartBarIcon,
  },
  {
    title: "Continuous drift detection",
    subtitle: "Know when infrastructure changes unexpectedly",
    desc: "Every scan compares current state against the previous baseline. Drift items are classified by category — configuration mutation, security regression, cost deviation, compliance violation — and persisted as findings with remediation guidance.",
    points: [
      "Snapshot-to-snapshot comparison with field-level diff",
      "10 drift detection rules covering security, cost, resilience, compliance",
      "Severity-ranked drift report with blast radius assessment",
      "Audit events for every detected drift",
    ],
    icon: EyeIcon,
  },
];

// ---------------------------------------------------------------------------
// Enterprise trust signals
// ---------------------------------------------------------------------------

const TRUST_SIGNALS = [
  {
    title: "Approval enforcement",
    desc: "Every infrastructure change requires explicit human approval. Scheduled scans never auto-apply. The agent never escalates its own autonomy.",
  },
  {
    title: "Immutable audit trail",
    desc: "Before/after state capture, timestamps, actor identity, and decision rationale for every action. Full chain of custody from finding to verification.",
  },
  {
    title: "Rollback capability",
    desc: "Pre-computed rollback plans for every action. State captured before execution. Verified after apply. Rollback instructions saved in the audit log.",
  },
  {
    title: "Outcome memory",
    desc: "The agent remembers what worked and what failed. Resources with prior failures are automatically downgraded from auto-fix to human review.",
  },
  {
    title: "Governance policies",
    desc: "Organization-level preferences for risk tolerance, ignored resources, severity thresholds, and autopilot mode. Policies are applied before recommendations are generated.",
  },
  {
    title: "Read-only by default",
    desc: "Cloud connections use read-only IAM roles. Write access is scoped, temporary, and only activated during approved execution windows.",
  },
];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AxiomPage() {
  return (
    <div className="min-h-screen bg-[#09090b] text-white relative">
      <div className="absolute inset-0 bg-grid-mesh opacity-30 pointer-events-none" aria-hidden />
      <div className="absolute inset-0 noise-grain pointer-events-none" aria-hidden />
      <div className="relative z-10">
      <Navigation />

      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] spotlight-orb opacity-50 pointer-events-none" aria-hidden />
        <div className="absolute -top-40 -left-60 w-[500px] h-[500px] rounded-full bg-indigo-500/[0.07] blur-[120px] pointer-events-none" aria-hidden />
        <div className="absolute -top-20 -right-40 w-[400px] h-[400px] rounded-full bg-blue-500/[0.05] blur-[100px] pointer-events-none" aria-hidden />
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-20 text-center">
          <Reveal direction="up" blur delay={0}>
            <div className="inline-flex items-center gap-2 huly-badge px-4 py-1.5 text-sm font-medium text-zinc-300 mb-8">
              <CpuChipIcon className="h-4 w-4" />
              Autonomous Cloud Operations
            </div>
          </Reveal>
          <Reveal direction="up" blur delay={0.1}>
            <h1 className="text-4xl sm:text-5xl lg:text-7xl font-extrabold tracking-[-0.04em] text-white mb-6 leading-[1.05]">
              The agent that<br className="hidden sm:block" />
              <span className="text-gradient">runs your cloud.</span>
            </h1>
          </Reveal>
          <Reveal direction="up" blur delay={0.2}>
            <p className="text-lg sm:text-xl text-zinc-400 max-w-2xl mx-auto mb-6 leading-relaxed">
              Axiom scans your AWS infrastructure, identifies $12K+/mo in savings, hardens security, and generates Terraform execution plans — with approval gates, rollback strategies, and an immutable audit trail.
            </p>
          </Reveal>
          <Reveal direction="up" blur delay={0.25}>
            <div className="flex flex-wrap justify-center gap-x-8 gap-y-2 text-sm text-zinc-500 mb-10">
              {["30–40% cost reduction", "Security hardening in minutes", "5-minute setup"].map((item) => (
                <span key={item} className="flex items-center gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-emerald-500" />
                  {item}
                </span>
              ))}
            </div>
          </Reveal>
          <Reveal direction="up" blur delay={0.3}>
            <div className="flex flex-wrap justify-center gap-4">
              <Link
                href="/operator/onboarding"
                className="btn-huly inline-flex items-center gap-2 px-8 py-3.5 bg-white text-zinc-900 rounded-full font-semibold text-sm uppercase tracking-wide hover:bg-zinc-100 transition-all shadow-lg shadow-white/10"
              >
                Start free scan
                <ArrowRightIcon className="h-4 w-4" />
              </Link>
              <Link
                href="/operator/pricing"
                className="btn-huly inline-flex items-center gap-2 px-8 py-3.5 border border-white/[0.12] text-zinc-300 rounded-full font-semibold text-sm uppercase tracking-wide hover:bg-white/[0.05] hover:border-white/[0.20] transition-all"
              >
                View Pricing
              </Link>
            </div>
          </Reveal>
          <Reveal direction="up" blur delay={0.35}>
            <div className="mt-6 flex items-center justify-center gap-4">
              <Link
                href="/axiom/operations"
                className="text-xs font-medium text-violet-400 hover:text-violet-300 transition-colors"
              >
                Operations dashboard &rarr;
              </Link>
              <span className="text-zinc-700">·</span>
              <span className="text-xs text-zinc-600">AWS full ops · Azure &amp; GCP expanding</span>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Autonomous Workflow ────────────────────────────────────────── */}
      <div className="section-divider" />
      <section className="py-24">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal direction="up" blur>
            <div className="text-center mb-16">
              <span className="huly-badge text-xs font-semibold text-violet-400 mb-3 tracking-wide uppercase px-3 py-1">
                How Axiom Operates
              </span>
              <h2 className="text-4xl md:text-5xl font-extrabold tracking-[-0.04em] text-white mb-4 mt-4">
                A complete autonomous loop.<br className="hidden sm:block" />
                <span className="text-zinc-500">From scan to verified execution.</span>
              </h2>
              <p className="text-zinc-400 max-w-xl mx-auto">
                Every scan executes a 12-step cycle — from infrastructure discovery through execution verification to outcome learning. The loop runs continuously on schedule.
              </p>
            </div>
          </Reveal>
          <Stagger delay={0.1} interval={0.04} className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {WORKFLOW_STEPS.map((step, i) => {
              const Icon = step.icon;
              return (
                <div
                  key={step.label}
                  className="animated-border card-inner-glow card-hover card-shine-sweep card-reactive group relative rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 hover:border-white/[0.12] transition-all"
                >
                  <div className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-md bg-violet-500/10 flex items-center justify-center text-xs font-bold text-violet-400">
                      {i + 1}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Icon className="h-3.5 w-3.5 text-zinc-500 icon-bounce" />
                        <span className="text-sm font-semibold text-white">
                          {step.label}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-500 leading-relaxed">
                        {step.desc}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </Stagger>
        </div>
      </section>

      {/* ── Capabilities ──────────────────────────────────────────────── */}
      <div className="section-divider" />
      <section className="py-24 relative">
        <div className="absolute top-1/2 left-0 -translate-y-1/2 w-[400px] h-[400px] rounded-full bg-indigo-500/[0.04] blur-[120px] pointer-events-none" aria-hidden />
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <Reveal direction="up" blur>
            <div className="text-center mb-16">
              <span className="huly-badge text-xs font-semibold text-violet-400 mb-3 tracking-wide uppercase px-3 py-1">
                Capabilities
              </span>
              <h2 className="text-4xl md:text-5xl font-extrabold tracking-[-0.04em] text-white mb-4 mt-4">
                Deep operational<br className="hidden sm:block" />
                <span className="text-zinc-500">intelligence.</span>
              </h2>
              <p className="text-zinc-400 max-w-xl mx-auto">
                Every capability is built on real cloud SDK data — scanning, reasoning, and executing against live infrastructure with full safety guarantees.
              </p>
            </div>
          </Reveal>
          <Stagger delay={0.1} interval={0.08} className="space-y-8">
            {CAPABILITIES.map((cap, idx) => {
              const Icon = cap.icon;
              const accentColors = [
                { bg: "bg-violet-500/10", text: "text-violet-400", check: "text-emerald-400" },
                { bg: "bg-fuchsia-500/10", text: "text-fuchsia-400", check: "text-violet-400" },
                { bg: "bg-cyan-500/10", text: "text-cyan-400", check: "text-cyan-400" },
                { bg: "bg-emerald-500/10", text: "text-emerald-400", check: "text-emerald-400" },
              ];
              const accent = accentColors[idx % accentColors.length];
              return (
                <div
                  key={cap.title}
                  className="axiom-cap-row animated-border card-inner-glow glow-border-card card-hover card-shine-sweep card-reactive rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8 hover:border-white/[0.12] transition-all group"
                >
                  <div className="flex items-start gap-4 mb-4">
                    <div className={`axiom-cap-icon-wrap flex-shrink-0 w-10 h-10 rounded-xl ${accent.bg} flex items-center justify-center`}>
                      <Icon className={`h-5 w-5 ${accent.text} icon-bounce`} />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white">{cap.title}</h3>
                      <p className={`text-sm ${accent.text} font-medium`}>{cap.subtitle}</p>
                    </div>
                  </div>
                  <p className="text-zinc-400 mb-5 leading-relaxed">{cap.desc}</p>
                  <ul className="grid sm:grid-cols-2 gap-2">
                    {cap.points.map((point) => (
                      <li key={point} className="flex items-start gap-2 text-sm text-zinc-300">
                        <CheckCircleIcon className={`h-4 w-4 ${accent.check} flex-shrink-0 mt-0.5`} />
                        {point}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </Stagger>
        </div>
      </section>

      {/* ── Enterprise Trust ──────────────────────────────────────────── */}
      <div className="section-divider" />
      <section className="py-24">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal direction="up" blur>
            <div className="text-center mb-16">
              <span className="huly-badge text-xs font-semibold text-violet-400 mb-3 tracking-wide uppercase px-3 py-1">
                Enterprise Trust
              </span>
              <h2 className="text-4xl md:text-5xl font-extrabold tracking-[-0.04em] text-white mb-4 mt-4">
                Powerful, but controlled.<br className="hidden sm:block" />
                <span className="text-zinc-500">Enterprise-grade governance.</span>
              </h2>
              <p className="text-zinc-400 max-w-xl mx-auto">
                Axiom is designed so that autonomous operations never compromise governance, auditability, or human oversight.
              </p>
            </div>
          </Reveal>
          <Stagger delay={0.1} interval={0.06} className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {TRUST_SIGNALS.map((signal) => (
              <div
                key={signal.title}
                className="animated-border card-inner-glow card-hover card-shine-sweep card-reactive rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 hover:border-white/[0.12] transition-all"
              >
                <h3 className="text-sm font-bold text-white mb-2">{signal.title}</h3>
                <p className="text-sm text-zinc-400 leading-relaxed">{signal.desc}</p>
              </div>
            ))}
          </Stagger>
        </div>
      </section>

      {/* ── Architecture ──────────────────────────────────────────────── */}
      <div className="section-divider" />
      <section className="py-24 relative">
        <div className="absolute -bottom-20 right-0 w-[350px] h-[350px] rounded-full bg-blue-500/[0.04] blur-[100px] pointer-events-none" aria-hidden />
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <Reveal direction="up" blur>
            <div className="text-center mb-12">
              <span className="huly-badge text-xs font-semibold text-violet-400 mb-3 tracking-wide uppercase px-3 py-1">
                Architecture
              </span>
              <h2 className="text-4xl md:text-5xl font-extrabold tracking-[-0.04em] text-white mb-4 mt-4">
                Real infrastructure.<br className="hidden sm:block" />
                <span className="text-zinc-500">Real code. Real execution.</span>
              </h2>
            </div>
          </Reveal>
          <Stagger delay={0.1} interval={0.06} className="grid sm:grid-cols-3 gap-6">
            <div className="animated-border card-inner-glow card-hover card-shine-sweep card-reactive rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 hover:border-white/[0.12] transition-all">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                  <span className="text-xs font-bold text-amber-400">AWS</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span className="text-[10px] font-semibold text-emerald-400/80 uppercase tracking-wider">Full Ops</span>
                </div>
              </div>
              <h3 className="font-bold text-white mb-1">Complete autonomous loop</h3>
              <p className="text-sm text-zinc-400">
                Scan, reason, plan, execute, verify, audit, monitor, and learn. Real SDK execution with rollback.
              </p>
            </div>
            <div className="animated-border card-inner-glow card-hover card-shine-sweep card-reactive rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 hover:border-white/[0.12] transition-all">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                  <span className="text-xs font-bold text-blue-400">Azure</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                  <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Expanding</span>
                </div>
              </div>
              <h3 className="font-bold text-white mb-1">Scan + analysis active</h3>
              <p className="text-sm text-zinc-400">
                Infrastructure scanning and snapshot analysis live. Signal derivation and AI reasoning in development.
              </p>
            </div>
            <div className="animated-border card-inner-glow card-hover card-shine-sweep card-reactive rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 hover:border-white/[0.12] transition-all">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                  <span className="text-xs font-bold text-red-400">GCP</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                  <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Expanding</span>
                </div>
              </div>
              <h3 className="font-bold text-white mb-1">Scan + analysis active</h3>
              <p className="text-sm text-zinc-400">
                Infrastructure scanning and snapshot analysis live. Signal derivation and AI reasoning in development.
              </p>
            </div>
          </Stagger>
          <Reveal direction="up" blur delay={0.2}>
            <div className="mt-8 animated-border card-inner-glow card-hover card-shine-sweep card-reactive rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 hover:border-white/[0.12] transition-all">
              <div className="flex items-center gap-3 mb-4">
                <ClockIcon className="h-5 w-5 text-violet-400 icon-bounce" />
                <h3 className="font-bold text-white">Scheduled operations</h3>
              </div>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Configure daily or weekly scans per cloud account. The scheduler processes due runs, diffs against previous baselines, detects drift, generates notifications, and creates approval requests — fully autonomous, fully audited, and never auto-applying without explicit human approval.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── See It In Action ─────────────────────────────────────────── */}
      <div className="section-divider" />
      <section className="py-24 relative">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal direction="up" blur>
            <div className="text-center mb-16">
              <span className="huly-badge text-xs font-semibold text-violet-400 mb-3 tracking-wide uppercase px-3 py-1">
                Live Preview
              </span>
              <h2 className="text-4xl md:text-5xl font-extrabold tracking-[-0.04em] text-white mb-4 mt-4">
                See it in action.<br className="hidden sm:block" />
                <span className="text-zinc-500">Watch Axiom work.</span>
              </h2>
              <p className="text-zinc-400 max-w-xl mx-auto">
                Watch Axiom scan an AWS account and surface findings in real time.
              </p>
            </div>
          </Reveal>
          <Reveal direction="up" blur delay={0.15}>
            <div className="animated-border card-inner-glow card-shine-sweep card-reactive rounded-2xl border border-white/[0.06] bg-white/[0.02] p-1 relative">
              {/* Simulated terminal/demo view */}
              <div className="rounded-xl bg-[#0c0c0e] p-6 relative overflow-hidden">
                {/* Decorative live indicator */}
                <div className="flex items-center gap-2 mb-5">
                  <span className="relative flex items-center justify-center w-3 h-3">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    <span className="demo-live-ring" />
                  </span>
                  <span className="text-xs font-medium text-emerald-400">Live scan simulation</span>
                </div>
                {/* Terminal lines */}
                <div className="space-y-2 font-mono text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-violet-400">$</span>
                    <span className="text-zinc-300">axiom scan --account prod-aws --regions us-east-1,eu-west-1</span>
                  </div>
                  <div className="text-zinc-500 pl-4">Connecting via assume-role... <span className="text-emerald-400">authenticated</span></div>
                  <div className="text-zinc-500 pl-4">Scanning 12 services across 2 regions...</div>
                  <div className="text-zinc-500 pl-4">
                    Discovered <span className="text-white font-semibold">847</span> resources |{" "}
                    <span className="text-amber-400">23 findings</span> |{" "}
                    <span className="text-red-400">4 critical</span> |{" "}
                    <span className="text-emerald-400">$12,400/mo savings identified</span>
                  </div>
                  <div className="text-zinc-500 pl-4">Generating execution plans...</div>
                  <div className="text-zinc-500 pl-4">
                    Phase 1: <span className="text-violet-400">Cost optimization</span> (8 actions) |{" "}
                    Phase 2: <span className="text-red-400">Security hardening</span> (11 actions)
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <span className="text-emerald-400">Ready</span>
                    <span className="text-zinc-600">|</span>
                    <span className="text-zinc-400">Awaiting approval to proceed</span>
                    <span className="w-1.5 h-4 bg-violet-400/80 animate-cursor-blink ml-1" />
                  </div>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────────────────── */}
      <div className="section-divider" />
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 beam-sweep opacity-20 pointer-events-none" aria-hidden />
        <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full bg-indigo-500/[0.08] blur-[100px] pointer-events-none" aria-hidden />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full bg-blue-500/[0.08] blur-[100px] pointer-events-none" aria-hidden />
        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <Reveal direction="up" blur>
            <h2 className="text-4xl md:text-5xl font-extrabold tracking-[-0.04em] text-white mb-4">
              Your first intelligence<br className="hidden sm:block" />
              report in <span className="text-gradient">5 minutes.</span>
            </h2>
            <p className="text-zinc-400 mb-6 max-w-lg mx-auto">
              Connect a read-only IAM role. Axiom scans, reasons, and delivers cost savings, security findings, and an execution plan — before your coffee gets cold.
            </p>
            <div className="flex flex-wrap justify-center gap-x-6 gap-y-1.5 text-sm text-zinc-500 mb-10">
              {["No credit card", "Read-only access", "Revoke anytime"].map((item) => (
                <span key={item} className="flex items-center gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-emerald-500" />
                  {item}
                </span>
              ))}
            </div>
            <div className="flex flex-wrap justify-center gap-4">
              <Link
                href="/operator/onboarding"
                className="btn-huly inline-flex items-center gap-2 px-8 py-3.5 bg-white text-zinc-900 rounded-full font-semibold text-sm uppercase tracking-wide hover:bg-zinc-100 transition-all shadow-lg shadow-white/10"
              >
                Start free scan
                <ArrowRightIcon className="h-4 w-4" />
              </Link>
              <Link
                href="/operator/pricing"
                className="btn-huly inline-flex items-center gap-2 px-8 py-3.5 border border-white/[0.12] text-zinc-300 rounded-full font-semibold text-sm uppercase tracking-wide hover:bg-white/[0.05] hover:border-white/[0.20] transition-all"
              >
                View Pricing
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────────────── */}
      <Footer />
      </div>
    </div>
  );
}
