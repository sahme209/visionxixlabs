import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  currentContext: vi.fn(),
  findRelease: vi.fn(),
  findRepository: vi.fn(),
  findDeploymentTarget: vi.fn(),
  updateRelease: vi.fn(),
  resolveTenantScopedToken: vi.fn(),
  dispatchWorkflow: vi.fn(),
  recordAudit: vi.fn(async (
    _repo: import("@/lib/releaseops/auditEventResponder").AuditEventRepo,
    _input: import("@/lib/releaseops/auditEventResponder").AppendAuditEventInput,
  ) => true),
}));

vi.mock("@/lib/auth/currentContext", () => ({ currentContext: mocks.currentContext }));
vi.mock("@/lib/db", () => ({
  prisma: {
    release: { findUnique: mocks.findRelease, update: mocks.updateRelease },
    repository: { findUnique: mocks.findRepository },
    deploymentTarget: { findUnique: mocks.findDeploymentTarget },
  },
}));
vi.mock("@/lib/connectors/github/resolveTenantScopedToken", async () => {
  const actual = await vi.importActual<typeof import("@/lib/connectors/github/resolveTenantScopedToken")>(
    "@/lib/connectors/github/resolveTenantScopedToken",
  );
  return { ...actual, resolveTenantScopedToken: mocks.resolveTenantScopedToken };
});
vi.mock("@/lib/connectors/github/githubWriteClient", () => ({ dispatchWorkflow: mocks.dispatchWorkflow }));
vi.mock("@/lib/releaseops/auditEventResponder", async () => {
  const actual = await vi.importActual<typeof import("@/lib/releaseops/auditEventResponder")>(
    "@/lib/releaseops/auditEventResponder",
  );
  return { ...actual, appendAuditEvent: mocks.recordAudit };
});

function request(body: object) {
  return new NextRequest("https://visionxixlabs.com/api/dashboard/release-deploy", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const adminCtx = { isAuthenticated: true, organizationId: "org_1", userId: "user_1", email: "owner@acme.com", roles: ["owner"] };
const memberCtx = { isAuthenticated: true, organizationId: "org_1", userId: "user_1", email: "member@acme.com", roles: ["operator"] };

function readyRelease(overrides: Record<string, unknown> = {}) {
  return {
    id: "rel_1",
    organizationId: "org_1",
    status: "ready",
    releaseTag: "v1.0.0",
    commitSha: "abc1234",
    evidenceRepositoryId: "repo_1",
    targetEnvironmentId: "env_1",
    ...overrides,
  };
}

const githubRepo = { id: "repo_1", organizationId: "org_1", provider: "github", remoteOwner: "acme", remoteName: "widgets", defaultBranch: "main" };
const target = { id: "dt_1", organizationId: "org_1", environmentId: "env_1", provider: "aws", roleArn: "arn:aws:iam::123456789012:role/deploy", region: "us-east-1", ecsCluster: "prod", ecsService: "web" };

describe("POST /api/dashboard/release-deploy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.currentContext.mockResolvedValue(adminCtx);
  });

  it("requires authentication", async () => {
    mocks.currentContext.mockResolvedValue({ isAuthenticated: false, roles: [] });
    const { POST } = await import("../route");
    const res = await POST(request({ releaseId: "rel_1" }));
    expect(res.status).toBe(401);
  });

  it("403 forbidden_role for a non-admin, non-owner member", async () => {
    mocks.currentContext.mockResolvedValue(memberCtx);
    const { POST } = await import("../route");
    const res = await POST(request({ releaseId: "rel_1" }));
    expect(res.status).toBe(403);
  });

  it("404 release_not_found when the release doesn't exist or belongs to another org", async () => {
    mocks.findRelease.mockResolvedValue(null);
    const { POST } = await import("../route");
    const res = await POST(request({ releaseId: "missing" }));
    expect(res.status).toBe(404);
  });

  it("409 release_missing_repository when no evidence repository is bound", async () => {
    mocks.findRelease.mockResolvedValue(readyRelease({ evidenceRepositoryId: null }));
    const { POST } = await import("../route");
    const res = await POST(request({ releaseId: "rel_1" }));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe("release_missing_repository");
  });

  it("409 release_missing_environment when no target environment is bound", async () => {
    mocks.findRelease.mockResolvedValue(readyRelease({ targetEnvironmentId: null }));
    const { POST } = await import("../route");
    const res = await POST(request({ releaseId: "rel_1" }));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe("release_missing_environment");
  });

  it("409 deployment_target_not_configured when the environment has no AWS target set", async () => {
    mocks.findRelease.mockResolvedValue(readyRelease());
    mocks.findRepository.mockResolvedValue(githubRepo);
    mocks.findDeploymentTarget.mockResolvedValue(null);
    const { POST } = await import("../route");
    const res = await POST(request({ releaseId: "rel_1" }));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe("deployment_target_not_configured");
  });

  it("502 dispatch_failed when GitHub rejects the workflow dispatch, and does not flip release status", async () => {
    mocks.findRelease.mockResolvedValue(readyRelease());
    mocks.findRepository.mockResolvedValue(githubRepo);
    mocks.findDeploymentTarget.mockResolvedValue(target);
    mocks.resolveTenantScopedToken.mockResolvedValue({ ok: true, token: "installation-token" });
    mocks.dispatchWorkflow.mockResolvedValue({ ok: false, error: "workflow_dispatch_failed: github_404" });
    const { POST } = await import("../route");
    const res = await POST(request({ releaseId: "rel_1" }));
    expect(res.status).toBe(502);
    expect(mocks.updateRelease).not.toHaveBeenCalled();
    expect(mocks.recordAudit).not.toHaveBeenCalled();
  });

  it("dispatches the workflow with the target's role/region/cluster/service, flips status to deploying, and audits without the token", async () => {
    mocks.findRelease.mockResolvedValue(readyRelease());
    mocks.findRepository.mockResolvedValue(githubRepo);
    mocks.findDeploymentTarget.mockResolvedValue(target);
    mocks.resolveTenantScopedToken.mockResolvedValue({ ok: true, token: "installation-token" });
    mocks.dispatchWorkflow.mockResolvedValue({ ok: true, data: {} });
    mocks.updateRelease.mockResolvedValue({ id: "rel_1", status: "deploying" });

    const { POST } = await import("../route");
    const res = await POST(request({ releaseId: "rel_1" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data.status).toBe("deploying");

    expect(mocks.dispatchWorkflow).toHaveBeenCalledWith(expect.objectContaining({
      owner: "acme", repo: "widgets", ref: "abc1234",
      inputs: { role_arn: target.roleArn, region: target.region, cluster: target.ecsCluster, service: target.ecsService },
      installationToken: "installation-token",
    }));
    expect(mocks.updateRelease).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "rel_1" },
      data: expect.objectContaining({ status: "deploying" }),
    }));

    const auditCall = mocks.recordAudit.mock.calls[0][1];
    expect(auditCall.kind).toBe("release.deploy_triggered");
    expect(JSON.stringify(auditCall)).not.toContain("installation-token");
  });
});
