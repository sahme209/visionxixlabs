import { useEffect, useMemo, useState } from "react";
import { ViewShell } from "../components/Primitives";

/**
 * AGI Memory — Phase 521 desktop sibling.
 *
 * Cross-engine list of every Claude-generated rationale enrichment.
 * Mirrors /dashboard/agi-memory.
 */

const TARGET_KINDS = ["council", "triage", "remediation"] as const;
type TargetKind = (typeof TARGET_KINDS)[number];

interface Entry {
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

interface MemoryData {
  generatedAt: string;
  entries: Entry[];
  summary: {
    total: number;
    aiGenerated: number;
    fallbackRules: number;
    errored: number;
    byTargetKind: Record<string, number>;
    modelsUsed: string[];
  };
}

type Body = { ok: true; data: MemoryData } | { ok: false; error: string; hint?: string };

const KIND_LABEL: Record<string, string> = {
  council: "Council",
  triage: "Triage",
  remediation: "Remediation",
};

const OUTCOME_CLASS: Record<string, string> = {
  ai_generated:    "bg-violet-500/15 text-violet-300 border-violet-500/25",
  fallback_rules:  "bg-amber-500/15 text-amber-300 border-amber-500/25",
  error:           "bg-rose-500/15 text-rose-300 border-rose-500/25",
};

export function AgiMemoryView() {
  const [resp, setResp] = useState<Body | null>(null);
  const [loading, setLoading] = useState(true);
  const [networkError, setNetworkError] = useState<string | null>(null);
  const [filterKind, setFilterKind] = useState<TargetKind | "all">("all");

  function load(kind: TargetKind | "all" = filterKind) {
    setLoading(true);
    setNetworkError(null);
    const qs = kind === "all" ? "" : `?targetKind=${encodeURIComponent(kind)}`;
    fetch(`/api/dashboard/agi-memory-list${qs}`, { credentials: "include" })
      .then((r) => r.json())
      .then((j: Body) => setResp(j))
      .catch((e) => setNetworkError(e instanceof Error ? e.message : "Network error."))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(filterKind); }, [filterKind]);

  const data = resp?.ok ? resp.data : null;
  const errorBody = resp && !resp.ok ? resp : null;
  const aiShare = useMemo(() => {
    if (!data || data.summary.total === 0) return 0;
    return Math.round((data.summary.aiGenerated / data.summary.total) * 100);
  }, [data]);

  return (
    <ViewShell>
      <div>
        <h1 className="text-xl font-bold tracking-tight">AGI memory</h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          Every Claude-generated rationale, across council + triage + remediation. {data ? `${data.summary.total} entries · ${aiShare}% AI · ${data.summary.modelsUsed.length} models seen.` : ""}
        </p>
      </div>

      {data && (
        <div className="grid grid-cols-4 gap-2">
          <Stat label="Total" value={String(data.summary.total)} />
          <Stat label="AI gen" value={String(data.summary.aiGenerated)} tone={data.summary.aiGenerated > 0 ? "violet" : "zinc"} />
          <Stat label="Fallback" value={String(data.summary.fallbackRules)} tone={data.summary.fallbackRules > 0 ? "amber" : "zinc"} />
          <Stat label="Errored" value={String(data.summary.errored)} tone={data.summary.errored > 0 ? "rose" : "zinc"} />
        </div>
      )}

      <SummaryPanel targetKind={filterKind === "all" ? undefined : filterKind} />

      <div className="flex items-center gap-2 flex-wrap">
        <FilterPill label={`All${data ? ` · ${data.summary.total}` : ""}`} active={filterKind === "all"} onClick={() => setFilterKind("all")} />
        {TARGET_KINDS.map((k) => (
          <FilterPill
            key={k}
            label={`${KIND_LABEL[k]}${data ? ` · ${data.summary.byTargetKind[k] ?? 0}` : ""}`}
            active={filterKind === k}
            onClick={() => setFilterKind(k)}
          />
        ))}
        <button
          type="button"
          onClick={() => load(filterKind)}
          className="ml-auto px-2.5 py-1 rounded-md border border-zinc-700/40 bg-zinc-900/40 text-[11px] font-mono text-zinc-300 hover:bg-zinc-800/60"
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {data && data.summary.modelsUsed.length > 0 && (
        <p className="text-[11px] font-mono text-zinc-500">
          models seen: {data.summary.modelsUsed.join(", ")}
        </p>
      )}

      {loading && <div className="glass-card p-4 text-sm text-zinc-400">Loading memory…</div>}

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

      {data && data.entries.length === 0 && (
        <div className="glass-card p-8 text-center text-sm text-zinc-400">
          No AGI memory yet. Run a council, triage, or remediation to start populating this feed.
        </div>
      )}

      {data && data.entries.length > 0 && (
        <div className="space-y-2">
          {data.entries.map((e) => <MemoryRow key={`${e.targetKind}:${e.targetId}`} entry={e} />)}
        </div>
      )}
    </ViewShell>
  );
}

