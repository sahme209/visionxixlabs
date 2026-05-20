"use client";

/**
 * /dashboard/agent-proposals — agent-authored method improvements.
 *
 * Operators see each pending proposal with its rationale + confidence
 * + diff preview, and approve or reject. Approval here NEVER applies
 * the change — the IaC pipeline picks up `approved` rows through
 * real change control.
 */

import { useCallback, useEffect, useState } from "react";
import {
  SparklesIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";

type Status = "pending" | "approved" | "rejected" | "applied" | "superseded";

interface Proposal {
  id: string;
  authorAgent: string;
  target: string;
  label: string;
  rationale: string;
  proposedDiff: unknown;
  confidence: number;
  status: Status;
  decidedBy?: string;
  decidedAt?: string;
  decisionReason?: string;
  createdAt: string;
}
interface Report { proposals: Proposal[] }

const STATUS_TONE: Record<Status, string> = {
  pending:    "bg-amber-500/15 text-amber-300 border-amber-500/30",
  approved:   "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  applied:    "bg-emerald-500/20 text-emerald-100 border-emerald-500/40",
  rejected:   "bg-rose-500/15 text-rose-300 border-rose-500/30",
  superseded: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30",
};

export default function AgentProposalsPage() {
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Status | "all">("pending");
  const [busyRow, setBusyRow] = useState<string | null>(null);
  const [reason, setReason] = useState<Record<string, string>>({});

  const load = useCallback((status: Status | "all") => {
    setLoading(true);
    setError(null);
    const qs = status === "all" ? "" : `?status=${status}`;
    fetch(`/api/agents/proposals${qs}`, { credentials: "include" })
      .then((r) => r.json())
      .then((j: { ok?: boolean; data?: Report; error?: { userMessage?: string } }) => {
        if (j.ok && j.data) setReport(j.data);
        else setError(j.error?.userMessage ?? "Proposals unavailable.");
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Network error."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(filter); }, [filter, load]);

  async function decide(id: string, decision: "approved" | "rejected") {
    setBusyRow(id);
    try {
      await fetch(`/api/agents/proposals/${id}/decide`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ decision, reason: reason[id]?.trim() || undefined }),
      });
      load(filter);
    } finally {
      setBusyRow(null);
    }
  }

  return (
    <div className="relative">
      <div className="relative mb-8 rounded-3xl border border-white/[0.05] bg-gradient-to-br from-white/[0.025] via-white/[0.015] to-transparent p-6 md:p-8 overflow-hidden">
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.02] px-2.5 py-1">
            <SparklesIcon className="h-3.5 w-3.5 text-indigo-300" />
            <span className="text-[10px] font-semibold uppercase tracking-widest text-indigo-300">
              Method Proposals · approval_only_no_execution
            </span>
          </span>
          <button
            onClick={() => load(filter)}
            disabled={loading}
            className="ml-2 inline-flex items-center gap-1.5 text-[11px] font-mono px-2.5 py-1 rounded-full border bg-white/[0.02] text-zinc-300 border-white/[0.06] hover:text-white disabled:opacity-50"
          >
            <ArrowPathIcon className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-white tracking-[-0.045em] leading-[1.05] mb-3">
          Agents <span className="text-gradient">improving themselves.</span>
        </h1>
        <p className="text-[15px] text-zinc-400 max-w-2xl leading-relaxed">
          Every recipe / template / charter improvement an agent suggests lands here for human review. Approval
          is durably recorded but never applied by Axiom — the IaC pipeline ships approved changes through
          real change control.
        </p>

        <div className="mt-5 flex items-center gap-1.5 flex-wrap">
          {(["all", "pending", "approved", "rejected", "applied", "superseded"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`text-[10px] font-mono px-2 py-0.5 rounded-full border transition ${
                filter === s
                  ? "bg-indigo-500/15 text-indigo-200 border-indigo-500/30"
                  : "bg-white/[0.02] text-zinc-400 border-white/[0.06] hover:text-white"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-amber-500/[0.18] bg-amber-500/[0.04] p-5 mb-6 text-[13px] text-zinc-300">
          {error}
        </div>
      )}

      {report && (
        report.proposals.length === 0 ? (
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8 text-center text-[13px] text-zinc-400">
            No proposals matching this filter.
          </div>
        ) : (
          <div className="space-y-3 mb-8">
            {report.proposals.map((p) => (
              <div key={p.id} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  <span className={`text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border ${STATUS_TONE[p.status]}`}>
                    {p.status}
                  </span>
                  <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">{p.target}</span>
                  <span className="text-[10px] font-mono text-indigo-300">{p.authorAgent}</span>
                  <span className="text-[10px] font-mono text-zinc-400">confidence {Math.round(p.confidence * 100)}%</span>
                  <span className="text-[10px] font-mono text-zinc-500 ml-auto">{new Date(p.createdAt).toLocaleString()}</span>
                </div>
                <p className="text-[14px] font-semibold text-white">{p.label}</p>
                <p className="text-[12px] text-zinc-400 mt-0.5 leading-snug">{p.rationale}</p>

                <details className="mt-2">
                  <summary className="text-[10px] font-mono text-zinc-500 cursor-pointer hover:text-zinc-300 uppercase tracking-wider">
                    Proposed diff
                  </summary>
                  <pre className="mt-2 max-h-64 overflow-auto rounded-lg border border-white/[0.08] bg-black/40 p-3 text-[10px] font-mono text-zinc-100 leading-relaxed">
{JSON.stringify(p.proposedDiff, null, 2)}
                  </pre>
                </details>

                {p.status === "pending" ? (
                  <div className="mt-3 flex items-center gap-2 flex-wrap">
                    <input
                      value={reason[p.id] ?? ""}
                      onChange={(e) => setReason((m) => ({ ...m, [p.id]: e.target.value }))}
                      placeholder="optional decision reason"
                      className="flex-1 min-w-[200px] rounded-md border border-white/[0.08] bg-black/30 px-2 py-1 text-[11px] font-mono text-zinc-200 focus:border-indigo-400/60 focus:outline-none"
                    />
                    <button
                      onClick={() => decide(p.id, "rejected")}
                      disabled={busyRow === p.id}
                      className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-lg bg-rose-500/10 text-rose-300 border border-rose-500/30 hover:bg-rose-500/15 disabled:opacity-50"
                    >
                      <XCircleIcon className="h-3 w-3" />
                      Reject
                    </button>
                    <button
                      onClick={() => decide(p.id, "approved")}
                      disabled={busyRow === p.id}
                      className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-200 border border-emerald-500/30 hover:bg-emerald-500/20 disabled:opacity-50"
                    >
                      <CheckCircleIcon className="h-3 w-3" />
                      Approve
                    </button>
                  </div>
                ) : (
                  <p className="mt-2 text-[10px] font-mono text-zinc-500">
                    {p.decidedBy && `decided by ${p.decidedBy} · `}
                    {p.decidedAt && new Date(p.decidedAt).toLocaleString()}
                    {p.decisionReason && ` · ${p.decisionReason}`}
                  </p>
                )}
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
