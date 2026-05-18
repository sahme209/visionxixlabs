/**
 * /dashboard/autonomous-ops
 *
 * The AGI-oriented operations home. Renders the observe → reason → plan
 * → validate → govern → approve → prepare → verify → audit → remember
 * loop with honest source labels. No fake "fully autonomous" claims.
 */

import Link from "next/link";
import {
  CpuChipIcon,
  ShieldCheckIcon,
  EyeIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
  ArrowRightIcon,
  ClockIcon,
  BoltIcon,
  DocumentCheckIcon,
  SignalIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";

import { reasonAboutOperations } from "@/lib/agent/agiOperationsBrain";
import { buildExecutionGraph } from "@/lib/agent/executionGraphBuilder";
import { analyzeCoverageGaps } from "@/lib/cloud/coverageGapAnalyzer";
import { runDeepValidation } from "@/lib/validation/deepValidationRunner";
import { summarizeFeedback } from "@/lib/memory/feedbackLoop";
import { highestRiskNodes, blockedNodes, nodesOfType, nextActionsFromGraph, type ExecutionGraph } from "@/lib/agent/executionGraph";
import { RunOperatingLoopPanel } from "@/components/dashboard/RunOperatingLoopPanel";

export const dynamic = "force-dynamic";

const LOOP_STEPS = [
  { key: "observe",  label: "Observe",  Icon: EyeIcon,        tone: "text-cyan-300"    },
  { key: "reason",   label: "Reason",   Icon: CpuChipIcon,     tone: "text-violet-300"  },
  { key: "plan",     label: "Plan",     Icon: BoltIcon,        tone: "text-fuchsia-300" },
  { key: "validate", label: "Validate", Icon: CheckCircleIcon, tone: "text-emerald-300" },
  { key: "govern",   label: "Govern",   Icon: ShieldCheckIcon, tone: "text-amber-300"   },
  { key: "approve",  label: "Approve",  Icon: DocumentCheckIcon, tone: "text-rose-300"  },
  { key: "prepare",  label: "Prepare",  Icon: SignalIcon,      tone: "text-sky-300"     },
  { key: "verify",   label: "Verify",   Icon: CheckCircleIcon, tone: "text-emerald-300" },
  { key: "audit",    label: "Audit",    Icon: ClockIcon,       tone: "text-zinc-300"    },
  { key: "remember", label: "Remember", Icon: ArrowPathIcon,   tone: "text-violet-300"  },
];

function statusTone(status: string): string {
  switch (status) {
    case "ready":     return "text-emerald-300 bg-emerald-500/10 border-emerald-500/25";
    case "running":   return "text-cyan-300 bg-cyan-500/10 border-cyan-500/25";
    case "pending":   return "text-amber-300 bg-amber-500/10 border-amber-500/25";
    case "paused":    return "text-amber-300 bg-amber-500/10 border-amber-500/25";
    case "blocked":   return "text-rose-300 bg-rose-500/10 border-rose-500/25";
    case "completed": return "text-emerald-300 bg-emerald-500/10 border-emerald-500/25";
    case "failed":    return "text-rose-300 bg-rose-500/10 border-rose-500/25";
    case "preview":   return "text-violet-300 bg-violet-500/10 border-violet-500/25";
    case "planned":   return "text-zinc-300 bg-zinc-500/10 border-zinc-500/25";
    default:          return "text-zinc-300 bg-zinc-500/10 border-zinc-500/25";
  }
}

function riskTone(risk: string): string {
  switch (risk) {
    case "critical": return "text-rose-300";
    case "high":     return "text-amber-300";
    case "medium":   return "text-cyan-300";
    case "low":      return "text-zinc-400";
    default:         return "text-zinc-500";
  }
}

export default async function AutonomousOpsPage() {
  const [brain, graph, gaps, deep] = await Promise.all([
    reasonAboutOperations(),
    buildExecutionGraph(),
    Promise.resolve(analyzeCoverageGaps()),
    runDeepValidation(),
  ]);
  const memory = summarizeFeedback();

  const recommendations = nodesOfType(graph, "recommendation");
  const nextActions     = nextActionsFromGraph(graph);
  const blocked         = blockedNodes(graph);
  const topRisk         = highestRiskNodes(graph, 5);

  return (
    <div className="space-y-10">
      {/* ── Header ────────────────────────────────────────────────── */}
      <header>
        <div className="flex items-center gap-3 mb-3">
          <CpuChipIcon className="h-4 w-4 text-violet-300" />
          <span className="text-[10px] font-mono font-semibold text-violet-300 uppercase tracking-[0.22em]">AGI Operations</span>
          <span className="text-[10px] font-mono text-zinc-600">·</span>
          <span className="text-[10px] font-mono text-zinc-500">observe → reason → plan → validate → govern → approve → prepare → verify → audit → remember</span>
        </div>
        <h1 className="text-3xl md:text-4xl font-bold tracking-[-0.04em] mb-2">
          The <span className="bg-gradient-to-r from-violet-300 via-fuchsia-300 to-cyan-300 bg-clip-text text-transparent">autonomous</span> operations loop.
        </h1>
        <p className="text-sm text-zinc-400 max-w-3xl leading-relaxed">
          Axiom moves toward A-to-Z cloud operations through one coordinated loop. Every action is approval-gated and reversible. Preview / planned / blocked surfaces are labelled honestly.
        </p>
      </header>

      {/* Run operating loop — clickable POST /api/operating-loop/run */}
      <RunOperatingLoopPanel />

      {/* ── Brain headline strip ─────────────────────────────────── */}
      <section className="rounded-2xl border border-white/[0.07] bg-gradient-to-br from-[#0d0d12] via-[#0a0a0f] to-[#08080c] p-6">
        <div className="flex flex-wrap items-start justify-between gap-6 mb-5">
          <div>
            <p className="text-[10px] font-mono text-violet-300 uppercase tracking-[0.22em] mb-2">// brain</p>
            <p className="text-xl font-semibold text-white tracking-tight">{brain.summary.headline}</p>
            <p className="text-xs text-zinc-500 mt-2 max-w-2xl">{brain.reasoning.narrative.split("\n")[0]}</p>
          </div>
          <div className="grid grid-cols-3 gap-6 text-[10px] font-mono">
            <Stat label="confidence"        value={brain.confidence}                tone="text-violet-300" />
            <Stat label="validation score"  value={`${brain.summary.validationScore}/100`} tone="text-emerald-300" />
            <Stat label="coverage score"    value={`${brain.summary.coverageScore}/100`}   tone="text-cyan-300" />
          </div>
        </div>

        {/* Loop visualisation */}
        <div className="grid grid-cols-5 md:grid-cols-10 gap-2 pt-4 border-t border-white/[0.05]">
          {LOOP_STEPS.map(({ key, label, Icon, tone }) => (
            <div key={key} className="flex flex-col items-center text-center">
              <Icon className={`h-4 w-4 mb-1.5 ${tone}`} />
              <span className="text-[10px] font-mono text-zinc-400 tracking-wider uppercase">{label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Stats row ─────────────────────────────────────────────── */}
      <section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Card title="Active autonomous tasks"   value={`${recommendations.length}`} tone="violet"  detail="Candidate actions ready for review." />
        <Card title="Approval-gated"             value={`${brain.nextActions.approvalRequiredFor.length}`} tone="amber"   detail="Operator + approver required." />
        <Card title="Blocked"                    value={`${blocked.length}`}        tone="rose"    detail="Capability / config / policy blocked." />
        <Card title="Coverage gaps"              value={`${gaps.summary.total}`}    tone="cyan"    detail={`${gaps.summary.high + gaps.summary.critical} high+ severity.`} />
      </section>

      {/* ── Two-column body ───────────────────────────────────────── */}
      <section className="grid lg:grid-cols-3 gap-5">
        {/* Next actions */}
        <div className="lg:col-span-2 rounded-2xl border border-white/[0.06] bg-white/[0.015] p-6">
          <SectionHeader Icon={BoltIcon} title="What Axiom can do next" tone="text-violet-300" />
          {nextActions.length === 0 && (
            <p className="text-sm text-zinc-500">No high-leverage next action right now — connect a provider to start the loop.</p>
          )}
          <ul className="space-y-3">
            {nextActions.map((node) => {
              const href = node.evidence.find((e) => e.label === "href")?.ref;
              return (
                <li key={node.id} className="flex items-start justify-between gap-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white">{node.title}</p>
                    {node.detail && <p className="text-xs text-zinc-500 mt-1">{node.detail}</p>}
                    <div className="flex items-center gap-3 mt-2 text-[10px] font-mono">
                      <span className={`px-1.5 py-0.5 rounded border ${statusTone(node.status)}`}>{node.status}</span>
                      <span className={riskTone(node.risk)}>risk · {node.risk}</span>
                      <span className="text-zinc-600">source · {node.sourceMode}</span>
                    </div>
                  </div>
                  {href && (
                    <Link href={href} className="shrink-0 inline-flex items-center gap-1.5 text-xs font-semibold text-violet-200 hover:text-white">
                      Open <ArrowRightIcon className="h-3.5 w-3.5" />
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        </div>

        {/* Safety contract + memory */}
        <div className="space-y-5">
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] p-6">
            <SectionHeader Icon={ShieldCheckIcon} title="Safety contract" tone="text-emerald-300" />
            <ul className="space-y-2 text-xs text-zinc-400">
              <li>✓ Destructive autonomy <span className="text-emerald-300">disabled</span></li>
              <li>✓ Secret exposure       <span className="text-emerald-300">redacted</span></li>
              <li>✓ Approval policy       <span className="text-emerald-300">gated</span></li>
              <li>✓ Audit emission        <span className="text-emerald-300">always-on</span></li>
            </ul>
          </div>

          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] p-6">
            <SectionHeader Icon={ArrowPathIcon} title="Memory" tone="text-cyan-300" />
            <p className="text-xs text-zinc-400 leading-relaxed">{memory.narrative}</p>
            {memory.weights.preferredFixStyle !== "none" && (
              <p className="text-[10px] font-mono text-zinc-600 mt-3">preferred · {memory.weights.preferredFixStyle} / {memory.weights.preferredReviewSurface}</p>
            )}
          </div>
        </div>
      </section>

      {/* ── Top risk graph nodes ──────────────────────────────────── */}
      <section className="rounded-2xl border border-white/[0.06] bg-white/[0.015] p-6">
        <SectionHeader Icon={ExclamationTriangleIcon} title="Top risk in the execution graph" tone="text-amber-300" />
        <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-3">
          {topRisk.map((n) => (
            <div key={n.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider mb-1">{n.type.replace(/_/g, " ")}</p>
              <p className="text-sm font-semibold text-white leading-snug mb-2">{n.title}</p>
              <div className="flex items-center gap-2 text-[10px] font-mono">
                <span className={`px-1.5 py-0.5 rounded border ${statusTone(n.status)}`}>{n.status}</span>
                <span className={riskTone(n.risk)}>{n.risk}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Coverage gaps + deep validation ──────────────────────── */}
      <section className="grid lg:grid-cols-2 gap-5">
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] p-6">
          <SectionHeader Icon={EyeIcon} title="Coverage gaps" tone="text-cyan-300" />
          <p className="text-xs text-zinc-500 mb-4">Honest map of what Axiom cannot do yet — guides the engineering roadmap.</p>
          <ul className="space-y-2">
            {gaps.gaps.slice(0, 6).map((g) => (
              <li key={g.id} className="flex items-center justify-between gap-3 rounded-lg border border-white/[0.05] bg-white/[0.01] px-3 py-2">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-white truncate">{g.title}</p>
                  <p className="text-[10px] text-zinc-500 mt-0.5 truncate">{g.selfServeExplanation}</p>
                </div>
                <span className={`shrink-0 text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                  g.severity === "critical" ? "text-rose-300 border-rose-500/25 bg-rose-500/10" :
                  g.severity === "high"     ? "text-amber-300 border-amber-500/25 bg-amber-500/10" :
                  g.severity === "medium"   ? "text-cyan-300 border-cyan-500/25 bg-cyan-500/10" :
                                              "text-zinc-300 border-zinc-500/25 bg-zinc-500/10"
                }`}>{g.severity}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] p-6">
          <SectionHeader Icon={CheckCircleIcon} title="Deep validation" tone="text-emerald-300" />
          <p className="text-xs text-zinc-500 mb-4">{deep.narrative}</p>
          <div className="grid grid-cols-3 gap-3 text-[10px] font-mono mb-4">
            <Stat label="passing"  value={`${deep.summary.passing}`}  tone="text-emerald-300" />
            <Stat label="partial"  value={`${deep.summary.partial}`}  tone="text-amber-300" />
            <Stat label="failing"  value={`${deep.summary.failing}`}  tone="text-rose-300" />
          </div>
          <ul className="space-y-1.5">
            {deep.results.filter((r) => r.status === "failing" || r.status === "partial").slice(0, 5).map((r) => (
              <li key={r.id} className="text-[11px] text-zinc-400 leading-relaxed">
                {r.status === "failing" ? <XCircleIcon className="h-3 w-3 inline mr-1 text-rose-300" /> : <ExclamationTriangleIcon className="h-3 w-3 inline mr-1 text-amber-300" />}
                {r.title}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── Execution graph stats ─────────────────────────────────── */}
      <section className="rounded-2xl border border-white/[0.06] bg-white/[0.015] p-6">
        <SectionHeader Icon={CpuChipIcon} title="Execution graph" tone="text-fuchsia-300" />
        <GraphStats graph={graph} />
      </section>

      {/* ── Honest limitations ────────────────────────────────────── */}
      <section className="rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-5">
        <p className="text-[10px] font-mono text-amber-300 uppercase tracking-[0.22em] mb-2">// honest limitations</p>
        <ul className="space-y-1 text-xs text-zinc-300">
          {brain.safeLimitations.map((line, i) => (
            <li key={i}>• {line}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="text-right">
      <p className="text-[9px] text-zinc-600 uppercase tracking-[0.18em] mb-0.5">{label}</p>
      <p className={`text-sm font-mono font-semibold ${tone}`}>{value}</p>
    </div>
  );
}

function Card({ title, value, tone, detail }: { title: string; value: string; tone: "violet" | "amber" | "rose" | "cyan"; detail: string }) {
  const ring = tone === "violet" ? "border-violet-500/20" : tone === "amber" ? "border-amber-500/20" : tone === "rose" ? "border-rose-500/20" : "border-cyan-500/20";
  const text = tone === "violet" ? "text-violet-300" : tone === "amber" ? "text-amber-300" : tone === "rose" ? "text-rose-300" : "text-cyan-300";
  return (
    <div className={`rounded-xl border ${ring} bg-white/[0.02] p-5`}>
      <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-[0.18em] mb-2">{title}</p>
      <p className={`text-3xl font-bold ${text}`}>{value}</p>
      <p className="text-[11px] text-zinc-500 mt-2">{detail}</p>
    </div>
  );
}

function SectionHeader({ Icon, title, tone }: { Icon: React.ComponentType<{ className?: string }>; title: string; tone: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <Icon className={`h-4 w-4 ${tone}`} />
      <h2 className="text-base font-semibold text-white tracking-tight">{title}</h2>
    </div>
  );
}

function GraphStats({ graph }: { graph: ExecutionGraph }) {
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
      <Stat label="nodes" value={`${graph.stats.nodeCount}`}     tone="text-violet-300" />
      <Stat label="edges" value={`${graph.stats.edgeCount}`}     tone="text-cyan-300" />
      <Stat label="critical"        value={`${graph.stats.criticalNodes}`}    tone="text-rose-300" />
      <Stat label="approval gated"  value={`${graph.stats.approvalGated}`}    tone="text-amber-300" />
    </div>
  );
}
