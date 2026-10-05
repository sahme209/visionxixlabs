"use client";

/**
 * /dashboard/agi-suggestions — Phase 525.
 *
 * The AGI is proactive: scrolls the rationale memory + meta-summaries
 * and proposes concrete operator next-actions ("review release rel_42 —
 * repeat block pattern detected"). Operator acts or dismisses; the
 * decision feeds the audit log.
 */

import { useEffect, useState } from "react";
import {
  SparklesIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  ArrowRightIcon,
} from "@heroicons/react/24/outline";
import { PageIntro } from "@/components/dashboard/PageIntro";
import { SurfaceExplainer } from "../SurfaceExplainer";

type Kind =
  | "review_release"
  | "tighten_protection"
  | "reconcile_manual_fix"
  | "investigate_incident"
  | "reduce_fallback_rate"
  | "review_pattern"
  | "no_action_needed"
  | "unknown";

type Decision = "pending" | "acted" | "dismissed" | "unknown";
type Outcome = "ai_generated" | "fallback_rules" | "error" | "unknown";

interface Suggestion {
  id: string;
  kind: Kind;
  title: string;
  rationale: string;
  targetKind: string | null;
  targetId: string | null;
  confidence: number;
  citations: string[];
  operatorDecision: Decision;
  decidedAtIso: string | null;
  decisionNote: string | null;
  outcome: Outcome;
  errorMessage: string | null;
  modelHint: string | null;
  engineVersion: string;
  windowSize: number;
  generatedAtIso: string;
}

interface ListData {
  generatedAt: string;
  suggestions: Suggestion[];
  summary: { total: number; pending: number; acted: number; dismissed: number; aiGenerated: number; fallbackRules: number };
}
type ListBody = { ok: true; data: ListData } | { ok: false; error: string; hint?: string };

interface GenerateData { generatedAt: string; suggestions: Suggestion[]; supersededCount: number; outcome: string; modelHint: string | null }
type GenerateBody = { ok: true; data: GenerateData } | { ok: false; error: string; hint?: string };

const KIND_LABEL: Record<string, string> = {
  review_release: "Review release",
  tighten_protection: "Tighten branch protection",
  reconcile_manual_fix: "Reconcile manual fix",
  investigate_incident: "Investigate incident",
  reduce_fallback_rate: "Reduce AI fallback rate",
  review_pattern: "Review pattern",
  no_action_needed: "No action needed",
  unknown: "Unknown",
};

const KIND_TONE: Record<string, string> = {
  review_release:       "border-white/[0.12] bg-white/[0.015]",
  tighten_protection:   "border-rose-500/30 bg-rose-500/[0.04]",
  reconcile_manual_fix: "border-amber-500/30 bg-amber-500/[0.04]",
  investigate_incident: "border-rose-500/30 bg-rose-500/[0.04]",
  reduce_fallback_rate: "border-amber-500/30 bg-amber-500/[0.04]",
  review_pattern:       "border-white/[0.12] bg-white/[0.015]",
  no_action_needed:     "border-emerald-500/30 bg-emerald-500/[0.04]",
  unknown:              "border-white/[0.06] bg-white/[0.02]",
};

const DECISION_CLASS: Record<Decision, string> = {
  pending:    "bg-violet-500/15 text-violet-300 border-white/[0.10]",
  acted:      "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
  dismissed:  "bg-zinc-700/40 text-zinc-300 border-zinc-700/40",
  unknown:    "bg-zinc-700/40 text-zinc-400 border-zinc-700/40",
};

const OUTCOME_CLASS: Record<string, string> = {
  ai_generated:   "bg-violet-500/15 text-violet-300 border-white/[0.10]",
  fallback_rules: "bg-amber-500/15 text-amber-300 border-amber-500/25",
  error:          "bg-rose-500/15 text-rose-300 border-rose-500/25",
  unknown:        "bg-zinc-700/40 text-zinc-400 border-zinc-700/40",
};

