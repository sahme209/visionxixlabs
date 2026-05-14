/**
 * Retry engine — the thin coordinator on top of the existing
 * `lib/agent/workflows/retryPolicy.ts`.
 *
 * The original retryPolicy is correct but narrowly focused: it answers
 * "should this job retry?" based on job type and a small FailureKind set.
 * This engine wraps that decision with:
 *  - the broader `failureClassifier` (provider + HTTP signals)
 *  - provider-aware backoff (`providerBackoff`)
 *  - circuit-breaker awareness (`circuitBreaker`)
 *  - dead-letter handoff once retries are exhausted
 *
 * Why thin: the existing job-level retry rules are correct *as written* and
 * heavily tested. Reimplementing them here would duplicate logic. Instead
 * this module orchestrates retryPolicy + classifier + backoff + dead-letter
 * into one entry point.
 */

import type { AgentJob } from "@/lib/agent/jobs/jobModel";
import { evaluateRetry, statusAfterFailure } from "@/lib/agent/workflows/retryPolicy";
import type { RetryDecision as JobRetryDecision } from "@/lib/agent/workflows/retryPolicy";
import type { ClassifiedFailure } from "./failureClassifier";
import { classifyFailure } from "./failureClassifier";
import { computeBackoff, profileFor } from "./providerBackoff";
import type { ProviderId } from "@/lib/domain/provider";
import { deadLetter } from "./deadLetter";
import type { CorrelationId, OrganizationId } from "@/lib/domain/ids";

// ---------------------------------------------------------------------------
// Inputs / outputs
// ---------------------------------------------------------------------------

export interface RetryEngineInput {
  job: AgentJob;
  /** Provider this job talks to — drives backoff profile. */
  provider?: ProviderId;
  /** Header parsed by the connector if available. */
  retryAfterSeconds?: number;
  /** Stable correlation id for audit/dead-letter linkage. */
  correlationId: CorrelationId;
  /** Raw failure info — feeds the classifier. */
  failure: {
    errorCode?: string;
    status?: number;
    message?: string;
    policyBlocked?: boolean;
    approvalRequired?: boolean;
    idempotencyConflict?: boolean;
    circuitOpen?: boolean;
  };
  /** Best-effort context to dead-letter if exhausted. */
  payload?: unknown;
}

export type EngineAction =
  | { kind: "retry"; delayMs: number; reason: string; nextStatus: AgentJob["status"] }
  | { kind: "abandon"; reason: string; deadLetterId?: string; nextStatus: AgentJob["status"] }
  | { kind: "wait_for_human"; reason: string; nextStatus: AgentJob["status"]; safeNextAction?: ClassifiedFailure["safeNextAction"] };

export interface RetryEngineOutcome {
  classified: ClassifiedFailure;
  jobDecision: JobRetryDecision;
  action: EngineAction;
}

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

/**
 * Decide what to do after a job step has failed. Pure decision — the caller
 * persists the job, schedules the retry, or dead-letters as instructed.
 */
export async function decideAfterFailure(input: RetryEngineInput): Promise<RetryEngineOutcome> {
  // 1. Classify the failure into the broad taxonomy
  const classified = classifyFailure({
    errorCode: input.failure.errorCode,
    status: input.failure.status,
    message: input.failure.message,
    provider: input.provider,
    policyBlocked: input.failure.policyBlocked,
    approvalRequired: input.failure.approvalRequired,
    idempotencyConflict: input.failure.idempotencyConflict,
    circuitOpen: input.failure.circuitOpen,
  });

  // 2. Ask the job-level retry policy whether retry is structurally allowed
  const jobDecision = evaluateRetry(input.job, classified.jobFailureKind, input.failure.message);

  // 3. Compose the action
  const nextStatus = statusAfterFailure(jobDecision, classified.jobFailureKind);

  // 3a. Categories that require human input — pause, don't retry
  if (classified.category === "approval_required" || classified.category === "policy_block") {
    return {
      classified,
      jobDecision,
      action: { kind: "wait_for_human", reason: classified.userMessage, nextStatus, safeNextAction: classified.safeNextAction },
    };
  }

  // 3b. Engine says retry, but classification says it's structurally unsafe → abandon
  if (jobDecision.retry && !classified.retryable) {
    const dlq = await dlqAbandon(input, classified, "Failure category is not retryable.");
    return { classified, jobDecision, action: { kind: "abandon", reason: classified.userMessage, deadLetterId: dlq, nextStatus } };
  }

  // 3c. Engine says retry — compute provider-aware backoff if applicable
  if (jobDecision.retry) {
    let delayMs = jobDecision.backoffMs;
    let reason = jobDecision.reason;
    if (input.provider) {
      const profile = profileFor(input.provider);
      const backoff = computeBackoff({
        provider: input.provider,
        attempt: input.job.retryCount,
        retryAfterSeconds: input.retryAfterSeconds,
      });
      if (backoff.exhausted) {
        const dlq = await dlqAbandon(input, classified, `Exhausted ${profile.maxAttempts} retries for ${input.provider}.`);
        return { classified, jobDecision, action: { kind: "abandon", reason: backoff.reason, deadLetterId: dlq, nextStatus } };
      }
      delayMs = Math.max(delayMs, backoff.delayMs);
      reason = backoff.reason;
    }
    return { classified, jobDecision, action: { kind: "retry", delayMs, reason, nextStatus } };
  }

  // 3d. Engine refused retry — terminal failure → dead-letter
  const dlq = await dlqAbandon(input, classified, jobDecision.reason);
  return {
    classified,
    jobDecision,
    action: { kind: "abandon", reason: jobDecision.reason, deadLetterId: dlq, nextStatus },
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function dlqAbandon(input: RetryEngineInput, classified: ClassifiedFailure, summary: string): Promise<string | undefined> {
  try {
    const rec = await deadLetter({
      organizationId: input.job.organizationId as unknown as OrganizationId,
      source: "job",
      originalRef: input.job.id,
      category: classified.category,
      reason: summary,
      payload: input.payload,
      retryHistory: [{ at: new Date().toISOString(), reason: classified.userMessage, errorCode: input.failure.errorCode }],
      lastKnownSafeState: input.job.currentStepLabel,
      suggestedRecovery: classified.safeNextAction?.label ?? "Operator review",
      correlationId: input.correlationId,
    });
    return rec.id;
  } catch {
    // Dead-letter failure must not break the engine's decision flow.
    return undefined;
  }
}
