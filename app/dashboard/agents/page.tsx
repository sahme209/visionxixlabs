/**
 * /dashboard/agents — the agent workforce.
 *
 * Inventory of every shipped agent kernel that lives on the bus.
 * Cards group by role (perception · reasoning · planning · safety ·
 * verification · memory · workflow). Each card maps to a real file
 * in lib/agents/ — if an entry here doesn't have a backing module,
 * it doesn't belong on this page.
 *
 * Roster on this page is a static catalog. Per-tenant runtime state
 * (active jobs, last invocation, current load) is surfaced separately
 * via /dashboard/agent-activity and /dashboard/agent-bus, which read
 * from AxiomAgentRun + AgentBusMessage rows.
 */

import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRightIcon, BookOpenIcon } from "@heroicons/react/24/outline";
import { getLiveAgentActivity, relativeTime } from "@/lib/platform/livePlatformState";
import { LiveBadge } from "@/components/platform/LiveBadge";

export const metadata: Metadata = {
  title: "Agent workforce · Axiom",
  description:
    "The AI agent workforce that powers Axiom — perception, reasoning, planning, safety, verification, memory. Each agent maps to a typed pure-function kernel in lib/agents/.",
};

type AgentRole =
  | "perception"
  | "reasoning"
  | "planning"
  | "safety"
  | "verification"
  | "memory"
  | "workflow";

interface AgentProfile {
  /** Public-facing name. */
  name: string;
  /** Module file under lib/agents/ (without `.ts`). */
  module: string;
  role: AgentRole;
  /** Short description of what the agent does. */
  job: string;
  /** Whether the agent can propose actions that mutate external systems. */
  canMutate: boolean;
  /** Cockpit deep link where the agent's output is most visible. */
  evidenceRoute?: { href: string; label: string };
  /**
   * Closed-union sender literal (lib/agents/agentBusModel.ts) when this
   * kernel is wired onto the bus. Missing for library-only kernels
   * (specWriter, testCoverageProposer, etc.) — those kernels are
   * function-call APIs, not bus participants.
   */
  senderId?: "detector" | "reasoner" | "simulator" | "policy_gate" | "boundary_gate" | "approver" | "verifier" | "auditor" | "council" | "improver";
}

