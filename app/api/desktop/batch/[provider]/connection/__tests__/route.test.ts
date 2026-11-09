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
vi.mock("@/lib/security/credentialVault", () => ({ encryptScopedCredential: (plain: string, ctx: string) => `enc(${ctx})[${plain.length}]` }));
vi.mock("@/lib/integrations/batch/batchProviders", async (orig) => {
  const real = await orig<typeof import("@/lib/integrations/batch/batchProviders")>();
  const fake = { label: "Prefect", parse: io.parse, client: () => ({}), probe: io.probe };
  return { ...real, BATCH_DESCRIPTORS: { ...real.BATCH_DESCRIPTORS, prefect: fake } };
});
import { DELETE, GET, PUT } from "../route";

const SESSION = { id: "sess", organizationId: "org", userId: "user", credentialKind: "desktop_session" };
const ctx = (provider = "prefect") => ({ params: Promise.resolve({ provider }) });
const req = (method: string, body?: unknown) => new NextRequest("https://example.test/api", { method, ...(body ? { body: JSON.stringify(body) } : {}) });
const ROW = { id: "conn", organizationId: "org", provider: "prefect", status: "active", updatedAt: new Date("2026-11-08T00:00:00Z"), encryptedCredential: "secret-envelope", revokedAt: null, scopesJson: { baseUrl: "https://api.prefect.cloud/api", inventoryCount: 3 }, lastValidatedAt: null };

beforeEach(() => {
  vi.clearAllMocks();
  io.session.mockResolvedValue(SESSION);
  io.parse.mockResolvedValue({ baseUrl: "https://api.prefect.cloud/api", token: "pk_live_secret" });
  io.probe.mockResolvedValue(4);
  io.updateMany.mockResolvedValue({ count: 1 });
});

describe("batch connection route", () => {
  it("404s unknown providers before any session or DB work", async () => {
    for (const fn of [GET, PUT, DELETE]) expect((await fn(req("GET"), ctx("airflow"))).status).toBe(404);
    expect(io.session).not.toHaveBeenCalled(); expect(io.find).not.toHaveBeenCalled();
  });

  it("requires a desktop session", async () => {
    io.session.mockResolvedValue(null);
    expect((await GET(req("GET"), ctx())).status).toBe(401);
    expect((await PUT(req("PUT", {}), ctx())).status).toBe(401);
  });

  it("GET returns safe state scoped to the session's workspace, never the credential", async () => {
    io.find.mockResolvedValue(ROW);
    const res = await GET(req("GET"), ctx());
    const body = await res.json();
    expect(body.data).toMatchObject({ provider: "prefect", connected: true, inventoryCount: 3, authority: "observation_only" });
    expect(JSON.stringify(body)).not.toContain("secret-envelope");
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(io.find).toHaveBeenCalledWith(expect.objectContaining({ where: { organizationId_provider: { organizationId: "org", provider: "prefect" } } }));
  });

  it("PUT validates with a bounded read, then stores only an encrypted, context-bound credential", async () => {
    io.find.mockResolvedValue(null);
    const res = await PUT(req("PUT", { baseUrl: "https://api.prefect.cloud/api", token: "pk_live_secret" }), ctx());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(io.probe).toHaveBeenCalledTimes(1);
    const saved = io.create.mock.calls[0][0].data;
    expect(saved.encryptedCredential).toMatch(/^enc\(tenant-integration-credential-v1:org:prefect:/);
    expect(JSON.stringify(saved)).not.toContain("pk_live_secret");
    expect(saved.scopesJson).toEqual({ baseUrl: "https://api.prefect.cloud/api", inventoryCount: 4 });
    expect(JSON.stringify(body)).not.toContain("pk_live_secret");
  });

  it("PUT refuses a brand-new connection while the workspace is enrolled, before any provider I/O", async () => {
    io.find.mockResolvedValue(null);
    io.enrollment.mockResolvedValueOnce([{ id: "governance_active_fixture", organizationId: "org", workflowKind: "governance_baseline_active_v1" }]);
    const res = await PUT(req("PUT", { baseUrl: "https://api.prefect.cloud/api", token: "pk_live_secret" }), ctx());
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("governance_enrolled_connection_increase");
    expect(io.probe).not.toHaveBeenCalled();
    expect(io.create).not.toHaveBeenCalled();
  });

  it("PUT refuses when the manager session changed during provider I/O", async () => {
    io.find.mockResolvedValue(null);
    io.session.mockResolvedValueOnce(SESSION).mockResolvedValueOnce({ ...SESSION, userId: "someone-else" });
    const res = await PUT(req("PUT", { baseUrl: "x", token: "y" }), ctx());
    expect(res.status).toBe(409);
    expect(io.create).not.toHaveBeenCalled();
  });

  it("PUT refuses when the stored connection changed (optimistic update)", async () => {
    io.find.mockResolvedValue(ROW); io.updateMany.mockResolvedValue({ count: 0 });
    expect((await PUT(req("PUT", { baseUrl: "x", token: "y" }), ctx())).status).toBe(409);
  });

  it("PUT maps provider errors to safe codes only", async () => {
    io.find.mockResolvedValue(null);
    io.probe.mockRejectedValue(new Error("prefect_api_failed:401"));
    expect((await (await PUT(req("PUT", { baseUrl: "x", token: "y" }), ctx())).json()).error).toBe("prefect_api_failed");
    io.probe.mockRejectedValue(new Error("ECONNRESET https://internal/secret"));
    expect((await (await PUT(req("PUT", { baseUrl: "x", token: "y" }), ctx())).json()).error).toBe("prefect_connection_failed");
  });

  it("DELETE revokes the exact observed row", async () => {
    io.find.mockResolvedValue(ROW);
    const res = await DELETE(req("DELETE"), ctx());
    expect(res.status).toBe(200);
    expect(io.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: "conn", encryptedCredential: "secret-envelope" }), data: expect.objectContaining({ status: "revoked" }) }));
  });
});