const KIND_HREF: Record<string, string> = {
  release: "/dashboard/releases",
  council: "/dashboard/advisor-council",
  triage:  "/dashboard/incident-triage",
  remediation: "/dashboard/remediation-proposals",
  repo: "/dashboard/repositories",
};

function confidenceClass(c: number): string {
  if (c >= 80) return "bg-emerald-500/15 text-emerald-300 border-emerald-500/25";
  if (c >= 60) return "bg-amber-500/15 text-amber-300 border-amber-500/25";
  return "bg-rose-500/15 text-rose-300 border-rose-500/25";
}

export default function AgiSuggestionsPage() {
  const [resp, setResp] = useState<ListBody | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Decision | "all">("pending");
  const [networkError, setNetworkError] = useState<string | null>(null);
  const [genBusy, setGenBusy] = useState(false);
  const [genResult, setGenResult] = useState<{ outcome: string; count: number; superseded: number; modelHint: string | null } | null>(null);
  const [genError, setGenError] = useState<string | null>(null);

  function load(decision: Decision | "all" = filter) {
    setLoading(true);
    setNetworkError(null);
    const qs = decision === "all" ? "" : `?operatorDecision=${encodeURIComponent(decision)}`;
    fetch(`/api/dashboard/agi-suggestions-list${qs}`, { credentials: "include" })
      .then((r) => r.json())
      .then((j: ListBody) => setResp(j))
      .catch((e) => setNetworkError(e instanceof Error ? e.message : "Network error."))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(filter); }, [filter]);

  async function generate() {
    setGenBusy(true);
    setGenError(null);
    setGenResult(null);
    try {
      const res = await fetch("/api/dashboard/agi-suggestions-generate", { method: "POST", credentials: "include" });
      const j: GenerateBody = await res.json();
      if (j.ok) {
        setGenResult({ outcome: j.data.outcome, count: j.data.suggestions.length, superseded: j.data.supersededCount, modelHint: j.data.modelHint });
        load(filter);
      } else {
        setGenError(j.hint ?? j.error);
      }
    } catch (e) {
      setGenError(e instanceof Error ? e.message : "network error");
    } finally {
      setGenBusy(false);
    }
  }

  const data = resp?.ok ? resp.data : null;
  const errorBody = resp && !resp.ok ? resp : null;

  return (
    <div className="relative">
      <SurfaceExplainer surface="agi-suggestions" />
      <PageIntro
        kicker={`AGI cockpit · proactive suggestions${data ? ` · ${data.summary.pending} pending` : ""}`}
        title={<>The AGI proposes <span className="text-zinc-500">your next moves.</span></>}
        description="Claude scrolls the last 100 rationale entries + 20 meta-summaries and proposes concrete operator next-actions — review a release, tighten branch protection, investigate a triage, reduce fallback rate. Each suggestion is deep-linked to the source surface and citations back to the memory entries that triggered it."
        helps="Click Generate suggestions to run the proactive engine. Act on a pending suggestion to mark it done; dismiss to take it off the queue. Decisions feed the audit log so we can learn which suggestion kinds the operator finds valuable."
        connectFirst="Have at least a few rationale entries in memory (run any AGI engine first)."
        engineers={["AI Operations", "Release engineers", "Platform leads"]}
        requiresApproval="Operator decision is captured but suggestions are non-blocking · no automated writes to external systems"
        actions={[
          { label: "Open AGI memory", href: "/dashboard/agi-memory" },
          { label: "Open advisor council", href: "/dashboard/advisor-council" },
        ]}
        safetyNote="Each suggestion supersedes prior pending · citations link back to source decisions · operator note recorded on every act/dismiss"
      />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={generate}
          disabled={genBusy}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-violet-500/40 bg-violet-500/[0.14] text-[12px] font-semibold text-violet-100 hover:bg-violet-500/[0.22] disabled:opacity-50 disabled:cursor-wait transition-colors"
        >
          <SparklesIcon className={`h-4 w-4 ${genBusy ? "animate-spin" : ""}`} />
          {genBusy ? "Generating…" : "Generate suggestions"}
        </button>
        {genResult && (
          <span className="text-[11.5px] font-mono text-emerald-300">
            ✓ {genResult.count} suggestion{genResult.count === 1 ? "" : "s"} · {genResult.outcome}{genResult.modelHint ? ` · ${genResult.modelHint}` : ""}{genResult.superseded > 0 ? ` · superseded ${genResult.superseded}` : ""}
          </span>
        )}
        {genError && <span className="text-[11.5px] font-mono text-rose-300">✗ {genError}</span>}
      </div>

      {data && (
        <div className="mb-5 grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat icon={SparklesIcon} label="Pending" value={String(data.summary.pending)} tone={data.summary.pending > 0 ? "violet" : "zinc"} />
          <Stat icon={CheckCircleIcon} label="Acted" value={String(data.summary.acted)} tone={data.summary.acted > 0 ? "emerald" : "zinc"} />
          <Stat icon={XCircleIcon} label="Dismissed" value={String(data.summary.dismissed)} tone={data.summary.dismissed > 0 ? "zinc" : "zinc"} />
          <Stat icon={SparklesIcon} label="AI generated" value={`${data.summary.aiGenerated}/${data.summary.total}`} tone={data.summary.aiGenerated > 0 ? "violet" : "zinc"} />
        </div>
      )}

      <div className="mb-4 flex items-center gap-2 flex-wrap">
        <FilterPill label={`Pending${data ? ` · ${data.summary.pending}` : ""}`} active={filter === "pending"} onClick={() => setFilter("pending")} />
        <FilterPill label={`Acted${data ? ` · ${data.summary.acted}` : ""}`} active={filter === "acted"} onClick={() => setFilter("acted")} />
        <FilterPill label={`Dismissed${data ? ` · ${data.summary.dismissed}` : ""}`} active={filter === "dismissed"} onClick={() => setFilter("dismissed")} />
        <FilterPill label={`All${data ? ` · ${data.summary.total}` : ""}`} active={filter === "all"} onClick={() => setFilter("all")} />
        <button
          type="button"
          onClick={() => load(filter)}
          className="ml-auto inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-white/[0.08] bg-white/[0.02] text-[11px] font-mono text-zinc-300 hover:bg-white/[0.06] transition-colors"
        >
          <ArrowPathIcon className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {loading && <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 mb-4 text-[12px] text-zinc-400">Loading suggestions…</div>}

      {!loading && networkError && (
        <div role="alert" aria-live="assertive" className="rounded-2xl border border-rose-500/[0.18] bg-rose-500/[0.04] p-5 mb-4 text-[13px] text-zinc-300">{networkError}</div>
      )}

      {!loading && errorBody?.error === "migration_pending" && (
        <div role="alert" aria-live="assertive" className="rounded-2xl border border-amber-500/[0.18] bg-amber-500/[0.04] p-5 mb-4">
          <div className="flex items-center gap-2 mb-1">
            <ExclamationTriangleIcon className="h-4 w-4 text-amber-300" />
            <p className="text-[12px] font-semibold text-amber-200">Schema migration pending</p>
          </div>
          <p className="text-[12.5px] text-zinc-300">{errorBody.hint}</p>
        </div>
      )}

      {!loading && errorBody?.error === "auth_required" && (
        <div role="alert" aria-live="assertive" className="rounded-2xl border border-amber-500/[0.18] bg-amber-500/[0.04] p-5 mb-4 text-[12.5px] text-amber-200">Sign in required.</div>
      )}

      {data && data.suggestions.length === 0 && (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-10 text-center text-[13px] text-zinc-400">
          {filter === "pending"
            ? "No pending suggestions. Click Generate to run the proactive engine."
            : `No ${filter === "all" ? "" : filter + " "}suggestions yet.`}
        </div>
      )}

      {data && data.suggestions.length > 0 && (
        <div className="space-y-2.5">
          {data.suggestions.map((s) => <SuggestionCard key={s.id} suggestion={s} onChanged={() => load(filter)} />)}
        </div>
      )}
    </div>
  );
}

