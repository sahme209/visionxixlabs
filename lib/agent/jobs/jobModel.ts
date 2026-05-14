/**
 * Durable agent job model.
 *
 * Every meaningful piece of operational work the agent performs becomes
 * a typed `AgentJob`. Jobs are durable (intended to be persisted to Prisma),
 * audit-traceable, retryable, and surface explicitly in the Jobs UI.
 *
 * No magical work — every job is queryable, governable, and explainable.
 */

import type { CloudProvider } from "@/lib/connectors/interface";

// ---------------------------------------------------------------------------
// Taxonomy
// ---------------------------------------------------------------------------

export type JobType =
  | "scan.cloud"
  | "scan.provider_validation"
  | "snapshot.persist"
  | "findings.generate"
  | "reasoning.trace"
  | "execution_plan.build"
  | "approval.route"
  | "terraform.export"
  | "cli.export"
  | "rollback.prepare"
  | "verification.run"
  | "drift.detect"
  | "releaseops.readiness_score"
  | "github.sync"
  | "desktop.handoff"
  | "audit.export"
  | "notification.deliver"
  | "summary.executive";

export type JobStatus =
  | "queued"
  | "scheduled"
  | "running"
  | "waiting_for_input"
  | "waiting_for_approval"
  | "blocked_by_policy"
  | "blocked_by_credentials"
  | "blocked_by_dependency"
  | "retrying"
  | "failed"
  | "completed"
  | "cancelled";

export type JobPriority = "low" | "medium" | "high" | "critical";

export type SafetyStatus = "safe" | "needs_approval" | "blocked" | "unknown";

// ---------------------------------------------------------------------------
// Job record
// ---------------------------------------------------------------------------

export interface AgentJob {
  id: string;
  organizationId: string;
  userId?: string;
  type: JobType;
  title: string;
  description: string;
  status: JobStatus;
  priority: JobPriority;
  provider?: CloudProvider;
  connectorId?: string;
  /** Related entities for cross-linking. */
  relatedResourceIds?: string[];
  relatedWorkflowId?: string;
  relatedExecutionPlanId?: string;
  relatedApprovalId?: string;
  relatedAuditEventIds?: string[];
  /** Who created the job (user, system, copilot). */
  createdBy: "user" | "system" | "copilot";
  /** Which agent / executor is responsible. */
  assignedTo: "agent" | "system" | "worker";
  /** Inputs required from a user before the job can proceed. */
  requiredInputs?: { name: string; description: string }[];
  /** Current step index within the parent workflow (0-based). */
  currentStepIndex?: number;
  /** Current step label for display. */
  currentStepLabel?: string;
  /** Progress in 0..1. */
  progress: number;
  /** How many retries have happened. */
  retryCount: number;
  /** Max retries allowed for this job type. */
  maxRetries: number;
  /** Free-text failure reason (set when status === "failed"). */
  failureReason?: string;
  /** Free-text blocked reason (set when status starts with "blocked_*"). */
  blockedReason?: string;
  /** Most recent safety evaluation. */
  safetyStatus: SafetyStatus;
  /** Latest policy evaluation summary (one-line). */
  policySummary?: string;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
  /** Scheduled time when status is "scheduled". */
  scheduledFor?: string;
}

// ---------------------------------------------------------------------------
// Builders + helpers
// ---------------------------------------------------------------------------

interface JobBuilderOptions {
  organizationId: string;
  userId?: string;
  type: JobType;
  title: string;
  description: string;
  priority?: JobPriority;
  provider?: CloudProvider;
  connectorId?: string;
  maxRetries?: number;
  createdBy?: AgentJob["createdBy"];
  scheduledFor?: string;
  requiredInputs?: AgentJob["requiredInputs"];
}

