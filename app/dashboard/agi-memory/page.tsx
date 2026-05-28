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
