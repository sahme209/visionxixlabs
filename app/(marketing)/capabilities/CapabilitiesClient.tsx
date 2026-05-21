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
  { name: "Detector",            role: "perception",   kernel: "lib/agents/detectorSignalEmitter",       proves: "Watches telemetry and emits typed signals to the bus.",                                 evidence: { href: "/dashboard/agent-bus",       label: "agent bus" } },
  { name: "Reasoner",            role: "reasoning",    kernel: "lib/agents/reasonerHypothesisWeaver",    proves: "Weaves 1..N signals into a typed hypothesis with a confidence score.",                  evidence: { href: "/dashboard/agent-bus",       label: "agent bus" } },
  { name: "Simulator",           role: "reasoning",    kernel: "lib/agents/simulatorSandboxSpec",        proves: "Sandboxes the proposed action end-to-end and returns a verdict before any approval packet is built." },

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
  { name: "Multi-Agent Debate",    role: "planning",   kernel: "lib/agents/multiAgentDebate",            proves: "N kernels propose, council reconciles, dissent surfaced explicitly. Safety-tier reject is a hard veto.",                                         isNew: true },

  // safety
  { name: "Policy Gate",         role: "safety",       kernel: "lib/agents/policyGateEvaluator",         proves: "Applies the tenant charter to every proposal — refuses anything outside the operator-signed scope.",         evidence: { href: "/dashboard/admin-charters",  label: "tenant charters" } },
  { name: "Boundary Gate",       role: "safety",       kernel: "lib/agents/boundaryGateCatalog",         proves: "Classifies the blast radius of every proposal into a closed-union severity tier.",                          evidence: { href: "/dashboard/automation-boundaries", label: "boundary catalog" } },
  { name: "Council",             role: "safety",       kernel: "lib/agents/council",                     proves: "Weighted-vote consensus — ⅔ default — across the planning + safety agents.",                                 evidence: { href: "/dashboard/agent-bus",       label: "agent bus" } },
  { name: "Approver",            role: "safety",       kernel: "lib/agents/approverPacketAssembler",     proves: "Assembles the approval packet the operator sees — the only gate that ever lets autonomy act.",               evidence: { href: "/dashboard/approvals",       label: "approvals" } },

  // verification
  { name: "Verifier",            role: "verification", kernel: "lib/agents/verifierPostExecChecker",     proves: "Post-execution check — confirms the action achieved the expected outcome.",                                  evidence: { href: "/dashboard/audit",           label: "audit log" } },
  { name: "Auditor",             role: "verification", kernel: "lib/agents/auditorRationaleWriter",      proves: "Writes the durable sha-256 rationale row that makes the action replayable and provable.",                    evidence: { href: "/dashboard/audit",           label: "audit log" } },
  { name: "Improver",            role: "verification", kernel: "lib/agents/improverProposalSynthesizer", proves: "Proposes method improvements from the audit trail — the loop that turns evidence into a better proposal.",     evidence: { href: "/dashboard/agent-proposals", label: "method proposals" } },
  { name: "Confidence Calibrator", role: "verification", kernel: "lib/agents/confidenceCalibrator",      proves: "Wilson-lower-bound calibration of kernel accuracy from approval / reject / rollback outcomes. Recommends trust_more / pause / trust_less.", isNew: true },

  // memory
  { name: "Activity Aggregator", role: "memory",       kernel: "lib/agents/agentActivityAggregator",     proves: "Aggregates per-agent activity into the operator-visible cockpit timeline.",                                  evidence: { href: "/dashboard/agent-activity",  label: "agent activity" } },
  { name: "Memory Consolidator", role: "memory",       kernel: "lib/agents/agentMemoryConsolidator",     proves: "Compresses raw observations into episodic / semantic / procedural records. Recurrent observations promote to semantic. Prunes by relevance + age.", isNew: true },
];

const ROLE_FILTERS: ReadonlyArray<{ id: Capability["role"] | "all"; label: string }> = [
  { id: "all",          label: "All agent kernels" },
  { id: "perception",   label: "Perception" },
  { id: "reasoning",    label: "Reasoning" },
  { id: "planning",     label: "Planning" },
  { id: "safety",       label: "Safety" },
  { id: "verification", label: "Verification" },
  { id: "memory",       label: "Memory" },
];

