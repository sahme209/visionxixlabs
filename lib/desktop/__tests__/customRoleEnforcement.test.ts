import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  verifyDesktopToken: vi.fn(), resolveActiveSession: vi.fn(), touchDesktopSession: vi.fn(async () => {}),
  bearerFromHeader: vi.fn((h: string | null) => h), readDesktopCommercialAccess: vi.fn(),
  findMembership: vi.fn(), findCustomRole: vi.fn(), authenticateApiKey: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ prisma: { orgMembership: { findUnique: mocks.findMembership }, workspaceCustomRole: { findFirst: mocks.findCustomRole } } }));
vi.mock("@/lib/security/authenticateApiKey", () => ({ authenticateApiKey: mocks.authenticateApiKey }));
vi.mock("../desktopToken", () => ({ bearerFromHeader: mocks.bearerFromHeader, verifyDesktopToken: mocks.verifyDesktopToken }));
vi.mock("../desktopSession", () => ({ resolveActiveSession: mocks.resolveActiveSession, touchDesktopSession: mocks.touchDesktopSession }));
vi.mock("../desktopCommercialAccess", () => ({ readDesktopCommercialAccess: mocks.readDesktopCommercialAccess }));

const request = () => new NextRequest("https://visionxixlabs.com/api/desktop/deployments", { headers: { authorization: "Bearer token-1" } });
const resolve = async (requiredCapability?: string) => (await import("../resolveRequestDesktopSession")).resolveRequestDesktopSession(request(), { requiredScope: "release_gate:read", route: "/api/desktop/deployments", ...(requiredCapability ? { requiredCapability: requiredCapability as never } : {}) });

describe("custom roles in desktop authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.bearerFromHeader.mockImplementation((h: string | null) => h);
    mocks.verifyDesktopToken.mockReturnValue({ sessionId: "sess-1", signature: "sig" });
    mocks.resolveActiveSession.mockResolvedValue({ id: "sess-1", userId: "user-1", organizationId: "org-1" });
    mocks.readDesktopCommercialAccess.mockResolvedValue({ allowed: true });
    mocks.findMembership.mockResolvedValue({ acceptedAt: new Date(), role: "operator", customRoleId: "cr-1" });
  });

  it("removes the custom role's capabilities from the member's built-in role", async () => {
    mocks.findCustomRole.mockResolvedValue({ removedCapabilities: ["deploy:execute"] });
    expect(await resolve("deploy:execute")).toBeUndefined();
    const p = await resolve("github:write");
    expect(p?.capabilities).toEqual(["workspace:read", "github:read", "github:write"]);
    expect(mocks.findCustomRole.mock.calls[0][0].where).toEqual({ id: "cr-1", organizationId: "org-1" });
  });

  it("never grants a capability the built-in role lacks", async () => {
    mocks.findCustomRole.mockResolvedValue({ removedCapabilities: [] });
    expect(await resolve("members:manage")).toBeUndefined();
  });

  it("refuses the request when the custom role cannot be read or no longer exists", async () => {
    mocks.findCustomRole.mockResolvedValue(null);
    expect(await resolve()).toBeUndefined();
    mocks.findCustomRole.mockRejectedValue(new Error("db"));
    expect(await resolve()).toBeUndefined();
  });

  it("leaves members without a custom role on their built-in role", async () => {
    mocks.findMembership.mockResolvedValue({ acceptedAt: new Date(), role: "operator", customRoleId: null });
    expect((await resolve("deploy:execute"))?.capabilities).toEqual(["workspace:read", "github:read", "github:write", "deploy:execute"]);
    expect(mocks.findCustomRole).not.toHaveBeenCalled();
  });
});
