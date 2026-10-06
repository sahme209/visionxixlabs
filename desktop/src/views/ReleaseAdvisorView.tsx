import { useEffect, useState } from "react";
import { ViewShell } from "../components/Primitives";

type RecommendationKind =
  | "block_deploy" | "rollback" | "needs_evidence" | "propose_freeze"
  | "proceed_with_caution" | "propose_manual_fix_log"
  | "propose_branch_protection_strengthen" | "proceed" | "unknown";

type OperatorDecision = "pending" | "accepted" | "rejected" | "implemented" | "dismissed" | "unknown";

interface RecommendationView {
  id: string;
  releaseId: string;
  kind: RecommendationKind;
  confidence: number;
  title: string;
  rationale: string;
  suggestedActions: { label: string; href: string }[];
  severity: "low" | "medium" | "high" | "critical" | "unknown";
  operatorDecision: OperatorDecision;
  decisionNote: string | null;
  engineVersion: string;
  generatedAtIso: string;
}

interface ListData {
  generatedAt: string;
  recommendations: RecommendationView[];
  summary: { total: number; pending: number; accepted: number; rejected: number; implemented: number; dismissed: number };
}

type ListBody = { ok: true; data: ListData } | { ok: false; error: string; hint?: string };

const KIND_LABEL: Record<RecommendationKind, string> = {
  block_deploy: "Block deploy",
  rollback: "Consider rollback",
  needs_evidence: "Evidence required",
  propose_freeze: "Propose freeze",
  proceed_with_caution: "Caution",
  propose_manual_fix_log: "Log manual fix",
  propose_branch_protection_strengthen: "Strengthen protection",
  proceed: "Proceed",
  unknown: "Unknown",
};

const SEVERITY_CLASS: Record<RecommendationView["severity"], string> = {
  critical: "bg-rose-500/25 text-rose-200 border-rose-500/40",
  high:     "bg-rose-500/15 text-rose-300 border-rose-500/25",
  medium:   "bg-white/15 text-zinc-300 border-white/25",
  low:      "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
  unknown:  "bg-zinc-700/40 text-zinc-400 border-zinc-700/40",
};

const DECISION_CLASS: Record<OperatorDecision, string> = {
  pending:     "bg-violet-500/15 text-violet-300 border-violet-500/25",
  accepted:    "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
  rejected:    "bg-rose-500/15 text-rose-300 border-rose-500/25",
  implemented: "bg-cyan-500/15 text-cyan-300 border-cyan-500/25",
  dismissed:   "bg-zinc-700/40 text-zinc-300 border-zinc-700/40",
  unknown:     "bg-zinc-700/40 text-zinc-400 border-zinc-700/40",
};

export function ReleaseAdvisorView() {
  const [resp, setResp] = useState<ListBody | null>(null);
  const [loading, setLoading] = useState(true);
  const [networkError, setNetworkError] = useState<string | null>(null);

  function loadList() {
    setLoading(true);
    setNetworkError(null);
    fetch("/api/dashboard/advisor-list", { credentials: "include" })
      .then((r) => r.json())
      .then((j: ListBody) => setResp(j))
      .catch((e) => setNetworkError(e instanceof Error ? e.message : "Network error."))
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadList(); }, []);

  const data = resp?.ok ? resp.data : null;
  const errorBody = resp && !resp.ok ? resp : null;

  return (
    <ViewShell>
      <div>
        <h1 className="text-xl font-bold tracking-tight">Release advisor</h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          Autonomous recommendations with confidence + rationale. Operator always in the loop.
        </p>
      </div>

      <GeneratePanel onGenerated={loadList} />

      {data && (
        <div className="grid grid-cols-5 gap-2">
          <Stat label="Total" value={String(data.summary.total)} />
          <Stat label="Pending" value={String(data.summary.pending)} tone={data.summary.pending > 0 ? "amber" : "zinc"} />
          <Stat label="Accepted" value={String(data.summary.accepted)} tone="emerald" />
          <Stat label="Implemented" value={String(data.summary.implemented)} tone="emerald" />
          <Stat label="Rejected" value={String(data.summary.rejected)} tone={data.summary.rejected > 0 ? "rose" : "zinc"} />
        </div>
      )}

      {loading && <div className="glass-card p-4 text-sm text-zinc-400">Loading recommendations…</div>}
      {!loading && networkError && (
        <div className="glass-card p-4 text-sm text-rose-300 border border-rose-500/20">{networkError}</div>
      )}
      {!loading && errorBody?.error === "migration_pending" && (
        <div className="glass-card p-4 border border-white/30">
          <p className="text-sm font-semibold text-zinc-300 mb-1">Schema migration pending</p>
          <p className="text-xs text-zinc-400">{errorBody.hint}</p>
        </div>
      )}
      {!loading && errorBody?.error === "auth_required" && (
        <div className="glass-card p-4 text-sm text-zinc-300 border border-white/20">Sign in required.</div>
      )}

      {data && (
        data.recommendations.length === 0 ? (
          <div className="glass-card p-8 text-center text-sm text-zinc-400">
            No advisor runs yet. Generate recommendations for a release above.
          </div>
        ) : (
          <div className="space-y-2">
            {data.recommendations.map((r) => <RecCard key={r.id} rec={r} onChanged={loadList} />)}
          </div>
        )
      )}
    </ViewShell>
  );
}

