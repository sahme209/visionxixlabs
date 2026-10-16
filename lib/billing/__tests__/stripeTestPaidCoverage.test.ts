import { describe, expect, it, vi } from "vitest";
import type Stripe from "stripe";
import { retrieveCollectedCoverage, type BoundedRead } from "../newTestSubscription/stripePaidCoverage";
import { paidFixture } from "./fixtures/newTestPaidFixture";

describe("inactive Stripe collection chain (all remote responses are fixtures)", () => {
  it("retrieves full cash chain and rereads invoice and charge", async () => {
    const f = paidFixture(); const operations = vi.fn(); const read: BoundedRead = async operation => { operations(); return operation(10000); };
    const result = await retrieveCollectedCoverage(f.client as unknown as Stripe, f.identity, f.subscription as unknown as Stripe.Subscription, read);
    expect(result.collection.kind).toBe("collected"); expect(operations).toHaveBeenCalledTimes(6);
    expect(f.client.invoicePayments.list).toHaveBeenCalledWith({ invoice: "in_test", status: "paid", limit: 2 }, { timeout: 10000, maxNetworkRetries: 0 });
  });
  it("records annual full-price cash for exactly twelve calendar buckets", async () => {
    const f = paidFixture({ interval: "annual", unitAmountCents: 27840 });
    expect((await f.run()).collection).toMatchObject({ kind: "collected", evidence: { amountCents: 83520, serviceStart: "2026-10-01T00:00:00.000Z", serviceEnd: "2027-10-01T00:00:00.000Z" } });
  });
  it.each(["missing", "customer_balance", "ambiguous", "unknown", "missing_details"])("rejects %s Charge funding source", async invalid => {
    const f = paidFixture();
    if (invalid === "missing") f.charge.payment_method_details = null;
    if (invalid === "customer_balance") f.charge.payment_method_details = { type: "customer_balance", customer_balance: {} };
    if (invalid === "ambiguous") f.charge.payment_method_details = { type: "card", card: {}, customer_balance: {} };
    if (invalid === "unknown") f.charge.payment_method_details = { type: "unreviewed_future_source" };
    if (invalid === "missing_details") f.charge.payment_method_details = { type: "card" };
    expect((await f.run()).collection).toEqual({ kind: "unavailable", reason: "unsupported_collection" });
  });
  it("accepts an identified non-card source with the same full captured collection chain", async () => {
    const f = paidFixture(); f.charge.payment_method_details = { type: "sepa_debit", sepa_debit: {} };
    expect((await f.run()).collection).toMatchObject({ kind: "collected", evidence: { paymentMethodType: "sepa_debit" } });
  });
  it.each(["draft", "open", "uncollectible", "void"])("active subscription with %s invoice has no paid coverage", async status => {
    const f = paidFixture(); f.invoice.status = status;
    expect((await f.run()).collection).toEqual({ kind: "unavailable", reason: "not_collected" }); expect(f.client.paymentIntents.retrieve).not.toHaveBeenCalled();
  });
  it.each(["discount", "credits", "tax", "balance", "zero", "partial", "overpaid", "manual", "multiple", "paginated", "proration", "midmonth", "refunded", "disputed", "uncaptured", "wrong_payment"])("rejects unsupported %s collection", async invalid => {
    const f = paidFixture();
    if (invalid === "discount") f.invoice.discounts.push("di_test");
    if (invalid === "credits") f.invoice.pre_payment_credit_notes_amount = 1;
    if (invalid === "tax") f.invoice.total_taxes.push({ amount: 1 });
    if (invalid === "balance") f.invoice.starting_balance = -1;
    if (invalid === "zero") f.invoice.amount_due = 0;
    if (invalid === "partial") f.payment.amount_paid--;
    if (invalid === "overpaid") f.invoice.amount_overpaid = 1;
    if (invalid === "manual") f.payment.payment.type = "payment_record";
    if (invalid === "multiple") f.payments.data.push(structuredClone(f.payment));
    if (invalid === "paginated") f.payments.has_more = true;
    if (invalid === "proration") f.line.parent.subscription_item_details.proration = true;
    if (invalid === "midmonth") { f.line.period.start += 3600; f.subscription.items.data[0].current_period_start += 3600; }
    if (invalid === "refunded") f.charge.amount_refunded = 1;
    if (invalid === "disputed") f.charge.disputed = true;
    if (invalid === "uncaptured") f.charge.captured = false;
    if (invalid === "wrong_payment") f.paymentIntent.status = "processing";
    expect((await f.run()).collection.kind).toBe("unavailable");
  });
  it.each(["customer", "subscription", "line_subscription", "line_item", "price", "payment_invoice", "intent_customer", "charge_intent", "live"])("rejects foreign %s without usable observation", async invalid => {
    const f = paidFixture();
    if (invalid === "customer") f.invoice.customer = "foreign";
    if (invalid === "subscription") f.invoice.parent.subscription_details.subscription = "foreign";
    if (invalid === "line_subscription") f.line.parent.subscription_item_details.subscription = "foreign";
    if (invalid === "line_item") f.line.parent.subscription_item_details.subscription_item = "foreign";
    if (invalid === "price") f.line.pricing.price_details.price = "foreign";
    if (invalid === "payment_invoice") f.payment.invoice = "foreign";
    if (invalid === "intent_customer") f.paymentIntent.customer = "foreign";
    if (invalid === "charge_intent") f.charge.payment_intent = "foreign";
    if (invalid === "live") f.charge.livemode = true;
    await expect(f.run()).rejects.toThrow("collection_identity_mismatch");
  });
  it.each(["invoice", "charge"])("rejects changed %s final reread", async target => {
    const f = paidFixture();
    if (target === "invoice") f.client.invoices.retrieve.mockImplementationOnce(async () => structuredClone(f.invoice)).mockImplementationOnce(async () => ({ ...structuredClone(f.invoice), status: "open" }));
    else f.client.charges.retrieve.mockImplementationOnce(async () => structuredClone(f.charge)).mockImplementationOnce(async () => ({ ...structuredClone(f.charge), disputed: true }));
    await expect(f.run()).rejects.toThrow("collection_snapshot_changed");
  });
});
