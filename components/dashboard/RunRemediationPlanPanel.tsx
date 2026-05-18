"use client";

/**
 * RunRemediationPlanPanel — clickable Remediation Pipeline trigger.
 *
 * POSTs /api/remediation/plan (zero-body) and renders the canonical
 * RemediationPipelineOutcome:
 *   - candidate summary (total / by-source / by-risk)
 *   - first bundle preview (rule code, risk, remediation type, blast)
 *   - trace phases
 *   - limitations
 *
 * Read-only. The pipeline is pure-function over scanner output —
 * no Terraform apply, no CLI apply, approval-gated by design.
 */

import { useState } from "react";
import Link from "next/link";
import {
  PlayCircleIcon,
  ArrowPathIcon,
  ArrowRightIcon,
  ExclamationTriangleIcon,
  WrenchScrewdriverIcon,
  CheckCircleIcon,
} from "@heroicons/react/24/outline";

interface BundleLite {
  id?: string;
  candidate?: {
    id?: string;
    sourceSystem?: string;
    ruleCode?: string;
    risk?: string;
    remediationType?: string;
    blastRadius?: string;
    title?: string;
  };
  terraformPreview?: { available?: boolean };
  cliPreview?: { available?: boolean };
  rollbackPlan?: { available?: boolean };
  verificationChecklist?: { available?: boolean };
}

interface PipelineOutcomeLite {
  generatedAt?: string;
  tenantId?: string;
  bundles?: BundleLite[];
  summary?: {
    total?: number;
    bySource?: Record<string, number>;
    byRisk?: Record<string, number>;
    approvalGated?: number;
    desktopReviewEligible?: number;
  };
  trace?: { phase?: string; durationMs?: number; outcome?: string }[];
  limitations?: string[];
}

type Phase = "idle" | "running" | "done" | "error";

