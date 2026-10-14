import { describe, expect, it, vi } from "vitest";
import { attachAICreditReservationUsage, reserveAICredits, settleAICreditReservation } from "../aiCreditReservation";

function reservationRepo(overrides: { used?: number; held?: number; existing?: any; tier?: string } = {}) {
  const reservations: any[] = [];
  const aIUsageReservation = {
    findUnique: vi.fn(async () => overrides.existing ?? null),
    updateMany: vi.fn(async () => ({ count: 0 })),
    aggregate: vi.fn(async () => ({ _sum: { reservedCents: overrides.held ?? 0 } })),
    create: vi.fn(async ({ data }: any) => ({ id: "hold-1", ...data })),
  };
  const tx = {
    aIUsageReservation,
    tenantBillingPlan: { findUnique: vi.fn(async () => ({ tier: overrides.tier ?? "starter", status: "active" })) },
    addOnPurchase: { findMany: vi.fn(async () => []) },
    usageEvent: { aggregate: vi.fn(async () => ({ _sum: { billedCents: overrides.used ?? 0 } })) },
  };
  return { aIUsageReservation, repo: { $transaction: vi.fn(async (fn: any) => fn(tx)) } };
}

const input = { organizationId: "org-1", idempotencyKey: "request_abcdefghijkl", reservedCents: 100, correlationId: "corr-1" };

describe("AI credit reservations", () => {
  it("uses a serializable transaction and holds a bounded request before execution", async () => {
    const { repo, aIUsageReservation } = reservationRepo();
    const result = await reserveAICredits(repo, input, new Date("2026-10-14T12:00:00Z"));
    expect(result).toMatchObject({ ok: true, reused: false });
    expect(repo.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: "Serializable" });
    expect(aIUsageReservation.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ reservedCents: 100, status: "reserved" }) }));
  });

  it("rejects a final-plus-one concurrent hold without creating a reservation", async () => {
    const { repo, aIUsageReservation } = reservationRepo({ used: 2450, held: 0 });
    await expect(reserveAICredits(repo, input)).resolves.toEqual({ ok: false, error: "ai_credit_pool_exhausted" });
    expect(aIUsageReservation.create).not.toHaveBeenCalled();
  });

  it("expires stale holds before calculating current availability", async () => {
    const { repo, aIUsageReservation } = reservationRepo();
    const now = new Date("2026-10-14T12:00:00Z");
    await reserveAICredits(repo, input, now);
    expect(aIUsageReservation.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ status: "reserved", usageEventId: null, expiresAt: { lte: now } }),
      data: { status: "expired", releasedAt: now },
    }));
  });

  it("keeps pending Gateway holds in the availability calculation", async () => {
    const { repo, aIUsageReservation } = reservationRepo({ held: 100 });
    await reserveAICredits(repo, input, new Date("2026-10-14T12:00:00Z"));
    expect(aIUsageReservation.aggregate).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        OR: expect.arrayContaining([
          { status: "pending_settlement" },
          { status: "reserved", usageEventId: { not: null } },
        ]),
      }),
    }));
  });

  it("returns the original reservation for an idempotent retry", async () => {
    const existing = { id: "hold-1", ...input, status: "reserved", expiresAt: new Date() };
    const { repo, aIUsageReservation } = reservationRepo({ existing });
    await expect(reserveAICredits(repo, input)).resolves.toMatchObject({ ok: true, reused: true, reservation: existing });
    expect(aIUsageReservation.create).not.toHaveBeenCalled();
  });

  it("rejects reuse of a request key with a different budget", async () => {
    const existing = { id: "hold-1", ...input, status: "reserved", expiresAt: new Date() };
    const { repo } = reservationRepo({ existing });
    await expect(reserveAICredits(repo, { ...input, reservedCents: 101 })).resolves.toEqual({ ok: false, error: "idempotency_key_conflict" });
  });

  it("allows an overage-plan request after included credits are consumed", async () => {
    const { repo, aIUsageReservation } = reservationRepo({ tier: "growth", used: 20_000 });
    await expect(reserveAICredits(repo, input)).resolves.toMatchObject({ ok: true, reused: false });
    expect(aIUsageReservation.create).toHaveBeenCalled();
  });

  it("settles only an amount within the pre-authorized hold", async () => {
    const updateMany = vi.fn(async () => ({ count: 1 }));
    const repo = { aIUsageReservation: { updateMany } };
    await expect(settleAICreditReservation(repo, "org-1", "hold-1", 99, "usage-1")).resolves.toBe(true);
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ reservedCents: { gte: 99 } }),
      data: expect.objectContaining({ status: "settled", settledCents: 99, usageEventId: "usage-1" }),
    }));
  });

  it("refuses to settle a request above its approved budget", async () => {
    const updateMany = vi.fn(async () => ({ count: 0 }));
    const repo = { aIUsageReservation: { updateMany } };
    await expect(settleAICreditReservation(repo, "org-1", "hold-1", 101)).resolves.toBe(false);
  });

  it("moves a linked Gateway hold into pending settlement", async () => {
    const updateMany = vi.fn(async () => ({ count: 1 }));
    const repo = { aIUsageReservation: { updateMany } };
    await expect(attachAICreditReservationUsage(repo, "org-1", "hold-1", "usage-1")).resolves.toBe(true);
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ status: "reserved", usageEventId: null }),
      data: { status: "pending_settlement", usageEventId: "usage-1" },
    }));
  });
});