const ROLE_TONE: Record<Capability["role"], string> = {
  perception:   "text-cyan-300    bg-cyan-500/10    border-cyan-500/30",
  reasoning:    "text-indigo-300  bg-indigo-500/10  border-indigo-500/30",
  planning:     "text-fuchsia-300 bg-fuchsia-500/10 border-fuchsia-500/30",
  safety:       "text-amber-300   bg-amber-500/10   border-amber-500/30",
  verification: "text-emerald-300 bg-emerald-500/10 border-emerald-500/30",
  memory:       "text-zinc-300    bg-zinc-500/10    border-zinc-500/30",
};

export function CapabilitiesClient() {
  const [filter, setFilter] = useState<Capability["role"] | "all">("all");

  const visible = useMemo(
    () => (filter === "all" ? CAPABILITIES : CAPABILITIES.filter((c) => c.role === filter)),
    [filter],
  );

  return (
    <div className="relative">
      {/* Ambient aurora */}
      <div className="pointer-events-none fixed inset-0 z-0 opacity-50">
        <div className="absolute -top-1/4 left-1/4 h-[70vh] w-[60vw] rounded-full bg-gradient-to-br from-fuchsia-500/15 via-indigo-500/8 to-transparent blur-3xl" />
        <div className="absolute bottom-0 right-1/4 h-[50vh] w-[40vw] rounded-full bg-gradient-to-tl from-emerald-500/10 to-transparent blur-3xl" />
      </div>

      {/* ===== HERO ===== */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 md:px-10 pt-20 pb-10">
        <motion.span
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[10px] font-mono uppercase tracking-widest text-fuchsia-300"
        >
          ai agent kernels · shipped, not promised
        </motion.span>
        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mt-5 text-4xl md:text-6xl font-bold tracking-[-0.04em] leading-[1.05]"
        >
          {CAPABILITIES.length} AI agent kernels.{" "}
          <span className="bg-gradient-to-r from-fuchsia-300 via-indigo-300 to-cyan-300 bg-clip-text text-transparent">
            One bus.
          </span>
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-5 max-w-2xl text-[15px] text-zinc-400 leading-relaxed"
        >
          Each engineer is a pure-function kernel in <span className="font-mono text-zinc-300">lib/agents/</span>{" "}
          with closed-union types and a vitest suite. None of them act on their own —
          every action they propose is gated through the council, the boundary
          tier, and a signed approval packet.
        </motion.p>
      </section>

      {/* ===== FILTERS ===== */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 md:px-10 pb-6">
        <div className="flex flex-wrap gap-2">
          {ROLE_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={[
                "rounded-full px-3.5 py-1.5 text-[12px] font-medium transition border",
                filter === f.id
                  ? "bg-fuchsia-500/15 border-fuchsia-500/40 text-fuchsia-200"
                  : "bg-white/[0.02] border-white/[0.06] text-zinc-400 hover:text-white hover:bg-white/[0.05]",
              ].join(" ")}
            >
              {f.label}
            </button>
          ))}
        </div>
      </section>

      {/* ===== GRID ===== */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 md:px-10 pb-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {visible.map((c, i) => (
            <motion.div
              key={c.kernel}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.45, delay: Math.min(i * 0.03, 0.3) }}
              whileHover={{ y: -3, transition: { duration: 0.18 } }}
              className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 hover:border-fuchsia-500/30 hover:bg-white/[0.04] transition"
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
                  href={c.evidence.href}
                  className="mt-3 inline-flex items-center gap-1 text-[11px] font-mono text-indigo-300 hover:text-indigo-200 transition"
                >
                  → {c.evidence.label}
                </Link>
              ) : null}
            </motion.div>
          ))}
        </div>
      </section>

      {/* ===== CLOSER ===== */}
      <section className="relative z-10 mx-auto max-w-3xl px-6 md:px-10 py-16 text-center">
        <h3 className="text-xl md:text-2xl font-semibold tracking-tight">
          Every engineer above ships with a vitest suite.
        </h3>
        <p className="mt-3 text-zinc-400 text-[14px]">
          The same safety contract — closed-union types, sha-256 rationale rows,
          approval-only-no-execution — applies across every kernel on the bus.
        </p>
        <div className="mt-6 flex items-center justify-center gap-2">
          <Link
            href="/changelog"
            className="inline-flex items-center gap-2 rounded-full bg-indigo-500 px-4 py-2 text-[12.5px] font-medium text-white shadow-[0_0_20px_rgba(99,102,241,0.45)] hover:bg-indigo-400 transition"
          >
            See the changelog
          </Link>
          <Link
            href="/dashboard/agent-bus"
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-[12.5px] font-medium text-zinc-200 hover:bg-white/[0.07] transition"
          >
            Open the bus
          </Link>
        </div>
      </section>
    </div>
  );
}
