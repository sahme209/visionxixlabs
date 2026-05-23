/**
 * Pure run-level cost budget gate — Phase 400.
 *
 * Decides whether a pipeline run should be allowed to start its NEXT
 * stage given the cents already spent. Closed-union decision so the
 * runner can render specific halt messages + the audit can record
 * which threshold tripped.
 *
 * Three thresholds, evaluated in priority order:
 *
 *   1. hard cap (default $5.00 = 500¢)
 *      → halt: budget_exceeded
 *
 *   2. soft warn (default 80% of hard cap)
 *      → allow with `warnThresholdCrossed: true` so the runner can
 *        fire a billing.threshold_crossed webhook before the next
 *        spendy stage
 *
 *   3. otherwise → allow with no warning
 *
 * The runner is expected to call this between stages — after stage N
 * completes + before stage N+1 starts.
 *
 * Pure — no I/O.
 */

export type BudgetDecisionKind =
  | "allowed"
  | "allowed_warn_threshold"
  | "halt_budget_exceeded";

export interface BudgetDecision {
  kind: BudgetDecisionKind;
  /** True iff the run is allowed to advance. */
  allowed: boolean;
  /** True iff the next stage should fire a billing.threshold_crossed webhook. */
  warnThresholdCrossed: boolean;
  /** Cumulative cost so far in cents. */
  spentCents: number;
  /** Configured hard cap in cents (after defaults). */
  maxCents: number;
  /** Cents remaining before the hard cap. Clamped to >= 0. */
  remainingCents: number;
  /** 0..N+ ratio of spent / max. */
  ratio: number;
  /** Operator-readable message for audit / UI. */
  message: string;
}

export interface AssertBudgetInput {
  /** Cumulative cents spent on this run so far. */
  spentCents: number;
  /** Hard cap in cents. null → unlimited (Enterprise / internal runs). */
  maxCents: number | null;
  /** 0..1 — when crossed, fire a warning. Default 0.8. */
  warnAtRatio?: number;
}

const DEFAULT_WARN_AT = 0.8;

export function assertRunCostBudget(input: AssertBudgetInput): BudgetDecision {
  const { spentCents } = input;
  const warnAt = input.warnAtRatio ?? DEFAULT_WARN_AT;

  // Unlimited — short-circuit.
  if (input.maxCents === null) {
    return {
      kind: "allowed",
      allowed: true,
      warnThresholdCrossed: false,
      spentCents,
      maxCents: Number.POSITIVE_INFINITY,
      remainingCents: Number.POSITIVE_INFINITY,
      ratio: 0,
      message: "Unlimited budget tier.",
    };
  }

  const maxCents = input.maxCents;

  // Defensive — zero/negative cap halts (the run has no allowance at all).
  if (maxCents <= 0) {
    return {
      kind: "halt_budget_exceeded",
      allowed: false,
      warnThresholdCrossed: false,
      spentCents,
      maxCents,
      remainingCents: 0,
      ratio: spentCents > 0 ? 1 : 0,
      message: `Run has no cost budget configured (max=${maxCents}¢).`,
    };
  }

  const ratio = spentCents / maxCents;
  const remainingCents = Math.max(0, maxCents - spentCents);

  if (spentCents >= maxCents) {
    return {
      kind: "halt_budget_exceeded",
      allowed: false,
      warnThresholdCrossed: false,
      spentCents,
      maxCents,
      remainingCents: 0,
      ratio,
      message: `Cumulative run cost ${spentCents}¢ has reached the cap ${maxCents}¢. Halting.`,
    };
  }

  if (ratio >= warnAt) {
    return {
      kind: "allowed_warn_threshold",
      allowed: true,
      warnThresholdCrossed: true,
      spentCents,
      maxCents,
      remainingCents,
      ratio,
      message: `Cumulative run cost ${spentCents}¢ has crossed ${(warnAt * 100).toFixed(0)}% of cap ${maxCents}¢; ${remainingCents}¢ remaining.`,
    };
  }

  return {
    kind: "allowed",
    allowed: true,
    warnThresholdCrossed: false,
    spentCents,
    maxCents,
    remainingCents,
    ratio,
    message: `${remainingCents}¢ of budget ${maxCents}¢ remaining.`,
  };
}

/**
 * Default per-run cost cap. Stays conservative for the platform's own
 * coding pipeline — operator can override per-pipeline if a larger
 * refactor warrants more spend.
 */
export const DEFAULT_RUN_MAX_CENTS = 500; // $5.00
