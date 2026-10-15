import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  resolve: vi.fn(),
  list: vi.fn(),
  detail: vi.fn(),
  activity: vi.fn(),
  lifecycle: vi.fn(),
}));

vi.mock("@/lib/desktop/resolveRequestDesktopSession", () => ({ resolveRequestDesktopSession: mocks.resolve }));
vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("@/lib/releaseops/releaseListResponder", () => ({ buildReleaseListResponse: mocks.list }));
vi.mock("@/lib/releaseops/releaseDetailResponder", () => ({ buildReleaseDetailResponse: mocks.detail }));
vi.mock("@/lib/releaseops/releaseActivityResponder", () => ({ buildReleaseActivityResponse: mocks.activity }));
vi.mock("@/lib/releaseops/releaseLifecycleResponder", () => ({
  ALL_LIFECYCLE_ACTIONS: ["finalize_scope", "start_deploy", "complete_deploy", "mark_rolled_back", "mark_failed"],
  buildReleaseLifecycleResponse: mocks.lifecycle,
}));

const session = { id: "session-1", userId: "user-1", organizationId: "org-1", credentialKind: "desktop_session" as const };
const request = (url: string, init?: ConstructorParameters<typeof NextRequest>[1]) => new NextRequest(url, init);

describe("desktop release workspace routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolve.mockResolvedValue(session);
    mocks.list.mockResolvedValue({ status: 200, body: { ok: true, data: { releases: [] } } });
    mocks.detail.mockResolvedValue({ status: 200, body: { ok: true, data: { release: { id: "rel-1" } } } });
    mocks.activity.mockResolvedValue({ status: 200, body: { ok: true, data: { releaseId: "rel-1", events: [] } } });
    mocks.lifecycle.mockResolvedValue({ status: 200, body: { ok: true, data: { previousStatus: "draft", status: "ready" } } });
  });

  it("requires a paired desktop session for release reads", async () => {
    mocks.resolve.mockResolvedValue(undefined);
    const { GET } = await import("../route");
    const res = await GET(request("https://app.test/api/desktop/release-workspace"));
    expect(res.status).toBe(401);
    expect(mocks.list).not.toHaveBeenCalled();
  });

  it("scopes the release list to the paired workspace", async () => {
    const { GET } = await import("../route");
    const res = await GET(request("https://app.test/api/desktop/release-workspace"));
    expect(res.status).toBe(200);
    expect(mocks.resolve).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      requiredScope: "pipeline:read", allowApiKey: false,
    }));
    expect(mocks.list.mock.calls[0][1]).toBe("org-1");
  });

  it("uses the paired workspace for detail and activity", async () => {
    const detail = await import("../[id]/route");
    const activity = await import("../[id]/activity/route");
    await detail.GET(request("https://app.test/api/desktop/release-workspace/rel-1?repositoryId=repo-1"), { params: Promise.resolve({ id: "rel-1" }) });
    await activity.GET(request("https://app.test/api/desktop/release-workspace/rel-1/activity"), { params: Promise.resolve({ id: "rel-1" }) });
    expect(mocks.detail.mock.calls[0][1]).toMatchObject({ organizationId: "org-1", releaseId: "rel-1", repositoryId: "repo-1" });
    expect(mocks.activity.mock.calls[0][1]).toMatchObject({ organizationId: "org-1", releaseId: "rel-1" });
  });

  it("admin-gates lifecycle transitions and preserves the paired actor", async () => {
    const { POST } = await import("../lifecycle/route");
    const res = await POST(request("https://app.test/api/desktop/release-workspace/lifecycle", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ releaseId: "rel-1", action: "finalize_scope" }),
    }));
    expect(res.status).toBe(200);
    expect(mocks.resolve).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ requireWorkspaceAdmin: true }));
    expect(mocks.lifecycle.mock.calls[0][1]).toMatchObject({ organizationId: "org-1", actorUserId: "user-1", releaseId: "rel-1" });
  });

  it("rejects malformed lifecycle payloads before invoking the responder", async () => {
    const { POST } = await import("../lifecycle/route");
    const res = await POST(request("https://app.test/api/desktop/release-workspace/lifecycle", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ releaseId: "rel-1", action: "delete" }),
    }));
    expect(res.status).toBe(400);
    expect(mocks.lifecycle).not.toHaveBeenCalled();
  });
});
