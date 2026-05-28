import { useEffect, useState } from "react";
import { ViewShell } from "../components/Primitives";

type Decision = "pending" | "accepted" | "overridden" | "dismissed" | "unknown";

interface Vote {
  voterId: string;
  kind: string;
  confidence: number;
  rationale: string;
}

interface CouncilView {
  id: string;
  releaseId: string;
  consensusKind: string;
  agreementScore: number;
  title: string;
  rationale: string;
  votes: Vote[];
  voterCount: number;
  engineVersion: string;
  operatorDecision: Decision;
  decisionNote: string | null;
  overrideKind: string | null;
  generatedAtIso: string;
}

interface ListData {
  generatedAt: string;
  decisions: CouncilView[];
  summary: { total: number; pending: number; accepted: number; overridden: number; dismissed: number; highAgreement: number; noConsensus: number; avgAgreementScore: number };
}

type ListBody = { ok: true; data: ListData } | { ok: false; error: string; hint?: string };

const KIND_LABEL: Record<string, string> = {
  block_deploy: "Block deploy",
  rollback: "Rollback",
  needs_evidence: "Evidence required",
  propose_freeze: "Propose freeze",
  proceed_with_caution: "Caution",
  propose_manual_fix_log: "Log manual fix",
  propose_branch_protection_strengthen: "Strengthen protection",
  proceed: "Proceed",
  no_consensus: "No consensus",
  unknown: "Unknown",
};

const DECISION_CLASS: Record<Decision, string> = {
  pending:    "bg-violet-500/15 text-violet-300 border-violet-500/25",
  accepted:   "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
  overridden: "bg-amber-500/15 text-amber-300 border-amber-500/25",
  dismissed:  "bg-zinc-700/40 text-zinc-300 border-zinc-700/40",
  unknown:    "bg-zinc-700/40 text-zinc-400 border-zinc-700/40",
};

function agreementClass(score: number): string {
  if (score >= 80) return "bg-emerald-500/15 text-emerald-300 border-emerald-500/25";
  if (score >= 60) return "bg-amber-500/15 text-amber-300 border-amber-500/25";
  return "bg-rose-500/15 text-rose-300 border-rose-500/25";
}

export function AdvisorCouncilView() {
  const [resp, setResp] = useState<ListBody | null>(null);
  const [loading, setLoading] = useState(true);
  const [networkError, setNetworkError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    setNetworkError(null);
    fetch("/api/dashboard/council-list", { credentials: "include" })
      .then((r) => r.json())
      .then((j: ListBody) => setResp(j))
      .catch((e) => setNetworkError(e instanceof Error ? e.message : "Network error."))
      .finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, []);

  const data = resp?.ok ? resp.data : null;
  const errorBody = resp && !resp.ok ? resp : null;

  return (
    <ViewShell>
      <div>
        <h1 className="text-xl font-bold tracking-tight">Advisor council</h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          Three voters · majority kind wins · operator overrides recorded for learning loop.
        </p>
      </div>

      <GeneratePanel onGenerated={load} />

      {data && (
        <div className="grid grid-cols-5 gap-2">
          <Stat label="Total" value={String(data.summary.total)} />
          <Stat label="Pending" value={String(data.summary.pending)} tone={data.summary.pending > 0 ? "amber" : "zinc"} />
          <Stat label="High agreement" value={String(data.summary.highAgreement)} tone={data.summary.highAgreement > 0 ? "emerald" : "zinc"} />
          <Stat label="No consensus" value={String(data.summary.noConsensus)} tone={data.summary.noConsensus > 0 ? "rose" : "zinc"} />
          <Stat label="Avg agreement" value={`${data.summary.avgAgreementScore}%`} />
        </div>
      )}

      {loading && <div className="glass-card p-4 text-sm text-zinc-400">Loading council decisions…</div>}
      {!loading && networkError && (
        <div className="glass-card p-4 text-sm text-rose-300 border border-rose-500/20">{networkError}</div>
      )}
      {!loading && errorBody?.error === "migration_pending" && (
        <div className="glass-card p-4 border border-amber-500/30">
          <p className="text-sm font-semibold text-amber-300 mb-1">Schema migration pending</p>
          <p className="text-xs text-zinc-400">{errorBody.hint}</p>
        </div>
      )}
      {!loading && errorBody?.error === "auth_required" && (
        <div className="glass-card p-4 text-sm text-amber-300 border border-amber-500/20">Sign in required.</div>
      )}

      {data && (
        data.decisions.length === 0 ? (
          <div className="glass-card p-8 text-center text-sm text-zinc-400">
            No council decisions yet. Paste a release id above and hit Run council.
          </div>
        ) : (
          <div className="space-y-2">
            {data.decisions.map((d) => <CouncilCard key={d.id} decision={d} onChanged={load} />)}
          </div>
        )
      )}
    </ViewShell>
  );
}

