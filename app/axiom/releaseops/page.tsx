import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRightIcon,
  ArrowsRightLeftIcon,
  BoltIcon,
  ChartBarIcon,
  CheckCircleIcon,
  CloudArrowDownIcon,
  CodeBracketIcon,
  CommandLineIcon,
  CpuChipIcon,
  CubeTransparentIcon,
  DocumentCheckIcon,
  EyeIcon,
  GlobeAltIcon,
  LockClosedIcon,
  MagnifyingGlassIcon,
  Cog6ToothIcon,
  ShieldCheckIcon,
  SparklesIcon,
} from "@heroicons/react/24/outline";

export const metadata: Metadata = {
  title: "Axiom ReleaseOps — AI-native deployment governance | Vision XIX Labs",
  description:
    "AI-native release governance and deployment intelligence layer of the Axiom operational platform. Coordinate releases across GitHub, GitLab, Azure DevOps, Jenkins, Terraform, and ServiceNow with quantified readiness scoring, drift detection, and approval orchestration.",
  keywords: [
    "release operations",
    "deployment governance",
    "release readiness",
    "Terraform governance",
    "AI deployment intelligence",
    "release orchestration",
    "rollback readiness",
    "deployment risk",
    "Axiom ReleaseOps",
  ],
  openGraph: {
    title: "Axiom ReleaseOps — Deployment governance. Operational intelligence.",
    description:
      "The AI-native release governance and deployment intelligence layer of the Axiom operational platform.",
    type: "website",
  },
};
import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";
import { Reveal } from "@/components/motion/Reveal";
import { Stagger } from "@/components/motion/Stagger";
import { AnimatedButton } from "@/components/ui/AnimatedButton";
import { FAQAccordion } from "@/components/FAQAccordion";

const RELEASEOPS_FAQ = [
  {
    question: "How does ReleaseOps connect to GitHub, GitLab, Azure DevOps, and Jenkins?",
    answer:
      "ReleaseOps ingests release telemetry from each system using OAuth-scoped app installations or service tokens — read-only by default. It correlates branch protection, deployment runs, approvals, and Terraform plans across all of them into one operational graph. No code is mirrored or re-hosted.",
  },
  {
    question: "Does ReleaseOps execute deployments, or just observe them?",
    answer:
      "By default, observation-only. Once governance is configured, ReleaseOps can orchestrate approval-gated deployments through your existing pipelines — never bypassing them. Execution is always optional, always audit-logged, and always rollback-verified before apply.",
  },
  {
    question: "How is Terraform governance enforced?",
    answer:
      "Terraform plans surfaced in CI become first-class entities in ReleaseOps. Drift, missing pre-apply checks, oversized blast radius, or unverified rollback paths are flagged before approval. Plans are versioned in operational memory and replayable against prior infrastructure state.",
  },
  {
    question: "What does rollback readiness mean operationally?",
    answer:
      "Every release surface gets a Rollback Readiness score derived from: existence of pre-flight snapshots, time-to-restore (RTO) measurements, blast radius, dependency depth, and verified rollback paths. Releases below threshold can be auto-blocked or gated for additional approval.",
  },
  {
    question: "Does it integrate with ServiceNow / change management?",
    answer:
      "Yes — ServiceNow Change Requests can be auto-created from release readiness scores, with risk justification and rollback strategy attached. CRs close automatically when post-execution verification passes.",
  },
  {
    question: "How does AI assist release coordination?",
    answer:
      "ReleaseOps runs a 12-step cognitive loop per release: observe deploy graph, interpret dependencies, reason about risk, plan sequencing, verify safety, then either propose or execute. Reasoning traces are auditable per release. Confidence calibrates over time based on outcome.",
  },
  {
    question: "Is this enterprise-safe for regulated environments?",
    answer:
      "ReleaseOps records approvals, authorization context, and audit evidence. Identity, compliance mapping, and connector availability depend on the configured deployment and must be verified for the installed release.",
  },
  {
    question: "How does ReleaseOps relate to the rest of the Axiom platform?",
    answer:
      "ReleaseOps is the deployment-and-release surface of the broader Axiom operational system. It shares the topology graph, operational memory, reasoning engine, and approval center with the cloud operations agent. The same Axiom desktop app surfaces release readiness alongside cloud health.",
  },
];

