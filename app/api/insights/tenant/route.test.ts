import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "./route";

const m = vi.hoisted(() => ({ context: vi.fn(), proposals: vi.fn(), admit: vi.fn(), dispatch: vi.fn() }));
vi.mock("@/lib/auth/currentContext", () => ({ currentContext: m.context }));
vi.mock("@/lib/db", () => ({ prisma: {
  methodProposal: { findMany: m.proposals },
  autonomyDecisionRationale: { count: async () => 2 },
  outboundNotificationRecord: { findMany: async () => [] },
  agentBusMessage: { count: async () => 0 },
} }));
vi.mock("@/lib/billing/governedExtractAdmission", () => ({ admitAIText: m.admit }));
vi.mock("@/lib/ai/AIProviderManager", () => ({
  getAIProviderManager: () => ({
    status: () => [{ provider: "vercel_gateway", configured: true, defaultModel: "openai/gpt-4o-mini" }],
    generateTextWithAdmission: m.dispatch,
  }),
}));
vi.mock("@/lib/ai/workspaceProviderPolicy", () => ({
  loadWorkspaceAIProviderPolicyWithState: async () => ({ storageState: "ready" }),
  resolveWorkspaceAIProviderPolicy: () => ({ enabled: true, allowedProviders: ["vercel_gateway"], modelSelections: {} }),
}));

const origin = "https://workspace.example.test";
function request(method = "GET", headers: HeadersInit = {}) {
  return new NextRequest(`${origin}/api/insights/tenant?days=7&organizationId=other`, { method, headers });
}
const headers = { origin, "idempotency-key": "tenant-insights-key-123" };

describe("Tenant Insights", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    m.context.mockResolvedValue({ isAuthenticated: true, organizationId: "scope", userId: "actor" });
    m.proposals.mockResolvedValue([{ status: "approved", authorAgent: "fixture" }]);
  });

  it("loads metrics without reserving or dispatching AI on GET", async () => {
    const response = await GET(request());
    expect(await response.json()).toMatchObject({ data: {
      seed: { tenantId: "scope", proposalsApproved: 1 },
      narrative: { status: "metrics", aiUsed: false },
    } });
    expect(m.admit).not.toHaveBeenCalled();
    expect(m.dispatch).not.toHaveBeenCalled();
  });

  it.each([
    [{ ...headers, origin: "https://other.example.test" }, 403],
    [{ origin }, 400],
  ])("rejects invalid POST authorization evidence before reading metrics (%j)", async (invalidHeaders, status) => {
    expect((await POST(request("POST", invalidHeaders as HeadersInit))).status).toBe(status);
    expect(m.proposals).not.toHaveBeenCalled();
    expect(m.admit).not.toHaveBeenCalled();
  });

  it.each([
    ["ai_workspace_budget_exceeded", "budget_exceeded"],
    ["ai_credit_pool_exhausted", "credits_exhausted"],
    ["request_already_reserved", "already_requested"],
  ])("retains metrics after %s without dispatch", async (error, status) => {
    m.admit.mockResolvedValue({ ok: false, error });
    const response = await POST(request("POST", headers));
    expect(await response.json()).toMatchObject({ data: { seed: { proposalsApproved: 1 }, narrative: { status, aiUsed: false } } });
    expect(m.admit).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      organizationId: "scope", userId: "actor", idempotencyKey: "tenant_insights_tenant-insights-key-123",
    }), expect.objectContaining({ prompt: expect.stringContaining("Proposals approved: 1") }));
    expect(m.dispatch).not.toHaveBeenCalled();
  });

  it("uses the admitted Gateway once and sends no workspace or agent identifier in the prompt", async () => {
    m.admit.mockResolvedValue({ ok: true, admission: "fixture-admission" });
    m.dispatch.mockResolvedValue({ text: "Recorded activity increased.", provider: "vercel_gateway", model: "openai/gpt-4o-mini", latencyMs: 10 });
    const response = await POST(request("POST", headers));
    expect(await response.json()).toMatchObject({ data: { narrative: { status: "generated", aiUsed: true } } });
    expect(m.dispatch).toHaveBeenCalledExactlyOnceWith(expect.any(String), expect.objectContaining({ organizationId: "scope", maxTokens: 512 }), "fixture-admission");
    expect(m.dispatch.mock.calls[0][0]).not.toMatch(/scope|fixture|other/);
  });
});
