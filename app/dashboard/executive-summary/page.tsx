"use client";

/**
 * /dashboard/executive-summary
 *
 * Single canonical executive view — readable in 30 seconds, projected
 * over canonical state. Top risks, readiness, integration health,
 * trust posture, recommended next action, honest limitations. No fake
 * trends, no hidden chain-of-thought.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRightIcon,
  ShieldCheckIcon,
  ChartBarIcon,
  ServerStackIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  EyeIcon,
  RocketLaunchIcon,
} from "@heroicons/react/24/outline";

type OverallStatus = "operating_normally" | "needs_attention" | "blocked" | "preview_mode" | "expanding";
type Severity = "critical" | "high" | "medium" | "low" | "info";

interface TopRisk {
  rank: number;
  title: string;
  reasonSummary: string;
  severity: Severity;
  sourceMode: string;
  confidence: number;
  route: { label: string; href: string };
  evidenceRefs: string[];
}

interface ExecutiveSummaryLite {
  generatedAt: string;
  overallStatus: OverallStatus;
  headline: string;
  narrative: string;
  topRisks: TopRisk[];
  readiness: { launchScore: number; productionScore: number; sourceMode: string; topBlockers: string[] };
  integrationHealth: { total: number; healthy: number; preview: number; blocked: number; weakestIntegration?: string };
  trust: { controlCoveragePct: number; evidenceRecords: number; verifiedEvidence: number; readOnlyByDefault: true; approvalGated: true; desktopLocalExecution: "disabled" };
  recommendedNextAction: { title: string; reason: string; route: { label: string; href: string } };
  honestLimitations: string[];
  evidenceRefs: string[];
  safetyContract: "approval_gated_no_destructive_execution";
}

const STATUS_VISUAL: Record<OverallStatus, { border: string; bg: string; text: string; pill: string; icon: typeof CheckCircleIcon; dot: string }> = {
  operating_normally: { border: "border-emerald-500/[0.22]", bg: "bg-emerald-500/[0.04]", text: "text-emerald-300", pill: "bg-emerald-500/15 text-emerald-300", icon: CheckCircleIcon,        dot: "bg-emerald-400 animate-pulse" },
  needs_attention:    { border: "border-amber-500/[0.22]",   bg: "bg-amber-500/[0.04]",   text: "text-amber-300",   pill: "bg-amber-500/15 text-amber-300",     icon: ExclamationTriangleIcon, dot: "bg-amber-400 animate-pulse"   },
  blocked:            { border: "border-rose-500/[0.22]",    bg: "bg-rose-500/[0.04]",    text: "text-rose-300",    pill: "bg-rose-500/15 text-rose-300",       icon: ExclamationTriangleIcon, dot: "bg-rose-400"                  },
  preview_mode:       { border: "border-amber-500/[0.18]",   bg: "bg-amber-500/[0.04]",   text: "text-amber-300",   pill: "bg-amber-500/15 text-amber-300",     icon: EyeIcon,                  dot: "bg-amber-400"                 },
  expanding:          { border: "border-cyan-500/[0.22]",    bg: "bg-cyan-500/[0.04]",    text: "text-cyan-300",    pill: "bg-cyan-500/15 text-cyan-300",       icon: RocketLaunchIcon,         dot: "bg-cyan-400 animate-pulse"    },
};

const SEVERITY_PILL: Record<Severity, string> = {
  critical: "bg-rose-500/20 text-rose-200",
  high:     "bg-amber-500/15 text-amber-300",
  medium:   "bg-cyan-500/15 text-cyan-300",
  low:      "bg-zinc-700/40 text-zinc-300",
  info:     "bg-zinc-700/40 text-zinc-300",
};

export default function ExecutiveSummaryPage() {
  const [report, setReport] = useState<ExecutiveSummaryLite | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/intelligence/executive-summary", { credentials: "include" })
      .then((r) => r.json())
      .then((json: { ok?: boolean; data?: ExecutiveSummaryLite; error?: { userMessage?: string } }) => {
        if (cancelled) return;
        if (json.ok && json.data) setReport(json.data);
        else setError(json.error?.userMessage ?? "Executive summary unavailable.");
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Network error.");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const v = report ? STATUS_VISUAL[report.overallStatus] : null;

  return (
    <div className="relative">
      {/* Hero */}
      <div className="relative mb-8 rounded-3xl border border-white/[0.05] bg-gradient-to-br from-white/[0.025] via-white/[0.015] to-transparent p-6 md:p-8 overflow-hidden">
        <div
          className="absolute inset-0 -z-10 opacity-90 pointer-events-none"
          style={{
            background:
              "radial-gradient(900px 320px at 12% 0%, rgba(99,102,241,0.10), transparent 60%), radial-gradient(700px 260px at 88% 110%, rgba(45,212,191,0.06), transparent 60%)",
          }}
          aria-hidden
        />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" aria-hidden />

        <div className="flex items-center gap-2 flex-wrap mb-3">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.02] px-2.5 py-1">
            <ChartBarIcon className="h-3.5 w-3.5 text-cyan-300" />
            <span className="text-[10px] font-semibold uppercase tracking-widest text-cyan-300">Executive summary · canonical projection</span>
          </span>
          {report?.generatedAt && (
            <span className="text-[10px] font-mono text-zinc-500">generated {new Date(report.generatedAt).toLocaleTimeString()}</span>
          )}
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-white tracking-[-0.045em] leading-[1.05] mb-3">
          What leadership <span className="text-gradient">needs to know.</span>
        </h1>
        <p className="text-[15px] text-zinc-400 max-w-2xl leading-relaxed">
          Thirty-second read. Every number is real or honestly labeled. <span className="text-zinc-500">No fake trends. No fabricated savings. No hidden reasoning.</span>
        </p>
      </div>

      {loading && (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 mb-6">
          <p className="text-[11px] font-mono text-zinc-500 uppercase tracking-[0.18em]">// composing executive summary…</p>
        </div>
      )}
      {!loading && error && (
        <div role="alert" aria-live="assertive" className="rounded-2xl border border-amber-500/[0.18] bg-amber-500/[0.04] p-5 mb-6">
          <p className="text-[11px] font-mono text-amber-300/80 uppercase tracking-[0.18em] mb-1">// summary unavailable</p>
          <p className="text-[13px] text-zinc-300">{error}</p>
        </div>
      )}

      {!loading && !error && report && v && (
        <>
          {/* Headline + narrative */}
          <div className={`rounded-2xl border ${v.border} ${v.bg} p-6 mb-6`}>
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <span className={`w-2 h-2 rounded-full ${v.dot}`} />
              <span className={`text-[10px] font-mono uppercase tracking-widest font-semibold ${v.text}`}>
                {report.overallStatus.replace(/_/g, " ")}
              </span>
            </div>
            <p className="text-[18px] md:text-[20px] font-semibold text-white tracking-tight leading-snug mb-3">{report.headline}</p>
            <p className="text-[14px] text-zinc-300 leading-relaxed">{report.narrative}</p>
          </div>

          {/* Recommended next action */}
          <div className="rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.04] p-5 mb-8 flex items-center justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <p className="text-[10px] font-mono text-emerald-300/80 uppercase tracking-[0.18em] mb-1">// recommended next action</p>
              <p className="text-[14px] text-white font-semibold leading-snug">{report.recommendedNextAction.title}</p>
              <p className="text-[12px] text-zinc-300 leading-relaxed mt-0.5">{report.recommendedNextAction.reason}</p>
            </div>
            <Link
              href={report.recommendedNextAction.route.href}
              className="inline-flex items-center gap-1.5 text-[12px] font-medium text-emerald-200 hover:text-emerald-100 border border-emerald-500/30 hover:border-emerald-500/50 bg-emerald-500/[0.06] rounded-md px-3 py-1.5 transition-colors shrink-0"
            >
              {report.recommendedNextAction.route.label}
              <ArrowRightIcon className="h-3 w-3" />
            </Link>
          </div>

          {/* 4-card bento: top risks + readiness + integration + trust */}
          <div className="grid lg:grid-cols-2 gap-3 mb-8">
            {/* Top risks */}
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
              <p className="text-[11px] font-mono text-zinc-500 uppercase tracking-[0.18em] mb-3">// top risks</p>
              {report.topRisks.length === 0 ? (
                <p className="text-[12px] text-zinc-400">No high-severity operator action signals.</p>
              ) : (
                <ul className="space-y-2.5">
                  {report.topRisks.map((r) => (
                    <li key={r.rank} className="flex items-start gap-2.5">
                      <span className="text-[10px] font-mono text-zinc-500 mt-1 shrink-0">#{r.rank}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                          <span className={`text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded ${SEVERITY_PILL[r.severity]}`}>{r.severity}</span>
                          <span className="text-[10px] font-mono text-zinc-500">conf {Math.round(r.confidence * 100)}%</span>
                          <span className="text-[10px] font-mono text-zinc-500">· {r.sourceMode.replace(/_/g, " ")}</span>
                        </div>
                        <p className="text-[13px] font-semibold text-white tracking-tight leading-snug">{r.title}</p>
                        <p className="text-[11px] text-zinc-400 leading-snug mt-0.5">{r.reasonSummary}</p>
                        <Link href={r.route.href} className="inline-flex items-center gap-1 text-[10px] font-medium text-zinc-300 hover:text-white mt-1">
                          {r.route.label}
                          <ArrowRightIcon className="h-2.5 w-2.5" />
                        </Link>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Readiness */}
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
              <div className="flex items-center gap-2 mb-3">
                <RocketLaunchIcon className="h-4 w-4 text-violet-300" />
                <p className="text-[11px] font-mono text-zinc-500 uppercase tracking-[0.18em]">// readiness</p>
              </div>
              <p className="text-3xl font-bold text-white tracking-tight mb-1">{report.readiness.launchScore}%</p>
              <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider mb-3">
                source mode: {report.readiness.sourceMode.replace(/_/g, " ")}
              </p>
              {report.readiness.topBlockers.length > 0 ? (
                <ul className="space-y-1">
                  {report.readiness.topBlockers.map((b, i) => (
                    <li key={i} className="text-[11px] text-zinc-400 leading-snug flex items-start gap-1.5">
                      <span className="mt-1.5 w-1 h-1 rounded-full bg-amber-400 shrink-0" />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[11px] text-emerald-300">No readiness blockers.</p>
              )}
            </div>

            {/* Integration health */}
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
              <div className="flex items-center gap-2 mb-3">
                <ServerStackIcon className="h-4 w-4 text-cyan-300" />
                <p className="text-[11px] font-mono text-zinc-500 uppercase tracking-[0.18em]">// integration health</p>
              </div>
              <div className="grid grid-cols-3 gap-2 mb-3">
                <MiniStat label="Healthy" value={report.integrationHealth.healthy} tone="text-emerald-300" />
                <MiniStat label="Preview" value={report.integrationHealth.preview} tone="text-amber-300" />
                <MiniStat label="Blocked" value={report.integrationHealth.blocked} tone={report.integrationHealth.blocked > 0 ? "text-rose-300" : "text-zinc-500"} />
              </div>
              {report.integrationHealth.weakestIntegration && (
                <p className="text-[11px] text-zinc-400 leading-snug">
                  <span className="text-zinc-500 font-mono uppercase tracking-wider text-[10px]">weakest: </span>
                  {report.integrationHealth.weakestIntegration}
                </p>
              )}
              <Link href="/dashboard/integrations/health" className="inline-flex items-center gap-1 text-[11px] text-zinc-300 hover:text-white mt-2">
                Open Integration Health
                <ArrowRightIcon className="h-2.5 w-2.5" />
              </Link>
            </div>

            {/* Trust */}
            <div className="rounded-2xl border border-emerald-500/[0.18] bg-emerald-500/[0.04] p-5">
              <div className="flex items-center gap-2 mb-3">
                <ShieldCheckIcon className="h-4 w-4 text-emerald-300" />
                <p className="text-[11px] font-mono text-emerald-300/80 uppercase tracking-[0.18em]">// trust</p>
              </div>
              <div className="grid grid-cols-2 gap-2 mb-3">
                <MiniStat label="Controls" value={`${report.trust.controlCoveragePct}%`} tone="text-emerald-300" />
                <MiniStat label="Evidence" value={`${report.trust.verifiedEvidence}/${report.trust.evidenceRecords}`} tone="text-white" />
              </div>
              <ul className="space-y-1 text-[11px] text-zinc-300">
                <li className="flex items-center gap-1.5"><CheckCircleIcon className="h-3 w-3 text-emerald-300 shrink-0" /> Read-only by default</li>
                <li className="flex items-center gap-1.5"><CheckCircleIcon className="h-3 w-3 text-emerald-300 shrink-0" /> Approval-gated</li>
                <li className="flex items-center gap-1.5"><CheckCircleIcon className="h-3 w-3 text-emerald-300 shrink-0" /> Desktop local exec: <code className="font-mono text-[10px] bg-black/30 border border-white/[0.06] rounded px-1">{report.trust.desktopLocalExecution}</code></li>
              </ul>
            </div>
          </div>

          {/* Honest limitations */}
          {report.honestLimitations.length > 0 && (
            <div className="rounded-2xl border border-amber-500/[0.18] bg-amber-500/[0.04] p-5 mb-8">
              <p className="text-[10px] font-mono text-amber-300/80 uppercase tracking-[0.18em] mb-2">Known limitations</p>
              <ul className="space-y-1">
                {report.honestLimitations.map((l, i) => (
                  <li key={i} className="text-[12px] text-zinc-300 leading-relaxed flex items-start gap-2">
                    <span className="mt-1.5 w-1 h-1 rounded-full bg-amber-400 shrink-0" />
                    <span>{l}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Safety contract footer */}
          <div className="rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.04] p-5 mb-8 flex items-start gap-3">
            <ShieldCheckIcon className="h-5 w-5 text-emerald-300 mt-0.5 shrink-0" />
            <div>
              <p className="text-[11px] font-mono text-emerald-300/80 uppercase tracking-[0.18em] mb-1">// platform safety contract</p>
              <p className="text-[13px] text-emerald-100 font-semibold leading-snug">
                <code className="font-mono text-[12px] bg-black/30 border border-white/[0.06] rounded px-1.5 py-px">{report.safetyContract}</code>
              </p>
              <p className="text-[12px] text-zinc-300 leading-relaxed mt-1">
                Every signal in this summary comes from canonical state. Nothing on this page can apply Terraform, run CLI mutations, or execute on desktop.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: number | string; tone: string }) {
  return (
    <div className="rounded-md border border-white/[0.06] bg-white/[0.02] px-2.5 py-1.5">
      <p className="text-[9px] text-zinc-500 uppercase tracking-wider">{label}</p>
      <p className={`text-[15px] font-bold tracking-tight ${tone}`}>{value}</p>
    </div>
  );
}
