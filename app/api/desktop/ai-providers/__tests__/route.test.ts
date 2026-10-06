import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  resolveRequestDesktopSession: vi.fn(),
  status: vi.fn(),
  load: vi.fn(),
  normalize: vi.fn(),
  resolve: vi.fn(),
  save: vi.fn(),
  audit: vi.fn(),
}));

vi.mock("@/lib/desktop/resolveRequestDesktopSession", () => ({ resolveRequestDesktopSession: mocks.resolveRequestDesktopSession }));
vi.mock("@/lib/ai/AIProviderManager", () => ({ getAIProviderManager: () => ({ status: mocks.status }) }));
vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("@/lib/releaseops/auditEventResponder", () => ({ appendAuditEvent: mocks.audit }));
vi.mock("@/lib/ai/workspaceProviderPolicy", () => ({
  loadWorkspaceAIProviderPolicyWithState: mocks.load,
  normalizeWorkspaceAIProviderPolicy: mocks.normalize,
  resolveWorkspaceAIProviderPolicy: mocks.resolve,
  saveWorkspaceAIProviderPolicy: mocks.save,
  workspaceAIProviderPolicyStorageState: () => "unavailable",
}));

const session = { id: "sess-1", userId: "user-1", organizationId: "org-1", credentialKind: "desktop_session" as const };
const policy = { enabled: true, allowedProviders: ["openai"], modelSelections: { openai: "gpt-4o" }, fallbackOrder: ["openai"] };

function request(method: "GET" | "PUT", body?: object) {
  return new NextRequest("https://visionxixlabs.com/api/desktop/ai-providers", {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe("desktop AI provider policy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveRequestDesktopSession.mockResolvedValue(session);
    mocks.status.mockReturnValue([{ provider: "openai", configured: true }]);
    mocks.load.mockResolvedValue({ policy, storageState: "ready" });
    mocks.resolve.mockReturnValue(policy);
    mocks.normalize.mockReturnValue(policy);
    mocks.save.mockResolvedValue(undefined);
    mocks.audit.mockResolvedValue(true);
  });

  it("requires a desktop session", async () => {
    mocks.resolveRequestDesktopSession.mockResolvedValue(undefined);
    const { GET } = await import("../route");
    expect((await GET(request("GET"))).status).toBe(401);
  });

  it("returns only configured providers with their selectable models", async () => {
    const { GET } = await import("../route");
    const response = await GET(request("GET"));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.data.policy).toEqual(policy);
    expect(body.data.providers[0].provider).toBe("openai");
    expect(body.data.providers[0].models.length).toBeGreaterThan(0);
  });

  it("admin-gates and persists policy changes", async () => {
    const { PUT } = await import("../route");
    const response = await PUT(request("PUT", policy));
    expect(response.status).toBe(200);
    expect(mocks.resolveRequestDesktopSession).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ requireWorkspaceAdmin: true }));
    expect(mocks.save).toHaveBeenCalledWith({ organizationId: "org-1", policy, updatedBy: "user-1" });
    expect(mocks.audit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ kind: "agent.model_policy_update" }));
  });

  it("rejects an unavailable provider", async () => {
    mocks.normalize.mockReturnValue({ ...policy, allowedProviders: ["anthropic"] });
    const { PUT } = await import("../route");
    expect((await PUT(request("PUT", policy))).status).toBe(422);
    expect(mocks.save).not.toHaveBeenCalled();
  });
});
