"use client";

/**
 * /dashboard/policy-proposals — Phase 507.
 *
 * The Autonomous Policy Proposal cockpit. Operator clicks Generate,
 * the engine scans org-level patterns + suggests new PolicyRules.
 * Accept → rule is auto-upserted into the registry. Reject/dismiss
 * → captured as training data with the operator's note.
 */

import { useEffect, useState } from "react";
import {
  CpuChipIcon,
  ShieldCheckIcon,
  CheckCircleIcon,
  XCircleIcon,
  SparklesIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import { PageIntro } from "@/components/dashboard/PageIntro";

type ProposalKind =
  | "limit_force_push"
  | "require_strong_branch_protection"
  | "require_rollback_rehearsal"
  | "require_evidence_pack_signed"
  | "require_manual_fix_reconciliation"
  | "require_release_notes_published"
  | "require_change_ticket"
  | "unknown";

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
  suggestedRuleBody: { description: string; defaultBlocking: boolean; scope: string } | unknown;
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
  medium:   "bg-white/15 text-zinc-300 border-white/25",
  low:      "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
  unknown:  "bg-zinc-700/40 text-zinc-400 border-zinc-700/40",
};

const DECISION_CLASS: Record<ProposalDecision, string> = {
  pending:    "bg-violet-500/15 text-violet-300 border-white/[0.10]",
  accepted:   "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
  rejected:   "bg-rose-500/15 text-rose-300 border-rose-500/25",
  dismissed:  "bg-zinc-700/40 text-zinc-300 border-zinc-700/40",
  superseded: "bg-zinc-700/40 text-zinc-400 border-zinc-700/40",
  unknown:    "bg-zinc-700/40 text-zinc-400 border-zinc-700/40",
};

