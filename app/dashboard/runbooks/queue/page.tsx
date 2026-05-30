"use client";

/**
 * /dashboard/runbooks/queue — staged-runbook approval queue.
 *
 * Operators see every runbook that's been staged from /dashboard/runbooks
 * and decide approve / reject. Approval here NEVER triggers a mutation —
 * the IaC pipeline (or a future apply lane) is what actually changes
 * cloud state. This page is pure audit.
 */

import { useCallback, useEffect, useState } from "react";
import {
  WrenchScrewdriverIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";

type Status = "staged" | "approved" | "rejected" | "expired";

interface Row {
  id: string;
  runbookId: string;
  sourceEventId: string;
  eventName: string;
  severity: string;
  rootCause: string;
  affectedResource: string;
  reversalLabel: string;
  reversalRisk: string;
  reversalApi?: string | null;
  hardeningLabel: string;
  hardeningApi?: string | null;
  confidence: number;
  evidenceRefs: string[];
  status: Status;
  decision?: string | null;
  stagedBy?: string | null;
  stagedAt: string;
  decidedAt?: string | null;
  decidedBy?: string | null;
}

interface QueueReport {
  totalStaged: number;
  totalApproved: number;
  totalRejected: number;
  totalExpired: number;
  rows: Row[];
}

const STATUS_TONE: Record<Status, string> = {
  staged:   "bg-amber-500/15 text-amber-300 border-amber-500/30",
  approved: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  rejected: "bg-rose-500/15 text-rose-300 border-rose-500/30",
  expired:  "bg-zinc-500/15 text-zinc-400 border-zinc-500/30",
};

export default function RunbookQueuePage() {
  const [report, setReport] = useState<QueueReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyRow, setBusyRow] = useState<string | null>(null);
  const [filter, setFilter] = useState<Status | "all">("staged");

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch("/api/autonomy/runbooks/queue?limit=100", { credentials: "include" })
      .then((r) => r.json())
      .then((j: { ok?: boolean; data?: QueueReport; error?: { userMessage?: string } }) => {
        if (j.ok && j.data) setReport(j.data);
        else setError(j.error?.userMessage ?? "Queue unavailable.");
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Network error."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function decide(id: string, decision: "approve" | "reject") {
    setBusyRow(id);
    try {
      await fetch(`/api/autonomy/runbooks/queue/${id}/decide`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      load();
    } finally {
      setBusyRow(null);
    }
  }

  const filtered = report?.rows.filter((r) => filter === "all" || r.status === filter) ?? [];

  return (
    <div className="relative">
      <div className="relative mb-8 rounded-3xl border border-white/[0.05] bg-gradient-to-br from-white/[0.025] via-white/[0.015] to-transparent p-6 md:p-8 overflow-hidden">
        <div
          className="absolute inset-0 -z-10 opacity-90 pointer-events-none"
          style={{
            background:
              "radial-gradient(900px 320px at 12% 0%, rgba(245,158,11,0.10), transparent 60%), radial-gradient(700px 260px at 88% 110%, rgba(16,185,129,0.06), transparent 60%)",
          }}
          aria-hidden
        />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" aria-hidden />

        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.02] px-2.5 py-1">
            <WrenchScrewdriverIcon className="h-3.5 w-3.5 text-amber-300" />
            <span className="text-[10px] font-semibold uppercase tracking-widest text-amber-300">
              Runbook Queue · approval_only_no_execution
            </span>
          </span>
          <button
            onClick={load}
            disabled={loading}
            className="ml-2 inline-flex items-center gap-1.5 text-[11px] font-mono px-2.5 py-1 rounded-full border bg-white/[0.02] text-zinc-300 border-white/[0.06] hover:text-white disabled:opacity-50"
          >
            <ArrowPathIcon className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-white tracking-[-0.045em] leading-[1.05] mb-3">
          Staged. <span className="text-gradient">Awaiting human.</span>
        </h1>
        <p className="text-[15px] text-zinc-400 max-w-2xl leading-relaxed">
          Every runbook promoted from /dashboard/runbooks lands here. Approve or reject — the decision is durably
          recorded but Axiom does not apply the change. The IaC pipeline owns execution.
        </p>

        {report && (
          <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="Awaiting" value={String(report.totalStaged)} tone="amber" icon={ClockIcon} />
            <Stat label="Approved" value={String(report.totalApproved)} tone="emerald" icon={CheckCircleIcon} />
            <Stat label="Rejected" value={String(report.totalRejected)} tone="rose" icon={XCircleIcon} />
            <Stat label="Expired" value={String(report.totalExpired)} tone="zinc" />
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-2xl border border-amber-500/[0.18] bg-amber-500/[0.04] p-5 mb-6 text-[13px] text-zinc-300">
          {error}
        </div>
      )}

      {!loading && !error && report && (
        <>
          <div className="flex items-center gap-1.5 flex-wrap mb-4">
            <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider mr-1">Filter:</span>
            {(["all", "staged", "approved", "rejected", "expired"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={`text-[10px] font-mono px-2 py-0.5 rounded-full border transition ${
                  filter === s
                    ? "bg-violet-500/15 text-white border-white/[0.12]"
                    : "bg-white/[0.02] text-zinc-400 border-white/[0.06] hover:text-white"
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8 text-center text-[13px] text-zinc-400">
              No runbooks {filter === "all" ? "in queue" : `with status '${filter}'`}.
            </div>
          ) : (
            <div className="space-y-3 mb-8">
              {filtered.map((r) => (
                <div key={r.id} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
                  <div className="flex items-start justify-between gap-3 flex-wrap mb-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className={`text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border ${STATUS_TONE[r.status]}`}>
                          {r.status}
                        </span>
                        <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">{r.severity}</span>
                        <span className="text-[10px] font-mono text-zinc-500">confidence {Math.round(r.confidence * 100)}%</span>
                        <span className="text-[10px] font-mono text-zinc-500 ml-auto">staged {new Date(r.stagedAt).toLocaleString()}</span>
                      </div>
                      <p className="text-[15px] font-semibold text-white">{r.eventName}</p>
                      <p className="text-[11px] text-zinc-400 mt-0.5">{r.rootCause}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                    <div className="rounded-lg border border-white/[0.06] bg-black/20 p-2.5">
                      <p className="text-[10px] font-mono text-emerald-300/80 uppercase tracking-wider mb-0.5">Reversal · {r.reversalRisk}</p>
                      <p className="text-[12px] text-white">{r.reversalLabel}</p>
                      {r.reversalApi && (
                        <code className="inline-block text-[10px] font-mono text-cyan-300 bg-black/40 border border-white/[0.06] rounded px-1.5 py-0.5 mt-1">
                          {r.reversalApi}
                        </code>
                      )}
                    </div>
                    <div className="rounded-lg border border-white/[0.06] bg-black/20 p-2.5">
                      <p className="text-[10px] font-mono text-violet-300/80 uppercase tracking-wider mb-0.5">Hardening</p>
                      <p className="text-[12px] text-white">{r.hardeningLabel}</p>
                      {r.hardeningApi && (
                        <code className="inline-block text-[10px] font-mono text-cyan-300 bg-black/40 border border-white/[0.06] rounded px-1.5 py-0.5 mt-1">
                          {r.hardeningApi}
                        </code>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-[10px] font-mono text-zinc-500 truncate">
                      {r.stagedBy ? `by ${r.stagedBy} · ` : ""}{r.evidenceRefs.slice(0, 2).join(" · ")}
                    </span>
                    {r.status === "staged" ? (
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => decide(r.id, "reject")}
                          disabled={busyRow === r.id}
                          className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-lg bg-rose-500/10 text-rose-300 border border-rose-500/30 hover:bg-rose-500/15 disabled:opacity-50"
                        >
                          <XCircleIcon className="h-3 w-3" />
                          Reject
                        </button>
                        <button
                          onClick={() => decide(r.id, "approve")}
                          disabled={busyRow === r.id}
                          className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-200 border border-emerald-500/30 hover:bg-emerald-500/20 disabled:opacity-50"
                        >
                          <CheckCircleIcon className="h-3 w-3" />
                          Approve
                        </button>
                      </div>
                    ) : (
                      <span className="text-[10px] font-mono text-zinc-500">
                        {r.decision ? `${r.decision} by ${r.decidedBy ?? "—"}` : "no decision"}
                        {r.decidedAt && ` · ${new Date(r.decidedAt).toLocaleString()}`}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Stat({
  label, value, tone, icon: Icon,
}: { label: string; value: string; tone: "emerald" | "amber" | "rose" | "zinc"; icon?: typeof ClockIcon }) {
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
        {Icon && <Icon className="h-4 w-4 opacity-80" />}
        <p className="text-[20px] font-bold">{value}</p>
      </div>
    </div>
  );
}
