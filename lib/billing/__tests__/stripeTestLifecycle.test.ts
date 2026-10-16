import { afterEach, describe, expect, it, vi } from "vitest";
import Stripe from "stripe";
import { createHash } from "node:crypto";
import { createStripeTestProvider } from "../newTestSubscription/stripeTestProvider";
import { createNewTestSubscriptionService, type Contract, type Intent, type Store, type Transaction } from "../newTestSubscription/service";
import { matchNewTestTerms } from "../newTestSubscriptionContract";

const price = { id: "price_pro", livemode: false, active: true, currency: "usd", type: "recurring", billing_scheme: "per_unit", unit_amount: 2900,
  recurring: { interval: "month", interval_count: 1, usage_type: "licensed" }, product: { id: "prod", active: true, livemode: false } };
const metadata = { intentId: "intent", organizationId: "org", catalogVersion: "axiom_public_test_v1", planId: "pro", billingInterval: "monthly" };
function fixture() {
  const matched = matchNewTestTerms({ planId: "pro", interval: "monthly", seatQuantity: 3, configuredPriceId: price.id, price });
  if (matched.kind !== "supported_terms") throw new Error("fixture_terms");
  const intent: Intent = { id: "intent", organizationId: "org", runtimeId: "runtime", accountId: "acct_test", livemode: false, state: "bound", terms: matched.terms,
    clientIntentKey: "client_intent_123456", requestDigest: "a".repeat(64), providerIdempotencyKey: "original_key", canonicalRequest: "original bytes", createdAtMs: 1, retryNotAfterMs: 2,
    sessionId: "cs_original", customerId: "cus_original", subscriptionId: "sub_original", email: "synthetic@example.invalid", revision: 3,
    originalCreateProof: { runtimeId: "runtime", accountId: "acct_test", sessionId: "cs_original", outboundRequestDigest: "a".repeat(64), outboundRequestKey: "original_key", requestId: "req_original", statusCode: 200 } };
  let contract: Contract | null = { livemode: false, organizationId: "org", originatingIntentId: "intent", runtimeId: "runtime", accountId: "acct_test", catalogVersion: "axiom_public_test_v1", planId: "pro",
    sessionId: "cs_original", customerId: "cus_original", subscriptionId: "sub_original", eventToken: "evt_original", status: "active", seatQuantity: 3 };
  const events = new Set<string>();
  const bind = vi.fn(async (next: Contract, event: string) => { contract = structuredClone(next); events.add(event); });
  const tx: Transaction = { eligible: async () => true, acceptedSeats: async () => 3, intent: async () => structuredClone(intent), activeIntent: async () => structuredClone(intent),
    insertIntent: async () => { throw new Error("unexpected_insert"); }, saveIntent: async next => { Object.assign(intent, structuredClone(next)); },
    contract: async () => structuredClone(contract), legacyBinding: async () => true, eventExists: async id => events.has(id), bind,
    creditEvidence: async () => ({ usedCents: 0, heldCents: 0, paidTopUpsCents: 0 }) };
  const store: Store = { runtimeId: "runtime", transaction: async fn => fn(tx) };
  const subscription = { id: "sub_original", livemode: false, customer: "cus_original", metadata: { ...metadata }, status: "active", cancel_at_period_end: true,
    items: { has_more: false, data: [{ quantity: 2, price: { ...price }, current_period_end: 1794787200 }] } };
  const sdk = new Stripe("sk_test_synthetic");
  const client = { accounts: { retrieve: vi.fn(async () => ({ id: "acct_test" })) }, prices: { retrieve: vi.fn(async () => structuredClone(price)) },
    subscriptions: { retrieve: vi.fn(async () => structuredClone(subscription)) }, checkout: { sessions: { retrieve: vi.fn(), create: vi.fn() } },
    webhooks: { constructEvent: sdk.webhooks.constructEvent.bind(sdk.webhooks) } };
  const provider = createStripeTestProvider({ secretKey: "sk_test_synthetic", webhookSecret: "whsec_synthetic", expectedAccountId: "acct_test", store,
    configuredPrices: { "pro:monthly": price.id }, sdkFactory: () => client as unknown as Stripe });
  const service = createNewTestSubscriptionService({ store, provider, configuredPrices: { "pro:monthly": price.id }, now: () => 1_000_000, id: () => "unused", digest: text => createHash("sha256").update(text).digest("hex") });
  const delivery = (type = "customer.subscription.updated", id = "evt_lifecycle", hint: Record<string, unknown> = {}) => {
    const raw = JSON.stringify({ id, type, livemode: false, data: { object: { id: "sub_original", customer: "cus_original", livemode: false, metadata, status: "canceled", ...hint } } });
    return [raw, sdk.webhooks.generateTestHeaderString({ payload: raw, secret: "whsec_synthetic" }), "org"] as const;
  };
  return { intent, subscription, client, provider, service, delivery, bind, events, store, setContract: (c: Contract | null) => { contract = c; }, contract: () => contract };
}
afterEach(() => vi.unstubAllEnvs());
describe("inactive established TEST subscription lifecycle", () => {
  it.each(["customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted"])("%s retrieves current state, retains event/period/cancel and permits current licensed seats", async type => {
    const f = fixture(); const original = structuredClone(f.intent);
    expect(await f.service.reconcile(...f.delivery(type))).toBe("applied");
    expect(f.contract()).toMatchObject({ status: "active", seatQuantity: 2 });
    expect(f.bind).toHaveBeenCalledWith(expect.anything(), "evt_lifecycle", { eventType: type, currentPeriodEndsAt: "2026-11-16T00:00:00.000Z", cancelAtPeriodEnd: true });
    expect(f.intent.terms).toEqual(original.terms); expect(f.intent.originalCreateProof).toEqual(original.originalCreateProof);
    expect(f.client.checkout.sessions.retrieve).not.toHaveBeenCalled(); expect(f.client.checkout.sessions.create).not.toHaveBeenCalled();
    expect(await f.service.reconcile(...f.delivery(type))).toBe("replay");
    expect(f.bind).toHaveBeenCalledTimes(1);
  });
  it.each([["active", "active"], ["trialing", "trialing"], ["past_due", "past_due"], ["unpaid", "past_due"], ["canceled", "canceled"], ["incomplete_expired", "canceled"], ["incomplete", "no_plan"], ["paused", "no_plan"]])("maps current %s to %s", async (status, expected) => {
    const f = fixture(); f.subscription.status = status;
    expect(await f.service.reconcile(...f.delivery())).toBe("applied"); expect(f.contract()?.status).toBe(expected);
  });
  it.each(["proofless", "unbound", "foreign_hint", "foreign_contract", "foreign_session"])("rejects %s without subscription retrieval or consumption", async invalid => {
    const f = fixture(); let hint = {};
    if (invalid === "proofless") delete f.intent.originalCreateProof;
    if (invalid === "unbound") f.setContract(null);
    if (invalid === "foreign_hint") hint = { id: "sub_other" };
    if (invalid === "foreign_contract") f.setContract({ ...f.contract()!, subscriptionId: "sub_other" });
    if (invalid === "foreign_session") f.intent.originalCreateProof!.sessionId = "cs_other";
    await expect(f.service.reconcile(...f.delivery(undefined, undefined, hint))).rejects.toThrow();
    expect(f.client.subscriptions.retrieve).not.toHaveBeenCalled(); expect(f.events.size).toBe(0);
  });
  it.each(["status", "period", "cancel", "price", "price_shape", "interval", "plan", "pagination", "pagination_missing", "quantity", "customer", "metadata"])("rejects invalid current %s without event consumption", async invalid => {
    const f = fixture();
    if (invalid === "status") f.subscription.status = "new_unreviewed_status";
    if (invalid === "period") f.subscription.items.data[0].current_period_end = NaN;
    if (invalid === "cancel") f.subscription.cancel_at_period_end = undefined as never;
    if (invalid === "price") f.subscription.items.data[0].price.id = "price_other";
    if (invalid === "price_shape") f.subscription.items.data[0].price.currency = "eur";
    if (invalid === "interval") f.subscription.metadata.billingInterval = "annual";
    if (invalid === "plan") f.subscription.metadata.planId = "enterprise";
    if (invalid === "pagination") f.subscription.items.has_more = true;
    if (invalid === "pagination_missing") f.subscription.items.has_more = undefined as never;
    if (invalid === "quantity") f.subscription.items.data[0].quantity = 0;
    if (invalid === "customer") f.subscription.customer = "cus_other";
    if (invalid === "metadata") f.subscription.metadata.organizationId = "org_other";
    await expect(f.service.reconcile(...f.delivery())).rejects.toThrow(); expect(f.events.size).toBe(0);
  });
  it("does not interpret invoice payment events as subscription authority", async () => {
    const f = fixture(); await expect(f.service.reconcile(...f.delivery("invoice.payment_failed"))).rejects.toThrow("signed_binding_mismatch");
    expect(f.client.subscriptions.retrieve).not.toHaveBeenCalled(); expect(f.events.size).toBe(0);
  });
  it("rejects invalid local signature and current account mismatch", async () => {
    const f = fixture(); const [raw] = f.delivery();
    await expect(f.service.reconcile(raw, "invalid", "org")).rejects.toThrow(); expect(f.client.accounts.retrieve).not.toHaveBeenCalled();
    f.client.accounts.retrieve.mockResolvedValue({ id: "acct_other" });
    await expect(f.service.reconcile(...f.delivery())).rejects.toThrow("test_account_mismatch"); expect(f.client.subscriptions.retrieve).not.toHaveBeenCalled(); expect(f.events.size).toBe(0);
  });
  it("rechecks the opaque contract token after SDK IO without ordering event IDs", async () => {
    const f = fixture(); f.client.subscriptions.retrieve.mockImplementation(async () => { f.setContract({ ...f.contract()!, eventToken: "evt_concurrent" }); return structuredClone(f.subscription); });
    await expect(f.service.reconcile(...f.delivery())).rejects.toThrow("subscription_snapshot_changed"); expect(f.events.size).toBe(0);
  });
  it.each(["before", "account", "subscription", "price"])("preserves absolute provider denial when isolated flag changes %s", async boundary => {
    const f = fixture(); const enable = () => vi.stubEnv("AXIOM_ISOLATED_PUBLIC_TEST_RUNTIME", "true");
    if (boundary === "before") enable();
    if (boundary === "account") f.client.accounts.retrieve.mockImplementation(async () => { enable(); return { id: "acct_test" }; });
    if (boundary === "subscription") f.client.subscriptions.retrieve.mockImplementation(async () => { enable(); return structuredClone(f.subscription); });
    if (boundary === "price") f.client.prices.retrieve.mockImplementation(async () => { enable(); return structuredClone(price); });
    await expect(f.service.reconcile(...f.delivery())).rejects.toThrow("isolated_provider_io_disabled"); expect(f.events.size).toBe(0);
    if (boundary === "before") expect(f.client.accounts.retrieve).not.toHaveBeenCalled();
    if (boundary === "account") expect(f.client.subscriptions.retrieve).not.toHaveBeenCalled();
    if (boundary === "subscription") expect(f.client.prices.retrieve).not.toHaveBeenCalled();
  });
});
