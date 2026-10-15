import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({ session: vi.fn(), findLead: vi.fn(), updateLead: vi.fn(), generate: vi.fn() }));
vi.mock("next-auth", () => ({ getServerSession: mocks.session }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/db", () => ({ prisma: { lead: { findUnique: mocks.findLead, update: mocks.updateLead } } }));
vi.mock("@/lib/websiteStarter/engine", () => ({ generateWebsiteStarter: mocks.generate }));

// Real requireAdmin and route boundaries; only identity, storage and AI IO are
// simulated. The page layout cannot supply authority for a direct API request.
describe("admin lead generation and tier authority", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.resetAllMocks();
    vi.stubEnv("ADMIN_EMAILS", "operator@example.test");
    mocks.findLead.mockResolvedValue({ id: "lead_1", fullPayload: { form: { email: "customer@example.test", tier: "starter" }, preserved: "keep" } });
    mocks.updateLead.mockResolvedValue({});
    mocks.generate.mockResolvedValue({ companyName: "Customer" });
  });
  afterEach(() => vi.unstubAllEnvs());

  async function invoke(route: "generate" | "upgrade-tier") {
    const { POST } = route === "generate" ? await import("../[id]/generate/route") : await import("../[id]/upgrade-tier/route");
    const request = new NextRequest(`https://example.test/api/leads/lead_1/${route}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tier: "growth" }),
    });
    const response = await POST(request, { params: Promise.resolve({ id: "lead_1" }) });
    return response;
  }

  it.each(["generate", "upgrade-tier"] as const)("rejects unauthenticated %s before lookup, mutation or AI", async (route) => {
    mocks.session.mockResolvedValue(null);
    expect((await invoke(route)).status).toBe(401);
    expect(mocks.findLead).not.toHaveBeenCalled();
    expect(mocks.updateLead).not.toHaveBeenCalled();
    expect(mocks.generate).not.toHaveBeenCalled();
  });

  it.each(["generate", "upgrade-tier"] as const)("rejects non-admin %s before lookup, mutation or AI", async (route) => {
    mocks.session.mockResolvedValue({ user: { id: "ordinary", email: "member@example.test" } });
    expect((await invoke(route)).status).toBe(403);
    expect(mocks.findLead).not.toHaveBeenCalled();
    expect(mocks.updateLead).not.toHaveBeenCalled();
    expect(mocks.generate).not.toHaveBeenCalled();
  });

  it.each(["generate", "upgrade-tier"] as const)("fails closed for %s when admin allowlist is absent", async (route) => {
    vi.stubEnv("ADMIN_EMAILS", "");
    mocks.session.mockResolvedValue({ user: { email: "operator@example.test" } });
    expect((await invoke(route)).status).toBe(403);
    expect(mocks.findLead).not.toHaveBeenCalled();
    expect(mocks.updateLead).not.toHaveBeenCalled();
    expect(mocks.generate).not.toHaveBeenCalled();
  });

  it("preserves authorized administrator generation and existing payload", async () => {
    mocks.session.mockResolvedValue({ user: { email: "OPERATOR@example.test" } });
    expect((await invoke("generate")).status).toBe(200);
    expect(mocks.generate).toHaveBeenCalledOnce();
    expect(mocks.updateLead).toHaveBeenLastCalledWith({ where: { id: "lead_1" }, data: { status: "package_ready", fullPayload: expect.objectContaining({ preserved: "keep", aiPackage: { companyName: "Customer" } }) } });
  });

  it("preserves authorized administrator tier changes without invoking AI", async () => {
    mocks.session.mockResolvedValue({ user: { email: "operator@example.test" } });
    expect((await invoke("upgrade-tier")).status).toBe(200);
    expect(mocks.updateLead).toHaveBeenCalledWith({ where: { id: "lead_1" }, data: { fullPayload: { form: { email: "customer@example.test", tier: "growth" }, preserved: "keep" } } });
    expect(mocks.generate).not.toHaveBeenCalled();
  });
});