const AGENTS: readonly AgentProfile[] = [
  // perception
  { name: "Detector",                  module: "detectorSignalEmitter",      role: "perception",   job: "Watches telemetry and emits typed signals onto the bus.",                              canMutate: false, evidenceRoute: { href: "/dashboard/agent-bus", label: "Agent bus" }, senderId: "detector" },
  { name: "Activity Aggregator",       module: "agentActivityAggregator",    role: "perception",   job: "Aggregates per-agent activity into the operator-visible timeline.",                    canMutate: false, evidenceRoute: { href: "/dashboard/agent-activity", label: "Agent activity" } },

  // reasoning
  { name: "Reasoner",                  module: "reasonerHypothesisWeaver",   role: "reasoning",    job: "Weaves multiple signals into a typed hypothesis with confidence + expected next agents.", canMutate: false, evidenceRoute: { href: "/dashboard/rationale", label: "Decision rationale" }, senderId: "reasoner" },
  { name: "Simulator",                 module: "simulatorSandboxSpec",       role: "reasoning",    job: "Runs the proposed action in a sandbox and returns a verdict before any approval packet is built.", canMutate: false, evidenceRoute: { href: "/dashboard/simulations", label: "Simulations" }, senderId: "simulator" },
  { name: "Council",                   module: "council",                    role: "reasoning",    job: "Weighted-vote consensus across the planning + safety agents (⅔ default).",            canMutate: false, evidenceRoute: { href: "/dashboard/agent-bus", label: "Agent bus" }, senderId: "council" },

  // planning
  { name: "Spec Writer",               module: "specWriter",                 role: "planning",     job: "Drafts a typed engineering spec (goals, non-goals, risks, verification, rollback) from a problem statement.", canMutate: false },
  { name: "Test Coverage Proposer",    module: "testCoverageProposer",       role: "planning",     job: "Reads a diff and proposes must-have / should-have / nice-to-have tests.",              canMutate: false },
  { name: "Refactor Sequencer",        module: "refactorSequencer",          role: "planning",     job: "Topo-sorts a refactor with per-step safety verdict + rollback per step.",              canMutate: false },
  { name: "Migration Coordinator",     module: "migrationCoordinator",       role: "planning",     job: "Builds a multi-stage migration runbook with backwards-compat window and gate checks.", canMutate: false },
  { name: "Improver Proposal Synth",   module: "improverProposalSynthesizer",role: "planning",     job: "Reads recent audit + outcome rows and proposes method improvements.",                  canMutate: false, evidenceRoute: { href: "/dashboard/agent-proposals", label: "Method proposals" }, senderId: "improver" },
  { name: "Proposal Vetter",           module: "proposalVetter",             role: "planning",     job: "Vets agent-authored proposals against operator-stated calibration rules.",             canMutate: false },
  { name: "Proposal Calibration",      module: "proposalCalibration",        role: "planning",     job: "Calibrates proposal confidence against operator feedback over time.",                  canMutate: false },
  { name: "Proposal Impact Tracker",   module: "proposalImpactTracker",      role: "planning",     job: "Tracks downstream impact of accepted proposals to feed the council.",                  canMutate: false },

  // safety
  { name: "Policy Gate",               module: "policyGateEvaluator",        role: "safety",       job: "Applies the tenant charter to every proposal — refuses anything outside operator-signed scope.", canMutate: false, evidenceRoute: { href: "/dashboard/charter", label: "Autonomy charter" }, senderId: "policy_gate" },
  { name: "Boundary Gate",             module: "boundaryGateCatalog",        role: "safety",       job: "Classifies blast radius into closed-union severity tiers.",                            canMutate: false, evidenceRoute: { href: "/dashboard/automation-boundaries", label: "Automation boundaries" }, senderId: "boundary_gate" },
  { name: "Approver",                  module: "approverPacketAssembler",    role: "safety",       job: "Assembles the approval packet the operator sees — the only gate that lets autonomy act.", canMutate: true,  evidenceRoute: { href: "/dashboard/approvals", label: "Approvals" }, senderId: "approver" },

  // verification
  { name: "Verifier",                  module: "verifierPostExecChecker",    role: "verification", job: "Post-execution check — confirms the action achieved the expected outcome.",            canMutate: false, evidenceRoute: { href: "/dashboard/audit", label: "Audit log" }, senderId: "verifier" },
  { name: "Auditor",                   module: "auditorRationaleWriter",     role: "verification", job: "Writes the durable sha-256 rationale row that makes the action replayable.",            canMutate: false, evidenceRoute: { href: "/dashboard/audit", label: "Audit log" }, senderId: "auditor" },

  // memory
  { name: "Method Proposal Store",     module: "methodProposalStore",        role: "memory",       job: "Persists method proposals over time so improvements compound.",                         canMutate: false },
  { name: "Method Proposal Model",     module: "methodProposalModel",        role: "memory",       job: "Typed representation of method proposals + calibration history.",                       canMutate: false },

  // workflow / orchestration
  { name: "Workflow Executor",         module: "axiomWorkflowExecutor",      role: "workflow",     job: "Orchestrates multi-step agent flows end-to-end.",                                        canMutate: true,  evidenceRoute: { href: "/dashboard/workflows", label: "Workflows" } },
  { name: "Workflow Translator",       module: "aiWorkflowTranslator",       role: "workflow",     job: "Translates natural-language operator intent into typed workflow steps.",                canMutate: false, evidenceRoute: { href: "/dashboard/workflow-translator", label: "Workflow translator" } },
  { name: "Agent Bus",                 module: "agentBus",                   role: "workflow",     job: "Typed message bus between every agent kernel on this page.",                            canMutate: false, evidenceRoute: { href: "/dashboard/agent-bus", label: "Agent bus" } },
  { name: "Axiom Assistant",           module: "axiomAssistantAgent",        role: "workflow",     job: "The operator-facing chat agent — answers questions and stages proposals.",              canMutate: false },
];

const ROLE_META: Record<
  AgentRole,
  { label: string; tone: string; description: string }