function MemoryRow({ entry }: { entry: Entry }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="glass-card p-3 border border-violet-500/15">
      <div className="flex items-center gap-2 mb-1 flex-wrap">
        <span className="text-[9.5px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border border-violet-500/30 bg-violet-500/[0.10] text-violet-200">
          ✦ {KIND_LABEL[entry.targetKind] ?? entry.targetKind}
        </span>
        <span className={`text-[9.5px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border ${OUTCOME_CLASS[entry.outcome] ?? OUTCOME_CLASS.error}`}>
          {entry.outcome}
        </span>
        {entry.modelHint && <span className="text-[10px] font-mono text-zinc-500">{entry.modelHint}</span>}
        <span className="text-[10px] font-mono text-zinc-500 ml-auto">{new Date(entry.generatedAtIso).toLocaleString()}</span>
      </div>
      <p className="text-[12px] text-zinc-200 mb-1.5">{entry.narrative}</p>
      {(entry.riskFactors.length > 0 || entry.nextActions.length > 0) && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-[10.5px] font-mono text-zinc-400 hover:text-zinc-200"
        >
          {expanded ? "− hide" : `+ ${entry.riskFactors.length} risk · ${entry.nextActions.length} action`}
        </button>
      )}
      {expanded && (
        <div className="mt-1.5 grid grid-cols-1 md:grid-cols-2 gap-2">
          <div>
            <p className="text-[9px] font-mono uppercase tracking-wider text-zinc-500 mb-1">Risk factors</p>
            <ul className="space-y-0.5">
              {entry.riskFactors.map((r, i) => (
                <li key={i} className="text-[11px] text-zinc-300 flex gap-1.5"><span className="text-rose-400">•</span><span>{r}</span></li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-[9px] font-mono uppercase tracking-wider text-zinc-500 mb-1">Next actions</p>
            <ul className="space-y-0.5">
              {entry.nextActions.map((a, i) => (
                <li key={i} className="text-[11px] text-zinc-300 flex gap-1.5"><span className="text-emerald-400">→</span><span>{a}</span></li>
              ))}
            </ul>
          </div>
        </div>
      )}
      {entry.outcome !== "ai_generated" && entry.errorMessage && (
        <p className="mt-1 text-[10px] font-mono text-amber-300">↳ {entry.errorMessage}</p>
      )}
      <p className="mt-0.5 text-[9.5px] font-mono text-zinc-600">{entry.targetKind} · {entry.targetId} · {entry.engineVersion}</p>
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

function Stat({ label, value, tone = "zinc" }: { label: string; value: string; tone?: "violet" | "amber" | "rose" | "zinc" }) {
  const cls = {
    violet:  "border-violet-500/30 text-violet-200",
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

/* ──────────────────────────────────────────────────────────────────
   SummaryPanel — Phase 522 desktop sibling.
   ────────────────────────────────────────────────────────────── */

interface MemorySummary {
  outcome: string;
  narrative: string;
  themes: string[];
  notableEntries: string[];
  aiAvailabilityPct: number;
  windowSize: number;
  modelHint: string | null;
  errorMessage: string | null;
  engineVersion: string;
}

type SummaryBody = { ok: true; data: { generatedAt: string; summary: MemorySummary } } | { ok: false; error: string; hint?: string };

function SummaryPanel({ targetKind }: { targetKind?: string }) {
  const [summary, setSummary] = useState<MemorySummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function generate() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/dashboard/agi-memory-summarize", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ take: 50, ...(targetKind ? { targetKind } : {}) }),
      });
      const j: SummaryBody = await res.json();
      if (j.ok) setSummary(j.data.summary);
      else setErr(j.hint ?? j.error);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "network error");
    } finally {
      setBusy(false);
    }
  }

  if (!summary) {
    return (
      <div className="glass-card p-3 border border-violet-500/20 flex items-center justify-between gap-3">
        <span className="text-[12px] text-violet-100">
          <span className="font-semibold">Ask the AGI to summarize itself</span>
          <span className="text-zinc-400"> — Claude reads recent entries and reports patterns.</span>
        </span>
        <button
          type="button"
          onClick={generate}
          disabled={busy}
          className="px-3 py-1 rounded-md border border-violet-500/40 bg-violet-500/[0.12] text-[12px] font-semibold text-violet-100 hover:bg-violet-500/[0.20] disabled:opacity-50 disabled:cursor-wait"
        >
          {busy ? "Summarizing…" : "Summarize recent thinking"}
        </button>
        {err && <span className="text-[11px] font-mono text-rose-300">✗ {err}</span>}
      </div>
    );
  }

  return (
    <div className="glass-card p-3 border border-violet-500/25">
      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
        <span className="text-[9.5px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border border-violet-500/30 bg-violet-500/[0.10] text-violet-200">
          ✦ AGI meta-summary
        </span>
        <span className={`text-[9.5px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border ${OUTCOME_CLASS[summary.outcome] ?? OUTCOME_CLASS.error}`}>
          {summary.outcome}
        </span>
        {summary.modelHint && <span className="text-[10px] font-mono text-zinc-500">{summary.modelHint}</span>}
        <span className="text-[10px] font-mono text-zinc-500">window: {summary.windowSize} · {summary.aiAvailabilityPct}% AI</span>
        <button
          type="button"
          onClick={generate}
          disabled={busy}
          className="ml-auto text-[11px] font-mono text-violet-300 hover:text-violet-200 disabled:opacity-50 disabled:cursor-wait"
        >
          {busy ? "Regen…" : "Regen"}
        </button>
      </div>
      <p className="text-[12.5px] text-zinc-200 mb-2">{summary.narrative}</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <div>
          <p className="text-[9px] font-mono uppercase tracking-wider text-zinc-500 mb-1">Themes</p>
          <ul className="space-y-0.5">
            {summary.themes.map((t, i) => (
              <li key={i} className="text-[11.5px] text-zinc-300 flex gap-1.5"><span className="text-violet-400">◉</span><span>{t}</span></li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-[9px] font-mono uppercase tracking-wider text-zinc-500 mb-1">Notable entries / next moves</p>
          <ul className="space-y-0.5">
            {summary.notableEntries.map((n, i) => (
              <li key={i} className="text-[11.5px] text-zinc-300 flex gap-1.5"><span className="text-emerald-400">→</span><span>{n}</span></li>
            ))}
          </ul>
        </div>
      </div>
      {summary.outcome !== "ai_generated" && summary.errorMessage && (
        <p className="mt-1.5 text-[10px] font-mono text-amber-300">↳ {summary.errorMessage}</p>
      )}
      {err && <p className="mt-1 text-[10.5px] font-mono text-rose-300">✗ {err}</p>}
    </div>
  );
}