const PROBLEM_CARDS = [
  {
    icon: ArrowsRightLeftIcon,
    title: "Fragmented release surface",
    desc: "Releases live across GitHub, GitLab, Azure DevOps, Jenkins, ArgoCD, and ServiceNow — with no operational view connecting them. Approvals get missed. Coordination falls on Slack.",
  },
  {
    icon: CubeTransparentIcon,
    title: "Invisible deployment risk",
    desc: "Terraform plans approved at 2am. Pipelines that haven’t been touched in 18 months. Rollback paths nobody has tested. Risk shows up as incidents, not as a measurable signal.",
  },
  {
    icon: ChartBarIcon,
    title: "No release readiness score",
    desc: "Senior engineers carry the operational maturity model in their heads. New squads ship blind. Executives ask “is this safe to ship?” with no answer schema.",
  },
  {
    icon: LockClosedIcon,
    title: "Governance theater",
    desc: "Approvals exist but aren’t enforced at the orchestration layer. Drift between policy documents and actual pipeline behavior is the norm. Audits surface this every quarter.",
  },
  {
    icon: CloudArrowDownIcon,
    title: "Rollbacks discovered live",
    desc: "Rollback strategies are tested for the first time during an incident. Time-to-restore numbers are aspirational. Cross-team dependencies become visible only when something breaks.",
  },
  {
    icon: BoltIcon,
    title: "Release communication is manual",
    desc: "Status updates happen on Slack with screenshots. Stakeholders learn about outages from customers. Post-mortems become archaeology.",
  },
];

const CAPABILITIES = [
  { icon: MagnifyingGlassIcon, title: "Deployment ecosystem mapping", desc: "Auto-discover repos, pipelines, environments, approvals across GitHub/GitLab/Azure DevOps/Jenkins. Build the release graph." },
  { icon: ChartBarIcon, title: "Release readiness scoring", desc: "Quantitative score per service across 9 maturity dimensions. Track week-over-week. Drill down to remediation." },
  { icon: ShieldCheckIcon, title: "Operational risk analysis", desc: "Per-release risk classification: blast radius, dependency depth, rollback verification, change frequency, recent incidents." },
  { icon: DocumentCheckIcon, title: "Approval orchestration", desc: "Centralize approvals across systems. Enforce policy. Auto-create ServiceNow CRs. Route to the right owner based on the change graph." },
  { icon: ArrowsRightLeftIcon, title: "Drift detection", desc: "Compare desired pipeline state to live state. Flag drift in branch protection, required reviewers, deployment configs, Terraform variables." },
  { icon: CodeBracketIcon, title: "Terraform governance", desc: "Every plan surfaced in CI gets risk-classified before merge. Drift, oversized destroys, unverified rollbacks blocked at gate level." },
  { icon: CloudArrowDownIcon, title: "Rollback readiness", desc: "Continuous verification that every release has a tested rollback path with measured RTO. Auto-block releases below threshold." },
  { icon: CubeTransparentIcon, title: "Deployment dependency visibility", desc: "See what depends on what before you ship. Cross-service, cross-team, cross-environment dependency graph rebuilt every scan." },
  { icon: SparklesIcon, title: "Release communication orchestration", desc: "Auto-generated release notes, stakeholder updates, status pages. Trigger on approval. Sync to Slack, email, ServiceNow." },
  { icon: EyeIcon, title: "Executive operational visibility", desc: "Single pane: deployments this week, success rate, incident count, mean time to restore, approval health, readiness trend." },
  { icon: DocumentCheckIcon, title: "Audit intelligence", desc: "Immutable trail of every approval, deployment, rollback, and policy event. SOC 2 / ISO 27001 control mapping built-in." },
  { icon: CpuChipIcon, title: "Operational memory", desc: "Every release outcome feeds back. Agent confidence recalibrates per service, per team, per change type. Releases get safer over time." },
];

