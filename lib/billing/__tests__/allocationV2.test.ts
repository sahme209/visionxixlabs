import { describe, expect, it } from "vitest";
import { createAllowanceBasisV2, resolveAllowanceWindowV2, ANNIVERSARY_POLICY_V2, type AllowanceBasisV2 } from "../newTestSubscription/anniversaryWindow";
import { createEnrollmentV2 } from "../newTestSubscription/fixtureAllocation";
import { createReservationAttributionV2, usageAttributionV2, resolveAllocationV2, type CeilingV2, type AllocationFactsV2, type HoldV2, type PurchaseV2 } from "../newTestSubscription/allocationV2";
const scope = { runtimeId: "r", accountId: "a", organizationId: "o" }, enrollmentDigest = createEnrollmentV2(scope).digest;
const free = createAllowanceBasisV2({ ...scope, version: 2, policy: ANNIVERSARY_POLICY_V2, kind: "free", enrollmentDigest });
const paid = createAllowanceBasisV2({ ...scope, version: 2, policy: ANNIVERSARY_POLICY_V2, kind: "paid", enrollmentDigest, anchor: "2026-10-18T12:00:00.000Z", terms: { catalogVersion: "axiom_public_test_v1", planId: "pro", interval: "monthly", seatQuantity: 3, priceId: "p", unitAmountCents: 2900, monthlyAICreditsCents: 3000, monthlyDeployments: 100 }, origin: { intentId: "i", sessionId: "s", customerId: "c", subscriptionId: "sub", createProofDigest: "a".repeat(64), firstCollectionDigest: "b".repeat(64) } });
const before = new Date("2026-10-18T11:00:00Z"), after = new Date("2026-10-18T13:00:00Z");
function window(basis: AllowanceBasisV2 = free, now = before) { const result = resolveAllowanceWindowV2(basis, basis.kind === "paid" ? { version: 2, policy: ANNIVERSARY_POLICY_V2, kind: "collected", status: "active", basisDigest: basis.digest, evidenceDigest: "c".repeat(64), serviceStart: paid.anchor, serviceEnd: "2026-11-18T12:00:00.000Z", collectedAt: paid.anchor } : null, now); if (result.kind !== "available") throw new Error("fixture"); return result.window; }
const purchase = (): PurchaseV2 => ({ id: "p1", organizationId: "o", deliveredAICreditsCents: 500, reversedAICreditsCents: 0, status: "paid", validFor: "permanent", periodMonth: "2026-10", refundedAt: null, createdAt: before });
const facts = (): AllocationFactsV2 => ({ bases: [free, paid], holds: [], usage: [], purchases: [purchase()] });
function hold(allocation: CeilingV2[] = [{ source: "included" as const, bucketId: window().bucketId, maxCents: 100 }]): HoldV2 { return { id: "h", organizationId: "o", reservedCents: 100, settledCents: null, status: "dispatch_unknown", expiresAt: before, usageEventId: null, attribution: createReservationAttributionV2(free, window(), before, allocation) }; }
describe("V2 allocation uses existing ledger rows across immutable buckets", () => {
  it("spends included first, then the existing purchase source", () => {
    const f = facts(), result = resolveAllocationV2(free, window(), f, before, 250);
    expect(result.remainingCents).toBe(700); expect(result.allocation).toEqual([{ source: "included", bucketId: window().bucketId, maxCents: 200 }, { source: "purchase", purchaseId: "p1", maxCents: 50 }]);
  });
  it("late Free cost remains Free and full paid pool is independent", () => {
    const f = facts(), h = hold(); h.status = "settled"; h.settledCents = 80; h.usageEventId = "u"; f.holds.push(h); f.usage.push({ id: "u", organizationId: "o", billingStatus: "settled", billedCents: 80, metadata: { costSource: "synthetic", axiomTestAllocationV2: usageAttributionV2("h", h.attribution!, 80) } });
    expect(resolveAllocationV2(free, window(), f, after).remainingCents).toBe(620);
    expect(resolveAllocationV2(paid, window(paid, after), f, after).remainingCents).toBe(3500);
  });
  it("purchase-funded late cost preserves420 purchased plus3000 paid", () => {
    const f = facts(), h = hold([{ source: "purchase", purchaseId: "p1", maxCents: 100 }]); h.status = "settled"; h.settledCents = 80; h.usageEventId = "u"; f.holds.push(h); f.usage.push({ id: "u", organizationId: "o", billingStatus: "settled", billedCents: 80, metadata: { axiomTestAllocationV2: usageAttributionV2("h", h.attribution!, 80) } });
    const result = resolveAllocationV2(paid, window(paid, after), f, after); expect(result.remainingCents).toBe(3420); expect(result.addOnCents).toBe(420);
  });
  it("unknown unlinked holds never expire or move; purchased ceilings remain global", () => {
    const f = facts(); f.holds.push(hold([{ source: "purchase", purchaseId: "p1", maxCents: 100 }]));
    expect(resolveAllocationV2(paid, window(paid, after), f, after).remainingCents).toBe(3400);
    f.holds[0].status = "reserved"; expect(resolveAllocationV2(paid, window(paid, after), f, after).remainingCents).toBe(3500);
    f.holds[0].status = "pending_settlement"; expect(() => resolveAllocationV2(paid, window(paid, after), f, after)).toThrow();
  });
  it("retains purchase expiry and global spend at calendar and anniversary boundaries", () => {
    const f = facts(); f.purchases[0].validFor = "current_month";
    const november = new Date("2026-11-01T00:00:00Z"); expect(resolveAllocationV2(paid, window(paid, november), f, november).remainingCents).toBe(3000);
    f.purchases[0].validFor = "permanent"; f.purchases[0].reversedAICreditsCents = 500; expect(resolveAllocationV2(paid, window(paid, november), f, november).remainingCents).toBe(3000);
  });
  it.each(["missing", "foreign", "zero_pending", "unlinked_settled", "duplicate", "over_ceiling"])("denies %s facts instead of guessing unclassified financial history", invalid => {
    const f = facts(), h = hold(); f.holds.push(h);
    if (invalid === "missing") h.attribution = null;
    if (invalid === "foreign") h.organizationId = "other";
    if (invalid === "zero_pending") f.usage.push({ id: "u", organizationId: "o", billedCents: 0, billingStatus: "pending", metadata: {} });
    if (invalid === "unlinked_settled") h.status = "settled";
    if (invalid === "duplicate") f.holds.push(structuredClone(h));
    if (invalid === "over_ceiling") { h.attribution!.allocation[0].maxCents++; }
    expect(() => resolveAllocationV2(paid, window(paid, after), f, after)).toThrow();
  });
  it("refuses budget excess and chooses earliest original expiry deterministically", () => {
    const f = facts(); f.purchases.push({ ...purchase(), id: "p0", validFor: "current_month" });
    expect(resolveAllocationV2(free, window(), f, before, 300).allocation.at(-1)).toEqual({ source: "purchase", purchaseId: "p0", maxCents: 100 });
    expect(() => resolveAllocationV2(free, window(), f, before, 1201)).toThrow();
  });
});
