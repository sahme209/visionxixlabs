/**
 * Phase 418 — sticky-error classifier.
 *
 * Walks a ConnectorSetupTransition history and decides whether the
 * connector is genuinely broken in a way that warrants escalation,
 * or just doing the normal noisy recovery dance.
 *
 * Drives:
 *   - alert routing  (don't page an on-call human on a single transient)
 *   - dashboard tone (sticky errors get a louder card)
 *   - retry backoff  (sticky → exponential, oscillating → fixed)
 *
 * Pure function over an immutable input — no I/O, no clock dep beyond
 * the injected `now`.
 */

import type { ConnectorSetupStatus } from "./connectorSetupSession";

/* ──────────────────────────────────────────────────────────────────
   Input shape — the minimum subset of ConnectorSetupTransitionRow the
   classifier needs. Decoupled from Prisma so tests can pass plain
   objects.
   ────────────────────────────────────────────────────────────── */

export interface TransitionForClassify {
  toStatus: ConnectorSetupStatus;
  eventKind: string;
  isLegal: boolean;
  eventPayload: Record<string, unknown> | null;
  createdAt: Date;
}

/* ──────────────────────────────────────────────────────────────────
   Classification result.
   ────────────────────────────────────────────────────────────── */

export type StickyErrorClassification =
  | { kind: "healthy"; reason: HealthyReason }
  | { kind: "transient_failure"; lastFailureAt: Date; errorCode: string | null }
  | { kind: "sticky_error"; errorCode: string; consecutiveCount: number; firstSeenAt: Date; lastSeenAt: Date }
  | { kind: "chronic_oscillation"; regressCount: number; recoverCount: number; windowFirstAt: Date; windowLastAt: Date };

export type HealthyReason =
  | "no_history"
  | "no_failures_in_window"
  | "last_event_was_recovery";

export interface ClassifyOptions {
  /** Now anchor — drives the lookback window. Defaults to new Date(). */
  now?: Date;
  /** Window the classifier considers, in hours. Defaults to 24. */
  windowHours?: number;
  /** Number of consecutive same-errorCode failures that triggers `sticky_error`. Defaults to 3. */
  stickyThreshold?: number;
  /** Number of regress↔recover round trips that triggers `chronic_oscillation`. Defaults to 3. */
  oscillationThreshold?: number;
}

/* ──────────────────────────────────────────────────────────────────
   Public surface.
   ────────────────────────────────────────────────────────────── */

export function classifyTransitionHistory(
  transitions: ReadonlyArray<TransitionForClassify>,
  opts: ClassifyOptions = {},
): StickyErrorClassification {
  const now = opts.now ?? new Date();
  const windowHours = opts.windowHours ?? 24;
  const stickyThreshold = opts.stickyThreshold ?? 3;
  const oscillationThreshold = opts.oscillationThreshold ?? 3;
  const windowFloor = new Date(now.getTime() - windowHours * 3_600_000);

  if (transitions.length === 0) {
    return { kind: "healthy", reason: "no_history" };
  }

  // We only care about *legal* transitions in the window for state-shape
  // questions; illegal rows are debugging noise.
  const inWindow = transitions
    .filter((t) => t.isLegal && t.createdAt >= windowFloor)
    .slice()
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  if (inWindow.length === 0) {
    return { kind: "healthy", reason: "no_failures_in_window" };
  }

  const failures = inWindow.filter(isFailureEvent);
  if (failures.length === 0) {
    return { kind: "healthy", reason: "no_failures_in_window" };
  }

  // If the most recent legal event was a recovery, the failures upstream
  // were resolved. Don't escalate.
  const last = inWindow[inWindow.length - 1];
  if (isRecoveryEvent(last)) {
    return { kind: "healthy", reason: "last_event_was_recovery" };
  }

  // Oscillation check FIRST — a string of regress/recover toggles signals
  // a flaky connector that should NOT be classified as sticky even if the
  // errorCode happens to be stable.
  const regressCount = inWindow.filter((t) => t.eventKind === "health_check_regressed").length;
  const recoverCount = inWindow.filter((t) => t.eventKind === "health_check_recovered").length;
  if (regressCount >= oscillationThreshold && recoverCount >= oscillationThreshold) {
    return {
      kind: "chronic_oscillation",
      regressCount, recoverCount,
      windowFirstAt: inWindow[0].createdAt,
      windowLastAt:  inWindow[inWindow.length - 1].createdAt,
    };
  }

  // Sticky check — look for the longest tail of same-errorCode failures
  // ending at the most recent failure. Retry-chain events (operator_started,
  // provider_link_opened, bounce_back_received) are treated as non-breaking
  // because the kernel forces them between every validation_failed: there is
  // no way to express "two back-to-back failures" without those in between.
  // A recovery event (validation_succeeded, health_check_recovered) DOES
  // break the streak — that's a real reset.
  const tailStreak = takeTrailingFailureStreak(inWindow);
  if (tailStreak.length >= stickyThreshold && tailStreak[0].errorCode !== null) {
    const codes = new Set(tailStreak.map((s) => s.errorCode));
    if (codes.size === 1) {
      return {
        kind: "sticky_error",
        errorCode: tailStreak[0].errorCode!,
        consecutiveCount: tailStreak.length,
        firstSeenAt: tailStreak[0].at,
        lastSeenAt:  tailStreak[tailStreak.length - 1].at,
      };
    }
  }

  // Otherwise: failures exist but didn't meet either bar.
  const mostRecentFailure = failures[failures.length - 1];
  return {
    kind: "transient_failure",
    lastFailureAt: mostRecentFailure.createdAt,
    errorCode: extractErrorCode(mostRecentFailure),
  };
}

/* ──────────────────────────────────────────────────────────────────
   Internals.
   ────────────────────────────────────────────────────────────── */

function isFailureEvent(t: TransitionForClassify): boolean {
  // Events that put the session in a worse state. health_check_regressed
  // counts — it moves connected → needs_attention, which IS a failure
  // signal even though it didn't fully break.
  return t.eventKind === "validation_failed"
      || t.eventKind === "health_check_regressed"
      || t.eventKind === "provider_revoked_credentials";
}

function isRecoveryEvent(t: TransitionForClassify): boolean {
  return t.eventKind === "validation_succeeded" || t.eventKind === "health_check_recovered";
}

function extractErrorCode(t: TransitionForClassify): string | null {
  if (!t.eventPayload) return null;
  const v = t.eventPayload.errorCode;
  return typeof v === "string" ? v : null;
}

/**
 * Walk backwards from the most recent transition, collecting failure
 * events. Retry-chain events (operator_started, provider_link_opened,
 * bounce_back_received) are skipped — they're not failures and they're
 * not recoveries, just the kernel's mandatory path back to `validating`.
 * A recovery event (validation_succeeded, health_check_recovered) IS a
 * streak-breaker. Returns failures in chronological order.
 */
function takeTrailingFailureStreak(inWindow: ReadonlyArray<TransitionForClassify>): Array<{ at: Date; errorCode: string | null }> {
  const out: Array<{ at: Date; errorCode: string | null }> = [];
  for (let i = inWindow.length - 1; i >= 0; i--) {
    const t = inWindow[i];
    if (isFailureEvent(t)) {
      out.unshift({ at: t.createdAt, errorCode: extractErrorCode(t) });
      continue;
    }
    if (isRecoveryEvent(t)) break;
    // Retry-chain events (operator_started / provider_link_opened /
    // bounce_back_received) — skip without breaking the streak.
  }
  return out;
}
