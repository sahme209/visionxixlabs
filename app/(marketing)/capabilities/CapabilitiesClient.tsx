"use client";

/**
 * /capabilities — inventory of the AI agent kernels Axiom ships.
 *
 * Each card maps to a real pure-function kernel in lib/agents/*. The
 * "evidence" link points to the cockpit module that surfaces the
 * kernel's output. Human approval is required before any action runs.
 *
 * If a kernel here is not actually shipped in lib/agents/*, the
 * entry doesn't belong on this page. Marketing follows the build,
 * not the other way around.
 */

import { motion } from "framer-motion";
import Link from "next/link";
import { useMemo, useState } from "react";

interface Capability {
  /** Display name of the agent kernel. */
  name: string;
  /** Role in the council. */
  role: "perception" | "reasoning" | "planning" | "safety" | "verification" | "memory";
  /** Closed-union: which module on the bus implements it. */
  kernel: string;
  /** What it proves — short, sales-honest. */
  proves: string;
  /** Optional cockpit deep link where its output is surfaced. */
  evidence?: { href: string; label: string };
  /** True when shipped in the most recent batch — surfaces a "new" pill. */
  isNew?: boolean;
}

const CAPABILITIES: readonly Capability[] = [
  // perception
  { name: "Detector",            role: "perception",   kernel: "lib/agents/detectorSignalEmitter",       proves: "Watches telemetry and emits typed signals to the bus.",                                 evidence: { href: "/download",       label: "agent bus" } },
  { name: "Reasoner",            role: "reasoning",    kernel: "lib/agents/reasonerHypothesisWeaver",    proves: "Weaves 1..N signals into a typed hypothesis with a confidence score.",                  evidence: { href: "/download",       label: "agent bus" } },
  { name: "Simulator",           role: "reasoning",    kernel: "lib/agents/simulatorSandboxSpec",        proves: "Models a proposed change against constrained inputs and records review checks before an approval packet is prepared; it is not an isolated production rehearsal." },

  // planning
  { name: "Spec Writer",         role: "planning",     kernel: "lib/agents/specWriter",                  proves: "Drafts a typed engineering spec (goals, non-goals, risks, verification, rollback) from a problem statement." },
  { name: "Test Coverage Proposer", role: "planning",  kernel: "lib/agents/testCoverageProposer",        proves: "Reads a diff and proposes the must-have, should-have, and nice-to-have tests with rationale per row." },
  { name: "Refactor Sequencer",  role: "planning",     kernel: "lib/agents/refactorSequencer",           proves: "Orders a multi-step refactor with per-step verdict (safe / needs-test / needs-review / blocked) and rollback." },
  { name: "Migration Coordinator", role: "planning",   kernel: "lib/agents/migrationCoordinator",        proves: "Builds a multi-stage migration runbook with backwards-compat window, gate checks, and rollback per stage." },
  { name: "GitHub Pipeline Repairer", role: "planning", kernel: "lib/agents/githubPipelineRepairer",     proves: "Classifies a failed Actions run and proposes a typed PR patch (retry, pin, quarantine, raise runner, etc.).", isNew: true },
  { name: "Release Notes Drafter", role: "planning", kernel: "lib/agents/githubReleaseNotesDrafter",     proves: "Drafts release notes from commits between two tags. Conventional-commit aware, recommends SemVer bump.",      isNew: true },
  { name: "Incident Timeline Weaver", role: "planning", kernel: "lib/agents/incidentTimelineWeaver",     proves: "Weaves heterogeneous events into a phase-tagged incident timeline with TTD / TTM / TTR durations.",          isNew: true },
  { name: "Postmortem Drafter",  role: "planning",     kernel: "lib/agents/postmortemDrafter",           proves: "Renders a ready-to-merge postmortem from a timeline + action items. Refuses to draft while incident is ongoing.", isNew: true },
  { name: "Marketing Content Drafter", role: "planning", kernel: "lib/agents/marketingContentDrafter",   proves: "Drafts multi-channel social posts with closed-union risk tier. Customer mention auto-tiers high; incident → critical." },
  { name: "Social Post Scheduler", role: "planning",   kernel: "lib/agents/socialPostScheduler",         proves: "Sequences approved drafts under per-channel caps, blackout windows, dedup. Refuses critical+dual-approval on a single track." },
  { name: "Database Schema Reviewer", role: "planning", kernel: "lib/agents/databaseSchemaReviewer",     proves: "Audits tables / columns / indexes / FK constraints. Surfaces missing-FK, missing-index, naming drift, duplicate indexes, orphan columns.", isNew: true },
  { name: "Slow Query Proposer",   role: "planning",   kernel: "lib/agents/slowQueryProposer",           proves: "Reads slow-query rows + schema, proposes add_index (with DDL), rewrite_query, partition_table, downsize, or no_action.",                isNew: true },
  { name: "Idle Cloud Resource Detector", role: "planning", kernel: "lib/agents/idleCloudResourceDetector", proves: "Finds idle EBS / EIP / Lambda / Snapshot / RDS / ELB / empty S3. Production-tag refuses auto-delete; surfaces $/mo savings.",       isNew: true },
  { name: "Alert Noise Reducer",   role: "planning",   kernel: "lib/agents/alertNoiseReducer",           proves: "Analyzes alert fire / ack / incident rates, proposes raise_threshold / widen_window / require_paired_metric / mute / split_routing.",  isNew: true },
  { name: "HR Onboarding Planner", role: "planning",   kernel: "lib/agents/hrOnboardingPlanner",         proves: "Builds a 4-phase onboarding plan (pre-start / day-one / week-one / month-one). Refuses interns with elevated access.",                isNew: true },
  { name: "Sales Lead Enricher",   role: "planning",   kernel: "lib/agents/salesLeadEnricher",           proves: "Classifies an inbound lead — segment (enterprise / mid-market / startup / personal / education), ICP fit score, suggested plan + next action." },
  { name: "Workflow Orchestrator", role: "planning",   kernel: "lib/agents/agentWorkflowOrchestrator",   proves: "Chains kernels into typed workflows with per-step gate handoff. Closed-union step states; safety-tier rejection blocks downstream dispatch.", isNew: true },
  { name: "Meta-Reasoner",         role: "planning",   kernel: "lib/agents/metaReasonerKernel",          proves: "The agent that picks agents. Ranks the kernel catalog against an operator problem with closed-union pick / ambiguous / no_kernel verdict.",   isNew: true },
  { name: "Multi-Agent Debate",    role: "planning",   kernel: "lib/agents/multiAgentDebate",            proves: "N kernels propose, council reconciles, dissent surfaced explicitly. Safety-tier reject is a hard veto." },
  { name: "Intent Parser",         role: "reasoning",  kernel: "lib/agents/intentParser",                proves: "Natural-language operator intent → typed ActionSpec (kind + domain + urgency + entities + destructive flag).",                                  isNew: true },
  { name: "Anomaly Detector",      role: "perception", kernel: "lib/agents/anomalyDetector",             proves: "MAD-based z-score on time series. Spike / dip / drift / missing_data with bounded false-positive rate.",                                        isNew: true },
  { name: "Change Risk Assessor",  role: "safety",     kernel: "lib/agents/changeRiskAssessor",          proves: "Scores blast radius of a proposed change against service topology. Critical-tier reach → council_3_of_5 gate.",                                  isNew: true },
  { name: "Secrets Hygiene",       role: "safety",     kernel: "lib/agents/secretsHygieneScanner",       proves: "Scans a file / diff for AWS / Stripe / GitHub / OpenAI / Anthropic / PEM / Slack secrets. Redacts in output; never echoes the raw value.",        isNew: true },
  { name: "Compliance Mapper",     role: "verification", kernel: "lib/agents/complianceControlMapper",   proves: "Maps available audit events to control-review evidence and highlights gaps. It supports customer assessment; it does not certify compliance or regulated-workload readiness.",                                  isNew: true },

  // safety
  { name: "Policy Gate",         role: "safety",       kernel: "lib/agents/policyGateEvaluator",         proves: "Applies the tenant charter to every proposal — refuses anything outside the operator-signed scope.",         evidence: { href: "/dashboard/charter",  label: "autonomy charter" } },
  { name: "Boundary Gate",       role: "safety",       kernel: "lib/agents/boundaryGateCatalog",         proves: "Classifies the blast radius of every proposal into a closed-union severity tier.",                          evidence: { href: "/dashboard/automation-boundaries", label: "boundary catalog" } },
  { name: "Council",             role: "safety",       kernel: "lib/agents/council",                     proves: "Weighted-vote consensus — ⅔ default — across the planning + safety agents.",                                 evidence: { href: "/download",       label: "agent bus" } },
  { name: "Approver",            role: "safety",       kernel: "lib/agents/approverPacketAssembler",     proves: "Assembles the approval context an operator reviews. A recorded approval does not itself execute a provider action.",               evidence: { href: "/dashboard/approvals",       label: "approvals" } },

  // verification
  { name: "Verifier",            role: "verification", kernel: "lib/agents/verifierPostExecChecker",     proves: "Records configured validation outcomes for review. It does not claim universal provider verification or production health.",                                  evidence: { href: "/dashboard/audit",           label: "audit log" } },
  { name: "Auditor",             role: "verification", kernel: "lib/agents/auditorRationaleWriter",      proves: "Records a rationale digest and decision context to support later review of the governed workflow.",                    evidence: { href: "/dashboard/audit",           label: "audit log" } },
  { name: "Improver",            role: "verification", kernel: "lib/agents/improverProposalSynthesizer", proves: "Proposes method improvements from the audit trail — the loop that turns evidence into a better proposal.",     evidence: { href: "/dashboard/agent-proposals", label: "method proposals" } },
  { name: "Confidence Calibrator", role: "verification", kernel: "lib/agents/confidenceCalibrator",      proves: "Wilson-lower-bound calibration of kernel accuracy from approval / reject / rollback outcomes. Recommends trust_more / pause / trust_less.", isNew: true },

  // memory
  { name: "Activity Aggregator", role: "memory",       kernel: "lib/agents/agentActivityAggregator",     proves: "Aggregates per-agent activity into the operator-visible cockpit timeline.",                                  evidence: { href: "/dashboard/agent-activity",  label: "agent activity" } },
  { name: "Memory Consolidator", role: "memory",       kernel: "lib/agents/agentMemoryConsolidator",     proves: "Compresses raw observations into episodic / semantic / procedural records. Recurrent observations promote to semantic. Prunes by relevance + age.", isNew: true },
];

