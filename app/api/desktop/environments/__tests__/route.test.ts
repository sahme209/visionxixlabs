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

vi.mock("@/lib/desktop/resolveRequestDesktopSession", () => ({
  resolveRequestDesktopSession: mocks.resolveRequestDesktopSession,
}));
vi.mock("@/lib/db", () => ({
  prisma: { environment: { findMany: mocks.findMany, findUnique: mocks.findUnique, create: mocks.create } },
}));
vi.mock("@/lib/releaseops/auditEventResponder", async () => {
  const actual = await vi.importActual<typeof import("@/lib/releaseops/auditEventResponder")>(
    "@/lib/releaseops/auditEventResponder",
  );
  return { ...actual, appendAuditEvent: mocks.recordAudit };
});

function getRequest() {
  return new NextRequest("https://visionxixlabs.com/api/desktop/environments", { method: "GET" });
}
function postRequest(body: object) {
  return new NextRequest("https://visionxixlabs.com/api/desktop/environments", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const session = { id: "sess-1", userId: "user-1", organizationId: "org-1", credentialKind: "desktop_session" as const };

describe("GET /api/desktop/environments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveRequestDesktopSession.mockResolvedValue(session);
  });

  it("requires a desktop session", async () => {
    mocks.resolveRequestDesktopSession.mockResolvedValue(undefined);
    const { GET } = await import("../route");
    const res = await GET(getRequest());
    expect(res.status).toBe(401);
  });

  it("lists environments for the session's org", async () => {
    mocks.findMany.mockResolvedValue([
      { id: "e1", slug: "dev", name: "Development", tier: "dev", displayOrder: 0, approvalPolicyId: null, createdAt: new Date("2026-01-01") },
    ]);
    const { GET } = await import("../route");
    const res = await GET(getRequest());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data.environments).toHaveLength(1);
    expect(body.data.environments[0].slug).toBe("dev");
  });
});

describe("POST /api/desktop/environments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveRequestDesktopSession.mockResolvedValue(session);
  });

  it("requires a desktop session", async () => {
    mocks.resolveRequestDesktopSession.mockResolvedValue(undefined);
    const { POST } = await import("../route");
    const res = await POST(postRequest({ slug: "prod", name: "Production", tier: "prod" }));
    expect(res.status).toBe(401);
  });

  it("rejects invalid payloads", async () => {
    const { POST } = await import("../route");
    const res = await POST(postRequest({ slug: "prod" }));
    expect(res.status).toBe(400);
  });

  it("creates the environment and audits it", async () => {
    mocks.findUnique.mockResolvedValue(null);
    mocks.create.mockResolvedValue({ id: "e1", slug: "prod", name: "Production", tier: "prod", displayOrder: 6 });
    const { POST } = await import("../route");
    const res = await POST(postRequest({ slug: "prod", name: "Production", tier: "prod" }));
    const body = await res.json();
    expect(res.status).toBe(201);
    expect(body.data.created).toBe(true);
    const auditCall = mocks.recordAudit.mock.calls[0][1];
    expect(auditCall.kind).toBe("environment.create");
  });
});
