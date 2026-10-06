/**
 * /dashboard/simulations
 *
 * Simulation Center. Enterprise-grade preflight surface. Renders the
 * current digital twin posture + every simulated change with risk delta,
 * blast radius, policy verdict, rollback feasibility, and verification
 * readiness. Never claims execution.
 */

import {
  CpuChipIcon,
  ShieldCheckIcon,
  EyeIcon,
  ArrowsRightLeftIcon,
  CheckCircleIcon,
  ClockIcon,
  ArrowTrendingDownIcon,
  ArrowTrendingUpIcon,
} from "@heroicons/react/24/outline";

import { runRemediationPipeline } from "@/lib/remediation/remediationPipeline";
import { buildDigitalTwin } from "@/lib/digitalTwin/digitalTwinBuilder";
import { changeSetFromCandidate } from "@/lib/simulation/changeSetModel";
import { runSimulation, type SimulationResult } from "@/lib/simulation/executionSimulator";
import { CreateSimulationPanel } from "@/components/dashboard/CreateSimulationPanel";

export const dynamic = "force-dynamic";

const STATUS_TONE: Record<SimulationResult["status"], string> = {
  simulated:      "text-emerald-300 bg-emerald-500/10 border-emerald-500/25",
  preview_only:   "text-violet-300 bg-violet-500/10 border-white/[0.10]",
  blocked:        "text-rose-300 bg-rose-500/10 border-rose-500/25",
  unsafe:         "text-zinc-300 bg-white/10 border-white/25",
  incomplete:     "text-zinc-300 bg-zinc-500/10 border-zinc-500/25",
};

const DELTA_TONE = {
  improved:  "text-emerald-300",
  unchanged: "text-zinc-400",
  worsened:  "text-rose-300",
  mixed:     "text-zinc-300",
  unknown:   "text-zinc-500",
};

const IMPACT_TONE = {
  critical: "text-rose-300 bg-rose-500/10 border-rose-500/25",
  high:     "text-zinc-300 bg-white/10 border-white/25",
  medium:   "text-cyan-300 bg-cyan-500/10 border-cyan-500/25",
  low:      "text-zinc-300 bg-zinc-500/10 border-zinc-500/25",
  none:     "text-zinc-400 bg-zinc-500/10 border-zinc-500/25",
  unknown:  "text-zinc-500 bg-zinc-500/10 border-zinc-500/25",
};

