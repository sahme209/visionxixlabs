import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  resolveRequestDesktopSession: vi.fn(),
  findEnvironment: vi.fn(),
  findTarget: vi.fn(),
  upsertTarget: vi.fn(),
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
    deploymentTarget: { findUnique: mocks.findTarget, upsert: mocks.upsertTarget },
  },
}));
vi.mock("@/lib/releaseops/auditEventResponder", async () => {
  const actual = await vi.importActual<typeof import("@/lib/releaseops/auditEventResponder")>(
    "@/lib/releaseops/auditEventResponder",
  );
  return { ...actual, appendAuditEvent: mocks.recordAudit };
});

const VALID = { roleArn: "arn:aws:iam::123456789012:role/axiom-deploy", region: "us-east-2", ecsCluster: "axiom-prod-cluster", ecsService: "axiom-web-service" };

function getRequest(environmentId: string) {
  return new NextRequest(`https://visionxixlabs.com/api/desktop/environments/deployment-target?environmentId=${environmentId}`, { method: "GET" });
}
function postRequest(body: object) {
  return new NextRequest("https://visionxixlabs.com/api/desktop/environments/deployment-target", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const session = { id: "sess-1", userId: "user-1", organizationId: "org-1", credentialKind: "desktop_session" as const };

describe("GET /api/desktop/environments/deployment-target", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveRequestDesktopSession.mockResolvedValue(session);
  });

  it("requires a desktop session", async () => {
    mocks.resolveRequestDesktopSession.mockResolvedValue(undefined);
    const { GET } = await import("../route");
    const res = await GET(getRequest("env_1"));
    expect(res.status).toBe(401);
  });

  it("returns null when no target is configured", async () => {
    mocks.findEnvironment.mockResolvedValue({ id: "env_1", organizationId: "org-1" });
    mocks.findTarget.mockResolvedValue(null);
    const { GET } = await import("../route");
    const res = await GET(getRequest("env_1"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data.target).toBeNull();
  });
});

describe("POST /api/desktop/environments/deployment-target", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveRequestDesktopSession.mockResolvedValue(session);
  });

  it("requires a desktop session", async () => {
    mocks.resolveRequestDesktopSession.mockResolvedValue(undefined);
    const { POST } = await import("../route");
    const res = await POST(postRequest({ environmentId: "env_1", ...VALID }));
    expect(res.status).toBe(401);
  });

  it("saves the target and audits it, without ever logging the role ARN as a secret concern", async () => {
    mocks.findEnvironment.mockResolvedValue({ id: "env_1", organizationId: "org-1" });
    mocks.upsertTarget.mockResolvedValue({ id: "dt_1", environmentId: "env_1", provider: "aws", ...VALID });
    const { POST } = await import("../route");
    const res = await POST(postRequest({ environmentId: "env_1", ...VALID }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data.roleArn).toBe(VALID.roleArn);
    expect(mocks.recordAudit).toHaveBeenCalled();
  });
});
