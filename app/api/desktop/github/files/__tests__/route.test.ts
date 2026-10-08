import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  resolveRequestDesktopSession: vi.fn(),
  resolveTenantScopedToken: vi.fn(),
  listRepositoryFiles: vi.fn(),
}));

vi.mock("@/lib/desktop/resolveRequestDesktopSession", () => ({ resolveRequestDesktopSession: mocks.resolveRequestDesktopSession }));
vi.mock("@/lib/connectors/github/resolveTenantScopedToken", () => ({
  resolveTenantScopedToken: mocks.resolveTenantScopedToken,
  parseRepositoryFullName: (value: string) => {
    const parts = value.split("/");
    return parts.length === 2 && parts.every(Boolean) ? { owner: parts[0], repo: parts[1] } : null;
  },
}));
vi.mock("@/lib/connectors/github/githubWriteClient", () => ({ listRepositoryFiles: mocks.listRepositoryFiles }));

const session = { id: "sess-1", userId: "user-1", organizationId: "org-1", credentialKind: "desktop_session" as const };
const request = (repository = "acme/widgets", branch = "main") => new NextRequest(`https://visionxixlabs.com/api/desktop/github/files?repositoryFullName=${encodeURIComponent(repository)}&branch=${encodeURIComponent(branch)}`);

describe("GET /api/desktop/github/files", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveRequestDesktopSession.mockResolvedValue(session);
    mocks.resolveTenantScopedToken.mockResolvedValue({ ok: true, token: "repo-token" });
    mocks.listRepositoryFiles.mockResolvedValue({ ok: true, data: { files: [{ path: "src/index.ts", size: 42 }], truncated: false } });
  });

  it("requires a desktop session", async () => {
    mocks.resolveRequestDesktopSession.mockResolvedValue(undefined);
    const { GET } = await import("../route");
    const response = await GET(request());
    expect(response.status).toBe(401);
    expect(mocks.resolveTenantScopedToken).not.toHaveBeenCalled();
  });

  it("rejects malformed repository and branch input before token minting", async () => {
    const { GET } = await import("../route");
    expect((await GET(request("bad", "main"))).status).toBe(400);
    expect((await GET(request("acme/widgets", ""))).status).toBe(400);
    expect(mocks.resolveTenantScopedToken).not.toHaveBeenCalled();
  });

  it("returns files using an exact repository-scoped token", async () => {
    const { GET } = await import("../route");
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(mocks.resolveTenantScopedToken).toHaveBeenCalledWith("org-1", { owner: "acme", repo: "widgets" });
    expect(mocks.listRepositoryFiles).toHaveBeenCalledWith({ owner: "acme", repo: "widgets", branch: "main", installationToken: "repo-token" });
    expect(await response.json()).toEqual({ ok: true, data: { files: [{ path: "src/index.ts", size: 42 }], truncated: false } });
  });
});
