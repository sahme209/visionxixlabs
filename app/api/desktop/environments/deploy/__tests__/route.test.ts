import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  resolveRequestDesktopSession: vi.fn(),
  findEnvironment: vi.fn(),
  findTarget: vi.fn(),
  resolveTenantScopedToken: vi.fn(),
  dispatchWorkflow: vi.fn(),
  recordAudit: vi.fn(async (
    _repo: import("@/lib/releaseops/auditEventResponder").AuditEventRepo,
    _input: import("@/lib/releaseops/auditEventResponder").AppendAuditEventInput,
  ) => true),
}));

vi.mock("@/lib/desktop/resolveRequestDesktopSession", () => ({
  resolveRequestDesktopSession: mocks.resolveRequestDesktopSession,
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    environment: { findUnique: mocks.findEnvironment },
    deploymentTarget: { findUnique: mocks.findTarget },
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
  return new NextRequest("https://visionxixlabs.com/api/desktop/environments/deploy", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const session = { id: "sess-1", userId: "user-1", organizationId: "org-1", credentialKind: "desktop_session" as const };
const target = { id: "dt_1", organizationId: "org-1", environmentId: "env_1", provider: "aws", roleArn: "arn:aws:iam::123456789012:role/axiom-deploy", region: "us-east-2", ecsCluster: "axiom-prod-cluster", ecsService: "axiom-web-service" };

describe("POST /api/desktop/environments/deploy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveRequestDesktopSession.mockResolvedValue(session);
  });

  it("requires a desktop session", async () => {
    mocks.resolveRequestDesktopSession.mockResolvedValue(undefined);
    const { POST } = await import("../route");
    const res = await POST(request({ repositoryFullName: "acme/widgets", environmentId: "env_1" }));
    expect(res.status).toBe(401);
  });

  it("rejects an invalid payload", async () => {
    const { POST } = await import("../route");
    const res = await POST(request({ repositoryFullName: "acme/widgets" }));
    expect(res.status).toBe(400);
  });

  it("404s when the environment doesn't exist or belongs to another org", async () => {
    mocks.findEnvironment.mockResolvedValue(null);
    const { POST } = await import("../route");
    const res = await POST(request({ repositoryFullName: "acme/widgets", environmentId: "env_1" }));
    expect(res.status).toBe(404);
  });

  it("409s when no deployment target is configured for the environment", async () => {
    mocks.findEnvironment.mockResolvedValue({ id: "env_1", organizationId: "org-1" });
    mocks.findTarget.mockResolvedValue(null);
    const { POST } = await import("../route");
    const res = await POST(request({ repositoryFullName: "acme/widgets", environmentId: "env_1" }));
    expect(res.status).toBe(409);
  });

  it("dispatches the workflow with the target's config and audits it", async () => {
    mocks.findEnvironment.mockResolvedValue({ id: "env_1", organizationId: "org-1" });
    mocks.findTarget.mockResolvedValue(target);
    mocks.resolveTenantScopedToken.mockResolvedValue({ ok: true, token: "installation-token" });
    mocks.dispatchWorkflow.mockResolvedValue({ ok: true, data: {} });

    const { POST } = await import("../route");
    const res = await POST(request({ repositoryFullName: "acme/widgets", environmentId: "env_1" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(mocks.dispatchWorkflow).toHaveBeenCalledWith(expect.objectContaining({
      owner: "acme", repo: "widgets",
      inputs: { role_arn: target.roleArn, region: target.region, cluster: target.ecsCluster, service: target.ecsService },
      installationToken: "installation-token",
    }));
    const auditCall = mocks.recordAudit.mock.calls[0][1];
    expect(auditCall.kind).toBe("release.deploy_triggered");
    expect(JSON.stringify(auditCall)).not.toContain("installation-token");
  });

  it("502s and skips the audit when GitHub rejects the dispatch", async () => {
    mocks.findEnvironment.mockResolvedValue({ id: "env_1", organizationId: "org-1" });
    mocks.findTarget.mockResolvedValue(target);
    mocks.resolveTenantScopedToken.mockResolvedValue({ ok: true, token: "installation-token" });
    mocks.dispatchWorkflow.mockResolvedValue({ ok: false, error: "workflow_dispatch_failed: github_404" });

    const { POST } = await import("../route");
    const res = await POST(request({ repositoryFullName: "acme/widgets", environmentId: "env_1" }));
    expect(res.status).toBe(502);
    expect(mocks.recordAudit).not.toHaveBeenCalled();
  });
});
