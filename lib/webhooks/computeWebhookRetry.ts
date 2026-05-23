/**
 * Pure retry-scheduling kernel — Phase 395.
 *
 * Decides what should happen after a webhook delivery attempt:
 *   - retry at time T          → caller persists nextAttemptAt = T
 *   - deadletter               → caller persists deadletteredAt = now
 *   - delivered                → caller persists deliveredAt = now
 *
 * Backoff schedule (cumulative seconds from the *first* attempt):
 *   Attempt #  Wait before next  Total elapsed
 *      1            30s              30s
 *      2             1m              90s
 *      3             5m             ~6m
 *      4            30m             ~36m
 *      5             1h            ~1h36m
 *      6             6h             ~7h36m
 *      7            12h           ~19h36m
 *      8 (last)     deadletter
 *
 * Jitter: ±25% multiplied to the baseline so a thundering herd of
 * delivery failures doesn't retry in lockstep. Deterministic when
 * `jitterRoll` is supplied (used in tests + makes scheduling
 * reproducible from the audit trail).
 *
 * Pure — no I/O, no Date.now() unless `now` omitted (caller passes
 * for testability + audit replay).
 */

export const MAX_ATTEMPTS = 8;
const BACKOFF_SECONDS: ReadonlyArray<number> = [
  30,            // after attempt 1
  60,            // after attempt 2
  5 * 60,        // after attempt 3
  30 * 60,       // after attempt 4
  60 * 60,       // after attempt 5
  6 * 60 * 60,   // after attempt 6
  12 * 60 * 60,  // after attempt 7
  // No backoff after attempt 8 — deadletter.
];

export type RetryDecisionKind =
  | "schedule_retry"
  | "deadletter_max_retries";

export interface RetryDecision {
  kind: RetryDecisionKind;
  /** When kind="schedule_retry" — the absolute timestamp to fire next. */
  nextAttemptAt?: Date;
  /** Backoff seconds applied (jittered). For audit. */
  delaySeconds?: number;
  /** Next attempt number that will be made (1-based). */
  nextAttemptNumber?: number;
}

export interface ComputeRetryInput {
  /** 1-based — the attempt that just FAILED. */
  failedAttemptNumber: number;
  /** Current time. Pass for testability. */
  now?: Date;
  /** Optional [0,1] random roll used for jitter — supply for determinism. */
  jitterRoll?: number;
}

/**
 * Apply the standard backoff schedule. Returns the next delay
 * in seconds (jittered) or null when we've exceeded MAX_ATTEMPTS.
 */
export function computeWebhookRetry(input: ComputeRetryInput): RetryDecision {
  const failed = input.failedAttemptNumber;
  if (failed >= MAX_ATTEMPTS) {
    return { kind: "deadletter_max_retries" };
  }

  // BACKOFF_SECONDS[i] is the wait AFTER attempt (i+1) — so for
  // failedAttemptNumber=1, we use index 0.
  const baseline = BACKOFF_SECONDS[failed - 1];
  if (baseline === undefined) {
    return { kind: "deadletter_max_retries" };
  }

  // Jitter: multiply by 0.75..1.25 deterministically.
  const roll = typeof input.jitterRoll === "number"
    ? Math.max(0, Math.min(1, input.jitterRoll))
    : Math.random();
  const jitterFactor = 0.75 + (roll * 0.5);
  const delaySeconds = Math.round(baseline * jitterFactor);

  const now = input.now ?? new Date();
  const nextAttemptAt = new Date(now.getTime() + delaySeconds * 1000);

  return {
    kind: "schedule_retry",
    nextAttemptAt,
    delaySeconds,
    nextAttemptNumber: failed + 1,
  };
}
