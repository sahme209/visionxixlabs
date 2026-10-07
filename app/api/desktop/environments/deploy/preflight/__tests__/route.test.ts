import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  resolveSession: vi.fn(),
  findEnvironment: vi.fn(),
  findTarget: vi.fn(),
  findRepositories: vi.fn(),
  findPolicies: vi.fn(),
  resolveToken: vi.fn(),
  resolveRef: vi.fn(),
}));

vi.mock("@/lib/desktop/resolveRequestDesktopSession", () => ({ resolveRequestDesktopSession: mocks.resolveSession }));
vi.mock("@/lib/db", () => ({
  prisma: {
    environment: { findUnique: mocks.findEnvironment },
    deploymentTarget: { findUnique: mocks.findTarget },
    repository: { findMany: mocks.findRepositories },
    branchEnvironmentPolicy: { findMany: mocks.findPolicies },
  },
}));
vi.mock("@/lib/connectors/github/resolveTenantScopedToken", async () => {
  const actual = await vi.importActual<typeof import("@/lib/connectors/github/resolveTenantScopedToken")>("@/lib/connectors/github/resolveTenantScopedToken");
  return { ...actual, resolveTenantScopedToken: mocks.resolveToken };
});
vi.mock("@/lib/connectors/github/githubWriteClient", () => ({ resolveGitReference: mocks.resolveRef }));

function request(body: object) {
  return new NextRequest("https://visionxixlabs.com/api/desktop/environments/deploy/preflight", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const validBody = { repositoryFullName: "acme/widgets", environmentId: "env_1", sourceRef: "main", sourceKind: "branch" };

describe("POST /api/desktop/environments/deploy/preflight", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveSession.mockResolvedValue({ id: "session", userId: "user", organizationId: "org-1" });
    mocks.findEnvironment.mockResolvedValue({ id: "env_1", organizationId: "org-1" });
    mocks.findTarget.mockResolvedValue({ environmentId: "env_1", organizationId: "org-1" });
    mocks.findRepositories.mockResolvedValue([]);
    mocks.findPolicies.mockResolvedValue([]);
    mocks.resolveToken.mockResolvedValue({ ok: true, token: "scoped-token" });
    mocks.resolveRef.mockResolvedValue({ ok: true, data: { kind: "branch", ref: "main", commitSha: "abc123" } });
  });

  it("requires an admin desktop session", async () => {
    mocks.resolveSession.mockResolvedValue(undefined);
    const { POST } = await import("../route");
    expect((await POST(request(validBody))).status).toBe(401);
  });

  it("fails closed when no deployment target is configured", async () => {
    mocks.findTarget.mockResolvedValue(null);
    const { POST } = await import("../route");
    const response = await POST(request(validBody));
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: "deployment_target_not_configured" });
  });

  it("returns the live source commit without dispatching anything", async () => {
    const { POST } = await import("../route");
    const response = await POST(request(validBody));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      data: { ready: true, policyId: null, sourceCommitSha: "abc123", pullRequestUrl: null },
    });
    expect(mocks.resolveRef).toHaveBeenCalledWith(expect.objectContaining({ installationToken: "scoped-token" }));
  });

  it("returns policy denial without leaking the installation token", async () => {
    mocks.findRepositories.mockResolvedValue([{ id: "repo_1", organizationId: "org-1", provider: "github", remoteOwner: "acme", remoteName: "widgets" }]);
    mocks.findPolicies.mockResolvedValue([{ id: "policy_1", branchPattern: "release/*", requireReleaseTag: false, requireCodeowners: false, requirePrLink: false, requireChangeTicket: false, priority: 100 }]);
    const { POST } = await import("../route");
    const response = await POST(request(validBody));
    const body = await response.json();
    expect(response.status).toBe(409);
    expect(body).toEqual({ ok: false, error: "branch_policy_no_matching_ref", policyId: null });
    expect(JSON.stringify(body)).not.toContain("scoped-token");
  });
});
