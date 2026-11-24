import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ rate: vi.fn(), transaction: vi.fn(), create: vi.fn(), upsert: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: { usageEvent: { create: mocks.create, upsert: mocks.upsert }, $transaction: mocks.transaction } }));
vi.mock("../ensureProviderRate", () => ({ ensureProviderRate: mocks.rate }));
import { recordAIUsageEvent, recordReservedAIUsageEventV2 } from "../recordAIUsageEvent";
const input = { organizationId: "o", provider: "direct", model: "model", inputTokens: 10, outputTokens: 20 };
describe("reserved namespace and atomic V2 writer boundary", () => {
  beforeEach(() => vi.clearAllMocks());
  it("denies a generic caller's reserved attribution before any cost or ledger IO", async () => {
    const forged = { ...input, metadata: { axiomTestAllocationV2: { state: "settled" } } };
    expect(await recordAIUsageEvent(forged)).toMatchObject({ recorded: false, reason: "reserved_metadata" });
    expect(await recordReservedAIUsageEventV2(forged, "h")).toMatchObject({ recorded: false, reason: "reserved_metadata" });
    expect(mocks.rate).not.toHaveBeenCalled(); expect(mocks.create).not.toHaveBeenCalled(); expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it("does not acknowledge another workspace’s Gateway receipt", async () => {
    mocks.upsert.mockResolvedValue({
      id: "foreign-event", organizationId: "other", provider: "vercel_gateway",
      eventKind: "ai_invocation", externalUsageId: "gen_fixture", billingStatus: "pending",
      triggeredBy: null, correlationId: null, aiInvocationId: null, metadata: null,
    });
    expect(await recordAIUsageEvent({...input, provider: "vercel_gateway", externalUsageId: "gen_fixture"}))
      .toMatchObject({ recorded: false, usageEventId: null, reason: "persist_failed" });
  });
  it("retains a failed transactional outcome rather than independently writing or releasing usage", async () => {
    mocks.rate.mockResolvedValue({ provider: "direct", modelId: "model", inputCentsPerMillion: 1000000, outputCentsPerMillion: 1000000, cachedReadCentsPerMillion: 0 });
    mocks.transaction.mockRejectedValue(new Error("synthetic_commit_unknown"));
    expect(await recordReservedAIUsageEventV2(input, "h")).toMatchObject({ recorded: false, reason: "persist_failed", cost: { totalCents: 30 } });
    expect(mocks.transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: "Serializable" });
    expect(mocks.create).not.toHaveBeenCalled(); expect(mocks.upsert).not.toHaveBeenCalled();
  });
});
