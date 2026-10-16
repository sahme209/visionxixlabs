import { PUBLIC_PLAN_CATALOG, type BillingInterval, type PaidPublicPlanId } from "./publicPlanCatalog";

/** Pure proposal kernels only: no route, storage, provider or entitlement authority.
 * A structurally valid input is NOT evidence of a verified contract. Future IO
 * must independently prove isolated storage, identity, binding and provenance. */
export const NEW_TEST_CATALOG_VERSION = "axiom_public_test_v1" as const;
const RETRY_WINDOW_MS = 23 * 60 * 60 * 1000;

type PriceSnapshot = {
  id: string; livemode: boolean; active: boolean; currency: string;
  type: string; billing_scheme: string; unit_amount: number;
  transform_quantity?: unknown;
  recurring: { interval: string; interval_count: number; usage_type: string };
};
export type NewTestTerms = {
  catalogVersion: typeof NEW_TEST_CATALOG_VERSION;
  planId: PaidPublicPlanId; interval: BillingInterval; seatQuantity: number;
  priceId: string; unitAmountCents: number; monthlyAICreditsCents: number;
  monthlyDeployments: number;
};
export function matchNewTestTerms(input: {
  planId: PaidPublicPlanId; interval: BillingInterval; seatQuantity: number;
  configuredPriceId: string; price: PriceSnapshot;
}): { kind: "supported_terms"; terms: NewTestTerms } | { kind: "unsupported_terms" } {
  const plan = PUBLIC_PLAN_CATALOG.find(p => p.id === input.planId);
  const annual = input.interval === "annual";
  const expected = plan && (annual ? plan.annualPricePerUserCents * 12 : plan.monthlyPricePerUserCents);
  const p = input.price;
  if (!plan || (input.planId !== "pro" && input.planId !== "enterprise") || !["monthly", "annual"].includes(input.interval)
    || !Number.isSafeInteger(input.seatQuantity) || input.seatQuantity < 1
    || !input.configuredPriceId || p.id !== input.configuredPriceId || p.livemode !== false || p.active !== true
    || p.type !== "recurring" || p.currency !== "usd" || p.billing_scheme !== "per_unit" || p.transform_quantity != null
    || !p.recurring || p.recurring.usage_type !== "licensed" || p.recurring.interval !== (annual ? "year" : "month")
    || p.recurring.interval_count !== 1 || p.unit_amount !== expected
    || !Number.isSafeInteger(plan.monthlyAiCreditCents * input.seatQuantity)
    || !Number.isSafeInteger(p.unit_amount * input.seatQuantity) || plan.monthlyDeployments === null) return { kind: "unsupported_terms" };
  return { kind: "supported_terms", terms: { catalogVersion: NEW_TEST_CATALOG_VERSION, planId: input.planId,
    interval: input.interval, seatQuantity: input.seatQuantity, priceId: p.id, unitAmountCents: p.unit_amount,
    monthlyAICreditsCents: plan.monthlyAiCreditCents * input.seatQuantity, monthlyDeployments: plan.monthlyDeployments } };
}

export type FrozenRecurringIntent = {
  organizationId: string; clientIntentKey: string; requestDigest: string;
  providerIdempotencyKey: string; canonicalRequest: string | null;
  createdAtMs: number; retryNotAfterMs: number;
  state: "prepared" | "attempted" | "unknown" | "session_confirmed" | "bound" | "terminal_verified";
};
/** Decision only; caller still needs atomic durable claim and verified evidence.
 * Never generates a new key or declares an unknown outcome terminal. */
export function decideRecurringIntentRecovery(intent: FrozenRecurringIntent, request: {
  organizationId: string; clientIntentKey: string; requestDigest: string; nowMs: number;
}): "conflict" | "initial_claim_required" | "same_request_retry_claim_required" | "reconcile_only" | "observe_existing" | "terminal_verified" {
  if (request.organizationId !== intent.organizationId || request.clientIntentKey !== intent.clientIntentKey
    || request.requestDigest !== intent.requestDigest || !intent.organizationId || !intent.clientIntentKey) return "conflict";
  if (intent.state === "session_confirmed" || intent.state === "bound") return "observe_existing";
  if (intent.state === "terminal_verified") return "terminal_verified";
  if (!Number.isFinite(request.nowMs) || !Number.isSafeInteger(intent.createdAtMs) || intent.createdAtMs > request.nowMs
    || !Number.isSafeInteger(intent.retryNotAfterMs) || intent.retryNotAfterMs <= intent.createdAtMs
    || intent.retryNotAfterMs > intent.createdAtMs + RETRY_WINDOW_MS || request.nowMs >= intent.retryNotAfterMs
    || !intent.canonicalRequest || !intent.providerIdempotencyKey || !/^[a-f0-9]{64}$/.test(intent.requestDigest)) return "reconcile_only";
  if (intent.state === "prepared") return "initial_claim_required";
  if (intent.state === "attempted" || intent.state === "unknown") return "same_request_retry_claim_required";
  return "reconcile_only";
}
