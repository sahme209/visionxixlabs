"use client";

/**
 * RunOperatingLoopPanel — clickable safe-stage advance of every provider
 * operating loop. POSTs /api/operating-loop/run (zero-body).
 *
 * The runner walks each provider's loop through SAFE stages only and
 * halts at approval / preflight / verification boundaries. No mutation.
 *
 * Renders:
 *   - providersAdvanced / providersBlocked / providersPausedForApproval
 *   - per-provider report rows (provider, status, currentStage)
 */

import { useState } from "react";
import Link from "next/link";
import {
  PlayCircleIcon,
  ArrowPathIcon,
  ArrowRightIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
} from "@heroicons/react/24/outline";

interface LoopReportLite {
  run?: {
    provider?: string;
    status?: string;
    currentStage?: string;
    sourceMode?: string;
  };
  topSafeNextAction?: { label: string; href: string };
}

interface LoopOutcomeLite {
  reports?: LoopReportLite[];
  summary?: {
    providersAdvanced: number;
    providersBlocked: number;
    providersPausedForApproval: number;
    providersPausedForInput: number;
  };
}

type Phase = "idle" | "running" | "done" | "error";

export function RunOperatingLoopPanel() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<LoopOutcomeLite | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);

  const runLoop = async () => {
    setPhase("running");
    setError(null);
    setStartedAt(Date.now());
    try {
      const res = await fetch("/api/operating-loop/run", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = (await res.json()) as { ok?: boolean; data?: LoopOutcomeLite; error?: { userMessage?: string } };
      if (json.ok && json.data) {
        setResult(json.data);
        setPhase("done");
      } else {
        setError(json.error?.userMessage ?? `Loop run failed (HTTP ${res.status}).`);
        setPhase("error");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error.");
      setPhase("error");
    }
  };

  const summary = result?.summary;
  const reports = result?.reports ?? [];

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 mb-6">
      <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
        <div className="min-w-0">
          <p className="text-[11px] font-mono text-zinc-500 uppercase tracking-[0.18em] mb-1">// advance every operating loop, safely</p>
          <h3 className="text-base font-semibold text-white tracking-tight">Run operating loop</h3>
          <p className="text-[12px] text-zinc-400 leading-relaxed mt-0.5">
            Walks AWS / Azure / GCP / GitHub / Desktop / Security loops through safe stages only. Halts at approval / preflight / verification. <span className="text-zinc-500">No mutation paths reachable from this button.</span>
          </p>
        </div>
        <button
          type="button"
          onClick={runLoop}
          disabled={phase === "running"}
          className={`inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-[13px] font-semibold transition-all ${
            phase === "running"
              ? "border-white/[0.08] bg-white/[0.02] text-zinc-400 cursor-wait"
              : "border-emerald-500/30 bg-emerald-500/[0.10] text-emerald-200 hover:border-emerald-500/50 hover:bg-emerald-500/[0.15]"
          }`}
        >
          {phase === "running" ? (
            <>
              <ArrowPathIcon className="h-4 w-4 animate-spin" />
              Advancing…
            </>
          ) : phase === "done" || phase === "error" ? (
            <>
              <ArrowPathIcon className="h-4 w-4" />
              Run again
            </>
          ) : (
            <>
              <PlayCircleIcon className="h-4 w-4" />
              Run loop
            </>
          )}
        </button>
      </div>

      {phase === "idle" && (
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
          <p className="text-[11px] text-zinc-500 leading-relaxed font-mono">
            POST /api/operating-loop/run · runner refuses approval / preflight / verification stages
          </p>
        </div>
      )}

      {phase === "running" && (
        <div className="rounded-lg border border-cyan-500/[0.22] bg-cyan-500/[0.04] px-3 py-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <p className="text-[12px] text-cyan-200 font-mono">
              Walking AWS · Azure · GCP · GitHub · Desktop · Security loops · safe stages only
            </p>
          </div>
          {startedAt && (
            <p className="text-[10px] text-zinc-500 font-mono mt-1.5">
              elapsed {((Date.now() - startedAt) / 1000).toFixed(1)}s
            </p>
          )}
        </div>
      )}

      {phase === "error" && (
        <div className="rounded-lg border border-rose-500/[0.22] bg-rose-500/[0.04] px-3 py-3">
          <div className="flex items-start gap-2">
            <ExclamationTriangleIcon className="h-4 w-4 text-rose-300 mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="text-[11px] font-mono text-rose-300/80 uppercase tracking-wider mb-1">// loop run failed</p>
              <p className="text-[12px] text-zinc-300 leading-relaxed">{error}</p>
            </div>
          </div>
        </div>
      )}

      {phase === "done" && summary && (
        <div className="rounded-lg border border-emerald-500/[0.18] bg-emerald-500/[0.04] p-4">
          {/* 4-stat summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
            <ResultStat label="Advanced" value={String(summary.providersAdvanced)} tone="text-emerald-300" />
            <ResultStat label="Paused (approval)" value={String(summary.providersPausedForApproval)} tone={summary.providersPausedForApproval > 0 ? "text-amber-300" : "text-zinc-400"} />
            <ResultStat label="Paused (input)" value={String(summary.providersPausedForInput)} tone={summary.providersPausedForInput > 0 ? "text-cyan-300" : "text-zinc-400"} />
            <ResultStat label="Blocked" value={String(summary.providersBlocked)} tone={summary.providersBlocked > 0 ? "text-rose-300" : "text-zinc-400"} />
          </div>

          {/* Per-provider rows */}
          {reports.length > 0 && (
            <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-3">
              <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider mb-2">// per-provider</p>
              <ul className="space-y-1.5">
                {reports.slice(0, 6).map((r, i) => {
                  const run = r.run;
                  const status = run?.status ?? "unknown";
                  return (
                    <li key={i} className="flex items-start gap-2 text-[11.5px]">
                      <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${
                        status === "completed"            ? "bg-emerald-400" :
                        status === "in_progress"          ? "bg-cyan-400 animate-pulse" :
                        status === "paused_for_approval"  ? "bg-amber-400"   :
                        status === "paused_for_user_input"? "bg-cyan-400"    :
                        status === "blocked"              ? "bg-rose-400"    :
                        status === "failed"               ? "bg-rose-500"    :
                                                            "bg-zinc-500"
                      }`} />
                      <div className="min-w-0 flex-1">
                        <p className="text-zinc-200 font-mono truncate">{run?.provider ?? "—"}</p>
                        {run?.currentStage && (
                          <p className="text-[10px] text-zinc-500 font-mono">{run.currentStage.replace(/_/g, " ")}</p>
                        )}
                      </div>
                      <span className="text-[9px] font-mono uppercase tracking-wider text-zinc-400 shrink-0">{status.replace(/_/g, " ")}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {summary.providersBlocked === 0 && summary.providersPausedForApproval === 0 && (
            <div className="rounded-md border border-emerald-500/[0.22] bg-emerald-500/[0.04] p-3 mt-3 flex items-center gap-2">
              <CheckCircleIcon className="h-4 w-4 text-emerald-300 shrink-0" />
              <p className="text-[12px] text-emerald-100 font-semibold">All loops advanced safely · no blockers, no pending approvals.</p>
            </div>
          )}

          {/* Next step */}
          <div className="mt-3 pt-3 border-t border-white/[0.06] flex items-center justify-between gap-3">
            <p className="text-[11px] text-zinc-500">Next safe step</p>
            <Link
              href={summary.providersPausedForApproval > 0 ? "/dashboard/approvals" : "/dashboard"}
              className="inline-flex items-center gap-1.5 text-[12px] font-medium text-zinc-200 hover:text-white border border-white/[0.08] hover:border-white/[0.2] rounded-md px-2.5 py-1.5 transition-colors"
            >
              {summary.providersPausedForApproval > 0 ? "Review approvals" : "Open Command Center"}
              <ArrowRightIcon className="h-3 w-3" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function ResultStat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-md border border-white/[0.06] bg-white/[0.02] px-3 py-2">
      <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider mb-0.5">{label}</p>
      <p className={`text-lg font-bold tracking-tight leading-none ${tone ?? "text-white"}`}>{value}</p>
    </div>
  );
}
