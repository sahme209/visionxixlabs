"use client";

/**
 * /dashboard/cost-explainer — cost anomaly auto-explainer.
 *
 * Each billing anomaly gets paired against the live CloudTrail event
 * tail. Verdict ∈ primary_suspect (matchScore ≥ 0.7), plausible
 * (≥ 0.45), or no_correlation. Operators verify via evidence refs.
 */

import { useCallback, useEffect, useState } from "react";
import {
  CurrencyDollarIcon,
  MagnifyingGlassIcon,
  ArrowPathIcon,
  ClockIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";

type Verdict = "primary_suspect" | "plausible" | "no_correlation";

interface Candidate {
  eventId: string;
  eventName: string;
  eventTime?: string;
  eventSource?: string;
  username?: string;
  matchScore: number;
  reasoning: string;
}

interface Explanation {
  anomalyId: string;
  anomalyKind: string;
  anomalyScope: string;
  anomalyHeadline: string;
  anomalyProvider: string;
  anomalyDeltaUsd?: number;
  verdict: Verdict;
  confidence: number;
  primary?: Candidate;
  candidates: Candidate[];
  evidenceRefs: string[];
}

interface Report {
  generatedAt: string;
  lookbackMinutes: number;
  anomaliesInspected: number;
  totalExplanations: number;
  attributedCount: number;
  unattributedCount: number;
  explanations: Explanation[];
  durationMs: number;
  limitations: string[];
}

const VERDICT_TONE: Record<Verdict, string> = {
  primary_suspect: "bg-rose-500/15 text-rose-300 border-rose-500/30",
  plausible:       "bg-amber-500/15 text-amber-300 border-amber-500/30",
  no_correlation:  "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
};

const VERDICT_LABEL: Record<Verdict, string> = {
  primary_suspect: "primary suspect",
  plausible:       "plausible",
  no_correlation:  "no correlation",
};

const LOOKBACK_OPTIONS = [
  { label: "1h", value: 60 },
  { label: "6h", value: 360 },
  { label: "24h", value: 1440 },
];

export default function CostExplainerPage() {
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [lookback, setLookback] = useState(1440);

  const load = useCallback((minutes: number) => {
    setLoading(true);
    setError(null);
    fetch(`/api/billing/anomaly-explainer?lookbackMinutes=${minutes}`, { credentials: "include" })
      .then((r) => r.json())
      .then((j: { ok?: boolean; data?: Report; error?: { userMessage?: string } }) => {
        if (j.ok && j.data) setReport(j.data);
        else setError(j.error?.userMessage ?? "Explainer unavailable.");
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Network error."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(lookback); }, [lookback, load]);

  const fmt = (n: number | undefined) =>
    n === undefined ? "—" : `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="relative">
      <div className="relative mb-8 rounded-3xl border border-white/[0.05] bg-gradient-to-br from-white/[0.025] via-white/[0.015] to-transparent p-6 md:p-8 overflow-hidden">
        <div
          className="absolute inset-0 -z-10 opacity-90 pointer-events-none"
          style={{
            background:
              "radial-gradient(900px 320px at 12% 0%, rgba(16,185,129,0.10), transparent 60%), radial-gradient(700px 260px at 88% 110%, rgba(244,114,182,0.06), transparent 60%)",
          }}
          aria-hidden
        />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" aria-hidden />

        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.02] px-2.5 py-1">
            <CurrencyDollarIcon className="h-3.5 w-3.5 text-emerald-300" />
            <span className="text-[10px] font-semibold uppercase tracking-widest text-emerald-300">
              Cost explainer
            </span>
          </span>
          {report && (
            <span className="text-[10px] font-mono text-zinc-500">{report.durationMs}ms</span>
          )}
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-white tracking-[-0.045em] leading-[1.05] mb-3">
          Why did <span className="text-gradient">cost move?</span>
        </h1>
        <p className="text-[15px] text-zinc-400 max-w-2xl leading-relaxed">
          Every billing anomaly is correlated against the live CloudTrail event tail. Primary suspect when the
          match is strong; plausible when partial; honestly empty when nothing lines up.
        </p>

        <div className="mt-5 flex items-center gap-2 flex-wrap">
          <ClockIcon className="h-4 w-4 text-zinc-500" />
          {LOOKBACK_OPTIONS.map((o) => (
            <button
              key={o.value}
              onClick={() => setLookback(o.value)}
              className={`text-[11px] font-mono px-2.5 py-1 rounded-full border transition ${
                lookback === o.value
                  ? "bg-emerald-500/15 text-emerald-200 border-emerald-500/30"
                  : "bg-white/[0.02] text-zinc-400 border-white/[0.06] hover:text-white"
              }`}
            >
              {o.label}
            </button>
          ))}
          <button
            onClick={() => load(lookback)}
            disabled={loading}
            className="ml-2 inline-flex items-center gap-1.5 text-[11px] font-mono px-2.5 py-1 rounded-full border bg-white/[0.02] text-zinc-300 border-white/[0.06] hover:text-white disabled:opacity-50"
          >
            <ArrowPathIcon className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {report && (
          <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="Anomalies" value={report.anomaliesInspected.toLocaleString()} tone="zinc" />
            <Stat label="Attributed" value={report.attributedCount.toLocaleString()} tone="emerald" icon={MagnifyingGlassIcon} />
            <Stat label="Unattributed" value={report.unattributedCount.toLocaleString()} tone={report.unattributedCount > 0 ? "amber" : "emerald"} icon={ExclamationTriangleIcon} />
            <Stat label="Lookback" value={`${report.lookbackMinutes}m`} tone="zinc" />
          </div>
        )}
      </div>

      {loading && (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 mb-6 text-[11px] font-mono text-zinc-500 uppercase tracking-[0.18em]">
          // correlating billing anomalies with CloudTrail…
        </div>
      )}
      {!loading && error && (
        <div role="alert" aria-live="assertive" className="rounded-2xl border border-amber-500/[0.18] bg-amber-500/[0.04] p-5 mb-6 text-[13px] text-zinc-300">
          {error}
        </div>
      )}

      {!loading && !error && report && (
        <>
          {report.explanations.length === 0 ? (
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8 text-center text-[13px] text-zinc-400">
              No billing anomalies in this window. Cost is stable.
            </div>
          ) : (
            <div className="space-y-3 mb-8">
              {report.explanations.map((ex) => (
                <div key={ex.anomalyId} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
                  <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className={`text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border ${VERDICT_TONE[ex.verdict]}`}>
                          {VERDICT_LABEL[ex.verdict]}
                        </span>
                        <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">
                          {ex.anomalyKind}
                        </span>
                        {ex.verdict !== "no_correlation" && (
                          <span className="text-[10px] font-mono text-zinc-400">confidence {Math.round(ex.confidence * 100)}%</span>
                        )}
                        {ex.anomalyDeltaUsd !== undefined && (
                          <span className={`text-[11px] font-mono ${ex.anomalyDeltaUsd >= 0 ? "text-rose-300" : "text-emerald-300"}`}>
                            Δ {ex.anomalyDeltaUsd >= 0 ? "+" : ""}{fmt(ex.anomalyDeltaUsd)}
                          </span>
                        )}
                      </div>
                      <p className="text-[15px] font-semibold text-white">{ex.anomalyHeadline}</p>
                      <p className="text-[11px] font-mono text-zinc-400 mt-0.5">{ex.anomalyScope}</p>
                    </div>
                  </div>

                  {ex.primary && (
                    <div className="rounded-lg border border-rose-500/20 bg-rose-500/[0.04] p-3 mb-2">
                      <p className="text-[10px] font-mono text-rose-300/80 uppercase tracking-wider mb-1">// primary suspect</p>
                      <p className="text-[13px] font-semibold text-white">{ex.primary.eventName}</p>
                      <p className="text-[11px] font-mono text-zinc-400 mt-0.5">
                        {ex.primary.eventSource ?? "—"} · {ex.primary.username ?? "—"} ·{" "}
                        {ex.primary.eventTime ? new Date(ex.primary.eventTime).toLocaleString() : "—"}
                      </p>
                      <p className="text-[11px] text-zinc-300 mt-1.5 leading-snug">{ex.primary.reasoning}</p>
                      <p className="text-[10px] font-mono text-zinc-500 mt-1">match {ex.primary.matchScore.toFixed(2)}</p>
                    </div>
                  )}

                  {ex.candidates.length > 1 && (
                    <details className="mt-2">
                      <summary className="text-[11px] font-mono text-zinc-400 cursor-pointer hover:text-zinc-200">
                        {ex.candidates.length - (ex.primary ? 1 : 0)} other plausible candidate{ex.candidates.length - 1 === 1 ? "" : "s"}
                      </summary>
                      <div className="mt-2 space-y-1.5">
                        {ex.candidates.slice(ex.primary ? 1 : 0).map((c) => (
                          <div key={c.eventId} className="rounded-md border border-white/[0.06] bg-black/20 p-2">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-[12px] font-semibold text-white">{c.eventName}</p>
                              <span className="text-[10px] font-mono text-zinc-500">match {c.matchScore.toFixed(2)}</span>
                            </div>
                            <p className="text-[10px] font-mono text-zinc-500">
                              {c.eventSource ?? "—"} · {c.username ?? "—"} ·{" "}
                              {c.eventTime ? new Date(c.eventTime).toLocaleString() : "—"}
                            </p>
                            <p className="text-[10px] text-zinc-400 mt-0.5">{c.reasoning}</p>
                          </div>
                        ))}
                      </div>
                    </details>
                  )}

                  {ex.verdict === "no_correlation" && (
                    <p className="text-[11px] text-zinc-400 italic">
                      No CloudTrail event in the lookback window scored above the plausibility threshold. The
                      anomaly is real, the cause is not yet attributable from API audit alone.
                    </p>
                  )}

                  <div className="mt-2 text-[10px] font-mono text-zinc-500 truncate">
                    {ex.evidenceRefs.slice(0, 4).join(" · ")}
                  </div>
                </div>
              ))}
            </div>
          )}

          {report.limitations.length > 0 && (
            <div className="rounded-2xl border border-amber-500/[0.18] bg-amber-500/[0.03] p-4 mb-8">
              <p className="text-[10px] font-mono text-amber-300/80 uppercase tracking-[0.18em] mb-2">// notes</p>
              {report.limitations.map((l, i) => <p key={i} className="text-[12px] text-zinc-300">· {l}</p>)}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Stat({
  label, value, tone, icon: Icon,
}: { label: string; value: string; tone: "emerald" | "amber" | "rose" | "violet" | "zinc"; icon?: typeof CurrencyDollarIcon }) {
  const cls = {
    emerald: "border-emerald-500/[0.18] bg-emerald-500/[0.03] text-emerald-200",
    amber:   "border-amber-500/[0.18] bg-amber-500/[0.03] text-amber-200",
    rose:    "border-rose-500/[0.18] bg-rose-500/[0.03] text-rose-200",
    violet:  "border-white/[0.06] bg-white/[0.015] text-white",
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
