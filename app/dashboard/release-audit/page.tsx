"use client";

/**
 * /dashboard/release-audit — Phase 496.
 *
 * Append-only inbox of every state-changing ReleaseOps action.
 * Distinct from /dashboard/audit (which is broader platform audit).
 */

import { useEffect, useState } from "react";
import {
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import { PageIntro } from "@/components/dashboard/PageIntro";

interface EventView {
  id: string;
  kind: string;
  subjectKind: string;
  subjectId: string;
  outcome: string;
  summary: string;
  actorUserId: string | null;
  correlationId: string | null;
  createdAtIso: string;
}

interface ListData {
  generatedAt: string;
  events: EventView[];
  summary: { total: number; byOutcome: Record<string, number>; byKind: Record<string, number> };
}

type ListBody =
  | { ok: true; data: ListData }
  | { ok: false; error: string; hint?: string };

const OUTCOME_CLASS: Record<string, string> = {
  ok:       "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
  rejected: "bg-amber-500/15 text-amber-300 border-amber-500/25",
  error:    "bg-rose-500/15 text-rose-300 border-rose-500/25",
  skipped:  "bg-zinc-700/40 text-zinc-300 border-zinc-700/40",
  unknown:  "bg-zinc-700/40 text-zinc-400 border-zinc-700/40",
};

export default function ReleaseAuditPage() {
  const [resp, setResp] = useState<ListBody | null>(null);
  const [loading, setLoading] = useState(true);
  const [networkError, setNetworkError] = useState<string | null>(null);
  const [kindFilter, setKindFilter] = useState("");

  function loadList(filterKind: string) {
    setLoading(true);
    setNetworkError(null);
    const url = filterKind
      ? `/api/dashboard/audit-event-list?kind=${encodeURIComponent(filterKind)}`
      : "/api/dashboard/audit-event-list";
    fetch(url, { credentials: "include" })
      .then((r) => r.json())
      .then((j: ListBody) => setResp(j))
      .catch((e) => setNetworkError(e instanceof Error ? e.message : "Network error."))
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadList(""); }, []);

  const data = resp?.ok ? resp.data : null;
  const errorBody = resp && !resp.ok ? resp : null;

  return (
    <div className="relative">
      <PageIntro
        kicker={`ReleaseOps · audit log${data ? ` · ${data.summary.total} events` : ""}`}
        title={<>Every action. <span className="text-zinc-500">Append-only.</span></>}
        description="Append-only record of every ReleaseOps state change — release transitions, manual-fix reconciliation, repository registration, policy evaluations. The audit log is the source of truth for compliance exports."
        helps="When something changes in production governance, this is where you go to see who, what, when, and (via correlation id) why."
        connectFirst="No connector needed — every state-changing endpoint best-effort appends here."
        engineers={["Compliance", "Release Captain", "SRE"]}
        requiresApproval="Events are append-only; no edits or deletes."
        actions={[
          { label: "Releases",     href: "/dashboard/releases" },
          { label: "Manual fixes", href: "/dashboard/manual-fixes" },
        ]}
        safetyNote="Per-org isolation · best-effort writes never block the source action · 500-row page cap"
      />

      {data && (
        <div className="mb-6 grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat icon={ClockIcon} label="Total" value={String(data.summary.total)} tone="zinc" />
          <Stat icon={CheckCircleIcon} label="OK" value={String(data.summary.byOutcome.ok ?? 0)} tone="emerald" />
          <Stat icon={ExclamationTriangleIcon} label="Rejected" value={String(data.summary.byOutcome.rejected ?? 0)} tone={(data.summary.byOutcome.rejected ?? 0) > 0 ? "amber" : "zinc"} />
          <Stat icon={XCircleIcon} label="Error" value={String(data.summary.byOutcome.error ?? 0)} tone={(data.summary.byOutcome.error ?? 0) > 0 ? "rose" : "zinc"} />
        </div>
      )}

      {data && Object.keys(data.summary.byKind).length > 0 && (
        <div className="mb-6 flex items-center gap-2 flex-wrap text-[11px] font-mono">
          <span className="text-zinc-500 uppercase tracking-[0.18em]">filter:</span>
          <button
            type="button"
            onClick={() => { setKindFilter(""); loadList(""); }}
            className={`px-2 py-1 rounded border ${kindFilter === "" ? "border-violet-500/40 bg-violet-500/[0.12] text-white" : "border-white/[0.08] bg-white/[0.02] text-zinc-300 hover:border-white/[0.15] hover:text-white"} transition-colors`}
          >
            all ({data.summary.total})
          </button>
          {Object.entries(data.summary.byKind).map(([k, count]) => (
            <button
              key={k}
              type="button"
              onClick={() => { setKindFilter(k); loadList(k); }}
              className={`px-2 py-1 rounded border ${kindFilter === k ? "border-violet-500/40 bg-violet-500/[0.12] text-white" : "border-white/[0.08] bg-white/[0.02] text-zinc-300 hover:border-white/[0.15] hover:text-white"} transition-colors`}
            >
              {k} ({count})
            </button>
          ))}
        </div>
      )}

      {loading && (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 mb-6 text-[12px] text-zinc-400">
          Loading audit events…
        </div>
      )}

      {!loading && networkError && (
        <div className="rounded-2xl border border-rose-500/[0.18] bg-rose-500/[0.04] p-5 mb-6 text-[13px] text-zinc-300">
          {networkError}
        </div>
      )}

      {!loading && errorBody?.error === "migration_pending" && (
        <div className="rounded-2xl border border-amber-500/[0.18] bg-amber-500/[0.04] p-5 mb-6">
          <div className="flex items-center gap-2 mb-1">
            <ExclamationTriangleIcon className="h-4 w-4 text-amber-300" />
            <p className="text-[12px] font-semibold text-amber-200">Schema migration pending</p>
          </div>
          <p className="text-[12.5px] text-zinc-300">{errorBody.hint}</p>
        </div>
      )}

      {!loading && errorBody?.error === "auth_required" && (
        <div className="rounded-2xl border border-amber-500/[0.18] bg-amber-500/[0.04] p-5 mb-6 text-[13px] text-zinc-300">
          Sign in required.
        </div>
      )}

      {data && (
        data.events.length === 0 ? (
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8 text-center text-[13px] text-zinc-400">
            {kindFilter ? `No "${kindFilter}" events yet.` : "No audit events yet. State-changing actions will append here."}
          </div>
        ) : (
          <div className="space-y-2 mb-8">
            {data.events.map((e) => (
              <div key={e.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className={`text-[9.5px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border ${OUTCOME_CLASS[e.outcome] ?? OUTCOME_CLASS.unknown}`}>
                        {e.outcome}
                      </span>
                      <span className="text-[10px] font-mono text-zinc-400">{e.kind}</span>
                      <span className="text-[10px] font-mono text-zinc-500">
                        {e.subjectKind}:{e.subjectId}
                      </span>
                      <span className="text-[10px] font-mono text-zinc-500 ml-auto">
                        {new Date(e.createdAtIso).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-[12.5px] text-zinc-200">{e.summary}</p>
                    {(e.actorUserId || e.correlationId) && (
                      <div className="flex items-center gap-3 mt-1 text-[10px] font-mono text-zinc-500">
                        {e.actorUserId && <span>actor: {e.actorUserId}</span>}
                        {e.correlationId && <span>req: {e.correlationId}</span>}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}

function Stat({ icon: Icon, label, value, tone }: { icon: typeof ClockIcon; label: string; value: string; tone: "emerald" | "amber" | "rose" | "zinc" }) {
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
