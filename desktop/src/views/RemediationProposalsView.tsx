import { useEffect, useState } from "react";
import { ViewShell } from "../components/Primitives";

type Kind =
  | "rollback_release" | "disable_feature_flag" | "increase_replicas"
  | "restart_service" | "redirect_traffic" | "throttle_requests"
  | "escalate_to_vendor" | "no_action_recommended" | "unknown";

type Decision = "pending" | "accepted" | "rejected" | "implemented" | "dismissed" | "unknown";

interface ProposalView {
  id: string;
  incidentId: string;
  kind: Kind;
  title: string;
  description: string;
  confidence: number;
  severity: "low" | "medium" | "high" | "critical" | "unknown";
  prerequisites: string[];
  expectedImpact: string;
  rollbackPlan: string;
  estimatedMinutes: number;
  reversible: boolean;
  rationale: string;
  operatorDecision: Decision;
  decisionNote: string | null;
  linkedManualFixId: string | null;
  engineVersion: string;
  generatedAtIso: string;
}

interface ListData {
  generatedAt: string;
  proposals: ProposalView[];
  summary: { total: number; pending: number; accepted: number; rejected: number; implemented: number; dismissed: number };
}

type ListBody = { ok: true; data: ListData } | { ok: false; error: string; hint?: string };

const KIND_LABEL: Record<Kind, string> = {
  rollback_release: "Rollback",
  disable_feature_flag: "Disable flag",
  increase_replicas: "Scale up",
  restart_service: "Restart",
  redirect_traffic: "Redirect traffic",
  throttle_requests: "Throttle",
  escalate_to_vendor: "Escalate vendor",
  no_action_recommended: "No action",
  unknown: "Unknown",
};

const SEVERITY_CLASS: Record<ProposalView["severity"], string> = {
  critical: "bg-rose-500/25 text-rose-200 border-rose-500/40",
  high:     "bg-rose-500/15 text-rose-300 border-rose-500/25",
  medium:   "bg-white/15 text-zinc-300 border-white/25",
  low:      "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
  unknown:  "bg-zinc-700/40 text-zinc-400 border-zinc-700/40",
};

const DECISION_CLASS: Record<Decision, string> = {
  pending:     "bg-violet-500/15 text-violet-300 border-violet-500/25",
  accepted:    "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
  rejected:    "bg-rose-500/15 text-rose-300 border-rose-500/25",
  implemented: "bg-cyan-500/15 text-cyan-300 border-cyan-500/25",
  dismissed:   "bg-zinc-700/40 text-zinc-300 border-zinc-700/40",
  unknown:     "bg-zinc-700/40 text-zinc-400 border-zinc-700/40",
};

export function RemediationProposalsView() {
  const [resp, setResp] = useState<ListBody | null>(null);
  const [loading, setLoading] = useState(true);
  const [networkError, setNetworkError] = useState<string | null>(null);

  function loadList() {
    setLoading(true);
    setNetworkError(null);
    fetch("/api/dashboard/remediation-list", { credentials: "include" })
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
        <h1 className="text-xl font-bold tracking-tight">Remediation proposals</h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          On-call action suggestions with prereqs, impact, rollback plans. Operator-decided.
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

      {loading && <div className="glass-card p-4 text-sm text-zinc-400">Loading proposals…</div>}
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
        data.proposals.length === 0 ? (
          <div className="glass-card p-8 text-center text-sm text-zinc-400">
            No proposals yet. Paste an incident id above and hit Generate.
          </div>
        ) : (
          <div className="space-y-2">
            {data.proposals.map((p) => <ProposalCard key={p.id} proposal={p} onChanged={loadList} />)}
          </div>
        )
      )}
    </ViewShell>
  );
}

