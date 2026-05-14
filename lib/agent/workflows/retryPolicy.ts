/**
 * Retry policy — typed rules for when failed jobs can be safely re-attempted.
 *
 * Risky job types (execution_plan.build, rollback.prepare, github.sync writes)
 * are never auto-retried without explicit policy allowance. Idempotent reads
 * (scans, snapshots, findings) get aggressive retry windows.
 */

import type { AgentJob, JobType, JobStatus } from "@/lib/agent/jobs/jobModel";

// ---------------------------------------------------------------------------
// Failure taxonomy
// ---------------------------------------------------------------------------

export type FailureKind =
  | "transient_network"
  | "rate_limited"
  | "timeout"
  | "credentials_invalid"
  | "permission_denied"
  | "validation_failed"
  | "policy_blocked"
  | "external_api_error"
  | "user_input_required"
  | "unknown";

export interface RetryDecision {
  /** Whether to retry. */
  retry: boolean;
  /** Backoff in milliseconds before next attempt. */
  backoffMs: number;
  /** Reason surfaced in UI. */
  reason: string;
  /** Safe next action shown to the user when retry is denied. */
  safeNextAction?: { label: string; href: string };
}

// ---------------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------------

/** Job types that must never auto-retry — they require human review on failure. */
const NO_AUTO_RETRY_TYPES: JobType[] = [
  "execution_plan.build",
  "rollback.prepare",
  "approval.route",
];

/** Failure kinds that are always non-retryable regardless of job type. */
const NON_RETRYABLE_FAILURES: FailureKind[] = [
  "credentials_invalid",
  "permission_denied",
  "policy_blocked",
  "user_input_required",
];

/** Job types that are idempotent reads — safe to retry aggressively. */
const IDEMPOTENT_READ_TYPES: JobType[] = [
  "scan.cloud",
  "scan.provider_validation",
  "snapshot.persist",
  "findings.generate",
  "drift.detect",
  "github.sync",
  "releaseops.readiness_score",
];

/** Exponential backoff with jitter — pure helper. */
function exponentialBackoffMs(attempt: number, baseMs = 1000, maxMs = 60_000): number {
  const exp = Math.min(maxMs, baseMs * Math.pow(2, attempt));
  const jitter = Math.floor(Math.random() * Math.min(1000, exp / 4));
  return exp + jitter;
}

// ---------------------------------------------------------------------------
// Decision engine
// ---------------------------------------------------------------------------

/**
 * Evaluate whether a failed job should be auto-retried.
 * Pure function — no I/O.
 */
export function evaluateRetry(job: AgentJob, failure: FailureKind, errorText?: string): RetryDecision {
  // Hard rule 1: max retries exhausted
  if (job.retryCount >= job.maxRetries) {
    return {
      retry: false,
      backoffMs: 0,
      reason: `Max retries (${job.maxRetries}) exhausted for this job type.`,
      safeNextAction: { label: "Open Jobs page", href: "/dashboard/jobs" },
    };
  }

  // Hard rule 2: failure kinds that are never retryable
  if (NON_RETRYABLE_FAILURES.includes(failure)) {
    return {
      retry: false,
      backoffMs: 0,
      reason: friendlyForFailure(failure),
      safeNextAction: safeNextActionForFailure(failure),
    };
  }

  // Hard rule 3: risky job types never auto-retry
  if (NO_AUTO_RETRY_TYPES.includes(job.type)) {
    return {
      retry: false,
      backoffMs: 0,
      reason: `${job.type} requires human review on failure — automatic retry disabled for risky job types.`,
      safeNextAction: { label: "Open Approval Center", href: "/dashboard/approvals" },
    };
  }

  // Soft rule: idempotent reads get longer retry windows
  const baseMs = IDEMPOTENT_READ_TYPES.includes(job.type) ? 500 : 2000;
  const backoff = exponentialBackoffMs(job.retryCount, baseMs);

  return {
    retry: true,
    backoffMs: backoff,
    reason: `Transient ${failure.replace(/_/g, " ")}. Retrying in ${Math.round(backoff / 1000)}s (attempt ${job.retryCount + 1}/${job.maxRetries}).`,
  };
  void errorText;
}

// ---------------------------------------------------------------------------
// Status mapper — what JobStatus should the job hold while retrying / failed
// ---------------------------------------------------------------------------

export function statusAfterFailure(decision: RetryDecision, failure: FailureKind): JobStatus {
  if (decision.retry) return "retrying";
  if (failure === "policy_blocked") return "blocked_by_policy";
  if (failure === "credentials_invalid") return "blocked_by_credentials";
  if (failure === "user_input_required") return "waiting_for_input";
  return "failed";
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function friendlyForFailure(failure: FailureKind): string {
  switch (failure) {
    case "credentials_invalid":  return "Credentials are no longer valid — fix the connector before retrying.";
    case "permission_denied":    return "Provider permissions are insufficient — adjust role policy before retrying.";
    case "policy_blocked":       return "Governance policy blocks this action — review policy before retrying.";
    case "user_input_required":  return "User input required before this job can proceed.";
    default:                     return `Failure of kind ${failure} is non-retryable.`;
  }
}

function safeNextActionForFailure(failure: FailureKind): { label: string; href: string } | undefined {
  switch (failure) {
    case "credentials_invalid": return { label: "Reconnect provider", href: "/operator/onboarding" };
    case "permission_denied":   return { label: "Review AWS setup", href: "/docs/aws-setup" };
    case "policy_blocked":      return { label: "Open Governance", href: "/dashboard/governance" };
    case "user_input_required": return { label: "Open Jobs page", href: "/dashboard/jobs" };
    default:                    return { label: "Open troubleshooting", href: "/docs/troubleshooting" };
  }
}