export default async function SimulationsCenter() {
  const [pipeline, twin] = await Promise.all([runRemediationPipeline(), buildDigitalTwin()]);

  const results: SimulationResult[] = pipeline.bundles.map((bundle) => {
    const target = twin.resources.find((r) => bundle.candidate.resourceIds.includes(r.id));
    const cs = changeSetFromCandidate(bundle.candidate, target);
    return runSimulation({ twin, changeSet: cs, operatorRoles: [] });
  });

  const totals = {
    total:        results.length,
    simulated:    results.filter((r) => r.status === "simulated").length,
    preview_only: results.filter((r) => r.status === "preview_only").length,
    blocked:      results.filter((r) => r.status === "blocked").length,
    unsafe:       results.filter((r) => r.status === "unsafe").length,
  };

  return (
    <div className="space-y-10">
      {/* Header */}
      <header>
        <div className="flex items-center gap-3 mb-3">
          <ArrowsRightLeftIcon className="h-4 w-4 text-cyan-300" />
          <span className="text-[10px] font-mono font-semibold text-cyan-300 uppercase tracking-[0.22em]">Simulation Center</span>
        </div>
        <h1 className="text-3xl md:text-4xl font-bold tracking-[-0.04em] mb-2">
          Preflight your <span className="bg-gradient-to-r from-cyan-300 via-violet-300 to-fuchsia-300 bg-clip-text text-transparent">infrastructure</span> changes.
        </h1>
        <p className="text-sm text-zinc-400 max-w-3xl leading-relaxed">
          Every candidate is simulated against the digital twin before approval. We compute before/after diff, blast radius, risk delta, rollback feasibility, and verification readiness. Nothing on this page mutates cloud state.
        </p>
      </header>

      {/* Create simulation — clickable POST /api/simulations/create */}
      <CreateSimulationPanel />

      {/* Twin posture */}
      <section className="rounded-2xl border border-white/[0.07] bg-gradient-to-br from-[#0d0d12] via-[#0a0a0f] to-[#08080c] p-6">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <CpuChipIcon className="h-4 w-4 text-violet-300" />
            <h2 className="text-base font-semibold text-white tracking-tight">Digital Twin · {twin.provider}</h2>
            <span className="text-[10px] font-mono text-zinc-500">source · {twin.sourceMode}</span>
          </div>
          <span className="text-[10px] font-mono text-zinc-500 tracking-wider">confidence · {(twin.confidence * 100).toFixed(0)}%</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi label="Resources"           value={`${twin.resources.length}`}                tone="text-cyan-300" />
          <Kpi label="Security score"      value={`${twin.securityPosture.score}/100`}       tone="text-emerald-300" detail={`${twin.securityPosture.failing} failing`} />
          <Kpi label="Release grade"       value={twin.releasePosture.grade ?? "—"}          tone="text-violet-300" detail={`${twin.releasePosture.blockerCount} blocker(s)`} />
          <Kpi label="Cost coverage"       value={`${Math.round(twin.costPosture.coverageRatio * 100)}%`} tone="text-zinc-300" />
        </div>
        {twin.knownLimitations.length > 0 && (
          <details className="mt-4 text-xs text-zinc-400">
            <summary className="cursor-pointer text-[10px] font-mono text-zinc-300 uppercase tracking-[0.18em]">// known limitations ({twin.knownLimitations.length})</summary>
            <ul className="mt-2 space-y-1 text-[11px] text-zinc-500">
              {twin.knownLimitations.map((l, i) => <li key={i}>• {l}</li>)}
            </ul>
          </details>
        )}
      </section>

      {/* Totals */}
      <section className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <Kpi label="Simulations"  value={`${totals.total}`}        tone="text-cyan-300"     detail="One per candidate." />
        <Kpi label="Simulated"    value={`${totals.simulated}`}    tone="text-emerald-300"  detail="Safe to review." />
        <Kpi label="Preview only" value={`${totals.preview_only}`} tone="text-violet-300"   detail="Provider not connected live." />
        <Kpi label="Blocked"      value={`${totals.blocked}`}      tone="text-rose-300"     detail="Policy / source blocked." />
        <Kpi label="Unsafe"       value={`${totals.unsafe}`}       tone="text-zinc-300"    detail="Destructive without approval." />
      </section>

      {/* Simulation list */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-white tracking-tight">Recent simulations</h2>
        {results.length === 0 && (
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.015] p-6 text-sm text-zinc-500">
            No simulations yet — connect a provider, then run the security scanner.
          </div>
        )}
        {results.slice(0, 8).map((res) => (
          <SimulationRow key={res.id} result={res} />
        ))}
      </section>

      {/* Honest footer */}
      <section className="rounded-xl border border-white/20 bg-white/[0.04] p-5">
        <p className="text-[10px] font-mono text-zinc-300 uppercase tracking-[0.22em] mb-2">Known limitations</p>
        <ul className="space-y-1 text-xs text-zinc-300">
          <li>• Nothing on this page applies a change. Apply is gated by approvals + signed audit + governance.</li>
          <li>• Preview-mode twins yield <span className="font-mono">preview_only</span> simulations regardless of how favourable the diff looks.</li>
          <li>• Reliability + cost deltas are placeholders until backup / replica / cost telemetry is wired.</li>
          <li>• Simulations are not yet persisted; this page re-derives them from the current pipeline run.</li>
        </ul>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SimulationRow({ result }: { result: SimulationResult }) {
  const overall = result.impact.overallImpact;
  const totalAffected = result.impact.directlyAffected.length + result.impact.indirectlyAffected.length;
  const securityDelta = result.delta.security;

  return (
    <details className="group rounded-2xl border border-white/[0.07] bg-white/[0.015] overflow-hidden">
      <summary className="cursor-pointer list-none px-6 py-5 flex items-center justify-between gap-4 hover:bg-white/[0.02]">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${STATUS_TONE[result.status]}`}>{result.status}</span>
            <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${IMPACT_TONE[overall]}`}>impact · {overall}</span>
            <span className="inline-flex items-center gap-1 text-[10px] font-mono">
              {securityDelta === "improved" ? <ArrowTrendingDownIcon className="h-3 w-3 text-emerald-300" /> :
               securityDelta === "worsened" ? <ArrowTrendingUpIcon className="h-3 w-3 text-rose-300"     /> :
                                              <ClockIcon            className="h-3 w-3 text-zinc-500"    />}
              <span className={DELTA_TONE[securityDelta]}>security · {securityDelta}</span>
            </span>
            <span className="text-[10px] font-mono text-zinc-600">{totalAffected} affected</span>
          </div>
          <p className="text-sm font-semibold text-white truncate">{result.summary}</p>
        </div>
        <div className="shrink-0 text-[10px] font-mono text-zinc-500">
          rollback · {result.rollbackFeasibility}
        </div>
      </summary>

      <div className="px-6 pb-6 grid lg:grid-cols-2 gap-5 border-t border-white/[0.05]">
        {/* Diff */}
        <div className="rounded-xl border border-white/[0.06] bg-black/20 p-4">
          <div className="flex items-center gap-2 mb-3">
            <ArrowsRightLeftIcon className="h-3.5 w-3.5 text-cyan-300" />
            <h3 className="text-xs font-semibold text-white tracking-tight">Before / after diff</h3>
          </div>
          {result.diff.length === 0 && <p className="text-xs text-zinc-500">No diff fields — review_only action.</p>}
          {result.diff.flatMap((d) => d.fields.slice(0, 4).map((f) => (
            <div key={`${d.actionId}.${f.field}`} className="text-[11px] font-mono text-zinc-400 grid grid-cols-3 gap-3 py-1.5 border-b border-white/[0.04] last:border-0">
              <span className="truncate">{f.field}</span>
              <span className={`truncate ${f.op === "redacted" ? "text-zinc-300" : "text-rose-300"}`}>{String(f.before)}</span>
              <span className={`truncate ${f.op === "redacted" ? "text-zinc-300" : "text-emerald-300"}`}>{String(f.after)}</span>
            </div>
          )))}
        </div>

        {/* Impact */}
        <div className="rounded-xl border border-white/[0.06] bg-black/20 p-4">
          <div className="flex items-center gap-2 mb-3">
            <EyeIcon className="h-3.5 w-3.5 text-violet-300" />
            <h3 className="text-xs font-semibold text-white tracking-tight">Blast radius</h3>
          </div>
          <div className="grid grid-cols-3 gap-2 mb-3 text-[10px] font-mono">
            <Stat label="direct"   value={`${result.impact.directlyAffected.length}`}   tone="text-cyan-300" />
            <Stat label="indirect" value={`${result.impact.indirectlyAffected.length}`} tone="text-violet-300" />
            <Stat label="overall"  value={overall}                                       tone="text-zinc-300" />
          </div>
          {result.impact.notes.length > 0 && (
            <ul className="text-[11px] text-zinc-500 space-y-1">
              {result.impact.notes.map((n, i) => <li key={i}>{n}</li>)}
            </ul>
          )}
        </div>

        {/* Approvals + blockers */}
        <div className="rounded-xl border border-white/[0.06] bg-black/20 p-4">
          <div className="flex items-center gap-2 mb-3">
            <ShieldCheckIcon className="h-3.5 w-3.5 text-zinc-300" />
            <h3 className="text-xs font-semibold text-white tracking-tight">Approvals + blockers</h3>
          </div>
          {result.approvalsRequired.length === 0 && result.blockers.length === 0 && (
            <p className="text-xs text-emerald-300">No outstanding approvals or blockers.</p>
          )}
          {result.approvalsRequired.length > 0 && (
            <div className="mb-3">
              <p className="text-[10px] font-mono text-zinc-300 uppercase tracking-[0.18em] mb-1">approval required</p>
              <ul className="text-[11px] text-zinc-400 space-y-1">
                {result.approvalsRequired.map((a, i) => <li key={i}>• {a.reason}</li>)}
              </ul>
            </div>
          )}
          {result.blockers.length > 0 && (
            <div>
              <p className="text-[10px] font-mono text-rose-300 uppercase tracking-[0.18em] mb-1">blockers</p>
              <ul className="text-[11px] text-zinc-400 space-y-1">
                {result.blockers.map((b, i) => <li key={i}>• {b.reason}</li>)}
              </ul>
            </div>
          )}
        </div>

        {/* Verification */}
        <div className="rounded-xl border border-white/[0.06] bg-black/20 p-4">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircleIcon className="h-3.5 w-3.5 text-emerald-300" />
            <h3 className="text-xs font-semibold text-white tracking-tight">Verification + rollback</h3>
          </div>
          <p className="text-[11px] text-zinc-400 mb-2">rollback · {result.rollbackFeasibility}</p>
          {result.verificationPlan.length === 0 ? (
            <p className="text-[11px] text-zinc-500">No verification plan generated for this candidate.</p>
          ) : (
            <ul className="text-[11px] text-zinc-400 space-y-1">
              {result.verificationPlan.map((v) => <li key={v.id}>• {v.title}</li>)}
            </ul>
          )}
          <p className="text-[10px] font-mono text-zinc-600 mt-3">confidence · {(result.confidence * 100).toFixed(0)}%</p>
        </div>
      </div>
    </details>
  );
}

function Kpi({ label, value, tone, detail }: { label: string; value: string; tone: string; detail?: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
      <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-[0.18em] mb-2">{label}</p>
      <p className={`text-2xl font-bold ${tone}`}>{value}</p>
      {detail && <p className="text-[11px] text-zinc-500 mt-1">{detail}</p>}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="text-right">
      <p className="text-[9px] text-zinc-600 uppercase tracking-[0.18em] mb-0.5">{label}</p>
      <p className={`text-xs font-mono font-semibold ${tone}`}>{value}</p>
    </div>
  );
}

