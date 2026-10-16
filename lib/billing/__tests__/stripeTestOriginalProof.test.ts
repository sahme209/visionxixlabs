import { afterEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { createNewTestSubscriptionService, type Intent, type Store, type Transaction, type Contract } from "../newTestSubscription/service";
import Stripe from "stripe";
import { createStripeTestProvider } from "../newTestSubscription/stripeTestProvider";
afterEach(() => vi.unstubAllEnvs());
const price = { id: "price_pro", livemode: false, active: true, currency: "usd", type: "recurring", billing_scheme: "per_unit", unit_amount: 2900, recurring: { interval: "month", interval_count: 1, usage_type: "licensed" }, product: { id: "prod_pro", active: true, livemode: false, deleted: false } };
function fixture() {
  const client = { accounts: { retrieve: vi.fn(async () => ({ id: "acct_test" })) }, prices: { retrieve: vi.fn(async () => price) }, checkout: { sessions: { create: vi.fn(async () => ({ id: "cs_test", url: "https://checkout.stripe.com/c/pay", livemode: false, lastResponse: { requestId: "req_original", statusCode: 200 } })), retrieve: vi.fn() } }, subscriptions: { retrieve: vi.fn() }, webhooks: { constructEvent: vi.fn<(...args: unknown[]) => unknown>() } };
  const transaction = vi.fn(async (fn: (tx: Transaction) => unknown) => fn({} as Transaction));
  const store: Store = { runtimeId: "runtime", transaction: transaction as Store["transaction"] };
  const options = { secretKey: "sk_test_synthetic", webhookSecret: "whsec_synthetic", expectedAccountId: "acct_test", store, configuredPrices: { "pro:monthly": "price_pro" }, sdkFactory: () => client as unknown as Stripe };
  return { client, options, transaction };
}
describe("inactive original Stripe TEST proof adapter", () => {
  it("refuses live or absent keys before SDK construction", () => {
    const { options } = fixture(); const sdkFactory = vi.fn(options.sdkFactory);
    expect(() => createStripeTestProvider({ ...options, secretKey: "sk_live_forbidden", sdkFactory })).toThrow();
    expect(sdkFactory).not.toHaveBeenCalled();
  });
  it("preserves the existing isolated application provider-IO denial", async () => {
    const f = fixture(); const provider = createStripeTestProvider(f.options);
    vi.stubEnv("AXIOM_ISOLATED_PUBLIC_TEST_RUNTIME", "true");
    const sdkFactory = vi.fn(f.options.sdkFactory);
    expect(() => createStripeTestProvider({ ...f.options, sdkFactory })).toThrow("isolated_provider_io_disabled");
    expect(sdkFactory).not.toHaveBeenCalled();
    await expect(provider.price("pro", "monthly")).rejects.toThrow("isolated_provider_io_disabled");
    expect(f.client.accounts.retrieve).not.toHaveBeenCalled(); expect(f.client.prices.retrieve).not.toHaveBeenCalled();
    expect(f.client.checkout.sessions.create).not.toHaveBeenCalled();
  });
  it("bounds create and webhook inputs before parsing, signature or SDK work", async () => {
    const f = fixture(); const provider = createStripeTestProvider(f.options);
    await expect(provider.create("x".repeat(16_385), "key")).rejects.toThrow("provider_input_bounds");
    await expect(provider.verifyAndRetrieve("x".repeat(262_145), "signature")).rejects.toThrow("provider_input_bounds");
    await expect(provider.verifyAndRetrieve("raw", "x".repeat(4097))).rejects.toThrow("provider_input_bounds");
    expect(f.client.accounts.retrieve).not.toHaveBeenCalled(); expect(f.client.webhooks.constructEvent).not.toHaveBeenCalled();
  });
  it("snapshots account and prices while refusing a changed store runtime", async () => {
    const f = fixture(); const provider = createStripeTestProvider(f.options);
    f.options.expectedAccountId = "acct_mutated"; f.options.configuredPrices["pro:monthly"] = "price_mutated";
    expect(await provider.price("pro", "monthly")).toMatchObject({ id: "price_pro" });
    expect(f.client.prices.retrieve).toHaveBeenCalledWith("price_pro", { expand: ["product"] });
    f.options.store.runtimeId = "runtime_mutated";
    expect(() => provider.mode()).toThrow("test_runtime_changed");
  });
  it("captures original outbound proof and preserves absent optional response headers", async () => {
    const { options, client, transaction } = fixture(); const p = createStripeTestProvider(options);
    const body = JSON.stringify({ mode: "subscription", metadata: { intentId: "intent", organizationId: "org", catalogVersion: "axiom_public_test_v1" }, line_items: [{ price: "price_pro", quantity: 1 }] });
    transaction.mockImplementation(async fn => fn({ contract: async () => null, legacyBinding: async () => false, eligible: async () => true, acceptedSeats: async () => 1, intent: async () => ({ revision: 1, id: "intent", organizationId: "org", terms: { priceId: "price_pro", seatQuantity: 1, planId: "pro", interval: "monthly", catalogVersion: "axiom_public_test_v1" }, runtimeId: "runtime", accountId: "acct_test", livemode: false, state: "attempted", canonicalRequest: body, requestDigest: createHash("sha256").update(body).digest("hex"), providerIdempotencyKey: "durable_key", sessionId: null }) } as unknown as Transaction));
    const result = await p.create(body, "durable_key", { organizationId: "org", userId: "owner" });
    expect(result.originalCreateProof).toMatchObject({ sessionId: "cs_test", outboundRequestKey: "durable_key", requestId: "req_original", accountId: "acct_test", runtimeId: "runtime" });
    expect(result.originalCreateProof?.observedIdempotencyKey).toBeUndefined();
    expect(client.checkout.sessions.create).toHaveBeenCalledWith(JSON.parse(body), { idempotencyKey: "durable_key" });
  });
  it("denies account mismatch before session creation", async () => {
    const { options, client } = fixture(); client.accounts.retrieve.mockResolvedValue({ id: "acct_other" });
    await expect(createStripeTestProvider(options).create("{}", "key")).rejects.toThrow();
    expect(client.checkout.sessions.create).not.toHaveBeenCalled();
  });
  it("does not turn signed metadata into proof for response-lost events", async () => {
    const { options, client, transaction } = fixture(); client.webhooks.constructEvent.mockReturnValue({ id: "evt", livemode: false, type: "checkout.session.completed", data: { object: { id: "cs_lost", metadata: { intentId: "intent" } } } });
    transaction.mockImplementation(async fn => fn({ intent: async () => ({ id: "intent", state: "unknown", sessionId: null }) } as unknown as Transaction));
    await expect(createStripeTestProvider(options).verifyAndRetrieve("raw", "signature")).rejects.toThrow("attempt_provenance_unavailable");
    expect(client.checkout.sessions.retrieve).not.toHaveBeenCalled();
  });
});

describe("original proof composed with existing intent CAS", () => {
  function composed(failConfirmation = false) {
    const f = fixture(); let row: Intent | null = null; let consumed = false; let ownContract: Contract | null = null; let bindOnCapture = false; let legacyBound = false; let authorized = true; let failOnce = failConfirmation;
    const tx: Transaction = {
      eligible: async () => authorized, acceptedSeats: async () => 1, intent: async () => row,
      activeIntent: async () => row, insertIntent: async i => { row = structuredClone(i); },
      saveIntent: async (i, revision) => {
        if (row?.revision !== revision) throw new Error("intent_revision_changed");
        if (failOnce && i.state === "session_confirmed") { failOnce = false; throw new Error("storage unavailable"); }
        row = structuredClone(i);
      }, contract: async () => ownContract, legacyBinding: async () => legacyBound, eventExists: async () => consumed,
      bind: async () => { consumed = true; }, creditEvidence: async () => ({ usedCents: 0, heldCents: 0, paidTopUpsCents: 0 }),
    };
    const store: Store = { runtimeId: "runtime", async transaction<T>(fn: (tx: Transaction) => Promise<T>) {
      const before = structuredClone(row); const prior = consumed;
      try { const result = await fn(tx);
        if (bindOnCapture && row?.state === "session_confirmed") {
          bindOnCapture = false; legacyBound = true;
          row = { ...row, state: "bound", customerId: "cus_test", subscriptionId: "sub_test", revision: row.revision + 1 };
          ownContract = { livemode: false, planId: row.terms.planId, organizationId: row.organizationId, originatingIntentId: row.id,
            catalogVersion: row.terms.catalogVersion, runtimeId: row.runtimeId, accountId: row.accountId, sessionId: row.sessionId!, customerId: "cus_test", subscriptionId: "sub_test", eventToken: "evt_simulated_binding_race", status: "active", seatQuantity: row.terms.seatQuantity };
        }
        return result; } catch (e) { row = before; consumed = prior; throw e; }
    } };
    const provider = createStripeTestProvider({ ...f.options, store }); let id = 0;
    const service = createNewTestSubscriptionService({ store, provider, configuredPrices: f.options.configuredPrices,
      now: () => 1_000_000, id: () => `generated_${++id}`, digest: text => createHash("sha256").update(text).digest("hex") });
    return { ...f, store, provider, service, bindOwnOnCapture: () => { bindOnCapture = true; }, bindLegacy: () => { legacyBound = true; }, revoke: () => { authorized = false; }, row: () => row!, consumed: () => consumed };
  }
  const scope = { userId: "owner", organizationId: "org" };
  const selection = { clientIntentKey: "stable_client_intent_123", planId: "pro" as const, interval: "monthly" as const, seatQuantity: 1, email: "synthetic@example.invalid", successUrl: "http://127.0.0.1/success", cancelUrl: "http://127.0.0.1/cancel" };
  it("returns URL only after original proof and session commit together", async () => {
    const f = composed(); const i = await f.service.prepare(scope, selection);
    expect(await f.service.attempt(scope, i.id)).toEqual({ kind: "checkout_ready", url: "https://checkout.stripe.com/c/pay" });
    expect(f.row()).toMatchObject({ state: "session_confirmed", sessionId: "cs_test", originalCreateProof: { sessionId: "cs_test", requestId: "req_original", outboundRequestDigest: i.requestDigest } });
  });
  it("revocation during provider reads prevents original create", async () => {
    const f = composed(); const i = await f.service.prepare(scope, selection);
    f.client.prices.retrieve.mockImplementation(async () => { f.revoke(); return price; });
    expect(await f.service.attempt(scope, i.id)).toEqual({ kind: "reconciliation_required" });
    expect(f.client.checkout.sessions.create).not.toHaveBeenCalled(); expect(f.consumed()).toBe(false);
  });
  it("runtime drift during price IO denies original session creation", async () => {
    const f = composed(); const i = await f.service.prepare(scope, selection);
    f.client.prices.retrieve.mockImplementation(async () => { f.store.runtimeId = "runtime_changed_during_io"; return price; });
    expect(await f.service.attempt(scope, i.id)).toEqual({ kind: "reconciliation_required" });
    expect(f.client.checkout.sessions.create).not.toHaveBeenCalled(); expect(f.consumed()).toBe(false);
  });
  it("legacy binding appearing during price IO prevents original create", async () => {
    const f = composed(); const i = await f.service.prepare(scope, selection);
    f.client.prices.retrieve.mockImplementation(async () => { f.bindLegacy(); return price; });
    expect(await f.service.attempt(scope, i.id)).toEqual({ kind: "reconciliation_required" });
    expect(f.client.checkout.sessions.create).not.toHaveBeenCalled(); expect(f.consumed()).toBe(false);
  });
  it("exact own binding between receipt capture and URL read is not mistaken for a replacement", async () => {
    const f = composed(); const i = await f.service.prepare(scope, selection); f.bindOwnOnCapture();
    expect(await f.service.attempt(scope, i.id)).toEqual({ kind: "checkout_ready", url: "https://checkout.stripe.com/c/pay" });
    expect(f.row()).toMatchObject({ state: "bound", originalCreateProof: { requestId: "req_original" } });
  });
  it("binding after create denies URL while preserving original receipt", async () => {
    const f = composed(); const i = await f.service.prepare(scope, selection);
    f.client.checkout.sessions.create.mockImplementation(async () => { f.bindLegacy(); return { id: "cs_test", url: "https://checkout.stripe.com/c/pay", livemode: false, lastResponse: { requestId: "req_original", statusCode: 200 } }; });
    expect(await f.service.attempt(scope, i.id)).toEqual({ kind: "reconciliation_required" });
    expect(f.row()).toMatchObject({ state: "session_confirmed", originalCreateProof: { requestId: "req_original" } });
    expect(f.consumed()).toBe(false);
  });
  it("post-create revocation retains original receipt but releases no URL", async () => {
    const f = composed(); const i = await f.service.prepare(scope, selection);
    f.client.checkout.sessions.create.mockImplementation(async () => { f.revoke(); return { id: "cs_test", url: "https://checkout.stripe.com/c/pay", livemode: false, lastResponse: { requestId: "req_original", statusCode: 200 } }; });
    expect(await f.service.attempt(scope, i.id)).toEqual({ kind: "reconciliation_required" });
    expect(f.row()).toMatchObject({ state: "session_confirmed", sessionId: "cs_test", originalCreateProof: { requestId: "req_original" } });
    expect(f.consumed()).toBe(false);
  });
  it("account read failure after provider creation retains unknown without proof or retry", async () => {
    const f = composed(); const i = await f.service.prepare(scope, selection); let reads = 0;
    f.client.accounts.retrieve.mockImplementation(async () => { if (++reads === 3) throw new Error("account unavailable after create"); return { id: "acct_test" }; });
    expect(await f.service.attempt(scope, i.id)).toEqual({ kind: "reconciliation_required" });
    expect(f.row()).toMatchObject({ state: "unknown", sessionId: null }); expect(f.row().originalCreateProof).toBeUndefined();
    await expect(f.service.attempt(scope, i.id)).rejects.toThrow("reconciliation_required");
    expect(f.client.checkout.sessions.create).toHaveBeenCalledTimes(1); expect(f.consumed()).toBe(false);
  });
  it("storage failure preserves unknown and denies another create or any URL", async () => {
    const f = composed(true); const i = await f.service.prepare(scope, selection);
    expect(await f.service.attempt(scope, i.id)).toEqual({ kind: "reconciliation_required" });
    expect(f.row()).toMatchObject({ state: "unknown", sessionId: null });
    expect(f.row().originalCreateProof).toBeUndefined(); expect(f.consumed()).toBe(false);
    await expect(f.service.attempt(scope, i.id)).rejects.toThrow("reconciliation_required");
    expect(f.client.checkout.sessions.create).toHaveBeenCalledTimes(1);
  });
  it("actual local signature plus captured original response binds exactly once", async () => {
    const f = composed(); const i = await f.service.prepare(scope, selection);
    await f.service.attempt(scope, i.id);
    const metadata = { intentId: i.id, organizationId: "org", catalogVersion: "axiom_public_test_v1" };
    const session = { id: "cs_test", livemode: false, mode: "subscription", status: "complete", payment_status: "paid", metadata,
      customer: "cus_test", subscription: "sub_test", line_items: { has_more: false, data: [{ price, quantity: 1 }] } };
    f.client.checkout.sessions.retrieve.mockResolvedValue(session);
    f.client.subscriptions.retrieve.mockResolvedValue({ id: "sub_test", livemode: false, customer: "cus_test", status: "active", metadata, items: { has_more: false, data: [{ price, quantity: 1 }] } });
    const sdk = new Stripe("sk_test_synthetic");
    f.client.webhooks.constructEvent.mockImplementation((raw, signature, secret) => sdk.webhooks.constructEvent(raw as string, signature as string, secret as string));
    const raw = JSON.stringify({ id: "evt_real_local_signature", livemode: false, type: "checkout.session.completed", data: { object: session } });
    const signature = sdk.webhooks.generateTestHeaderString({ payload: raw, secret: "whsec_synthetic" });
    expect(await f.service.reconcile(raw, signature, "org")).toBe("applied");
    expect(await f.service.reconcile(raw, signature, "org")).toBe("replay");
    expect(f.row().state).toBe("bound"); expect(f.consumed()).toBe(true);
  });
  it("wrong retrieved subscription identity denies before binding or event consumption", async () => {
    const f = composed(); const i = await f.service.prepare(scope, selection);
    await f.service.attempt(scope, i.id);
    const metadata = { intentId: i.id, organizationId: "org", catalogVersion: "axiom_public_test_v1" };
    const session = { id: "cs_test", livemode: false, mode: "subscription", status: "complete", payment_status: "paid", metadata,
      customer: "cus_test", subscription: "sub_test", line_items: { has_more: false, data: [{ price, quantity: 1 }] } };
    f.client.checkout.sessions.retrieve.mockResolvedValue(session);
    f.client.subscriptions.retrieve.mockResolvedValue({ id: "sub_wrong", livemode: false, customer: "cus_test", status: "active", metadata, items: { has_more: false, data: [{ price, quantity: 1 }] } });
    const sdk = new Stripe("sk_test_synthetic");
    f.client.webhooks.constructEvent.mockImplementation((raw, signature, secret) => sdk.webhooks.constructEvent(raw as string, signature as string, secret as string));
    const raw = JSON.stringify({ id: "evt_real_local_signature", livemode: false, type: "checkout.session.completed", data: { object: session } });
    const signature = sdk.webhooks.generateTestHeaderString({ payload: raw, secret: "whsec_synthetic" });
    await expect(f.service.reconcile(raw, signature, "org")).rejects.toThrow("signed_terms_mismatch");
    expect(f.row().state).toBe("session_confirmed"); expect(f.consumed()).toBe(false);
  });
  it("malformed persisted response status is not accepted as proof", async () => {
    const f = composed(); const i = await f.service.prepare(scope, selection); await f.service.attempt(scope, i.id);
    f.row().originalCreateProof!.statusCode = undefined as never;
    f.client.webhooks.constructEvent.mockReturnValue({ id: "evt", livemode: false, type: "checkout.session.completed", data: { object: { id: "cs_test", metadata: { intentId: i.id } } } });
    await expect(f.provider.verifyAndRetrieve("raw", "signature")).rejects.toThrow("attempt_provenance_unavailable");
    expect(f.client.checkout.sessions.retrieve).not.toHaveBeenCalled(); expect(f.consumed()).toBe(false);
  });
  it("rejects contradictory optional response headers without consuming or releasing URL", async () => {
    const f = composed(); f.client.checkout.sessions.create.mockResolvedValue({ id: "cs_test", url: "https://checkout.stripe.com/c/pay", livemode: false, lastResponse: { requestId: "req_original", statusCode: 200, idempotencyKey: "wrong" } } as never);
    const i = await f.service.prepare(scope, selection);
    expect(await f.service.attempt(scope, i.id)).toEqual({ kind: "reconciliation_required" });
    expect(f.row().originalCreateProof).toBeUndefined(); expect(f.consumed()).toBe(false);
  });
});