function ProposalCard({ proposal, onChanged }: { proposal: ProposalView; onChanged: () => void }) {
  const [busy, setBusy] = useState<"accept" | "reject" | "implement" | "dismiss" | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [linkedManualFixId, setLinkedManualFixId] = useState("");

  async function decide(action: "accept" | "reject" | "implement" | "dismiss") {
    setBusy(action);
    setErr(null);
    try {
      const res = await fetch("/api/dashboard/remediation-decide", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proposalId: proposal.id, action,
          ...(note ? { note } : {}),
          ...(action === "implement" && linkedManualFixId ? { linkedManualFixId } : {}),
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

  const isNoAction = proposal.kind === "no_action_recommended";

  return (
    <div className={`glass-card p-3 ${isNoAction ? "border border-zinc-700/40" : "border border-violet-500/20"}`}>
      <div className="flex items-center gap-2 mb-1 flex-wrap">
        <span className={`text-[9.5px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border ${SEVERITY_CLASS[proposal.severity]}`}>
          {proposal.severity}
        </span>
        <span className="text-[9.5px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border border-zinc-700/40 bg-zinc-800/40 text-zinc-300">
          {KIND_LABEL[proposal.kind]}
        </span>
        <span className={`text-[9.5px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border ${DECISION_CLASS[proposal.operatorDecision]}`}>
          {proposal.operatorDecision}
        </span>
        <span className="text-[10px] font-mono text-zinc-500">conf {proposal.confidence}%</span>
        {proposal.estimatedMinutes > 0 && (
          <span className="text-[10px] font-mono text-zinc-500">~{proposal.estimatedMinutes}m</span>
        )}
        <span className={`text-[9.5px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border ${proposal.reversible ? "border-emerald-500/30 bg-emerald-500/[0.08] text-emerald-300" : "border-rose-500/30 bg-rose-500/[0.08] text-rose-300"}`}>
          {proposal.reversible ? "reversible" : "one-way"}
        </span>
        <span className="text-[10px] font-mono text-zinc-500 ml-auto">{new Date(proposal.generatedAtIso).toLocaleString()}</span>
      </div>
      <p className="text-sm font-semibold text-white">{proposal.title}</p>
      <p className="text-[12px] text-zinc-300 mt-1">{proposal.description}</p>

      {proposal.prerequisites.length > 0 && (
        <div className="mt-2 rounded border border-white/[0.15] bg-white/[0.04] p-2 text-[10.5px] font-mono">
          <p className="text-zinc-300 uppercase tracking-[0.18em] mb-1">Prereqs</p>
          {proposal.prerequisites.map((pre, i) => <p key={i} className="text-zinc-300">• {pre}</p>)}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 mt-2">
        <div className="rounded border border-zinc-700/30 bg-zinc-900/40 p-2">
          <p className="text-[9px] font-mono uppercase tracking-wider text-zinc-500">Impact</p>
          <p className="text-[11px] text-zinc-200 mt-0.5">{proposal.expectedImpact}</p>
        </div>
        <div className="rounded border border-zinc-700/30 bg-zinc-900/40 p-2">
          <p className="text-[9px] font-mono uppercase tracking-wider text-zinc-500">Rollback</p>
          <p className="text-[11px] text-zinc-200 mt-0.5">{proposal.rollbackPlan}</p>
        </div>
      </div>

      <p className="text-[11px] text-zinc-400 mt-2 italic">{proposal.rationale}</p>

      <AiRemediationRationaleCard proposalId={proposal.id} />

      {proposal.linkedManualFixId && (
        <p className="text-[11px] font-mono text-emerald-300 mt-1">↳ manual-fix {proposal.linkedManualFixId}</p>
      )}
      {proposal.decisionNote && (
        <p className="text-[11px] font-mono text-zinc-400 mt-1 italic">↳ {proposal.decisionNote}</p>
      )}

      {proposal.operatorDecision === "pending" && !isNoAction && (
        <div className="mt-2 pt-2 border-t border-white/[0.04] flex items-center gap-2 flex-wrap text-[11px] font-mono">
          <input
            type="text"
            value={linkedManualFixId}
            onChange={(e) => setLinkedManualFixId(e.target.value)}
            placeholder="manual-fix id"
            disabled={busy !== null}
            className="rounded border border-zinc-700/40 bg-zinc-900/60 px-2 py-1 text-[11px] text-zinc-100 placeholder:text-zinc-600 focus:border-violet-500/40 focus:outline-none disabled:opacity-50 w-[140px]"
          />
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
  const [incidentId, setIncidentId] = useState("");

  async function submit() {
    setState({ kind: "submitting" });
    try {
      const res = await fetch("/api/dashboard/remediation-generate", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ incidentId }),
      });
      const j = await res.json();
      if (j.ok) {
        setState({ kind: "ok", count: j.data.proposalCount, primary: j.data.primary?.title ?? null });
        onGenerated();
        setTimeout(() => { setIncidentId(""); setState({ kind: "closed" }); }, 1500);
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
          🔧 Generate remediations
        </button>
      </div>
    );
  }

  const busy = state.kind === "submitting";
  return (
    <div className="glass-card p-4 border border-violet-500/20">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-violet-100">Generate remediation proposals</p>
        <button type="button" onClick={() => { setIncidentId(""); setState({ kind: "closed" }); }} className="text-[11px] font-mono text-zinc-400 hover:text-zinc-200" disabled={busy}>cancel</button>
      </div>
      <label className="block mb-2">
        <span className="block text-[10px] font-mono uppercase tracking-wider text-zinc-400 mb-1">Incident ID</span>
        <input
          type="text"
          value={incidentId}
          onChange={(e) => setIncidentId(e.target.value)}
          placeholder="inc_..."
          disabled={busy}
          className="w-full rounded-md border border-zinc-700/40 bg-zinc-900/60 px-2 py-1.5 text-[12px] text-zinc-100 placeholder:text-zinc-600 focus:border-violet-500/40 focus:outline-none disabled:opacity-50"
        />
      </label>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={submit}
          disabled={busy || !incidentId}
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

/* ──────────────────────────────────────────────────────────────────
   AI rationale enrichment card — Phase 520 desktop (remediation).
   ────────────────────────────────────────────────────────────── */

interface RemediationEnrichmentView {
  targetKind: string;
  targetId: string;
  narrative: string;
  riskFactors: string[];
  nextActions: string[];
  outcome: string;
  errorMessage: string | null;
  modelHint: string | null;
  engineVersion: string;
  generatedAtIso: string;
}

type RemediationEnrichBody = { ok: true; data: { enrichment: RemediationEnrichmentView | null } } | { ok: false; error: string; hint?: string };

const REM_ENRICH_OUTCOME_CLASS: Record<string, string> = {
  ai_generated:    "bg-violet-500/15 text-violet-300 border-violet-500/25",
  fallback_rules:  "bg-white/15 text-zinc-300 border-white/25",
  error:           "bg-rose-500/15 text-rose-300 border-rose-500/25",
};

function AiRemediationRationaleCard({ proposalId }: { proposalId: string }) {
  const [enrichment, setEnrichment] = useState<RemediationEnrichmentView | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/dashboard/remediation-rationale-read?proposalId=${encodeURIComponent(proposalId)}`, { credentials: "include" });
        const j: RemediationEnrichBody = await res.json();
        if (cancelled) return;
        if (j.ok) setEnrichment(j.data.enrichment);
      } catch { /* fall through */ }
      finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, [proposalId]);

  async function generate() {
    setGenerating(true);
    setErr(null);
    try {
      const res = await fetch("/api/dashboard/remediation-rationale-enrich", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proposalId }),
      });
      const j: RemediationEnrichBody = await res.json();
      if (j.ok) setEnrichment(j.data.enrichment);
      else setErr(j.hint ?? j.error);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "network error");
    } finally {
      setGenerating(false);
    }
  }

  if (!loaded) return null;

  if (!enrichment) {
    return (
      <div className="mt-2 rounded border border-violet-500/[0.20] bg-violet-500/[0.04] p-2">
        <div className="flex items-center justify-between">
          <span className="text-[10.5px] font-mono uppercase tracking-[0.18em] text-violet-200">⨯ AI rationale not yet generated</span>
          <button
            type="button"
            onClick={generate}
            disabled={generating}
            className="px-2 py-0.5 rounded border border-violet-500/40 bg-violet-500/[0.12] text-[10.5px] font-semibold text-violet-100 hover:bg-violet-500/[0.20] disabled:opacity-50 disabled:cursor-wait"
          >
            {generating ? "Generating…" : "Generate why-this"}
          </button>
        </div>
        {err && <p className="mt-1 text-[10.5px] font-mono text-rose-300">✗ {err}</p>}
      </div>
    );
  }

  return (
    <div className="mt-2 rounded border border-violet-500/[0.20] bg-violet-500/[0.04] p-2.5">
      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
        <span className="text-[9.5px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border border-violet-500/30 bg-violet-500/[0.10] text-violet-200">
          ✦ AI rationale
        </span>
        <span className={`text-[9.5px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border ${REM_ENRICH_OUTCOME_CLASS[enrichment.outcome] ?? REM_ENRICH_OUTCOME_CLASS.error}`}>
          {enrichment.outcome}
        </span>
        {enrichment.modelHint && (
          <span className="text-[10px] font-mono text-zinc-500">{enrichment.modelHint}</span>
        )}
        <span className="text-[10px] font-mono text-zinc-500 ml-auto">{new Date(enrichment.generatedAtIso).toLocaleString()}</span>
        <button
          type="button"
          onClick={generate}
          disabled={generating}
          className="text-[10.5px] font-mono text-violet-300 hover:text-violet-200 disabled:opacity-50 disabled:cursor-wait"
        >
          {generating ? "Regen…" : "Regen"}
        </button>
      </div>
      <p className="text-[12px] text-zinc-200 mb-2">{enrichment.narrative}</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <div>
          <p className="text-[9px] font-mono uppercase tracking-wider text-zinc-500 mb-1">Risk factors</p>
          <ul className="space-y-0.5">
            {enrichment.riskFactors.map((r, i) => (
              <li key={i} className="text-[11px] text-zinc-300 flex gap-1.5"><span className="text-rose-400">•</span><span>{r}</span></li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-[9px] font-mono uppercase tracking-wider text-zinc-500 mb-1">Next actions</p>
          <ul className="space-y-0.5">
            {enrichment.nextActions.map((a, i) => (
              <li key={i} className="text-[11px] text-zinc-300 flex gap-1.5"><span className="text-emerald-400">→</span><span>{a}</span></li>
            ))}
          </ul>
        </div>
      </div>
      {enrichment.outcome !== "ai_generated" && enrichment.errorMessage && (
        <p className="mt-1.5 text-[10px] font-mono text-zinc-300">↳ {enrichment.errorMessage}</p>
      )}
      {err && <p className="mt-1 text-[10.5px] font-mono text-rose-300">✗ {err}</p>}
    </div>
  );
}
