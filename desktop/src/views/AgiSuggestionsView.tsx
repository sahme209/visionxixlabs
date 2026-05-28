import { useEffect, useState } from "react";
import { ViewShell } from "../components/Primitives";

/**
 * AGI Suggestions — Phase 525 desktop sibling.
 *
 * The AGI proposes operator next-actions from rationale memory.
 * Mirrors /dashboard/agi-suggestions.
 */

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
  tighten_protection: "Tighten protection",
  reconcile_manual_fix: "Reconcile manual fix",
  investigate_incident: "Investigate incident",
  reduce_fallback_rate: "Reduce AI fallback",
  review_pattern: "Review pattern",
  no_action_needed: "No action needed",
  unknown: "Unknown",
};

const DECISION_CLASS: Record<Decision, string> = {
  pending:    "bg-violet-500/15 text-violet-300 border-violet-500/25",
  acted:      "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
  dismissed:  "bg-zinc-700/40 text-zinc-300 border-zinc-700/40",
  unknown:    "bg-zinc-700/40 text-zinc-400 border-zinc-700/40",
};

const OUTCOME_CLASS: Record<string, string> = {
  ai_generated:   "bg-violet-500/15 text-violet-300 border-violet-500/25",
  fallback_rules: "bg-amber-500/15 text-amber-300 border-amber-500/25",
  error:          "bg-rose-500/15 text-rose-300 border-rose-500/25",
  unknown:        "bg-zinc-700/40 text-zinc-400 border-zinc-700/40",
};

function confidenceClass(c: number): string {
  if (c >= 80) return "bg-emerald-500/15 text-emerald-300 border-emerald-500/25";
  if (c >= 60) return "bg-amber-500/15 text-amber-300 border-amber-500/25";
  return "bg-rose-500/15 text-rose-300 border-rose-500/25";
}

