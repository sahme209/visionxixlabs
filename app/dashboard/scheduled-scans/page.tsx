"use client";

/**
 * /dashboard/scheduled-scans
 *
 * Scheduled scan declarations. Honest "scheduler runtime not yet
 * wired" disclaimer; every task declares what would run, at what
 * cadence, with current status derived from canonical state.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRightIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  PauseCircleIcon,
  XCircleIcon,
  PlayCircleIcon,
  CloudIcon,
  CodeBracketIcon,
  ShieldCheckIcon,
  RocketLaunchIcon,
  ServerStackIcon,
  DocumentTextIcon,
} from "@heroicons/react/24/outline";

type TaskType = "aws_readonly_scan" | "github_readonly_sync" | "security_scanner_run" | "releaseops_readiness_check" | "trust_evidence_refresh" | "integration_health_check" | "readiness_refresh";
type Cadence = "every_15_minutes" | "hourly" | "every_6_hours" | "daily" | "weekly" | "manual";
type Status = "enabled" | "disabled_until_credentials" | "disabled_by_policy" | "paused" | "blocked" | "running";
type Outcome = "succeeded" | "succeeded_with_warnings" | "failed" | "never_run" | "skipped";

interface TaskLite {
  id: string;
  taskType: TaskType;
  cadence: Cadence;
  status: Status;
  sourceMode: string;
  label: string;
  description: string;
  lastRunAt?: string;
  lastRunOutcome: Outcome;
  nextRunAt?: string;
  missingConfig: string[];
  lastRunFindingsCount: number;
  lastRunRisksCreated: number;
  limitations: string[];
  safeNextAction: { label: string; href: string };
  evidenceRef: string;
}

interface ReportLite {
  generatedAt: string;
  tasks: TaskLite[];
  summary: { total: number; enabled: number; disabled: number; paused: number; blocked: number; lastSucceeded: number; lastFailed: number; neverRun: number };
  safetyContract: "scheduled_tasks_read_only_only";
  limitations: string[];
}

const STATUS_VISUAL: Record<Status, { border: string; bg: string; text: string; pill: string; icon: typeof CheckCircleIcon }> = {
  enabled:                    { border: "border-emerald-500/[0.22]", bg: "bg-emerald-500/[0.04]", text: "text-emerald-300", pill: "bg-emerald-500/15 text-emerald-300", icon: PlayCircleIcon          },
  running:                    { border: "border-cyan-500/[0.22]",    bg: "bg-cyan-500/[0.04]",    text: "text-cyan-300",    pill: "bg-cyan-500/15 text-cyan-300",       icon: ClockIcon                },
  paused:                     { border: "border-amber-500/[0.22]",   bg: "bg-amber-500/[0.04]",   text: "text-amber-300",   pill: "bg-amber-500/15 text-amber-300",     icon: PauseCircleIcon          },
  blocked:                    { border: "border-rose-500/[0.22]",    bg: "bg-rose-500/[0.04]",    text: "text-rose-300",    pill: "bg-rose-500/15 text-rose-300",       icon: XCircleIcon              },
  disabled_until_credentials: { border: "border-amber-500/[0.18]",   bg: "bg-amber-500/[0.04]",   text: "text-amber-300",   pill: "bg-amber-500/15 text-amber-300",     icon: ExclamationTriangleIcon  },
  disabled_by_policy:         { border: "border-rose-500/[0.22]",    bg: "bg-rose-500/[0.04]",    text: "text-rose-300",    pill: "bg-rose-500/15 text-rose-300",       icon: XCircleIcon              },
};

const STATUS_LABEL: Record<Status, string> = {
  enabled:                    "Enabled",
  running:                    "Running",
  paused:                     "Paused",
  blocked:                    "Blocked",
  disabled_until_credentials: "Disabled · credentials",
  disabled_by_policy:         "Disabled · policy",
};

const CADENCE_LABEL: Record<Cadence, string> = {
  every_15_minutes: "Every 15 min",
  hourly:           "Hourly",
  every_6_hours:    "Every 6h",
  daily:            "Daily",
  weekly:           "Weekly",
  manual:           "Manual",
};

const OUTCOME_LABEL: Record<Outcome, string> = {
  succeeded:               "Succeeded",
  succeeded_with_warnings: "Succeeded · warnings",
  failed:                  "Failed",
  never_run:               "Never run",
  skipped:                 "Skipped",
};

const TASK_ICON: Record<TaskType, typeof CloudIcon> = {
  aws_readonly_scan:           CloudIcon,
  github_readonly_sync:        CodeBracketIcon,
  security_scanner_run:        ShieldCheckIcon,
  releaseops_readiness_check:  RocketLaunchIcon,
  trust_evidence_refresh:      ShieldCheckIcon,
  integration_health_check:    ServerStackIcon,
  readiness_refresh:           DocumentTextIcon,
};

export default function ScheduledScansPage() {
  const [report, setReport] = useState<ReportLite | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/scheduled-scans", { credentials: "include" })
      .then((r) => r.json())
      .then((json: { ok?: boolean; data?: ReportLite; error?: { userMessage?: string } }) => {
        if (cancelled) return;
        if (json.ok && json.data) setReport(json.data);
        else setError(json.error?.userMessage ?? "Scheduled scans unavailable.");
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Network error.");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="relative">
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

        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.02] px-2.5 py-1">
            <ClockIcon className="h-3.5 w-3.5 text-cyan-300" />
            <span className="text-[10px] font-semibold uppercase tracking-widest text-cyan-300">
              Scheduled scans · scheduled_tasks_read_only_only
            </span>
          </span>
          {report?.generatedAt && (
            <span className="text-[10px] font-mono text-zinc-500">declared {new Date(report.generatedAt).toLocaleTimeString()}</span>
          )}
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-white tracking-[-0.045em] leading-[1.05] mb-3">
          What runs <span className="text-gradient">on a schedule.</span>
        </h1>
        <p className="text-[15px] text-zinc-400 max-w-2xl leading-relaxed">
          Recurring read-only analysis. Every task wires through read-only adapters — <span className="text-zinc-500">apply paths are never reachable from the scheduler.</span>
        </p>
      </div>

      {loading && (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 mb-6">
          <p className="text-[11px] font-mono text-zinc-500 uppercase tracking-[0.18em]">// composing schedule…</p>
        </div>
      )}
      {!loading && error && (
        <div className="rounded-2xl border border-amber-500/[0.18] bg-amber-500/[0.04] p-5 mb-6">
          <p className="text-[11px] font-mono text-amber-300/80 uppercase tracking-[0.18em] mb-1">// scheduled scans unavailable</p>
          <p className="text-[13px] text-zinc-300">{error}</p>
        </div>
      )}

      {!loading && !error && report && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-6">
            <SummaryStat label="Enabled" value={report.summary.enabled} tone={report.summary.enabled > 0 ? "text-emerald-300" : "text-zinc-500"} />
            <SummaryStat label="Disabled" value={report.summary.disabled} tone={report.summary.disabled > 0 ? "text-amber-300" : "text-zinc-500"} />
            <SummaryStat label="Blocked" value={report.summary.blocked} tone={report.summary.blocked > 0 ? "text-rose-300" : "text-zinc-500"} />
            <SummaryStat label="Never run" value={report.summary.neverRun} tone="text-zinc-400" />
          </div>

          <div className="space-y-2 mb-10">
            {report.tasks.map((t) => {
              const v = STATUS_VISUAL[t.status];
              const TaskIcon = TASK_ICON[t.taskType];
              const StatusIcon = v.icon;
              return (
                <div key={t.id} className={`rounded-2xl border ${v.border} ${v.bg} p-5 hover:-translate-y-0.5 transition-all`}>
                  <div className="flex items-start justify-between gap-3 mb-2 flex-wrap">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <div className={`w-9 h-9 rounded-lg border ${v.border} ${v.bg} flex items-center justify-center shrink-0`}>
                        <TaskIcon className={`h-4.5 w-4.5 ${v.text}`} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded inline-flex items-center gap-1 ${v.pill}`}>
                            <StatusIcon className="h-3 w-3" />
                            {STATUS_LABEL[t.status]}
                          </span>
                          <span className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-violet-500/15 text-violet-300">
                            {CADENCE_LABEL[t.cadence]}
                          </span>
                          <span className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-zinc-700/40 text-zinc-300">
                            {t.sourceMode.replace(/_/g, " ")}
                          </span>
                          <span className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-white/[0.04] border border-white/[0.06] text-zinc-400">
                            last: {OUTCOME_LABEL[t.lastRunOutcome]}
                          </span>
                        </div>
                        <p className="text-[14px] font-semibold text-white tracking-tight">{t.label}</p>
                        <p className="text-[12.5px] text-zinc-300 leading-relaxed mt-0.5">{t.description}</p>
                      </div>
                    </div>
                    <Link
                      href={t.safeNextAction.href}
                      className="inline-flex items-center gap-1.5 text-[12px] font-medium text-zinc-200 hover:text-white border border-white/[0.08] hover:border-white/[0.2] rounded-md px-2.5 py-1.5 transition-colors shrink-0"
                    >
                      {t.safeNextAction.label}
                      <ArrowRightIcon className="h-3 w-3" />
                    </Link>
                  </div>

                  {t.missingConfig.length > 0 && (
                    <div className="rounded-md border border-amber-500/[0.18] bg-amber-500/[0.04] p-2.5 mt-2">
                      <p className="text-[10px] font-mono text-amber-300/80 uppercase tracking-wider mb-1">// missing config</p>
                      <ul className="space-y-0.5">
                        {t.missingConfig.map((m, i) => (
                          <li key={i} className="text-[11px] font-mono text-zinc-300">{m}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="flex items-center gap-3 mt-3 flex-wrap text-[10px] font-mono text-zinc-500">
                    {t.lastRunFindingsCount > 0 && <span>last run · {t.lastRunFindingsCount} findings</span>}
                    {t.lastRunRisksCreated > 0 && <span>· {t.lastRunRisksCreated} risks created</span>}
                    <span className="ml-auto">evidence: {t.evidenceRef}</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.04] p-5 mb-8 flex items-start gap-3">
            <CheckCircleIcon className="h-5 w-5 text-emerald-300 mt-0.5 shrink-0" />
            <div>
              <p className="text-[11px] font-mono text-emerald-300/80 uppercase tracking-[0.18em] mb-1">// scheduler contract</p>
              <p className="text-[13px] text-emerald-100 font-semibold leading-snug">
                safetyContract = <code className="font-mono text-[12px] bg-black/30 border border-white/[0.06] rounded px-1.5 py-px">{report.safetyContract}</code>
              </p>
              <p className="text-[12px] text-zinc-300 leading-relaxed mt-1">
                {report.limitations.join(" ")}
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function SummaryStat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
      <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-2xl font-bold tracking-tight ${tone}`}>{value}</p>
    </div>
  );
}
