"use client";

import { useEffect, useState } from "react";
import {
  ArrowPathIcon,
  PlayIcon,
  PauseIcon,
  ClockIcon,
  ShieldExclamationIcon,
  CommandLineIcon,
  CurrencyDollarIcon,
  DocumentCheckIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  CpuChipIcon,
} from "@heroicons/react/24/outline";
import type { Workflow, WorkflowKind, WorkflowStatus } from "@/lib/operations/eventStream";

const KIND_CONFIG: Record<
  WorkflowKind,
  { icon: typeof ArrowPathIcon; iconClass: string; bgClass: string; borderClass: string; label: string }
> = {
  recurring_scan: {
    icon: ArrowPathIcon,
    iconClass: "text-blue-400",
    bgClass: "bg-blue-500/10",
    borderClass: "border-blue-500/20",
    label: "Recurring scan",
  },
  drift_monitor: {
    icon: ShieldExclamationIcon,
    iconClass: "text-zinc-400",
    bgClass: "bg-white/10",
    borderClass: "border-white/20",
    label: "Drift monitor",
  },
  execution_queue: {
    icon: CommandLineIcon,
    iconClass: "text-violet-400",
    bgClass: "bg-violet-500/10",
    borderClass: "border-violet-500/20",
    label: "Execution queue",
  },
  post_execution_verify: {
    icon: CheckCircleIcon,
    iconClass: "text-emerald-400",
    bgClass: "bg-emerald-500/10",
    borderClass: "border-emerald-500/20",
    label: "Post-execution verification",
  },
  cost_anomaly_watch: {
    icon: CurrencyDollarIcon,
    iconClass: "text-emerald-400",
    bgClass: "bg-emerald-500/10",
    borderClass: "border-emerald-500/20",
    label: "Cost anomaly watch",
  },
  compliance_sweep: {
    icon: DocumentCheckIcon,
    iconClass: "text-cyan-400",
    bgClass: "bg-cyan-500/10",
    borderClass: "border-cyan-500/20",
    label: "Compliance sweep",
  },
  rollback_orchestration: {
    icon: ArrowPathIcon,
    iconClass: "text-fuchsia-400",
    bgClass: "bg-fuchsia-500/10",
    borderClass: "border-fuchsia-500/20",
    label: "Rollback orchestration",
  },
};

const STATUS_CONFIG: Record<
  WorkflowStatus,
  { dot: string; label: string; color: string }
> = {
  running: { dot: "bg-blue-400 animate-pulse", label: "Running", color: "text-blue-400" },
  scheduled: { dot: "bg-emerald-400", label: "Scheduled", color: "text-emerald-400" },
  paused: { dot: "bg-zinc-500", label: "Paused", color: "text-zinc-500" },
  completed: { dot: "bg-emerald-400", label: "Completed", color: "text-emerald-400" },
  failed: { dot: "bg-red-400 animate-pulse", label: "Failed", color: "text-red-400" },
};

const PROVIDER_COLOR = {
  aws: "text-zinc-400 bg-white/10 border-white/20",
  azure: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  gcp: "text-red-400 bg-red-500/10 border-red-500/20",
} as const;

