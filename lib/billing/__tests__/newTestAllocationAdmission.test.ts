import { describe, expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";
import { createAllowanceBasisV2, ANNIVERSARY_POLICY_V2 } from "../newTestSubscription/anniversaryWindow";
import { createEnrollmentV2 } from "../newTestSubscription/fixtureAllocation";
import { newTestAllocationPricingPlan, reserveAllocationV2, readAllocationAllowanceV2 } from "../newTestSubscription/allocationPlan";
import { claimNewTestBillableDispatch } from "../newTestSubscription/usageAllocationIO";
import { releaseAICreditReservation } from "../aiCreditReservation";
import type { HoldV2, ReservationAttributionV2, PurchaseV2 } from "../newTestSubscription/allocationV2";
function fixture() {
  const scope = { runtimeId: "r", accountId: "a", organizationId: "o" }, enrollment = createEnrollmentV2(scope), freeBasis = createAllowanceBasisV2({ ...scope, version: 2, policy: ANNIVERSARY_POLICY_V2, enrollmentDigest: enrollment.digest, kind: "free" });
  const state = { enrollment, freeBasis, paidBasis: null, revision: 1 }; let now = new Date("2026-10-31T23:59:59Z");
  const purchases: PurchaseV2[] = [{ id: "purchase", organizationId: "o", status: "paid", validFor: "current_month", periodMonth: "2026-10", deliveredAICreditsCents: 500, reversedAICreditsCents: 0, refundedAt: null, createdAt: now }];
  let memberRole = "owner"; let accepted = true; let onLock = () => {}; let onAuthority = () => {}; let denyInsert = false;
  const usage: unknown[] = [], holds: HoldV2[] = [];
  const execute = vi.fn(async (_sql: string, id: string, _org: string, _digest: string, body: string) => { const h = holds.find(h => h.id === id); if (h) h.attribution = JSON.parse(body) as ReservationAttributionV2; return 1; });
  const query = vi.fn(async (sql: string) => {
    if (sql.startsWith('SELECT a.body FROM "NewTestReservationAttribution"')) return holds[0]?.attribution ? [{ body: holds[0].attribution }] : [];
    if (sql.startsWith('SELECT "userId","organizationId",role,"acceptedAt" FROM "OrgMembership"')) return [{ userId: "owner", organizationId: "o", role: memberRole, acceptedAt: accepted ? now : null }];
    if (sql.startsWith('SELECT id FROM "AIUsageReservation"')) return holds.length ? [{ id: "hold" }] : [];
    if (sql.startsWith('SELECT id FROM "IsolatedTestRuntime"')) return [{ id: "r" }];
    if (sql.includes("to_regclass")) return [{ installed: true, partial: true }];
    if (sql.startsWith("SELECT e.body")) return [{ body: enrollment, revision: state.revision, free: freeBasis, paid: null }];
    if (sql.startsWith("SELECT clock_timestamp")) return [{ now: new Date(now) }];
    if (sql.startsWith("SELECT h.*")) return structuredClone(holds);
    if (sql.startsWith('SELECT * FROM "AddOnPurchase"')) { onLock(); return structuredClone(purchases); }
    if (sql.includes('INSERT INTO "AIUsageReservation"')) {
      if (denyInsert) return [];
      const h = { id: "hold", organizationId: "o", idempotencyKey: "request_123456789", reservedCents: 250, settledCents: null, usageEventId: null, status: "reserved", createdAt: new Date(now), expiresAt: new Date(now.getTime() + 300000), attribution: null }; holds.push(h); return [structuredClone(h)];
    }
    if (sql.includes('UPDATE "AIUsageReservation" h SET')) { if (denyInsert || holds[0].status !== "reserved") return []; holds[0].status = "dispatch_unknown"; return [{ id: "hold" }]; }
    if (sql.includes("SELECT org FROM authority")) { onAuthority(); return [{ org: "o" }]; }
    throw new Error("unowned_test_query");
  });
  const tx = { orgMembership: { findUnique: async () => ({ acceptedAt: accepted ? now : null, role: memberRole }) }, aIUsageReservation: { updateMany: async ({ where }: {where: {status:string}}) => ({ count: holds[0]?.status === where.status ? 1 : 0 }) }, $queryRawUnsafe: query, $executeRawUnsafe: execute, tenantBillingPlan: { findUnique: async () => null }, usageEvent: { findMany: async () => structuredClone(usage) }, addOnPurchase: { findMany: async () => structuredClone(purchases) } } as unknown as Prisma.TransactionClient;
  return { tx, scope, state, query, execute, usage, purchases, holds, demote: () => { memberRole = "read_only"; }, unaccept: () => { accepted = false; }, setLock: (fn: () => void) => { onLock = fn; }, setAuthority: (fn: () => void) => { onAuthority = fn; }, setNow: (n: string) => { now = new Date(n); }, refuse: () => { denyInsert = true; } };
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
  it("commits unknown before work and retains an unlinked hold after TTL and generic failure", async () => {
    const f = fixture(); f.setNow("2026-10-31T12:00:00Z");
    const plan = await newTestAllocationPricingPlan(f.tx, f.scope, null, f.state);
    await reserveAllocationV2(f.tx, plan, input, false);
    expect(await claimNewTestBillableDispatch(f.tx, { organizationId: "o", userId: "owner" }, "hold")).toBe(true);
    expect(f.holds[0].status).toBe("dispatch_unknown");
    expect(await claimNewTestBillableDispatch(f.tx, { organizationId: "o", userId: "owner" }, "hold")).toBe(false);
    expect(await releaseAICreditReservation(f.tx, "o", "hold")).toBe(false);
    f.setNow("2026-10-31T12:06:00Z");
    const current = await newTestAllocationPricingPlan(f.tx, f.scope, null, f.state);
    expect((await readAllocationAllowanceV2(f.tx, current)).includedRemainingCents).toBe(450);
    await expect(reserveAllocationV2(f.tx, current, { ...input, reservedCents: 451 }, false)).rejects.toThrow("ai_credit_pool_exhausted");
    expect(f.holds).toHaveLength(1);
  });
  it.each(["refund", "UTC-expiry", "final-CAS"])("claim rechecks %s before granting dispatch", async drift => {
    const f = fixture(), plan = await newTestAllocationPricingPlan(f.tx, f.scope, null, f.state);
    await reserveAllocationV2(f.tx, plan, input, false);
    if (drift === "refund") { f.purchases[0].reversedAICreditsCents = 500; f.purchases[0].status = "refunded"; }
    if (drift === "UTC-expiry") f.setLock(() => f.setNow("2026-11-01T00:00:00Z"));
    if (drift === "final-CAS") f.refuse();
    let claimed = false; try { claimed = await claimNewTestBillableDispatch(f.tx, { organizationId: "o", userId: "owner" }, "hold"); } catch { /* fail closed */ }
    expect(claimed).toBe(false); expect(f.holds[0].status).toBe("reserved");
  });
  it("reads clock after current authority locks have completed, including a delayed read fence", async () => {
    const f = fixture(), plan = await newTestAllocationPricingPlan(f.tx, f.scope, null, f.state);
    f.setAuthority(() => f.setNow("2026-11-01T00:00:00Z"));
    await expect(readAllocationAllowanceV2(f.tx, plan)).rejects.toThrow();
  });
  it.each(["demoted", "unaccepted"])("rechecks %s membership after awaited purchase locks and before claim", async change => {
    const f = fixture(), plan = await newTestAllocationPricingPlan(f.tx, f.scope, null, f.state);
    await reserveAllocationV2(f.tx, plan, input, false);
    f.setLock(() => { if (change === "demoted") f.demote(); else f.unaccept(); });
    const before = structuredClone({ holds: f.holds, purchases: f.purchases, usage: f.usage });
    await expect(claimNewTestBillableDispatch(f.tx, { organizationId: "o", userId: "owner" }, "hold")).rejects.toThrow("attributed_usage_unavailable");
    expect({ holds: f.holds, purchases: f.purchases, usage: f.usage }).toEqual(before);
    expect(f.holds[0].status).toBe("reserved");
    expect(f.query.mock.calls.some(([sql]) => sql.includes('UPDATE "AIUsageReservation" h SET'))).toBe(false);
  });
  it("uses one recordset alias in the SQL declaration (shape regression only, not parser proof)", async () => {
    const f = fixture(), plan = await newTestAllocationPricingPlan(f.tx, f.scope, null, f.state);
    await reserveAllocationV2(f.tx, plan, input, false);
    const sql = f.query.mock.calls.find(([sql]) => sql.includes('INSERT INTO "AIUsageReservation"'))![0];
    expect(sql).toContain('jsonb_to_recordset($8::jsonb) AS w('); expect(sql).not.toContain(') w ON');
  });
  it("does not aggregate away an unknown zero-cost event", async () => {
    const f = fixture(), plan = await newTestAllocationPricingPlan(f.tx, f.scope, null, f.state);
    f.usage.push({ id: "unattributed", organizationId: "o", billedCents: 0, billingStatus: "pending", metadata: {} });
    await expect(readAllocationAllowanceV2(f.tx, plan)).rejects.toThrow();
    await expect(reserveAllocationV2(f.tx, plan, input, false)).rejects.toThrow(); expect(f.execute).not.toHaveBeenCalled();
  });
});
