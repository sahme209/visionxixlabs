/**
 * Pure pre-flight AI credit gate — Phase 382.
 *
 * Decides whether a workspace is allowed to incur additional AI cost
 * right now. Inputs: current MTD AI cost, plan entitlements, and
 * overage policy. Output: a decision with a clear reason.
 *
 * Soft-warning thresholds (70%, 90%) DO NOT block — they're observability
 * signals for the dashboard. Only `hard_stop` blocks when the pool is
 * exhausted. `metered_billing` and `custom_contract` always pass; we
 * trust the billing pipeline downstream to charge for overage.
 *
 * Pure — no Prisma, no I/O. Testable matrix.
 */

import type { PricingPlan } from "./planRegistry";

export type PreflightDecisionKind = "allow" | "block";

export type PreflightThresholdKind = "below_70" | "warn_70" | "warn_90" | "exhausted";

export interface PreflightInput {
  plan: PricingPlan;
  /** Current MTD AI cost in cents. */
  currentAICostCents: number;
  /** Optional estimated cost of the upcoming call (cents). Adds to current for the check. */
  expectedAdditionalCostCents?: number;
}

export interface PreflightDecision {
  kind: PreflightDecisionKind;
  /** Reason for block when kind === "block"; null when allowed. */
  reason: "credit_pool_exhausted" | null;
  threshold: PreflightThresholdKind;
  /** Cents remaining in the credit pool (clamped at 0). */
  remainingCents: number;
  /** Projected utilization 0–1 (uncapped — can exceed 1 on overage plans). */
  projectedRatio: number;
}

export function preflightAICreditCheck(input: PreflightInput): PreflightDecision {
  const included = input.plan.entitlements.includedAICreditsCents;
  const projectedCost = input.currentAICostCents + Math.max(0, input.expectedAdditionalCostCents ?? 0);
  const remainingCents = Math.max(0, included - projectedCost);
  const projectedRatio = included > 0 ? projectedCost / included : 0;

  let threshold: PreflightThresholdKind;
  if (projectedRatio >= 1)        threshold = "exhausted";
  else if (projectedRatio >= 0.9) threshold = "warn_90";
  else if (projectedRatio >= 0.7) threshold = "warn_70";
  else                            threshold = "below_70";

  const overagePolicy = input.plan.entitlements.overagePolicy;

  // hard_stop is the only policy that blocks. soft_warn warns but allows.
  // metered_billing + custom_contract always allow — the overage flows downstream.
  if (threshold === "exhausted" && overagePolicy === "hard_stop") {
    return { kind: "block", reason: "credit_pool_exhausted", threshold, remainingCents, projectedRatio };
  }

  return { kind: "allow", reason: null, threshold, remainingCents, projectedRatio };
}
