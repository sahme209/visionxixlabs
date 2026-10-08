import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  resolveRequestDesktopSession: vi.fn(),
  resolveTenantScopedToken: vi.fn(),
  listBranches: vi.fn(),
}));

vi.mock("@/lib/desktop/resolveRequestDesktopSession", () => ({ resolveRequestDesktopSession: mocks.resolveRequestDesktopSession }));
vi.mock("@/lib/connectors/github/resolveTenantScopedToken", () => ({
  resolveTenantScopedToken: mocks.resolveTenantScopedToken,
  parseRepositoryFullName: (value: string) => {
    const parts = value.split("/");
    return parts.length === 2 && parts.every(Boolean) ? { owner: parts[0], repo: parts[1] } : null;
  },
}));
vi.mock("@/lib/connectors/github/githubWriteClient", () => ({ listBranches: mocks.listBranches }));

const session = { id: "sess-1", userId: "user-1", organizationId: "org-1", credentialKind: "desktop_session" as const };
const request = (repositoryFullName = "acme/widgets") => new NextRequest(`https://visionxixlabs.com/api/desktop/github/branches?repositoryFullName=${encodeURIComponent(repositoryFullName)}`);

describe("GET /api/desktop/github/branches", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveRequestDesktopSession.mockResolvedValue(session);
    mocks.resolveTenantScopedToken.mockResolvedValue({ ok: true, token: "repo-scoped-token" });
    mocks.listBranches.mockResolvedValue({ ok: true, data: [{ name: "main", commitSha: "abc", protected: true }] });
  });

  it("requires a desktop session", async () => {
    mocks.resolveRequestDesktopSession.mockResolvedValue(undefined);
    const { GET } = await import("../route");
    const response = await GET(request());
    expect(response.status).toBe(401);
    expect(mocks.resolveTenantScopedToken).not.toHaveBeenCalled();
  });

  it("rejects malformed repository names before minting a token", async () => {
    const { GET } = await import("../route");
    const response = await GET(request("not-a-repository"));
    expect(response.status).toBe(400);
    expect(mocks.resolveTenantScopedToken).not.toHaveBeenCalled();
  });

  it("lists branches with an exact repository-scoped installation token", async () => {
    const { GET } = await import("../route");
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(mocks.resolveTenantScopedToken).toHaveBeenCalledWith("org-1", { owner: "acme", repo: "widgets" });
    expect(mocks.listBranches).toHaveBeenCalledWith({ owner: "acme", repo: "widgets", installationToken: "repo-scoped-token" });
    expect(await response.json()).toEqual({ ok: true, data: { branches: [{ name: "main", commitSha: "abc", protected: true }], truncated: false } });
  });
});
