import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  resolveRequestDesktopSession: vi.fn(),
  findMany: vi.fn(),
  findUnique: vi.fn(),
  create: vi.fn(),
  recordAudit: vi.fn(async (
    _repo: import("@/lib/releaseops/auditEventResponder").AuditEventRepo,
    _input: import("@/lib/releaseops/auditEventResponder").AppendAuditEventInput,
  ) => true),
}));

vi.mock("@/lib/desktop/resolveRequestDesktopSession", () => ({ resolveRequestDesktopSession: mocks.resolveRequestDesktopSession }));
vi.mock("@/lib/db", () => ({
  prisma: {
    repository: { findMany: mocks.findMany, findUnique: mocks.findUnique, create: mocks.create },
    pullRequestRecord: { count: vi.fn(async () => 0) },
    releaseTagRecord: { count: vi.fn(async () => 0) },
    workflowRunRecord: { findFirst: vi.fn(async () => null) },
  },
}));
vi.mock("@/lib/releaseops/auditEventResponder", async () => {
  const actual = await vi.importActual<typeof import("@/lib/releaseops/auditEventResponder")>("@/lib/releaseops/auditEventResponder");
  return { ...actual, appendAuditEvent: mocks.recordAudit };
});

function getRequest() { return new NextRequest("https://visionxixlabs.com/api/desktop/repositories", { method: "GET" }); }
function postRequest(body: object) {
  return new NextRequest("https://visionxixlabs.com/api/desktop/repositories", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
}
const session = { id: "sess-1", userId: "user-1", organizationId: "org-1", credentialKind: "desktop_session" as const };

describe("GET /api/desktop/repositories", () => {
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

  it("lists repositories for the org", async () => {
    const { GET } = await import("../route");
    const res = await GET(getRequest());
    expect(res.status).toBe(200);
  });
});

describe("POST /api/desktop/repositories", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveRequestDesktopSession.mockResolvedValue(session);
  });

  it("requires a desktop session", async () => {
    mocks.resolveRequestDesktopSession.mockResolvedValue(undefined);
    const { POST } = await import("../route");
    const res = await POST(postRequest({ provider: "github", remoteOwner: "acme", remoteName: "widgets" }));
    expect(res.status).toBe(401);
  });

  it("rejects invalid payloads", async () => {
    const { POST } = await import("../route");
    const res = await POST(postRequest({ provider: "github" }));
    expect(res.status).toBe(400);
  });

  it("registers the repository and audits it", async () => {
    mocks.findUnique.mockResolvedValue(null);
    mocks.create.mockResolvedValue({ id: "repo_1", provider: "github", remoteOwner: "acme", remoteName: "widgets", remoteUrl: "https://github.com/acme/widgets", defaultBranch: "main" });
    const { POST } = await import("../route");
    const res = await POST(postRequest({ provider: "github", remoteOwner: "acme", remoteName: "widgets" }));
    const body = await res.json();
    expect(res.status).toBe(201);
    expect(body.data.created).toBe(true);
    const auditCall = mocks.recordAudit.mock.calls[0][1];
    expect(auditCall.kind).toBe("repository.create");
  });
});
