import { useEffect, useState } from "react";
import { ViewShell } from "../components/Primitives";

type ProposalKind =
  | "limit_force_push" | "require_strong_branch_protection" | "require_rollback_rehearsal"
  | "require_evidence_pack_signed" | "require_manual_fix_reconciliation"
  | "require_release_notes_published" | "require_change_ticket" | "unknown";

type ProposalDecision = "pending" | "accepted" | "rejected" | "dismissed" | "superseded" | "unknown";

interface ProposalView {
  id: string;
  kind: ProposalKind;
  suggestedRuleKey: string;
  title: string;
  rationale: string;
  confidence: number;
  severity: "low" | "medium" | "high" | "critical" | "unknown";
  evidence: { metric: string; value: number; threshold: number; windowReleases: number }[];
  suggestedRuleBody: { description?: string; defaultBlocking?: boolean; scope?: string } | unknown;
  operatorDecision: ProposalDecision;
  decisionNote: string | null;
  acceptedRuleId: string | null;
  engineVersion: string;
  generatedAtIso: string;
}

interface ListData {
  generatedAt: string;
  proposals: ProposalView[];
  summary: { total: number; pending: number; accepted: number; rejected: number; dismissed: number };
}

type ListBody = { ok: true; data: ListData } | { ok: false; error: string; hint?: string };

const KIND_LABEL: Record<ProposalKind, string> = {
  limit_force_push: "Limit force-push",
  require_strong_branch_protection: "Strong protection",
  require_rollback_rehearsal: "Rollback rehearsal",
  require_evidence_pack_signed: "Evidence signed",
  require_manual_fix_reconciliation: "Manual-fix reconcile",
  require_release_notes_published: "Release notes",
  require_change_ticket: "Change ticket",
  unknown: "Unknown",
};

const SEVERITY_CLASS: Record<ProposalView["severity"], string> = {
  critical: "bg-rose-500/25 text-rose-200 border-rose-500/40",
  high:     "bg-rose-500/15 text-rose-300 border-rose-500/25",
  medium:   "bg-amber-500/15 text-amber-300 border-amber-500/25",
  low:      "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
  unknown:  "bg-zinc-700/40 text-zinc-400 border-zinc-700/40",
};

const DECISION_CLASS: Record<ProposalDecision, string> = {
  pending:    "bg-violet-500/15 text-violet-300 border-violet-500/25",
  accepted:   "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
  rejected:   "bg-rose-500/15 text-rose-300 border-rose-500/25",
  dismissed:  "bg-zinc-700/40 text-zinc-300 border-zinc-700/40",
  superseded: "bg-zinc-700/40 text-zinc-400 border-zinc-700/40",
  unknown:    "bg-zinc-700/40 text-zinc-400 border-zinc-700/40",
};

