import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("ai", () => ({ gateway: { getGenerationInfo: vi.fn() } }));

import {
  reconcilePendingGatewayUsage,
  type GatewayGenerationUsage,
  type GatewayUsageRepository,
} from "../reconcileGatewayUsage";

const generation: GatewayGenerationUsage = {
  id: "gen_1",
  totalCost: 0.012,
  model: "openai/gpt-5.4",
  providerName: "openai",
  promptTokens: 125,
  completionTokens: 25,
  cachedTokens: 10,
};

describe("reconcilePendingGatewayUsage", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("settles authoritative Gateway cost once with platform margin", async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const repository: GatewayUsageRepository = {
      usageEvent: {
        findMany: vi.fn().mockResolvedValue([{ id: "usage_1", externalUsageId: "gen_1" }]),
        updateMany,
      },
    };

    const result = await reconcilePendingGatewayUsage(repository, vi.fn().mockResolvedValue(generation));

    expect(result).toEqual({ inspected: 1, settled: 1, deferred: 0, failed: 0 });
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "usage_1", billingStatus: "pending" },
      data: expect.objectContaining({ costCents: 2, billedCents: 3, billingStatus: "settled" }),
    }));
  });

  it("leaves a generation pending while Gateway ingestion catches up", async () => {
    const repository: GatewayUsageRepository = {
      usageEvent: {
        findMany: vi.fn().mockResolvedValue([{ id: "usage_1", externalUsageId: "gen_1" }]),
        updateMany: vi.fn(),
      },
    };
    const unavailable = Object.assign(new Error("not found"), { statusCode: 404 });

    const result = await reconcilePendingGatewayUsage(repository, vi.fn().mockRejectedValue(unavailable));

    expect(result).toEqual({ inspected: 1, settled: 0, deferred: 1, failed: 0 });
    expect(repository.usageEvent.updateMany).not.toHaveBeenCalled();
  });

  it("does not count a concurrent or repeated settlement twice", async () => {
    const repository: GatewayUsageRepository = {
      usageEvent: {
        findMany: vi.fn().mockResolvedValue([{ id: "usage_1", externalUsageId: "gen_1" }]),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
    };

    const result = await reconcilePendingGatewayUsage(repository, vi.fn().mockResolvedValue(generation));

    expect(result).toEqual({ inspected: 1, settled: 0, deferred: 0, failed: 0 });
  });

  it("caps the customer debit and settles the matching reservation", async () => {
    const usageUpdate = vi.fn().mockResolvedValue({ count: 1 });
    const reservationUpdate = vi.fn().mockResolvedValue({ count: 1 });
    const repository: GatewayUsageRepository = {
      usageEvent: { findMany: vi.fn().mockResolvedValue([{ id: "usage_1", externalUsageId: "gen_1" }]), updateMany: usageUpdate },
      aIUsageReservation: {
        findUnique: vi.fn().mockResolvedValue({ id: "hold-1", organizationId: "org-1", reservedCents: 1 }),
        updateMany: reservationUpdate,
      },
    };
    await reconcilePendingGatewayUsage(repository, vi.fn().mockResolvedValue(generation));
    expect(usageUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ billedCents: 1 }) }));
    expect(reservationUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "settled", settledCents: 1 }) }));
  });
});
