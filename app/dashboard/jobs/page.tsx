"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CpuChipIcon,
  ArrowRightIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  LockClosedIcon,
  XCircleIcon,
  PlayIcon,
  ShieldExclamationIcon,
} from "@heroicons/react/24/outline";
import { Reveal } from "@/components/motion/Reveal";
import { Stagger } from "@/components/motion/Stagger";
import {
  type AgentJob,
  type JobStatus,
  type JobType,
  buildJob,
  displayForStatus,
  isActive as jobIsActive,
  isBlocked as jobIsBlocked,
  isTerminal,
} from "@/lib/agent/jobs/jobModel";

// Demo job seed for the page until /api/operations/jobs is wired.
function seedDemoJobs(): AgentJob[] {
  const now = Date.now();
  const make = (offsetSec: number, partial: Partial<AgentJob> & { type: JobType; title: string }): AgentJob => {
    const j = buildJob({
      organizationId: "demo",
      type: partial.type,
      title: partial.title,
      description: partial.description ?? "",
      priority: partial.priority,
    });
    return {
      ...j,
      ...partial,
      createdAt: new Date(now - offsetSec * 1000).toISOString(),
      updatedAt: new Date(now - offsetSec * 1000 + 60_000).toISOString(),
    };
  };
  return [
    make(120, {
      type: "scan.cloud",
      title: "Scan AWS · prod us-east-1",
      description: "Enumerate EC2/S3/RDS/IAM across authorized regions",
      status: "running",
      progress: 0.42,
      currentStepLabel: "Persisting typed snapshot",
      currentStepIndex: 2,
      priority: "high",
      provider: "aws",
      relatedWorkflowId: "wf.cloud_scan",
      safetyStatus: "safe",
    }),
    make(900, {
      type: "execution_plan.build",
      title: "Build plan · right-size 3 EC2 instances",
      description: "Phased plan with Terraform export + rollback verification",
      status: "waiting_for_approval",
      progress: 1,
      currentStepLabel: "Approval routing",
      priority: "high",
      provider: "aws",
      relatedWorkflowId: "wf.cloud_scan",
      relatedApprovalId: "apr_rightsize_phase3",
      safetyStatus: "needs_approval",
      blockedReason: "Single-approver review required. Verified rollback available (47s RTO).",
      policySummary: "default.production_requires_approval matched · 1 approver required",
    }),
    make(1800, {
      type: "rollback.prepare",
      title: "Prepare rollback · auth-gateway sg-0a1b2c",
      description: "Pre-flight snapshot + rollback path verification",
      status: "blocked_by_policy",
      progress: 0.3,
      currentStepLabel: "Rollback verification",
      priority: "critical",
      provider: "aws",
      blockedReason: "Rollback path unverified for non-low-risk action — see governance gate.",
      safetyStatus: "blocked",
    }),
    make(5400, {
      type: "github.sync",
      title: "GitHub repo sync · axiom-preview org",
      description: "Pull repos, pipelines, branch protection rules",
      status: "blocked_by_credentials",
      progress: 0.1,
      currentStepLabel: "Validating GitHub App installation",
      priority: "medium",
      blockedReason: "GitHub App installation removed. Re-install at /settings/installations.",
      safetyStatus: "blocked",
    }),
    make(7200, {
      type: "snapshot.persist",
      title: "Persist typed snapshot · azure-staging",
      description: "Write normalized Azure resource graph",
      status: "retrying",
      progress: 0.6,
      currentStepLabel: "Backoff before retry",
      retryCount: 1,
      priority: "medium",
      provider: "azure",
      safetyStatus: "safe",
    }),
    make(10800, {
      type: "drift.detect",
      title: "Drift detection · prod us-east-1",
      description: "Compare current snapshot against baseline",
      status: "completed",
      progress: 1,
      currentStepLabel: "Completed",
      priority: "low",
      provider: "aws",
      relatedWorkflowId: "wf.drift_detection",
      safetyStatus: "safe",
    }),
    make(86400, {
      type: "execution_plan.build",
      title: "Build plan · IAM policy tightening",
      description: "Reduce over-permissive policy on prod-api-role",
      status: "failed",
      progress: 0.7,
      currentStepLabel: "Plan build",
      priority: "high",
      provider: "aws",
      failureReason: "Policy simulator returned permission gap — manual review required",
      safetyStatus: "blocked",
    }),
  ];
}

const STATUS_FILTERS: { id: "all" | "active" | "blocked" | "completed" | "failed"; label: string }[] = [
  { id: "all", label: "All jobs" },
  { id: "active", label: "Active" },
  { id: "blocked", label: "Blocked" },
  { id: "completed", label: "Completed" },
  { id: "failed", label: "Failed" },
];

const STATUS_ICON: Partial<Record<JobStatus, typeof PlayIcon>> = {
  running: ArrowPathIcon,
  retrying: ArrowPathIcon,
  scheduled: ClockIcon,
  queued: ClockIcon,
  waiting_for_approval: LockClosedIcon,
  waiting_for_input: LockClosedIcon,
  blocked_by_policy: ShieldExclamationIcon,
  blocked_by_credentials: ShieldExclamationIcon,
  blocked_by_dependency: ShieldExclamationIcon,
  failed: XCircleIcon,
  completed: CheckCircleIcon,
  cancelled: XCircleIcon,
};