export function buildJob(opts: JobBuilderOptions): AgentJob {
  const now = new Date().toISOString();
  return {
    id: `job_${opts.type.replace(/\./g, "_")}_${Date.now().toString(36)}`,
    organizationId: opts.organizationId,
    userId: opts.userId,
    type: opts.type,
    title: opts.title,
    description: opts.description,
    status: opts.scheduledFor ? "scheduled" : "queued",
    priority: opts.priority ?? "medium",
    provider: opts.provider,
    connectorId: opts.connectorId,
    createdBy: opts.createdBy ?? "system",
    assignedTo: "agent",
    requiredInputs: opts.requiredInputs,
    currentStepIndex: 0,
    progress: 0,
    retryCount: 0,
    maxRetries: opts.maxRetries ?? defaultMaxRetries(opts.type),
    safetyStatus: "unknown",
    createdAt: now,
    updatedAt: now,
    scheduledFor: opts.scheduledFor,
  };
}

const PRIORITY_ORDER: Record<JobPriority, number> = { critical: 0, high: 1, medium: 2, low: 3 };
const TERMINAL_STATUSES: JobStatus[] = ["completed", "cancelled"];
const ACTIVE_STATUSES: JobStatus[] = ["running", "retrying"];
const BLOCKED_STATUSES: JobStatus[] = ["waiting_for_input", "waiting_for_approval", "blocked_by_policy", "blocked_by_credentials", "blocked_by_dependency"];

export function isTerminal(status: JobStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

export function isActive(status: JobStatus): boolean {
  return ACTIVE_STATUSES.includes(status);
}

export function isBlocked(status: JobStatus): boolean {
  return BLOCKED_STATUSES.includes(status);
}

export function sortByPriority(jobs: AgentJob[]): AgentJob[] {
  return [...jobs].sort((a, b) => {
    const p = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    if (p !== 0) return p;
    return b.createdAt.localeCompare(a.createdAt);
  });
}

export function jobsByStatus(jobs: AgentJob[]): Record<JobStatus, AgentJob[]> {
  return jobs.reduce(
    (acc, j) => {
      (acc[j.status] ??= []).push(j);
      return acc;
    },
    {} as Record<JobStatus, AgentJob[]>
  );
}

export function advanceJob(job: AgentJob, patch: Partial<AgentJob>): AgentJob {
  return {
    ...job,
    ...patch,
    updatedAt: new Date().toISOString(),
    completedAt: patch.status && isTerminal(patch.status) ? new Date().toISOString() : job.completedAt,
  };
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

function defaultMaxRetries(type: JobType): number {
  // Risky job types get fewer auto-retries
  const riskyTypes: JobType[] = ["execution_plan.build", "rollback.prepare", "github.sync"];
  if (riskyTypes.includes(type)) return 2;
  // Idempotent reads can retry more aggressively
  if (type.startsWith("scan.") || type.startsWith("snapshot.") || type.startsWith("findings.")) return 5;
  return 3;
}

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------

export interface JobStatusDisplay {
  label: string;
  pill: string;
  semantic: "neutral" | "running" | "success" | "warning" | "error";
}

const STATUS_DISPLAY: Record<JobStatus, JobStatusDisplay> = {
  queued:                  { label: "Queued",                pill: "Queued",           semantic: "neutral" },
  scheduled:               { label: "Scheduled",             pill: "Scheduled",        semantic: "neutral" },
  running:                 { label: "Running",               pill: "Running",          semantic: "running" },
  waiting_for_input:       { label: "Waiting for input",     pill: "Needs input",      semantic: "warning" },
  waiting_for_approval:    { label: "Waiting for approval",  pill: "Approval",         semantic: "warning" },
  blocked_by_policy:       { label: "Blocked by policy",     pill: "Policy",           semantic: "error" },
  blocked_by_credentials:  { label: "Blocked by credentials",pill: "Credentials",      semantic: "error" },
  blocked_by_dependency:   { label: "Blocked by dependency", pill: "Dependency",       semantic: "error" },
  retrying:                { label: "Retrying",              pill: "Retrying",         semantic: "running" },
  failed:                  { label: "Failed",                pill: "Failed",           semantic: "error" },
  completed:               { label: "Completed",             pill: "Done",             semantic: "success" },
  cancelled:               { label: "Cancelled",             pill: "Cancelled",        semantic: "neutral" },
};

export function displayForStatus(status: JobStatus): JobStatusDisplay {
  return STATUS_DISPLAY[status];
}
