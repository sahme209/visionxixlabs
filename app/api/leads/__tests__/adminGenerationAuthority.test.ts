import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { adminGenerationRevision } from "@/lib/async/adminGenerationIntent";

const mocks = vi.hoisted(() => ({ session: vi.fn(), findLead: vi.fn(), updateLead: vi.fn(), claimLead: vi.fn(), generate: vi.fn() }));
vi.mock("next-auth", () => ({ getServerSession: mocks.session }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/db", () => ({ prisma: { lead: { findUnique: mocks.findLead, update: mocks.updateLead, updateMany: mocks.claimLead } } }));
vi.mock("@/lib/websiteStarter/engine", () => ({ generateWebsiteStarter: mocks.generate }));

const firstRequestId = "229e0391-85ce-4f5e-b342-5216a22e0001";
const secondRequestId = "229e0391-85ce-4f5e-b342-5216a22e0002";
const initialLead = {
  id: "lead_1", source: "website-request", status: "created", updatedAt: new Date(0),
  fullPayload: { form: { email: "customer@example.test", tier: "starter" }, preserved: "keep" },
};
const initialRevision = adminGenerationRevision(initialLead);

// Real requireAdmin and route boundaries; only identity, storage and AI IO are
// simulated. The page layout cannot supply authority for a direct API request.
describe("admin lead generation and tier authority", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.resetAllMocks();
    vi.stubEnv("ADMIN_EMAILS", "operator@example.test,another@example.test");
    mocks.findLead.mockResolvedValue(initialLead);
    mocks.claimLead.mockImplementation(async ({ data }) => {
      const current = await mocks.findLead();
      mocks.findLead.mockResolvedValue({ ...current, ...data });
      return { count: 1 };
    });
    mocks.updateLead.mockImplementation(async ({ data }) => {
      const current = await mocks.findLead();
      const saved = { ...current, ...data, updatedAt: new Date(current.updatedAt.getTime() + 1) };
      mocks.findLead.mockResolvedValue(saved);
      return saved;
    });
    mocks.generate.mockResolvedValue({ companyName: "Customer" });
  });
  afterEach(() => vi.unstubAllEnvs());

  async function invoke(route: "generate" | "upgrade-tier", requestId = firstRequestId, revision = initialRevision) {
    const { POST } = route === "generate" ? await import("../[id]/generate/route") : await import("../[id]/upgrade-tier/route");
    const request = new NextRequest(`https://example.test/api/leads/lead_1/${route}`, {
      method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": requestId, "X-V19-Lead-Revision": revision }, body: JSON.stringify({ tier: "growth" }),
    });
    const response = await POST(request, { params: Promise.resolve({ id: "lead_1" }) });
    return response;
  }

  it.each(["generate", "upgrade-tier"] as const)("rejects unauthenticated %s before lookup, mutation or AI", async (route) => {
    mocks.session.mockResolvedValue(null);
    expect((await invoke(route)).status).toBe(401);
    expect(mocks.findLead).not.toHaveBeenCalled();
    expect(mocks.updateLead).not.toHaveBeenCalled();
    expect(mocks.claimLead).not.toHaveBeenCalled();
    expect(mocks.generate).not.toHaveBeenCalled();
  });

  it.each(["generate", "upgrade-tier"] as const)("rejects non-admin %s before lookup, mutation or AI", async (route) => {
    mocks.session.mockResolvedValue({ user: { id: "ordinary", email: "member@example.test" } });
    expect((await invoke(route)).status).toBe(403);
    expect(mocks.findLead).not.toHaveBeenCalled();
    expect(mocks.updateLead).not.toHaveBeenCalled();
    expect(mocks.claimLead).not.toHaveBeenCalled();
    expect(mocks.generate).not.toHaveBeenCalled();
  });

  it.each(["generate", "upgrade-tier"] as const)("fails closed for %s when admin allowlist is absent", async (route) => {
    vi.stubEnv("ADMIN_EMAILS", "");
    mocks.session.mockResolvedValue({ user: { email: "operator@example.test" } });
    expect((await invoke(route)).status).toBe(403);
    expect(mocks.findLead).not.toHaveBeenCalled();
    expect(mocks.updateLead).not.toHaveBeenCalled();
    expect(mocks.claimLead).not.toHaveBeenCalled();
    expect(mocks.generate).not.toHaveBeenCalled();
  });

  it("preserves authorized administrator generation and existing payload", async () => {
    mocks.session.mockResolvedValue({ user: { email: "OPERATOR@example.test" } });
    expect((await invoke("generate")).status).toBe(200);
    expect(mocks.generate).toHaveBeenCalledOnce();
    expect(mocks.updateLead).toHaveBeenLastCalledWith({ where: expect.objectContaining({ id: "lead_1", status: "package_generating" }), data: { status: "package_ready", fullPayload: expect.objectContaining({ preserved: "keep", aiPackage: { companyName: "Customer" } }) } });
  });

  it("reports a competing generation claim without calling the AI provider", async () => {
    mocks.session.mockResolvedValue({ user: { email: "operator@example.test" } });
    mocks.claimLead.mockResolvedValue({ count: 0 });
    expect((await invoke("generate")).status).toBe(409);
    expect(mocks.generate).not.toHaveBeenCalled();
    expect(mocks.updateLead).not.toHaveBeenCalled();
  });

  it("returns a committed result for the same request after its response was lost", async () => {
    mocks.session.mockResolvedValue({ user: { id: "admin-1", email: "operator@example.test" } });
    expect((await invoke("generate")).status).toBe(200);
    const replay = await invoke("generate");
    expect(replay.status).toBe(200);
    expect(await replay.json()).toMatchObject({ requestId: firstRequestId, replayed: true });
    expect(mocks.generate).toHaveBeenCalledOnce();
  });

  it("requires a refreshed lead for a new attempt and keeps an older request from dispatching again", async () => {
    mocks.session.mockResolvedValue({ user: { id: "admin-1", email: "operator@example.test" } });
    expect((await invoke("generate")).status).toBe(200);
    const stale = await invoke("generate", secondRequestId);
    expect(stale.status).toBe(409);
    expect(await stale.json()).toMatchObject({ requestId: secondRequestId, code: "lead_revision_changed" });
    expect((await invoke("generate", secondRequestId, adminGenerationRevision(await mocks.findLead()))).status).toBe(200);
    expect((await invoke("generate")).status).toBe(409);
    expect(mocks.generate).toHaveBeenCalledTimes(2);
  });

  it("keeps replay authority bound to the administrator identity", async () => {
    mocks.session.mockResolvedValue({ user: { id: "admin-1", email: "operator@example.test" } });
    expect((await invoke("generate")).status).toBe(200);
    mocks.session.mockResolvedValue({ user: { id: "admin-2", email: "another@example.test" } });
    expect((await invoke("generate")).status).toBe(409);
    expect(mocks.generate).toHaveBeenCalledOnce();
  });

  it("rejects a malformed request key before lead lookup or generation", async () => {
    mocks.session.mockResolvedValue({ user: { email: "operator@example.test" } });
    expect((await invoke("generate", "invalid")).status).toBe(400);
    expect(mocks.findLead).not.toHaveBeenCalled();
    expect(mocks.generate).not.toHaveBeenCalled();
  });

  it("preserves authorized administrator tier changes without invoking AI", async () => {
    mocks.session.mockResolvedValue({ user: { email: "operator@example.test" } });
    expect((await invoke("upgrade-tier")).status).toBe(200);
    expect(mocks.updateLead).toHaveBeenCalledWith({ where: { id: "lead_1" }, data: { fullPayload: { form: { email: "customer@example.test", tier: "growth" }, preserved: "keep" } } });
    expect(mocks.generate).not.toHaveBeenCalled();
  });
});