export default function JobsPage() {
  const [filter, setFilter] = useState<typeof STATUS_FILTERS[number]["id"]>("all");
  const jobs = seedDemoJobs();

  const filtered = jobs.filter((j) => {
    if (filter === "all") return true;
    if (filter === "active") return jobIsActive(j.status) || j.status === "queued" || j.status === "scheduled";
    if (filter === "blocked") return jobIsBlocked(j.status);
    if (filter === "completed") return j.status === "completed";
    if (filter === "failed") return j.status === "failed" || j.status === "cancelled";
    return true;
  });

  const activeCount = jobs.filter((j) => jobIsActive(j.status)).length;
  const blockedCount = jobs.filter((j) => jobIsBlocked(j.status)).length;
  const failedCount = jobs.filter((j) => j.status === "failed").length;
  const completedCount = jobs.filter((j) => isTerminal(j.status)).length;

  return (
    <div className="relative">
      {/* Hero */}
      <Reveal direction="up" blur>
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <CpuChipIcon className="h-4 w-4 text-zinc-500" />
            <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest">
              Agent Jobs · Durable operational work
            </p>
            <span className="text-[9px] font-semibold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 rounded-full px-2 py-0.5 uppercase tracking-wider">
              Audit-traceable
            </span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-white tracking-[-0.04em] mb-2">
            What Axiom is <span className="text-gradient">working on.</span>
          </h1>
          <p className="text-dim-paragraph text-base max-w-3xl leading-relaxed">
            Every operationally meaningful action is a typed, persisted job. <span className="dim-1">Status is honest, retries follow policy, and every blocked state surfaces the safe next action.</span>
          </p>
        </div>
      </Reveal>

      {/* KPI strip */}
      <Stagger delay={0.05} interval={0.05} className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Active",    value: activeCount,    color: "text-blue-400",    bg: "bg-blue-500/10 border-blue-500/20",       icon: ArrowPathIcon },
          { label: "Blocked",   value: blockedCount,   color: "text-zinc-400",   bg: "bg-white/10 border-white/20",     icon: ShieldExclamationIcon },
          { label: "Failed",    value: failedCount,    color: "text-red-400",     bg: "bg-red-500/10 border-red-500/20",         icon: XCircleIcon },
          { label: "Completed", value: completedCount, color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20", icon: CheckCircleIcon },
        ].map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div key={kpi.label} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <div className={`w-9 h-9 rounded-lg ${kpi.bg} border flex items-center justify-center mb-3`}>
                <Icon className={`h-4.5 w-4.5 ${kpi.color}`} />
              </div>
              <p className="text-2xl font-bold text-white tracking-tight mb-0.5">{kpi.value}</p>
              <p className="text-[11px] text-zinc-500 leading-tight">{kpi.label}</p>
            </div>
          );
        })}
      </Stagger>

      {/* Filter pills */}
      <Reveal direction="up" delay={0.08}>
        <div className="flex flex-wrap items-center gap-2 mb-5">
          <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mr-2">Filter:</span>
          {STATUS_FILTERS.map((f) => {
            const isActive = filter === f.id;
            return (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`inline-flex items-center px-3.5 py-1.5 rounded-full text-xs font-medium transition-all border ${
                  isActive
                    ? "bg-violet-500/15 border-white/[0.12] text-violet-300 shadow-[0_0_20px_rgba(139,92,246,0.15)]"
                    : "bg-white/[0.02] border-white/[0.06] text-zinc-400 hover:text-white hover:border-white/[0.12]"
                }`}
              >
                {f.label}
              </button>
            );
          })}
        </div>
      </Reveal>

      {/* Job list */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] px-6 py-10 text-center">
            <p className="text-sm text-zinc-500">No jobs match this filter.</p>
          </div>
        )}
        {filtered.map((job) => (
          <JobRow key={job.id} job={job} />
        ))}
      </div>
    </div>
  );
}

