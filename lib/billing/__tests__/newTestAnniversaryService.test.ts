import { describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { createEnrollmentV2 } from "../newTestSubscription/fixtureAllocation";
import { ANNIVERSARY_POLICY_V2, createAllowanceBasisV2 } from "../newTestSubscription/anniversaryWindow";
import { createNewTestSubscriptionService, type Intent, type Transaction, type ProviderBoundary } from "../newTestSubscription/service";
const scope = { runtimeId: "runtime", accountId: "acct_test", organizationId: "org" };
function fixture(enrolled: boolean) {
  const enrollment = createEnrollmentV2(scope), freeBasis = createAllowanceBasisV2({ ...scope, version: 2, policy: ANNIVERSARY_POLICY_V2, enrollmentDigest: enrollment.digest, kind: "free" });
  let state = enrolled ? { enrollment, freeBasis, paidBasis: null, revision: 1 } : null;
  let saved: Intent | null = null;
  const tx: Transaction = { allowance: async () => state, currentTime: async () => new Date("2026-10-18Z"), eligible: async () => true, acceptedSeats: async () => 3,
    intent: async () => saved, activeIntent: async () => saved, insertIntent: async i => { saved = i; }, saveIntent: async i => { saved = i; }, contract: async () => null,
    coverage: async () => null, invalidateCoverage: async () => { throw new Error("unexpected"); }, legacyBinding: async () => false, eventExists: async () => false, bind: async () => { throw new Error("unexpected"); }, creditEvidence: async () => ({ usedCents: 0, heldCents: 0, paidTopUpsCents: 0 }) };
  const price = { id: "price_test", livemode: false, active: true, currency: "usd", type: "recurring", billing_scheme: "per_unit", unit_amount: 2900, recurring: { interval: "month", interval_count: 1, usage_type: "licensed" } };
  const provider: ProviderBoundary = { mode: () => ({ livemode: false, accountId: scope.accountId }), price: vi.fn(async () => price), create: async () => { throw new Error("no_provider_io"); }, verifyAndRetrieve: async () => { throw new Error("no_provider_io"); } };
  let id = 0;
  const service = createNewTestSubscriptionService({ store: { runtimeId: scope.runtimeId, transaction: async f => f(tx) }, provider, configuredPrices: { "pro:monthly": price.id }, now: () => 1, id: () => `fixture_${++id}`, digest: text => createHash("sha256").update(text).digest("hex") });
  const input = { clientIntentKey: "fixture_intent_12345", planId: "pro" as const, interval: "monthly" as const, seatQuantity: 3, email: "fixture@example.invalid", successUrl: "http://127.0.0.1/success", cancelUrl: "http://127.0.0.1/cancel" };
  return { service, provider, input, saved: () => saved, drift: () => { if (state) state = { ...state, revision: state.revision + 1 }; } };
}
describe("V2 intent policy is authoritative store provenance", () => {
  it.each([false, true])("freezes policy in both original metadata scopes only when enrolled=%s", async enrolled => {
    const f = fixture(enrolled), intent = await f.service.prepare({ organizationId: scope.organizationId, userId: "owner" }, f.input), request = JSON.parse(intent.canonicalRequest!);
    if (enrolled) {
      expect(intent.allowanceV2).toEqual({ policy: ANNIVERSARY_POLICY_V2, enrollmentDigest: createEnrollmentV2(scope).digest });
      for (const metadata of [request.metadata, request.subscription_data.metadata]) expect(metadata).toMatchObject({ allowancePolicy: ANNIVERSARY_POLICY_V2, allowanceEnrollmentDigest: intent.allowanceV2!.enrollmentDigest });
    } else { expect(intent.allowanceV2).toBeUndefined(); expect(request.metadata.allowancePolicy).toBeUndefined(); }
    expect((await f.service.prepare({ organizationId: scope.organizationId, userId: "owner" }, f.input)).canonicalRequest).toBe(intent.canonicalRequest);
  });
  it("refuses changed enrollment after price IO without creating an intent", async () => {
    const f = fixture(true), read = f.provider.price;
    f.provider.price = async (...args) => { const p = await read(...args); f.drift(); return p; };
    await expect(f.service.prepare({ organizationId: scope.organizationId, userId: "owner" }, f.input)).rejects.toThrow("allowance_snapshot_changed");
    expect(f.saved()).toBeNull();
  });
});