> = {
  perception:   { label: "Perception",   tone: "border-cyan-500/30    bg-cyan-500/10    text-cyan-300",    description: "Watch the world and emit typed signals." },
  reasoning:    { label: "Reasoning",    tone: "border-indigo-500/30  bg-indigo-500/10  text-indigo-300",  description: "Form hypotheses, simulate them, run the council vote." },
  planning:     { label: "Planning",     tone: "border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-300", description: "Turn a hypothesis or operator problem into a typed plan." },
  safety:       { label: "Safety",       tone: "border-amber-500/30   bg-amber-500/10   text-amber-300",   description: "Apply the charter, classify the blast radius, build the packet." },
  verification: { label: "Verification", tone: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300", description: "Check that the action did what it claimed, and write the audit row." },
  memory:       { label: "Memory",       tone: "border-zinc-500/30    bg-zinc-500/10    text-zinc-300",    description: "Persist proposals + calibration so improvements compound over time." },
  workflow:     { label: "Workflow",     tone: "border-violet-500/30  bg-violet-500/10  text-violet-300",  description: "Orchestrate the agents end-to-end on the bus." },
};

const ROLES_ORDER: readonly AgentRole[] = [
  "perception",
  "reasoning",
  "planning",
  "safety",
  "verification",
  "memory",
  "workflow",
];

export default async function AgentsPage() {
  const total = AGENTS.length;
  const mutating = AGENTS.filter((a) => a.canMutate).length;
  const live = await getLiveAgentActivity();

  return (
    <div className="relative">
      {/* Hero */}
      <div className="mb-8 rounded-3xl border border-white/[0.05] bg-gradient-to-br from-white/[0.03] via-white/[0.015] to-transparent p-6 md:p-8 relative overflow-hidden">
        <div
          className="absolute inset-0 -z-10 opacity-90 pointer-events-none"
          style={{
            background:
              "radial-gradient(900px 320px at 14% 0%, rgba(217,70,239,0.10), transparent 60%), radial-gradient(700px 260px at 86% 110%, rgba(99,102,241,0.10), transparent 60%)",
          }}
          aria-hidden
        />
        <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-fuchsia-300/80">
          Platform · agent workforce
        </p>
        <h1 className="mt-3 text-3xl md:text-4xl font-bold tracking-[-0.03em]">
          The agent workforce
        </h1>
        <p className="mt-3 max-w-2xl text-[14px] text-zinc-400 leading-relaxed">
          {total} agent kernels live on the bus, grouped by role. Each is a typed
          pure-function module in <span className="font-mono">lib/agents/</span> with
          a vitest suite. Only the agents marked as <em>can mutate</em> stage actions
          that touch external systems — and those still require an operator approval.
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-2 text-[11px] font-mono">
          <span className="rounded-full border border-violet-500/30 bg-violet-500/10 text-violet-300 px-2.5 py-1">
            {total} agents
          </span>
          <span className="rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-300 px-2.5 py-1">
            {mutating} can mutate (approval-gated)
          </span>
          {live.ok ? (
            <>
              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-200 px-2.5 py-1 inline-flex items-center gap-1.5">
                <LiveBadge />
                {live.totalMessages} bus messages · 24h
              </span>
              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-200 px-2.5 py-1 inline-flex items-center gap-1.5">
                <LiveBadge />
                {live.totalRuns} agent runs · 24h
              </span>
            </>
          ) : null}
          <Link
            href="/dashboard/agent-bus"
            className="ml-auto inline-flex items-center gap-1 text-[11px] text-violet-300 hover:text-violet-200 transition"
          >
            Live bus
            <ArrowRightIcon className="h-3 w-3" />
          </Link>
        </div>
      </div>

      {live.ok && live.recentRuns.length > 0 ? (
        <section className="mb-8 rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.04] p-4 md:p-5">
          <header className="flex items-center justify-between gap-3 mb-3">
            <h2 className="text-[13px] font-semibold text-emerald-100 flex items-center gap-2">
              <LiveBadge />
              Recent agent runs · your tenant
            </h2>
            <Link
              href="/dashboard/agent-activity"
              className="inline-flex items-center gap-1 text-[11px] text-emerald-200 hover:text-white transition"
            >
              Full activity
              <ArrowRightIcon className="h-3 w-3" />
            </Link>
          </header>
          <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-2">
            {live.recentRuns.map((r) => (
              <li
                key={r.id}
                className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.04] px-3 py-2 text-[11px]"
              >
                <p className="font-mono uppercase tracking-widest text-[9.5px] text-emerald-300/80">
                  {r.trigger.replace("_", " ")}
                </p>
                <p className="mt-0.5 text-white font-medium">{r.status.replace("_", " ")}</p>
                <p className="mt-0.5 font-mono text-[10px] text-zinc-400">{relativeTime(r.createdAt)}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Roster grouped by role */}
      <div className="space-y-10">
        {ROLES_ORDER.map((role) => {
          const inRole = AGENTS.filter((a) => a.role === role);
          if (inRole.length === 0) return null;
          const meta = ROLE_META[role];
          return (
            <section key={role}>
              <header className="flex flex-wrap items-baseline gap-3 mb-3">
                <span
                  className={[
                    "text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded-full border",
                    meta.tone,
                  ].join(" ")}
                >
                  {meta.label}
                </span>
                <p className="text-[12px] text-zinc-500">{meta.description}</p>
                <span className="ml-auto text-[10px] font-mono uppercase tracking-widest text-zinc-500">
                  {inRole.length}
                </span>
              </header>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {inRole.map((a) => {
                  const liveMessages =
                    a.senderId && live.ok ? live.messagesBySender[a.senderId] ?? 0 : null;
                  return (
                  <article
                    key={a.module}
                    className={[
                      "rounded-2xl border bg-white/[0.015] p-4 md:p-5 hover:bg-white/[0.025] transition flex flex-col",
                      liveMessages && liveMessages > 0
                        ? "border-emerald-500/25 hover:border-emerald-500/45"
                        : "border-white/[0.06] hover:border-violet-500/30",
                    ].join(" ")}
                  >
                    <header className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="text-[14px] font-semibold text-white truncate">{a.name}</h3>
                        <p className="mt-0.5 text-[10.5px] font-mono text-zinc-500 truncate" title={`lib/agents/${a.module}.ts`}>
                          lib/agents/{a.module}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {a.canMutate ? (
                          <span className="text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-300 whitespace-nowrap">
                            can mutate
                          </span>
                        ) : (
                          <span className="text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded-full border border-zinc-500/30 bg-zinc-500/10 text-zinc-400 whitespace-nowrap">
                            read · safe
                          </span>
                        )}
                        {liveMessages !== null && liveMessages > 0 ? (
                          <LiveBadge hint={`${liveMessages} bus messages in the last 24h`} />
                        ) : null}
                      </div>
                    </header>

                    <p className="mt-3 text-[12.5px] text-zinc-400 leading-relaxed">{a.job}</p>

                    {liveMessages !== null ? (
                      <p className="mt-2 text-[10.5px] font-mono text-zinc-500">
                        {liveMessages === 0
                          ? <>quiet · 0 bus messages · 24h</>
                          : <span className="text-emerald-300">{liveMessages} bus messages · 24h</span>}
                      </p>
                    ) : null}

                    <footer className="mt-auto pt-4 flex items-center justify-between">
                      {a.evidenceRoute ? (
                        <Link
                          href={a.evidenceRoute.href}
                          className="inline-flex items-center gap-1 text-[12px] font-medium text-violet-300 hover:text-violet-200 transition"
                        >
                          {a.evidenceRoute.label}
                          <ArrowRightIcon className="h-3 w-3" />
                        </Link>
                      ) : (
                        <span className="text-[11px] text-zinc-500">No dedicated cockpit yet</span>
                      )}
                      <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">
                        kernel
                      </span>
                    </footer>
                  </article>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      {/* Pointer to docs */}
      <section className="mt-12 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 md:p-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <BookOpenIcon className="h-5 w-5 text-zinc-400" />
          <div>
            <p className="text-[13px] font-medium text-white">
              Want to add a new agent?
            </p>
            <p className="mt-1 text-[12px] text-zinc-500 max-w-md">
              Drop a new pure-function module in <span className="font-mono">lib/agents/</span>{" "}
              with closed-union types + a vitest suite, then append it to the roster
              in <span className="font-mono">app/dashboard/agents/page.tsx</span>.
            </p>
          </div>
        </div>
        <Link
          href="/dashboard/agent-proposals"
          className="inline-flex items-center gap-1.5 rounded-full border border-violet-500/30 bg-violet-500/10 px-3.5 py-1.5 text-[12px] font-medium text-violet-200 hover:bg-violet-500/15 transition"
        >
          Method proposals
          <ArrowRightIcon className="h-3 w-3" />
        </Link>
      </section>
    </div>
  );
}
