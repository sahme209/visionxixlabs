"use client";

/**
 * /dashboard/ai-call-log — Phase 531.
 *
 * Engineer-facing observability surface for every AI provider call
 * the platform makes. Per-engine breakdown shows circuit state +
 * latency p50/p95 + token usage + success rate. Recent calls table
 * is sortable by engine + outcome.
 */

import { useEffect, useMemo, useState } from "react";
import {
  CpuChipIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  BoltIcon,
} from "@heroicons/react/24/outline";
import { PageIntro } from "@/components/dashboard/PageIntro";

type CircuitState = "closed" | "open" | "half_open";

interface EngineStats {
  windowSize: number;
  okCount: number;
  errorCount: number;
  timeoutCount: number;
  shortCircuitCount: number;
  latencyP50Ms: number;
  latencyP95Ms: number;
  promptTokensTotal: number;
  completionTokensTotal: number;
  successRate: number;
}

interface EngineBreakdown {
  engineName: string;
  state: CircuitState;
  stats: EngineStats;
}

interface CallView {
  id: string;
  organizationId: string | null;
  engineName: string;
  model: string | null;
  outcome: string;
  errorMessage: string | null;
  latencyMs: number;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  startedAtIso: string;
}

interface LogData {
  generatedAt: string;
  calls: CallView[];
  engines: EngineBreakdown[];
  summary: {
    total: number;
    ok: number;
    error: number;
    timeout: number;
    shortCircuit: number;
    totalLatencyMs: number;
    totalPromptTokens: number;
    totalCompletionTokens: number;
  };
}

type Body = { ok: true; data: LogData } | { ok: false; error: string; hint?: string };

const STATE_CLASS: Record<CircuitState, string> = {
  closed:    "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
  open:      "bg-rose-500/20 text-rose-200 border-rose-500/40",
  half_open: "bg-amber-500/15 text-amber-300 border-amber-500/25",
};

const OUTCOME_CLASS: Record<string, string> = {
  ok:            "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
  error:         "bg-rose-500/15 text-rose-300 border-rose-500/25",
  timeout:       "bg-amber-500/15 text-amber-300 border-amber-500/25",
  short_circuit: "bg-violet-500/15 text-violet-300 border-violet-500/25",
};

const ENGINE_LABEL: Record<string, string> = {
  council_voter:         "Council voter",
  council_rationale:     "Council rationale",
  triage_rationale:      "Triage rationale",
  remediation_rationale: "Remediation rationale",
  memory_summary:        "Memory summary",
  memory_chat:           "Memory chat",
  proactive_suggestion:  "Proactive suggestion",
  ad_hoc:                "Ad-hoc",
};

