"use client";

/**
 * /dashboard/agi-memory — Phase 521.
 *
 * Unified cross-engine AGI memory: every Claude-generated rationale
 * across council, triage, remediation, ... in one chronological feed.
 * Proof that the AGI platform is reasoning continuously. Filter by
 * surface, drill into any entry's narrative + risk factors + next
 * actions.
 */

import { useEffect, useMemo, useState } from "react";
import {
  SparklesIcon,
  CpuChipIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";
import { PageIntro } from "@/components/dashboard/PageIntro";

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

const KIND_HREF: Record<string, string> = {
  council: "/dashboard/advisor-council",
  triage: "/dashboard/incident-triage",
  remediation: "/dashboard/remediation-proposals",
};

const OUTCOME_CLASS: Record<string, string> = {
  ai_generated:    "bg-violet-500/15 text-violet-300 border-violet-500/25",
  fallback_rules:  "bg-amber-500/15 text-amber-300 border-amber-500/25",
  error:           "bg-rose-500/15 text-rose-300 border-rose-500/25",
};

export default function AgiMemoryPage() {
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
    <div className="relative">
      <PageIntro
        kicker={`AGI cockpit · cross-engine memory${data ? ` · ${data.summary.total} entries · ${aiShare}% AI` : ""}`}
        title={<>Every reasoning step <span className="text-zinc-500">the AGI has taken.</span></>}
        description="The unified Claude-rationale feed across council consensus decisions, incident-triage routings, and remediation proposals. Each entry shows the AI's narrative, the risk factors it surfaced, and the next actions it proposed. Filter by surface, click through to the source decision."
        helps="Use this view to audit the AGI's reasoning over time, spot patterns in the AI's behaviour, and gauge how often the AI provider is available versus how often we fall back to deterministic rules."
        connectFirst="Generate a council decision, an incident triage, or a remediation proposal — each writes an enrichment entry here."
        engineers={["AI Operations", "Platform team", "Heads of Engineering"]}
        requiresApproval="Read-only · no operator actions · audit-trail style feed"
        actions={[
          { label: "Open advisor council", href: "/dashboard/advisor-council" },
          { label: "Open incident triage", href: "/dashboard/incident-triage" },
          { label: "Open remediation", href: "/dashboard/remediation-proposals" },
        ]}
        safetyNote="One row per (surface, decision) pair · upserted on regenerate · pinned engine version per row"
      />

      {data && (
        <div className="mb-5 grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat icon={CpuChipIcon} label="Total entries" value={String(data.summary.total)} tone="zinc" />
          <Stat icon={SparklesIcon} label="AI generated" value={String(data.summary.aiGenerated)} tone={data.summary.aiGenerated > 0 ? "violet" : "zinc"} />
          <Stat icon={ExclamationTriangleIcon} label="Fallback (rules)" value={String(data.summary.fallbackRules)} tone={data.summary.fallbackRules > 0 ? "amber" : "zinc"} />
          <Stat icon={XCircleIcon} label="Errored" value={String(data.summary.errored)} tone={data.summary.errored > 0 ? "rose" : "zinc"} />
        </div>
      )}

      <SummaryPanel targetKind={filterKind === "all" ? undefined : filterKind} />

      <ChatPanel targetKind={filterKind === "all" ? undefined : filterKind} />

      <SummaryTimeline filterKind={filterKind} />

      <div className="mb-4 flex items-center gap-2 flex-wrap">
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
          className="ml-auto inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-white/[0.08] bg-white/[0.02] text-[11px] font-mono text-zinc-300 hover:bg-white/[0.06] transition-colors"
        >
          <ArrowPathIcon className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {data && data.summary.modelsUsed.length > 0 && (
        <p className="mb-4 text-[11px] font-mono text-zinc-500">
          models seen: {data.summary.modelsUsed.join(", ")}
        </p>
      )}

      {loading && <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 mb-4 text-[12px] text-zinc-400">Loading memory…</div>}

      {!loading && networkError && (
        <div className="rounded-2xl border border-rose-500/[0.18] bg-rose-500/[0.04] p-5 mb-4 text-[13px] text-zinc-300">{networkError}</div>
      )}

      {!loading && errorBody?.error === "migration_pending" && (
        <div className="rounded-2xl border border-amber-500/[0.18] bg-amber-500/[0.04] p-5 mb-4">
          <div className="flex items-center gap-2 mb-1">
            <ExclamationTriangleIcon className="h-4 w-4 text-amber-300" />
            <p className="text-[12px] font-semibold text-amber-200">Schema migration pending</p>
          </div>
          <p className="text-[12.5px] text-zinc-300">{errorBody.hint}</p>
        </div>
      )}

      {!loading && errorBody?.error === "auth_required" && (
        <div className="rounded-2xl border border-amber-500/[0.18] bg-amber-500/[0.04] p-5 mb-4 text-[12.5px] text-amber-200">Sign in required.</div>
      )}

      {data && data.entries.length === 0 && (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-10 text-center text-[13px] text-zinc-400">
          No AGI memory yet — run a council decision, a triage, or a remediation to start filling this feed.
        </div>
      )}

      {data && data.entries.length > 0 && (
        <div className="space-y-2.5">
          {data.entries.map((e) => <MemoryRow key={`${e.targetKind}:${e.targetId}`} entry={e} />)}
        </div>
      )}
    </div>
  );
}

function MemoryRow({ entry }: { entry: Entry }) {
  const [expanded, setExpanded] = useState(false);
  const href = KIND_HREF[entry.targetKind];

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
        <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border border-violet-500/30 bg-violet-500/[0.10] text-violet-200">
          <SparklesIcon className="h-3 w-3" /> {KIND_LABEL[entry.targetKind] ?? entry.targetKind}
        </span>
        <span className={`text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border ${OUTCOME_CLASS[entry.outcome] ?? OUTCOME_CLASS.error}`}>
          {entry.outcome === "ai_generated" && <CheckCircleIcon className="h-3 w-3 inline mr-0.5" />}
          {entry.outcome}
        </span>
        {entry.modelHint && <span className="text-[10px] font-mono text-zinc-500">model: {entry.modelHint}</span>}
        <span className="text-[10px] font-mono text-zinc-500 ml-auto">{new Date(entry.generatedAtIso).toLocaleString()}</span>
        {href && (
          <a href={href} className="text-[10.5px] font-mono text-violet-300 hover:text-violet-200">
            open →
          </a>
        )}
      </div>
      <p className="text-[12.5px] text-zinc-200 mb-2">{entry.narrative}</p>
      {(entry.riskFactors.length > 0 || entry.nextActions.length > 0) && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-[10.5px] font-mono text-zinc-400 hover:text-zinc-200"
        >
          {expanded ? "− hide details" : `+ show ${entry.riskFactors.length} risk · ${entry.nextActions.length} action`}
        </button>
      )}
      {expanded && (
        <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
          <div>
            <p className="text-[9.5px] font-mono uppercase tracking-wider text-zinc-500 mb-1">Risk factors</p>
            <ul className="space-y-0.5">
              {entry.riskFactors.map((r, i) => (
                <li key={i} className="text-[11.5px] text-zinc-300 flex gap-1.5"><span className="text-rose-400">•</span><span>{r}</span></li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-[9.5px] font-mono uppercase tracking-wider text-zinc-500 mb-1">Next actions</p>
            <ul className="space-y-0.5">
              {entry.nextActions.map((a, i) => (
                <li key={i} className="text-[11.5px] text-zinc-300 flex gap-1.5"><span className="text-emerald-400">→</span><span>{a}</span></li>
              ))}
            </ul>
          </div>
        </div>
      )}
      {entry.outcome !== "ai_generated" && entry.errorMessage && (
        <p className="mt-1.5 text-[10.5px] font-mono text-amber-300">↳ {entry.errorMessage}</p>
      )}
      <p className="mt-1 text-[10px] font-mono text-zinc-600">{entry.targetKind} · {entry.targetId} · {entry.engineVersion}</p>
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

function Stat({ icon: Icon, label, value, tone }: { icon: typeof SparklesIcon; label: string; value: string; tone: "violet" | "amber" | "rose" | "zinc" }) {
  const cls = {
    violet:  "border-violet-500/[0.18] bg-violet-500/[0.03] text-violet-200",
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

/* ──────────────────────────────────────────────────────────────────
   SummaryPanel — Phase 522 (Claude summarizes recent AGI thinking).
   ────────────────────────────────────────────────────────────── */

interface MemorySummary {
  outcome: string; // ai_generated | fallback_rules | error
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
      <div className="mb-4 rounded-2xl border border-violet-500/[0.20] bg-violet-500/[0.04] p-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <SparklesIcon className="h-4 w-4 text-violet-300" />
          <p className="text-[12.5px] text-violet-100">
            <span className="font-semibold">Ask the AGI to summarize itself</span>
            <span className="text-zinc-400"> — Claude reads the most recent 50 entries and reports patterns + recommendations.</span>
          </p>
        </div>
        <button
          type="button"
          onClick={generate}
          disabled={busy}
          className="px-3 py-1.5 rounded-md border border-violet-500/40 bg-violet-500/[0.14] text-[12px] font-semibold text-violet-100 hover:bg-violet-500/[0.22] disabled:opacity-50 disabled:cursor-wait transition-colors"
        >
          {busy ? "Summarizing…" : "Summarize recent thinking"}
        </button>
        {err && <span className="text-[11px] font-mono text-rose-300">✗ {err}</span>}
      </div>
    );
  }

  return (
    <div className="mb-4 rounded-2xl border border-violet-500/[0.22] bg-violet-500/[0.05] p-4">
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border border-violet-500/30 bg-violet-500/[0.10] text-violet-200">
          <SparklesIcon className="h-3 w-3" /> AGI meta-summary
        </span>
        <span className={`text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border ${OUTCOME_CLASS[summary.outcome] ?? OUTCOME_CLASS.error}`}>
          {summary.outcome}
        </span>
        {summary.modelHint && <span className="text-[10px] font-mono text-zinc-500">model: {summary.modelHint}</span>}
        <span className="text-[10px] font-mono text-zinc-500">window: {summary.windowSize} entries · {summary.aiAvailabilityPct}% AI</span>
        <button
          type="button"
          onClick={generate}
          disabled={busy}
          className="ml-auto text-[11px] font-mono text-violet-300 hover:text-violet-200 disabled:opacity-50 disabled:cursor-wait"
        >
          {busy ? "Regenerating…" : "Regenerate"}
        </button>
      </div>
      <p className="text-[13px] text-zinc-200 mb-2.5">{summary.narrative}</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <p className="text-[9.5px] font-mono uppercase tracking-wider text-zinc-500 mb-1">Themes</p>
          <ul className="space-y-0.5">
            {summary.themes.map((t, i) => (
              <li key={i} className="text-[12px] text-zinc-300 flex gap-1.5"><span className="text-violet-400">◉</span><span>{t}</span></li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-[9.5px] font-mono uppercase tracking-wider text-zinc-500 mb-1">Notable entries / next moves</p>
          <ul className="space-y-0.5">
            {summary.notableEntries.map((n, i) => (
              <li key={i} className="text-[12px] text-zinc-300 flex gap-1.5"><span className="text-emerald-400">→</span><span>{n}</span></li>
            ))}
          </ul>
        </div>
      </div>
      {summary.outcome !== "ai_generated" && summary.errorMessage && (
        <p className="mt-2 text-[10.5px] font-mono text-amber-300">↳ {summary.errorMessage}</p>
      )}
      {err && <p className="mt-2 text-[10.5px] font-mono text-rose-300">✗ {err}</p>}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────
   SummaryTimeline — Phase 523 (persisted AGI summary trajectory).
   ────────────────────────────────────────────────────────────── */

interface TimelineSummary {
  id: string;
  targetKind: string | null;
  narrative: string;
  themes: string[];
  notableEntries: string[];
  outcome: string;
  errorMessage: string | null;
  modelHint: string | null;
  windowSize: number;
  aiAvailabilityPct: number;
  engineVersion: string;
  generatedAtIso: string;
}

interface TimelineData {
  generatedAt: string;
  entries: TimelineSummary[];
  summary: { total: number; aiGenerated: number; fallbackRules: number; errored: number };
}

type TimelineBody = { ok: true; data: TimelineData } | { ok: false; error: string; hint?: string };

function SummaryTimeline({ filterKind }: { filterKind: TargetKind | "all" }) {
  const [resp, setResp] = useState<TimelineBody | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    // For filterKind=all, query without targetKind to show all summaries
    // (across scopes). For a specific kind, scope the timeline to it.
    const qs = filterKind === "all" ? "?take=20" : `?targetKind=${encodeURIComponent(filterKind)}&take=20`;
    fetch(`/api/dashboard/agi-memory-timeline${qs}`, { credentials: "include" })
      .then((r) => r.json())
      .then((j: TimelineBody) => setResp(j))
      .catch(() => { /* swallow — show empty */ })
      .finally(() => setLoading(false));
  }, [filterKind]);

  const data = resp?.ok ? resp.data : null;
  const errorBody = resp && !resp.ok ? resp : null;

  if (loading) return null;
  if (errorBody?.error === "migration_pending") {
    return (
      <div className="mb-4 rounded-2xl border border-amber-500/[0.18] bg-amber-500/[0.04] p-3 text-[12px] text-amber-200">
        Timeline schema migration pending — run prisma migrate deploy.
      </div>
    );
  }
  if (!data || data.entries.length === 0) return null;

  return (
    <div className="mb-4 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3">
      <div className="flex items-center gap-2 mb-2">
        <p className="text-[11.5px] font-semibold text-zinc-300">Summary timeline</p>
        <span className="text-[10px] font-mono text-zinc-500">
          {data.summary.total} runs · {data.summary.aiGenerated} AI · {data.summary.fallbackRules} fallback{data.summary.errored > 0 ? ` · ${data.summary.errored} errored` : ""}
        </span>
      </div>
      <div className="space-y-1.5">
        {data.entries.map((s) => (
          <TimelineRow key={s.id} entry={s} />
        ))}
      </div>
    </div>
  );
}

function TimelineRow({ entry }: { entry: TimelineSummary }) {
  const [open, setOpen] = useState(false);
  const scope = entry.targetKind ? KIND_LABEL[entry.targetKind] ?? entry.targetKind : "All";
  return (
    <div className="rounded-lg border border-white/[0.04] bg-black/10 p-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full text-left flex items-center gap-2 flex-wrap"
      >
        <span className="text-[9.5px] font-mono uppercase tracking-wider px-1 py-0.5 rounded border border-white/[0.08] bg-white/[0.02] text-zinc-300">
          {scope}
        </span>
        <span className={`text-[9.5px] font-mono uppercase tracking-wider px-1 py-0.5 rounded border ${OUTCOME_CLASS[entry.outcome] ?? OUTCOME_CLASS.error}`}>
          {entry.outcome}
        </span>
        <span className="text-[10px] font-mono text-zinc-500">{entry.windowSize}w · {entry.aiAvailabilityPct}%AI</span>
        {entry.modelHint && <span className="text-[10px] font-mono text-zinc-500">{entry.modelHint}</span>}
        <span className="text-[10px] font-mono text-zinc-500 ml-auto">{new Date(entry.generatedAtIso).toLocaleString()}</span>
      </button>
      <p className="mt-1 text-[11.5px] text-zinc-300 line-clamp-2">{entry.narrative}</p>
      {open && (
        <div className="mt-1.5 grid grid-cols-1 md:grid-cols-2 gap-2">
          <div>
            <p className="text-[9px] font-mono uppercase tracking-wider text-zinc-500 mb-0.5">Themes</p>
            <ul>
              {entry.themes.map((t, i) => (
                <li key={i} className="text-[11px] text-zinc-300 flex gap-1.5"><span className="text-violet-400">◉</span><span>{t}</span></li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-[9px] font-mono uppercase tracking-wider text-zinc-500 mb-0.5">Notable</p>
            <ul>
              {entry.notableEntries.map((n, i) => (
                <li key={i} className="text-[11px] text-zinc-300 flex gap-1.5"><span className="text-emerald-400">→</span><span>{n}</span></li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────
   ChatPanel — Phase 524 (ask the AGI a free-form question).
   ────────────────────────────────────────────────────────────── */

interface ChatCitationDetail {
  citationId: string;
  kind: "entry" | "summary";
  targetKind: string | null;
  targetId: string | null;
  narrative: string;
  generatedAtIso: string;
}

interface ChatAnswerView {
  outcome: string;
  answer: string;
  citations: string[];
  modelHint: string | null;
  errorMessage: string | null;
  engineVersion: string;
}

type ChatBody =
  | { ok: true; data: { generatedAt: string; answer: ChatAnswerView; contextSize: { entries: number; summaries: number }; citationDetails: ChatCitationDetail[] } }
  | { ok: false; error: string; hint?: string };

interface ChatTurn {
  /** Server-assigned row id when the turn was persisted. `undefined`
   *  when persistence failed (best-effort path). Used to drive
   *  the delete control. */
  id?: string;
  question: string;
  answer: ChatAnswerView;
  contextSize: { entries: number; summaries: number };
  citationDetails: ChatCitationDetail[];
}

interface HistoryTurn {
  id: string;
  question: string;
  answer: string;
  citations: string[];
  outcome: string;
  errorMessage: string | null;
  modelHint: string | null;
  contextEntriesCount: number;
  contextSummariesCount: number;
  engineVersion: string;
  generatedAtIso: string;
}

type HistoryBody =
  | { ok: true; data: { generatedAt: string; turns: HistoryTurn[]; summary: { total: number; aiGenerated: number; fallbackRules: number; errored: number } } }
  | { ok: false; error: string; hint?: string };

const SUGGESTED_QUESTIONS = [
  "What did the AGI block in the last 24 hours, and why?",
  "Where is the AI provider failing most often?",
  "Summarize the most recurring risk factor.",
];

function ChatPanel({ targetKind }: { targetKind?: string }) {
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [scope, setScope] = useState<"user" | "org">("user");
  const [migrationPending, setMigrationPending] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);

  // Phase 529 — Load persisted chat history on mount (and whenever the
  // scope changes). Each fetch supersedes any prior history but keeps
  // ephemeral turns from the current session at the top.
  useEffect(() => {
    let cancelled = false;
    setHistoryLoaded(false);
    fetch(`/api/dashboard/agi-memory-chat-history?scope=${scope}&take=30`, { credentials: "include" })
      .then((r) => r.json())
      .then((j: HistoryBody) => {
        if (cancelled) return;
        if (j.ok) {
          const historyTurns: ChatTurn[] = j.data.turns.map((t) => ({
            id: t.id,
            question: t.question,
            answer: {
              outcome: t.outcome,
              answer: t.answer,
              citations: t.citations,
              modelHint: t.modelHint,
              errorMessage: t.errorMessage,
              engineVersion: t.engineVersion,
            },
            contextSize: { entries: t.contextEntriesCount, summaries: t.contextSummariesCount },
            // History citationDetails aren't preserved end-to-end; the
            // citations array still renders without deep-link previews.
            citationDetails: t.citations.map((cid) => ({ citationId: cid, kind: "entry" as const, targetKind: null, targetId: null, narrative: "", generatedAtIso: t.generatedAtIso })),
          }));
          setTurns(historyTurns);
          setMigrationPending(false);
        } else if (j.error === "migration_pending") {
          setMigrationPending(true);
        }
      })
      .catch(() => { /* swallow — empty history is fine */ })
      .finally(() => { if (!cancelled) setHistoryLoaded(true); });
    return () => { cancelled = true; };
  }, [scope]);

  async function ask(text: string) {
    const trimmed = text.trim();
    if (trimmed.length < 4) {
      setErr("Question is too short — at least 4 characters.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/dashboard/agi-memory-ask", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmed, ...(targetKind ? { targetKind } : {}) }),
      });
      const j: ChatBody = await res.json();
      if (j.ok) {
        setTurns((prev) => [
          { question: trimmed, answer: j.data.answer, contextSize: j.data.contextSize, citationDetails: j.data.citationDetails },
          ...prev,
        ].slice(0, 30));
        setQuestion("");
      } else {
        setErr(j.hint ?? j.error);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "network error");
    } finally {
      setBusy(false);
    }
  }

  async function deleteTurn(id: string) {
    try {
      const res = await fetch("/api/dashboard/agi-memory-chat-delete", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ turnId: id }),
      });
      const j = await res.json();
      if (j.ok) setTurns((prev) => prev.filter((t) => t.id !== id));
      else setErr(j.hint ?? j.error);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "network error");
    }
  }

  return (
    <div className="mb-4 rounded-2xl border border-violet-500/[0.20] bg-violet-500/[0.04] p-4">
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <SparklesIcon className="h-4 w-4 text-violet-300" />
        <p className="text-[12.5px] font-semibold text-violet-100">Ask the AGI</p>
        <span className="text-[11px] text-zinc-400">— Claude reads the last 100 entries + 20 summaries and answers, with citations.</span>
        <div className="ml-auto flex items-center gap-1.5 text-[10.5px] font-mono">
          <button
            type="button"
            onClick={() => setScope("user")}
            className={`px-1.5 py-0.5 rounded border ${scope === "user" ? "border-violet-500/40 bg-violet-500/[0.14] text-violet-100" : "border-white/[0.08] bg-white/[0.02] text-zinc-300 hover:bg-white/[0.06]"}`}
          >
            mine
          </button>
          <button
            type="button"
            onClick={() => setScope("org")}
            className={`px-1.5 py-0.5 rounded border ${scope === "org" ? "border-violet-500/40 bg-violet-500/[0.14] text-violet-100" : "border-white/[0.08] bg-white/[0.02] text-zinc-300 hover:bg-white/[0.06]"}`}
          >
            org
          </button>
        </div>
      </div>

      <div className="flex items-stretch gap-2 mb-3">
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !busy) ask(question); }}
          placeholder="Ask anything about the AGI's recent reasoning…"
          disabled={busy}
          maxLength={500}
          className="flex-1 rounded-lg border border-white/[0.08] bg-black/30 px-3 py-2 text-[12.5px] text-zinc-100 placeholder:text-zinc-600 focus:border-violet-500/40 focus:outline-none disabled:opacity-50"
        />
        <button
          type="button"
          onClick={() => ask(question)}
          disabled={busy || question.trim().length < 4}
          className="px-3 py-2 rounded-lg border border-violet-500/40 bg-violet-500/[0.14] text-[12px] font-semibold text-violet-100 hover:bg-violet-500/[0.22] disabled:opacity-50 disabled:cursor-wait transition-colors"
        >
          {busy ? "Asking…" : "Ask"}
        </button>
      </div>

      {turns.length === 0 && historyLoaded && (
        <div className="flex flex-wrap gap-2 mb-2">
          {SUGGESTED_QUESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => ask(s)}
              disabled={busy}
              className="px-2 py-1 rounded-md border border-white/[0.08] bg-white/[0.02] text-[11px] font-mono text-zinc-300 hover:bg-white/[0.06] disabled:opacity-50"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {migrationPending && (
        <p className="text-[10.5px] font-mono text-amber-300 mb-2">↳ chat history schema migration pending — turns persist after migrate deploy.</p>
      )}

      {err && <p className="text-[11px] font-mono text-rose-300 mb-2">✗ {err}</p>}

      <div className="space-y-2">
        {turns.map((turn, i) => (
          <ChatTurnRow
            key={turn.id ?? `local-${i}`}
            turn={turn}
            onDelete={turn.id ? () => deleteTurn(turn.id!) : undefined}
          />
        ))}
      </div>
    </div>
  );
}

function ChatTurnRow({ turn, onDelete }: { turn: ChatTurn; onDelete?: () => void }) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-black/20 p-3">
      <p className="text-[11.5px] font-mono text-zinc-400 mb-1.5">Q: {turn.question}</p>
      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
        <span className={`text-[9.5px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border ${OUTCOME_CLASS[turn.answer.outcome] ?? OUTCOME_CLASS.error}`}>
          {turn.answer.outcome}
        </span>
        {turn.answer.modelHint && <span className="text-[10px] font-mono text-zinc-500">model: {turn.answer.modelHint}</span>}
        <span className="text-[10px] font-mono text-zinc-500">context: {turn.contextSize.entries} entries · {turn.contextSize.summaries} summaries</span>
        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            className="ml-auto text-[10px] font-mono text-zinc-500 hover:text-rose-300"
          >
            delete
          </button>
        )}
      </div>
      <p className="text-[12.5px] text-zinc-200 mb-2">{turn.answer.answer}</p>
      {turn.citationDetails.length > 0 && (
        <div className="border-t border-white/[0.04] pt-2">
          <p className="text-[9.5px] font-mono uppercase tracking-wider text-zinc-500 mb-1">Citations</p>
          <div className="space-y-1">
            {turn.citationDetails.map((c) => {
              const href = c.targetKind && KIND_HREF[c.targetKind] ? KIND_HREF[c.targetKind] : null;
              return (
                <div key={c.citationId} className="flex items-baseline gap-2 text-[11px] font-mono">
                  <span className="text-violet-300 shrink-0">[{c.citationId}]</span>
                  <span className="text-zinc-400 shrink-0">{c.kind === "entry" ? (c.targetKind ?? "?") : `${c.targetKind ?? "all"}-summary`}</span>
                  <span className="text-zinc-300 line-clamp-1 flex-1">{c.narrative}</span>
                  {href && <a href={href} className="text-violet-300 hover:text-violet-200 shrink-0">open →</a>}
                </div>
              );
            })}
          </div>
        </div>
      )}
      {turn.answer.outcome !== "ai_generated" && turn.answer.errorMessage && (
        <p className="mt-1.5 text-[10.5px] font-mono text-amber-300">↳ {turn.answer.errorMessage}</p>
      )}
    </div>
  );
}
