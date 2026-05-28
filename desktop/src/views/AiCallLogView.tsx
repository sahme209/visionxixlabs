import { useEffect, useMemo, useState } from "react";
import { ViewShell } from "../components/Primitives";

/**
 * AI call log — Phase 531 desktop sibling.
 * Engineer-facing observability for every AI provider call.
 */

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

export function AiCallLogView() {
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
    <ViewShell>
      <div>
        <h1 className="text-xl font-bold tracking-tight">AI call log</h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          Every provider call · circuit breaker · p50/p95 latency · token usage{data ? ` · ${data.summary.total} calls · ${overallSuccessRate}% success` : ""}
        </p>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <FilterPill label="My org" active={scope === "org"} onClick={() => setScope("org")} />
        <FilterPill label="Global" active={scope === "global"} onClick={() => setScope("global")} />
        <span className="text-[10px] font-mono text-zinc-500 ml-2">|</span>
        <FilterPill label="All engines" active={!engineFilter} onClick={() => setEngineFilter(null)} />
        {data?.engines.map((e) => (
          <FilterPill key={e.engineName} label={ENGINE_LABEL[e.engineName] ?? e.engineName} active={engineFilter === e.engineName} onClick={() => setEngineFilter(e.engineName)} />
        ))}
        <button
          type="button"
          onClick={load}
          className="ml-auto px-2.5 py-1 rounded-md border border-zinc-700/40 bg-zinc-900/40 text-[11px] font-mono text-zinc-300 hover:bg-zinc-800/60"
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {data && (
        <div className="grid grid-cols-5 gap-2">
          <Stat label="Total" value={String(data.summary.total)} />
          <Stat label="Ok" value={String(data.summary.ok)} tone={data.summary.ok > 0 ? "emerald" : "zinc"} />
          <Stat label="Error" value={String(data.summary.error)} tone={data.summary.error > 0 ? "rose" : "zinc"} />
          <Stat label="Timeout" value={String(data.summary.timeout)} tone={data.summary.timeout > 0 ? "amber" : "zinc"} />
          <Stat label="Short-circuit" value={String(data.summary.shortCircuit)} tone={data.summary.shortCircuit > 0 ? "violet" : "zinc"} />
        </div>
      )}

      {openCircuits.length > 0 && (
        <div className="glass-card p-3 border border-rose-500/30">
          <p className="text-[12px] font-semibold text-rose-200 mb-1.5">
            ⚡ {openCircuits.length} circuit{openCircuits.length === 1 ? "" : "s"} tripped
          </p>
          <div className="flex flex-wrap gap-1.5">
            {openCircuits.map((e) => (
              <span key={e.engineName} className={`text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border ${STATE_CLASS[e.state]}`}>
                {ENGINE_LABEL[e.engineName] ?? e.engineName} · {e.state}
              </span>
            ))}
          </div>
        </div>
      )}

      {loading && <div className="glass-card p-4 text-sm text-zinc-400">Loading call log…</div>}
      {!loading && networkError && (
        <div className="glass-card p-4 text-sm text-rose-300 border border-rose-500/20">{networkError}</div>
      )}
      {!loading && errorBody?.error === "migration_pending" && (
        <div className="glass-card p-4 border border-amber-500/30">
          <p className="text-sm font-semibold text-amber-300 mb-1">Schema migration pending</p>
          <p className="text-xs text-zinc-400">{errorBody.hint}</p>
        </div>
      )}

      {data && data.engines.length > 0 && (
        <div className="space-y-2">
          <p className="text-[12px] font-semibold text-zinc-200">Per-engine breakdown</p>
          {data.engines.map((e) => <EngineBreakdownCard key={e.engineName} engine={e} />)}
        </div>
      )}

      {data && data.calls.length === 0 && (
        <div className="glass-card p-8 text-center text-sm text-zinc-400">
          No AI calls logged yet. Trigger any AGI engine to populate this surface.
        </div>
      )}

      {data && data.calls.length > 0 && (
        <div className="space-y-2">
          <p className="text-[12px] font-semibold text-zinc-200">Recent calls</p>
          <div className="glass-card overflow-hidden">
            <table className="w-full text-[11.5px] font-mono">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="text-left px-3 py-2 text-zinc-500 uppercase tracking-[0.18em] text-[10px]">When</th>
                  <th className="text-left px-3 py-2 text-zinc-500 uppercase tracking-[0.18em] text-[10px]">Engine</th>
                  <th className="text-left px-3 py-2 text-zinc-500 uppercase tracking-[0.18em] text-[10px]">Model</th>
                  <th className="text-left px-3 py-2 text-zinc-500 uppercase tracking-[0.18em] text-[10px]">Outcome</th>
                  <th className="text-right px-3 py-2 text-zinc-500 uppercase tracking-[0.18em] text-[10px]">Lat</th>
                  <th className="text-right px-3 py-2 text-zinc-500 uppercase tracking-[0.18em] text-[10px]">P</th>
                  <th className="text-right px-3 py-2 text-zinc-500 uppercase tracking-[0.18em] text-[10px]">C</th>
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </ViewShell>
  );
}

function EngineBreakdownCard({ engine }: { engine: EngineBreakdown }) {
  const successPct = Math.round(engine.stats.successRate * 100);
  return (
    <div className="glass-card p-3">
      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
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
        <Inline label="Ok/Err/TO/SC" value={`${engine.stats.okCount}/${engine.stats.errorCount}/${engine.stats.timeoutCount}/${engine.stats.shortCircuitCount}`} />
        <Inline label="Prompt tok" value={String(engine.stats.promptTokensTotal)} />
        <Inline label="Compl tok" value={String(engine.stats.completionTokensTotal)} />
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
    <div className="rounded border border-zinc-700/40 bg-zinc-900/40 px-1.5 py-1">
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
      className={`px-2.5 py-1 rounded-md border text-[11px] font-mono transition-colors ${
        active
          ? "border-violet-500/40 bg-violet-500/[0.14] text-violet-100"
          : "border-zinc-700/40 bg-zinc-900/40 text-zinc-300 hover:bg-zinc-800/60"
      }`}
    >
      {label}
    </button>
  );
}

function Stat({ label, value, tone = "zinc" }: { label: string; value: string; tone?: "emerald" | "amber" | "rose" | "violet" | "zinc" }) {
  const cls = {
    emerald: "border-emerald-500/20 text-emerald-200",
    amber:   "border-amber-500/20 text-amber-200",
    rose:    "border-rose-500/20 text-rose-200",
    violet:  "border-violet-500/20 text-violet-200",
    zinc:    "border-zinc-700/40 text-zinc-200",
  }[tone];
  return (
    <div className={`glass-card p-3 border ${cls}`}>
      <p className="text-[9px] font-mono uppercase tracking-wider opacity-70">{label}</p>
      <p className="text-lg font-bold mt-0.5">{value}</p>
    </div>
  );
}
