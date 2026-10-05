"use client";

/**
 * /dashboard/advisor-council — Phase 514.
 *
 * Multi-voter consensus cockpit. Paste a release id; three voters
 * (rule-based, conservative, pragmatic) project the same release and
 * the council picks a consensus + dissent breakdown. Operator
 * accepts, overrides, or dismisses.
 */

import { useEffect, useState } from "react";
import {
  ScaleIcon,
  CheckCircleIcon,
  XCircleIcon,
  SparklesIcon,
  ExclamationTriangleIcon,
  HandThumbUpIcon,
  HandThumbDownIcon,
} from "@heroicons/react/24/outline";
import { PageIntro } from "@/components/dashboard/PageIntro";
import { SurfaceExplainer } from "../SurfaceExplainer";

type Kind =
  | "block_deploy" | "rollback" | "needs_evidence" | "propose_freeze"
  | "proceed_with_caution" | "propose_manual_fix_log"
  | "propose_branch_protection_strengthen" | "proceed" | "no_consensus" | "unknown";

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
  consensusKind: Kind;
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
  summary: {
    total: number;
    pending: number;
    accepted: number;
    overridden: number;
    dismissed: number;
    highAgreement: number;
    noConsensus: number;
    avgAgreementScore: number;
  };
}

type ListBody = { ok: true; data: ListData } | { ok: false; error: string; hint?: string };

