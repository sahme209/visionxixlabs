import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ admin: vi.fn(), context: vi.fn(), session: vi.fn(), catalog: vi.fn(), save: vi.fn(), audit: vi.fn() }));
vi.mock("@/lib/governance/intelligence/enrolledRefusal", () => ({ workspaceUnenrolled: async () => true }));
vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("@/lib/auth/currentContext", () => ({ currentContext: mocks.context }));
vi.mock("@/lib/auth/platformAdmin", () => ({ isAdminOrOwner: mocks.admin }));
vi.mock("@/lib/desktop/resolveRequestDesktopSession", () => ({ resolveRequestDesktopSession: mocks.session }));
vi.mock("@/lib/ai/AIProviderManager", () => ({ getAIProviderManager: () => ({ status: () => [{ provider: "vercel_gateway", configured: true }] }) }));
vi.mock("@/lib/ai/gatewayModelCatalog", async original => ({ ...await original<typeof import("@/lib/ai/gatewayModelCatalog")>(), loadGatewayModelCatalog: mocks.catalog }));
vi.mock("@/lib/ai/workspaceProviderPolicy", async original => ({ ...await original<typeof import("@/lib/ai/workspaceProviderPolicy")>(), saveWorkspaceAIProviderPolicy: mocks.save, loadWorkspaceAIProviderPolicyWithState: async () => ({ storageState: "ready", policy: null }) }));
vi.mock("@/lib/audit/secureAudit", () => ({ record: mocks.audit }));
vi.mock("@/lib/audit/requiredAudit", () => ({ recordRequiredAudit: mocks.audit }));
vi.mock("@/lib/releaseops/auditEventResponder", () => ({ appendAuditEvent: mocks.audit }));
vi.mock("@/lib/axiom/agentRuntime/agentIdentityPolicy", () => ({ agentToolCatalog: vi.fn(), normalizeAgentIdentityInput: vi.fn(), readWorkspaceAgentIdentity: vi.fn(), saveWorkspaceAgentIdentity: vi.fn() }));
vi.mock("@/lib/autonomy/tenantCharterStore", () => ({ readTenantCharter: vi.fn(), upsertTenantCharter: vi.fn() }));
vi.mock("@/lib/workforce/pipelines/budgetConfigStore", () => ({ loadBudgetConfig: vi.fn(), upsertBudgetConfig: vi.fn() }));
import { GET as accountGet, PUT as account } from "@/app/api/account/ai-policy/route";
import { PUT as desktop } from "@/app/api/desktop/ai-providers/route";
import { PATCH as control } from "@/app/api/control/ai-governance/route";
const selection = { version: 1, defaultModelId: "xai/grok-4", approvedModelIds: ["xai/grok-4", "openai/gpt-4o"] };
const body = () => ({ section: "provider_policy", organizationId: "attacker", enabled: true, allowedProviders: ["vercel_gateway"], modelSelections: { vercel_gateway: selection }, fallbackOrder: ["vercel_gateway"] });
beforeEach(() => {
  vi.resetAllMocks(); mocks.admin.mockReturnValue(true);
  mocks.context.mockResolvedValue({ isAuthenticated: true, organizationId: "org-session", userId: "owner", roles: ["owner"] });
  mocks.session.mockResolvedValue({ organizationId: "org-session", userId: "owner" });
  mocks.catalog.mockResolvedValue(selection.approvedModelIds.map(id => ({ id, label: id, tier: "balanced" })));
  mocks.save.mockResolvedValue(undefined); mocks.audit.mockResolvedValue(undefined);
});
for (const [name, handler, method, path] of [
  ["account", account, "PUT", "/api/account/ai-policy"],
  ["desktop", desktop, "PUT", "/api/desktop/ai-providers"],
  ["control", control, "PATCH", "/api/control/ai-governance"],
] as const) describe(`${name} approved Gateway writes`, () => {
  const request = (payload: unknown = body()) => new NextRequest(`https://visionxixlabs.com${path}`, { method, headers: { origin: "https://visionxixlabs.com", "content-type": "application/json" }, body: JSON.stringify(payload) });
  it("checks every approved model and saves only for the authenticated tenant", async () => {
    const response = await handler(request()); expect(response.status).toBe(200);
    expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({ organizationId: "org-session", updatedBy: "owner", policy: expect.objectContaining({ gatewaySelection: selection, modelSelections: { vercel_gateway: selection.defaultModelId } }) }));
    expect(mocks.audit).toHaveBeenCalled();
  });
  it("round-trips the normalized GET policy shape without erasing approvals", async () => {
    const payload = { ...body(), modelSelections: { vercel_gateway: selection.defaultModelId }, gatewaySelection: selection };
    expect((await handler(request(payload))).status).toBe(200);
    expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({ policy: expect.objectContaining({ gatewaySelection: selection }) }));
  });
  it("rejects inconsistent normalized metadata before catalog or persistence", async () => {
    const payload = { ...body(), modelSelections: { vercel_gateway: "openai/gpt-4o" }, gatewaySelection: selection };
    expect((await handler(request(payload))).status).toBe(422);
    expect(mocks.catalog).not.toHaveBeenCalled(); expect(mocks.save).not.toHaveBeenCalled();
  });
  it("rejects a missing secondary model even when the default is available", async () => {
    mocks.catalog.mockResolvedValue([{ id: selection.defaultModelId }]);
    expect((await handler(request())).status).toBe(422); expect(mocks.save).not.toHaveBeenCalled(); expect(mocks.audit).not.toHaveBeenCalled();
  });
  it("fails closed on catalog outage before saving", async () => {
    mocks.catalog.mockRejectedValue(new Error("unavailable"));
    expect((await handler(request())).status).toBe(503); expect(mocks.save).not.toHaveBeenCalled();
  });
  it("refuses a member before catalog or persistence", async () => {
    mocks.admin.mockReturnValue(false); mocks.session.mockResolvedValue(null);
    expect((await handler(request())).status).toBe(403); expect(mocks.catalog).not.toHaveBeenCalled(); expect(mocks.save).not.toHaveBeenCalled();
  });
  it("rejects an unapproved default before catalog access", async () => {
    const payload = body(); payload.modelSelections.vercel_gateway = { ...selection, approvedModelIds: ["openai/gpt-4o"] };
    expect((await handler(request(payload))).status).toBe(422); expect(mocks.catalog).not.toHaveBeenCalled(); expect(mocks.save).not.toHaveBeenCalled();
  });
});

