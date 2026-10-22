import { describe, expect, it } from "vitest";
import { observePublicSubscription, observeOriginalPublicCollection } from "../publicSubscriptionEvidence";

import { publicPaymentFixture } from "./fixtures/publicPayment";

describe("production public subscription evidence", () => {
  it("binds collected payment to the purchased organization, seats and service period", () => {
    const f = publicPaymentFixture();
    const r = observePublicSubscription(f.binding, f, f.now);
    expect(r.kind).toBe("collected");
    if (r.kind !== "collected") throw Error("expected collected");
    expect(r.coverage).toMatchObject({ organizationId: "org_1", paidSeats: 3, amountCents: 8700, invoiceId: "in_fixture", serviceStart: "2026-10-22T10:00:00.000Z", serviceEnd: "2026-11-22T10:00:00.000Z", livemode: false });
    expect(r.anchor).toBe("2026-10-22T10:00:00.000Z");
    expect(r.coverage.evidenceDigest).toMatch(/^[a-f0-9]{64}$/);
  });
  it.each(["incomplete", "past_due", "unpaid", "canceled", "incomplete_expired", "paused", "trialing"])("grants no paid allowance for subscription %s", status => {
    const f = publicPaymentFixture(); f.subscription.status = status;
    expect(observePublicSubscription(f.binding, f, f.now).kind).toBe("unavailable");
  });
  it("retains collected access until period end for cancel-at-period-end", () => {
    const f = publicPaymentFixture(); f.subscription.cancel_at_period_end = true;
    expect(observePublicSubscription(f.binding, f, f.now)).toMatchObject({ kind: "collected", cancelAtPeriodEnd: true });
    expect(observePublicSubscription(f.binding, f, new Date("2026-11-22T10:00:00Z")).kind).toBe("unavailable");
  });
  it.each([
    (f: ReturnType<typeof publicPaymentFixture>) => { f.invoice.paid = false; },
    (f: ReturnType<typeof publicPaymentFixture>) => { f.invoice.paid_out_of_band = true; },
    (f: ReturnType<typeof publicPaymentFixture>) => { f.invoice.amount_paid = 0; },
    (f: ReturnType<typeof publicPaymentFixture>) => { f.payment.status = "processing"; },
    (f: ReturnType<typeof publicPaymentFixture>) => { f.charge.amount_refunded = 100; },
    (f: ReturnType<typeof publicPaymentFixture>) => { f.charge.disputed = true; },
    (f: ReturnType<typeof publicPaymentFixture>) => { f.charge.captured = false; },
    (f: ReturnType<typeof publicPaymentFixture>) => { f.invoice.post_payment_credit_notes_amount = 10; },
    (f: ReturnType<typeof publicPaymentFixture>) => { f.invoice.lines.data[0].proration = true; },
    (f: ReturnType<typeof publicPaymentFixture>) => { f.invoice.lines.has_more = true; },
    (f: ReturnType<typeof publicPaymentFixture>) => { f.invoice.lines.data[0].period.end += 86400; },
    (f: ReturnType<typeof publicPaymentFixture>) => { f.subscription.items.data[0].quantity = 4; },
    (f: ReturnType<typeof publicPaymentFixture>) => { f.subscription.items.data[0].price.unit_amount = 499; },
    (f: ReturnType<typeof publicPaymentFixture>) => { f.subscription.items.data[0].price.product = "prod_visa_nova"; },
    (f: ReturnType<typeof publicPaymentFixture>) => { f.subscription.latest_invoice = "in_newer"; },
    (f: ReturnType<typeof publicPaymentFixture>) => { f.invoice.lines.data[0].subscription_item = "si_other"; },
    (f: ReturnType<typeof publicPaymentFixture>) => { f.payment.latest_charge = "ch_other"; },
  ])("never treats incomplete or mismatched collection as paid coverage (%#)", mutate => {
    const f = publicPaymentFixture(); mutate(f);
    expect(observePublicSubscription(f.binding, f, f.now).kind).toBe("unavailable");
  });
  it.each([
    (f: ReturnType<typeof publicPaymentFixture>) => { f.subscription.customer = "cus_other"; },
    (f: ReturnType<typeof publicPaymentFixture>) => { f.subscription.metadata.organizationId = "org_other"; },
    (f: ReturnType<typeof publicPaymentFixture>) => { f.subscription.metadata.intentId = "intent_other"; },
    (f: ReturnType<typeof publicPaymentFixture>) => { f.subscription.livemode = true; },
  ])("rejects a foreign binding rather than suspending another workspace (%#)", mutate => {
    const f = publicPaymentFixture(); mutate(f);
    expect(() => observePublicSubscription(f.binding, f, f.now)).toThrow("public_subscription_binding_mismatch");
  });
  it("rejects invalid clocks", () => {
    const f = publicPaymentFixture();
    expect(() => observePublicSubscription(f.binding, f, new Date(NaN))).toThrow();
  });
});

it("verifies the original collected invoice independently of the current renewal window",()=>{
  const f=publicPaymentFixture();
  const result=observeOriginalPublicCollection(f.binding,{...f,invoice:{...f.invoice,billing_reason:"subscription_create"}},f.subscription.billing_cycle_anchor,"si_fixture",f.invoice.id,new Date("2026-12-22T12:00:00Z"));
  expect(result).toMatchObject({kind:"collected",invoiceId:"in_fixture",serviceStart:"2026-10-22T10:00:00.000Z"});
  expect(observeOriginalPublicCollection(f.binding,{...f,invoice:{...f.invoice,billing_reason:"subscription_cycle"}},f.subscription.billing_cycle_anchor,"si_fixture",f.invoice.id,new Date("2026-12-22T12:00:00Z"))).toBeNull();
});
it("does not substitute a renewal invoice or refunded collection for the original receipt",()=>{
  const f=publicPaymentFixture();f.charge.refunded=true;
  expect(observeOriginalPublicCollection(f.binding,{...f,invoice:{...f.invoice,billing_reason:"subscription_create"}},f.subscription.billing_cycle_anchor,"si_fixture",f.invoice.id,f.now)).toBeNull();
});