function RecCard({ rec, onChanged }: { rec: RecommendationView; onChanged: () => void }) {
  const [busy, setBusy] = useState<"accept" | "reject" | "implement" | "dismiss" | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState("");

  async function decide(action: "accept" | "reject" | "implement" | "dismiss") {
    setBusy(action);
    setErr(null);
    try {
      const res = await fetch("/api/dashboard/advisor-decide", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recommendationId: rec.id, action,
          ...(note ? { note } : {}),
        }),
      });
      const j = await res.json();
      if (!j.ok) { setErr(j.hint ?? j.error); setBusy(null); }
      else onChanged();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "network error");
      setBusy(null);
    }
  }

  return (
    <div className="glass-card p-3 border border-violet-500/20">
      <div className="flex items-center gap-2 mb-1 flex-wrap">
        <span className={`text-[9.5px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border ${SEVERITY_CLASS[rec.severity]}`}>
          {rec.severity}
        </span>
        <span className="text-[9.5px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border border-zinc-700/40 bg-zinc-800/40 text-zinc-300">
          {KIND_LABEL[rec.kind]}
        </span>
        <span className={`text-[9.5px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border ${DECISION_CLASS[rec.operatorDecision]}`}>
          {rec.operatorDecision}
        </span>
        <span className="text-[10px] font-mono text-zinc-500">confidence {rec.confidence}%</span>
        <span className="text-[10px] font-mono text-zinc-500 ml-auto">
          {new Date(rec.generatedAtIso).toLocaleString()}
        </span>
      </div>
      <p className="text-sm font-semibold text-white">{rec.title}</p>
      <p className="text-[12px] text-zinc-300 mt-1">{rec.rationale}</p>
      <p className="text-[10px] font-mono text-zinc-500 mt-1">release {rec.releaseId} · engine {rec.engineVersion}</p>
      {rec.decisionNote && (
        <p className="text-[11px] font-mono text-zinc-400 mt-1 italic">↳ note: {rec.decisionNote}</p>
      )}
      {rec.operatorDecision === "pending" && (
        <div className="mt-2 pt-2 border-t border-white/[0.04] flex items-center gap-2 flex-wrap text-[11px] font-mono">
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="optional decision note"
            disabled={busy !== null}
            className="flex-1 min-w-[160px] rounded border border-zinc-700/40 bg-zinc-900/60 px-2 py-1 text-[11px] text-zinc-100 placeholder:text-zinc-600 focus:border-violet-500/40 focus:outline-none disabled:opacity-50"
          />
          <button type="button" onClick={() => decide("accept")} disabled={busy !== null}
            className="px-2 py-1 rounded border border-emerald-500/30 bg-emerald-500/[0.10] text-emerald-200 hover:bg-emerald-500/[0.18] disabled:opacity-50 disabled:cursor-wait">
            {busy === "accept" ? "…" : "Accept"}
          </button>
          <button type="button" onClick={() => decide("implement")} disabled={busy !== null}
            className="px-2 py-1 rounded border border-cyan-500/30 bg-cyan-500/[0.10] text-cyan-200 hover:bg-cyan-500/[0.18] disabled:opacity-50 disabled:cursor-wait">
            {busy === "implement" ? "…" : "Implemented"}
          </button>
          <button type="button" onClick={() => decide("reject")} disabled={busy !== null}
            className="px-2 py-1 rounded border border-rose-500/30 bg-rose-500/[0.10] text-rose-200 hover:bg-rose-500/[0.18] disabled:opacity-50 disabled:cursor-wait">
            {busy === "reject" ? "…" : "Reject"}
          </button>
          <button type="button" onClick={() => decide("dismiss")} disabled={busy !== null}
            className="px-2 py-1 rounded border border-zinc-600/40 bg-zinc-800/40 text-zinc-300 hover:bg-zinc-800/60 disabled:opacity-50 disabled:cursor-wait">
            {busy === "dismiss" ? "…" : "Dismiss"}
          </button>
          {err && <span className="text-rose-300">✗ {err}</span>}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone = "zinc" }: { label: string; value: string; tone?: "emerald" | "amber" | "rose" | "zinc" }) {
  const cls = {
    emerald: "border-emerald-500/20 text-emerald-200",
    amber:   "border-white/20 text-zinc-200",
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

type GenState =
  | { kind: "closed" }
  | { kind: "open" }
  | { kind: "submitting" }
  | { kind: "ok"; count: number; primary: string | null }
  | { kind: "error"; message: string };

function GeneratePanel({ onGenerated }: { onGenerated: () => void }) {
  const [state, setState] = useState<GenState>({ kind: "closed" });
  const [releaseId, setReleaseId] = useState("");

  async function submit() {
    setState({ kind: "submitting" });
    try {
      const res = await fetch("/api/dashboard/advisor-generate", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ releaseId }),
      });
      const j = await res.json();
      if (j.ok) {
        setState({ kind: "ok", count: j.data.recommendationCount, primary: j.data.primary?.title ?? null });
        onGenerated();
        setTimeout(() => { setReleaseId(""); setState({ kind: "closed" }); }, 1800);
      } else {
        setState({ kind: "error", message: j.hint ?? j.error });
      }
    } catch (e) {
      setState({ kind: "error", message: e instanceof Error ? e.message : "network error" });
    }
  }

  if (state.kind === "closed") {
    return (
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setState({ kind: "open" })}
          className="px-3 py-1.5 rounded-lg border border-violet-500/30 bg-violet-500/[0.08] text-[12px] font-semibold text-violet-200 hover:bg-violet-500/[0.16] transition-colors"
        >
          ✨ Generate recommendations
        </button>
      </div>
    );
  }

  const busy = state.kind === "submitting";
  return (
    <div className="glass-card p-4 border border-violet-500/20">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-violet-100">Generate advisor recommendations</p>
        <button type="button" onClick={() => { setReleaseId(""); setState({ kind: "closed" }); }} className="text-[11px] font-mono text-zinc-400 hover:text-zinc-200" disabled={busy}>cancel</button>
      </div>
      <label className="block mb-3">
        <span className="block text-[10px] font-mono uppercase tracking-wider text-zinc-400 mb-1">Release ID</span>
        <input
          type="text"
          value={releaseId}
          onChange={(e) => setReleaseId(e.target.value)}
          placeholder="rel_..."
          disabled={busy}
          className="w-full rounded-md border border-zinc-700/40 bg-zinc-900/60 px-2 py-1.5 text-[12px] text-zinc-100 placeholder:text-zinc-600 focus:border-violet-500/40 focus:outline-none disabled:opacity-50"
        />
      </label>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={submit}
          disabled={busy || !releaseId}
          className="px-3 py-1.5 rounded-md border border-violet-500/40 bg-violet-500/[0.14] text-[12px] font-semibold text-violet-100 hover:bg-violet-500/[0.22] disabled:opacity-50 disabled:cursor-wait transition-colors"
        >
          {busy ? "Generating…" : "Generate"}
        </button>
        {state.kind === "ok" && (
          <span className="text-[11px] font-mono text-emerald-300">
            ✓ {state.count}{state.primary ? ` · ${state.primary}` : ""}
          </span>
        )}
        {state.kind === "error" && (
          <span className="text-[11px] font-mono text-rose-300">✗ {state.message}</span>
        )}
      </div>
    </div>
  );
}
