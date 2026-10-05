"use client";

/**
 * /dashboard/decision-heatmap — stage × outcome density.
 *
 * Renders a 2D grid where each cell shows count + heat intensity.
 * Operators answer "where do halts cluster?" in one glance.
 */

import { useCallback, useEffect, useState } from "react";
import { Squares2X2Icon, FireIcon, ArrowPathIcon } from "@heroicons/react/24/outline";

interface Cell {
  stage: string;
  outcome: string;
  count: number;
}

interface Heatmap {
  generatedAt: string;
  windowStart: string;
  windowEnd: string;
  totalRows: number;
  stages: string[];
  outcomes: string[];
  cells: Cell[];
  perStageTotal: Record<string, number>;
  perOutcomeTotal: Record<string, number>;
  topHotspots: Cell[];
}

const WINDOW_OPTIONS = [
  { label: "1d", value: 1 },
  { label: "7d", value: 7 },
  { label: "30d", value: 30 },
];

function heat(count: number, max: number): string {
  if (count === 0) return "bg-zinc-500/[0.04] text-zinc-600";
  const ratio = max > 0 ? count / max : 0;
  if (ratio >= 0.75) return "bg-rose-500/30 text-rose-100 border-rose-400/40";
  if (ratio >= 0.5)  return "bg-rose-500/20 text-rose-200 border-rose-500/30";
  if (ratio >= 0.25) return "bg-amber-500/20 text-amber-200 border-amber-500/30";
  return "bg-emerald-500/15 text-emerald-200 border-emerald-500/25";
}