const ROLE_FILTERS: ReadonlyArray<{ id: Capability["role"] | "all"; label: string }> = [
  { id: "all",          label: "All release controls" },
  { id: "perception",   label: "Perception" },
  { id: "reasoning",    label: "Reasoning" },
  { id: "planning",     label: "Planning" },
  { id: "safety",       label: "Safety" },
  { id: "verification", label: "Verification" },
  { id: "memory",       label: "Memory" },
];

// This is a deployment-governance product page, not an internal module index.
// Keep the public inventory limited to the logic that can participate in a
// governed release journey. Other kernels can remain internal until they have
// a truthful product surface and an end-to-end customer workflow.
const RELEASE_KERNELS = new Set<string>([
  "lib/agents/detectorSignalEmitter",
  "lib/agents/reasonerHypothesisWeaver",
  "lib/agents/simulatorSandboxSpec",
  "lib/agents/specWriter",
  "lib/agents/testCoverageProposer",
  "lib/agents/refactorSequencer",
  "lib/agents/migrationCoordinator",
  "lib/agents/githubPipelineRepairer",
  "lib/agents/githubReleaseNotesDrafter",
  "lib/agents/incidentTimelineWeaver",
  "lib/agents/postmortemDrafter",
  "lib/agents/databaseSchemaReviewer",
  "lib/agents/slowQueryProposer",
  "lib/agents/alertNoiseReducer",
  "lib/agents/agentWorkflowOrchestrator",
  "lib/agents/intentParser",
  "lib/agents/anomalyDetector",
  "lib/agents/changeRiskAssessor",
  "lib/agents/secretsHygieneScanner",
  "lib/agents/complianceControlMapper",
  "lib/agents/policyGateEvaluator",
  "lib/agents/boundaryGateCatalog",
  "lib/agents/council",
  "lib/agents/approverPacketAssembler",
  "lib/agents/verifierPostExecChecker",
  "lib/agents/auditorRationaleWriter",
  "lib/agents/improverProposalSynthesizer",
  "lib/agents/confidenceCalibrator",
  "lib/agents/agentActivityAggregator",
  "lib/agents/agentMemoryConsolidator",
]);

