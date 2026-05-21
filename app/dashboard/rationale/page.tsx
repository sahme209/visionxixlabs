"use client";

/**
 * /dashboard/rationale — durable audit of every autonomous decision.
 *
 * Reads /api/autonomy/rationale. Each row shows the candidate's
 * proposed intent, charter mode, boundary class, outcome, halt info
 * (when applicable), and a collapsible per-stage transcript so the
 * operator can answer "why did the AGI do that?" weeks after the
 * fact.
 */

import { useCallback, useEffect, useState } from "react";
import {
  DocumentMagnifyingGlassIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
} from "@heroicons/react/24/outline";

type Outcome = "deferred_to_human" | "approval_packet_prepared" | "execution_handed_off" | "verified_complete" | "halted_at_gate" | "errored";

interface StageRecord {
  stage?: string;
  status?: string;
  summary?: string;
  evidenceRef?: string;
  reason?: string;
}

interface Row {
  id: string;
  cycleId?: string | null;
  candidateId: string;
  title: string;
  charterMode: string;
  boundaryClass: string;
  outcome: string;
  haltedAtStage?: string | null;
  haltReason?: string | null;
  proposedIntent: string;
  stages: StageRecord[];
  evidenceRefs: string[];
  durationMs: number;
  createdAt: string;
}

interface Report {
  total: number;
  rows: Row[];
  perOutcome: Record<string, number>;
}

const OUTCOME_TONE: Record<string, string> = {
  deferred_to_human:        "bg-amber-500/15 text-amber-300 border-amber-500/30",
  approval_packet_prepared: "bg-violet-500/15 text-violet-300 border-violet-500/30",
  execution_handed_off:     "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
  verified_complete:        "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  halted_at_gate:           "bg-rose-500/15 text-rose-300 border-rose-500/30",
  errored:                  "bg-rose-500/20 text-rose-200 border-rose-500/40",
};

const OUTCOMES: Outcome[] = ["deferred_to_human", "approval_packet_prepared", "execution_handed_off", "verified_complete", "halted_at_gate", "errored"];