it("account discovery returns the current Gateway catalog instead of static model guesses", async () => {
  const response = await accountGet(); expect(response.status).toBe(200);
  expect((await response.json()).data.availableModels.vercel_gateway.map((model: { id: string }) => model.id)).toEqual(selection.approvedModelIds);
});
it("account discovery fails closed when the Gateway catalog is unavailable", async () => {
  mocks.catalog.mockRejectedValue(new Error("unavailable"));
  expect((await accountGet()).status).toBe(503);
});
it("account audit retains the full bounded approval list as a scalar", async () => {
  const ids = Array.from({ length: 32 }, (_, index) => `xai/m${index}-${"a".repeat(170)}`);
  mocks.catalog.mockResolvedValue(ids.map(id => ({ id })));
  const payload = body(); payload.modelSelections.vercel_gateway = { version: 1, defaultModelId: ids[0], approvedModelIds: ids };
  const response = await account(new NextRequest("https://visionxixlabs.com/api/account/ai-policy", { method: "PUT", headers: { origin: "https://visionxixlabs.com", "content-type": "application/json" }, body: JSON.stringify(payload) }));
  expect(response.status).toBe(200);
  const recorded = mocks.audit.mock.calls[0][0].detail.approvedGatewayModels;
  expect(typeof recorded).toBe("string"); expect(recorded.length).toBeGreaterThan(512);
  expect(recorded.split(",")).toEqual(ids);
});
