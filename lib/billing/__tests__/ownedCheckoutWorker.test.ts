import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { createNewTestSubscriptionService, type Transaction, type Intent, type ProviderBoundary } from "../newTestSubscription/service";
import { createEnrollmentV2 } from "../newTestSubscription/fixtureAllocation";
import { ANNIVERSARY_POLICY_V2, createAllowanceBasisV2 } from "../newTestSubscription/anniversaryWindow";
const manifest = { version: "axiom_owned_checkout_v1", session: "a".repeat(32), runtimeId: "runtime", accountId: "acct-test", organizationId: "org", origin: "http://127.0.0.1:4100", directory: "/tmp/axiom-owned-checkout-" + "b".repeat(32), capability: "c".repeat(64) } as const;
const command = { kind: "checkout", userId: "owner", organizationId: "org", clientIntentKey: "purchase_key_123456789", planId: "pro", interval: "monthly" } as const;
function facts() {
  let saved: Intent | null = null, eligible = true, creates = 0, lose = false, seq = 0;
  const scope = { runtimeId: manifest.runtimeId, accountId: manifest.accountId, organizationId: manifest.organizationId }, enrollment = createEnrollmentV2(scope), freeBasis = createAllowanceBasisV2({ ...scope, version: 2, policy: ANNIVERSARY_POLICY_V2, enrollmentDigest: enrollment.digest, kind: "free" });
  const tx: Transaction = { allowance: async () => ({ enrollment, freeBasis, paidBasis: null, revision: 1 }), currentTime: async () => new Date(), eligible: async () => eligible, acceptedSeats: async () => 3, intent: async () => saved, activeIntent: async () => saved, insertIntent: async i => { saved = structuredClone(i); }, saveIntent: async (i, revision) => { if (saved?.revision !== revision) throw new Error("bad_revision"); saved = structuredClone(i); }, contract: async () => null, coverage: async () => null, invalidateCoverage: async () => { throw new Error("unexpected"); }, legacyBinding: async () => false, eventExists: async () => false, bind: async () => { throw new Error("unexpected"); }, creditEvidence: async () => ({ usedCents: 0, heldCents: 0, paidTopUpsCents: 0 }) };
  let priceGate: Promise<void> | null = null;
  const provider: ProviderBoundary = { mode: () => ({ livemode: false, accountId: manifest.accountId }), price: async () => { await priceGate; return { id: "price_test", livemode: false, active: true, currency: "usd", type: "recurring", billing_scheme: "per_unit", unit_amount: 2900, recurring: { interval: "month", interval_count: 1, usage_type: "licensed" } }; }, create: async (body, key) => { creates++; if (lose) throw new Error("synthetic_response_loss"); return { id: "cs_test", url: "https://checkout.stripe.com/c/pay/cs_test", accountId: manifest.accountId, livemode: false, originalCreateProof: { runtimeId: manifest.runtimeId, accountId: manifest.accountId, sessionId: "cs_test", outboundRequestKey: key, outboundRequestDigest: createHash("sha256").update(body).digest("hex"), requestId: "req_synthetic", statusCode: 200 } }; }, verifyAndRetrieve: async () => { throw new Error("not_called"); } };
  const store = { runtimeId: manifest.runtimeId, transaction: async <T>(op: (t: Transaction) => Promise<T>) => op(tx) };
  const service = createNewTestSubscriptionService({ store, provider, configuredPrices: { "pro:monthly": "price_test" }, now: () => Date.now(), id: () => `synthetic_${++seq}`, digest: text => createHash("sha256").update(text).digest("hex") });
  return { store, service, provider, snapshot: () => saved && structuredClone(saved), creates: () => creates, demote: () => { eligible = false; }, lose: () => { lose = true; }, gate: (p: Promise<void>) => { priceGate = p; } };
}
describe("owned worker delegates to actual financial service (synthetic provider)", () => {
  it("derives checkout facts and stores original proof once, without retrying a confirmed attempt", async () => {
    const { createOwnedCheckoutOperations } = await import("../ownedCheckoutBridge/operations"); const f = facts();
    const handle = createOwnedCheckoutOperations({ manifest, store: f.store, service: f.service, actor: async () => ({ email: "owned@example.invalid", seatQuantity: 3 }) });
    expect(await handle(command)).toMatchObject({ kind: "checkout_ready" });
    const before = f.snapshot()!; expect(before.state).toBe("session_confirmed"); expect(before.originalCreateProof?.requestId).toBe("req_synthetic");
    const raw = JSON.parse(before.canonicalRequest!); expect(raw.success_url).toBe(manifest.origin + "/control/usage-billing?billing=success"); expect(raw.line_items).toEqual([{ price: "price_test", quantity: 3 }]);
    expect(await handle(command)).toEqual({ kind: "reconciliation_required" }); expect(f.creates()).toBe(1); expect(f.snapshot()).toEqual(before);
  });
  it("denies current demoted actors before prepare and retains an unknown create after response loss", async () => {
    const { createOwnedCheckoutOperations } = await import("../ownedCheckoutBridge/operations"); const f = facts(); f.demote();
    expect(await createOwnedCheckoutOperations({ manifest, store: f.store, service: f.service, actor: async () => ({ email: "owned@example.invalid", seatQuantity: 3 }) })(command)).toEqual({ kind: "forbidden" }); expect(f.snapshot()).toBeNull();
    const lost = facts(); lost.lose(); const handle = createOwnedCheckoutOperations({ manifest, store: lost.store, service: lost.service, actor: async () => ({ email: "owned@example.invalid", seatQuantity: 3 }) });
    expect(await handle(command)).toEqual({ kind: "reconciliation_required" }); const before = lost.snapshot(); expect(before?.state).toBe("unknown"); expect(before?.originalCreateProof).toBeUndefined();
    expect(await handle(command)).toEqual({ kind: "reconciliation_required" }); expect(lost.creates()).toBe(1); expect(lost.snapshot()).toEqual(before);
  });
  it("does not queue another purchase while the original provider read is owned", async () => {
    const { createOwnedCheckoutOperations } = await import("../ownedCheckoutBridge/operations"); const f = facts(); let release!: () => void; f.gate(new Promise<void>(r => { release = r; }));
    const handle = createOwnedCheckoutOperations({ manifest, store: f.store, service: f.service, actor: async () => ({ email: "owned@example.invalid", seatQuantity: 3 }) }); const active = handle(command);
    expect(await handle(command)).toEqual({ kind: "busy" }); release(); expect(await active).toMatchObject({ kind: "checkout_ready" }); expect(f.creates()).toBe(1);
  });
  it("classifies an actual installed SDK signature exception without forwarding its payload", async () => {
    const { createOwnedCheckoutOperations } = await import("../ownedCheckoutBridge/operations"), Stripe = (await import("stripe")).default, f = facts(), sdk = new Stripe("sk_test_synthetic_local_signature_only");
    f.provider.verifyAndRetrieve = async raw => { sdk.webhooks.constructEvent(raw, "invalid-signature", "whsec_synthetic_local_only"); throw new Error("signature_must_refuse"); };
    const handle = createOwnedCheckoutOperations({ manifest, store: f.store, service: f.service, actor: async () => null });
    expect(await handle({ kind: "reconcile", body: Buffer.from("{}").toString("base64"), signature: "invalid-signature" })).toEqual({ kind: "invalid_signature" }); expect(f.snapshot()).toBeNull(); expect(f.creates()).toBe(0);
  });

});