const RELEASE_CAPABILITIES = CAPABILITIES.filter((capability) => RELEASE_KERNELS.has(capability.kernel));

const ROLE_TONE: Record<Capability["role"], string> = {
  perception:   "text-zinc-300 bg-white/[0.035] border-white/[0.1]",
  reasoning:    "text-zinc-300 bg-white/[0.035] border-white/[0.1]",
  planning:     "text-zinc-300 bg-white/[0.035] border-white/[0.1]",
  safety:       "text-zinc-300 bg-white/[0.035] border-white/[0.1]",
  verification: "text-zinc-300 bg-white/[0.035] border-white/[0.1]",
  memory:        "text-zinc-300 bg-white/[0.035] border-white/[0.1]",
};

const PLAYBOOK_RESPONSIBILITIES = [
  ["01", "Understand the change", "Bring typed request, repository, environment, and signal context into a record people can review."],
  ["02", "Prepare the playbook", "Keep intended steps, checks, recovery context, and evidence requirements close to the decision."],
  ["03", "Expose risk and authority", "Make policy limits and human approval requirements visible before an action is considered."],
  ["04", "Guide, do not pretend", "Separate planning and recorded handoff from a verified provider action or production result."],
  ["05", "Prove what happened", "Preserve validation, recovery context, versions, and attributable evidence for later review."],
] as const;

