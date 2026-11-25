import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ session: vi.fn(), find: vi.fn(), update: vi.fn(), claim: vi.fn(), deploy: vi.fn(), verify: vi.fn(), generate: vi.fn() }));
vi.mock("next-auth", () => ({ getServerSession: mocks.session }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/db", () => ({ prisma: { lead: { findUnique: mocks.find, update: mocks.update, updateMany: mocks.claim } } }));
vi.mock("@/lib/previewDeploy", () => ({ deployPreview: mocks.deploy, deployPreviewFromPlan: mocks.deploy, deployProduction: mocks.deploy }));
vi.mock("@/lib/starterToken", () => ({ verifyStarterToken: mocks.verify }));
vi.mock("@/lib/rateLimit", () => ({ checkRateLimit: () => true }));
vi.mock("@/lib/websiteStarter/engine", () => ({ generateWebsiteStarterWithChanges: mocks.generate, generateWebsiteStarter: mocks.generate }));
vi.mock("@/lib/observability/events", () => ({ eventEngineTriggered: vi.fn(), eventEngineCompleted: vi.fn(), eventEngineFailed: vi.fn() }));
beforeEach(() => {
  vi.resetModules(); vi.clearAllMocks(); vi.stubEnv("ADMIN_EMAILS", "admin@example.test");
  mocks.find.mockResolvedValue({ id: "lead_fixture", status: "package_ready", fullPayload: { aiPackage: { companyName: "fixture" }, form: { tier: "starter" } } });
  mocks.update.mockResolvedValue({});
  mocks.deploy.mockResolvedValue({ url: "https://fixture.vercel.app", deploymentId: "dpl_fixture", state: "READY", target: "production" });
  mocks.verify.mockReturnValue({ leadId: "lead_fixture" });
  mocks.generate.mockResolvedValue({ companyName: "updated" });
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
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
    if (kind === "preview") {
      expect(response.status).toBe(503);
      expect(await response.json()).toMatchObject({ code: "website_preview_requires_governance" });
      expect(mocks.deploy).not.toHaveBeenCalled();
      expect(mocks.update).not.toHaveBeenCalled();
    } else {
      expect(response.status).toBe(200);
      expect(mocks.deploy).toHaveBeenCalledWith({ companyName: "fixture" }, "prod-_fixture");
      expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "lead_fixture" }, data: expect.objectContaining({ status: "published" }) }));
    }
  });
});
it("honors signed lead-token revision access before reporting the governance requirement", async () => {
  const { POST } = await import("../[id]/preview/update/route");
  const response = await POST(new NextRequest("https://example.test/api/leads/lead_fixture/preview/update?token=signed-fixture", { method: "POST", body: JSON.stringify({ changeRequest: "update heading" }) }), params);
  expect(response.status).toBe(503);
  expect(await response.json()).toMatchObject({ code: "website_preview_requires_governance" });
  expect(mocks.verify).toHaveBeenCalledWith("signed-fixture"); expect(mocks.session).not.toHaveBeenCalled();
  expect(mocks.generate).not.toHaveBeenCalled();
  expect(mocks.deploy).not.toHaveBeenCalled();
  expect(mocks.update).not.toHaveBeenCalled();
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
describe.each(["PENDING", "QUEUED", "BUILDING", "UNKNOWN"])("non-ready deployment %s", (state) => {
  it("does not mark publication ready merely because the provider returns a URL", async () => {
    mocks.session.mockResolvedValue({ user: { email: "admin@example.test" } });
    mocks.deploy.mockResolvedValue({ url: "https://candidate.vercel.app", deploymentId: "dpl_candidate", state });
    const { POST } = await import("../[id]/publish/route");
    const response = await POST(new NextRequest("https://example.test/api/leads/lead_fixture/deploy", { method: "POST" }), params);
    expect(response.status).toBe(200);
    const final = mocks.update.mock.calls.at(-1)![0].data;
    expect(final.status).not.toBe("deploy_ready"); expect(final.status).not.toBe("published");
    expect(final.fullPayload.previewUrl).toBeUndefined(); expect(final.fullPayload.productionUrl).toBeUndefined(); expect(final.fullPayload.publishedAt).toBeUndefined();
    expect(final.fullPayload.productionDeployment).toMatchObject({ deploymentId: "dpl_candidate", state });
  });
});
it.each(["plan", "package", "pending receipt"])("keeps existing public %s state intact without starting a build", async (path) => {
  const send = vi.fn(); vi.stubGlobal("fetch", send);
  const fullPayload = path === "plan"
    ? { websiteBuilderPlan: { siteName: "fixture", fullPageHtml: "<h1>fixture</h1>" } }
    : { aiPackage: { companyName: "fixture" } };
  mocks.find.mockResolvedValue({
    id: "lead_fixture",
    status: path === "pending receipt" ? "deploy_generating" : "package_ready",
    fullPayload,
  });
  const { POST } = await import("../trigger/route");
  const response = await POST(new NextRequest("https://example.test/api/leads/trigger?token=signed-fixture", { method: "POST" }));
  expect(response.status).toBe(503);
  expect(await response.json()).toMatchObject({ code: "website_preview_requires_governance" });
  expect(mocks.update).not.toHaveBeenCalled();
  expect(mocks.claim).not.toHaveBeenCalled();
  expect(mocks.generate).not.toHaveBeenCalled();
  expect(mocks.deploy).not.toHaveBeenCalled();
  expect(send).not.toHaveBeenCalled();
});

it("stores a newly generated website package without claiming deployment", async () => {
  const row = { id: "lead_fixture", source: "website-request", status: "created", updatedAt: new Date(0), fullPayload: { form: { tier: "starter" } } };
  mocks.find.mockResolvedValue(row);
  let current = row;
  mocks.claim.mockImplementation(async ({ data }) => {
    current = { ...current, ...data };
    mocks.find.mockResolvedValue(current);
    return { count: 1 };
  });
  const { POST } = await import("../trigger/route");
  const response = await POST(new NextRequest("https://example.test/api/leads/trigger?token=signed-fixture", { method: "POST" }));
  expect(response.status).toBe(503);
  expect(mocks.generate).toHaveBeenCalledOnce();
  expect(mocks.deploy).not.toHaveBeenCalled();
  expect(mocks.update).toHaveBeenCalledOnce();
  expect(mocks.update.mock.calls[0][0].data).toMatchObject({
    status: "package_ready",
    fullPayload: { form: { tier: "starter" }, aiPackage: { companyName: "updated" } },
  });
});
it.each([{ url: "", deploymentId: "dpl_candidate" }, { url: "https://candidate.vercel.app", deploymentId: "" }])("does not publish a malformed READY receipt", async (receipt) => {
  mocks.session.mockResolvedValue({ user: { email: "admin@example.test" } });
  mocks.deploy.mockResolvedValue({ ...receipt, state: "READY" });
  const { POST } = await import("../[id]/publish/route");
  await POST(new NextRequest("https://example.test/api/leads/lead_fixture/publish", { method: "POST" }), params);
  const final = mocks.update.mock.calls.at(-1)![0].data;
  expect(final.status).not.toBe("published"); expect(final.fullPayload.publishedAt).toBeUndefined();
  expect(final.fullPayload.productionDeployment.state).toBe("UNKNOWN");
});
describe("existing status endpoint admin observation mode", () => {
  it.each([[null, 401], [{ user: { email: "other@example.test" } }, 403]])("denies unauthorized lead-ID observation before lookup", async (session, status) => {
    mocks.session.mockResolvedValue(session);
    const { GET } = await import("../status/route");
    const response = await GET(new NextRequest("https://example.test/api/leads/status?leadId=lead_fixture"));
    expect(response.status).toBe(status); expect(mocks.find).not.toHaveBeenCalled(); expect(mocks.deploy).not.toHaveBeenCalled();
  });
  it("allows configured admin to inspect the selected lead without a public token", async () => {
    mocks.session.mockResolvedValue({ user: { email: "admin@example.test" } });
    const { GET } = await import("../status/route");
    const response = await GET(new NextRequest("https://example.test/api/leads/status?leadId=lead_fixture"));
    expect(response.status).toBe(200); expect((await response.json()).leadId).toBe("lead_fixture");
    expect(mocks.find).toHaveBeenCalledWith({ where: { id: "lead_fixture" } }); expect(mocks.verify).not.toHaveBeenCalled(); expect(mocks.deploy).not.toHaveBeenCalled();
  });
  it.each(["bad-token", ""])("never falls back from explicit invalid token to admin authority", async (token) => {
    mocks.session.mockResolvedValue({ user: { email: "admin@example.test" } }); mocks.verify.mockReturnValue({ error: "invalid" });
    const { GET } = await import("../status/route");
    const response = await GET(new NextRequest(`https://example.test/api/leads/status?leadId=lead_fixture&token=${token}`));
    expect(response.status).toBe(401); expect(mocks.find).not.toHaveBeenCalled(); expect(mocks.session).not.toHaveBeenCalled();
  });
});
it.each([undefined, "preview"])("does not publish READY response with unconfirmed production target %s", async (target) => {
  mocks.session.mockResolvedValue({ user: { email: "admin@example.test" } });
  mocks.deploy.mockResolvedValue({ url: "https://candidate.vercel.app", deploymentId: "dpl_candidate", state: "READY", target });
  const { POST } = await import("../[id]/publish/route");
  const response = await POST(new NextRequest("https://example.test/api/leads/lead_fixture/publish", { method: "POST" }), params);
  expect((await response.json()).deploymentPending).toBe(true);
  expect(mocks.update.mock.calls.at(-1)![0].data.fullPayload.publishedAt).toBeUndefined();
  expect(mocks.update.mock.calls.at(-1)![0].data.status).not.toBe("published");
});