export function PolicyProposalsView() {
  const [resp, setResp] = useState<ListBody | null>(null);
  const [loading, setLoading] = useState(true);
  const [networkError, setNetworkError] = useState<string | null>(null);

  function loadList() {
    setLoading(true);
    setNetworkError(null);
    fetch("/api/dashboard/policy-proposal-list", { credentials: "include" })
      .then((r) => r.json())
      .then((j: ListBody) => setResp(j))
      .catch((e) => setNetworkError(e instanceof Error ? e.message : "Network error."))
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadList(); }, []);

  async function generateProposals() {
    setLoading(true);
    setNetworkError(null);
    try {
      await fetch("/api/dashboard/policy-proposal-generate", { method: "POST", credentials: "include" });
      loadList();
    } catch (e) {
      setNetworkError(e instanceof Error ? e.message : "Network error.");
      setLoading(false);
    }
  }

  const data = resp?.ok ? resp.data : null;
  const errorBody = resp && !resp.ok ? resp : null;

  return (
    <ViewShell>
      <div>
        <h1 className="text-xl font-bold tracking-tight">Policy proposals</h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          Autonomous suggestions for new PolicyRules based on observed org patterns.
        </p>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={generateProposals}
          disabled={loading}
          className="px-3 py-1.5 rounded-md border border-violet-500/40 bg-violet-500/[0.14] text-[12px] font-semibold text-violet-100 hover:bg-violet-500/[0.22] disabled:opacity-50 disabled:cursor-wait transition-colors"
        >
          {loading ? "Working…" : "✨ Generate proposals"}
        </button>
      </div>

      {data && (
        <div className="grid grid-cols-5 gap-2">
          <Stat label="Total" value={String(data.summary.total)} />
          <Stat label="Pending" value={String(data.summary.pending)} tone={data.summary.pending > 0 ? "amber" : "zinc"} />
          <Stat label="Accepted" value={String(data.summary.accepted)} tone="emerald" />
          <Stat label="Rejected" value={String(data.summary.rejected)} tone={data.summary.rejected > 0 ? "rose" : "zinc"} />
          <Stat label="Dismissed" value={String(data.summary.dismissed)} />
        </div>
      )}

      {loading && <div className="glass-card p-4 text-sm text-zinc-400">Loading proposals…</div>}
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
        data.proposals.length === 0 ? (
          <div className="glass-card p-8 text-center text-sm text-zinc-400">
            No proposals yet. Hit "Generate proposals" to scan org state.
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
  const [busy, setBusy] = useState<"accept" | "reject" | "dismiss" | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [override, setOverride] = useState("");

  async function decide(action: "accept" | "reject" | "dismiss") {
    setBusy(action);
    setErr(null);
    try {
      const res = await fetch("/api/dashboard/policy-proposal-decide", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proposalId: proposal.id, action,
          ...(note ? { note } : {}),
          ...(action === "accept" && override ? { ruleKeyOverride: override } : {}),
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

  const body = proposal.suggestedRuleBody as { description?: string; defaultBlocking?: boolean; scope?: string } | null;

  return (
    <div className="glass-card p-3 border border-violet-500/20">
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
        <span className="text-[10px] font-mono text-zinc-500">confidence {proposal.confidence}%</span>
        <span className="text-[10px] font-mono text-zinc-500 ml-auto">
          {new Date(proposal.generatedAtIso).toLocaleString()}
        </span>
      </div>
      <p className="text-sm font-semibold text-white">{proposal.title}</p>
      <p className="text-[12px] text-zinc-300 mt-1">{proposal.rationale}</p>

      {proposal.evidence.length > 0 && (
        <div className="mt-2 rounded border border-zinc-700/30 bg-zinc-900/40 p-2 text-[10.5px] font-mono">
          <p className="text-zinc-500 uppercase tracking-[0.18em] mb-1">Evidence</p>
          {proposal.evidence.map((e, i) => (
            <p key={i} className="text-zinc-300">
              {e.metric}: <span className="text-violet-300">{e.value}</span> (threshold {e.threshold})
            </p>
          ))}
        </div>
      )}

      {body && (
        <p className="text-[10.5px] font-mono text-zinc-500 mt-1">
          rule key <span className="text-zinc-200">{proposal.suggestedRuleKey}</span> · blocking {String(body.defaultBlocking)} · scope {body.scope}
        </p>
      )}

      {proposal.acceptedRuleId && (
        <p className="text-[10.5px] font-mono text-emerald-300 mt-1">↳ rule {proposal.acceptedRuleId}</p>
      )}
      {proposal.decisionNote && (
        <p className="text-[11px] font-mono text-zinc-400 mt-1 italic">↳ note: {proposal.decisionNote}</p>
      )}

      {proposal.operatorDecision === "pending" && (
        <div className="mt-2 pt-2 border-t border-white/[0.04] flex items-center gap-2 flex-wrap text-[11px] font-mono">
          <input
            type="text"
            value={override}
            onChange={(e) => setOverride(e.target.value)}
            placeholder="override rule key"
            disabled={busy !== null}
            className="rounded border border-zinc-700/40 bg-zinc-900/60 px-2 py-1 text-[11px] text-zinc-100 placeholder:text-zinc-600 focus:border-violet-500/40 focus:outline-none disabled:opacity-50 w-[140px]"
          />
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="decision note"
            disabled={busy !== null}
            className="flex-1 min-w-[140px] rounded border border-zinc-700/40 bg-zinc-900/60 px-2 py-1 text-[11px] text-zinc-100 placeholder:text-zinc-600 focus:border-violet-500/40 focus:outline-none disabled:opacity-50"
          />
          <button type="button" onClick={() => decide("accept")} disabled={busy !== null}
            className="px-2 py-1 rounded border border-emerald-500/30 bg-emerald-500/[0.10] text-emerald-200 hover:bg-emerald-500/[0.18] disabled:opacity-50 disabled:cursor-wait">
            {busy === "accept" ? "…" : "Accept"}
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
