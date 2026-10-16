import { describe, expect, it, vi } from "vitest";
import { readCurrentAIAllowance } from "../currentAIAllowance";
import { reserveAICredits } from "../aiCreditReservation";
const now = new Date("2026-10-16T12:00:00Z");
function fixture() {
  const tx = {
    tenantBillingPlan: { findUnique: vi.fn(async () => ({ tier: "growth", status: "active" })) },
    addOnPurchase: { findMany: vi.fn(async () => []) },
    usageEvent: { aggregate: vi.fn(async () => ({ _sum: { billedCents: 300 } })) },
    aIUsageReservation: { aggregate: vi.fn(async () => ({ _sum: { reservedCents: 700 } })), findUnique: vi.fn(async () => null), updateMany: vi.fn(async () => ({ count: 0 })), create: vi.fn(async () => ({ id: "synthetic" })) },
  };
  const repo = { $transaction: vi.fn(async (fn: (value: typeof tx) => unknown) => fn(tx)) };
  return { tx, repo };
}
describe("read-only current AI allowance authority", () => {
  it("matches reservation purchase, usage and hold query semantics without any mutation", async () => {
    const read = fixture(), reserve = fixture();
    expect(await readCurrentAIAllowance(read.repo as never, "tenant", now)).toMatchObject({ available: true, poolCents: 20000, usedCents: 300, heldCents: 700, includedRemainingCents: 19000 });
    await reserveAICredits(reserve.repo, { organizationId: "tenant", idempotencyKey: "fixture_request_12345", reservedCents: 100 }, now);
    expect(read.tx.tenantBillingPlan.findUnique.mock.calls).toEqual(reserve.tx.tenantBillingPlan.findUnique.mock.calls);
    expect(read.tx.addOnPurchase.findMany.mock.calls).toEqual(reserve.tx.addOnPurchase.findMany.mock.calls);
    expect(read.tx.usageEvent.aggregate.mock.calls).toEqual(reserve.tx.usageEvent.aggregate.mock.calls);
    expect(read.tx.aIUsageReservation.aggregate.mock.calls).toEqual(reserve.tx.aIUsageReservation.aggregate.mock.calls);
    expect(read.tx.aIUsageReservation.aggregate).toHaveBeenCalledWith(expect.objectContaining({ where: { organizationId: "tenant", OR: [
      { status: "reserved", usageEventId: null, expiresAt: { gt: now } },
      { status: "reserved", usageEventId: { not: null } }, { status: "pending_settlement" },
    ] } }));
    expect(read.tx.aIUsageReservation.updateMany).not.toHaveBeenCalled();
    expect(read.tx.aIUsageReservation.create).not.toHaveBeenCalled();
    expect(read.repo.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: "RepeatableRead" });
  });
  it.each([undefined, -1, Number.NaN, 1.5, Number.MAX_SAFE_INTEGER + 1])("withholds missing/invalid financial aggregate %s", async (value) => {
    const { tx, repo } = fixture();
    tx.aIUsageReservation.aggregate.mockResolvedValue({ _sum: { reservedCents: value } } as never);
    expect(await readCurrentAIAllowance(repo as never, "tenant", now)).toEqual({ available: false });
  });
  it("withholds malformed purchase financial evidence", async () => {
    const { tx, repo } = fixture();
    tx.addOnPurchase.findMany.mockResolvedValue([{ status: "paid", validFor: "permanent", deliveredAICreditsCents: 100 }] as never);
    expect(await readCurrentAIAllowance(repo as never, "tenant", now)).toEqual({ available: false });
  });
  it.each(["", "unknown", null])("withholds malformed account status %s without repairing it", async status => {
    const { tx, repo } = fixture();
    tx.tenantBillingPlan.findUnique.mockResolvedValue({ tier: "growth", status } as never);
    expect(await readCurrentAIAllowance(repo as never, "tenant", now)).toEqual({ available: false });
    expect(tx.aIUsageReservation.updateMany).not.toHaveBeenCalled();
  });
  it("recognizes genuine empty aggregates rather than treating them as unavailable", async () => {
    const { tx, repo } = fixture();
    tx.tenantBillingPlan.findUnique.mockResolvedValue(null as never);
    tx.usageEvent.aggregate.mockResolvedValue({ _sum: { billedCents: null } } as never);
    tx.aIUsageReservation.aggregate.mockResolvedValue({ _sum: { reservedCents: null } } as never);
    expect(await readCurrentAIAllowance(repo as never, "tenant", now)).toMatchObject({ available: true, poolCents: 2500, includedRemainingCents: 2500, overagePolicy: "hard_stop" });
  });
});
