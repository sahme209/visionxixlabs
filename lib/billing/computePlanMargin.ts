/**
 * Pure plan-margin calculator — Phase 381.
 *
 * Given a plan's price + an org's month-to-date usage cost + estimated
 * fixed costs, derive gross margin and surface warnings the operator
 * needs to see ("this customer is unprofitable", "AI cost is approaching
 * plan price", "should be enterprise"). Lives separate from Prisma so
 * the matrix can be unit-tested.
 *
 * Cents everywhere. Integer math. No float drift.
 */

import type { PricingPlan, PlanTier } from "./planRegistry";

export interface PlanMarginInput {
  plan: PricingPlan;
  /** Real AI cost incurred against vendor rates, MTD. */
  aiCostCents: number;
  /** Allocated infrastructure cost (DB, hosting, storage, logs) — operator estimate. */
  infraCostCents: number;
  /** Stripe + payment processing fee (e.g., 2.9% + 30¢ per charge). */
  paymentProcessingCents: number;
  /** Allocated support cost. */
  supportCostCents: number;
  /** Overage revenue collected MTD (for plans with metered overage). */
  overageRevenueCents: number;
}

export type MarginWarningKind =
  | "ai_cost_above_plan_price"
  | "ai_cost_above_50pct_of_plan_price"
  | "negative_gross_margin"
  | "ai_credit_pool_exhausted"
  | "no_overage_revenue_on_overage_plan"
  | "enterprise_should_have_custom_contract";

export interface PlanMarginResult {
  /** Plan price + overage revenue (cents). */
  monthlyRevenueCents: number | null;
  /** Sum of all attributed costs (cents). */
  totalCostCents: number;
  /** Revenue minus cost (cents). Null when revenue is null (enterprise contract). */
  grossMarginCents: number | null;
  /** Gross margin as a 0–1 ratio. Null when revenue is null or zero. */
  grossMarginRatio: number | null;
  /** AI cost as fraction of plan price. Null when price is null. */
  aiCostRatio: number | null;
  warnings: ReadonlyArray<MarginWarningKind>;
}

const NEGATIVE_MARGIN_TIERS_EXEMPT: ReadonlySet<PlanTier> = new Set(["enterprise"]);

export function computePlanMargin(input: PlanMarginInput): PlanMarginResult {
  const { plan, aiCostCents, infraCostCents, paymentProcessingCents, supportCostCents, overageRevenueCents } = input;

  const planPrice = plan.monthlyPriceCents;
  const monthlyRevenueCents = planPrice == null ? null : planPrice + Math.max(0, overageRevenueCents);
  const totalCostCents = Math.max(0, aiCostCents) + Math.max(0, infraCostCents) + Math.max(0, paymentProcessingCents) + Math.max(0, supportCostCents);

  const grossMarginCents = monthlyRevenueCents == null ? null : monthlyRevenueCents - totalCostCents;
  const grossMarginRatio = monthlyRevenueCents && monthlyRevenueCents > 0 && grossMarginCents != null
    ? grossMarginCents / monthlyRevenueCents
    : null;
  const aiCostRatio = planPrice && planPrice > 0
    ? aiCostCents / planPrice
    : null;

  const warnings: MarginWarningKind[] = [];

  // 1. AI cost > plan price = always a red flag.
  if (planPrice != null && aiCostCents > planPrice) {
    warnings.push("ai_cost_above_plan_price");
  } else if (planPrice != null && aiCostCents > planPrice / 2) {
    warnings.push("ai_cost_above_50pct_of_plan_price");
  }

  // 2. Negative gross margin (except enterprise, where it's expected during onboarding).
  if (grossMarginCents != null && grossMarginCents < 0 && !NEGATIVE_MARGIN_TIERS_EXEMPT.has(plan.tier)) {
    warnings.push("negative_gross_margin");
  }

  // 3. Exhausted credit pool on a metered-billing plan with no overage revenue.
  if (
    aiCostCents > plan.entitlements.includedAICreditsCents &&
    plan.entitlements.overagePolicy === "metered_billing" &&
    overageRevenueCents === 0
  ) {
    warnings.push("no_overage_revenue_on_overage_plan");
  }

  // 4. Soft signal: credit pool fully consumed regardless of plan.
  if (aiCostCents >= plan.entitlements.includedAICreditsCents && plan.entitlements.includedAICreditsCents > 0) {
    warnings.push("ai_credit_pool_exhausted");
  }

  // 5. Enterprise without monthly price — confirm the custom contract is in place.
  if (plan.tier === "enterprise" && planPrice == null) {
    warnings.push("enterprise_should_have_custom_contract");
  }

  return {
    monthlyRevenueCents,
    totalCostCents,
    grossMarginCents,
    grossMarginRatio,
    aiCostRatio,
    warnings,
  };
}

/** Convenience: estimate Stripe fee for a one-time charge of N cents (2.9% + 30¢). */
export function estimateStripeFee(amountCents: number): number {
  if (amountCents <= 0) return 0;
  return Math.floor(amountCents * 0.029) + 30;
}