function CouncilCard({ decision, onChanged }: { decision: CouncilView; onChanged: () => void }) {
  const [busy, setBusy] = useState<"accept" | "override" | "dismiss" | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [overrideKind, setOverrideKind] = useState("block_deploy");

  async function decide(action: "accept" | "override" | "dismiss") {
    setBusy(action);
    setErr(null);
    try {
      const res = await fetch("/api/dashboard/council-decide", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decisionId: decision.id, action,
          ...(note ? { note } : {}),
          ...(action === "override" ? { overrideKind } : {}),
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
        <span className="text-[9.5px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border border-zinc-700/40 bg-zinc-800/40 text-zinc-300">
          {KIND_LABEL[decision.consensusKind] ?? decision.consensusKind}
        </span>
        <span className={`text-[9.5px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border ${agreementClass(decision.agreementScore)}`}>
          {decision.agreementScore}% agreement
        </span>
        <span className={`text-[9.5px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border ${DECISION_CLASS[decision.operatorDecision]}`}>
          {decision.operatorDecision}
        </span>
        <span className="text-[10px] font-mono text-zinc-500">{decision.voterCount} voters</span>
        <span className="text-[10px] font-mono text-zinc-500 ml-auto">{new Date(decision.generatedAtIso).toLocaleString()}</span>
      </div>
      <p className="text-sm font-semibold text-white">{decision.title}</p>
      <p className="text-[12px] text-zinc-300 mt-1">{decision.rationale}</p>

      <div className="mt-2 rounded border border-zinc-700/30 bg-zinc-900/40 p-2">
        <p className="text-[9px] font-mono uppercase tracking-[0.18em] text-zinc-500 mb-1.5">Votes</p>
        <div className="space-y-1">
          {decision.votes.map((v, i) => (
            <div key={i} className="text-[11px] font-mono flex items-baseline gap-2">
              <span className="text-violet-300 w-20 shrink-0">{v.voterId}</span>
              <span className="text-zinc-200 w-24 shrink-0">{KIND_LABEL[v.kind] ?? v.kind}</span>
              <span className="text-zinc-500 w-10 shrink-0">{v.confidence}%</span>
              <span className="text-zinc-400 italic line-clamp-1">{v.rationale}</span>
            </div>
          ))}
        </div>
      </div>

      <p className="text-[10px] font-mono text-zinc-500 mt-1">release {decision.releaseId} · engine {decision.engineVersion}</p>
      {decision.overrideKind && (
        <p className="text-[11px] font-mono text-amber-300 mt-1">↳ override → {KIND_LABEL[decision.overrideKind] ?? decision.overrideKind}</p>
      )}
      {decision.decisionNote && (
        <p className="text-[11px] font-mono text-zinc-400 mt-1 italic">↳ {decision.decisionNote}</p>
      )}

      {decision.operatorDecision === "pending" && (
        <div className="mt-2 pt-2 border-t border-white/[0.04] flex items-center gap-2 flex-wrap text-[11px] font-mono">
          <select
            value={overrideKind}
            onChange={(e) => setOverrideKind(e.target.value)}
            disabled={busy !== null}
            className="rounded border border-zinc-700/40 bg-zinc-900/60 px-2 py-1 text-[11px] text-zinc-100 disabled:opacity-50"
          >
            <option value="block_deploy">block_deploy</option>
            <option value="rollback">rollback</option>
            <option value="needs_evidence">needs_evidence</option>
            <option value="propose_freeze">propose_freeze</option>
            <option value="proceed_with_caution">proceed_with_caution</option>
            <option value="propose_manual_fix_log">propose_manual_fix_log</option>
            <option value="propose_branch_protection_strengthen">strengthen_protection</option>
            <option value="proceed">proceed</option>
          </select>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="note"
            disabled={busy !== null}
            className="flex-1 min-w-[140px] rounded border border-zinc-700/40 bg-zinc-900/60 px-2 py-1 text-[11px] text-zinc-100 placeholder:text-zinc-600 focus:border-violet-500/40 focus:outline-none disabled:opacity-50"
          />
          <button type="button" onClick={() => decide("accept")} disabled={busy !== null}
            className="px-2 py-1 rounded border border-emerald-500/30 bg-emerald-500/[0.10] text-emerald-200 hover:bg-emerald-500/[0.18] disabled:opacity-50 disabled:cursor-wait">
            {busy === "accept" ? "…" : "Accept"}
          </button>
          <button type="button" onClick={() => decide("override")} disabled={busy !== null}
            className="px-2 py-1 rounded border border-amber-500/30 bg-amber-500/[0.10] text-amber-200 hover:bg-amber-500/[0.18] disabled:opacity-50 disabled:cursor-wait">
            {busy === "override" ? "…" : `Override → ${overrideKind}`}
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

type GenState =
  | { kind: "closed" }
  | { kind: "open" }
  | { kind: "submitting" }
  | { kind: "ok"; consensus: string; agreement: number }
  | { kind: "error"; message: string };

function GeneratePanel({ onGenerated }: { onGenerated: () => void }) {
  const [state, setState] = useState<GenState>({ kind: "closed" });
  const [releaseId, setReleaseId] = useState("");
  const [withAi, setWithAi] = useState(true);

  async function submit() {
    setState({ kind: "submitting" });
    try {
      const res = await fetch("/api/dashboard/council-generate", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ releaseId, withAi }),
      });
      const j = await res.json();
      if (j.ok) {
        setState({ kind: "ok", consensus: j.data.decision.consensusKind, agreement: j.data.decision.agreementScore });
        onGenerated();
        setTimeout(() => { setReleaseId(""); setState({ kind: "closed" }); }, 1500);
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
          className="px-3 py-1.5 rounded-md border border-violet-500/40 bg-violet-500/[0.14] text-[12px] font-semibold text-violet-100 hover:bg-violet-500/[0.22] transition-colors"
        >
          ⚖️ Run council
        </button>
      </div>
    );
  }

  const busy = state.kind === "submitting";
  return (
    <div className="glass-card p-4 border border-violet-500/20">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-violet-100">Run advisor council</p>
        <button type="button" onClick={() => { setReleaseId(""); setState({ kind: "closed" }); }} className="text-[11px] font-mono text-zinc-400 hover:text-zinc-200" disabled={busy}>cancel</button>
      </div>
      <label className="block mb-2">
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
      <label className="flex items-center gap-2 mb-2 text-[11.5px] text-zinc-300 cursor-pointer">
        <input
          type="checkbox"
          checked={withAi}
          onChange={(e) => setWithAi(e.target.checked)}
          disabled={busy}
          className="accent-violet-500 disabled:opacity-50"
        />
        <span>Include AI-native voter (Claude · ~1-3s)</span>
      </label>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={submit}
          disabled={busy || !releaseId}
          className="px-3 py-1.5 rounded-md border border-violet-500/40 bg-violet-500/[0.14] text-[12px] font-semibold text-violet-100 hover:bg-violet-500/[0.22] disabled:opacity-50 disabled:cursor-wait transition-colors"
        >
          {busy ? "Running…" : "Run"}
        </button>
        {state.kind === "ok" && (
          <span className="text-[11px] font-mono text-emerald-300">
            ✓ {KIND_LABEL[state.consensus] ?? state.consensus} · {state.agreement}%
          </span>
        )}
        {state.kind === "error" && (
          <span className="text-[11px] font-mono text-rose-300">✗ {state.message}</span>
        )}
      </div>
    </div>
  );
}
