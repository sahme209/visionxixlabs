import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  resolveRequestDesktopSession: vi.fn(),
  resolveTenantScopedToken: vi.fn(),
  createBranch: vi.fn(),
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
vi.mock("@/lib/connectors/github/githubWriteClient", () => ({ createBranch: mocks.createBranch }));
vi.mock("@/lib/audit/secureAudit", () => ({ record: mocks.recordAudit }));

function request(body: object) {
  return new NextRequest("https://visionxixlabs.com/api/desktop/github/branch", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const session = { id: "sess-1", userId: "user-1", organizationId: "org-1", credentialKind: "desktop_session" as const };

describe("POST /api/desktop/github/branch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveRequestDesktopSession.mockResolvedValue(session);
  });

  it("requires a desktop session", async () => {
    mocks.resolveRequestDesktopSession.mockResolvedValue(undefined);
    const { POST } = await import("../route");
    const res = await POST(request({ repositoryFullName: "acme/widgets", baseBranch: "main", newBranchName: "feature-x" }));
    expect(res.status).toBe(401);
    expect(mocks.resolveTenantScopedToken).not.toHaveBeenCalled();
  });

  it("rejects an invalid payload before touching GitHub", async () => {
    const { POST } = await import("../route");
    const res = await POST(request({ repositoryFullName: "acme/widgets" }));
    expect(res.status).toBe(400);
    expect(mocks.resolveTenantScopedToken).not.toHaveBeenCalled();
  });

  it("rejects a malformed repository full name", async () => {
    const { POST } = await import("../route");
    const res = await POST(request({ repositoryFullName: "not-owner-slash-repo", baseBranch: "main", newBranchName: "feature-x" }));
    expect(res.status).toBe(400);
  });

  it("returns 409 when the tenant has no connected installation", async () => {
    mocks.resolveTenantScopedToken.mockResolvedValue({ ok: false, error: "github_not_connected" });
    const { POST } = await import("../route");
    const res = await POST(request({ repositoryFullName: "acme/widgets", baseBranch: "main", newBranchName: "feature-x" }));
    expect(res.status).toBe(409);
    expect(mocks.createBranch).not.toHaveBeenCalled();
  });

  it("creates the branch, audits it, and returns the result on success", async () => {
    mocks.resolveTenantScopedToken.mockResolvedValue({ ok: true, token: "installation-token" });
    mocks.createBranch.mockResolvedValue({ ok: true, data: { ref: "refs/heads/feature-x", sha: "abc123" } });

    const { POST } = await import("../route");
    const res = await POST(request({ repositoryFullName: "acme/widgets", baseBranch: "main", newBranchName: "feature-x" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true, data: { ref: "refs/heads/feature-x", sha: "abc123" } });
    expect(mocks.createBranch).toHaveBeenCalledWith(expect.objectContaining({
      owner: "acme", repo: "widgets", baseBranch: "main", newBranchName: "feature-x", installationToken: "installation-token",
    }));
    expect(mocks.recordAudit).toHaveBeenCalledWith(expect.objectContaining({
      action: "github.branch_created",
      detail: { repositoryFullName: "acme/widgets", baseBranch: "main", newBranchName: "feature-x" },
    }));
  });

  it("returns 502 and skips the audit when GitHub rejects the branch create", async () => {
    mocks.resolveTenantScopedToken.mockResolvedValue({ ok: true, token: "installation-token" });
    mocks.createBranch.mockResolvedValue({ ok: false, error: "base_branch_not_found: github_404" });

    const { POST } = await import("../route");
    const res = await POST(request({ repositoryFullName: "acme/widgets", baseBranch: "ghost", newBranchName: "feature-x" }));

    expect(res.status).toBe(502);
    expect(mocks.recordAudit).not.toHaveBeenCalled();
  });
});
