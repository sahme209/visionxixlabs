import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ session: vi.fn(), read: vi.fn() }));
vi.mock("@/lib/desktop/resolveRequestDesktopSession", () => ({ resolveRequestDesktopSession: mocks.session }));
vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("@/lib/terraform/savedPlanRead", () => ({ readSavedPlans: mocks.read }));
import { GET as list } from "../route";
import { GET as detail } from "../[artifactId]/route";
beforeEach(() => { vi.resetAllMocks(); mocks.session.mockResolvedValue({ organizationId: "org", userId: "user" }); mocks.read.mockResolvedValue({ status: 503, body: { ok: false, error: "saved_plan_storage_not_installed" } }); });
it("requires a current paired workspace reader before storage access", async () => {
  mocks.session.mockResolvedValue(undefined);
  expect((await list(new NextRequest("https://fixture/api"), { params: Promise.resolve({ id: "request" }) })).status).toBe(401);
  expect(mocks.read).not.toHaveBeenCalled();
});
it("preserves explicit unavailable storage response without caching", async () => {
  const response = await list(new NextRequest("https://fixture/api"), { params: Promise.resolve({ id: "request" }) });
  expect(response.status).toBe(503); expect(response.headers.get("cache-control")).toBe("no-store");
  expect(mocks.session.mock.calls[0][1]).toMatchObject({ requiredScope: "pipeline:read", requiredCapability: "workspace:read", allowApiKey: false });
  expect(mocks.read.mock.calls[0].slice(1)).toEqual([{ organizationId: "org", requestId: "request" }]);
});
it("passes detail identity only under the authenticated organization", async () => {
  await detail(new NextRequest("https://fixture/api?organizationId=foreign"), { params: Promise.resolve({ id: "request", artifactId: "artifact" }) });
  expect(mocks.read.mock.calls[0].slice(1)).toEqual([{ organizationId: "org", requestId: "request" }, "artifact"]);
});
