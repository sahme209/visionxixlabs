import { describe, expect, it } from "vitest";
import { collectedEvidence, paidAccess, type CoverageObservation } from "../newTestSubscription/paidCoverage";

export const identity = { runtimeId: "runtime", accountId: "acct_test", organizationId: "org", originatingIntentId: "intent", sessionId: "cs_test", customerId: "cus_test", subscriptionId: "sub_test", planId: "pro" as const, interval: "monthly" as const, seatQuantity: 3, priceId: "price_test", unitAmountCents: 2900 };
export function evidenceInput() { return { ...identity, invoiceId: "in_test", lineId: "il_test", subscriptionItemId: "si_test", paymentId: "inpay_test", paymentIntentId: "pi_test", chargeId: "ch_test", currency: "usd" as const, amountCents: 8700, collectedAt: "2026-10-01T00:00:00.000Z", serviceStart: "2026-10-01T00:00:00.000Z", serviceEnd: "2026-11-01T00:00:00.000Z" }; }
const observation = (): CoverageObservation => ({ eventToken: "evt_test", latestInvoiceId: "in_test", currentPeriodStart: "2026-10-01T00:00:00.000Z", currentPeriodEnd: "2026-11-01T00:00:00.000Z", collection: { kind: "collected", evidence: collectedEvidence(evidenceInput()) } });
describe("NEW TEST calendar-aligned collected coverage kernel", () => {
  it("funds only the current full calendar bucket", () => {
    expect(paidAccess(identity, "active", "evt_test", observation(), true, new Date("2026-10-16Z"))).toEqual({ kind: "paid", monthlyAICreditsCents: 3000, month: "2026-10" });
    for (const now of ["2026-09-30T23:59:59.999Z", "2026-11-01T00:00:00Z", "2027-10-16Z"]) expect(() => paidAccess(identity, "active", "evt_test", observation(), true, new Date(now))).toThrow("paid_coverage_unavailable");
  });
  it("requires current projection, original collection and exact proof scope", () => {
    for (const altered of [null, { ...observation(), eventToken: "old" }, { ...observation(), latestInvoiceId: "in_other" }, { ...observation(), currentPeriodEnd: "2026-12-01T00:00:00.000Z" }, { ...observation(), collection: { kind: "unavailable" as const, reason: "unsupported_collection" as const } }]) expect(() => paidAccess(identity, "active", "evt_test", altered, true, new Date("2026-10-16Z"))).toThrow();
    expect(() => paidAccess(identity, "active", "evt_test", observation(), false, new Date("2026-10-16Z"))).toThrow();
    for (const key of ["runtimeId", "accountId", "organizationId", "originatingIntentId", "sessionId", "customerId", "subscriptionId", "priceId"] as const) expect(() => paidAccess({ ...identity, [key]: "foreign" }, "active", "evt_test", observation(), true, new Date("2026-10-16Z"))).toThrow();
  });
  it("keeps explicit inactive Free separate from unavailable active proof", () => {
    expect(paidAccess(identity, "past_due", "evt_test", { ...observation(), collection: { kind: "unavailable", reason: "not_collected" } }, true, new Date("2026-10-16Z"))).toMatchObject({ kind: "free", monthlyAICreditsCents: 200 });
    expect(() => paidAccess(identity, "canceled", "evt_test", observation(), false, new Date("2026-10-16Z"))).toThrow();
    expect(() => paidAccess(identity, "canceled", "evt_test", null, true, new Date("2026-10-16Z"))).toThrow();
    expect(() => paidAccess(identity, "past_due", "evt_test", { ...observation(), collection: { kind: "unavailable", reason: "unsupported_terms" } }, true, new Date("2026-10-16Z"))).toThrow();
  });
  it("rejects partial/mid-month/discounted and incorrectly bounded evidence", () => {
    for (const patch of [{ serviceStart: "2026-10-16T00:00:00.000Z", serviceEnd: "2026-11-16T00:00:00.000Z" }, { serviceEnd: "2026-12-01T00:00:00.000Z" }, { amountCents: 8699 }, { seatQuantity: 4 }, { collectedAt: "invalid" }, { currency: "eur" }]) expect(() => collectedEvidence({ ...evidenceInput(), ...patch } as ReturnType<typeof evidenceInput>)).toThrow();
  });
  it("annual full collection funds twelve and only twelve monthly buckets", () => {
    const annual = { ...identity, interval: "annual" as const, unitAmountCents: 27840 };
    const proof = collectedEvidence({ ...evidenceInput(), ...annual, amountCents: 83520, serviceEnd: "2027-10-01T00:00:00.000Z" });
    const o = { ...observation(), currentPeriodEnd: proof.serviceEnd, collection: { kind: "collected" as const, evidence: proof } };
    expect(paidAccess(annual, "active", "evt_test", o, true, new Date("2027-09-30Z"))).toMatchObject({ monthlyAICreditsCents: 3000, month: "2027-09" });
    expect(() => paidAccess(annual, "active", "evt_test", o, true, new Date("2027-10-01Z"))).toThrow();
  });
});
