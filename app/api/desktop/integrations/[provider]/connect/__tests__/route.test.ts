import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  resolveRequestDesktopSession: vi.fn(),
  startTenantIntegrationAuthorization: vi.fn(),
  trustedIntegrationCallbackUrl: vi.fn(),
  getGithubConfig: vi.fn(),
  isGithubAppInstallationReady: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("@/lib/desktop/resolveRequestDesktopSession", () => ({ resolveRequestDesktopSession: mocks.resolveRequestDesktopSession }));
vi.mock("@/lib/integrations/tenantConnectionRepo", () => ({ startTenantIntegrationAuthorization: mocks.startTenantIntegrationAuthorization }));
vi.mock("@/lib/integrations/trustedCallbackUrl", () => ({ trustedIntegrationCallbackUrl: mocks.trustedIntegrationCallbackUrl }));
vi.mock("@/lib/connectors/github/githubConfig", () => ({ getGithubConfig: mocks.getGithubConfig, isGithubAppInstallationReady: mocks.isGithubAppInstallationReady }));
vi.mock("@/lib/integrations/slack/slackOauth", () => ({ buildSlackInstallUrl: vi.fn() }));

const session = { id: "session-1", userId: "user-1", organizationId: "org-1", credentialKind: "desktop_session" as const };

describe("POST /api/desktop/integrations/[provider]/connect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveRequestDesktopSession.mockResolvedValue(session);
    mocks.trustedIntegrationCallbackUrl.mockImplementation((path: string) => `https://visionxixlabs.com${path}`);
    mocks.startTenantIntegrationAuthorization.mockResolvedValue({ state: "a".repeat(43) });
    process.env.LINEAR_CLIENT_ID = "linear-client";
    process.env.LINEAR_CLIENT_SECRET = "linear-secret";
  });

  afterEach(() => {
    delete process.env.LINEAR_CLIENT_ID;
    delete process.env.LINEAR_CLIENT_SECRET;
  });

  it("requires a desktop admin session", async () => {
    mocks.resolveRequestDesktopSession.mockResolvedValue(undefined);
    const { POST } = await import("../route");
    const response = await POST(
      new NextRequest("https://visionxixlabs.com/api/desktop/integrations/linear/connect", { method: "POST" }),
      { params: Promise.resolve({ provider: "linear" }) },
    );
    expect(response.status).toBe(401);
  });

  it("returns a trusted Linear consent URL while keeping PKCE server-side", async () => {
    const { POST } = await import("../route");
    const response = await POST(
      new NextRequest("https://visionxixlabs.com/api/desktop/integrations/linear/connect", { method: "POST" }),
      { params: Promise.resolve({ provider: "linear" }) },
    );
    const body = await response.json();
    const destination = new URL(body.data.consentUrl);

    expect(response.status).toBe(200);
    expect(destination.origin).toBe("https://linear.app");
    expect(destination.searchParams.get("scope")).toBe("read,issues:create");
    expect(destination.searchParams.get("state")).toBe("a".repeat(43));
    expect(destination.searchParams.get("code_challenge_method")).toBe("S256");
    expect(destination.searchParams.has("code_verifier")).toBe(false);
    expect(mocks.startTenantIntegrationAuthorization).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      organizationId: "org-1", provider: "linear", initiatedByUserId: "user-1", pkceVerifier: expect.any(String),
    }));
  });
});
