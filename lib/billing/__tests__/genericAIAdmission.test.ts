import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ reserve: vi.fn(), legacyClaim: vi.fn(), v2Claim: vi.fn(), release: vi.fn(), deny: vi.fn(), write: vi.fn(), v2Write: vi.fn(), transaction: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: { $transaction: m.transaction } }));
vi.mock("../aiCreditReservation", () => ({ reserveAICredits: m.reserve, claimLegacyAICreditDispatch: m.legacyClaim, releaseAICreditReservation: m.release }));
vi.mock("../recordAIUsageEvent", () => ({ recordAIUsageEvent: m.write, recordReservedAIUsageEventV2: m.v2Write }));
vi.mock("../newTestSubscription/usageAllocationIO", () => ({ claimNewTestBillableDispatch: m.v2Claim }));
vi.mock("../isolatedApplication/runtime", () => ({ denyIsolatedExternalIO: m.deny }));
import { admitAIText, admitGovernedExtract, consumeGovernedTextAdmission, consumeGovernedExtractAdmission } from "../governedExtractAdmission";

const scope = { organizationId: "org", userId: "actor", correlationId: "correlation" };
const key = "public_request_key_123456";
const response = { provider: "vercel_gateway", model: "provider/model", gatewayGenerationId: "generation", usage: { promptTokens: 1, completionTokens: 2 } } as const;
describe("shared generic text admission kernel", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    m.reserve.mockResolvedValue({ ok: true, reused: false, reservation: { id: "hold" } });
    m.legacyClaim.mockResolvedValue(true); m.v2Claim.mockResolvedValue(true);
    m.transaction.mockImplementation(async fn => fn({
      $queryRawUnsafe: async () => [{ id: "hold", organizationId: "org", status: "dispatch_unknown", usageEventId: null }],
      usageEvent: { findUnique: async () => null }, aIUsageReservation: { updateMany: async () => ({ count: 1 }) },
    }));
    m.write.mockResolvedValue({ recorded: true, usageEventId: "usage" });
    m.v2Write.mockResolvedValue({ recorded: true, usageEventId: "usage" });
  });
  it("retains the public request key and returns an opaque task-bound one-use handle", async () => {
    const admitted = await admitAIText({ ...scope, idempotencyKey: key });
    if (!admitted.ok) throw new Error("expected admission");
    expect(m.reserve).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ organizationId: "org", idempotencyKey: key, correlationId: "correlation" }));
    expect(m.legacyClaim).toHaveBeenCalledWith(expect.anything(), scope, "hold");
    const authority = consumeGovernedTextAdmission(admitted.admission, scope);
    await authority.record(response);
    expect(m.write).toHaveBeenCalledWith(expect.objectContaining({ metadata: { route: "api/ai/generate" }, triggeredBy: "actor" }), expect.anything());
    expect(() => consumeGovernedTextAdmission(admitted.admission, scope)).toThrow();
  });
  it.each(["ai_credit_pool_exhausted", "ai_credit_reservation_unavailable", "idempotency_key_conflict"])("preserves reservation failure %s without claiming", async error => {
    m.reserve.mockResolvedValue({ ok: false, error });
    await expect(admitAIText({ ...scope, idempotencyKey: key })).resolves.toEqual({ ok: false, error });
    expect(m.legacyClaim).not.toHaveBeenCalled(); expect(m.v2Claim).not.toHaveBeenCalled(); expect(m.deny).not.toHaveBeenCalled();
  });
  it("denies reused holds before the isolated guard or a claim", async () => {
    m.reserve.mockResolvedValue({ ok: true, reused: true, reservation: { id: "hold" } });
    await expect(admitAIText({ ...scope, idempotencyKey: key })).resolves.toEqual({ ok: false, error: "request_already_reserved" });
    expect(m.deny).not.toHaveBeenCalled(); expect(m.legacyClaim).not.toHaveBeenCalled();
  });
  it.each([false, true])("isolated denial precedes legacy/v2 claim and releases only the unclaimed hold (v2=%s)", async v2 => {
    m.reserve.mockResolvedValue({ ok: true, reused: false, reservation: { id: "hold" }, ...(v2 ? { allocationPolicy: "axiom_test_anniversary_v2" } : {}) });
    m.deny.mockImplementation(() => { throw new Error("isolated_provider_io_disabled"); });
    await expect(admitAIText({ ...scope, idempotencyKey: key })).rejects.toThrow("isolated_provider_io_disabled");
    expect(m.release).toHaveBeenCalledWith(expect.anything(), "org", "hold");
    expect(m.legacyClaim).not.toHaveBeenCalled(); expect(m.v2Claim).not.toHaveBeenCalled();
  });
  it.each([false, true])("claim/write failure retains legacy/v2 uncertainty (v2=%s)", async v2 => {
    m.reserve.mockResolvedValue({ ok: true, reused: false, reservation: { id: "hold" }, ...(v2 ? { allocationPolicy: "axiom_test_anniversary_v2" } : {}) });
    const admitted = await admitAIText({ ...scope, idempotencyKey: key });
    if (!admitted.ok) throw new Error("expected admission");
    m.write.mockResolvedValue({ recorded: false }); m.v2Write.mockResolvedValue({ recorded: false });
    await expect(consumeGovernedTextAdmission(admitted.admission, scope).record(response)).rejects.toThrow();
    expect(m.release).not.toHaveBeenCalled();
    if (v2) { expect(m.write).not.toHaveBeenCalled(); expect(m.v2Claim).toHaveBeenCalledOnce(); }
    else { expect(m.v2Write).not.toHaveBeenCalled(); expect(m.legacyClaim).toHaveBeenCalledOnce(); }
  });
  it("extract and generic text authority cannot cross lanes even with identical scope", async () => {
    const text = await admitAIText({ ...scope, idempotencyKey: key });
    if (!text.ok) throw new Error("expected admission");
    expect(() => consumeGovernedExtractAdmission(text.admission, scope)).toThrow();
    expect(() => consumeGovernedTextAdmission(text.admission, scope)).toThrow();
    const extract = await admitGovernedExtract(scope);
    expect(() => consumeGovernedTextAdmission(extract, scope)).toThrow();
    expect(() => consumeGovernedExtractAdmission(extract, scope)).toThrow();
  });
});
