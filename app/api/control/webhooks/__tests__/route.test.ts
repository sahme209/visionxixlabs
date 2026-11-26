// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const m = vi.hoisted(() => ({ ctx: vi.fn(), admin: true, sameOrigin: true, findMany: vi.fn(), count: vi.fn(), create: vi.fn(), updateMany: vi.fn(), audit: vi.fn(), unenrolled: vi.fn(async () => true) }));
vi.mock("@/lib/auth/currentContext", () => ({ currentContext: m.ctx }));
vi.mock("@/lib/auth/platformAdmin", () => ({ isAdminOrOwner: () => m.admin }));
vi.mock("@/lib/auth/requestOrigin", () => ({ isSameOriginRequest: () => m.sameOrigin }));
vi.mock("@/lib/audit/secureAudit", () => ({ record: m.audit }));
vi.mock("@/lib/governance/intelligence/enrolledRefusal", () => ({ workspaceUnenrolled: m.unenrolled }));
vi.mock("@/lib/db", () => ({ prisma: { webhookEndpoint: { findMany: m.findMany, count: m.count, create: m.create, updateMany: m.updateMany } } }));
import { DELETE, GET, POST } from "../route";
const req = (method: string, body: unknown) => new NextRequest("http://localhost/api/control/webhooks", { method, body: JSON.stringify(body) });
beforeEach(() => { vi.clearAllMocks(); m.admin = true; m.sameOrigin = true; m.ctx.mockResolvedValue({ isAuthenticated: true, organizationId: "org1", userId: "u1", email: "a@x.test", roles: ["owner"] }); m.count.mockResolvedValue(0); m.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: "w1", name: data.name, url: data.url, createdAt: new Date("2026-11-27T00:00:00Z") })); m.updateMany.mockResolvedValue({ count: 1 }); });

describe("/api/control/webhooks", () => {
  it("lists active endpoints without secrets", async () => {
    m.findMany.mockResolvedValue([{ id: "w1", name: "Slack bridge", url: "https://hooks.example.com/x", subscribedEvents: ["deployment.blocked"], consecutiveFailures: 0, createdAt: new Date() }]);
    const body = await (await GET()).json();
    expect(body.data.canEdit).toBe(true);
    expect(m.findMany.mock.calls[0][0]).toMatchObject({ where: { organizationId: "org1", revokedAt: null } });
    expect(m.findMany.mock.calls[0][0].select).not.toHaveProperty("secret");
  });
  it("creates an HTTPS endpoint for known events and returns the secret once", async () => {
    const r = await POST(req("POST", { name: "Slack bridge", url: "https://hooks.example.com/x", events: ["deployment.blocked", "nope"] }));
    expect(r.status).toBe(201);
    const body = await r.json();
    expect(body.data).toMatchObject({ id: "w1", subscribedEvents: ["deployment.blocked"], secret: expect.stringMatching(/^[0-9a-f]{64}$/) });
    expect(m.create.mock.calls[0][0].data).toMatchObject({ organizationId: "org1", createdBy: "a@x.test" });
    expect(m.audit).toHaveBeenCalledWith(expect.objectContaining({ entityRef: "webhook_endpoint:w1" }));
  });
  it("refuses http, private hosts, unknown events, non-admins and enrolled workspaces", async () => {
    expect((await POST(req("POST", { name: "x", url: "http://hooks.example.com/x", events: ["deployment.blocked"] }))).status).toBe(400);
    expect((await POST(req("POST", { name: "x", url: "https://127.0.0.1/x", events: ["deployment.blocked"] }))).status).toBe(400);
    expect((await POST(req("POST", { name: "x", url: "https://hooks.example.com/x", events: ["nope"] }))).status).toBe(400);
    m.unenrolled.mockResolvedValueOnce(false);
    expect((await POST(req("POST", { name: "x", url: "https://hooks.example.com/x", events: ["deployment.blocked"] }))).status).toBe(409);
    m.admin = false;
    expect((await POST(req("POST", { name: "x", url: "https://hooks.example.com/x", events: ["deployment.blocked"] }))).status).toBe(403);
    expect(m.create).not.toHaveBeenCalled();
  });
  it("revokes only this workspace's active endpoint", async () => {
    expect((await DELETE(req("DELETE", { id: "w1" }))).status).toBe(200);
    expect(m.updateMany.mock.calls[0][0].where).toEqual({ id: "w1", organizationId: "org1", revokedAt: null });
    m.updateMany.mockResolvedValueOnce({ count: 0 });
    expect((await DELETE(req("DELETE", { id: "other" }))).status).toBe(404);
  });
});