export function AgiSuggestionsView() {
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
    <ViewShell>
      <div>
        <h1 className="text-xl font-bold tracking-tight">Proactive AGI suggestions</h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          Claude reads recent reasoning + meta-summaries and proposes operator next-actions. Act or dismiss; audit-trailed.
        </p>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={generate}
          disabled={genBusy}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-violet-500/40 bg-violet-500/[0.14] text-[12px] font-semibold text-violet-100 hover:bg-violet-500/[0.22] disabled:opacity-50 disabled:cursor-wait"
        >
          ✦ {genBusy ? "Generating…" : "Generate suggestions"}
        </button>
        {genResult && (
          <span className="text-[11.5px] font-mono text-emerald-300">
            ✓ {genResult.count} · {genResult.outcome}{genResult.modelHint ? ` · ${genResult.modelHint}` : ""}{genResult.superseded > 0 ? ` · superseded ${genResult.superseded}` : ""}
          </span>
        )}
        {genError && <span className="text-[11.5px] font-mono text-rose-300">✗ {genError}</span>}
      </div>

      {data && (
        <div className="grid grid-cols-4 gap-2">
          <Stat label="Pending" value={String(data.summary.pending)} tone={data.summary.pending > 0 ? "violet" : "zinc"} />
          <Stat label="Acted" value={String(data.summary.acted)} tone={data.summary.acted > 0 ? "emerald" : "zinc"} />
          <Stat label="Dismissed" value={String(data.summary.dismissed)} />
          <Stat label="AI gen" value={`${data.summary.aiGenerated}/${data.summary.total}`} tone={data.summary.aiGenerated > 0 ? "violet" : "zinc"} />
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        <FilterPill label={`Pending${data ? ` · ${data.summary.pending}` : ""}`} active={filter === "pending"} onClick={() => setFilter("pending")} />
        <FilterPill label={`Acted${data ? ` · ${data.summary.acted}` : ""}`} active={filter === "acted"} onClick={() => setFilter("acted")} />
        <FilterPill label={`Dismissed${data ? ` · ${data.summary.dismissed}` : ""}`} active={filter === "dismissed"} onClick={() => setFilter("dismissed")} />
        <FilterPill label={`All${data ? ` · ${data.summary.total}` : ""}`} active={filter === "all"} onClick={() => setFilter("all")} />
        <button
          type="button"
          onClick={() => load(filter)}
          className="ml-auto px-2.5 py-1 rounded-md border border-zinc-700/40 bg-zinc-900/40 text-[11px] font-mono text-zinc-300 hover:bg-zinc-800/60"
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {loading && <div className="glass-card p-4 text-sm text-zinc-400">Loading suggestions…</div>}
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

      {data && data.suggestions.length === 0 && (
        <div className="glass-card p-8 text-center text-sm text-zinc-400">
          {filter === "pending"
            ? "No pending suggestions. Click Generate to run the proactive engine."
            : `No ${filter === "all" ? "" : filter + " "}suggestions yet.`}
        </div>
      )}

      {data && data.suggestions.length > 0 && (
        <div className="space-y-2">
          {data.suggestions.map((s) => <SuggestionCard key={s.id} suggestion={s} onChanged={() => load(filter)} />)}
        </div>
      )}
    </ViewShell>
  );
}

function SuggestionCard({ suggestion, onChanged }: { suggestion: Suggestion; onChanged: () => void }) {
  const [busy, setBusy] = useState<"act" | "dismiss" | null>(null);
  const [note, setNote] = useState("");
  const [err, setErr] = useState<string | null>(null);

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
    <div className="glass-card p-3 border border-violet-500/20">
      <div className="flex items-center gap-2 mb-1 flex-wrap">
        <span className="text-[9.5px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border border-zinc-700/40 bg-zinc-800/40 text-zinc-200">
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
        {suggestion.modelHint && <span className="text-[10px] font-mono text-zinc-500">{suggestion.modelHint}</span>}
        <span className="text-[10px] font-mono text-zinc-500 ml-auto">{new Date(suggestion.generatedAtIso).toLocaleString()}</span>
      </div>
      <p className="text-sm font-semibold text-white">{suggestion.title}</p>
      <p className="text-[12px] text-zinc-300 mt-1">{suggestion.rationale}</p>

      {(suggestion.targetKind || suggestion.targetId) && (
        <p className="text-[10.5px] font-mono text-zinc-500 mt-1">
          {suggestion.targetKind && <>target: <span className="text-zinc-300">{suggestion.targetKind}</span></>}
          {suggestion.targetId && <span className="text-zinc-300"> · {suggestion.targetId}</span>}
        </p>
      )}
      {suggestion.citations.length > 0 && (
        <p className="text-[10px] font-mono text-zinc-500 mt-1">citations: {suggestion.citations.join(", ")}</p>
      )}
      {suggestion.decisionNote && (
        <p className="text-[11px] font-mono text-zinc-400 mt-1 italic">↳ {suggestion.decisionNote}</p>
      )}

      {suggestion.operatorDecision === "pending" && (
        <div className="mt-2 pt-2 border-t border-white/[0.04] flex items-center gap-2 flex-wrap text-[11px] font-mono">
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="optional note"
            disabled={busy !== null}
            className="flex-1 min-w-[140px] rounded border border-zinc-700/40 bg-zinc-900/60 px-2 py-1 text-[11px] text-zinc-100 placeholder:text-zinc-600 focus:border-violet-500/40 focus:outline-none disabled:opacity-50"
          />
          <button type="button" onClick={() => decide("act")} disabled={busy !== null}
            className="px-2 py-1 rounded border border-emerald-500/30 bg-emerald-500/[0.10] text-emerald-200 hover:bg-emerald-500/[0.18] disabled:opacity-50 disabled:cursor-wait">
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

function Stat({ label, value, tone = "zinc" }: { label: string; value: string; tone?: "violet" | "emerald" | "amber" | "rose" | "zinc" }) {
  const cls = {
    violet:  "border-violet-500/30 text-violet-200",
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
