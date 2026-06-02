/**
 * AI billing margin — Phase 581.
 *
 * Operator-configurable multiplier applied on top of the raw
 * provider cost (Anthropic + OpenAI passthrough). The platform
 * charges the customer `provider_cost × margin`. Default 1.25
 * (25% platform service fee) — matches typical SaaS passthrough
 * pricing.
 *
 * Set on the host via AI_BILLING_MARGIN_MULT. Floor-clamped to 1.0
 * so the platform never charges LESS than provider cost (would
 * leak money), ceiling-clamped to 5.0 as a guard against misconfig.
 */

const DEFAULT_MARGIN_MULT = 1.25;
const MIN_MARGIN = 1.0;
const MAX_MARGIN = 5.0;

export function loadAiBillingMargin(): number {
  const raw = process.env.AI_BILLING_MARGIN_MULT?.trim();
  if (!raw) return DEFAULT_MARGIN_MULT;
  const parsed = Number.parseFloat(raw);
  if (!Number.isFinite(parsed)) return DEFAULT_MARGIN_MULT;
  if (parsed < MIN_MARGIN) return MIN_MARGIN;
  if (parsed > MAX_MARGIN) return MAX_MARGIN;
  return parsed;
}

/**
 * Apply the margin multiplier to integer-cents provider cost. Uses
 * Math.round to keep cents an integer; result is the cents value
 * the customer's invoice will show.
 */
export function applyMargin(providerCostCents: number, marginMult = loadAiBillingMargin()): number {
  return Math.round(providerCostCents * marginMult);
}
