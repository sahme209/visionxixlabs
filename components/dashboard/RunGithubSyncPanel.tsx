"use client";

/**
 * RunGithubSyncPanel — release-candidate clickable GitHub sync trigger.
 *
 * Calls POST /api/github/sync and renders the canonical response:
 *
 *   live mode  →  authenticatedLogin, repo + workflow + branch-protection
 *                 counts, failing-workflow count, durationMs, rateLimit,
 *                 limitations[].
 *   preview    →  preview inventory counts + missingRequirements list.
 *
 * Read-only by construction — the scanner never mutates GitHub.
 * All errors come through apiFailure; never raw stack traces.
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

interface SyncSummaryLite {
  status?: string;
  repoCount: number;
  workflowCount: number;
  failingWorkflows: number;
}

interface SyncResultLite {
  mode?: string;
  source?: "live" | "partial" | "preview";
  authenticatedLogin?: string;
  inventory?: { durationMs?: number };
  summary?: SyncSummaryLite;
  limitations?: string[];
  rateLimit?: { remaining?: number; limit?: number; resetAt?: string };
}

type Phase = "idle" | "running" | "done" | "error";

const SOURCE_TONE: Record<string, { border: string; bg: string; text: string; dot: string; pill: string }> = {
  live:    { border: "border-emerald-500/[0.22]", bg: "bg-emerald-500/[0.04]", text: "text-emerald-300", dot: "bg-emerald-400 animate-pulse", pill: "bg-emerald-500/15 text-emerald-300" },
  partial: { border: "border-cyan-500/[0.22]",    bg: "bg-cyan-500/[0.04]",    text: "text-cyan-300",    dot: "bg-cyan-400 animate-pulse",    pill: "bg-cyan-500/15 text-cyan-300"       },
  preview: { border: "border-white/[0.22]",   bg: "bg-white/[0.04]",   text: "text-zinc-300",   dot: "bg-zinc-400",                 pill: "bg-white/15 text-zinc-300"     },
};

export function RunGithubSyncPanel() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<SyncResultLite | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);

  const runSync = async () => {
    setPhase("running");
    setError(null);
    setStartedAt(Date.now());
    try {
      const res = await fetch("/api/github/sync", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = (await res.json()) as { ok?: boolean; data?: SyncResultLite; error?: { userMessage?: string } };
      if (json.ok && json.data) {
        setResult(json.data);
        setPhase("done");
      } else {
        setError(json.error?.userMessage ?? `Sync failed (HTTP ${res.status}).`);
        setPhase("error");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error.");
      setPhase("error");
    }
  };

  const source = result?.source ?? "preview";
  const tone = SOURCE_TONE[source] ?? SOURCE_TONE.preview;
  const summary = result?.summary;

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 mb-6">
      <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
        <div className="min-w-0">
          <p className="text-[11px] font-mono text-zinc-500 uppercase tracking-[0.18em] mb-1">// step 2 · run a read-only sync</p>
          <h3 className="text-base font-semibold text-white tracking-tight">Trigger a demo GitHub sync now</h3>
          <p className="text-[12px] text-zinc-400 leading-relaxed mt-0.5">
            Read-only — no mutation, no PR commits. Scans Axiom&apos;s own demonstration repository (not your organization&apos;s GitHub) to discover repos, workflows, branch protection, and deployment environments.
          </p>
        </div>
        <button
          type="button"
          onClick={runSync}
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
              Syncing…
            </>
          ) : phase === "done" || phase === "error" ? (
            <>
              <ArrowPathIcon className="h-4 w-4" />
              Run again
            </>
          ) : (
            <>
              <PlayCircleIcon className="h-4 w-4" />
              Run GitHub sync
            </>
          )}
        </button>
      </div>

      {/* Idle hint */}
      {phase === "idle" && (
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
          <p className="text-[11px] text-zinc-500 leading-relaxed font-mono">
            POST /api/github/sync · live when GITHUB_PAT or GITHUB_APP_* set + GITHUB_SYNC_MODE=live; honest preview otherwise.
          </p>
        </div>
      )}

      {/* Running — honest progress */}
      {phase === "running" && (
        <div className="rounded-lg border border-cyan-500/[0.22] bg-cyan-500/[0.04] px-3 py-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <p className="text-[12px] text-cyan-200 font-mono">
              Calling GET /user · /orgs/{"{org}"}/repos · /actions/workflows · /branches/{"{branch}"}/protection
            </p>
          </div>
          {startedAt && (
            <p className="text-[10px] text-zinc-500 font-mono mt-1.5">
              elapsed {((Date.now() - startedAt) / 1000).toFixed(1)}s · target &lt; 6s
            </p>
          )}
        </div>
      )}

      {/* Error */}
      {phase === "error" && (
        <div className="rounded-lg border border-rose-500/[0.22] bg-rose-500/[0.04] px-3 py-3">
          <div className="flex items-start gap-2">
            <ExclamationTriangleIcon className="h-4 w-4 text-rose-300 mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="text-[11px] font-mono text-rose-300/80 uppercase tracking-wider mb-1">// sync failed</p>
              <p className="text-[12px] text-zinc-300 leading-relaxed">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Done */}
      {phase === "done" && result && (
        <div className={`rounded-lg border ${tone.border} ${tone.bg} p-4`}>
          {/* Header */}
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 ${tone.pill}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${tone.dot}`} />
              <span className="text-[10px] font-semibold uppercase tracking-widest">{source} mode</span>
            </span>
            {result.authenticatedLogin && (
              <span className="text-[10px] font-mono text-zinc-500">authenticated as {result.authenticatedLogin}</span>
            )}
            {result.rateLimit && typeof result.rateLimit.remaining === "number" && typeof result.rateLimit.limit === "number" && (
              <span className="text-[10px] font-mono text-zinc-500 ml-auto">rate-limit {result.rateLimit.remaining}/{result.rateLimit.limit}</span>
            )}
          </div>

          {/* Stats */}
          {summary && (
            <div className="grid sm:grid-cols-3 gap-3 mb-3">
              <ResultStat label="Repos" value={String(summary.repoCount)} />
              <ResultStat label="Workflows" value={String(summary.workflowCount)} />
              <ResultStat
                label="Failing workflows"
                value={String(summary.failingWorkflows)}
                tone={summary.failingWorkflows > 0 ? "text-zinc-300" : "text-emerald-300"}
              />
            </div>
          )}

          {/* Duration */}
          {result.inventory?.durationMs && (
            <p className="text-[10px] font-mono text-zinc-500 mb-3">duration {result.inventory.durationMs}ms</p>
          )}

          {/* Empty / healthy state */}
          {summary && summary.failingWorkflows === 0 && summary.repoCount > 0 && (
            <div className="rounded-md border border-emerald-500/[0.22] bg-emerald-500/[0.04] p-3 flex items-center gap-2">
              <CheckCircleIcon className="h-4 w-4 text-emerald-300 shrink-0" />
              <p className="text-[12px] text-emerald-100 font-semibold">
                All workflows are passing. Branch protection + deployment env discovery complete.
              </p>
            </div>
          )}

          {/* Limitations */}
          {result.limitations && result.limitations.length > 0 && (
            <div className="mt-3 pt-3 border-t border-white/[0.06]">
              <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider mb-1">// limitations</p>
              <ul className="space-y-0.5">
                {result.limitations.slice(0, 3).map((l, i) => (
                  <li key={i} className="text-[11px] text-zinc-400 leading-snug">{l}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Next step */}
          <div className="mt-3 pt-3 border-t border-white/[0.06] flex items-center justify-between gap-3">
            <p className="text-[11px] text-zinc-500">Next safe step</p>
            <Link
              href={summary && summary.failingWorkflows > 0 ? "/dashboard/releaseops" : "/dashboard/command-center"}
              className="inline-flex items-center gap-1.5 text-[12px] font-medium text-zinc-200 hover:text-white border border-white/[0.08] hover:border-white/[0.2] rounded-md px-2.5 py-1.5 transition-colors"
            >
              {summary && summary.failingWorkflows > 0 ? "Review failing workflows" : "Open Command Center"}
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
