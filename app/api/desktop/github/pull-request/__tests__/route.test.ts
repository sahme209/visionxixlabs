import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  resolveRequestDesktopSession: vi.fn(),
  resolveTenantScopedToken: vi.fn(),
  createPullRequest: vi.fn(),
  recordAudit: vi.fn(async () => {}),
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
vi.mock("@/lib/connectors/github/githubWriteClient", () => ({ createPullRequest: mocks.createPullRequest }));
vi.mock("@/lib/audit/secureAudit", () => ({ record: mocks.recordAudit }));

function request(body: object) {
  return new NextRequest("https://visionxixlabs.com/api/desktop/github/pull-request", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const session = { id: "sess-1", userId: "user-1", organizationId: "org-1", credentialKind: "desktop_session" as const };
const payload = { repositoryFullName: "acme/widgets", head: "feature-x", base: "main", title: "Add a.txt", body: "Adds a.txt" };

describe("POST /api/desktop/github/pull-request", () => {
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

  it("opens the PR, audits the PR number, and returns the PR URL", async () => {
    mocks.resolveTenantScopedToken.mockResolvedValue({ ok: true, token: "installation-token" });
    mocks.createPullRequest.mockResolvedValue({ ok: true, data: { number: 42, htmlUrl: "https://github.com/acme/widgets/pull/42" } });

    const { POST } = await import("../route");
    const res = await POST(request(payload));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.htmlUrl).toBe("https://github.com/acme/widgets/pull/42");
    expect(mocks.recordAudit).toHaveBeenCalledWith(expect.objectContaining({
      action: "github.pull_request_opened",
      detail: expect.objectContaining({ pullRequestNumber: 42 }),
    }));
  });

  it("returns 502 when GitHub rejects the PR", async () => {
    mocks.resolveTenantScopedToken.mockResolvedValue({ ok: true, token: "installation-token" });
    mocks.createPullRequest.mockResolvedValue({ ok: false, error: "pull_request_create_failed: github_422" });
    const { POST } = await import("../route");
    const res = await POST(request(payload));
    expect(res.status).toBe(502);
  });
});
