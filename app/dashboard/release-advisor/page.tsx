"use client";

/**
 * /dashboard/release-advisor — Phase 506.
 *
 * The Autonomous Release Advisor cockpit. Operator picks a release,
 * clicks "Generate", and the engine emits ranked recommendations with
 * confidence + rationale. Each card has accept/reject/implement/dismiss
 * controls — the operator's decisions are persisted alongside the
 * engine output for the learning loop.
 */

import { useEffect, useState } from "react";
import {
  SparklesIcon,
  ShieldExclamationIcon,
  CheckCircleIcon,
  XCircleIcon,
  BoltIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";
import { PageIntro } from "@/components/dashboard/PageIntro";

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
  decidedByUserId: string | null;
  decidedAtIso: string | null;
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
  medium:   "bg-amber-500/15 text-amber-300 border-amber-500/25",
  low:      "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
  unknown:  "bg-zinc-700/40 text-zinc-400 border-zinc-700/40",
};

const DECISION_CLASS: Record<OperatorDecision, string> = {
  pending:     "bg-violet-500/15 text-violet-300 border-white/[0.10]",
  accepted:    "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
  rejected:    "bg-rose-500/15 text-rose-300 border-rose-500/25",
  implemented: "bg-cyan-500/15 text-cyan-300 border-cyan-500/25",
  dismissed:   "bg-zinc-700/40 text-zinc-300 border-zinc-700/40",
  unknown:     "bg-zinc-700/40 text-zinc-400 border-zinc-700/40",
};