function JobRow({ job }: { job: AgentJob }) {
  const display = displayForStatus(job.status);
  const Icon = STATUS_ICON[job.status] ?? PlayIcon;
  const stripe =
    job.status === "running" || job.status === "retrying" ? "from-transparent via-blue-400 to-transparent animate-pulse" :
    job.status === "failed" ? "from-transparent via-red-400 to-transparent" :
    null;

  const semanticBg =
    display.semantic === "error" ? "border-red-500/15 bg-red-500/[0.03]" :
    display.semantic === "warning" ? "border-white/15 bg-white/[0.03]" :
    display.semantic === "success" ? "border-emerald-500/15 bg-emerald-500/[0.03]" :
    display.semantic === "running" ? "border-blue-500/15 bg-blue-500/[0.03]" :
    "border-white/[0.06] bg-white/[0.02]";

  return (
    <div className={`relative rounded-xl border ${semanticBg} p-4 hover:border-white/[0.18] transition-all overflow-hidden`}>
      {stripe && (
        <span aria-hidden className={`absolute top-0 left-0 right-0 h-px bg-gradient-to-r ${stripe}`} />
      )}
      <div className="flex items-start gap-3 flex-wrap">
        {/* Status icon */}
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
          display.semantic === "error" ? "bg-red-500/10 border-red-500/20" :
          display.semantic === "warning" ? "bg-white/10 border-white/20" :
          display.semantic === "success" ? "bg-emerald-500/10 border-emerald-500/20" :
          display.semantic === "running" ? "bg-blue-500/10 border-blue-500/20" :
          "bg-white/[0.04] border-white/[0.08]"
        }`}>
          <Icon className={`h-5 w-5 ${
            display.semantic === "error" ? "text-red-400" :
            display.semantic === "warning" ? "text-zinc-400" :
            display.semantic === "success" ? "text-emerald-400" :
            display.semantic === "running" ? "text-blue-400 animate-spin" :
            "text-zinc-400"
          }`}
            style={display.semantic === "running" ? { animationDuration: "2s" } : undefined}
          />
        </div>

        {/* Body */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <p className="text-sm font-bold text-white truncate">{job.title}</p>
            <span className={`text-[9px] font-bold uppercase tracking-wider border rounded-full px-1.5 py-px ${
              display.semantic === "error" ? "text-red-400 bg-red-500/10 border-red-500/20" :
              display.semantic === "warning" ? "text-zinc-400 bg-white/10 border-white/20" :
              display.semantic === "success" ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" :
              display.semantic === "running" ? "text-blue-400 bg-blue-500/10 border-blue-500/20" :
              "text-zinc-500 bg-white/[0.04] border-white/[0.08]"
            }`}>
              {display.pill}
            </span>
            {job.provider && (
              <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-500 bg-white/[0.04] border border-white/[0.06] rounded-full px-1.5 py-px">
                {job.provider}
              </span>
            )}
            <span className={`text-[9px] font-semibold uppercase tracking-wider ${
              job.priority === "critical" ? "text-red-400" :
              job.priority === "high" ? "text-zinc-400" :
              "text-zinc-500"
            }`}>
              {job.priority}
            </span>
          </div>
          <p className="text-xs text-zinc-500 leading-snug mb-2">{job.description}</p>

          {/* Progress + current step */}
          <div className="flex items-center gap-3 text-[10px] text-zinc-500 mb-2">
            {job.currentStepLabel && (
              <span className="font-mono">
                <span className="text-zinc-600">step:</span> <span className="text-zinc-400">{job.currentStepLabel}</span>
              </span>
            )}
            <span>·</span>
            <span className="font-mono">
              <span className="text-zinc-600">progress:</span> <span className="text-zinc-400">{Math.round(job.progress * 100)}%</span>
            </span>
            {job.retryCount > 0 && (
              <>
                <span>·</span>
                <span className="font-mono">
                  <span className="text-zinc-600">retry:</span> <span className="text-zinc-400">{job.retryCount}/{job.maxRetries}</span>
                </span>
              </>
            )}
          </div>

          {/* Progress bar */}
          <div className="h-1 bg-white/[0.04] rounded-full overflow-hidden mb-2">
            <div
              className={`h-full rounded-full ${
                display.semantic === "error" ? "bg-red-500/60" :
                display.semantic === "warning" ? "bg-white/60" :
                display.semantic === "success" ? "bg-emerald-500" :
                "bg-gradient-to-r from-violet-500 to-fuchsia-500"
              }`}
              style={{ width: `${Math.round(job.progress * 100)}%` }}
            />
          </div>

          {/* Blocked / failure reason */}
          {(job.blockedReason || job.failureReason) && (
            <div className={`mt-2 rounded-lg px-3 py-2 text-[11px] flex items-start gap-2 ${
              job.failureReason ? "bg-red-500/[0.05] border border-red-500/15 text-red-300" : "bg-white/[0.05] border border-white/15 text-zinc-300"
            }`}>
              <ExclamationTriangleIcon className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>{job.failureReason ?? job.blockedReason}</span>
            </div>
          )}

          {/* Policy summary */}
          {job.policySummary && (
            <p className="mt-2 text-[10px] text-zinc-500 font-mono">
              <span className="text-zinc-600">policy:</span> {job.policySummary}
            </p>
          )}
        </div>

        {/* Quick actions */}
        <div className="flex items-center gap-2 shrink-0">
          {job.relatedWorkflowId && (
            <Link href="/dashboard/workflows" className="text-[11px] text-zinc-500 hover:text-violet-300 transition-colors font-semibold">
              Workflow
            </Link>
          )}
          {job.relatedApprovalId && (
            <Link href="/dashboard/approvals" className="text-[11px] text-zinc-400 hover:text-zinc-300 transition-colors font-semibold">
              Approve
            </Link>
          )}
          <Link href={`/dashboard/jobs/${job.id}`} className="text-[11px] text-zinc-400 hover:text-white transition-colors inline-flex items-center gap-1 font-semibold">
            Details
            <ArrowRightIcon className="h-3 w-3" />
          </Link>
        </div>
      </div>
    </div>
  );
}