function SuggestionCard({ suggestion, onChanged }: { suggestion: Suggestion; onChanged: () => void }) {
  const [busy, setBusy] = useState<"act" | "dismiss" | null>(null);
  const [note, setNote] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const deepLink = suggestion.targetKind && KIND_HREF[suggestion.targetKind] ? KIND_HREF[suggestion.targetKind] : null;
  const tone = KIND_TONE[suggestion.kind] ?? KIND_TONE.unknown;

  async function decide(action: "act" | "dismiss") {
    setBusy(action);
    setErr(null);
    try {
      const res = await fetch("/api/dashboard/agi-suggestions-decide", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ suggestionId: suggestion.id, action, ...(note ? { note } : {}) }),
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
    <div className={`rounded-2xl border p-4 ${tone}`}>
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <span className="text-[9.5px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border border-white/[0.08] bg-white/[0.02] text-zinc-200">
          {KIND_LABEL[suggestion.kind] ?? suggestion.kind}
        </span>
        <span className={`text-[9.5px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border ${confidenceClass(suggestion.confidence)}`}>
          {suggestion.confidence}% confident
        </span>
        <span className={`text-[9.5px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border ${DECISION_CLASS[suggestion.operatorDecision]}`}>
          {suggestion.operatorDecision}
        </span>
        <span className={`text-[9.5px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border ${OUTCOME_CLASS[suggestion.outcome] ?? OUTCOME_CLASS.unknown}`}>
          {suggestion.outcome}
        </span>
        {suggestion.modelHint && (
          <span className="text-[10px] font-mono text-zinc-500">model: {suggestion.modelHint}</span>
        )}
        <span className="text-[10px] font-mono text-zinc-500 ml-auto">{new Date(suggestion.generatedAtIso).toLocaleString()}</span>
      </div>

      <p className="text-[14px] font-semibold text-white mb-1.5">{suggestion.title}</p>
      <p className="text-[12.5px] text-zinc-300 mb-2.5">{suggestion.rationale}</p>

      {(suggestion.targetKind || suggestion.targetId) && (
        <p className="text-[11px] font-mono text-zinc-400 mb-2">
          {suggestion.targetKind && <>target: <span className="text-zinc-200">{suggestion.targetKind}</span></>}
          {suggestion.targetId && <span className="text-zinc-200"> · {suggestion.targetId}</span>}
          {deepLink && <a href={deepLink} className="ml-2 inline-flex items-center gap-1 text-zinc-300 hover:text-white">
            open <ArrowRightIcon className="h-3 w-3" />
          </a>}
        </p>
      )}

      {suggestion.citations.length > 0 && (
        <p className="text-[10.5px] font-mono text-zinc-500 mb-2">
          citations: {suggestion.citations.join(", ")}
        </p>
      )}

      {suggestion.decisionNote && (
        <p className="text-[11.5px] font-mono text-zinc-400 mb-2 italic">↳ note: {suggestion.decisionNote}</p>
      )}

      {suggestion.operatorDecision === "pending" && (
        <div className="pt-3 border-t border-white/[0.04] flex items-center gap-2 flex-wrap text-[11px] font-mono">
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="optional note"
            disabled={busy !== null}
            className="flex-1 min-w-[180px] rounded-md border border-white/[0.08] bg-black/30 px-2 py-1 text-[11px] text-zinc-100 placeholder:text-zinc-600 focus:border-violet-500/40 focus:outline-none disabled:opacity-50"
          />
          <button type="button" onClick={() => decide("act")} disabled={busy !== null}
            className="px-2 py-1 rounded border border-emerald-500/30 bg-emerald-500/[0.08] text-emerald-200 hover:bg-emerald-500/[0.16] disabled:opacity-50 disabled:cursor-wait">
            {busy === "act" ? "…" : "Act"}
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

function Stat({ icon: Icon, label, value, tone }: { icon: typeof SparklesIcon; label: string; value: string; tone: "violet" | "emerald" | "amber" | "rose" | "zinc" }) {
  const cls = {
    violet:  "border-white/[0.06] bg-white/[0.015] text-white",
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
