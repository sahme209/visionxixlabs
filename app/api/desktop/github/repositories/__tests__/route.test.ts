import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  resolveRequestDesktopSession: vi.fn(),
  findFirst: vi.fn(),
  resolveGithubInstallationToken: vi.fn(),
}));

vi.mock("@/lib/desktop/resolveRequestDesktopSession", () => ({
  resolveRequestDesktopSession: mocks.resolveRequestDesktopSession,
}));
vi.mock("@/lib/db", () => ({ prisma: { gitHubInstallation: { findFirst: mocks.findFirst } } }));
vi.mock("@/lib/connectors/github/githubAppAuth", () => ({
  resolveGithubInstallationToken: mocks.resolveGithubInstallationToken,
}));

const session = { id: "sess-1", userId: "user-1", organizationId: "org-1", credentialKind: "desktop_session" as const };
const request = () => new NextRequest("https://visionxixlabs.com/api/desktop/github/repositories");

describe("GET /api/desktop/github/repositories", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveRequestDesktopSession.mockResolvedValue(session);
    mocks.findFirst.mockResolvedValue({ githubInstallationId: "123" });
    mocks.resolveGithubInstallationToken.mockResolvedValue({ ok: true, token: "server-only-token" });
  });

  afterEach(() => vi.unstubAllGlobals());

  it("requires a verified desktop administrator session", async () => {
    mocks.resolveRequestDesktopSession.mockResolvedValue(undefined);
    const { GET } = await import("../route");
    const response = await GET(request());
    expect(response.status).toBe(401);
    expect(mocks.findFirst).not.toHaveBeenCalled();
  });

  it("returns a clear disconnected state", async () => {
    mocks.findFirst.mockResolvedValue(null);
    const { GET } = await import("../route");
    const response = await GET(request());
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ ok: false, error: "github_not_connected" });
  });

  it("returns only normalized repository metadata and never the token", async () => {
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => {
      expect(init?.headers).toMatchObject({ Authorization: "Bearer server-only-token" });
      return new Response(JSON.stringify({
        total_count: 3,
        repositories: [
          { id: 2, name: "zeta", full_name: "acme/zeta", private: true, default_branch: "trunk", owner: { login: "acme" } },
          { id: 1, name: "alpha", full_name: "acme/alpha", private: false, default_branch: "main", owner: { login: "acme" } },
          { id: "invalid", name: "ignored" },
        ],
      }), { status: 200, headers: { "content-type": "application/json" } });
    }));
    const { GET } = await import("../route");
    const response = await GET(request());
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.data).toEqual({
      repositories: [
        { id: "1", name: "alpha", fullName: "acme/alpha", owner: "acme", defaultBranch: "main", visibility: "public" },
        { id: "2", name: "zeta", fullName: "acme/zeta", owner: "acme", defaultBranch: "trunk", visibility: "private" },
      ],
      totalCount: 3,
      truncated: true,
    });
    expect(JSON.stringify(body)).not.toContain("server-only-token");
  });

  it("fails closed when GitHub cannot be reached", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));
    const { GET } = await import("../route");
    const response = await GET(request());
    expect(response.status).toBe(503);
  });
});