export function RunRemediationPlanPanel() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<PipelineOutcomeLite | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);

  const runPlan = async () => {
    setPhase("running");
    setError(null);
    setStartedAt(Date.now());
    try {
      const res = await fetch("/api/remediation/plan", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = (await res.json()) as { ok?: boolean; data?: PipelineOutcomeLite; error?: { userMessage?: string } };
      if (json.ok && json.data) {
        setResult(json.data);
        setPhase("done");
      } else {
        setError(json.error?.userMessage ?? `Pipeline failed (HTTP ${res.status}).`);
        setPhase("error");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error.");
      setPhase("error");
    }
  };

  const bundles = result?.bundles ?? [];
  const total = result?.summary?.total ?? bundles.length;
  const byRisk = result?.summary?.byRisk ?? {};
  const approvalGated = result?.summary?.approvalGated ?? 0;
  const desktopReviewEligible = result?.summary?.desktopReviewEligible ?? 0;

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 mb-6">
      <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
        <div className="min-w-0">
          <p className="text-[11px] font-mono text-zinc-500 uppercase tracking-[0.18em] mb-1">// run the read-only remediation pipeline</p>
          <h3 className="text-base font-semibold text-white tracking-tight">Build remediation plan</h3>
          <p className="text-[12px] text-zinc-400 leading-relaxed mt-0.5">
            Composes Terraform / CLI previews + rollback plans + verification checklists from scanner findings. <span className="text-zinc-500">No apply. No mutation.</span>
          </p>
        </div>
        <button
          type="button"
          onClick={runPlan}
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
              Building plan…
            </>
          ) : phase === "done" || phase === "error" ? (
            <>
              <ArrowPathIcon className="h-4 w-4" />
              Run again
            </>
          ) : (
            <>
              <PlayCircleIcon className="h-4 w-4" />
              Build remediation plan
            </>
          )}
        </button>
      </div>

      {phase === "idle" && (
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
          <p className="text-[11px] text-zinc-500 leading-relaxed font-mono">
            POST /api/remediation/plan · composes candidates → Terraform/CLI previews → rollback → verification
          </p>
        </div>
      )}

      {phase === "running" && (
        <div className="rounded-lg border border-cyan-500/[0.22] bg-cyan-500/[0.04] px-3 py-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <p className="text-[12px] text-cyan-200 font-mono">
              Scoring findings · generating previews · computing rollback + verification
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
              <p className="text-[11px] font-mono text-rose-300/80 uppercase tracking-wider mb-1">// pipeline failed</p>
              <p className="text-[12px] text-zinc-300 leading-relaxed">{error}</p>
            </div>
          </div>
        </div>
      )}

      {phase === "done" && result && (
        <div className="rounded-lg border border-emerald-500/[0.18] bg-emerald-500/[0.04] p-4">
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <WrenchScrewdriverIcon className="h-4 w-4 text-emerald-300" />
            <span className="text-[10px] font-semibold text-emerald-300 uppercase tracking-widest">{total} candidate{total === 1 ? "" : "s"}</span>
            {result.generatedAt && (
              <span className="text-[10px] font-mono text-zinc-500 ml-auto">generated {new Date(result.generatedAt).toLocaleTimeString()}</span>
            )}
          </div>

          {total === 0 ? (
            <div className="rounded-md border border-emerald-500/[0.22] bg-emerald-500/[0.04] p-3 flex items-center gap-2">
              <CheckCircleIcon className="h-4 w-4 text-emerald-300 shrink-0" />
              <p className="text-[12px] text-emerald-100 font-semibold">No remediation candidates needed — scanner found nothing actionable.</p>
            </div>
          ) : (
            <>
              {/* Risk + gating breakdown */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                <ResultStat label="Critical" value={String(byRisk.critical ?? 0)} tone={(byRisk.critical ?? 0) > 0 ? "text-rose-300" : "text-zinc-400"} />
                <ResultStat label="High" value={String(byRisk.high ?? 0)} tone={(byRisk.high ?? 0) > 0 ? "text-amber-300" : "text-zinc-400"} />
                <ResultStat label="Approval-gated" value={String(approvalGated)} tone="text-violet-300" />
                <ResultStat label="Desktop-eligible" value={String(desktopReviewEligible)} tone="text-cyan-300" />
              </div>

              {/* Top 3 bundles */}
              {bundles.length > 0 && (
                <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-3">
                  <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider mb-2">// top candidates</p>
                  <ul className="space-y-1.5">
                    {bundles.slice(0, 3).map((b, i) => {
                      const c = b.candidate;
                      return (
                        <li key={b.id ?? i} className="flex items-start gap-2 text-[11.5px]">
                          <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${
                            c?.risk === "critical" ? "bg-rose-400" :
                            c?.risk === "high"     ? "bg-amber-400" :
                                                     "bg-zinc-500"
                          }`} />
                          <div className="min-w-0 flex-1">
                            <p className="text-zinc-200 truncate">{c?.title ?? c?.ruleCode ?? "candidate"}</p>
                            <p className="text-[10px] text-zinc-500 font-mono">
                              {c?.sourceSystem ?? "—"} · {c?.remediationType ?? "—"} · blast: {c?.blastRadius ?? "unknown"}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {b.terraformPreview?.available && <span className="text-[9px] font-mono px-1 py-px rounded bg-violet-500/15 text-violet-300">TF</span>}
                            {b.cliPreview?.available && <span className="text-[9px] font-mono px-1 py-px rounded bg-cyan-500/15 text-cyan-300">CLI</span>}
                            {b.rollbackPlan?.available && <span className="text-[9px] font-mono px-1 py-px rounded bg-emerald-500/15 text-emerald-300">RB</span>}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                  {bundles.length > 3 && (
                    <p className="text-[10px] font-mono text-zinc-500 mt-2">+ {bundles.length - 3} more — open Remediation Center for full list</p>
                  )}
                </div>
              )}
            </>
          )}

          {/* Limitations */}
          {result.limitations && result.limitations.length > 0 && (
            <div className="mt-3 pt-3 border-t border-white/[0.06]">
              <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider mb-1">// limitations</p>
              <ul className="space-y-0.5">
                {result.limitations.slice(0, 2).map((l, i) => (
                  <li key={i} className="text-[11px] text-zinc-400 leading-snug">{l}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Next step */}
          <div className="mt-3 pt-3 border-t border-white/[0.06] flex items-center justify-between gap-3">
            <p className="text-[11px] text-zinc-500">Next safe step</p>
            <Link
              href="/dashboard/simulations"
              className="inline-flex items-center gap-1.5 text-[12px] font-medium text-zinc-200 hover:text-white border border-white/[0.08] hover:border-white/[0.2] rounded-md px-2.5 py-1.5 transition-colors"
            >
              Simulate candidates
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
