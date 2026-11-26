// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ ctx: vi.fn(), findFirst: vi.fn(), findMany: vi.fn() }));
vi.mock("@/lib/auth/currentContext", () => ({ currentContext: m.ctx }));
vi.mock("@/lib/db", () => ({ prisma: { webhookEndpoint: { findFirst: m.findFirst }, webhookDelivery: { findMany: m.findMany } } }));
import { GET } from "../route";
const call = (id: string) => GET(new Request("http://localhost/x"), { params: Promise.resolve({ id }) });
beforeEach(() => { vi.clearAllMocks(); m.ctx.mockResolvedValue({ isAuthenticated: true, organizationId: "org1", roles: ["member"] }); });

describe("/api/control/webhooks/[id]/deliveries", () => {
  it("lists recent attempts for a workspace webhook without payloads or headers", async () => {
    m.findFirst.mockResolvedValue({ id: "w1" });
    m.findMany.mockResolvedValue([{ id: "d1", eventKind: "deployment.blocked", attemptNumber: 1, status: "delivered", httpStatus: 200 }]);
    const res = await call("w1");
    expect(res.status).toBe(200);
    expect((await res.json()).data.deliveries).toHaveLength(1);
    expect(m.findFirst.mock.calls[0][0].where).toEqual({ id: "w1", organizationId: "org1" });
    const q = m.findMany.mock.calls[0][0];
    expect(q.where).toEqual({ endpointId: "w1", organizationId: "org1" });
    for (const k of ["payload", "requestHeaders", "responseBodySnippet", "errorMessage"]) expect(q.select).not.toHaveProperty(k);
  });
  it("refuses webhooks from another workspace and callers without membership", async () => {
    m.findFirst.mockResolvedValue(null);
    expect((await call("w2")).status).toBe(404);
    expect(m.findMany).not.toHaveBeenCalled();
    m.ctx.mockResolvedValue({ isAuthenticated: true, organizationId: "org1", roles: [] });
    expect((await call("w1")).status).toBe(403);
  });
  it("reports unavailability instead of an empty list", async () => {
    m.findFirst.mockRejectedValue(new Error("db"));
    expect((await call("w1")).status).toBe(503);
  });
});
