import { describe, expect, it } from "vitest";
import { matchNewTestTerms, decideRecurringIntentRecovery, type FrozenRecurringIntent } from "../newTestSubscriptionContract";
import { planForStripeTier } from "../planRegistry";
const price = (unit_amount = 2900) => ({ id: "price_test", livemode: false, active: true, currency: "usd", type: "recurring", billing_scheme: "per_unit", unit_amount, recurring: { interval: "month", interval_count: 1, usage_type: "licensed" } });
const input = () => ({ planId: "pro" as const, interval: "monthly" as const, seatQuantity: 3, configuredPriceId: "price_test", price: price() });
const now = 1_800_000_000_000;
const intent = (): FrozenRecurringIntent => ({ organizationId: "synthetic_org", clientIntentKey: "intent_1", requestDigest: "a".repeat(64), providerIdempotencyKey: "durable_provider_key", canonicalRequest: '{"frozen":true}', createdAtMs: now, retryNotAfterMs: now + 23 * 3600000, state: "unknown" });
const request = () => ({ organizationId: "synthetic_org", clientIntentKey: "intent_1", requestDigest: "a".repeat(64), nowMs: now + 1 });
describe("new TEST contract proposal kernels, disconnected from runtime", () => {
  it("models public new-test per-seat credits without reinterpreting legacy plans", () => {
    expect(matchNewTestTerms(input())).toMatchObject({ kind: "supported_terms", terms: { monthlyAICreditsCents: 3000, monthlyDeployments: 100 } });
    expect(matchNewTestTerms({ ...input(), planId: "enterprise", price: price(7900) })).toMatchObject({ kind: "supported_terms", terms: { monthlyAICreditsCents: 9000, monthlyDeployments: 500 } });
    expect(planForStripeTier("growth").entitlements.includedAICreditsCents).toBe(20000);
    expect(planForStripeTier("enterprise").entitlements.includedAICreditsCents).toBe(500000);
  });
  it.each([["pro", 27840, 3000], ["enterprise", 75840, 9000]] as const)("annual %s uses 12 discounted months but monthly credit allocation", (planId, amount, credits) => {
    expect(matchNewTestTerms({ ...input(), planId, interval: "annual", price: { ...price(amount), recurring: { interval: "year", interval_count: 1, usage_type: "licensed" } } })).toMatchObject({ kind: "supported_terms", terms: { monthlyAICreditsCents: credits, unitAmountCents: amount } });
  });
  it.each([{ livemode: true }, { unit_amount: 1 }, { unit_amount: 29000 }, { currency: "eur" }, { active: false }, { billing_scheme: "tiered" }, { id: "other" }, { transform_quantity: {} }, { recurring: { interval: "month", interval_count: 1, usage_type: "metered" } }])("rejects incompatible price %j", patch => {
    expect(matchNewTestTerms({ ...input(), price: { ...price(), ...patch } })).toEqual({ kind: "unsupported_terms" });
  });
  it.each([0, -1, 1.5, Number.MAX_SAFE_INTEGER])("rejects invalid/overflow seat count %s", seatQuantity => expect(matchNewTestTerms({ ...input(), seatQuantity })).toEqual({ kind: "unsupported_terms" }));
  it("requires a new atomic claim with the same frozen request/key after uncertain outcome", () => {
    const frozen = intent();
    expect(decideRecurringIntentRecovery(frozen, request())).toBe("same_request_retry_claim_required");
    expect(frozen.providerIdempotencyKey).toBe("durable_provider_key");
    expect(frozen.state).toBe("unknown");
    expect(decideRecurringIntentRecovery({ ...frozen, state: "prepared" }, request())).toBe("initial_claim_required");
  });
  it.each([{ organizationId: "other" }, { clientIntentKey: "new_key" }, { requestDigest: "b".repeat(64) }])("conflicts on changed binding/terms %j", patch => expect(decideRecurringIntentRecovery(intent(), { ...request(), ...patch })).toBe("conflict"));
  it.each([{ canonicalRequest: null }, { providerIdempotencyKey: "" }, { createdAtMs: now + 5 }, { createdAtMs: NaN }, { retryNotAfterMs: now + 24 * 3600000 }, { retryNotAfterMs: now }, { requestDigest: "missing" }])("retains uncertain operation for reconciliation %j", patch => {
    const frozen = { ...intent(), ...patch };
    expect(decideRecurringIntentRecovery(frozen, { ...request(), requestDigest: frozen.requestDigest })).toBe("reconcile_only");
  });
  it("does not retry at deadline or revive an expired key", () => expect(decideRecurringIntentRecovery(intent(), { ...request(), nowMs: intent().retryNotAfterMs })).toBe("reconcile_only"));
  it.each(["session_confirmed", "bound"] as const)("observes %s without new dispatch", state => expect(decideRecurringIntentRecovery({ ...intent(), state }, request())).toBe("observe_existing"));
  it("only reports previously verified terminal state, never infers it from unknown/expiry", () => expect(decideRecurringIntentRecovery({ ...intent(), state: "terminal_verified" }, request())).toBe("terminal_verified"));
});