export default function PolicyProposalsPage() {
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
      await fetch("/api/dashboard/policy-proposal-generate", {
        method: "POST", credentials: "include",
      });
      loadList();
    } catch (e) {
      setNetworkError(e instanceof Error ? e.message : "Network error.");
      setLoading(false);
    }
  }

  const data = resp?.ok ? resp.data : null;
  const errorBody = resp && !resp.ok ? resp : null;

  return (
    <div className="relative">
      <PageIntro
        kicker={`AGI cockpit · policy proposals${data ? ` · ${data.summary.pending} pending` : ""}`}
        title={<>Policies <span className="text-zinc-500">propose themselves.</span></>}
        description="The platform watches your org's release patterns and proposes new PolicyRules when patterns warrant — e.g., 'across 8 of the last 10 releases, evidence packs weren't signed, propose require_evidence_pack_signed.' Operators accept (rule auto-upserts into the registry), reject with rationale, or dismiss."
        helps="Hit Generate to ask the engine to scan org state and propose new policies. Each proposal carries the metric + threshold it tripped + a suggested rule body the operator can edit before accepting."
        connectFirst="Scans the existing release inventory + readiness snapshots + incidents + manual fixes. No extra connector needed."
        engineers={["Compliance", "Security", "Release Captain", "AI Operations"]}
        requiresApproval="Operator-in-the-loop on every proposal. Accepted proposals call PolicyRule.upsert with the operator-editable rule body."
        actions={[
          { label: "Open policy violations", href: "/dashboard/policy-violations" },
          { label: "Open release advisor",   href: "/dashboard/release-advisor" },
        ]}
        safetyNote="Suppresses dupes against existing active rules + pending proposals · auto-upserts only on explicit accept"
      />

      <div className="mb-6 flex justify-end">
        <button
          type="button"
          onClick={generateProposals}
          disabled={loading}
          className="px-3 py-1.5 rounded-lg border border-violet-500/40 bg-white/[0.04] text-[12px] font-semibold text-violet-100 hover:bg-violet-500/[0.18] disabled:opacity-50 disabled:cursor-wait transition-colors inline-flex items-center gap-1.5"
        >
          <SparklesIcon className="h-3.5 w-3.5" />
          {loading ? "Working…" : "Generate proposals"}
        </button>
      </div>

      {data && (
        <div className="mb-6 grid grid-cols-2 md:grid-cols-5 gap-3">
          <Stat icon={CpuChipIcon} label="Total" value={String(data.summary.total)} tone="zinc" />
          <Stat icon={SparklesIcon} label="Pending" value={String(data.summary.pending)} tone={data.summary.pending > 0 ? "amber" : "zinc"} />
          <Stat icon={CheckCircleIcon} label="Accepted" value={String(data.summary.accepted)} tone="emerald" />
          <Stat icon={XCircleIcon} label="Rejected" value={String(data.summary.rejected)} tone={data.summary.rejected > 0 ? "rose" : "zinc"} />
          <Stat icon={ShieldCheckIcon} label="Dismissed" value={String(data.summary.dismissed)} tone="zinc" />
        </div>
      )}

      {loading && (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 mb-6 text-[12px] text-zinc-400">
          Loading proposals…
        </div>
      )}
      {!loading && networkError && (
        <div role="alert" aria-live="assertive" className="rounded-2xl border border-rose-500/[0.18] bg-rose-500/[0.04] p-5 mb-6 text-[13px] text-zinc-300">{networkError}</div>
      )}
      {!loading && errorBody?.error === "migration_pending" && (
        <div role="alert" aria-live="assertive" className="rounded-2xl border border-white/[0.18] bg-white/[0.04] p-5 mb-6">
          <div className="flex items-center gap-2 mb-1">
            <ExclamationTriangleIcon className="h-4 w-4 text-zinc-300" />
            <p className="text-[12px] font-semibold text-zinc-200">Schema migration pending</p>
          </div>
          <p className="text-[12.5px] text-zinc-300">{errorBody.hint}</p>
        </div>
      )}
      {!loading && errorBody?.error === "auth_required" && (
        <div role="alert" aria-live="assertive" className="rounded-2xl border border-white/[0.18] bg-white/[0.04] p-5 mb-6 text-[13px] text-zinc-300">
          Sign in required.
        </div>
      )}

      {data && (
        data.proposals.length === 0 ? (
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8 text-center text-[13px] text-zinc-400">
            No proposals yet. Click "Generate proposals" — the engine will scan your org's release patterns and suggest new policy rules to adopt.
          </div>
        ) : (
          <div className="space-y-3 mb-8">
            {data.proposals.map((p) => <ProposalCard key={p.id} proposal={p} onChanged={loadList} />)}
          </div>
        )
      )}
    </div>
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
    <div className="rounded-2xl border border-white/[0.06] bg-violet-500/[0.025] p-4">
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <span className={`text-[9.5px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border ${SEVERITY_CLASS[proposal.severity]}`}>
          {proposal.severity}
        </span>
        <span className="text-[9.5px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border border-white/[0.08] bg-white/[0.02] text-zinc-300">
          {KIND_LABEL[proposal.kind]}
        </span>
        <span className={`text-[9.5px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border ${DECISION_CLASS[proposal.operatorDecision]}`}>
          {proposal.operatorDecision}
        </span>
        <span className="text-[10px] font-mono text-zinc-500">confidence {proposal.confidence}%</span>
        <span className="text-[10px] font-mono text-zinc-500 ml-auto">
          generated {new Date(proposal.generatedAtIso).toLocaleString()}
        </span>
      </div>
      <p className="text-[13.5px] font-semibold text-white mb-1">{proposal.title}</p>
      <p className="text-[12.5px] text-zinc-300 mb-3">{proposal.rationale}</p>

      {proposal.evidence.length > 0 && (
        <div className="mb-3 rounded-lg border border-white/[0.06] bg-black/20 p-2.5">
          <p className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 mb-1">Evidence</p>
          <ul className="space-y-0.5 text-[11px] font-mono text-zinc-300">
            {proposal.evidence.map((e, i) => (
              <li key={i}>
                {e.metric}: <span className="text-violet-300">{e.value}</span> (threshold {e.threshold}{e.windowReleases ? `, over ${e.windowReleases} releases` : ""})
              </li>
            ))}
          </ul>
        </div>
      )}

      {body && (
        <div className="mb-3 rounded-lg border border-white/[0.06] bg-black/20 p-2.5">
          <p className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 mb-1">Suggested rule</p>
          <p className="text-[11.5px] text-zinc-200 mb-1">{body.description}</p>
          <p className="text-[10px] font-mono text-zinc-500">
            key <span className="text-zinc-200">{proposal.suggestedRuleKey}</span> · blocking <span className="text-zinc-200">{String(body.defaultBlocking)}</span> · scope <span className="text-zinc-200">{body.scope}</span>
          </p>
        </div>
      )}

      {proposal.acceptedRuleId && (
        <p className="text-[10.5px] font-mono text-emerald-300 mb-2">↳ accepted → rule {proposal.acceptedRuleId}</p>
      )}
      {proposal.decisionNote && (
        <p className="text-[11.5px] font-mono text-zinc-400 mb-2 italic">↳ note: {proposal.decisionNote}</p>
      )}

      {proposal.operatorDecision === "pending" && (
        <div className="pt-3 border-t border-white/[0.04] flex items-center gap-2 flex-wrap text-[11px] font-mono">
          <input
            type="text"
            aria-label="Override rule key"
            value={override}
            onChange={(e) => setOverride(e.target.value)}
            placeholder="override rule key (optional)"
            disabled={busy !== null}
            className="rounded-md border border-white/[0.08] bg-black/30 px-2 py-1 text-[11px] text-zinc-100 placeholder:text-zinc-600 focus:border-violet-500/40 focus:outline-none disabled:opacity-50 w-[180px]"
          />
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="optional decision note"
            disabled={busy !== null}
            aria-label="Optional decision note"
            className="flex-1 min-w-[160px] rounded-md border border-white/[0.08] bg-black/30 px-2 py-1 text-[11px] text-zinc-100 placeholder:text-zinc-600 focus:border-violet-500/40 focus:outline-none disabled:opacity-50"
          />
          <button type="button" onClick={() => decide("accept")} disabled={busy !== null}
            className="px-2 py-1 rounded border border-emerald-500/30 bg-emerald-500/[0.08] text-emerald-200 hover:bg-emerald-500/[0.16] disabled:opacity-50 disabled:cursor-wait">
            {busy === "accept" ? "…" : "Accept → create rule"}
          </button>
          <button type="button" onClick={() => decide("reject")} disabled={busy !== null}
            className="px-2 py-1 rounded border border-rose-500/30 bg-rose-500/[0.08] text-rose-200 hover:bg-rose-500/[0.16] disabled:opacity-50 disabled:cursor-wait">
            {busy === "reject" ? "…" : "Reject"}
          </button>
          <button type="button" onClick={() => decide("dismiss")} disabled={busy !== null}
            className="px-2 py-1 rounded border border-zinc-600/40 bg-zinc-800/40 text-zinc-300 hover:bg-zinc-800/60 disabled:opacity-50 disabled:cursor-wait">
            {busy === "dismiss" ? "…" : "Dismiss"}
          </button>
          {err && <span className="text-rose-300">✗ {err}</span>}
        </div>
      )}
      <p className="text-[10px] font-mono text-zinc-600 mt-2">engine: {proposal.engineVersion}</p>
    </div>
  );
}

function Stat({ icon: Icon, label, value, tone }: { icon: typeof CpuChipIcon; label: string; value: string; tone: "emerald" | "amber" | "rose" | "zinc" }) {
  const cls = {
    emerald: "border-emerald-500/[0.18] bg-emerald-500/[0.03] text-emerald-200",
    amber:   "border-white/[0.18] bg-white/[0.03] text-zinc-200",
    rose:    "border-rose-500/[0.18] bg-rose-500/[0.03] text-rose-200",
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
