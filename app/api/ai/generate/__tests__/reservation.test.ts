import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  currentContext: vi.fn(), status: vi.fn(), generateText: vi.fn(), generateAdmitted: vi.fn(), loadPolicy: vi.fn(), resolvePolicy: vi.fn(), checkCredits: vi.fn(),
  reserve: vi.fn(), release: vi.fn(), recordUsage: vi.fn(), transaction: vi.fn(), claim: vi.fn(), legacyClaim: vi.fn(), recordReserved: vi.fn(), link: vi.fn(), lookupGeneration: vi.fn(), deny: vi.fn(),
}));
vi.mock("@/lib/auth/currentContext", () => ({ currentContext: mocks.currentContext }));
vi.mock("@/lib/ai/AIProviderManager", () => ({ getAIProviderManager: () => ({ status: mocks.status, generateTextWithAdmission: mocks.generateAdmitted }) }));
vi.mock("@/lib/ai/workspaceProviderPolicy", () => ({ loadWorkspaceAIProviderPolicyWithState: mocks.loadPolicy, resolveWorkspaceAIProviderPolicy: mocks.resolvePolicy }));
vi.mock("@/lib/billing/checkWorkspaceAICredits", () => ({ checkWorkspaceAICredits: mocks.checkCredits }));
vi.mock("@/lib/billing/aiCreditReservation", () => ({ reserveAICredits: mocks.reserve, releaseAICreditReservation: mocks.release, claimLegacyAICreditDispatch: mocks.legacyClaim }));
vi.mock("@/lib/billing/recordAIUsageEvent", () => ({ recordAIUsageEvent: mocks.recordUsage, recordReservedAIUsageEventV2: mocks.recordReserved }));
vi.mock("@/lib/billing/newTestSubscription/usageAllocationIO", () => ({ claimNewTestBillableDispatch: mocks.claim }));
vi.mock("@/lib/billing/isolatedApplication/runtime", () => ({ denyIsolatedExternalIO: mocks.deny, isolatedRuntimeRequested: () => false }));
vi.mock("@/lib/db", () => ({ prisma: { $transaction: mocks.transaction } }));

import { consumeGovernedTextAdmission } from "@/lib/billing/governedExtractAdmission";

function request(key = "request_abcdefghijkl", body: Record<string, unknown> = { prompt: "Summarize this", maxTokens: 20 }) {
  return new NextRequest("https://visionxixlabs.com/api/ai/generate", { method: "POST", headers: { "content-type": "application/json", "idempotency-key": key, "x-correlation-id": "request-correlation" }, body: JSON.stringify(body) });
}
const envelope = { text: "ok", provider: "vercel_gateway", model: "provider/model", usage: { promptTokens: 1, completionTokens: 1 }, gatewayGenerationId: "gen-1" };

