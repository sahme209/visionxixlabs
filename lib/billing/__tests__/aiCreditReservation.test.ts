import { describe, expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";
import { attachAICreditReservationUsage, claimLegacyAICreditDispatch, releaseAICreditReservation, reserveAICredits, settleAICreditReservation } from "../aiCreditReservation";

function reservationRepo(overrides: { used?: number; held?: number; existing?: unknown; tier?: string } = {}) {
  const aIUsageReservation = {
    findUnique: vi.fn(async () => overrides.existing ?? null),
    updateMany: vi.fn(async (args: unknown) => { void args; return { count: 0 }; }),
    aggregate: vi.fn(async () => ({ _sum: { reservedCents: overrides.held ?? 0 } })),
    create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: "hold-1", ...data })),
  };
  const tx = {
    aIUsageReservation,
    tenantBillingPlan: { findUnique: vi.fn(async () => ({ tier: overrides.tier ?? "starter", status: "active" })) },
    addOnPurchase: { findMany: vi.fn(async () => []) },
    usageEvent: { aggregate: vi.fn(async () => ({ _sum: { billedCents: overrides.used ?? 0 } })) },
  };
  return { aIUsageReservation, repo: { $transaction: vi.fn(async (fn: (transaction: typeof tx) => unknown) => fn(tx)) } as unknown as Parameters<typeof reserveAICredits>[0] };
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
          { status: "dispatch_unknown" },
          { status: "reserved", usageEventId: { not: null } },
        ]),
      }),
    }));
  });

  it("does not expire or release claimed uncertainty even after its original TTL", async () => {
    const { repo, aIUsageReservation } = reservationRepo({ held: 2450 });
    const now = new Date("2030-01-01T00:00:00Z");
    await expect(reserveAICredits(repo, input, now)).resolves.toEqual({ ok: false, error: "ai_credit_pool_exhausted" });
    const expiration = aIUsageReservation.updateMany.mock.calls[0]?.[0];
    expect(expiration).toMatchObject({ where: { status: "reserved", usageEventId: null, expiresAt: { lte: now } } });
    const updateMany = vi.fn(async ({ where }: Prisma.AIUsageReservationUpdateManyArgs) => ({ count: where?.status === "dispatch_unknown" ? 1 : 0 }));
    await expect(releaseAICreditReservation({ aIUsageReservation: { updateMany } }, "org-1", "claimed")).resolves.toBe(false);
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ status: "reserved" }) }));
  });

  it("claims only an unexpired, unattached reserved hold under locked current member authority", async () => {
    const query = vi.fn().mockResolvedValueOnce([{ userId: "member", organizationId: "org-1", acceptedAt: new Date() }]).mockResolvedValueOnce([{ id: "hold-1" }]);
    await expect(claimLegacyAICreditDispatch({ $queryRawUnsafe: query } as unknown as Prisma.TransactionClient, { organizationId: "org-1", userId: "member" }, "hold-1")).resolves.toBe(true);
    expect(query.mock.calls[0]).toEqual([expect.stringContaining("FOR SHARE"), "member", "org-1"]);
    const [sql, ...args] = query.mock.calls[1];
    expect(sql).toContain("status='dispatch_unknown'"); expect(sql).toContain("h.status='reserved'");
    expect(sql).toContain('h."usageEventId" IS NULL'); expect(sql).toContain('>clock_timestamp()');
    expect(sql).toContain('m."acceptedAt" IS NOT NULL'); expect(sql).not.toContain("'admin'");
    expect(args).toEqual(["hold-1", "org-1", "member"]);
  });

  it.each([{ members: [] }, { members: [{ userId: "foreign", organizationId: "org-1", acceptedAt: new Date() }] }, { members: [{ userId: "member", organizationId: "org-1", acceptedAt: null }] }])("denies absent/foreign/unaccepted membership before claim", async ({ members }) => {
    const query = vi.fn().mockResolvedValue(members);
    await expect(claimLegacyAICreditDispatch({ $queryRawUnsafe: query } as unknown as Prisma.TransactionClient, { organizationId: "org-1", userId: "member" }, "hold-1")).resolves.toBe(false);
    expect(query).toHaveBeenCalledTimes(1);
  });

  it("denies an atomic claim that was already taken, expired, or revoked", async () => {
    const query = vi.fn().mockResolvedValueOnce([{ userId: "member", organizationId: "org-1", acceptedAt: new Date() }]).mockResolvedValueOnce([]);
    await expect(claimLegacyAICreditDispatch({ $queryRawUnsafe: query } as unknown as Prisma.TransactionClient, { organizationId: "org-1", userId: "member" }, "hold-1")).resolves.toBe(false);
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

  it.each(["growth", "business", "enterprise"])("refuses a legacy %s workspace whose prepaid balance cannot cover the hold, before any hold or provider call", async (tier) => {
    const pool = tier === "growth" ? 20_000 : tier === "business" ? 75_000 : 500_000;
    const { repo, aIUsageReservation } = reservationRepo({ tier, used: pool - input.reservedCents + 1 });
    await expect(reserveAICredits(repo, input)).resolves.toEqual({ ok: false, error: "ai_credit_pool_exhausted" });
    expect(aIUsageReservation.create).not.toHaveBeenCalled();
  });

  it("still admits a legacy growth request the balance covers", async () => {
    const { repo, aIUsageReservation } = reservationRepo({ tier: "growth", used: 20_000 - input.reservedCents });
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
