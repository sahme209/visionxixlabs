import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  currentContext: vi.fn(),
  isAdminOrOwner: vi.fn(),
  isSameOriginRequest: vi.fn(),
  trustedIntegrationCallbackUrl: vi.fn(),
  startTenantIntegrationAuthorization: vi.fn(),
}));

vi.mock("@/lib/auth/currentContext", () => ({ currentContext: mocks.currentContext }));
vi.mock("@/lib/auth/platformAdmin", () => ({ isAdminOrOwner: mocks.isAdminOrOwner }));
vi.mock("@/lib/auth/requestOrigin", () => ({ isSameOriginRequest: mocks.isSameOriginRequest }));
vi.mock("@/lib/integrations/trustedCallbackUrl", () => ({ trustedIntegrationCallbackUrl: mocks.trustedIntegrationCallbackUrl }));
vi.mock("@/lib/integrations/tenantConnectionRepo", () => ({ startTenantIntegrationAuthorization: mocks.startTenantIntegrationAuthorization }));
vi.mock("@/lib/db", () => ({ prisma: {} }));

const originalClientId = process.env.LINEAR_CLIENT_ID;
const originalClientSecret = process.env.LINEAR_CLIENT_SECRET;

describe("POST /api/account/integrations/linear/start", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.LINEAR_CLIENT_ID = "linear-client";
    process.env.LINEAR_CLIENT_SECRET = "linear-secret";
    mocks.isSameOriginRequest.mockReturnValue(true);
    mocks.currentContext.mockResolvedValue({ isAuthenticated: true, organizationId: "org-1", userId: "user-1", email: "admin@example.com", roles: ["admin"] });
    mocks.isAdminOrOwner.mockReturnValue(true);
    mocks.trustedIntegrationCallbackUrl.mockReturnValue("https://visionxixlabs.com/api/integrations/linear/callback");
    mocks.startTenantIntegrationAuthorization.mockResolvedValue({ state: "s".repeat(43), expiresAt: new Date() });
  });

  afterEach(() => {
    if (originalClientId === undefined) delete process.env.LINEAR_CLIENT_ID; else process.env.LINEAR_CLIENT_ID = originalClientId;
    if (originalClientSecret === undefined) delete process.env.LINEAR_CLIENT_SECRET; else process.env.LINEAR_CLIENT_SECRET = originalClientSecret;
  });

  it("starts a PKCE app-actor flow with minimum issue scopes", async () => {
    const { POST } = await import("../route");
    const response = await POST(new NextRequest("https://visionxixlabs.com/api/account/integrations/linear/start", { method: "POST" }));
    const body = await response.json();
    const consent = new URL(body.data.consentUrl);

    expect(response.status).toBe(200);
    expect(consent.origin).toBe("https://linear.app");
    expect(consent.searchParams.get("actor")).toBe("app");
    expect(consent.searchParams.get("scope")).toBe("read,issues:create");
    expect(consent.searchParams.get("code_challenge_method")).toBe("S256");
    expect(mocks.startTenantIntegrationAuthorization).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ provider: "linear", organizationId: "org-1" }));
  });
});
