"use client";

/**
 * RunAwsScanPanel — production-grade clickable AWS scan trigger.
 *
 * Calls POST /api/aws/scan with the ambient config (no client-side
 * credentials). Renders the real canonical response:
 *
 *   - source mode pill ("live" / "partial" / "preview")
 *   - resource count from snapshot
 *   - finding count + top 3 honest findings (rule code · risk · resource)
 *   - duration
 *   - missingRequirements list + setup CTA if blocked
 *   - safeNextAction CTA
 *
 * Strictly read-only: the scan pipeline performs SDK reads, no mutation.
 * All errors are surfaced through the apiFailure envelope, never raw
 * stack traces.
 */

import { useState } from "react";
import Link from "next/link";
import {
  PlayCircleIcon,
  ArrowPathIcon,
  ShieldCheckIcon,
  ArrowRightIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";

interface ScanFinding {
  ruleCode?: string;
  risk?: string;
  resourceRef?: string;
  message?: string;
}

interface ScanSnapshotLite {
  resourceCounts?: Record<string, number>;
  resources?: { id: string }[];
}

interface ScanPreviewLite {
  snapshot?: ScanSnapshotLite;
  findings?: ScanFinding[];
  recommendations?: unknown[];
  durationMs?: number;
}

interface ScanResultLite {
  ok?: boolean;
  source?: "live" | "partial" | "preview";
  mode?: string;
  provider?: string;
  correlationId?: string;
  accountId?: string;
  multiRegion?: boolean;
  preview?: ScanPreviewLite;
  validation?: unknown;
  perRegion?: { region: string; resourceCount?: number; findingCount?: number }[];
  missingRequirements?: string[];
  limitations?: string[];
  message?: string;
  safeNextAction?: { label: string; href: string };
  traceId?: string;
}

type Phase = "idle" | "running" | "done" | "error";

const SOURCE_TONE: Record<string, { border: string; bg: string; text: string; dot: string; pill: string }> = {
  live:    { border: "border-emerald-500/[0.22]", bg: "bg-emerald-500/[0.04]", text: "text-emerald-300", dot: "bg-emerald-400 animate-pulse", pill: "bg-emerald-500/15 text-emerald-300" },
  partial: { border: "border-cyan-500/[0.22]",    bg: "bg-cyan-500/[0.04]",    text: "text-cyan-300",    dot: "bg-cyan-400 animate-pulse",    pill: "bg-cyan-500/15 text-cyan-300"       },
  preview: { border: "border-white/[0.22]",   bg: "bg-white/[0.04]",   text: "text-zinc-300",   dot: "bg-zinc-400",                 pill: "bg-white/15 text-zinc-300"     },
};

export function RunAwsScanPanel() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<ScanResultLite | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);

  const runScan = async () => {
    setPhase("running");
    setError(null);
    setStartedAt(Date.now());
    try {
      const res = await fetch("/api/aws/scan", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ requestLive: true }),
      });
      const json = (await res.json()) as { ok?: boolean; data?: ScanResultLite; error?: { userMessage?: string; category?: string } };
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

  const source = result?.source ?? "preview";
  const tone = SOURCE_TONE[source] ?? SOURCE_TONE.preview;
  const resourceCount = result?.preview?.snapshot?.resources?.length
    ?? (result?.preview?.snapshot?.resourceCounts
      ? Object.values(result.preview.snapshot.resourceCounts).reduce((a, b) => a + b, 0)
      : undefined);
  const findings = result?.preview?.findings ?? [];

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 mb-6">
      <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
        <div className="min-w-0">
          <p className="text-[11px] font-mono text-zinc-500 uppercase tracking-[0.18em] mb-1">// step 2 · run a read-only scan</p>
          <h3 className="text-base font-semibold text-white tracking-tight">Trigger an AWS scan now</h3>
          <p className="text-[12px] text-zinc-400 leading-relaxed mt-0.5">
            Read-only — no mutation, no apply. The pipeline returns a snapshot, findings, and honest source mode.
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
              Run AWS scan
            </>
          )}
        </button>
      </div>

      {/* Idle hint */}
      {phase === "idle" && (
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
          <p className="text-[11px] text-zinc-500 leading-relaxed font-mono">
            POST /api/aws/scan · uses ambient AWS_ROLE_ARN / AWS_EXTERNAL_ID / AWS_REGION when set; degrades to honest preview otherwise.
          </p>
        </div>
      )}

      {/* Running — honest progress */}
      {phase === "running" && (
        <div className="rounded-lg border border-cyan-500/[0.22] bg-cyan-500/[0.04] px-3 py-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <p className="text-[12px] text-cyan-200 font-mono">
              Calling STS · AssumeRole · GetCallerIdentity · EC2 · S3 · RDS · VPC · SG · IAM
            </p>
          </div>
          {startedAt && (
            <p className="text-[10px] text-zinc-500 font-mono mt-1.5">
              elapsed {((Date.now() - startedAt) / 1000).toFixed(1)}s · target &lt; 8s per region
            </p>
          )}
        </div>
      )}

      {/* Error — safe message */}
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

      {/* Done — render canonical result */}
      {phase === "done" && result && (
        <div className={`rounded-lg border ${tone.border} ${tone.bg} p-4`}>
          {/* Header: source mode + account + multi-region flag */}
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 ${tone.pill}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${tone.dot}`} />
              <span className="text-[10px] font-semibold uppercase tracking-widest">{source} mode</span>
            </span>
            {result.accountId && (
              <span className="text-[10px] font-mono text-zinc-500">account {result.accountId.slice(0, 12)}{result.accountId.length > 12 ? "…" : ""}</span>
            )}
            {result.multiRegion && (
              <span className="text-[9px] font-mono uppercase tracking-wider text-zinc-500 border border-white/[0.06] rounded-full px-1.5 py-px">multi-region</span>
            )}
            {result.correlationId && (
              <span className="text-[10px] font-mono text-zinc-500 ml-auto">trace {result.correlationId.slice(0, 14)}</span>
            )}
          </div>

          {/* Preview path: scan ran but blocked (no creds) */}
          {result.ok === false && (
            <div className="mb-3">
              <p className="text-[12.5px] text-zinc-200 font-semibold mb-1">{result.message ?? "Scan returned preview-only state."}</p>
              {result.missingRequirements && result.missingRequirements.length > 0 && (
                <div className="rounded-md border border-white/[0.18] bg-white/[0.04] p-2 mt-2">
                  <p className="text-[10px] font-mono text-zinc-300/80 uppercase tracking-wider mb-1">// missing config</p>
                  <ul className="space-y-0.5">
                    {result.missingRequirements.map((req, i) => (
                      <li key={i} className="text-[11px] text-zinc-300 font-mono">{req}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Successful scan: real counts + top findings */}
          {result.ok && result.preview && (
            <>
              <div className="grid sm:grid-cols-3 gap-3 mb-3">
                <ResultStat label="Resources" value={typeof resourceCount === "number" ? String(resourceCount) : "—"} />
                <ResultStat label="Findings" value={String(findings.length)} tone={findings.length > 0 ? "text-zinc-300" : "text-emerald-300"} />
                <ResultStat label="Duration" value={typeof result.preview.durationMs === "number" ? `${result.preview.durationMs}ms` : "—"} />
              </div>

              {findings.length > 0 && (
                <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-3">
                  <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider mb-2">// top findings</p>
                  <ul className="space-y-1.5">
                    {findings.slice(0, 3).map((f, i) => (
                      <li key={i} className="flex items-start gap-2 text-[11.5px]">
                        <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${
                          f.risk === "critical" ? "bg-rose-400" :
                          f.risk === "high"     ? "bg-zinc-400" :
                          f.risk === "medium"   ? "bg-zinc-400" :
                                                  "bg-zinc-500"
                        }`} />
                        <div className="min-w-0 flex-1">
                          <p className="text-zinc-200 font-mono truncate">{f.ruleCode ?? "rule"}</p>
                          {f.resourceRef && <p className="text-[10px] text-zinc-500 font-mono truncate">{f.resourceRef}</p>}
                        </div>
                        {f.risk && (
                          <span className={`text-[9px] font-mono uppercase tracking-wider px-1.5 py-px rounded shrink-0 ${
                            f.risk === "critical" ? "bg-rose-500/15 text-rose-300" :
                            f.risk === "high"     ? "bg-white/15 text-zinc-300" :
                                                    "bg-zinc-700/40 text-zinc-300"
                          }`}>{f.risk}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                  {findings.length > 3 && (
                    <p className="text-[10px] font-mono text-zinc-500 mt-2">+ {findings.length - 3} more · open Security Scanner to view all</p>
                  )}
                </div>
              )}

              {findings.length === 0 && (
                <div className="rounded-md border border-emerald-500/[0.22] bg-emerald-500/[0.04] p-3 flex items-center gap-2">
                  <ShieldCheckIcon className="h-4 w-4 text-emerald-300 shrink-0" />
                  <p className="text-[12px] text-emerald-100 font-semibold">No findings emitted by this scan.</p>
                </div>
              )}
            </>
          )}

          {/* Limitations from canonical response */}
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

          {/* safeNextAction */}
          {result.safeNextAction && (
            <div className="mt-3 pt-3 border-t border-white/[0.06] flex items-center justify-between gap-3">
              <p className="text-[11px] text-zinc-500">Next safe step</p>
              <Link
                href={result.safeNextAction.href}
                className="inline-flex items-center gap-1.5 text-[12px] font-medium text-zinc-200 hover:text-white border border-white/[0.08] hover:border-white/[0.2] rounded-md px-2.5 py-1.5 transition-colors"
              >
                {result.safeNextAction.label}
                <ArrowRightIcon className="h-3 w-3" />
              </Link>
            </div>
          )}
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