const KIND_LABEL: Record<string, string> = {
  block_deploy: "Block deploy",
  rollback: "Consider rollback",
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
  pending:    "bg-violet-500/15 text-violet-300 border-white/[0.10]",
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

function consensusClass(kind: Kind): string {
  if (kind === "block_deploy" || kind === "rollback") return "border-rose-500/30 bg-rose-500/[0.04]";
  if (kind === "needs_evidence" || kind === "propose_freeze" || kind === "proceed_with_caution") return "border-amber-500/30 bg-amber-500/[0.04]";
  if (kind === "no_consensus") return "border-white/[0.12] bg-white/[0.02]";
  if (kind === "proceed") return "border-emerald-500/30 bg-emerald-500/[0.04]";
  return "border-white/[0.08] bg-white/[0.02]";
}

export default function AdvisorCouncilPage() {
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
    <div className="relative">
      <SurfaceExplainer surface="advisor-council" />
      <PageIntro
        kicker={`AGI cockpit · advisor council${data ? ` · ${data.summary.pending} pending` : ""}`}
        title={<>Three voters. <span className="text-zinc-500">One decision.</span></>}
        description="The advisor council runs three voters in parallel — rule-based, conservative, pragmatic — and synthesizes a consensus from their votes. When they agree, confidence is high. When they don't, the operator sees the dissent and decides. Persistent dissent patterns feed the learning loop."
        helps="Paste a release id, the council emits a consensus kind + agreement score + per-voter breakdown. High disagreement = operator's call. High agreement = AGI is sure."
        connectFirst="Reuses the existing advisor input aggregator. Three voters are built-in; custom voter sets ship in follow-on phases."
        engineers={["Release Captain", "AI Operations", "SRE"]}
        requiresApproval="Even with high agreement, the operator can override the consensus kind. Override is captured for the learning loop."
        actions={[
          { label: "Open release advisor", href: "/dashboard/release-advisor" },
          { label: "Open AGI cockpit",     href: "/dashboard/agi-cockpit" },
        ]}
        safetyNote="Pure council aggregation · per-voter exception isolation · operator-in-the-loop · audit-trailed"
      />

      <GeneratePanel onGenerated={load} />

      {data && (
        <div className="mb-6 grid grid-cols-2 md:grid-cols-5 gap-3">
          <Stat icon={ScaleIcon} label="Total" value={String(data.summary.total)} tone="zinc" />
          <Stat icon={SparklesIcon} label="Pending" value={String(data.summary.pending)} tone={data.summary.pending > 0 ? "amber" : "zinc"} />
          <Stat icon={HandThumbUpIcon} label="High agreement (≥75)" value={String(data.summary.highAgreement)} tone={data.summary.highAgreement > 0 ? "emerald" : "zinc"} />
          <Stat icon={HandThumbDownIcon} label="No consensus" value={String(data.summary.noConsensus)} tone={data.summary.noConsensus > 0 ? "rose" : "zinc"} />
          <Stat icon={CheckCircleIcon} label="Avg agreement" value={`${data.summary.avgAgreementScore}%`} tone="zinc" />
        </div>
      )}

      {loading && <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 mb-6 text-[12px] text-zinc-400">Loading council decisions…</div>}
      {!loading && networkError && (
        <div role="alert" aria-live="assertive" className="rounded-2xl border border-rose-500/[0.18] bg-rose-500/[0.04] p-5 mb-6 text-[13px] text-zinc-300">{networkError}</div>
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
        <div role="alert" aria-live="assertive" className="rounded-2xl border border-amber-500/[0.18] bg-amber-500/[0.04] p-5 mb-6 text-[13px] text-zinc-300">Sign in required.</div>
      )}

      {data && (
        data.decisions.length === 0 ? (
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8 text-center text-[13px] text-zinc-400">
            No council decisions yet. Paste a release id and hit Generate to run the three voters.
          </div>
        ) : (
          <div className="space-y-3 mb-8">
            {data.decisions.map((d) => <CouncilCard key={d.id} decision={d} onChanged={load} />)}
          </div>
        )
      )}
    </div>
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
    <div className={`rounded-2xl border p-4 ${consensusClass(decision.consensusKind)}`}>
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <span className="text-[9.5px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border border-white/[0.08] bg-white/[0.02] text-zinc-300">
          {KIND_LABEL[decision.consensusKind]}
        </span>
        <span className={`text-[9.5px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border ${agreementClass(decision.agreementScore)}`}>
          {decision.agreementScore}% agreement
        </span>
        <span className={`text-[9.5px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border ${DECISION_CLASS[decision.operatorDecision]}`}>
          {decision.operatorDecision}
        </span>
        <span className="text-[10px] font-mono text-zinc-500">{decision.voterCount} voters</span>
        <span className="text-[10px] font-mono text-zinc-500">release {decision.releaseId}</span>
        <span className="text-[10px] font-mono text-zinc-500 ml-auto">{new Date(decision.generatedAtIso).toLocaleString()}</span>
      </div>
      <p className="text-[14px] font-semibold text-white mb-2">{decision.title}</p>
      <p className="text-[12.5px] text-zinc-300 mb-3">{decision.rationale}</p>

      <AiRationaleCard decisionId={decision.id} />

      {/* Per-voter breakdown */}
      <div className="mb-3 rounded-lg border border-white/[0.06] bg-black/20 p-2.5">
        <p className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 mb-2">Votes</p>
        <div className="space-y-1.5">
          {decision.votes.map((v, i) => (
            <div key={i} className="flex items-start gap-2 text-[11.5px] font-mono">
              <span className="text-violet-300 w-24 shrink-0">{v.voterId}</span>
              <span className="text-zinc-200 w-32 shrink-0">{KIND_LABEL[v.kind] ?? v.kind}</span>
              <span className="text-zinc-500 w-14 shrink-0">{v.confidence}%</span>
              <span className="text-zinc-400 flex-1 italic">{v.rationale}</span>
            </div>
          ))}
        </div>
      </div>

      {decision.overrideKind && (
        <p className="text-[11.5px] font-mono text-amber-300 mb-2">↳ operator overrode → {KIND_LABEL[decision.overrideKind] ?? decision.overrideKind}</p>
      )}
      {decision.decisionNote && (
        <p className="text-[11.5px] font-mono text-zinc-400 mb-2 italic">↳ note: {decision.decisionNote}</p>
      )}

      {decision.operatorDecision === "pending" && (
        <div className="pt-3 border-t border-white/[0.04] flex items-center gap-2 flex-wrap text-[11px] font-mono">
          <select
            value={overrideKind}
            onChange={(e) => setOverrideKind(e.target.value)}
            disabled={busy !== null}
            className="rounded-md border border-white/[0.08] bg-black/30 px-2 py-1 text-[11px] text-zinc-100 disabled:opacity-50"
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
            placeholder="optional note"
            disabled={busy !== null}
            className="flex-1 min-w-[180px] rounded-md border border-white/[0.08] bg-black/30 px-2 py-1 text-[11px] text-zinc-100 placeholder:text-zinc-600 focus:border-violet-500/40 focus:outline-none disabled:opacity-50"
          />
          <button type="button" onClick={() => decide("accept")} disabled={busy !== null}
            className="px-2 py-1 rounded border border-emerald-500/30 bg-emerald-500/[0.08] text-emerald-200 hover:bg-emerald-500/[0.16] disabled:opacity-50 disabled:cursor-wait">
            {busy === "accept" ? "…" : "Accept consensus"}
          </button>
          <button type="button" onClick={() => decide("override")} disabled={busy !== null}
            className="px-2 py-1 rounded border border-amber-500/30 bg-amber-500/[0.08] text-amber-200 hover:bg-amber-500/[0.16] disabled:opacity-50 disabled:cursor-wait">
            {busy === "override" ? "…" : `Override → ${overrideKind}`}
          </button>
          <button type="button" onClick={() => decide("dismiss")} disabled={busy !== null}
            className="px-2 py-1 rounded border border-zinc-600/40 bg-zinc-800/40 text-zinc-300 hover:bg-zinc-800/60 disabled:opacity-50 disabled:cursor-wait">
            {busy === "dismiss" ? "…" : "Dismiss"}
          </button>
          {err && <span className="text-rose-300">✗ {err}</span>}
        </div>
      )}
      <p className="text-[10px] font-mono text-zinc-600 mt-2">engine: {decision.engineVersion}</p>
    </div>
  );
}

function Stat({ icon: Icon, label, value, tone }: { icon: typeof ScaleIcon; label: string; value: string; tone: "emerald" | "amber" | "rose" | "zinc" }) {
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
      <div className="mb-6 flex justify-end">
        <button
          type="button"
          onClick={() => setState({ kind: "open" })}
          className="px-3 py-1.5 rounded-lg border border-white/[0.12] bg-white/[0.025] text-[12px] font-semibold text-white hover:bg-violet-500/[0.12] transition-colors inline-flex items-center gap-1.5"
        >
          <ScaleIcon className="h-3.5 w-3.5" />
          Run council
        </button>
      </div>
    );
  }

  const busy = state.kind === "submitting";
  return (
    <div className="mb-6 rounded-2xl border border-white/[0.06] bg-white/[0.015] p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[13px] font-semibold text-violet-100">Run advisor council</p>
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
      <label className="flex items-center gap-2 mb-3 text-[12px] text-zinc-300 cursor-pointer">
        <input
          type="checkbox"
          checked={withAi}
          onChange={(e) => setWithAi(e.target.checked)}
          disabled={busy}
          className="accent-violet-500 disabled:opacity-50"
        />
        <span>Include AI-native voter (calls Claude — adds ~1-3s)</span>
      </label>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={submit}
          disabled={busy || !releaseId}
          className="px-3 py-1.5 rounded-lg border border-violet-500/40 bg-violet-500/[0.12] text-[12px] font-semibold text-violet-100 hover:bg-violet-500/[0.20] disabled:opacity-50 disabled:cursor-wait transition-colors inline-flex items-center gap-1.5"
        >
          <ScaleIcon className="h-3.5 w-3.5" />
          {busy ? "Running…" : "Run council"}
        </button>
        {state.kind === "ok" && (
          <span className="text-[11.5px] font-mono text-emerald-300">
            ✓ {KIND_LABEL[state.consensus] ?? state.consensus} · {state.agreement}% agreement
          </span>
        )}
        {state.kind === "error" && (
          <span className="text-[11.5px] font-mono text-rose-300 inline-flex items-center gap-1">
            <XCircleIcon className="h-3.5 w-3.5" /> {state.message}
          </span>
        )}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────
   AI rationale enrichment card — Phase 518.
   ────────────────────────────────────────────────────────────── */

interface EnrichmentView {
  targetKind: string;
  targetId: string;
  narrative: string;
  riskFactors: string[];
  nextActions: string[];
  outcome: string; // ai_generated | fallback_rules | error
  errorMessage: string | null;
  modelHint: string | null;
  engineVersion: string;
  generatedAtIso: string;
}

type EnrichBody = { ok: true; data: { enrichment: EnrichmentView | null } } | { ok: false; error: string; hint?: string };

const OUTCOME_BADGE: Record<string, string> = {
  ai_generated:    "bg-violet-500/15 text-violet-300 border-white/[0.10]",
  fallback_rules:  "bg-amber-500/15 text-amber-300 border-amber-500/25",
  error:           "bg-rose-500/15 text-rose-300 border-rose-500/25",
};

function AiRationaleCard({ decisionId }: { decisionId: string }) {
  const [enrichment, setEnrichment] = useState<EnrichmentView | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/dashboard/council-rationale-read?decisionId=${encodeURIComponent(decisionId)}`, { credentials: "include" });
        const j: EnrichBody = await res.json();
        if (cancelled) return;
        if (j.ok) setEnrichment(j.data.enrichment);
      } catch { /* swallow — fall through to no-data state */ }
      finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, [decisionId]);

  async function generate() {
    setGenerating(true);
    setErr(null);
    try {
      const res = await fetch("/api/dashboard/council-rationale-enrich", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decisionId }),
      });
      const j: EnrichBody = await res.json();
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
      <div className="mb-3 rounded-lg border border-white/[0.06] bg-white/[0.015] p-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-[11px] font-mono text-white">
            <SparklesIcon className="h-3.5 w-3.5" />
            <span>AI rationale not generated yet</span>
          </div>
          <button
            type="button"
            onClick={generate}
            disabled={generating}
            className="px-2 py-1 rounded border border-violet-500/40 bg-violet-500/[0.12] text-[10.5px] font-semibold text-violet-100 hover:bg-violet-500/[0.20] disabled:opacity-50 disabled:cursor-wait transition-colors"
          >
            {generating ? "Generating…" : "Generate why-this"}
          </button>
        </div>
        {err && <p className="mt-1.5 text-[10.5px] font-mono text-rose-300">✗ {err}</p>}
      </div>
    );
  }

  return (
    <div className="mb-3 rounded-lg border border-white/[0.06] bg-white/[0.015] p-3">
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border border-white/[0.12] bg-white/[0.04] text-white">
          <SparklesIcon className="h-3 w-3" /> AI rationale
        </span>
        <span className={`text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border ${OUTCOME_BADGE[enrichment.outcome] ?? OUTCOME_BADGE.error}`}>
          {enrichment.outcome}
        </span>
        {enrichment.modelHint && (
          <span className="text-[10px] font-mono text-zinc-500">model: {enrichment.modelHint}</span>
        )}
        <span className="text-[10px] font-mono text-zinc-500 ml-auto">{new Date(enrichment.generatedAtIso).toLocaleString()}</span>
        <button
          type="button"
          onClick={generate}
          disabled={generating}
          className="text-[10.5px] font-mono text-zinc-300 hover:text-white disabled:opacity-50 disabled:cursor-wait"
        >
          {generating ? "Regenerating…" : "Regenerate"}
        </button>
      </div>
      <p className="text-[12.5px] text-zinc-200 mb-2.5">{enrichment.narrative}</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <div>
          <p className="text-[9.5px] font-mono uppercase tracking-wider text-zinc-500 mb-1">Risk factors</p>
          <ul className="space-y-0.5">
            {enrichment.riskFactors.map((r, i) => (
              <li key={i} className="text-[11.5px] text-zinc-300 flex gap-1.5"><span className="text-rose-400">•</span><span>{r}</span></li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-[9.5px] font-mono uppercase tracking-wider text-zinc-500 mb-1">Next actions</p>
          <ul className="space-y-0.5">
            {enrichment.nextActions.map((a, i) => (
              <li key={i} className="text-[11.5px] text-zinc-300 flex gap-1.5"><span className="text-emerald-400">→</span><span>{a}</span></li>
            ))}
          </ul>
        </div>
      </div>
      {enrichment.outcome !== "ai_generated" && enrichment.errorMessage && (
        <p className="mt-2 text-[10.5px] font-mono text-amber-300">↳ {enrichment.errorMessage}</p>
      )}
      {err && <p className="mt-1.5 text-[10.5px] font-mono text-rose-300">✗ {err}</p>}
    </div>
  );
}
