import { PUBLIC_PLAN_CATALOG, type PaidPublicPlanId, type BillingInterval } from "./publicPlanCatalog";
const record = (value: unknown): Record<string, unknown> | null => value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
/** Prices are provider facts, never inferred from a configured price identifier.
 * Existing subscriptions can reconcile archived prices; new purchases cannot. */
export function matchesPublicStripePrice(value: unknown, expected: { planId: PaidPublicPlanId; interval: BillingInterval; expectedPriceId: string; livemode: boolean }, forCheckout: boolean): boolean {
  const price = record(value), recurring = record(price?.recurring);
  const plan = PUBLIC_PLAN_CATALOG.find(plan => plan.id === expected.planId);
  if (!plan || !price || !recurring || !expected.expectedPriceId) return false;
  const amount = expected.interval === "monthly" ? plan.monthlyPricePerUserCents : plan.annualPricePerUserCents * 12;
  if (price.id !== expected.expectedPriceId || price.livemode !== expected.livemode || price.type !== "recurring" || price.currency !== "usd" || price.billing_scheme !== "per_unit" || price.unit_amount !== amount || price.transform_quantity != null || recurring.interval !== (expected.interval === "monthly" ? "month" : "year") || recurring.interval_count !== 1 || recurring.usage_type !== "licensed") return false;
  if (!forCheckout) return true;
  const product = record(price.product);
  return price.active === true && product !== null && typeof product.id === "string" && product.active === true && product.livemode === expected.livemode && product.deleted !== true;
}
