import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  resolveRequestDesktopSession: vi.fn(),
  findMany: vi.fn(),
  findUniqueRepository: vi.fn(),
  findUniqueEnvironment: vi.fn(),
  create: vi.fn(),
  recordAudit: vi.fn(async (
    _repo: import("@/lib/releaseops/auditEventResponder").AuditEventRepo,
    _input: import("@/lib/releaseops/auditEventResponder").AppendAuditEventInput,
  ) => true),
}));

vi.mock("@/lib/desktop/resolveRequestDesktopSession", () => ({ resolveRequestDesktopSession: mocks.resolveRequestDesktopSession }));
vi.mock("@/lib/db", () => ({
  prisma: {
    branchEnvironmentPolicy: { findMany: mocks.findMany, create: mocks.create },
    repository: { findUnique: mocks.findUniqueRepository },
    environment: { findUnique: mocks.findUniqueEnvironment },
  },
}));
vi.mock("@/lib/releaseops/auditEventResponder", async () => {
  const actual = await vi.importActual<typeof import("@/lib/releaseops/auditEventResponder")>("@/lib/releaseops/auditEventResponder");
  return { ...actual, appendAuditEvent: mocks.recordAudit };
});

function getRequest() { return new NextRequest("https://visionxixlabs.com/api/desktop/branch-policies", { method: "GET" }); }
function postRequest(body: object) {
  return new NextRequest("https://visionxixlabs.com/api/desktop/branch-policies", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
}
const session = { id: "sess-1", userId: "user-1", organizationId: "org-1", credentialKind: "desktop_session" as const };
const VALID_BODY = { repositoryId: "repo_1", environmentId: "env_1", branchPattern: "release/*", requirePrLink: true };

describe("GET /api/desktop/branch-policies", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveRequestDesktopSession.mockResolvedValue(session);
    mocks.findMany.mockResolvedValue([]);
  });

  it("requires a desktop session", async () => {
    mocks.resolveRequestDesktopSession.mockResolvedValue(undefined);
    const { GET } = await import("../route");
    const res = await GET(getRequest());
    expect(res.status).toBe(401);
  });

  it("lists policies for the org", async () => {
    const { GET } = await import("../route");
    const res = await GET(getRequest());
    expect(res.status).toBe(200);
  });
});

describe("POST /api/desktop/branch-policies", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveRequestDesktopSession.mockResolvedValue(session);
    mocks.findUniqueRepository.mockResolvedValue({ id: "repo_1", organizationId: "org-1" });
    mocks.findUniqueEnvironment.mockResolvedValue({ id: "env_1", organizationId: "org-1", tier: "dev" });
  });

  it("requires a desktop session", async () => {
    mocks.resolveRequestDesktopSession.mockResolvedValue(undefined);
    const { POST } = await import("../route");
    const res = await POST(postRequest(VALID_BODY));
    expect(res.status).toBe(401);
  });

  it("rejects invalid payloads", async () => {
    const { POST } = await import("../route");
    const res = await POST(postRequest({ repositoryId: "repo_1" }));
    expect(res.status).toBe(400);
  });

  it("creates the policy and audits it", async () => {
    mocks.create.mockResolvedValue({ id: "bep_1", ...VALID_BODY, requireReleaseTag: false, requireCodeowners: false, requireChangeTicket: false, priority: 100, enabled: true, organizationId: "org-1", createdAt: new Date() });
    const { POST } = await import("../route");
    const res = await POST(postRequest(VALID_BODY));
    const body = await res.json();
    expect(res.status).toBe(201);
    expect(body.data.requirePrLink).toBe(true);
    const auditCall = mocks.recordAudit.mock.calls[0][1];
    expect(auditCall.kind).toBe("branch_validation.policy_created");
  });

  it("requires the complete governed cycle for production policies", async () => {
    mocks.findUniqueEnvironment.mockResolvedValue({ id: "env_prod", organizationId: "org-1", tier: "prod" });
    const { POST } = await import("../route");
    const res = await POST(postRequest({
      repositoryId: "repo_1",
      environmentId: "env_prod",
      branchPattern: "main",
      requirePrLink: true,
    }));
    expect(res.status).toBe(409);
    await expect(res.json()).resolves.toMatchObject({ error: "production_policy_controls_required" });
  });
});
