// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const m = vi.hoisted(() => ({ ctx: vi.fn(), admin: true, sameOrigin: true, epFind: vi.fn(), dFind: vi.fn(), dCreate: vi.fn(), dUnique: vi.fn(), deliver: vi.fn(), audit: vi.fn(), unenrolled: vi.fn(async () => true) }));
vi.mock("@/lib/governance/intelligence/enrolledRefusal", () => ({ workspaceUnenrolled: m.unenrolled }));
vi.mock("@/lib/auth/currentContext", () => ({ currentContext: m.ctx }));
vi.mock("@/lib/auth/platformAdmin", () => ({ isAdminOrOwner: () => m.admin }));
vi.mock("@/lib/auth/requestOrigin", () => ({ isSameOriginRequest: () => m.sameOrigin }));
vi.mock("@/lib/audit/secureAudit", () => ({ record: m.audit }));
vi.mock("@/lib/webhooks/deliverWebhook", () => ({ deliverWebhookDelivery: m.deliver }));
vi.mock("@/lib/db", () => ({ prisma: { webhookEndpoint: { findFirst: m.epFind }, webhookDelivery: { findFirst: m.dFind, create: m.dCreate, findUnique: m.dUnique } } }));
import { POST } from "../route";
const call = (id = "w1") => POST(new NextRequest("http://localhost/x", { method: "POST" }), { params: Promise.resolve({ id }) });
beforeEach(() => {
  vi.clearAllMocks(); m.admin = true; m.sameOrigin = true;
  m.ctx.mockResolvedValue({ isAuthenticated: true, organizationId: "org1", userId: "u1", email: "a@x.test", roles: ["owner"] });
  m.epFind.mockResolvedValue({ id: "w1", name: "Slack" }); m.dFind.mockResolvedValue(null); m.dCreate.mockResolvedValue({ id: "d1" });
  m.deliver.mockResolvedValue({ deliveryId: "d1", outcomeKind: "delivered" }); m.dUnique.mockResolvedValue({ status: "delivered", httpStatus: 204 });
});

describe("POST /api/control/webhooks/[id]/test", () => {
  it("sends one signed ping to an active workspace webhook and reports the result", async () => {
    const res = await call();
    expect(res.status).toBe(200);
    expect((await res.json()).data).toMatchObject({ outcomeKind: "delivered", status: "delivered", httpStatus: 204 });
    expect(m.epFind.mock.calls[0][0].where).toEqual({ id: "w1", organizationId: "org1", revokedAt: null });
    const created = m.dCreate.mock.calls[0][0].data;
    expect(created).toMatchObject({ endpointId: "w1", organizationId: "org1", eventKind: "webhook.ping", attemptNumber: 1, status: "queued" });
    expect(created.payload).toMatchObject({ type: "webhook.ping" });
    expect(m.deliver).toHaveBeenCalledWith("d1");
  });
  it("allows one ping per webhook per minute", async () => {
    m.dFind.mockResolvedValue({ id: "d0" });
    expect((await call()).status).toBe(429);
    expect(m.dCreate).not.toHaveBeenCalled();
  });
  it("refuses cross-origin calls, members, revoked or foreign webhooks", async () => {
    m.sameOrigin = false; expect((await call()).status).toBe(403); m.sameOrigin = true;
    m.admin = false; expect((await call()).status).toBe(403); m.admin = true;
    m.unenrolled.mockResolvedValueOnce(false); expect((await call()).status).toBe(409);
    m.epFind.mockResolvedValue(null); expect((await call("w9")).status).toBe(404);
    expect(m.deliver).not.toHaveBeenCalled();
  });
});
