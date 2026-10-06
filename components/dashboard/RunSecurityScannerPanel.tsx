"use client";

/**
 * RunSecurityScannerPanel — clickable Security Scanner trigger.
 *
 * POSTs /api/security-scan and renders the canonical SecurityScanOutcome:
 *   - pass / warn / fail / unknown / preview counts
 *   - 0..1 score (rendered as %)
 *   - top-risk check title + scope
 *   - mode tag (live_signals_partial / preview)
 *
 * Read-only. The scanner is pure-function over current platform signals.
 */

import { useState } from "react";
import Link from "next/link";
import {
  PlayCircleIcon,
  ArrowPathIcon,
  ArrowRightIcon,
  ExclamationTriangleIcon,
  ShieldCheckIcon,
} from "@heroicons/react/24/outline";

interface ScanResultLite {
  generatedAt?: string;
  mode?: string;
  summary?: {
    total: number;
    pass: number;
    fail: number;
    warn: number;
    unknown: number;
    preview: number;
    score: number;
    topRisk?: { id: string; title: string; semantic?: string; scope?: string };
  };
  results?: { id: string; title: string; semantic: string; scope?: string }[];
}

type Phase = "idle" | "running" | "done" | "error";

export function RunSecurityScannerPanel() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<ScanResultLite | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);

  const runScan = async () => {
    setPhase("running");
    setError(null);
    setStartedAt(Date.now());
    try {
      const res = await fetch("/api/security-scan", {
        method: "POST",
        credentials: "include",
      });
      const json = (await res.json()) as { ok?: boolean; data?: ScanResultLite; error?: { userMessage?: string } };
      if (json.ok && json.data) {
        setResult(json.data);
        setPhase("done");
      } else {
        setError(json.error?.userMessage ?? `Scan failed (HTTP ${res.status}).`);
        setPhase("error");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error.");
      setPhase("error");
    }
  };

  const summary = result?.summary;
  const scorePct = summary ? Math.round(summary.score * 100) : null;
  const topRisk = summary?.topRisk;
  const mode = result?.mode ?? "preview";
  const isLive = mode === "live_signals_partial";

  const modePill = isLive
    ? "bg-cyan-500/15 text-cyan-300"
    : "bg-white/15 text-zinc-300";

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 mb-6">
      <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
        <div className="min-w-0">
          <p className="text-[11px] font-mono text-zinc-500 uppercase tracking-[0.18em] mb-1">// run the cross-cutting security scanner</p>
          <h3 className="text-base font-semibold text-white tracking-tight">Run security scan now</h3>
          <p className="text-[12px] text-zinc-400 leading-relaxed mt-0.5">
            App + supply-chain + desktop checks. Pure-function over platform signals — no SDK calls, no mutation.
          </p>
        </div>
        <button
          type="button"
          onClick={runScan}
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
              Scanning…
            </>
          ) : phase === "done" || phase === "error" ? (
            <>
              <ArrowPathIcon className="h-4 w-4" />
              Run again
            </>
          ) : (
            <>
              <PlayCircleIcon className="h-4 w-4" />
              Run security scan
            </>
          )}
        </button>
      </div>

      {phase === "idle" && (
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
          <p className="text-[11px] text-zinc-500 leading-relaxed font-mono">
            POST /api/security-scan · evaluates redaction, audit store, copilot context, supply chain, desktop signing
          </p>
        </div>
      )}

      {phase === "running" && (
        <div className="rounded-lg border border-cyan-500/[0.22] bg-cyan-500/[0.04] px-3 py-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <p className="text-[12px] text-cyan-200 font-mono">
              Evaluating app + supply-chain + desktop checks · pure-function over canonical state
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
              <p className="text-[11px] font-mono text-rose-300/80 uppercase tracking-wider mb-1">// scan failed</p>
              <p className="text-[12px] text-zinc-300 leading-relaxed">{error}</p>
            </div>
          </div>
        </div>
      )}

      {phase === "done" && summary && (
        <div className="rounded-lg border border-emerald-500/[0.18] bg-emerald-500/[0.04] p-4">
          {/* Header */}
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <span className={`text-[10px] font-mono uppercase tracking-wider rounded-full px-2 py-0.5 ${modePill}`}>
              {mode.replace(/_/g, " ")}
            </span>
            {result?.generatedAt && (
              <span className="text-[10px] font-mono text-zinc-500">generated {new Date(result.generatedAt).toLocaleTimeString()}</span>
            )}
            {scorePct !== null && (
              <span className="text-[10px] font-mono text-zinc-500 ml-auto">score {scorePct}%</span>
            )}
          </div>

          {/* 5-stat grid */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-3">
            <ResultStat label="Pass" value={String(summary.pass)} tone="text-emerald-300" />
            <ResultStat label="Warn" value={String(summary.warn)} tone={summary.warn > 0 ? "text-zinc-300" : "text-zinc-400"} />
            <ResultStat label="Fail" value={String(summary.fail)} tone={summary.fail > 0 ? "text-rose-300" : "text-zinc-400"} />
            <ResultStat label="Preview" value={String(summary.preview)} tone="text-zinc-300" />
            <ResultStat label="Unknown" value={String(summary.unknown)} tone="text-zinc-400" />
          </div>

          {/* Top risk */}
          {topRisk ? (
            <div className="rounded-md border border-white/[0.18] bg-white/[0.04] p-3">
              <p className="text-[10px] font-mono text-zinc-300/80 uppercase tracking-wider mb-1">// highest unresolved check</p>
              <p className="text-[12.5px] text-zinc-200 font-semibold tracking-tight">{topRisk.title}</p>
              {topRisk.scope && (
                <p className="text-[10px] font-mono text-zinc-500 mt-0.5">scope: {topRisk.scope}</p>
              )}
            </div>
          ) : (
            <div className="rounded-md border border-emerald-500/[0.22] bg-emerald-500/[0.04] p-3 flex items-center gap-2">
              <ShieldCheckIcon className="h-4 w-4 text-emerald-300 shrink-0" />
              <p className="text-[12px] text-emerald-100 font-semibold">No unresolved high-risk checks.</p>
            </div>
          )}

          {/* Next step */}
          <div className="mt-3 pt-3 border-t border-white/[0.06] flex items-center justify-between gap-3">
            <p className="text-[11px] text-zinc-500">Next safe step</p>
            <Link
              href="/dashboard/remediation"
              className="inline-flex items-center gap-1.5 text-[12px] font-medium text-zinc-200 hover:text-white border border-white/[0.08] hover:border-white/[0.2] rounded-md px-2.5 py-1.5 transition-colors"
            >
              Open Remediation
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