export function CapabilitiesClient() {
  const [filter, setFilter] = useState<Capability["role"] | "all">("all");

  const visible = useMemo(
    () => (filter === "all" ? RELEASE_CAPABILITIES : RELEASE_CAPABILITIES.filter((c) => c.role === filter)),
    [filter],
  );

  return (
    <div className="relative isolate overflow-hidden">
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-20 bg-cover bg-center opacity-20" style={{ backgroundImage: "url('/images/axiom-hero-landscape-v1.png')" }} />
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 bg-[linear-gradient(180deg,rgba(11,12,11,0.8),rgba(11,12,11,0.94)_42%,#0c0d0c)]" />

      {/* ===== HERO ===== */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 md:px-10 pt-24 pb-10">
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mono-label inline-flex items-center gap-3"
        >
          <span className="text-violet-200 tabular-nums">AX</span>
          <span className="h-px w-6 bg-gradient-to-r from-violet-200/60 to-transparent" />
          Axiom Agent · deployment capabilities
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mt-5 max-w-4xl text-4xl font-medium leading-[1.02] tracking-[-0.045em] md:text-5xl"
        >
          Deployment capabilities, {" "}
          <span className="relative inline-block">
            with human control.
            <span aria-hidden className="absolute left-0 -bottom-0.5 h-[2px] w-full rounded-full bg-gradient-to-r from-violet-200/80 to-transparent" />
          </span>
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-5 max-w-2xl text-[15px] text-zinc-400 leading-relaxed"
        >
          A focused inventory of the release-governance logic behind Axiom: assess a change,
          prepare evidence, require human approval, and verify the result. A listed capability
          proves application logic exists; it does not by itself claim a live integration or automated deployment.
        </motion.p>
      </section>

      <section className="relative z-10 mx-auto max-w-6xl px-6 pb-12 md:px-10" aria-labelledby="playbook-responsibilities-heading">
        <div className="rounded-2xl border border-white/[0.08] bg-black/20 p-6 sm:p-8">
          <p className="mono-label">One governed Playbook</p>
          <div className="mt-3 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <h2 id="playbook-responsibilities-heading" className="max-w-xl text-2xl font-medium tracking-[-0.04em] text-white sm:text-3xl">The parts of Axiom are useful only when they support one release decision.</h2>
            <p className="max-w-sm text-sm leading-6 text-zinc-400">A capability is not a promise of autonomous execution or a live integration. It is a governed part of the workflow.</p>
          </div>
          <ol className="mt-8 grid gap-3 md:grid-cols-5">
            {PLAYBOOK_RESPONSIBILITIES.map(([number, title, copy]) => <li key={number} className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-4"><p className="font-mono text-[10px] tracking-[0.16em] text-violet-200">{number}</p><h3 className="mt-5 text-sm font-medium text-zinc-100">{title}</h3><p className="mt-2 text-xs leading-5 text-zinc-400">{copy}</p></li>)}
          </ol>
        </div>
      </section>

      <section className="relative z-10 mx-auto max-w-6xl px-6 pb-12 md:px-10" aria-labelledby="operational-terms-heading">
        <details className="group rounded-2xl border border-white/[0.07] bg-white/[0.02] p-6 md:p-8">
          <summary id="operational-terms-heading" className="cursor-pointer list-none text-lg font-medium text-white marker:hidden"><span className="flex items-center justify-between gap-4">Inspect control details <span className="text-sm font-normal text-zinc-500 transition group-open:rotate-45" aria-hidden>+</span></span></summary>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">These details are available for technical review. They do not claim live cloud mutation, a configured integration, or autonomous deployment.</p>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <article className="rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-5">
              <h3 className="font-semibold text-amber-100">Blast radius limits</h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-300">
                The operation-planning kernel batches resources to the configured maximum, rejects an invalid oversized step, and records a boundary event. Example: a 12-resource plan with a five-resource limit becomes 5 + 5 + 2 planning batches. This is kernel enforcement; live cloud mutation enforcement is not release-verified.
              </p>
            </article>
            <article className="rounded-xl border border-cyan-500/20 bg-cyan-500/[0.04] p-5">
              <h3 className="font-semibold text-cyan-100">Outcome memory</h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-300">
                The application-side module stores action outcome metadata in the audit store under an organization and cloud-account context. A previous failure can downgrade guidance for that resource to human review. Example: a failed resize recommendation makes the next resize proposal more cautious. Consistent retention/deletion controls and the released desktop journey remain unverified.
              </p>
            </article>
          </div>
        </details>
      </section>

      {/* ===== FILTERS ===== */}
      <details className="group relative z-10 mx-auto max-w-6xl px-6 pb-12 md:px-10">
        <summary className="cursor-pointer list-none rounded-2xl border border-white/[0.07] bg-white/[0.02] px-6 py-5 text-lg font-medium text-zinc-100 marker:hidden"><span className="flex items-center justify-between gap-4">Explore the detailed capability inventory <span className="text-sm font-normal text-zinc-500 transition group-open:rotate-45" aria-hidden>+</span></span></summary>
        <p className="mt-5 max-w-2xl text-sm leading-6 text-zinc-400">The underlying controls remain available for engineering review, without turning this page into a wall of implementation cards.</p>
        <div className="mt-5">
        <div className="flex flex-wrap gap-2">
          {ROLE_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={[
                "rounded-full px-3.5 py-1.5 text-[12px] font-medium transition border",
                filter === f.id
                  ? "bg-violet-300/[0.12] border-violet-300/30 text-violet-100"
                  : "bg-white/[0.02] border-white/[0.06] text-zinc-400 hover:text-white hover:bg-white/[0.05]",
              ].join(" ")}
            >
              {f.label}
            </button>
          ))}
        </div>
        </div>

      {/* ===== GRID ===== */}
        <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {visible.map((c, i) => (
            <motion.div
              key={c.kernel}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.45, delay: Math.min(i * 0.03, 0.3) }}
              whileHover={{ y: -3, transition: { duration: 0.18 } }}
              className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5 transition-all hover:border-violet-300/25 hover:bg-white/[0.045]"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-[13.5px] font-semibold text-white">{c.name}</p>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <span className={["text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded-full border", ROLE_TONE[c.role]].join(" ")}>
                    {c.role}
                  </span>
                  {c.isNew ? (
                    <span className="text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded-full border border-emerald-500/40 bg-emerald-500/15 text-emerald-300">
                      new
                    </span>
                  ) : null}
                </div>
              </div>
              <p className="mt-2 text-[12.5px] text-zinc-400 leading-snug">{c.proves}</p>
              <p className="mt-2 text-[10.5px] font-mono text-zinc-500 truncate" title={c.kernel}>
                {c.kernel}
              </p>
              {c.evidence ? (
                <Link
                  href={c.evidence.href.startsWith("/dashboard") ? "/docs" : c.evidence.href}
                  className="mt-3 inline-flex items-center gap-1 text-[11px] font-mono text-indigo-300 hover:text-indigo-200 transition"
                >
                  → {c.evidence.label}
                </Link>
              ) : null}
            </motion.div>
          ))}
        </div>
      </details>

      {/* ===== CLOSER ===== */}
      <section className="relative z-10 mx-auto max-w-3xl px-6 md:px-10 py-16 text-center">
        <h3 className="text-xl md:text-2xl font-semibold tracking-tight">
          Capability logic is only one layer of the product.
        </h3>
        <p className="mt-3 text-zinc-400 text-[14px]">
          Provider configuration, authorization, persistence, recovery, and a verified customer journey must also be present before a capability is described as available.
        </p>
        <div className="mt-6 flex items-center justify-center gap-2">
          <Link
            href="/changelog"
            className="inline-flex items-center gap-2 rounded-full bg-indigo-500 px-4 py-2 text-[12.5px] font-medium text-white shadow-[0_0_20px_rgba(99,102,241,0.45)] hover:bg-indigo-400 transition"
          >
            See the changelog
          </Link>
          <Link
            href="/download"
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-[12.5px] font-medium text-zinc-200 hover:bg-white/[0.07] transition"
          >
            View desktop downloads
          </Link>
        </div>
      </section>
    </div>
  );
}