export default function AiCallLogPage() {
  const [resp, setResp] = useState<Body | null>(null);
  const [loading, setLoading] = useState(true);
  const [networkError, setNetworkError] = useState<string | null>(null);
  const [scope, setScope] = useState<"org" | "global">("org");
  const [engineFilter, setEngineFilter] = useState<string | null>(null);

  function load() {
    setLoading(true);
    setNetworkError(null);
    const params = new URLSearchParams();
    params.set("scope", scope);
    params.set("take", "200");
    if (engineFilter) params.set("engineName", engineFilter);
    fetch(`/api/dashboard/ai-call-log?${params.toString()}`, { credentials: "include" })
      .then((r) => r.json())
      .then((j: Body) => setResp(j))
      .catch((e) => setNetworkError(e instanceof Error ? e.message : "Network error."))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, [scope, engineFilter]);

  const data = resp?.ok ? resp.data : null;
  const errorBody = resp && !resp.ok ? resp : null;

  const overallSuccessRate = useMemo(() => {
    if (!data) return 0;
    const provider = data.summary.ok + data.summary.error + data.summary.timeout;
    return provider === 0 ? 0 : Math.round((data.summary.ok / provider) * 100);
  }, [data]);

  const openCircuits = useMemo(
    () => data?.engines.filter((e) => e.state === "open" || e.state === "half_open") ?? [],
    [data],
  );

  return (
    <div className="relative">
      <PageIntro
        kicker={`Engineer · AI provider observability${data ? ` · ${data.summary.total} calls · ${overallSuccessRate}% success` : ""}`}
        title={<>Every AI call, <span className="text-zinc-500">timed + token-counted + breakered.</span></>}
        description="Every provider call across every engine (council voter, ×3 rationale enrichers, memory summary, memory chat, proactive suggestion) is logged here with engine name, model, latency, token usage, and outcome. The circuit breaker derives state from the recent window: 3+ failures in the last 10 calls trip it open, with a 60s cooldown to half-open. Engineers tune thresholds per-engine without code changes."
        helps="Use scope=org for your tenant's calls; scope=global is the engineer ops view across all orgs. Filter by engine to drill into one specific path."
        connectFirst="Trigger any AGI engine (run a council decision, ask the AGI a question, generate suggestions). Each call writes one row here."
        engineers={["Platform team", "AI Operations", "SRE"]}
        requiresApproval="Read-only · no operator writes from this page"
        actions={[
          { label: "Open AGI cockpit", href: "/dashboard/agi-cockpit" },
          { label: "Open AGI memory", href: "/dashboard/agi-memory" },
        ]}
        safetyNote="Circuit state is derived per-call from the persisted log · fail-open on log read errors · short_circuit rows never count toward latency or error totals"
      />

      <div className="mb-5 flex items-center gap-2 flex-wrap">
        <FilterPill label="My org" active={scope === "org"} onClick={() => setScope("org")} />
        <FilterPill label="Global (engineer)" active={scope === "global"} onClick={() => setScope("global")} />
        <span className="text-[10.5px] font-mono text-zinc-500 ml-2">|</span>
        <FilterPill label="All engines" active={!engineFilter} onClick={() => setEngineFilter(null)} />
        {data?.engines.map((e) => (
          <FilterPill key={e.engineName} label={ENGINE_LABEL[e.engineName] ?? e.engineName} active={engineFilter === e.engineName} onClick={() => setEngineFilter(e.engineName)} />
        ))}
        <button
          type="button"
          onClick={load}
          className="ml-auto inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-white/[0.08] bg-white/[0.02] text-[11px] font-mono text-zinc-300 hover:bg-white/[0.06] transition-colors"
        >
          <ArrowPathIcon className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {data && (
        <div className="mb-5 grid grid-cols-2 md:grid-cols-5 gap-3">
          <Stat icon={CpuChipIcon} label="Total" value={String(data.summary.total)} tone="zinc" />
          <Stat icon={CheckCircleIcon} label="Ok" value={String(data.summary.ok)} tone={data.summary.ok > 0 ? "emerald" : "zinc"} />
          <Stat icon={XCircleIcon} label="Error" value={String(data.summary.error)} tone={data.summary.error > 0 ? "rose" : "zinc"} />
          <Stat icon={ExclamationTriangleIcon} label="Timeout" value={String(data.summary.timeout)} tone={data.summary.timeout > 0 ? "amber" : "zinc"} />
          <Stat icon={BoltIcon} label="Short-circuit" value={String(data.summary.shortCircuit)} tone={data.summary.shortCircuit > 0 ? "violet" : "zinc"} />
        </div>
      )}

      {openCircuits.length > 0 && (
        <div className="mb-5 rounded-2xl border border-rose-500/30 bg-rose-500/[0.05] p-4">
          <div className="flex items-center gap-2 mb-2">
            <BoltIcon className="h-4 w-4 text-rose-300" />
            <p className="text-[13px] font-semibold text-rose-200">
              {openCircuits.length} circuit{openCircuits.length === 1 ? "" : "s"} tripped
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {openCircuits.map((e) => (
              <span key={e.engineName} className={`text-[11px] font-mono uppercase tracking-wider px-2 py-1 rounded border ${STATE_CLASS[e.state]}`}>
                {ENGINE_LABEL[e.engineName] ?? e.engineName} · {e.state}
              </span>
            ))}
          </div>
        </div>
      )}

      {loading && <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 mb-4 text-[12px] text-zinc-400">Loading call log…</div>}
      {!loading && networkError && (
        <div className="rounded-2xl border border-rose-500/[0.18] bg-rose-500/[0.04] p-5 mb-4 text-[13px] text-zinc-300">{networkError}</div>
      )}
      {!loading && errorBody?.error === "migration_pending" && (
        <div className="rounded-2xl border border-amber-500/[0.18] bg-amber-500/[0.04] p-5 mb-4">
          <p className="text-[12px] font-semibold text-amber-200 mb-1">Schema migration pending</p>
          <p className="text-[12.5px] text-zinc-300">{errorBody.hint}</p>
        </div>
      )}

      {data && data.engines.length > 0 && (
        <>
          <h2 className="text-[13px] font-semibold text-white mb-3">Per-engine breakdown</h2>
          <div className="mb-6 space-y-2.5">
            {data.engines.map((e) => <EngineBreakdownCard key={e.engineName} engine={e} />)}
          </div>
        </>
      )}

      {data && data.calls.length === 0 && (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-10 text-center text-[13px] text-zinc-400">
          No AI calls logged yet. Trigger any AGI engine to populate this surface.
        </div>
      )}

      {data && data.calls.length > 0 && (
        <>
          <h2 className="text-[13px] font-semibold text-white mb-3">Recent calls</h2>
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
            <table className="w-full text-[11.5px] font-mono">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="text-left px-3 py-2 text-zinc-500 uppercase tracking-[0.18em] text-[10px]">When</th>
                  <th className="text-left px-3 py-2 text-zinc-500 uppercase tracking-[0.18em] text-[10px]">Engine</th>
                  <th className="text-left px-3 py-2 text-zinc-500 uppercase tracking-[0.18em] text-[10px]">Model</th>
                  <th className="text-left px-3 py-2 text-zinc-500 uppercase tracking-[0.18em] text-[10px]">Outcome</th>
                  <th className="text-right px-3 py-2 text-zinc-500 uppercase tracking-[0.18em] text-[10px]">Latency</th>
                  <th className="text-right px-3 py-2 text-zinc-500 uppercase tracking-[0.18em] text-[10px]">Prompt</th>
                  <th className="text-right px-3 py-2 text-zinc-500 uppercase tracking-[0.18em] text-[10px]">Completion</th>
                  <th className="text-left px-3 py-2 text-zinc-500 uppercase tracking-[0.18em] text-[10px]">Error</th>
                </tr>
              </thead>
              <tbody>
                {data.calls.map((c) => (
                  <tr key={c.id} className="border-b border-white/[0.04] last:border-0">
                    <td className="px-3 py-1.5 text-zinc-300">{new Date(c.startedAtIso).toLocaleString()}</td>
                    <td className="px-3 py-1.5 text-zinc-200">{ENGINE_LABEL[c.engineName] ?? c.engineName}</td>
                    <td className="px-3 py-1.5 text-zinc-400">{c.model ?? "—"}</td>
                    <td className="px-3 py-1.5">
                      <span className={`px-1.5 py-0.5 rounded border text-[10px] uppercase tracking-wider ${OUTCOME_CLASS[c.outcome] ?? OUTCOME_CLASS.error}`}>
                        {c.outcome}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 text-right text-zinc-300">{c.latencyMs}ms</td>
                    <td className="px-3 py-1.5 text-right text-zinc-400">{c.promptTokens ?? "—"}</td>
                    <td className="px-3 py-1.5 text-right text-zinc-400">{c.completionTokens ?? "—"}</td>
                    <td className="px-3 py-1.5 text-rose-300 line-clamp-1">{c.errorMessage ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function EngineBreakdownCard({ engine }: { engine: EngineBreakdown }) {
  const successPct = Math.round(engine.stats.successRate * 100);
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <span className="text-[11.5px] font-semibold text-white">{ENGINE_LABEL[engine.engineName] ?? engine.engineName}</span>
        <span className={`text-[9.5px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border ${STATE_CLASS[engine.state]}`}>
          circuit {engine.state}
        </span>
        <span className="text-[10px] font-mono text-zinc-500 ml-auto">window: {engine.stats.windowSize}</span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-6 gap-2 text-[10.5px] font-mono">
        <Inline label="Success" value={`${successPct}%`} tone={successPct >= 80 ? "emerald" : successPct >= 50 ? "amber" : "rose"} />
        <Inline label="p50" value={`${engine.stats.latencyP50Ms}ms`} />
        <Inline label="p95" value={`${engine.stats.latencyP95Ms}ms`} />
        <Inline label="Ok / Err / TO / SC" value={`${engine.stats.okCount} / ${engine.stats.errorCount} / ${engine.stats.timeoutCount} / ${engine.stats.shortCircuitCount}`} />
        <Inline label="Prompt tokens" value={String(engine.stats.promptTokensTotal)} />
        <Inline label="Completion tokens" value={String(engine.stats.completionTokensTotal)} />
      </div>
    </div>
  );
}

function Inline({ label, value, tone = "zinc" }: { label: string; value: string; tone?: "emerald" | "amber" | "rose" | "zinc" }) {
  const cls = {
    emerald: "text-emerald-300",
    amber:   "text-amber-300",
    rose:    "text-rose-300",
    zinc:    "text-zinc-200",
  }[tone];
  return (
    <div className="rounded border border-white/[0.04] bg-black/20 px-1.5 py-1">
      <p className="text-zinc-500 uppercase tracking-[0.18em] text-[8px]">{label}</p>
      <p className={`${cls} font-bold`}>{value}</p>
    </div>
  );
}

function FilterPill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2.5 py-1 rounded-md border text-[11.5px] font-mono transition-colors ${
        active
          ? "border-violet-500/40 bg-violet-500/[0.14] text-violet-100"
          : "border-white/[0.08] bg-white/[0.02] text-zinc-300 hover:bg-white/[0.06]"
      }`}
    >
      {label}
    </button>
  );
}

function Stat({ icon: Icon, label, value, tone }: { icon: typeof CpuChipIcon; label: string; value: string; tone: "emerald" | "amber" | "rose" | "violet" | "zinc" }) {
  const cls = {
    emerald: "border-emerald-500/[0.18] bg-emerald-500/[0.03] text-emerald-200",
    amber:   "border-amber-500/[0.18] bg-amber-500/[0.03] text-amber-200",
    rose:    "border-rose-500/[0.18] bg-rose-500/[0.03] text-rose-200",
    violet:  "border-violet-500/[0.18] bg-violet-500/[0.03] text-violet-200",
    zinc:    "border-white/[0.06] bg-white/[0.02] text-zinc-200",
  }[tone];
  return (
    <div className={`rounded-xl border ${cls} p-3`}>
      <p className="text-[9px] font-mono uppercase tracking-wider opacity-70">{label}</p>
      <div className="flex items-center gap-2 mt-1">
        <Icon className="h-4 w-4 opacity-80" />
        <p className="text-[20px] font-bold">{value}</p>
      </div>
    </div>
  );
}