export default function RationalePage() {
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");

  const load = useCallback((outcome: string) => {
    setLoading(true);
    setError(null);
    const qs = outcome === "all" ? "?limit=200" : `?limit=200&outcome=${encodeURIComponent(outcome)}`;
    fetch(`/api/autonomy/rationale${qs}`, { credentials: "include" })
      .then((r) => r.json())
      .then((j: { ok?: boolean; data?: Report; error?: { userMessage?: string } }) => {
        if (j.ok && j.data) setReport(j.data);
        else setError(j.error?.userMessage ?? "Rationale unavailable.");
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Network error."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(filter); }, [filter, load]);

  return (
    <div className="relative">
      <div className="relative mb-8 rounded-3xl border border-white/[0.05] bg-gradient-to-br from-white/[0.025] via-white/[0.015] to-transparent p-6 md:p-8 overflow-hidden">
        <div
          className="absolute inset-0 -z-10 opacity-90 pointer-events-none"
          style={{
            background:
              "radial-gradient(900px 320px at 12% 0%, rgba(124,58,237,0.10), transparent 60%), radial-gradient(700px 260px at 88% 110%, rgba(244,114,182,0.06), transparent 60%)",
          }}
          aria-hidden
        />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" aria-hidden />

        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.02] px-2.5 py-1">
            <DocumentMagnifyingGlassIcon className="h-3.5 w-3.5 text-violet-300" />
            <span className="text-[10px] font-semibold uppercase tracking-widest text-violet-300">
              Decision Rationale
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
          <a
            href={`/api/autonomy/rationale/export${filter === "all" ? "?limit=1000" : `?limit=1000&outcome=${encodeURIComponent(filter)}`}`}
            className="inline-flex items-center gap-1.5 text-[11px] font-mono px-2.5 py-1 rounded-full border bg-emerald-500/[0.05] text-emerald-300 border-emerald-500/[0.20] hover:bg-emerald-500/[0.1]"
          >
            Export CSV
          </a>
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-white tracking-[-0.045em] leading-[1.05] mb-3">
          Why did the AGI <span className="text-gradient">do that?</span>
        </h1>
        <p className="text-[15px] text-zinc-400 max-w-2xl leading-relaxed">
          Every candidate the autonomy loop touched, with the full per-stage transcript. Durable audit — the
          answer when someone asks "what happened three months ago".
        </p>

        {report && (
          <div className="mt-5 grid grid-cols-2 md:grid-cols-5 gap-2">
            <Stat label="Total rows" value={String(report.total)} tone="violet" />
            <Stat label="Approval packets" value={String(report.perOutcome.approval_packet_prepared ?? 0)} tone="violet" />
            <Stat label="Verified" value={String(report.perOutcome.verified_complete ?? 0)} tone="emerald" icon={CheckCircleIcon} />
            <Stat label="Halted" value={String(report.perOutcome.halted_at_gate ?? 0)} tone="rose" icon={XCircleIcon} />
            <Stat label="Errored" value={String(report.perOutcome.errored ?? 0)} tone="rose" />
          </div>
        )}
      </div>

      <div className="flex items-center gap-1.5 flex-wrap mb-4">
        <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider mr-1">Filter:</span>
        {(["all", ...OUTCOMES] as const).map((o) => (
          <button
            key={o}
            onClick={() => setFilter(o)}
            className={`text-[10px] font-mono px-2 py-0.5 rounded-full border transition ${
              filter === o
                ? "bg-violet-500/15 text-violet-200 border-violet-500/30"
                : "bg-white/[0.02] text-zinc-400 border-white/[0.06] hover:text-white"
            }`}
          >
            {o}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-2xl border border-amber-500/[0.18] bg-amber-500/[0.04] p-5 mb-6 text-[13px] text-zinc-300">
          {error}
        </div>
      )}

      {!loading && !error && report && (
        report.rows.length === 0 ? (
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8 text-center text-[13px] text-zinc-400">
            No rationale rows yet. Run an autonomy cycle (or wait for the cron) to populate.
          </div>
        ) : (
          <div className="space-y-3 mb-8">
            {report.rows.map((r) => (
              <div key={r.id} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap mb-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border ${OUTCOME_TONE[r.outcome] ?? "bg-zinc-500/10 text-zinc-400 border-zinc-500/20"}`}>
                        {r.outcome}
                      </span>
                      <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">{r.charterMode}</span>
                      <span className="text-[10px] font-mono text-zinc-500">{r.boundaryClass}</span>
                      <span className="text-[10px] font-mono text-zinc-500 inline-flex items-center gap-1">
                        <ClockIcon className="h-3 w-3" />
                        {new Date(r.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-[14px] font-semibold text-white">{r.title}</p>
                    <p className="text-[11px] text-zinc-400 mt-0.5 leading-snug">{r.proposedIntent}</p>
                  </div>
                </div>

                {r.haltedAtStage && (
                  <div className="rounded-md border border-rose-500/20 bg-rose-500/[0.04] p-2 mb-2">
                    <p className="text-[10px] font-mono text-rose-300/80 uppercase tracking-wider">
                      // halted at {r.haltedAtStage}
                    </p>
                    {r.haltReason && <p className="text-[11px] text-rose-100">{r.haltReason}</p>}
                  </div>
                )}

                <details className="mt-1">
                  <summary className="text-[10px] font-mono text-zinc-500 cursor-pointer hover:text-zinc-300 uppercase tracking-wider">
                    {r.stages.length} stage{r.stages.length === 1 ? "" : "s"} — transcript
                  </summary>
                  <div className="mt-2 space-y-1 border-l border-white/[0.08] pl-3">
                    {r.stages.map((s, i) => (
                      <div key={i} className="rounded border border-white/[0.06] bg-black/30 p-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] font-mono uppercase tracking-wider text-white">{s.stage}</span>
                          <span className={`text-[9px] font-mono uppercase tracking-wider px-1 py-0.5 rounded ${
                            s.status?.startsWith("halted")
                              ? "bg-rose-500/10 text-rose-300 border border-rose-500/20"
                              : s.status === "passed" || s.status === "verified"
                                ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
                                : "bg-zinc-500/10 text-zinc-400 border border-zinc-500/20"
                          }`}>{s.status ?? "unknown"}</span>
                          {s.evidenceRef && (
                            <code className="text-[9px] font-mono text-cyan-300 truncate ml-auto" title={s.evidenceRef}>{s.evidenceRef}</code>
                          )}
                        </div>
                        {s.summary && <p className="text-[11px] text-zinc-300 mt-0.5">{s.summary}</p>}
                        {s.reason && <p className="text-[10px] text-amber-200 mt-0.5 italic">{s.reason}</p>}
                      </div>
                    ))}
                  </div>
                </details>

                <p className="mt-2 text-[10px] font-mono text-zinc-500 truncate">
                  candidate {r.candidateId} · {r.evidenceRefs.slice(0, 3).join(" · ")}
                </p>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}

function Stat({
  label, value, tone, icon: Icon,
}: { label: string; value: string; tone: "emerald" | "amber" | "rose" | "violet" | "zinc"; icon?: typeof ClockIcon }) {
  const cls = {
    emerald: "border-emerald-500/[0.18] bg-emerald-500/[0.03] text-emerald-200",
    amber:   "border-amber-500/[0.18] bg-amber-500/[0.03] text-amber-200",
    rose:    "border-rose-500/[0.18] bg-rose-500/[0.03] text-rose-200",
    violet:  "border-violet-500/[0.18] bg-violet-500/[0.03] text-violet-200",
    zinc:    "border-white/[0.06] bg-white/[0.02] text-zinc-200",
  }[tone];
  return (
    <div className={`rounded-xl border ${cls} p-3`}>
      <p className="text-[9px] font-mono uppercase tracking-wider opacity-70">{label}</p>
      <div className="flex items-center gap-2 mt-1">
        {Icon && <Icon className="h-4 w-4 opacity-80" />}
        <p className="text-[18px] font-bold">{value}</p>
      </div>
    </div>
  );
}