describe("POST /api/ai/generate reservation boundary", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.currentContext.mockResolvedValue({ isAuthenticated: true, organizationId: "org-1", userId: "user-1" });
    mocks.status.mockReturnValue([{ provider: "vercel_gateway", configured: true }]);
    mocks.loadPolicy.mockResolvedValue({ storageState: "ready", policy: {} });
    mocks.resolvePolicy.mockReturnValue({ enabled: true, allowedProviders: ["vercel_gateway"], modelSelections: {}, fallbackOrder: [] });
    mocks.checkCredits.mockResolvedValue({ kind: "allow" });
    mocks.reserve.mockResolvedValue({ ok: true, reused: false, reservation: { id: "hold-1" } });
    mocks.generateText.mockResolvedValue(envelope);
    // Use the actual capability consumer/producer boundary with a synthetic
    // provider envelope. Actual manager/SDK retry restrictions have their own
    // inert tests; this route test never calls a provider or database.
    mocks.generateAdmitted.mockImplementation(async (prompt, options, admission) => {
      const authority = consumeGovernedTextAdmission(admission, options);
      const result = await mocks.generateText(prompt, options);
      await authority.record(result);
      return result;
    });
    mocks.recordUsage.mockResolvedValue({ recorded: true, usageEventId: "usage-1", cost: null, pendingSettlement: true });
    mocks.recordReserved.mockResolvedValue({ recorded: true, usageEventId: "usage-1", cost: null, pendingSettlement: true });
    mocks.claim.mockResolvedValue(true); mocks.legacyClaim.mockResolvedValue(true);
    mocks.link.mockResolvedValue({ count: 1 }); mocks.lookupGeneration.mockResolvedValue(null);
    mocks.transaction.mockImplementation(async callback => callback({
      $queryRawUnsafe: async () => [{ id: "hold-1", organizationId: "org-1", status: "dispatch_unknown", usageEventId: null }],
      usageEvent: { findUnique: mocks.lookupGeneration }, aIUsageReservation: { updateMany: mocks.link },
    }));
  });

  it("preserves the response, correlation, header key and trusted actor while reserving/claiming before generation", async () => {
    const { POST } = await import("../route");
    const response = await POST(request("request_abcdefghijkl", { prompt: "Summarize this", maxTokens: 20, organizationId: "foreign", userId: "forged" }));
    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual(envelope);
    expect(response.headers.get("x-correlation-id")).toBe("request-correlation");
    expect(mocks.reserve).toHaveBeenCalledOnce();
    expect(mocks.reserve).toHaveBeenCalledWith(expect.anything(), { organizationId: "org-1", idempotencyKey: "request_abcdefghijkl", reservedCents: 1000, correlationId: "request-correlation" });
    expect(mocks.legacyClaim).toHaveBeenCalledWith(expect.anything(), { organizationId: "org-1", userId: "user-1", correlationId: "request-correlation" }, "hold-1");
    expect(mocks.legacyClaim.mock.invocationCallOrder[0]).toBeLessThan(mocks.generateText.mock.invocationCallOrder[0]);
    expect(mocks.recordUsage).toHaveBeenCalledOnce();
    expect(mocks.recordUsage).toHaveBeenCalledWith(expect.objectContaining({ organizationId: "org-1", triggeredBy: "user-1", metadata: { route: "api/ai/generate" } }), expect.anything());
    expect(mocks.release).not.toHaveBeenCalled();
  });
  it("uses bounded4096 output by default and retains pending Gateway capacity", async () => {
    const { POST } = await import("../route");
    expect((await POST(request("request_abcdefghijkl", { prompt: "Summarize this" }))).status).toBe(200);
    expect(mocks.generateText).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ maxTokens: 4096 }));
    expect(mocks.link).toHaveBeenCalledWith({ where: { id: "hold-1", organizationId: "org-1", status: "dispatch_unknown", usageEventId: null }, data: { status: "pending_settlement", usageEventId: "usage-1" } });
    expect(mocks.recordReserved).not.toHaveBeenCalled(); expect(mocks.release).not.toHaveBeenCalled();
  });
  it.each(["sdk", "missing_usage", "missing_generation", "writer", "link", "foreign_generation"])("retains claimed legacy uncertainty on %s", async kind => {
    if (kind === "sdk") mocks.generateText.mockRejectedValue(new Error("provider timeout"));
    if (kind === "missing_usage") mocks.generateText.mockResolvedValue({ ...envelope, usage: undefined });
    if (kind === "missing_generation") mocks.generateText.mockResolvedValue({ ...envelope, gatewayGenerationId: undefined });
    if (kind === "writer") mocks.recordUsage.mockResolvedValue({ recorded: false });
    if (kind === "link") mocks.link.mockResolvedValue({ count: 0 });
    if (kind === "foreign_generation") mocks.lookupGeneration.mockResolvedValue({ id: "foreign-usage", organizationId: "foreign" });
    const { POST } = await import("../route");
    expect((await POST(request())).status).toBeGreaterThanOrEqual(400);
    expect(mocks.release).not.toHaveBeenCalled(); expect(mocks.generateText).toHaveBeenCalledOnce();
  });
  it("does not call a provider when the pool cannot reserve the request", async () => {
    mocks.reserve.mockResolvedValue({ ok: false, error: "ai_credit_pool_exhausted" });
    const { POST } = await import("../route"); const response = await POST(request());
    expect(response.status).toBe(422); expect((await response.json()).error.code).toBe("ai.credit_pool_exhausted");
    expect(mocks.generateAdmitted).not.toHaveBeenCalled(); expect(mocks.legacyClaim).not.toHaveBeenCalled();
  });
  it("retains the existing reused-key error with zero dispatch", async () => {
    mocks.reserve.mockResolvedValue({ ok: true, reused: true, reservation: { id: "hold-1", status: "dispatch_unknown" } });
    const { POST } = await import("../route"); const response = await POST(request());
    expect(response.status).toBe(422); expect((await response.json()).error.code).toBe("ai.request_already_in_progress");
    expect(mocks.generateAdmitted).not.toHaveBeenCalled(); expect(mocks.legacyClaim).not.toHaveBeenCalled(); expect(mocks.claim).not.toHaveBeenCalled();
  });
  it.each(["idempotency_key_conflict", "ai_credit_reservation_unavailable"])("retains budget-unavailable public errors for %s", async error => {
    mocks.reserve.mockResolvedValue({ ok: false, error });
    const { POST } = await import("../route"); const response = await POST(request());
    expect(response.status).toBeGreaterThanOrEqual(400); expect((await response.json()).error.code).toBe("ai.credit_reservation_unavailable");
    expect(mocks.generateAdmitted).not.toHaveBeenCalled();
  });
  it.each([
    { only: "unavailable_provider" }, { only: "vercel_gateway", model: "unsupported-model" }, { maxTokens: 4097 }, { temperature: 3 }, { prompt: "" }, { system: "x".repeat(8001) },
  ])("validates input/provider/model before any reservation: %j", async invalid => {
    const { POST } = await import("../route");
    expect((await POST(request("request_abcdefghijkl", { prompt: "Summarize this", ...invalid }))).status).toBe(400);
    expect(mocks.reserve).not.toHaveBeenCalled(); expect(mocks.generateAdmitted).not.toHaveBeenCalled();
  });
  it.each([false, true])("awaits a committed legacy/v2 claim before provider work (v2=%s)", async v2 => {
    mocks.reserve.mockResolvedValue({ ok: true, reused: false, ...(v2 ? { allocationPolicy: "axiom_test_anniversary_v2" } : {}), reservation: { id: "hold-1" } });
    let committed = false;
    const originalTransaction = mocks.transaction.getMockImplementation()!;
    mocks.transaction.mockImplementation(async callback => { const result = await originalTransaction(callback); committed = true; return result; });
    mocks.generateText.mockImplementation(async () => { expect(committed).toBe(true); return envelope; });
    const { POST } = await import("../route"); expect((await POST(request())).status).toBe(200);
    if (v2) { expect(mocks.claim).toHaveBeenCalledOnce(); expect(mocks.recordReserved).toHaveBeenCalledWith(expect.objectContaining({ organizationId: "org-1" }), "hold-1"); expect(mocks.recordUsage).not.toHaveBeenCalled(); expect(mocks.legacyClaim).not.toHaveBeenCalled(); }
    else { expect(mocks.legacyClaim).toHaveBeenCalledOnce(); expect(mocks.claim).not.toHaveBeenCalled(); expect(mocks.recordReserved).not.toHaveBeenCalled(); }
  });
  it.each([false, true])("denies dispatch when the final legacy/v2 claim cannot commit (v2=%s)", async v2 => {
    mocks.reserve.mockResolvedValue({ ok: true, reused: false, ...(v2 ? { allocationPolicy: "axiom_test_anniversary_v2" } : {}), reservation: { id: "hold-1" } });
    mocks.claim.mockResolvedValue(false); mocks.legacyClaim.mockResolvedValue(false);
    const { POST } = await import("../route"); expect((await POST(request())).status).toBeGreaterThanOrEqual(400);
    expect(mocks.generateAdmitted).not.toHaveBeenCalled(); expect(mocks.recordReserved).not.toHaveBeenCalled(); expect(mocks.recordUsage).not.toHaveBeenCalled();
  });
  it.each(["sdk", "usage", "writer"])("retains v2 unknown dispatch on %s failure", async kind => {
    mocks.reserve.mockResolvedValue({ ok: true, reused: false, allocationPolicy: "axiom_test_anniversary_v2", reservation: { id: "hold-1" } });
    if (kind === "sdk") mocks.generateText.mockRejectedValue(new Error("unknown outcome"));
    if (kind === "usage") mocks.generateText.mockResolvedValue({ ...envelope, usage: {} });
    if (kind === "writer") mocks.recordReserved.mockResolvedValue({ recorded: false });
    const { POST } = await import("../route"); expect((await POST(request())).status).toBeGreaterThanOrEqual(400);
    expect(mocks.release).not.toHaveBeenCalled(); expect(mocks.recordUsage).not.toHaveBeenCalled();
  });
  it.each([false, true])("isolated denial remains before legacy/v2 claim and provider, releasing only unclaimed hold (v2=%s)", async v2 => {
    mocks.reserve.mockResolvedValue({ ok: true, reused: false, ...(v2 ? { allocationPolicy: "axiom_test_anniversary_v2" } : {}), reservation: { id: "hold-1" } });
    mocks.deny.mockImplementation(() => { throw new Error("isolated_provider_io_disabled"); });
    const { POST } = await import("../route"); expect((await POST(request())).status).toBeGreaterThanOrEqual(400);
    expect(mocks.release).toHaveBeenCalledWith(expect.anything(), "org-1", "hold-1");
    expect(mocks.claim).not.toHaveBeenCalled(); expect(mocks.legacyClaim).not.toHaveBeenCalled(); expect(mocks.generateAdmitted).not.toHaveBeenCalled();
  });
  it("requires a stable request key before a provider call", async () => {
    const { POST } = await import("../route");
    expect((await POST(request("short"))).status).toBe(400);
    expect(mocks.reserve).not.toHaveBeenCalled(); expect(mocks.generateAdmitted).not.toHaveBeenCalled();
  });
  it("treats a missing trusted actor as authentication-required before any reservation", async () => {
    mocks.currentContext.mockResolvedValue({ isAuthenticated: true, organizationId: "org-1" });
    const { POST } = await import("../route"); const response = await POST(request());
    expect(response.status).toBe(400); expect((await response.json()).error.code).toBe("auth.required");
    expect(mocks.reserve).not.toHaveBeenCalled(); expect(mocks.generateAdmitted).not.toHaveBeenCalled();
  });
});
