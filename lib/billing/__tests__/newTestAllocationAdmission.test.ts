import { describe, expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";
import { createAllowanceBasisV2, ANNIVERSARY_POLICY_V2 } from "../newTestSubscription/anniversaryWindow";
import { createEnrollmentV2 } from "../newTestSubscription/fixtureAllocation";
import { newTestAllocationPricingPlan, reserveAllocationV2, readAllocationAllowanceV2 } from "../newTestSubscription/allocationPlan";
import type { PurchaseV2 } from "../newTestSubscription/allocationV2";
function fixture() {
  const scope = { runtimeId: "r", accountId: "a", organizationId: "o" }, enrollment = createEnrollmentV2(scope), freeBasis = createAllowanceBasisV2({ ...scope, version: 2, policy: ANNIVERSARY_POLICY_V2, enrollmentDigest: enrollment.digest, kind: "free" });
  const state = { enrollment, freeBasis, paidBasis: null, revision: 1 }; let now = new Date("2026-10-31T23:59:59Z");
  const purchases: PurchaseV2[] = [{ id: "purchase", organizationId: "o", status: "paid", validFor: "current_month", periodMonth: "2026-10", deliveredAICreditsCents: 500, reversedAICreditsCents: 0, refundedAt: null, createdAt: now }];
  let onLock = () => {}; let denyInsert = false;
  const usage: unknown[] = [], holds: unknown[] = [];
  const execute = vi.fn(async () => 1);
  const query = vi.fn(async (sql: string) => {
    if (sql.includes("to_regclass")) return [{ installed: true, partial: true }];
    if (sql.startsWith("SELECT e.body")) return [{ body: enrollment, revision: state.revision, free: freeBasis, paid: null }];
    if (sql.startsWith("SELECT clock_timestamp")) return [{ now: new Date(now) }];
    if (sql.startsWith("SELECT h.*")) return structuredClone(holds);
    if (sql.startsWith('SELECT * FROM "AddOnPurchase"')) { onLock(); return structuredClone(purchases); }
    if (sql.includes('INSERT INTO "AIUsageReservation"')) return denyInsert ? [] : [{ id: "hold", organizationId: "o", idempotencyKey: "request_123456789", reservedCents: 250, status: "reserved", createdAt: now, expiresAt: new Date(now.getTime() + 300000) }];
    if (sql.includes("SELECT org FROM authority")) return [{ org: "o" }];
    throw new Error("unowned_test_query");
  });
  const tx = { $queryRawUnsafe: query, $executeRawUnsafe: execute, tenantBillingPlan: { findUnique: async () => null }, usageEvent: { findMany: async () => structuredClone(usage) }, addOnPurchase: { findMany: async () => structuredClone(purchases) } } as unknown as Prisma.TransactionClient;
  return { tx, scope, state, query, execute, usage, purchases, setLock: (fn: () => void) => { onLock = fn; }, setNow: (n: string) => { now = new Date(n); }, refuse: () => { denyInsert = true; } };
}
const input = { organizationId: "o", idempotencyKey: "request_123456789", reservedCents: 250 };
describe("V2 existing-hold admission composition (synthetic SQL boundary)", () => {
  it("locks selected actual purchases and inserts hold plus original attribution in the same transaction", async () => {
    const f = fixture(), plan = await newTestAllocationPricingPlan(f.tx, f.scope, null, f.state);
    await reserveAllocationV2(f.tx, plan, input, false);
    expect(f.query.mock.calls.find(([sql]) => sql.startsWith('SELECT * FROM "AddOnPurchase"'))?.[0]).toContain("ORDER BY id FOR UPDATE");
    const final = f.query.mock.calls.find(([sql]) => sql.includes('INSERT INTO "AIUsageReservation"'))![0];
    expect(final).toContain('"periodMonth"=to_char(clock_timestamp()'); expect(final).toContain('FOR UPDATE OF p');
    expect(f.execute).toHaveBeenCalledOnce(); expect(f.execute.mock.calls[0][0]).toContain('"NewTestReservationAttribution"');
  });
  it.each(["refund", "UTC-expiry", "enrollment", "final-CAS"])("refuses %s drift before any attribution write", async drift => {
    const f = fixture(), plan = await newTestAllocationPricingPlan(f.tx, f.scope, null, f.state);
    if (drift === "refund") f.setLock(() => { f.purchases[0].reversedAICreditsCents = 500; });
    if (drift === "UTC-expiry") f.setLock(() => f.setNow("2026-11-01T00:00:00Z"));
    if (drift === "enrollment") f.state.revision++;
    if (drift === "final-CAS") f.refuse();
    await expect(reserveAllocationV2(f.tx, plan, input, false)).rejects.toThrow(); expect(f.execute).not.toHaveBeenCalled();
  });
  it("rechecks read expiry after ledger IO rather than returning the earlier captured pool", async () => {
    const f = fixture(), plan = await newTestAllocationPricingPlan(f.tx, f.scope, null, f.state);
    f.setNow("2026-11-01T00:00:00Z");
    await expect(readAllocationAllowanceV2(f.tx, plan)).rejects.toThrow();
  });
  it("does not aggregate away an unknown zero-cost event", async () => {
    const f = fixture(), plan = await newTestAllocationPricingPlan(f.tx, f.scope, null, f.state);
    f.usage.push({ id: "unattributed", organizationId: "o", billedCents: 0, billingStatus: "pending", metadata: {} });
    await expect(readAllocationAllowanceV2(f.tx, plan)).rejects.toThrow();
    await expect(reserveAllocationV2(f.tx, plan, input, false)).rejects.toThrow(); expect(f.execute).not.toHaveBeenCalled();
  });
});