export default function ReleaseAdvisorPage() {
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
    <div className="relative">
      <PageIntro
        kicker={`AGI cockpit · release advisor${data ? ` · ${data.summary.pending} pending` : ""}`}
        title={<>Autonomous <span className="text-zinc-500">release advisor.</span></>}
        description="The platform's first agentic surface for ReleaseOps. A deterministic decision engine reads each release's full state — readiness, policy violations, manual fixes, deployment incidents, branch protection — and emits ranked recommendations with confidence, rationale, and suggested actions. Operators accept, reject, implement, or dismiss; every decision is persisted as training data."
        helps="Pick a release, generate recommendations, and the engine surfaces the highest-priority next move. Engine version is pinned on every row so historical decisions stay interpretable."
        connectFirst="Generate fires synchronously from the existing release inputs — no extra connector needed."
        engineers={["Release Captain", "DevOps", "Security", "AI Operations"]}
        requiresApproval="Recommendations never auto-execute. The operator is always in the loop."
        actions={[
          { label: "Open release audit", href: "/dashboard/release-audit" },
          { label: "Open releases",      href: "/dashboard/releases" },
        ]}
        safetyNote="Pure decision engine · per-release supersede · audit-trailed · engine version pinned per recommendation"
      />

      <GeneratePanel onGenerated={loadList} />

      {data && (
        <div className="mb-6 grid grid-cols-2 md:grid-cols-5 gap-3">
          <Stat icon={SparklesIcon} label="Total" value={String(data.summary.total)} tone="zinc" />
          <Stat icon={BoltIcon} label="Pending" value={String(data.summary.pending)} tone={data.summary.pending > 0 ? "amber" : "zinc"} />
          <Stat icon={CheckCircleIcon} label="Accepted" value={String(data.summary.accepted)} tone="emerald" />
          <Stat icon={CheckCircleIcon} label="Implemented" value={String(data.summary.implemented)} tone="emerald" />
          <Stat icon={XCircleIcon} label="Rejected" value={String(data.summary.rejected)} tone={data.summary.rejected > 0 ? "rose" : "zinc"} />
        </div>
      )}

      {loading && (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 mb-6 text-[12px] text-zinc-400">
          Loading recommendations…
        </div>
      )}
      {!loading && networkError && (
        <div role="alert" aria-live="assertive" className="rounded-2xl border border-rose-500/[0.18] bg-rose-500/[0.04] p-5 mb-6 text-[13px] text-zinc-300">
          {networkError}
        </div>
      )}
      {!loading && errorBody?.error === "migration_pending" && (
        <div role="alert" aria-live="assertive" className="rounded-2xl border border-amber-500/[0.18] bg-amber-500/[0.04] p-5 mb-6">
          <div className="flex items-center gap-2 mb-1">
            <ExclamationTriangleIcon className="h-4 w-4 text-amber-300" />
            <p className="text-[12px] font-semibold text-amber-200">Schema migration pending</p>
          </div>
          <p className="text-[12.5px] text-zinc-300">{errorBody.hint}</p>
        </div>
      )}
      {!loading && errorBody?.error === "auth_required" && (
        <div role="alert" aria-live="assertive" className="rounded-2xl border border-amber-500/[0.18] bg-amber-500/[0.04] p-5 mb-6 text-[13px] text-zinc-300">
          Sign in required.
        </div>
      )}

      {data && (
        data.recommendations.length === 0 ? (
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8 text-center text-[13px] text-zinc-400">
            No advisor runs yet. Use the panel above to generate recommendations for a specific release.
          </div>
        ) : (
          <div className="space-y-3 mb-8">
            {data.recommendations.map((r) => <RecCard key={r.id} rec={r} onChanged={loadList} />)}
          </div>
        )
      )}
    </div>
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

  const isProceed = rec.kind === "proceed";

  return (
    <div className={`rounded-2xl border p-4 ${isProceed ? "border-emerald-500/[0.18] bg-emerald-500/[0.025]" : "border-white/[0.06] bg-violet-500/[0.025]"}`}>
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <span className={`text-[9.5px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border ${SEVERITY_CLASS[rec.severity]}`}>
          {rec.severity}
        </span>
        <span className="text-[9.5px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border border-white/[0.08] bg-white/[0.02] text-zinc-300">
          {KIND_LABEL[rec.kind]}
        </span>
        <span className={`text-[9.5px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border ${DECISION_CLASS[rec.operatorDecision]}`}>
          {rec.operatorDecision}
        </span>
        <span className="text-[10px] font-mono text-zinc-500">confidence {rec.confidence}%</span>
        <span className="text-[10px] font-mono text-zinc-500">release {rec.releaseId}</span>
        <span className="text-[10px] font-mono text-zinc-500 ml-auto">
          generated {new Date(rec.generatedAtIso).toLocaleString()}
        </span>
      </div>
      <p className="text-[13.5px] font-semibold text-white mb-1">{rec.title}</p>
      <p className="text-[12.5px] text-zinc-300 mb-3">{rec.rationale}</p>
      {rec.suggestedActions.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {rec.suggestedActions.map((a, i) => (
            <a
              key={i}
              href={a.href}
              className="px-2 py-1 rounded border border-white/[0.08] bg-white/[0.02] text-[11px] font-mono text-zinc-200 hover:border-white/[0.12] transition-colors"
            >
              {a.label} →
            </a>
          ))}
        </div>
      )}
      {rec.decisionNote && (
        <p className="text-[11.5px] font-mono text-zinc-400 mb-3 italic">↳ note: {rec.decisionNote}</p>
      )}
      {rec.operatorDecision === "pending" && (
        <div className="pt-3 border-t border-white/[0.04] flex items-center gap-2 flex-wrap text-[11px] font-mono">
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="optional decision note"
            disabled={busy !== null}
            className="flex-1 min-w-[200px] rounded-md border border-white/[0.08] bg-black/30 px-2 py-1 text-[11px] text-zinc-100 placeholder:text-zinc-600 focus:border-violet-500/40 focus:outline-none disabled:opacity-50"
          />
          <button type="button" onClick={() => decide("accept")} disabled={busy !== null}
            className="px-2 py-1 rounded border border-emerald-500/30 bg-emerald-500/[0.08] text-emerald-200 hover:bg-emerald-500/[0.16] disabled:opacity-50 disabled:cursor-wait">
            {busy === "accept" ? "…" : "Accept"}
          </button>
          <button type="button" onClick={() => decide("implement")} disabled={busy !== null}
            className="px-2 py-1 rounded border border-cyan-500/30 bg-cyan-500/[0.08] text-cyan-200 hover:bg-cyan-500/[0.16] disabled:opacity-50 disabled:cursor-wait">
            {busy === "implement" ? "…" : "Implemented"}
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
      <p className="text-[10px] font-mono text-zinc-600 mt-2">engine: {rec.engineVersion}</p>
    </div>
  );
}

function Stat({ icon: Icon, label, value, tone }: { icon: typeof SparklesIcon; label: string; value: string; tone: "emerald" | "amber" | "rose" | "zinc" }) {
  const cls = {
    emerald: "border-emerald-500/[0.18] bg-emerald-500/[0.03] text-emerald-200",
    amber:   "border-amber-500/[0.18] bg-amber-500/[0.03] text-amber-200",
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
      <div className="mb-6 flex justify-end gap-2">
        <button
          type="button"
          onClick={() => setState({ kind: "open" })}
          className="px-3 py-1.5 rounded-lg border border-white/[0.12] bg-white/[0.025] text-[12px] font-semibold text-white hover:bg-violet-500/[0.12] transition-colors inline-flex items-center gap-1.5"
        >
          <SparklesIcon className="h-3.5 w-3.5" />
          Generate recommendations
        </button>
      </div>
    );
  }

  const busy = state.kind === "submitting";
  return (
    <div className="mb-6 rounded-2xl border border-white/[0.06] bg-white/[0.015] p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[13px] font-semibold text-violet-100 inline-flex items-center gap-1.5">
          <ArrowPathIcon className="h-4 w-4" /> Generate advisor recommendations
        </p>
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
          className="w-full rounded-lg border border-white/[0.08] bg-black/30 px-3 py-2 text-[12.5px] text-zinc-100 placeholder:text-zinc-600 focus:border-violet-500/40 focus:outline-none disabled:opacity-50"
        />
      </label>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={submit}
          disabled={busy || !releaseId}
          className="px-3 py-1.5 rounded-lg border border-violet-500/40 bg-violet-500/[0.12] text-[12px] font-semibold text-violet-100 hover:bg-violet-500/[0.20] disabled:opacity-50 disabled:cursor-wait transition-colors inline-flex items-center gap-1.5"
        >
          <SparklesIcon className="h-3.5 w-3.5" />
          {busy ? "Generating…" : "Generate"}
        </button>
        {state.kind === "ok" && (
          <span className="text-[11.5px] font-mono text-emerald-300">
            ✓ {state.count} recommendation{state.count === 1 ? "" : "s"}{state.primary ? ` · primary: ${state.primary}` : ""}
          </span>
        )}
        {state.kind === "error" && (
          <span className="text-[11.5px] font-mono text-rose-300 inline-flex items-center gap-1">
            <ShieldExclamationIcon className="h-3.5 w-3.5" /> {state.message}
          </span>
        )}
      </div>
    </div>
  );
}
