/**
 * AI billing margin — Phase 581.
 *
 * Deterministic multiplier applied on top of authoritative provider cost.
 * The customer-price ledger records `provider_cost × 1.5` (a 50% service
 * margin), taken from `AI_RATE_CARD` (ai_rate_card_v1). It is deliberately not an environment setting: a deployment
 * variable must never silently change the amount a workspace is charged.
 *
 * This module computes a ledger amount only. It does not create a Stripe
 * charge; that remains disabled until the separately gated, replay-safe
 * settlement path and Stripe test-mode verification are complete.
 */

import { AI_RATE_CARD } from "./aiRateCard";

/** Read from the single versioned rate card (`aiRateCard.ts`). */
export const AI_CUSTOMER_USAGE_MARGIN_MULT: number = AI_RATE_CARD.marginMultiplier;

export function loadAiBillingMargin(): number {
  return AI_CUSTOMER_USAGE_MARGIN_MULT;
}

/**
 * Apply the margin multiplier to integer-cents provider cost. Uses
 * Math.round to keep cents an integer; result is the cents value
 * the customer's invoice will show.
 */
export function applyMargin(providerCostCents: number): number {
  if (!Number.isSafeInteger(providerCostCents) || providerCostCents < 0) {
    throw new Error("provider_cost_cents_invalid");
  }
  const customerCents = Math.round(providerCostCents * AI_CUSTOMER_USAGE_MARGIN_MULT);
  if (!Number.isSafeInteger(customerCents)) {
    throw new Error("customer_billed_cents_invalid");
  }
  return customerCents;
}
