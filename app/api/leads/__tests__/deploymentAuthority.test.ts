import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ session: vi.fn(), find: vi.fn(), update: vi.fn(), deploy: vi.fn(), verify: vi.fn(), generate: vi.fn() }));
vi.mock("next-auth", () => ({ getServerSession: mocks.session }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/db", () => ({ prisma: { lead: { findUnique: mocks.find, update: mocks.update } } }));
vi.mock("@/lib/previewDeploy", () => ({ deployPreview: mocks.deploy, deployPreviewFromPlan: mocks.deploy }));
vi.mock("@/lib/starterToken", () => ({ verifyStarterToken: mocks.verify }));
vi.mock("@/lib/rateLimit", () => ({ checkRateLimit: () => true }));
vi.mock("@/lib/websiteStarter/engine", () => ({ generateWebsiteStarterWithChanges: mocks.generate, generateWebsiteStarter: mocks.generate }));
vi.mock("@/lib/async/engineRunner", () => ({ runAsyncLeadEngine: vi.fn() }));
vi.mock("@/lib/observability/events", () => ({ eventEngineTriggered: vi.fn(), eventEngineCompleted: vi.fn(), eventEngineFailed: vi.fn() }));
beforeEach(() => {
  vi.resetModules(); vi.clearAllMocks(); vi.stubEnv("ADMIN_EMAILS", "admin@example.test");
  mocks.find.mockResolvedValue({ id: "lead_fixture", status: "package_ready", fullPayload: { aiPackage: { companyName: "fixture" }, form: { tier: "starter" } } });
  mocks.update.mockResolvedValue({});
  mocks.deploy.mockResolvedValue({ url: "https://fixture.vercel.app", deploymentId: "dpl_fixture", state: "READY" });
  mocks.verify.mockReturnValue({ leadId: "lead_fixture" });
  mocks.generate.mockResolvedValue({ companyName: "updated" });
});
afterEach(() => vi.unstubAllEnvs());
const params = { params: Promise.resolve({ id: "lead_fixture" }) };
describe.each(["preview", "publish"])("admin %s deployment authority", (kind) => {
  const load = () => kind === "preview" ? import("../[id]/deploy-preview/route") : import("../[id]/publish/route");
  it.each([[null, 401], [{ user: { email: "other@example.test" } }, 403]])("denies unauthorized caller before lead lookup or provider work", async (session, status) => {
    mocks.session.mockResolvedValue(session);
    const { POST } = await load();
    const response = await POST(new NextRequest("https://example.test/api/leads/lead_fixture/deploy", { method: "POST" }), params);
    expect(response.status).toBe(status);
    expect(mocks.find).not.toHaveBeenCalled(); expect(mocks.update).not.toHaveBeenCalled(); expect(mocks.deploy).not.toHaveBeenCalled();
  });
  it("allows the existing configured admin to deploy the selected package", async () => {
    mocks.session.mockResolvedValue({ user: { id: "admin_fixture", email: "ADMIN@example.test" } });
    const { POST } = await load();
    const response = await POST(new NextRequest("https://example.test/api/leads/lead_fixture/deploy", { method: "POST" }), params);
    expect(response.status).toBe(200);
    expect(mocks.deploy).toHaveBeenCalledWith({ companyName: "fixture" }, `${kind === "preview" ? "preview" : "prod"}-_fixture`);
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "lead_fixture" }, data: expect.objectContaining({ status: kind === "preview" ? "deploy_ready" : "published" }) }));
  });
});
it("preserves signed lead-token preview revisions without an admin session", async () => {
  const { POST } = await import("../[id]/preview/update/route");
  const response = await POST(new NextRequest("https://example.test/api/leads/lead_fixture/preview/update?token=signed-fixture", { method: "POST", body: JSON.stringify({ changeRequest: "update heading" }) }), params);
  expect(response.status).toBe(200);
  expect(mocks.verify).toHaveBeenCalledWith("signed-fixture"); expect(mocks.session).not.toHaveBeenCalled();
  expect(mocks.deploy).toHaveBeenCalledWith({ companyName: "updated" }, "preview-_fixture");
});
it("preserves signed public trigger access for an already-ready preview", async () => {
  mocks.find.mockResolvedValue({ id: "lead_fixture", status: "deploy_ready" });
  const { POST } = await import("../trigger/route");
  const response = await POST(new NextRequest("https://example.test/api/leads/trigger?token=signed-fixture", { method: "POST" }));
  expect(response.status).toBe(200); expect(mocks.verify).toHaveBeenCalledWith("signed-fixture");
  expect(mocks.session).not.toHaveBeenCalled(); expect(mocks.deploy).not.toHaveBeenCalled();
});
it.each([{ leadId: "another_lead" }, { error: "expired" }, { error: "invalid" }])("keeps signed public preview authority bound to the intended lead", async (verification) => {
  mocks.verify.mockReturnValue(verification);
  const { POST } = await import("../[id]/preview/update/route");
  const response = await POST(new NextRequest("https://example.test/api/leads/lead_fixture/preview/update?token=rejected-fixture", { method: "POST", body: JSON.stringify({ changeRequest: "update heading" }) }), params);
  expect(response.status).toBe(401);
  expect(mocks.find).not.toHaveBeenCalled(); expect(mocks.deploy).not.toHaveBeenCalled(); expect(mocks.session).not.toHaveBeenCalled();
});