export default function DecisionHeatmapPage() {
  const [report, setReport] = useState<Heatmap | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [windowDays, setWindowDays] = useState(7);

  const load = useCallback((days: number) => {
    setLoading(true);
    setError(null);
    fetch(`/api/autonomy/heatmap?windowDays=${days}`, { credentials: "include" })
      .then((r) => r.json())
      .then((j: { ok?: boolean; data?: Heatmap; error?: { userMessage?: string } }) => {
        if (j.ok && j.data) setReport(j.data);
        else setError(j.error?.userMessage ?? "Heatmap unavailable.");
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Network error."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(windowDays); }, [windowDays, load]);

  // Build the (stage, outcome) → count lookup map.
  const cellMap = new Map<string, number>();
  for (const c of report?.cells ?? []) {
    cellMap.set(`${c.stage}::${c.outcome}`, c.count);
  }
  const maxCount = report ? report.cells.reduce((m, c) => Math.max(m, c.count), 0) : 0;

  return (
    <div className="relative">
      <div className="relative mb-8 rounded-3xl border border-white/[0.05] bg-gradient-to-br from-white/[0.025] via-white/[0.015] to-transparent p-6 md:p-8 overflow-hidden">
        <div
          className="absolute inset-0 -z-10 opacity-90 pointer-events-none"
          style={{
            background:
              "radial-gradient(900px 320px at 12% 0%, rgba(244,114,182,0.10), transparent 60%), radial-gradient(700px 260px at 88% 110%, rgba(168,85,247,0.06), transparent 60%)",
          }}
          aria-hidden
        />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" aria-hidden />

        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.02] px-2.5 py-1">
            <Squares2X2Icon className="h-3.5 w-3.5 text-rose-300" />
            <span className="text-[10px] font-semibold uppercase tracking-widest text-rose-300">
              Decision Heatmap
            </span>
          </span>
          <button
            onClick={() => load(windowDays)}
            disabled={loading}
            className="ml-2 inline-flex items-center gap-1.5 text-[11px] font-mono px-2.5 py-1 rounded-full border bg-white/[0.02] text-zinc-300 border-white/[0.06] hover:text-white disabled:opacity-50"
          >
            <ArrowPathIcon className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-white tracking-[-0.045em] leading-[1.05] mb-3">
          Where do halts <span className="text-gradient">cluster?</span>
        </h1>
        <p className="text-[15px] text-zinc-400 max-w-2xl leading-relaxed">
          Stage × outcome grid for the last N days. Hot cells are where the autonomy loop is repeatedly
          getting stuck — fix one root cause and a whole row goes cold.
        </p>

        <div className="mt-5 flex items-center gap-2 flex-wrap">
          {WINDOW_OPTIONS.map((o) => (
            <button
              key={o.value}
              onClick={() => setWindowDays(o.value)}
              className={`text-[11px] font-mono px-2.5 py-1 rounded-full border transition ${
                windowDays === o.value
                  ? "bg-rose-500/15 text-rose-200 border-rose-500/30"
                  : "bg-white/[0.02] text-zinc-400 border-white/[0.06] hover:text-white"
              }`}
            >
              {o.label}
            </button>
          ))}
          {report && (
            <span className="text-[10px] font-mono text-zinc-500 ml-2">
              {report.totalRows} row{report.totalRows === 1 ? "" : "s"} · window {new Date(report.windowStart).toLocaleDateString()} → {new Date(report.windowEnd).toLocaleDateString()}
            </span>
          )}
        </div>
      </div>

      {error && (
        <div role="alert" aria-live="assertive" className="rounded-2xl border border-amber-500/[0.18] bg-amber-500/[0.04] p-5 mb-6 text-[13px] text-zinc-300">
          {error}
        </div>
      )}

      {!loading && !error && report && (
        report.totalRows === 0 ? (
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8 text-center text-[13px] text-zinc-400">
            No decisions logged in the selected window. Run an autonomy cycle (or wait for the */15 cron) to populate.
          </div>
        ) : (
          <>
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 mb-6 overflow-x-auto">
              <table className="text-[11px] font-mono">
                <thead>
                  <tr>
                    <th className="text-left text-zinc-500 uppercase tracking-wider pr-3 pb-2">stage \ outcome</th>
                    {report.outcomes.map((o) => (
                      <th key={o} className="text-left text-zinc-500 uppercase tracking-wider px-2 pb-2 whitespace-nowrap">{o}</th>
                    ))}
                    <th className="text-left text-zinc-500 uppercase tracking-wider px-2 pb-2">total</th>
                  </tr>
                </thead>
                <tbody>
                  {report.stages.map((stage) => (
                    <tr key={stage}>
                      <td className="text-zinc-200 pr-3 py-1 whitespace-nowrap">{stage}</td>
                      {report.outcomes.map((o) => {
                        const count = cellMap.get(`${stage}::${o}`) ?? 0;
                        return (
                          <td key={o} className="px-1 py-0.5">
                            <div className={`min-w-[44px] text-center rounded border px-1.5 py-0.5 ${heat(count, maxCount)}`}>
                              {count}
                            </div>
                          </td>
                        );
                      })}
                      <td className="text-zinc-200 px-2 py-1 font-bold">{report.perStageTotal[stage] ?? 0}</td>
                    </tr>
                  ))}
                  <tr className="border-t border-white/[0.06]">
                    <td className="text-zinc-500 pr-3 pt-2 uppercase tracking-wider">total</td>
                    {report.outcomes.map((o) => (
                      <td key={o} className="text-zinc-200 px-2 pt-2 font-bold">{report.perOutcomeTotal[o] ?? 0}</td>
                    ))}
                    <td className="text-zinc-200 px-2 pt-2 font-bold">{report.totalRows}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 mb-8">
              <div className="flex items-center gap-2 mb-3">
                <FireIcon className="h-4 w-4 text-rose-300" />
                <p className="text-[11px] font-mono text-rose-300/80 uppercase tracking-wider">// top hot spots</p>
              </div>
              {report.topHotspots.length === 0 ? (
                <p className="text-[12px] text-zinc-400 italic">No cells active in this window.</p>
              ) : (
                <ol className="space-y-1">
                  {report.topHotspots.map((h, i) => (
                    <li key={`${h.stage}-${h.outcome}-${i}`} className="flex items-center gap-2 text-[12px]">
                      <span className="text-[10px] font-mono text-zinc-500 w-5">{i + 1}.</span>
                      <span className="text-zinc-200">{h.stage}</span>
                      <span className="text-zinc-500">→</span>
                      <span className="text-zinc-300">{h.outcome}</span>
                      <span className="text-[10px] font-mono text-rose-300 ml-auto">×{h.count}</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </>
        )
      )}
    </div>
  );
}
