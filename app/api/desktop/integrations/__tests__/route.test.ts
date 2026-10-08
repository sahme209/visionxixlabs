import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  resolveRequestDesktopSession: vi.fn(),
  getGithubConfig: vi.fn(),
  isGithubAppInstallationReady: vi.fn(),
  trustedIntegrationCallbackUrl: vi.fn(),
  connectorFindMany: vi.fn(),
  connectionFindMany: vi.fn(),
  installationFindFirst: vi.fn(),
}));

vi.mock("@/lib/desktop/resolveRequestDesktopSession", () => ({ resolveRequestDesktopSession: mocks.resolveRequestDesktopSession }));
vi.mock("@/lib/connectors/github/githubConfig", () => ({ getGithubConfig: mocks.getGithubConfig, isGithubAppInstallationReady: mocks.isGithubAppInstallationReady }));
vi.mock("@/lib/integrations/trustedCallbackUrl", () => ({ trustedIntegrationCallbackUrl: mocks.trustedIntegrationCallbackUrl }));
vi.mock("@/lib/db", () => ({
  prisma: {
    connectorSetupSession: { findMany: mocks.connectorFindMany },
    tenantIntegrationConnection: { findMany: mocks.connectionFindMany },
    gitHubInstallation: { findFirst: mocks.installationFindFirst },
  },
}));

describe("GET /api/desktop/integrations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveRequestDesktopSession.mockResolvedValue({ userId: "user-1", organizationId: "org-1" });
    mocks.connectorFindMany.mockResolvedValue([]);
    mocks.connectionFindMany.mockResolvedValue([]);
    mocks.installationFindFirst.mockResolvedValue(null);
    mocks.getGithubConfig.mockResolvedValue({ appSlug: "axiom" });
    mocks.isGithubAppInstallationReady.mockReturnValue(true);
    mocks.trustedIntegrationCallbackUrl.mockImplementation((path: string) => `https://visionxixlabs.com${path}`);
    process.env.SLACK_CLIENT_ID = "slack-id";
    process.env.SLACK_CLIENT_SECRET = "slack-secret";
    delete process.env.MICROSOFT_CLIENT_ID;
    delete process.env.MICROSOFT_TENANT_ID;
    delete process.env.MICROSOFT_CLIENT_SECRET;
    delete process.env.LINEAR_CLIENT_ID;
    delete process.env.LINEAR_CLIENT_SECRET;
  });

  afterEach(() => {
    delete process.env.SLACK_CLIENT_ID;
    delete process.env.SLACK_CLIENT_SECRET;
  });

  it("reports connection readiness without exposing provider credentials", async () => {
    const { GET } = await import("../route");
    const response = await GET(new NextRequest("https://visionxixlabs.com/api/desktop/integrations"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.configuration).toEqual({ github: true, slack: true, teams: false, linear: false });
    expect(JSON.stringify(body)).not.toContain("slack-secret");
    expect(body.data.collaboration).toEqual([
      { provider: "slack", status: "not_connected", lastValidatedAt: null },
      { provider: "teams", status: "not_connected", lastValidatedAt: null },
      { provider: "linear", status: "not_connected", lastValidatedAt: null },
    ]);
  });
});