function relativeFuture(iso?: string): string {
  if (!iso) return "—";
  const ms = new Date(iso).getTime() - Date.now();
  if (ms < 0) return "due now";
  const min = Math.floor(ms / 60_000);
  if (min < 60) return `in ${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `in ${hr}h`;
  const day = Math.floor(hr / 24);
  return `in ${day}d`;
}

function relativePast(iso?: string): string {
  if (!iso) return "never";
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 0) return "now";
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}

interface WorkflowOrchestratorProps {
  workflows?: Workflow[];
  className?: string;
}

export function WorkflowOrchestrator({ workflows = DEMO_WORKFLOWS, className = "" }: WorkflowOrchestratorProps) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  const running = workflows.filter((w) => w.status === "running").length;
  const scheduled = workflows.filter((w) => w.status === "scheduled").length;
  const paused = workflows.filter((w) => w.status === "paused").length;
  const totalRuns = workflows.reduce((s, w) => s + w.runsThisMonth, 0);

  return (
    <div className={`relative rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden ${className}`}>
      {/* Header */}
      <div className="px-6 py-4 border-b border-white/[0.06] bg-white/[0.01]">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
          <div className="flex items-center gap-3">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <h3 className="text-sm font-semibold text-white">Continuous Operations</h3>
            <span className="text-[10px] text-zinc-500 font-mono">
              {workflows.length} workflows · {totalRuns} runs this month
            </span>
          </div>
          <span className="text-[10px] text-zinc-600 font-mono uppercase tracking-wider">Background agent · Always on</span>
        </div>
        {/* Aggregate strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {[
            { label: "Running now", value: running.toString(), color: "text-blue-400", dot: "bg-blue-400 animate-pulse" },
            { label: "Scheduled", value: scheduled.toString(), color: "text-emerald-400", dot: "bg-emerald-400" },
            { label: "Paused", value: paused.toString(), color: "text-zinc-400", dot: "bg-zinc-500" },
            { label: "Total this month", value: totalRuns.toString(), color: "text-violet-400", dot: "bg-violet-400" },
          ].map((m) => (
            <div key={m.label} className="rounded-lg bg-white/[0.02] border border-white/[0.04] px-3 py-2">
              <div className="flex items-center gap-1.5 mb-1">
                <span className={`w-1.5 h-1.5 rounded-full ${m.dot}`} />
                <span className="text-[9px] text-zinc-500 uppercase tracking-wider font-semibold">{m.label}</span>
              </div>
              <p className={`text-lg font-bold ${m.color}`}>{m.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Workflow list */}
      <div className="p-4 space-y-2">
        {workflows.map((w) => {
          const kindConfig = KIND_CONFIG[w.kind];
          const statusConfig = STATUS_CONFIG[w.status];
          const Icon = kindConfig.icon;
          const successPct = Math.round(w.successRate * 100);

          return (
            <div
              key={w.id}
              className="group relative rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 hover:border-white/[0.12] hover:bg-white/[0.03] transition-all"
            >
              {/* Running indicator stripe */}
              {w.status === "running" && (
                <span
                  aria-hidden
                  className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-400 to-transparent animate-pulse"
                />
              )}

              <div className="flex items-start justify-between gap-3 flex-wrap">
                {/* Left: icon + meta */}
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className={`w-10 h-10 rounded-xl ${kindConfig.bgClass} border ${kindConfig.borderClass} flex items-center justify-center shrink-0 ${w.status === "running" ? "ring-2 ring-blue-500/30" : ""}`}>
                    <Icon className={`h-5 w-5 ${kindConfig.iconClass}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className="text-sm font-bold text-white truncate">{w.name}</p>
                      <span className={`text-[9px] font-semibold uppercase tracking-wider border rounded-full px-1.5 py-px ${kindConfig.iconClass} ${kindConfig.bgClass} ${kindConfig.borderClass}`}>
                        {kindConfig.label}
                      </span>
                      {w.provider && (
                        <span className={`text-[9px] font-semibold uppercase tracking-wider border rounded-full px-1.5 py-px ${PROVIDER_COLOR[w.provider]}`}>
                          {w.provider}
                          {w.region && ` · ${w.region}`}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-500 leading-relaxed mb-2">{w.description}</p>
                    <div className="flex items-center gap-x-3 gap-y-1 text-[10px] text-zinc-600 font-mono flex-wrap">
                      <span className="inline-flex items-center gap-1">
                        <ClockIcon className="h-3 w-3" />
                        {w.cadence}
                      </span>
                      <span>·</span>
                      <span>Last: {relativePast(w.lastRunAt)}</span>
                      <span>·</span>
                      <span>Next: {relativeFuture(w.nextRunAt)}</span>
                      {w.metrics?.map((m) => (
                        <span key={m.label} className="inline-flex items-center gap-1">
                          <span>·</span>
                          <span className="text-zinc-500">{m.label}:</span>
                          <span className="text-zinc-300">{m.value}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Right: status + actions */}
                <div className="flex items-center gap-3 shrink-0">
                  {/* Success rate ring */}
                  <div className="text-right">
                    <p className={`text-sm font-bold ${successPct >= 95 ? "text-emerald-400" : successPct >= 80 ? "text-zinc-400" : "text-red-400"}`}>
                      {successPct}%
                    </p>
                    <p className="text-[9px] text-zinc-600 uppercase tracking-wider">success</p>
                  </div>
                  {/* Status pill */}
                  <div className="flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.dot}`} />
                    <span className={`text-[10px] font-semibold uppercase tracking-wider ${statusConfig.color}`}>
                      {statusConfig.label}
                    </span>
                  </div>
                  {/* Toggle */}
                  <button className="w-7 h-7 rounded-lg bg-white/[0.04] border border-white/[0.08] flex items-center justify-center hover:bg-white/[0.08] transition-colors">
                    {w.status === "paused" ? (
                      <PlayIcon className="h-3.5 w-3.5 text-zinc-400" />
                    ) : (
                      <PauseIcon className="h-3.5 w-3.5 text-zinc-400" />
                    )}
                  </button>
                </div>
              </div>

              {/* Live progress strip for running workflows */}
              {w.status === "running" && (
                <div className="mt-3 rounded-lg bg-blue-500/[0.05] border border-blue-500/15 px-3 py-2 flex items-center gap-2">
                  <CpuChipIcon className="h-3 w-3 text-blue-400 animate-pulse" />
                  <span className="text-[10px] text-blue-300 font-mono">Executing now · phase {Math.floor(Math.random() * 3) + 1} of 4 · auto-refresh in 30s</span>
                </div>
              )}

              {/* Failed warning */}
              {w.status === "failed" && (
                <div className="mt-3 rounded-lg bg-red-500/[0.05] border border-red-500/15 px-3 py-2 flex items-center gap-2">
                  <ExclamationTriangleIcon className="h-3 w-3 text-red-400" />
                  <span className="text-[10px] text-red-300">Last run failed · retry scheduled · open log for details</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="px-6 py-3 border-t border-white/[0.06] bg-white/[0.01] flex items-center justify-between text-xs">
        <span className="text-zinc-500">
          Workflows persist across sessions · agent runs even when you&apos;re offline
        </span>
        <button className="text-zinc-400 hover:text-white transition-colors font-medium">
          + New workflow
        </button>
      </div>
    </div>
  );
}

// Demo workflows used when no data is provided
const futureISO = (mins: number) => new Date(Date.now() + mins * 60_000).toISOString();
const pastISO = (mins: number) => new Date(Date.now() - mins * 60_000).toISOString();

const DEMO_WORKFLOWS: Workflow[] = [
  {
    id: "wf_drift_aws_use1",
    name: "Drift monitor · prod us-east-1",
    kind: "drift_monitor",
    status: "running",
    provider: "aws",
    region: "us-east-1",
    cadence: "Every 6h",
    lastRunAt: pastISO(2),
    nextRunAt: futureISO(358),
    runsThisMonth: 124,
    successRate: 0.99,
    description: "Continuously compares baseline state to live infrastructure · auto-captures diffs · auto-triages drift severity.",
    metrics: [
      { label: "Drift events", value: "2" },
      { label: "Avg cycle", value: "4m 22s" },
    ],
  },
  {
    id: "wf_scan_aws_daily",
    name: "Full infrastructure scan · AWS prod",
    kind: "recurring_scan",
    status: "scheduled",
    provider: "aws",
    region: "us-east-1",
    cadence: "Daily 02:00 UTC",
    lastRunAt: pastISO(720),
    nextRunAt: futureISO(720),
    runsThisMonth: 30,
    successRate: 1.0,
    description: "Daily snapshot · cost, security, drift, performance analysis · feeds reasoning loop.",
    metrics: [
      { label: "Avg duration", value: "2m 14s" },
      { label: "Resources", value: "142" },
    ],
  },
  {
    id: "wf_cost_anomaly",
    name: "Cost anomaly watcher",
    kind: "cost_anomaly_watch",
    status: "scheduled",
    provider: "aws",
    cadence: "Every 1h",
    lastRunAt: pastISO(15),
    nextRunAt: futureISO(45),
    runsThisMonth: 720,
    successRate: 0.98,
    description: "Watches AWS Cost Explorer · flags >15% day-over-day deviations · auto-opens reasoning trace.",
    metrics: [
      { label: "Anomalies detected", value: "3" },
      { label: "False positives", value: "0" },
    ],
  },
  {
    id: "wf_compliance_soc2",
    name: "SOC 2 compliance sweep",
    kind: "compliance_sweep",
    status: "scheduled",
    provider: "aws",
    cadence: "Weekly Mon 04:00 UTC",
    lastRunAt: pastISO(60 * 24 * 3),
    nextRunAt: futureISO(60 * 24 * 4),
    runsThisMonth: 4,
    successRate: 1.0,
    description: "Audits IAM, encryption, logging, network exposure · maps findings to SOC 2 controls.",
    metrics: [
      { label: "Controls checked", value: "47" },
      { label: "Open exceptions", value: "2" },
    ],
  },
  {
    id: "wf_exec_queue",
    name: "Execution queue · phase 3 of 4",
    kind: "execution_queue",
    status: "running",
    provider: "aws",
    region: "us-east-1",
    cadence: "On approval",
    lastRunAt: pastISO(8),
    nextRunAt: futureISO(2),
    runsThisMonth: 14,
    successRate: 0.96,
    description: "Right-size 3 EC2 instances · phase 3 active · pre-flight snapshot verified.",
    metrics: [
      { label: "Phase ETA", value: "2m 15s" },
      { label: "Rollback RTO", value: "47s" },
    ],
  },
  {
    id: "wf_verify",
    name: "Post-execution verification",
    kind: "post_execution_verify",
    status: "scheduled",
    provider: "aws",
    cadence: "After every execution",
    lastRunAt: pastISO(180),
    nextRunAt: futureISO(120),
    runsThisMonth: 14,
    successRate: 1.0,
    description: "Confirms cost shift, drift, and intended behavior post-change · marks plan items as locked.",
    metrics: [
      { label: "Verification time", value: "≤ 5m" },
      { label: "Locked savings", value: "$2,400/mo" },
    ],
  },
  {
    id: "wf_azure_drift",
    name: "Drift monitor · Azure westeurope",
    kind: "drift_monitor",
    status: "scheduled",
    provider: "azure",
    region: "westeurope",
    cadence: "Every 12h",
    lastRunAt: pastISO(60 * 11),
    nextRunAt: futureISO(60),
    runsThisMonth: 62,
    successRate: 0.97,
    description: "Service Principal connector · monitors VNet, NSG, and IAM role drift across resource groups.",
    metrics: [
      { label: "Avg cycle", value: "6m 48s" },
      { label: "Drift events", value: "1" },
    ],
  },
  {
    id: "wf_gcp_scan",
    name: "GCP infrastructure scan",
    kind: "recurring_scan",
    status: "paused",
    provider: "gcp",
    region: "us-west1",
    cadence: "Daily 03:00 UTC",
    lastRunAt: pastISO(60 * 24 * 5),
    nextRunAt: undefined,
    runsThisMonth: 21,
    successRate: 0.88,
    description: "Paused after 5 IAM-related failures · agent recalibrating confidence before resume.",
    metrics: [
      { label: "Resources", value: "30" },
      { label: "Confidence", value: "0.61" },
    ],
  },
  {
    id: "wf_rollback_ready",
    name: "Rollback orchestrator (standby)",
    kind: "rollback_orchestration",
    status: "scheduled",
    cadence: "Always on",
    lastRunAt: pastISO(60 * 24 * 2),
    nextRunAt: undefined,
    runsThisMonth: 2,
    successRate: 1.0,
    description: "Standby orchestrator · keeps verified rollback paths ready for every active execution.",
    metrics: [
      { label: "RTO target", value: "60s" },
      { label: "Paths ready", value: "14" },
    ],
  },
];
