import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  resolveRequestDesktopSession: vi.fn(),
  resolveTenantScopedToken: vi.fn(),
  commitFile: vi.fn(),
  recordAudit: vi.fn(async (_input: import("@/lib/audit/secureAudit").RecordInput) => {}),
}));

vi.mock("@/lib/desktop/resolveRequestDesktopSession", () => ({
  resolveRequestDesktopSession: mocks.resolveRequestDesktopSession,
}));
vi.mock("@/lib/connectors/github/resolveTenantScopedToken", async () => {
  const actual = await vi.importActual<typeof import("@/lib/connectors/github/resolveTenantScopedToken")>(
    "@/lib/connectors/github/resolveTenantScopedToken",
  );
  return { ...actual, resolveTenantScopedToken: mocks.resolveTenantScopedToken };
});
vi.mock("@/lib/connectors/github/githubWriteClient", () => ({ commitFile: mocks.commitFile }));
vi.mock("@/lib/audit/secureAudit", () => ({ record: mocks.recordAudit }));

function request(body: object) {
  return new NextRequest("https://visionxixlabs.com/api/desktop/github/commit", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const session = { id: "sess-1", userId: "user-1", organizationId: "org-1", credentialKind: "desktop_session" as const };
const payload = { repositoryFullName: "acme/widgets", branch: "feature-x", path: "a.txt", content: "secret file contents", message: "add a.txt" };

describe("POST /api/desktop/github/commit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveRequestDesktopSession.mockResolvedValue(session);
  });

  it("requires a desktop session", async () => {
    mocks.resolveRequestDesktopSession.mockResolvedValue(undefined);
    const { POST } = await import("../route");
    const res = await POST(request(payload));
    expect(res.status).toBe(401);
  });

  it("commits the file, audits identifiers only (never file content), and returns the result", async () => {
    mocks.resolveTenantScopedToken.mockResolvedValue({ ok: true, token: "installation-token" });
    mocks.commitFile.mockResolvedValue({ ok: true, data: { sha: "newsha", htmlUrl: "https://github.com/acme/widgets/blob/feature-x/a.txt" } });

    const { POST } = await import("../route");
    const res = await POST(request(payload));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    const auditCall = mocks.recordAudit.mock.calls[0][0];
    expect(JSON.stringify(auditCall.detail)).not.toContain("secret file contents");
    expect(auditCall.detail).toEqual({ repositoryFullName: "acme/widgets", branch: "feature-x", path: "a.txt" });
  });

  it("returns 502 when the commit fails", async () => {
    mocks.resolveTenantScopedToken.mockResolvedValue({ ok: true, token: "installation-token" });
    mocks.commitFile.mockResolvedValue({ ok: false, error: "github_409: sha mismatch" });
    const { POST } = await import("../route");
    const res = await POST(request(payload));
    expect(res.status).toBe(502);
    expect(mocks.recordAudit).not.toHaveBeenCalled();
  });
});
