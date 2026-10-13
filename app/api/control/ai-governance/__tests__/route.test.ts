import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  currentContext: vi.fn(),
  isAdminOrOwner: vi.fn(),
  recordAudit: vi.fn(),
  loadPolicy: vi.fn(),
  savePolicy: vi.fn(),
  readIdentity: vi.fn(),
  saveIdentity: vi.fn(),
  readCharter: vi.fn(),
  upsertCharter: vi.fn(),
  loadBudget: vi.fn(),
  upsertBudget: vi.fn(),
  loadModels: vi.fn(),
}));

vi.mock("@/lib/auth/currentContext", () => ({ currentContext: mocks.currentContext }));
vi.mock("@/lib/auth/platformAdmin", () => ({ isAdminOrOwner: mocks.isAdminOrOwner }));
vi.mock("@/lib/audit/secureAudit", () => ({ record: mocks.recordAudit }));
vi.mock("@/lib/ai/AIProviderManager", () => ({ getAIProviderManager: () => ({ status: () => [{ provider: "vercel_gateway", configured: true }] }) }));
vi.mock("@/lib/ai/gatewayModelCatalog", () => ({ loadGatewayModelCatalog: mocks.loadModels }));
vi.mock("@/lib/ai/workspaceProviderPolicy", async (original) => {
  const actual = await original<typeof import("@/lib/ai/workspaceProviderPolicy")>();
  return { ...actual, loadWorkspaceAIProviderPolicyWithState: mocks.loadPolicy, saveWorkspaceAIProviderPolicy: mocks.savePolicy };
});
vi.mock("@/lib/axiom/agentRuntime/agentIdentityPolicy", async (original) => {
  const actual = await original<typeof import("@/lib/axiom/agentRuntime/agentIdentityPolicy")>();
  return { ...actual, readWorkspaceAgentIdentity: mocks.readIdentity, saveWorkspaceAgentIdentity: mocks.saveIdentity };
});
vi.mock("@/lib/autonomy/tenantCharterStore", () => ({ readTenantCharter: mocks.readCharter, upsertTenantCharter: mocks.upsertCharter }));
vi.mock("@/lib/workforce/pipelines/budgetConfigStore", () => ({ loadBudgetConfig: mocks.loadBudget, upsertBudgetConfig: mocks.upsertBudget }));

const session = { isAuthenticated: true, organizationId: "org-session", userId: "user-1", email: "owner@example.com", roles: ["owner"] };

function request(body: object, origin = "https://visionxixlabs.com") {
  return new NextRequest("https://visionxixlabs.com/api/control/ai-governance", {
    method: "PATCH",
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("/api/control/ai-governance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.currentContext.mockResolvedValue(session);
    mocks.isAdminOrOwner.mockReturnValue(true);
    mocks.loadPolicy.mockResolvedValue({ storageState: "ready", policy: null });
    mocks.readIdentity.mockResolvedValue(null);
    mocks.readCharter.mockResolvedValue(null);
    mocks.loadBudget.mockResolvedValue(null);
    mocks.loadModels.mockResolvedValue([{ id: "openai/gpt-5", label: "GPT-5", tier: "preferred" }]);
    mocks.saveIdentity.mockImplementation(async (value) => ({ ...value, updatedAt: "2026-10-13T00:00:00.000Z" }));
  });

  it("returns verified state without leaking an autonomy webhook override", async () => {
    mocks.readCharter.mockResolvedValue({
      mode: "observer", perCycleActionLimit: 1, rationale: "safe", updatedAt: "2026-10-13T00:00:00.000Z",
      slackWebhookOverride: "https://hooks.slack.test/secret", resolved: { mode: "observer", perCycleActionLimit: 1 },
    });
    const { GET } = await import("../route");
    const response = await GET();
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(JSON.stringify(payload)).not.toContain("hooks.slack");
    expect(payload.data.gatewayCatalogLive).toBe(true);
  });

  it("rejects cross-origin mutations before authorization or persistence", async () => {
    const { PATCH } = await import("../route");
    const response = await PATCH(request({ section: "agent_identity" }, "https://evil.example"));
    expect(response.status).toBe(403);
    expect(mocks.saveIdentity).not.toHaveBeenCalled();
  });

  it("requires owner or admin authority", async () => {
    mocks.isAdminOrOwner.mockReturnValue(false);
    const { PATCH } = await import("../route");
    const response = await PATCH(request({ section: "agent_identity", displayName: "Axiom", enabled: true, allowedTools: ["list_environments"] }));
    expect(response.status).toBe(403);
    expect(mocks.saveIdentity).not.toHaveBeenCalled();
  });

  it("derives the organization from the authenticated session", async () => {
    const { PATCH } = await import("../route");
    const response = await PATCH(request({
      section: "agent_identity", organizationId: "org-attacker", displayName: "Release Agent", enabled: true, allowedTools: ["list_environments"],
    }));
    expect(response.status).toBe(200);
    expect(mocks.saveIdentity).toHaveBeenCalledWith(expect.objectContaining({ organizationId: "org-session", updatedBy: "user-1" }));
    expect(mocks.recordAudit).toHaveBeenCalled();
  });
});
