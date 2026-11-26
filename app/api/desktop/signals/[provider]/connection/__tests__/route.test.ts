import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const io = vi.hoisted(() => ({ session: vi.fn(), find: vi.fn(), updateMany: vi.fn(), create: vi.fn(), audit: vi.fn(), probe: vi.fn(), parse: vi.fn(), enrollment: vi.fn(async () => [] as unknown[]) }));
vi.mock("@/lib/db", () => ({ prisma: {
  tenantIntegrationConnection: { findUnique: io.find },
  durableAgentWorkflow: { findMany: io.enrollment },
  $transaction: async (fn: (tx: unknown) => unknown) => fn({ tenantIntegrationConnection: { updateMany: io.updateMany, create: io.create } }),
} }));
vi.mock("@/lib/desktop/resolveRequestDesktopSession", () => ({ resolveRequestDesktopSession: io.session }));
vi.mock("@/lib/releaseops/auditEventResponder", () => ({ appendAuditEvent: io.audit }));
vi.mock("@/lib/security/credentialVault", () => ({ encryptScopedCredential: (plain: string, ctx: string) => `enc(${ctx})[${plain}]` }));
vi.mock("@/lib/integrations/signals/signalProviders", async (orig) => {
  const real = await orig<typeof import("@/lib/integrations/signals/signalProviders")>();
  return { ...real, SIGNAL_DESCRIPTORS: { ...real.SIGNAL_DESCRIPTORS, datadog: { label: "Datadog", parse: io.parse, probe: io.probe } } };
});
import { DELETE, GET, PUT } from "../route";

const SESSION = { id: "sess", organizationId: "org", userId: "user", credentialKind: "desktop_session" };
const ctx = (provider = "datadog") => ({ params: Promise.resolve({ provider }) });
const req = (method: string, body?: unknown) => new NextRequest("https://example.test/api", { method, ...(body ? { body: JSON.stringify(body) } : {}) });
const ROW = { id: "conn", organizationId: "org", provider: "datadog", status: "active", updatedAt: new Date("2026-11-08T00:00:00Z"), encryptedCredential: "secret-envelope", revokedAt: null, scopesJson: { site: "datadoghq.eu", tag: "service:checkout", inventoryCount: 3 }, lastValidatedAt: null };

beforeEach(() => {
  vi.clearAllMocks();
  io.session.mockResolvedValue(SESSION);
  io.parse.mockResolvedValue({ settings: { site: "datadoghq.eu", tag: "service:checkout" }, secret: { apiKey: "k1", appKey: "k2" } });
  io.probe.mockResolvedValue(4);
  io.updateMany.mockResolvedValue({ count: 1 });
});

describe("signal connection route", () => {
  it("404s unknown providers before any session or DB work", async () => {
    for (const fn of [GET, PUT, DELETE]) expect((await fn(req("GET"), ctx("prefect"))).status).toBe(404);
    expect(io.session).not.toHaveBeenCalled();
  });
  it("GET returns settings and counts, never the credential", async () => {
    io.find.mockResolvedValue(ROW);
    const body = await (await GET(req("GET"), ctx())).json();
    expect(body.data).toMatchObject({ provider: "datadog", label: "Datadog", connected: true, settings: { site: "datadoghq.eu", tag: "service:checkout" }, inventoryCount: 3, authority: "observation_only" });
    expect(JSON.stringify(body)).not.toContain("secret-envelope");
  });
  it("PUT validates with one read, then stores only the secret encrypted with the connection context", async () => {
    io.find.mockResolvedValue(null);
    const res = await PUT(req("PUT", { site: "datadoghq.eu" }), ctx());
    expect(res.status).toBe(200);
    expect(io.probe).toHaveBeenCalledWith({ site: "datadoghq.eu", tag: "service:checkout" }, { apiKey: "k1", appKey: "k2" });
    const data = io.create.mock.calls[0][0].data;
    expect(data.encryptedCredential).toMatch(/^enc\(tenant-integration-credential-v1:org:datadog:[^)]+\)\[\{"apiKey":"k1","appKey":"k2"\}\]$/);
    expect(data.scopesJson).toEqual({ site: "datadoghq.eu", tag: "service:checkout", inventoryCount: 4 });
    expect(data.externalAccountId).toBe("datadoghq.eu");
    expect(JSON.stringify(await res.json())).not.toContain("k1");
  });
  it("returns only safe error codes and refuses a concurrent change", async () => {
    io.find.mockResolvedValue(null);
    io.probe.mockRejectedValueOnce(new Error("raw provider body <html>"));
    expect(await (await PUT(req("PUT", {}), ctx())).json()).toEqual({ ok: false, error: "datadog_connection_failed" });
    io.find.mockResolvedValue(ROW);
    io.updateMany.mockResolvedValueOnce({ count: 0 });
    expect((await PUT(req("PUT", {}), ctx())).status).toBe(409);
  });
  it("DELETE revokes the active connection", async () => {
    io.find.mockResolvedValue(ROW);
    expect(await (await DELETE(req("DELETE"), ctx())).json()).toEqual({ ok: true, data: { provider: "datadog", disconnected: true } });
    expect(io.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "revoked" }) }));
  });
});
