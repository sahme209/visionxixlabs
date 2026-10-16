import { afterEach, describe, expect, it, vi, type Mock } from "vitest";
import Stripe from "stripe";
import { createHash } from "node:crypto";
import { createStripeTestProvider } from "../newTestSubscription/stripeTestProvider";
import { createNewTestSubscriptionService, type Contract, type Intent, type Store, type Transaction } from "../newTestSubscription/service";
import { paidFixture } from "./fixtures/newTestPaidFixture";
import { collectedEvidence, type CoverageObservation } from "../newTestSubscription/paidCoverage";
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
  const paid = paidFixture({ sessionId: "cs_original", customerId: "cus_original", subscriptionId: "sub_original", priceId: "price_pro" });
  paid.line.pricing.price_details.product = "prod";
  const originalEvidence = collectedEvidence({ ...paid.identity, invoiceId: paid.invoice.id, lineId: paid.line.id, subscriptionItemId: "si_test", paymentId: paid.payment.id, paymentIntentId: paid.paymentIntent.id, chargeId: paid.charge.id, currency: "usd", amountCents: 8700, collectedAt: "2026-10-01T00:00:00.000Z", serviceStart: "2026-10-01T00:00:00.000Z", serviceEnd: "2026-11-01T00:00:00.000Z" });
  let coverage: { observation: CoverageObservation; originalEvidence: typeof originalEvidence; revision: number } | null = { revision: 1, originalEvidence, observation: { eventToken: "evt_original", latestInvoiceId: "in_test", currentPeriodStart: originalEvidence.serviceStart, currentPeriodEnd: originalEvidence.serviceEnd, collection: { kind: "collected", evidence: originalEvidence } } };
  const events = new Set<string>();
  const bind = vi.fn(async (next: Contract, event: string, _observation: unknown, nextCoverage: CoverageObservation) => { contract = structuredClone(next); coverage = { revision: (coverage?.revision ?? 0) + 1, originalEvidence, observation: structuredClone(nextCoverage) }; events.add(event); });
  const tx: Transaction = { invalidateCoverage: async (_contract, eventId) => { if (!coverage) throw new Error("missing"); coverage = { ...coverage, revision: coverage.revision + 1, observation: { ...coverage.observation, invalidatingEventId: eventId, collection: { kind: "unavailable", reason: "unsupported_terms" } } }; }, currentTime: async () => new Date("2026-10-16T00:00:00Z"), coverage: async () => structuredClone(coverage), eligible: async () => true, acceptedSeats: async () => 3, intent: async () => structuredClone(intent), activeIntent: async () => structuredClone(intent),
    insertIntent: async () => { throw new Error("unexpected_insert"); }, saveIntent: async next => { Object.assign(intent, structuredClone(next)); },
    contract: async () => structuredClone(contract), legacyBinding: async () => true, eventExists: async id => events.has(id), bind,
    creditEvidence: async () => ({ usedCents: 0, heldCents: 0, paidTopUpsCents: 0 }) };
  const store: Store = { runtimeId: "runtime", transaction: async fn => fn(tx) };
  const subscription = { latest_invoice: "in_test", id: "sub_original", livemode: false, customer: "cus_original", metadata: { ...metadata }, status: "active", cancel_at_period_end: true,
    items: { has_more: false, data: [{ quantity: 3, price: { ...price }, id: "si_test", current_period_start: paid.line.period.start, current_period_end: paid.line.period.end }] } };
  const sdk = new Stripe("sk_test_synthetic");
  const client = { ...paid.client, accounts: { retrieve: vi.fn(async () => ({ id: "acct_test" })) }, prices: { retrieve: vi.fn(async () => structuredClone(price)) },
    subscriptions: { retrieve: vi.fn(async () => structuredClone(subscription)) }, checkout: { sessions: { retrieve: vi.fn(), create: vi.fn() } },
    webhooks: { constructEvent: sdk.webhooks.constructEvent.bind(sdk.webhooks) } };
  const provider = createStripeTestProvider({ secretKey: "sk_test_synthetic", webhookSecret: "whsec_synthetic", expectedAccountId: "acct_test", store,
    configuredPrices: { "pro:monthly": price.id }, sdkFactory: () => client as unknown as Stripe });
  const serviceFor = (boundary = provider) => createNewTestSubscriptionService({ store, provider: boundary, configuredPrices: { "pro:monthly": price.id }, now: () => 1_000_000, id: () => "unused", digest: text => createHash("sha256").update(text).digest("hex") });
  const service = serviceFor();
  const delivery = (type = "customer.subscription.updated", id = "evt_lifecycle", hint: Record<string, unknown> = {}) => {
    const raw = JSON.stringify({ id, type, livemode: false, data: { object: { id: "sub_original", customer: "cus_original", livemode: false, metadata, status: "canceled", ...hint } } });
    return [raw, sdk.webhooks.generateTestHeaderString({ payload: raw, secret: "whsec_synthetic" }), "org"] as const;
  };
  return { paid, coverage: () => coverage, clearCoverage: () => { coverage = null; }, intent, subscription, client, provider, service, serviceFor, delivery, bind, events, store, setContract: (c: Contract | null) => { contract = c; }, contract: () => contract };
}
afterEach(() => vi.unstubAllEnvs());
describe("inactive established TEST subscription lifecycle", () => {
  it("does not grant active paid allowance without separately collected coverage", async () => {
    const f = fixture(); f.clearCoverage();
    await expect(f.service.previewRemaining({ organizationId: "org", userId: "owner" })).rejects.toThrow("paid_coverage_unavailable");
  });
  it.each(["customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted"])("%s retrieves current state and retains event/period/cancel on unchanged paid terms", async type => {
    const f = fixture(); const original = structuredClone(f.intent);
    expect(await f.service.reconcile(...f.delivery(type))).toBe("applied");
    expect(f.contract()).toMatchObject({ status: "active", seatQuantity: 3 });
    expect(f.bind).toHaveBeenCalledWith(expect.anything(), "evt_lifecycle", { eventType: type, currentPeriodEndsAt: "2026-11-01T00:00:00.000Z", cancelAtPeriodEnd: true }, expect.objectContaining({ eventToken: "evt_lifecycle" }));
    expect(f.intent.terms).toEqual(original.terms); expect(f.intent.originalCreateProof).toEqual(original.originalCreateProof);
    expect(f.client.checkout.sessions.retrieve).not.toHaveBeenCalled(); expect(f.client.checkout.sessions.create).not.toHaveBeenCalled();
    expect(await f.service.reconcile(...f.delivery(type))).toBe("replay");
    expect(f.bind).toHaveBeenCalledTimes(1);
  });
  it.each([2, 4])("SDK deprivileges active quantity 3→%s without consuming or adopting terms", async quantity => {
    const f = fixture(); const before = structuredClone({ contract: f.contract(), intent: f.intent });
    f.subscription.items.data[0].quantity = quantity;
    expect(await f.service.reconcile(...f.delivery())).toBe("unavailable");
    expect(f.events.size).toBe(0); expect(f.bind).not.toHaveBeenCalled();
    expect({ contract: f.contract(), intent: f.intent }).toEqual(before);
    await expect(f.service.previewRemaining({ organizationId: "org", userId: "owner" })).rejects.toThrow("paid_coverage_unavailable");
  });
  it.each([2, 4])("service independently rejects active quantity 3→%s from its trusted provider port", async quantity => {
    const f = fixture(); const before = structuredClone({ contract: f.contract(), intent: f.intent });
    const service = f.serviceFor({ ...f.provider, verifyAndRetrieve: async (raw, signature) => ({ ...await f.provider.verifyAndRetrieve(raw, signature), seatQuantity: quantity }) });
    await expect(service.reconcile(...f.delivery())).rejects.toThrow("seat_change_requires_review");
    expect(f.events.size).toBe(0); expect(f.bind).not.toHaveBeenCalled(); expect({ contract: f.contract(), intent: f.intent }).toEqual(before);
  });
  it("does not adopt a drifted bound seat quantity without original paid terms", async () => {
    const f = fixture(); f.subscription.items.data[0].quantity = 2; f.setContract({ ...f.contract()!, seatQuantity: 2 });
    await expect(f.service.reconcile(...f.delivery())).rejects.toThrow("seat_change_requires_review"); expect(f.events.size).toBe(0);
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
    if (["price", "price_shape", "interval", "plan", "pagination", "pagination_missing", "quantity"].includes(invalid)) {
      expect(await f.service.reconcile(...f.delivery())).toBe("unavailable");
      await expect(f.service.previewRemaining({ organizationId: "org", userId: "owner" })).rejects.toThrow("paid_coverage_unavailable");
    } else await expect(f.service.reconcile(...f.delivery())).rejects.toThrow();
    expect(f.events.size).toBe(0);
  });
  it("uses invoice notifications only to retrieve the bound current state", async () => {
    const f = fixture(); f.paid.invoice.status = "open";
    expect(await f.service.reconcile(...f.delivery("invoice.payment_failed", "evt_failed", { id: "in_test" }))).toBe("applied");
    await expect(f.service.previewRemaining({ organizationId: "org", userId: "owner" })).rejects.toThrow("paid_coverage_unavailable");
  });
  it("an older paid invoice notification observes current failed renewal without reviving old funding", async () => {
    const f = fixture(); f.subscription.latest_invoice = "in_next";
    f.paid.invoice.id = "in_next"; f.paid.invoice.status = "open";
    expect(await f.service.reconcile(...f.delivery("invoice.paid", "evt_old_paid", { id: "in_test" }))).toBe("applied");
    expect(f.coverage()?.observation.collection).toEqual({ kind: "unavailable", reason: "not_collected" });
    await expect(f.service.previewRemaining({ organizationId: "org", userId: "owner" })).rejects.toThrow("paid_coverage_unavailable");
  });
  it("active advancement to an open future-period invoice cannot fund the next calendar pool", async () => {
    const f = fixture(); f.subscription.latest_invoice = "in_next"; f.paid.invoice.id = "in_next"; f.paid.invoice.status = "open";
    f.subscription.items.data[0].current_period_start = Date.UTC(2026, 10, 1) / 1000;
    f.subscription.items.data[0].current_period_end = Date.UTC(2026, 11, 1) / 1000;
    expect(await f.service.reconcile(...f.delivery("invoice.paid", "evt_old_paid_advanced", { id: "in_test" }))).toBe("applied");
    expect(f.coverage()?.observation).toMatchObject({ currentPeriodStart: "2026-11-01T00:00:00.000Z", currentPeriodEnd: "2026-12-01T00:00:00.000Z", collection: { kind: "unavailable" } });
    await expect(f.service.previewRemaining({ organizationId: "org", userId: "owner" })).rejects.toThrow("paid_coverage_unavailable");
  });
  it.each(["charge.refunded", "charge.dispute.created", "credit_note.created"])("%s invalidates current projection while preserving original evidence", async type => {
    const f = fixture(); const original = structuredClone(f.coverage()?.originalEvidence);
    if (type === "credit_note.created") f.paid.invoice.post_payment_credit_notes_amount = 1;
    else if (type === "charge.refunded") f.paid.charge.amount_refunded = 1;
    else f.paid.charge.disputed = true;
    const hint = { id: type === "charge.refunded" ? "ch_test" : "event_object", invoice: "in_test", charge: "ch_test" };
    expect(await f.service.reconcile(...f.delivery(type, `evt_${type}`, hint))).toBe("applied");
    expect(f.coverage()?.observation.collection.kind).toBe("unavailable"); expect(f.coverage()?.originalEvidence).toEqual(original);
    await expect(f.service.previewRemaining({ organizationId: "org", userId: "owner" })).rejects.toThrow("paid_coverage_unavailable");
  });
  it("enforces bounded timeout and rejects a changed final subscription snapshot", async () => {
    const f = fixture();
    f.client.subscriptions.retrieve.mockImplementationOnce(async () => structuredClone(f.subscription)).mockImplementationOnce(async () => ({ ...structuredClone(f.subscription), status: "past_due" }));
    await expect(f.service.reconcile(...f.delivery())).rejects.toThrow("collection_snapshot_changed"); expect(f.events.size).toBe(0);
    for (const [params, options] of f.client.invoices.retrieve.mock.calls as unknown[][]) { expect(params).toBe("in_test"); expect(options).toEqual({}); }
    const requests = [f.client.accounts.retrieve, f.client.subscriptions.retrieve, f.client.prices.retrieve, f.client.invoices.retrieve, f.client.invoicePayments.list, f.client.paymentIntents.retrieve, f.client.charges.retrieve].flatMap(mock => mock.mock.calls as unknown[][]);
    expect(requests.length).toBeLessThanOrEqual(14);
    for (const call of requests) expect(call.at(-1)).toMatchObject({ timeout: expect.any(Number), maxNetworkRetries: 0 });
  });
  it("rejects elapsed total retrieval deadline without consuming", async () => {
    const f = fixture(); const time = vi.spyOn(Date, "now"); let clock = 1000; time.mockImplementation(() => clock);
    f.client.invoices.retrieve.mockImplementation(async () => { clock += 30000; return structuredClone(f.paid.invoice); });
    try { await expect(f.service.reconcile(...f.delivery())).rejects.toThrow("provider_read_budget_exceeded"); expect(f.events.size).toBe(0); expect(f.client.invoicePayments.list).not.toHaveBeenCalled(); } finally { time.mockRestore(); }
  });
  it.each(["invoice", "invoicePayments", "paymentIntent", "charge", "finalInvoice", "finalCharge", "finalSubscription", "finalAccount"])("retains absolute provider denial after %s await", async stage => {
    const f = fixture(); const enable = () => vi.stubEnv("AXIOM_ISOLATED_PUBLIC_TEST_RUNTIME", "true");
    const twice = <T>(mock: Mock<() => Promise<T>>, value: T) => { mock.mockImplementationOnce(async () => structuredClone(value)).mockImplementationOnce(async () => { enable(); return structuredClone(value); }); };
    if (stage === "invoice") f.client.invoices.retrieve.mockImplementation(async () => { enable(); return structuredClone(f.paid.invoice); });
    if (stage === "invoicePayments") f.client.invoicePayments.list.mockImplementation(async () => { enable(); return structuredClone(f.paid.payments); });
    if (stage === "paymentIntent") f.client.paymentIntents.retrieve.mockImplementation(async () => { enable(); return structuredClone(f.paid.paymentIntent); });
    if (stage === "charge") f.client.charges.retrieve.mockImplementation(async () => { enable(); return structuredClone(f.paid.charge); });
    if (stage === "finalInvoice") twice(f.client.invoices.retrieve, f.paid.invoice);
    if (stage === "finalCharge") twice(f.client.charges.retrieve, f.paid.charge);
    if (stage === "finalSubscription") twice(f.client.subscriptions.retrieve, f.subscription);
    if (stage === "finalAccount") twice(f.client.accounts.retrieve, { id: "acct_test" });
    await expect(f.service.reconcile(...f.delivery())).rejects.toThrow("isolated_provider_io_disabled"); expect(f.events.size).toBe(0);
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
  it("a stale positive cannot overwrite a newer negative with the same plan token", async () => {
    const f = fixture(); let captured!: () => void; let release!: () => void;
    const ready = new Promise<void>(resolve => { captured = resolve; }); const barrier = new Promise<void>(resolve => { release = resolve; });
    const stale = f.serviceFor({ ...f.provider, verifyAndRetrieve: async (...args) => { const snapshot = await f.provider.verifyAndRetrieve(...args); captured(); await barrier; return snapshot; } });
    const pending = stale.reconcile(...f.delivery(undefined, "evt_stale_positive")); await ready;
    f.subscription.items.data[0].quantity = 4;
    expect(await f.service.reconcile(...f.delivery(undefined, "evt_current_drift"))).toBe("unavailable");
    expect(f.contract()?.eventToken).toBe("evt_original"); expect(f.coverage()?.revision).toBe(2);
    release(); await expect(pending).rejects.toThrow("coverage_snapshot_changed");
    expect(f.events.size).toBe(0); expect(f.coverage()?.observation.collection).toEqual({ kind: "unavailable", reason: "unsupported_terms" });
  });
  it("a stale negative cannot overwrite a newer fully collected positive", async () => {
    const f = fixture(); f.subscription.items.data[0].quantity = 4; let captured!: () => void; let release!: () => void;
    const ready = new Promise<void>(resolve => { captured = resolve; }); const barrier = new Promise<void>(resolve => { release = resolve; });
    const stale = f.serviceFor({ ...f.provider, verifyAndRetrieve: async (...args) => { const snapshot = await f.provider.verifyAndRetrieve(...args); captured(); await barrier; return snapshot; } });
    const pending = stale.reconcile(...f.delivery(undefined, "evt_stale_negative")); await ready;
    f.subscription.items.data[0].quantity = 3;
    expect(await f.service.reconcile(...f.delivery(undefined, "evt_new_collected"))).toBe("applied");
    release(); await expect(pending).rejects.toThrow("subscription_snapshot_changed");
    expect(f.coverage()?.revision).toBe(2); expect(f.coverage()?.observation.collection.kind).toBe("collected");
  });
  it("terms drift followed by refund and older paid event cannot retain paid access", async () => {
    const f = fixture(); const original = structuredClone(f.coverage()?.originalEvidence);
    f.subscription.items.data[0].quantity = 2;
    expect(await f.service.reconcile(...f.delivery())).toBe("unavailable");
    f.paid.charge.amount_refunded = 8700;
    expect(await f.service.reconcile(...f.delivery("charge.refunded", "evt_refund_after_drift", { id: "ch_test" }))).toBe("unavailable");
    expect(await f.service.reconcile(...f.delivery("invoice.paid", "evt_old_paid_after_drift", { id: "in_test" }))).toBe("unavailable");
    expect(f.coverage()?.revision).toBe(4); expect(f.coverage()?.originalEvidence).toEqual(original); expect(f.events.size).toBe(0);
    await expect(f.service.previewRemaining({ organizationId: "org", userId: "owner" })).rejects.toThrow("paid_coverage_unavailable");
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
