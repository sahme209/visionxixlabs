"use client";

import Link from "next/link";
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
    <div className="min-h-screen bg-white dark:bg-slate-950">
      <Navigation />

      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(124,58,237,0.08),transparent_50%)] dark:bg-[radial-gradient(ellipse_at_top,rgba(124,58,237,0.15),transparent_50%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(148,163,184,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.05)_1px,transparent_1px)] bg-[size:64px_64px] dark:bg-[linear-gradient(to_right,rgba(148,163,184,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.03)_1px,transparent_1px)]" />
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-20 text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-violet-50 dark:bg-violet-950/50 border border-violet-200 dark:border-violet-800 px-4 py-1.5 text-sm font-medium text-violet-700 dark:text-violet-300 mb-8">
            <CpuChipIcon className="h-4 w-4" />
            Autonomous Cloud Operations
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-slate-900 dark:text-slate-50 mb-6 leading-[1.1]">
            Infrastructure intelligence<br className="hidden sm:block" />
            that operates autonomously.
          </h1>
          <p className="text-lg sm:text-xl text-slate-600 dark:text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            Axiom scans your cloud infrastructure, identifies what to fix, reasons about priority and risk, generates execution plans, and applies approved changes — with full audit trail, rollback capability, and continuous drift monitoring.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              href="/cloud-operator"
              className="inline-flex items-center gap-2 px-7 py-3.5 bg-slate-900 dark:bg-slate-50 text-white dark:text-slate-900 rounded-xl font-semibold text-sm hover:bg-slate-800 dark:hover:bg-slate-200 transition-colors shadow-sm"
            >
              Run Axiom
              <ArrowRightIcon className="h-4 w-4" />
            </Link>
            <Link
              href="/axiom/pricing"
              className="inline-flex items-center gap-2 px-7 py-3.5 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-semibold text-sm hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors"
            >
              View pricing
            </Link>
          </div>
          <p className="mt-6 text-xs text-slate-500 dark:text-slate-500">
            AWS fully supported. Azure and GCP scan-only.
          </p>
        </div>
      </section>

      {/* ── Autonomous Workflow ────────────────────────────────────────── */}
      <section className="py-24 border-t border-slate-100 dark:border-slate-900">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <p className="text-sm font-semibold text-violet-600 dark:text-violet-400 mb-3 tracking-wide uppercase">
              How Axiom Operates
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-slate-50 mb-4">
              A complete autonomous loop.
            </h2>
            <p className="text-slate-600 dark:text-slate-400 max-w-xl mx-auto">
              Every scan executes a 12-step cycle — from infrastructure discovery through execution verification to outcome learning. The loop runs continuously on schedule.
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {WORKFLOW_STEPS.map((step, i) => {
              const Icon = step.icon;
              return (
                <div
                  key={step.label}
                  className="group relative rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 p-4 hover:border-violet-200 dark:hover:border-violet-800 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-md bg-violet-100 dark:bg-violet-900/50 flex items-center justify-center text-xs font-bold text-violet-600 dark:text-violet-400">
                      {i + 1}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Icon className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
                        <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {step.label}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                        {step.desc}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Capabilities ──────────────────────────────────────────────── */}
      <section className="py-24 border-t border-slate-100 dark:border-slate-900 bg-slate-50/50 dark:bg-slate-950">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <p className="text-sm font-semibold text-violet-600 dark:text-violet-400 mb-3 tracking-wide uppercase">
              Capabilities
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-slate-50 mb-4">
              Built for real operations.
            </h2>
            <p className="text-slate-600 dark:text-slate-400 max-w-xl mx-auto">
              Every feature in Axiom exists because it solves a real operational problem — not because it looks impressive in a demo.
            </p>
          </div>
          <div className="space-y-8">
            {CAPABILITIES.map((cap) => {
              const Icon = cap.icon;
              return (
                <div
                  key={cap.title}
                  className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8"
                >
                  <div className="flex items-start gap-4 mb-4">
                    <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-900/50 flex items-center justify-center">
                      <Icon className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">{cap.title}</h3>
                      <p className="text-sm text-violet-600 dark:text-violet-400 font-medium">{cap.subtitle}</p>
                    </div>
                  </div>
                  <p className="text-slate-600 dark:text-slate-400 mb-5 leading-relaxed">{cap.desc}</p>
                  <ul className="grid sm:grid-cols-2 gap-2">
                    {cap.points.map((point) => (
                      <li key={point} className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
                        <CheckCircleIcon className="h-4 w-4 text-emerald-500 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                        {point}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Enterprise Trust ──────────────────────────────────────────── */}
      <section className="py-24 border-t border-slate-100 dark:border-slate-900">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <p className="text-sm font-semibold text-violet-600 dark:text-violet-400 mb-3 tracking-wide uppercase">
              Enterprise Trust
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-slate-50 mb-4">
              Powerful, but controlled.
            </h2>
            <p className="text-slate-600 dark:text-slate-400 max-w-xl mx-auto">
              Axiom is designed so that autonomous operations never compromise governance, auditability, or human oversight.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {TRUST_SIGNALS.map((signal) => (
              <div
                key={signal.title}
                className="rounded-xl border border-slate-100 dark:border-slate-800 p-6 hover:border-violet-200 dark:hover:border-violet-800 transition-colors"
              >
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-2">{signal.title}</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{signal.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Architecture ──────────────────────────────────────────────── */}
      <section className="py-24 border-t border-slate-100 dark:border-slate-900 bg-slate-50/50 dark:bg-slate-950">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <p className="text-sm font-semibold text-violet-600 dark:text-violet-400 mb-3 tracking-wide uppercase">
              Architecture
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-slate-50 mb-4">
              Real infrastructure, real code.
            </h2>
          </div>
          <div className="grid sm:grid-cols-3 gap-6">
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
              <div className="w-8 h-8 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center mb-4">
                <span className="text-sm font-bold text-orange-600 dark:text-orange-400">AWS</span>
              </div>
              <h3 className="font-bold text-slate-900 dark:text-slate-100 mb-1">Full stack</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Scan, analyze, plan, apply, and verify. Complete autonomous operations with real AWS SDK execution.
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
              <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-4">
                <span className="text-xs font-bold text-blue-600 dark:text-blue-400">Azure</span>
              </div>
              <h3 className="font-bold text-slate-900 dark:text-slate-100 mb-1">Scan + analyze</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Full infrastructure scanning and analysis. Execution capabilities on the roadmap.
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mb-4">
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">GCP</span>
              </div>
              <h3 className="font-bold text-slate-900 dark:text-slate-100 mb-1">Scan + analyze</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Full infrastructure scanning and analysis. Execution capabilities on the roadmap.
              </p>
            </div>
          </div>
          <div className="mt-8 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
            <div className="flex items-center gap-3 mb-4">
              <ClockIcon className="h-5 w-5 text-slate-400" />
              <h3 className="font-bold text-slate-900 dark:text-slate-100">Scheduled operations</h3>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Configure daily or weekly scans per cloud account. The scheduler processes due runs, diffs against previous baselines, detects drift, generates notifications, and creates approval requests — fully autonomous, fully audited, and never auto-applying without explicit human approval.
            </p>
          </div>
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────────────────── */}
      <section className="py-24 border-t border-slate-100 dark:border-slate-900">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-slate-50 mb-4">
            Start operating autonomously.
          </h2>
          <p className="text-slate-600 dark:text-slate-400 mb-8 max-w-lg mx-auto">
            Connect your AWS account with a read-only IAM role. Your first scan takes 60 seconds. No credentials stored.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              href="/cloud-operator"
              className="inline-flex items-center gap-2 px-7 py-3.5 bg-slate-900 dark:bg-slate-50 text-white dark:text-slate-900 rounded-xl font-semibold text-sm hover:bg-slate-800 dark:hover:bg-slate-200 transition-colors shadow-sm"
            >
              Run Axiom
              <ArrowRightIcon className="h-4 w-4" />
            </Link>
            <Link
              href="/axiom/pricing"
              className="inline-flex items-center gap-2 px-7 py-3.5 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-semibold text-sm hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors"
            >
              View pricing
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────────────── */}
      <footer className="py-12 border-t border-slate-100 dark:border-slate-900">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-xs text-slate-400 dark:text-slate-600">
            Axiom is a product of Vision XIX Labs. All infrastructure operations are scoped, audited, and reversible.
          </p>
        </div>
      </footer>
    </div>
  );
}