const PHASES = [
  { id: "discover", label: "Discover", desc: "Map repositories, pipelines, deployment environments, approval flows, Terraform workflows, ownership graphs.", color: "blue" },
  { id: "assess", label: "Assess", desc: "Score each service on 9 release-readiness dimensions. Surface risks. Quantify maturity gaps.", color: "violet" },
  { id: "standardize", label: "Standardize", desc: "Establish policy: branch protection, approval gates, rollback requirements, deployment cadence, observability minimums.", color: "fuchsia" },
  { id: "orchestrate", label: "Orchestrate", desc: "Route approvals through Axiom. Coordinate releases across systems. Auto-create ServiceNow CRs. Sequence deployments.", color: "amber" },
  { id: "govern", label: "Govern", desc: "Enforce policy at the orchestration layer. Audit every change. Block releases below readiness threshold automatically.", color: "emerald" },
  { id: "improve", label: "Continuously improve", desc: "Agent learns from outcome. Confidence recalibrates. Readiness scores trend up. Operational memory deepens.", color: "cyan" },
] as const;

const PHASE_COLORS: Record<typeof PHASES[number]["color"], { text: string; bg: string; border: string; ring: string }> = {
  blue: { text: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20", ring: "ring-blue-500/30" },
  violet: { text: "text-violet-400", bg: "bg-violet-500/10", border: "border-violet-500/20", ring: "ring-violet-500/30" },
  fuchsia: { text: "text-fuchsia-400", bg: "bg-fuchsia-500/10", border: "border-fuchsia-500/20", ring: "ring-fuchsia-500/30" },
  amber: { text: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20", ring: "ring-amber-500/30" },
  emerald: { text: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20", ring: "ring-emerald-500/30" },
  cyan: { text: "text-cyan-400", bg: "bg-cyan-500/10", border: "border-cyan-500/20", ring: "ring-cyan-500/30" },
};

const READINESS_DIMENSIONS = [
  { label: "Branch governance", score: 0.92, detail: "Required reviewers · branch protection · linear history enforced" },
  { label: "Rollback readiness", score: 0.78, detail: "RTO measured · pre-flight snapshots · 2 services without tested rollback" },
  { label: "Observability", score: 0.86, detail: "SLO/SLI defined for 14 of 16 services · alerts wired" },
  { label: "Deployment maturity", score: 0.74, detail: "Phased rollouts · canary on 9 of 16 · blue/green on 5" },
  { label: "Operational coordination", score: 0.69, detail: "Cross-team approvals slow · ownership unclear for 3 services" },
  { label: "Release auditability", score: 0.95, detail: "Immutable trail · SOC 2 mapping · 100% deploy events captured" },
  { label: "Terraform governance", score: 0.81, detail: "Plan-gated · drift scans every 6h · 1 module without rollback path" },
  { label: "Infrastructure drift", score: 0.88, detail: "Out-of-band changes detected and triaged within 12h" },
  { label: "Release communication", score: 0.71, detail: "Auto release notes · stakeholder updates · 3 channels not yet wired" },
];

export default function ReleaseOpsPage() {
  const compositeScore = Math.round(
    (READINESS_DIMENSIONS.reduce((s, d) => s + d.score, 0) / READINESS_DIMENSIONS.length) * 100
  );

  return (
    <div className="min-h-screen bg-[#09090b] text-white relative overflow-hidden">
      {/* Background layers */}
      <div className="absolute inset-0 bg-grid-mesh opacity-30 pointer-events-none" aria-hidden />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[600px] spotlight-orb opacity-60 pointer-events-none" aria-hidden />
      <div className="ambient-drift absolute top-[20%] -right-40 w-[520px] h-[480px] rounded-full bg-brand-violet/[0.07] blur-[140px] pointer-events-none" aria-hidden />
      <div className="ambient-drift absolute top-[40%] -left-40 w-[480px] h-[440px] rounded-full bg-brand-coral/[0.06] blur-[140px] pointer-events-none" style={{ animationDelay: "-8s" }} aria-hidden />
      <div className="ambient-drift absolute bottom-[10%] left-1/2 -translate-x-1/2 w-[600px] h-[300px] rounded-full bg-cyan-500/[0.05] blur-[120px] pointer-events-none" style={{ animationDelay: "-14s" }} aria-hidden />

      <Navigation />

      {/* ── Hero ───────────────────────────────────────────────────── */}
      <section className="relative pt-32 pb-24 px-4 sm:px-6 lg:px-8 overflow-hidden">
        <div className="hero-beam-vertical pointer-events-none" aria-hidden />
        <div className="hero-beam-flare pointer-events-none" aria-hidden />
        <div className="hero-beam-converge pointer-events-none" aria-hidden />

        <div className="max-w-6xl mx-auto relative z-10">
          <Reveal direction="up" blur>
            <p className="mono-label inline-flex items-center gap-3 mb-6">
              <span className="text-brand-coral/90 tabular-nums">RO</span>
              <span className="h-px w-6 bg-gradient-to-r from-brand-coral/60 to-transparent" />
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-coral opacity-60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-brand-coral" />
              </span>
              Axiom <span className="text-zinc-700">·</span> ReleaseOps
            </p>
          </Reveal>

          <Reveal direction="up" blur delay={0.06}>
            <h1 className="font-display text-5xl md:text-6xl lg:text-7xl font-bold mb-6 leading-[1.04]">
              Deployment governance.<br />
              <span className="relative inline-block">
                Operational intelligence.
                <span aria-hidden className="absolute left-0 -bottom-0.5 h-[2px] w-full rounded-full bg-gradient-to-r from-brand-coral via-fuchsia-400/70 to-transparent" />
              </span>
            </h1>
          </Reveal>

          <Reveal direction="up" delay={0.1}>
            <p className="text-dim-paragraph text-lg md:text-xl max-w-3xl leading-relaxed mb-10">
              ReleaseOps is the AI-native release governance and deployment intelligence layer of the Axiom operational platform. <span className="dim-1">It coordinates complex release ecosystems across repositories, CI/CD pipelines, cloud platforms, approvals, infrastructure changes, Terraform workflows, and operational dependencies.</span>
            </p>
          </Reveal>

          <Reveal direction="up" delay={0.14}>
            <div className="flex flex-wrap gap-4 mb-10">
              <AnimatedButton
                href="/download"
                variant="primary"
                className="btn-amber-shimmer relative z-10 rounded-full text-zinc-900 font-semibold"
              >
                Open Command Center
                <ArrowRightIcon className="ml-2 h-4 w-4" />
              </AnimatedButton>
              <AnimatedButton
                href="#assessment"
                variant="ghost"
                className="border-white/10 text-zinc-300 hover:bg-white/5 hover:border-white/20 relative z-10"
              >
                Request ReleaseOps Assessment
              </AnimatedButton>
            </div>
          </Reveal>

          <Reveal direction="up" delay={0.2}>
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-zinc-500">
              {[
                "GitHub · GitLab · Azure DevOps · Jenkins",
                "Terraform-native governance",
                "Approval-gated execution",
                "Persisted audit history",
              ].map((label) => (
                <span key={label} className="flex items-center gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-emerald-500" />
                  {label}
                </span>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Enterprise Problem ─────────────────────────────────────── */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 relative">
        <div className="max-w-6xl mx-auto">
          <Reveal direction="up" blur>
            <div className="mb-12">
              <p className="text-sm font-semibold text-amber-400 mb-4 tracking-wide uppercase">
                The enterprise release problem
              </p>
              <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-[-0.04em] mb-5">
                Modern enterprises ship every day.{" "}
                <span className="text-zinc-500">Few do it operationally.</span>
              </h2>
              <p className="text-dim-paragraph text-lg max-w-3xl leading-relaxed">
                Teams already use GitHub, GitLab, Azure DevOps, Jenkins, Terraform, Kubernetes, and ServiceNow. <span className="dim-1">But operations are fragmented across repositories, environments, approvals, deployments, ownership graphs, rollback systems, and runtime configuration.</span> <span className="dim-2">Release readiness is informal. Risk is invisible until it&apos;s an incident.</span>
              </p>
            </div>
          </Reveal>

          <Stagger delay={0.1} interval={0.06} className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {PROBLEM_CARDS.map((card) => {
              const Icon = card.icon;
              return (
                <div key={card.title} className="huly-feature-card group">
                  <div className="p-5">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-4">
                      <Icon className="h-5 w-5 text-amber-400" />
                    </div>
                    <h3 className="text-base font-bold text-white mb-2">{card.title}</h3>
                    <p className="text-sm text-zinc-500 leading-relaxed">{card.desc}</p>
                  </div>
                </div>
              );
            })}
          </Stagger>
        </div>
      </section>

      {/* ── What ReleaseOps Does (capabilities) ──────────────────── */}
      <section id="capabilities" className="py-24 px-4 sm:px-6 lg:px-8 relative">
        <div className="max-w-6xl mx-auto">
          <Reveal direction="up" blur>
            <div className="mb-12">
              <p className="text-sm font-semibold text-violet-400 mb-4 tracking-wide uppercase">
                What ReleaseOps does
              </p>
              <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-[-0.04em] mb-5">
                An operational intelligence layer.{" "}
                <span className="text-zinc-500">For enterprise deployments.</span>
              </h2>
              <p className="text-dim-paragraph text-lg max-w-3xl leading-relaxed">
                ReleaseOps is not a CI/CD replacement. It runs alongside your existing pipelines, <span className="dim-1">ingests deployment telemetry, builds the operational release graph, and orchestrates governance — without rewriting how your teams ship.</span>
              </p>
            </div>
          </Reveal>

          <Stagger delay={0.05} interval={0.04} className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {CAPABILITIES.map((cap) => {
              const Icon = cap.icon;
              return (
                <div key={cap.title} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 hover:border-white/[0.12] hover:bg-white/[0.03] transition-all group">
                  <div className="flex items-start gap-3 mb-2">
                    <div className="w-9 h-9 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center shrink-0 group-hover:bg-violet-500/15 transition-colors">
                      <Icon className="h-4.5 w-4.5 text-violet-400" />
                    </div>
                    <p className="text-sm font-bold text-white pt-1.5">{cap.title}</p>
                  </div>
                  <p className="text-xs text-zinc-500 leading-relaxed">{cap.desc}</p>
                </div>
              );
            })}
          </Stagger>
        </div>
      </section>

      {/* ── Operational Workflow Visualization ────────────────────── */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 relative">
        <div className="max-w-6xl mx-auto">
          <Reveal direction="up" blur>
            <div className="mb-12">
              <p className="text-sm font-semibold text-fuchsia-400 mb-4 tracking-wide uppercase">
                Operational workflow
              </p>
              <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-[-0.04em] mb-5">
                Discover. Standardize.{" "}
                <span className="text-zinc-500">Continuously improve.</span>
              </h2>
              <p className="text-dim-paragraph text-lg max-w-3xl leading-relaxed">
                A six-phase operational loop — not a one-time consulting engagement. <span className="dim-1">ReleaseOps deepens with every release, every approval, every rollback. Confidence calibrates per service over time.</span>
              </p>
            </div>
          </Reveal>

          <Stagger delay={0.08} interval={0.06} className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
            {PHASES.map((phase, idx) => {
              const c = PHASE_COLORS[phase.color];
              return (
                <div key={phase.id} className="relative rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 hover:border-white/[0.12] transition-all group overflow-hidden">
                  <span aria-hidden className={`absolute -top-12 -right-12 w-32 h-32 rounded-full ${c.bg} blur-[40px] pointer-events-none`} />
                  <div className="relative">
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`w-10 h-10 rounded-xl ${c.bg} border ${c.border} flex items-center justify-center font-mono font-bold ${c.text} group-hover:ring-2 group-hover:${c.ring} transition-all`}>
                        {String(idx + 1).padStart(2, "0")}
                      </div>
                      <div>
                        <p className={`text-[9px] font-semibold uppercase tracking-widest ${c.text}`}>Phase {idx + 1}</p>
                        <p className="text-base font-bold text-white">{phase.label}</p>
                      </div>
                    </div>
                    <p className="text-sm text-zinc-500 leading-relaxed">{phase.desc}</p>
                  </div>
                </div>
              );
            })}
          </Stagger>
        </div>
      </section>

      {/* ── Release Readiness Intelligence ────────────────────────── */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 relative">
        <div className="max-w-6xl mx-auto">
          <Reveal direction="up" blur>
            <div className="mb-12">
              <p className="text-sm font-semibold text-emerald-400 mb-4 tracking-wide uppercase">
                Release readiness intelligence
              </p>
              <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-[-0.04em] mb-5">
                Quantified release maturity.{" "}
                <span className="text-zinc-500">Tracked over time.</span>
              </h2>
              <p className="text-dim-paragraph text-lg max-w-3xl leading-relaxed">
                Every service gets a composite Release Readiness score across nine operational dimensions. <span className="dim-1">Each dimension is measurable, trackable, and improvable. No consulting slides.</span>
              </p>
            </div>
          </Reveal>

          <Reveal direction="up" delay={0.1}>
            <div className="rounded-2xl border border-emerald-500/15 bg-gradient-to-br from-emerald-500/[0.04] via-transparent to-violet-500/[0.03] overflow-hidden relative">
              <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-emerald-500/[0.06] blur-[80px] pointer-events-none" aria-hidden />

              {/* Composite score header */}
              <div className="relative px-6 py-5 border-b border-white/[0.06] flex items-center justify-between flex-wrap gap-4">
                <div>
                  <p className="text-[10px] font-semibold text-emerald-400 uppercase tracking-widest mb-1">Composite readiness score</p>
                  <p className="text-sm font-semibold text-white">payments-api · production · last 7d</p>
                </div>
                <div className="text-right">
                  <p className="text-5xl font-bold text-emerald-400 tracking-tight">{compositeScore}<span className="text-2xl text-zinc-500 font-normal">/100</span></p>
                  <p className="text-[10px] text-emerald-400/80 font-semibold uppercase tracking-wider mt-1">+4 pts this month</p>
                </div>
              </div>

              {/* Dimension bars */}
              <div className="px-6 py-5 grid md:grid-cols-2 gap-x-6 gap-y-3 relative">
                {READINESS_DIMENSIONS.map((d) => {
                  const pct = Math.round(d.score * 100);
                  const colorClass =
                    pct >= 85 ? "from-emerald-500 to-emerald-400" :
                    pct >= 70 ? "from-amber-500 to-amber-400" :
                    "from-red-500 to-red-400";
                  return (
                    <div key={d.label} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-zinc-300 font-medium">{d.label}</span>
                        <span className={`font-mono font-semibold ${pct >= 85 ? "text-emerald-400" : pct >= 70 ? "text-amber-400" : "text-red-400"}`}>{pct}%</span>
                      </div>
                      <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                        <div className={`h-full rounded-full bg-gradient-to-r ${colorClass}`} style={{ width: `${pct}%` }} />
                      </div>
                      <p className="text-[10px] text-zinc-600 leading-snug">{d.detail}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Infrastructure + Release Coordination ─────────────────── */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 relative">
        <div className="max-w-6xl mx-auto">
          <Reveal direction="up" blur>
            <div className="mb-12">
              <p className="text-sm font-semibold text-blue-400 mb-4 tracking-wide uppercase">
                Platform integration
              </p>
              <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-[-0.04em] mb-5">
                Releases. Infrastructure.{" "}
                <span className="text-zinc-500">One operational graph.</span>
              </h2>
              <p className="text-dim-paragraph text-lg max-w-3xl leading-relaxed">
                ReleaseOps shares the topology graph, operational memory, reasoning engine, and approval center with the rest of the Axiom platform. <span className="dim-1">A release isn&apos;t isolated — it&apos;s a node in the same operational system that runs your AWS, Azure, and GCP infrastructure.</span>
              </p>
            </div>
          </Reveal>

          <Stagger delay={0.06} interval={0.06} className="grid md:grid-cols-2 gap-3">
            {[
              { href: "/dashboard/topology", icon: ArrowsRightLeftIcon, title: "Topology", desc: "Releases overlay onto the live infrastructure graph. See which deploy targets which resources." },
              { href: "/dashboard/memory", icon: CpuChipIcon, title: "Operational memory", desc: "Every release outcome persists. Agent learns per service, per change type, per team." },
              { href: "/dashboard/workflows", icon: Cog6ToothIcon, title: "Continuous workflows", desc: "Drift monitors, compliance sweeps, and post-execution verification run on releases too." },
              { href: "/download", icon: BoltIcon, title: "Command center", desc: "Releases appear in the unified activity feed alongside scans, plans, and audit events." },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.title}
                  href={item.href}
                  className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 hover:border-white/[0.12] hover:bg-white/[0.03] transition-all group flex items-center gap-4"
                >
                  <div className="w-11 h-11 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                    <Icon className="h-5 w-5 text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white mb-0.5">{item.title}</p>
                    <p className="text-xs text-zinc-500 leading-relaxed">{item.desc}</p>
                  </div>
                  <ArrowRightIcon className="h-4 w-4 text-zinc-600 group-hover:text-white group-hover:translate-x-0.5 transition-all" />
                </Link>
              );
            })}
          </Stagger>
        </div>
      </section>

      {/* ── Desktop + Web Operational Platform ────────────────────── */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 relative">
        <div className="max-w-6xl mx-auto">
          <Reveal direction="up" blur>
            <div className="rounded-2xl border border-violet-500/15 bg-gradient-to-br from-violet-500/[0.05] via-transparent to-fuchsia-500/[0.03] p-8 sm:p-10 relative overflow-hidden">
              <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-violet-500/[0.08] blur-[80px] pointer-events-none" aria-hidden />
              <div className="absolute -bottom-20 -left-20 w-64 h-64 rounded-full bg-fuchsia-500/[0.06] blur-[80px] pointer-events-none" aria-hidden />

              <div className="relative grid lg:grid-cols-2 gap-10 items-center">
                <div>
                  <p className="text-[10px] font-semibold text-violet-400 uppercase tracking-widest mb-3">
                    Web · macOS · Windows · Linux
                  </p>
                  <h2 className="text-3xl md:text-4xl font-bold tracking-[-0.04em] mb-4">
                    Your release workstation.{" "}
                    <span className="text-zinc-500">Anywhere.</span>
                  </h2>
                  <p className="text-dim-paragraph text-base max-w-md leading-relaxed mb-6">
                    The Axiom desktop application surfaces release readiness, approval queues, and rollback orchestration <span className="dim-1">alongside cloud topology and operational memory.</span> <span className="dim-2">Operate releases from a native command center — without a browser.</span>
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <Link
                      href="/download"
                      className="btn-amber-shimmer inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold"
                    >
                      <CommandLineIcon className="h-4 w-4" />
                      Download Axiom
                    </Link>
                    <Link
                      href="/download"
                      className="inline-flex items-center gap-2 px-5 py-2.5 border border-white/[0.12] text-zinc-300 rounded-full text-sm font-medium hover:bg-white/5 hover:border-white/20 transition-colors"
                    >
                      <GlobeAltIcon className="h-4 w-4" />
                      Open web command center
                    </Link>
                  </div>
                </div>
                {/* Platform pillars */}
                <div className="grid grid-cols-2 gap-2.5">
                  {[
                    { label: "Web platform", value: "Available", color: "text-emerald-400" },
                    { label: "macOS app", value: "Preview", color: "text-emerald-400" },
                    { label: "Windows app", value: "Q2 2026", color: "text-amber-400" },
                    { label: "Linux app", value: "Q3 2026", color: "text-amber-400" },
                  ].map((p) => (
                    <div key={p.label} className="rounded-xl bg-black/30 border border-white/[0.06] p-4">
                      <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold mb-1">{p.label}</p>
                      <p className={`text-base font-bold ${p.color}`}>{p.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Enterprise Trust + Governance ─────────────────────────── */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 relative">
        <div className="max-w-6xl mx-auto">
          <Reveal direction="up" blur>
            <div className="mb-12">
              <p className="text-sm font-semibold text-emerald-400 mb-4 tracking-wide uppercase">
                Enterprise trust + governance
              </p>
              <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-[-0.04em] mb-5">
                Safe by default.{" "}
                <span className="text-zinc-500">Auditable end-to-end.</span>
              </h2>
              <p className="text-dim-paragraph text-lg max-w-3xl leading-relaxed">
                ReleaseOps inherits the governance posture of the broader Axiom platform. <span className="dim-1">Approval-gated workflows. Explicit permissions. Persisted audit evidence. Rollback state remains visible.</span>
              </p>
            </div>
          </Reveal>

          <Stagger delay={0.05} interval={0.05} className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { icon: LockClosedIcon, label: "Approval-based execution", desc: "Nothing ships without explicit approval at the policy gate. Multi-party for production." },
              { icon: ShieldCheckIcon, label: "Least-privilege direction", desc: "Read-only by default. Scoped credentials. Time-bound elevation." },
              { icon: DocumentCheckIcon, label: "Audit visibility", desc: "Immutable trail of every approval, deploy, rollback, and policy event." },
              { icon: CloudArrowDownIcon, label: "Rollback coordination", desc: "Records recovery expectations and adapter availability; automatic rollback requires a verified configured execution path." },
              { icon: CheckCircleIcon, label: "Operational verification", desc: "Post-execution verification confirms cost shift, drift, and intended behavior." },
              { icon: CubeTransparentIcon, label: "Governance alignment", desc: "SOC 2 / ISO 27001 / HIPAA control mapping built into the audit layer." },
              { icon: BoltIcon, label: "Enterprise-safe workflows", desc: "Blast radius limits. Approval-required for high-risk classes. Outcome memory." },
              { icon: CpuChipIcon, label: "Controlled automation", desc: "Agent autonomy escalates only with verified outcomes. Self-escalation blocked." },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 hover:border-emerald-500/15 hover:bg-emerald-500/[0.02] transition-all">
                  <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-3">
                    <Icon className="h-4.5 w-4.5 text-emerald-400" />
                  </div>
                  <p className="text-sm font-bold text-white mb-1">{item.label}</p>
                  <p className="text-xs text-zinc-500 leading-relaxed">{item.desc}</p>
                </div>
              );
            })}
          </Stagger>
        </div>
      </section>

      {/* ── Premium CTA ───────────────────────────────────────────── */}
      <section id="assessment" className="py-28 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        <div className="absolute inset-0 diagonal-streak opacity-20 pointer-events-none" aria-hidden />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] rounded-full bg-amber-500/[0.06] blur-[120px] pointer-events-none" aria-hidden />

        <div className="max-w-3xl mx-auto text-center relative">
          <Reveal direction="up" blur>
            <h2 className="text-4xl md:text-5xl font-bold mb-5 tracking-[-0.04em]">
              Operationalize your release surface.<br />
              <span className="text-gradient">Together.</span>
            </h2>
            <p className="text-dim-paragraph text-lg max-w-xl mx-auto mb-10 leading-relaxed">
              Vision XIX Labs runs the initial ReleaseOps assessment in 2 weeks. <span className="dim-1">You leave with a composite readiness score, a phased operational roadmap,</span> <span className="dim-2">and a working integration in your existing CI/CD ecosystem.</span>
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4 mb-8">
              <Link
                href="/download"
                className="btn-amber-shimmer group inline-flex items-center gap-2.5 px-7 py-3.5 rounded-full text-sm font-semibold uppercase tracking-wide"
              >
                Open Command Center
                <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link
                href="/docs/releaseops"
                className="inline-flex items-center gap-2 px-7 py-3.5 border border-white/[0.12] text-zinc-300 rounded-full text-sm font-semibold hover:bg-white/5 hover:border-white/20 transition-colors"
              >
                Read setup guide
                <ArrowRightIcon className="h-4 w-4" />
              </Link>
              <Link
                href="/contact?topic=releaseops"
                className="inline-flex items-center gap-2 px-7 py-3.5 text-zinc-400 hover:text-white text-sm font-semibold transition-colors"
              >
                Need enterprise help?
              </Link>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-zinc-500">
              {["Self-serve onboarding", "Working integration on day 1", "No CI/CD replacement"].map((item) => (
                <span key={item} className="flex items-center gap-1.5">
                  <CheckCircleIcon className="h-3.5 w-3.5 text-emerald-500" />
                  {item}
                </span>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── FAQ ───────────────────────────────────────────────────── */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 relative">
        <div className="max-w-3xl mx-auto">
          <Reveal direction="up" blur>
            <h2 className="text-center text-3xl md:text-4xl font-bold mb-12 tracking-[-0.04em]">
              Frequently asked questions
            </h2>
          </Reveal>
          <FAQAccordion items={RELEASEOPS_FAQ} />
        </div>
      </section>

      <Footer />
    </div>
  );
}
