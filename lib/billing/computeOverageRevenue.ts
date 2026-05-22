/**
 * Overage revenue calculator — Phase 383.
 *
 * Pure function. Given a plan + total MTD AI cost, derive:
 *
 *   - overageCostCents     — what VisionXIXLabs paid the vendor for tokens
 *                            beyond the plan's included credit pool.
 *   - overageRevenueCents  — what we bill the customer for those tokens,
 *                            using the plan's overage rates as a retail
 *                            markup over the vendor cost.
 *   - markupMultiplier     — implicit markup derived from the plan's
 *                            overage rates vs the underlying provider
 *                            cost (e.g. Sonnet 4.6 input is 300¢/1M;
 *                            Growth's overage input rate is 600¢/1M →
 *                            markup of 2.0x).
 *
 * The cleanest economic model would charge per *token* at the plan's
 * declared retail rate. We don't have token-level retail prices on
 * every plan (Enterprise has none — custom contract), and the platform
 * stores costs in cents, not tokens, by the time the summary is built.
 *
 * Approximation: assume the cost mix matches the plan's input/output
 * mix and apply the implicit markup as a multiplier. For Enterprise +
 * Starter (hard_stop / custom_contract) the function returns
 * { overageCostCents, overageRevenueCents: 0, markupMultiplier: 0 } —
 * those plans don't bill metered overage out-of-band.
 *
 * Pure — no Prisma, no I/O. Testable matrix.
 */

import type { PricingPlan } from "./planRegistry";

export interface OverageInput {
  plan: PricingPlan;
  /** Total MTD AI cost in cents (vendor cost, what we paid). */
  totalAICostCents: number;
}

export interface OverageResult {
  overageCostCents: number;
  overageRevenueCents: number;
  markupMultiplier: number;
}

/**
 * Reference provider rates used to back-derive the implicit markup.
 * Assumes Sonnet 4.6 as the workhorse model for non-Opus plans —
 * 300¢/1M input + 1500¢/1M output. If the plan later shifts to Opus
 * as its workhorse, this constant moves accordingly.
 *
 * The blend (input vs output) doesn't matter for the multiplier math
 * because we're comparing rate ratios (plan / provider) which are
 * unitless; we just need one rate from each side.
 */
const REFERENCE_INPUT_RATE_CPM = 300;   // Sonnet 4.6 input cents/million
const REFERENCE_OUTPUT_RATE_CPM = 1500; // Sonnet 4.6 output cents/million

/**
 * Pure averaging — input + output markup, then mean. Defensive: when
 * either plan rate is null OR zero OR the reference is zero, treat
 * the multiplier as 0 (no overage revenue computed).
 */
function deriveMarkup(plan: PricingPlan): number {
  const inRate = plan.entitlements.overageInputCentsPerMillion;
  const outRate = plan.entitlements.overageOutputCentsPerMillion;
  if (inRate == null || outRate == null || inRate <= 0 || outRate <= 0) return 0;
  const inputMarkup = inRate / REFERENCE_INPUT_RATE_CPM;
  const outputMarkup = outRate / REFERENCE_OUTPUT_RATE_CPM;
  // Mean of input + output markup. For Growth's 600/3000 vs Sonnet 300/1500,
  // both ratios are 2.0 → mean is 2.0. Plan rates that mix ratios yield
  // a blended multiplier.
  return (inputMarkup + outputMarkup) / 2;
}

export function computeOverageRevenue(input: OverageInput): OverageResult {
  const included = input.plan.entitlements.includedAICreditsCents;
  const overageCostCents = Math.max(0, input.totalAICostCents - included);

  if (overageCostCents === 0) {
    return { overageCostCents: 0, overageRevenueCents: 0, markupMultiplier: 0 };
  }

  const policy = input.plan.entitlements.overagePolicy;
  // Only metered_billing converts overage into revenue. hard_stop blocks
  // the action, soft_warn doesn't charge, custom_contract is bespoke.
  if (policy !== "metered_billing") {
    return { overageCostCents, overageRevenueCents: 0, markupMultiplier: 0 };
  }

  const markupMultiplier = deriveMarkup(input.plan);
  if (markupMultiplier === 0) {
    return { overageCostCents, overageRevenueCents: 0, markupMultiplier: 0 };
  }

  const overageRevenueCents = Math.floor(overageCostCents * markupMultiplier);
  return { overageCostCents, overageRevenueCents, markupMultiplier };
}
