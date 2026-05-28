import { useEffect, useState } from "react";
import { ViewShell } from "../components/Primitives";

type SignalKind = "rejection_cluster" | "override_cluster" | "low_confidence_acceptance" | "high_rejection_rate";

interface Signal {
  kind: SignalKind;
  engine: "release_advisor" | "policy_proposal" | "incident_triage";
  targetKind: string;
  keyword: string | null;
  occurrences: number;
  strength: number;
  title: string;
  rationale: string;
  suggestedAction: string;
}

interface Data {
  generatedAt: string;
  engineVersion: string;
  totalDecisionsAnalyzed: number;
  signals: Signal[];
  summary: { totalRows: number; signalsByKind: Record<string, number> };
}

type Body = { ok: true; data: Data } | { ok: false; error: string; hint?: string };

const KIND_LABEL: Record<SignalKind, string> = {
  rejection_cluster: "Rejection cluster",
  override_cluster: "Override cluster",
  low_confidence_acceptance: "Low confidence accept",
  high_rejection_rate: "High rejection rate",
};

const ENGINE_LABEL: Record<Signal["engine"], string> = {
  release_advisor: "Release Advisor",
  policy_proposal: "Policy Proposal",
  incident_triage: "Incident Triage",
};

function strengthClass(s: number): string {
  if (s >= 80) return "bg-rose-500/15 text-rose-300 border-rose-500/25";
  if (s >= 60) return "bg-amber-500/15 text-amber-300 border-amber-500/25";
  if (s >= 40) return "bg-violet-500/15 text-violet-300 border-violet-500/25";
  return "bg-zinc-700/40 text-zinc-300 border-zinc-700/40";
}

export function LearningLoopView() {
  const [resp, setResp] = useState<Body | null>(null);
  const [loading, setLoading] = useState(true);
  const [networkError, setNetworkError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    setNetworkError(null);
    fetch("/api/dashboard/learning-loop", { credentials: "include" })
      .then((r) => r.json())
      .then((j: Body) => setResp(j))
      .catch((e) => setNetworkError(e instanceof Error ? e.message : "Network error."))
      .finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, []);

  const data = resp?.ok ? resp.data : null;
  const errorBody = resp && !resp.ok ? resp : null;

  return (
    <ViewShell>
      <div>
        <h1 className="text-xl font-bold tracking-tight">Learning loop</h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          Engine-improvement queue. Operator decisions cluster into actionable feedback.
        </p>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="px-3 py-1.5 rounded-md border border-violet-500/40 bg-violet-500/[0.14] text-[12px] font-semibold text-violet-100 hover:bg-violet-500/[0.22] disabled:opacity-50 disabled:cursor-wait transition-colors"
        >
          {loading ? "Refreshing…" : "🔄 Refresh"}
        </button>
      </div>

      {data && (
        <div className="grid grid-cols-5 gap-2">
          <Stat label="Signals" value={String(data.signals.length)} tone={data.signals.length > 0 ? "amber" : "emerald"} />
          <Stat label="Decisions" value={String(data.totalDecisionsAnalyzed)} />
          <Stat label="Reject clusters" value={String(data.summary.signalsByKind.rejection_cluster ?? 0)} tone={(data.summary.signalsByKind.rejection_cluster ?? 0) > 0 ? "rose" : "zinc"} />
          <Stat label="Override clusters" value={String(data.summary.signalsByKind.override_cluster ?? 0)} tone={(data.summary.signalsByKind.override_cluster ?? 0) > 0 ? "amber" : "zinc"} />
          <Stat label="High reject %" value={String(data.summary.signalsByKind.high_rejection_rate ?? 0)} tone={(data.summary.signalsByKind.high_rejection_rate ?? 0) > 0 ? "rose" : "zinc"} />
        </div>
      )}

      {loading && <div className="glass-card p-4 text-sm text-zinc-400">Loading signals…</div>}
      {!loading && networkError && (
        <div className="glass-card p-4 text-sm text-rose-300 border border-rose-500/20">{networkError}</div>
      )}
      {!loading && errorBody?.error === "auth_required" && (
        <div className="glass-card p-4 text-sm text-amber-300 border border-amber-500/20">Sign in required.</div>
      )}

      {data && data.signals.length === 0 && (
        <div className="glass-card p-8 text-center border border-emerald-500/20">
          <p className="text-sm font-semibold text-emerald-100 mb-1">All clear — no engine-improvement signals.</p>
          <p className="text-xs text-zinc-400">
            {data.totalDecisionsAnalyzed === 0
              ? "No operator decisions yet. Build up some accepts/rejects first."
              : `Analyzed ${data.totalDecisionsAnalyzed} decision(s) — engines are calibrated.`}
          </p>
        </div>
      )}

      {data && data.signals.length > 0 && (
        <div className="space-y-2">
          {data.signals.map((s, i) => (
            <div key={i} className="glass-card p-3 border border-violet-500/20">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded border ${strengthClass(s.strength)}`}>
                  strength {s.strength}
                </span>
                <span className="text-[9.5px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border border-zinc-700/40 bg-zinc-800/40 text-zinc-300">
                  {KIND_LABEL[s.kind]}
                </span>
                <span className="text-[9.5px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border border-zinc-700/40 bg-zinc-800/40 text-zinc-300">
                  {ENGINE_LABEL[s.engine]}
                </span>
                <span className="text-[10px] font-mono text-zinc-500">target {s.targetKind}</span>
                {s.keyword && <span className="text-[10px] font-mono text-violet-300">"{s.keyword}"</span>}
                <span className="text-[10px] font-mono text-zinc-500 ml-auto">×{s.occurrences}</span>
              </div>
              <p className="text-sm font-semibold text-white">{s.title}</p>
              <p className="text-[12px] text-zinc-300 mt-1">{s.rationale}</p>
              <div className="mt-2 rounded border border-emerald-500/20 bg-emerald-500/[0.025] p-2 text-[11.5px] text-zinc-200">
                <span className="text-[9px] font-mono uppercase tracking-wider text-emerald-300 mr-2">action</span>
                {s.suggestedAction}
              </div>
            </div>
          ))}
        </div>
      )}

      {data && (
        <p className="text-[10px] font-mono text-zinc-600 text-right">engine: {data.engineVersion}</p>
      )}
    </ViewShell>
  );
}

function Stat({ label, value, tone = "zinc" }: { label: string; value: string; tone?: "emerald" | "amber" | "rose" | "zinc" }) {
  const cls = {
    emerald: "border-emerald-500/20 text-emerald-200",
    amber:   "border-amber-500/20 text-amber-200",
    rose:    "border-rose-500/20 text-rose-200",
    zinc:    "border-zinc-700/40 text-zinc-200",
  }[tone];
  return (
    <div className={`glass-card p-3 border ${cls}`}>
      <p className="text-[9px] font-mono uppercase tracking-wider opacity-70">{label}</p>
      <p className="text-lg font-bold mt-0.5">{value}</p>
    </div>
  );
}
