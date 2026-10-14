import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  currentContext: vi.fn(), status: vi.fn(), generateText: vi.fn(), loadPolicy: vi.fn(), resolvePolicy: vi.fn(), checkCredits: vi.fn(),
  reserve: vi.fn(), release: vi.fn(), settle: vi.fn(), recordUsage: vi.fn(),
}));
vi.mock("@/lib/auth/currentContext", () => ({ currentContext: mocks.currentContext }));
vi.mock("@/lib/ai/AIProviderManager", () => ({ getAIProviderManager: () => ({ status: mocks.status, generateText: mocks.generateText }) }));
vi.mock("@/lib/ai/workspaceProviderPolicy", () => ({ loadWorkspaceAIProviderPolicyWithState: mocks.loadPolicy, resolveWorkspaceAIProviderPolicy: mocks.resolvePolicy }));
vi.mock("@/lib/billing/checkWorkspaceAICredits", () => ({ checkWorkspaceAICredits: mocks.checkCredits }));
vi.mock("@/lib/billing/aiCreditReservation", () => ({ reserveAICredits: mocks.reserve, releaseAICreditReservation: mocks.release, settleAICreditReservation: mocks.settle }));
vi.mock("@/lib/billing/recordAIUsageEvent", () => ({ recordAIUsageEvent: mocks.recordUsage }));
vi.mock("@/lib/db", () => ({ prisma: {} }));

function request(key = "request_abcdefghijkl") {
  return new NextRequest("https://visionxixlabs.com/api/ai/generate", { method: "POST", headers: { "content-type": "application/json", "idempotency-key": key }, body: JSON.stringify({ prompt: "Summarize this", maxTokens: 20 }) });
}

describe("POST /api/ai/generate reservation boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.currentContext.mockResolvedValue({ isAuthenticated: true, organizationId: "org-1", userId: "user-1" });
    mocks.status.mockReturnValue([{ provider: "vercel_gateway", configured: true }]);
    mocks.loadPolicy.mockResolvedValue({ storageState: "ready", policy: {} });
    mocks.resolvePolicy.mockReturnValue({ enabled: true, allowedProviders: ["vercel_gateway"], modelSelections: {}, fallbackOrder: [] });
    mocks.checkCredits.mockResolvedValue({ kind: "allow" });
    mocks.reserve.mockResolvedValue({ ok: true, reused: false, reservation: { id: "hold-1" } });
    mocks.generateText.mockResolvedValue({ text: "ok", provider: "other", model: "model", usage: { promptTokens: 1, completionTokens: 1 } });
    mocks.recordUsage.mockResolvedValue({ recorded: true, usageEventId: "usage-1", cost: { totalCents: 10 } });
    mocks.settle.mockResolvedValue(true);
  });

  it("reserves before generation and settles measured usage", async () => {
    const { POST } = await import("../route");
    expect((await POST(request())).status).toBe(200);
    expect(mocks.reserve).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ organizationId: "org-1", reservedCents: 1000 }));
    expect(mocks.settle).toHaveBeenCalledWith(expect.anything(), "org-1", "hold-1", 10, "usage-1");
  });

  it("keeps the hold when Gateway settlement is still pending", async () => {
    mocks.recordUsage.mockResolvedValue({ recorded: true, usageEventId: "usage-1", cost: null, pendingSettlement: true });
    const { POST } = await import("../route");
    expect((await POST(request())).status).toBe(200);
    expect(mocks.settle).not.toHaveBeenCalled();
    expect(mocks.release).not.toHaveBeenCalled();
  });

  it("does not call a provider when the pool cannot reserve the request", async () => {
    mocks.reserve.mockResolvedValue({ ok: false, error: "ai_credit_pool_exhausted" });
    const { POST } = await import("../route");
    expect((await POST(request())).status).toBe(403);
    expect(mocks.generateText).not.toHaveBeenCalled();
  });

  it("releases the hold when generation fails", async () => {
    mocks.generateText.mockRejectedValue(new Error("provider timeout"));
    const { POST } = await import("../route");
    expect((await POST(request())).status).toBeGreaterThanOrEqual(400);
    expect(mocks.release).toHaveBeenCalledWith(expect.anything(), "org-1", "hold-1");
  });

  it("requires a stable request key before a provider call", async () => {
    const { POST } = await import("../route");
    expect((await POST(request("short"))).status).toBe(400);
    expect(mocks.reserve).not.toHaveBeenCalled();
    expect(mocks.generateText).not.toHaveBeenCalled();
  });
});
