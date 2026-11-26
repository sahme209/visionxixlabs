// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const m = vi.hoisted(() => ({ ctx: vi.fn(), sameOrigin: vi.fn(() => true), audit: vi.fn(), count: vi.fn(), create: vi.fn(), updateMany: vi.fn(), setDelete: vi.fn(), varDelete: vi.fn() }));
vi.mock("@/lib/auth/currentContext", () => ({ currentContext: m.ctx }));
vi.mock("@/lib/auth/requestOrigin", () => ({ isSameOriginRequest: m.sameOrigin }));
vi.mock("@/lib/audit/secureAudit", () => ({ record: m.audit }));
vi.mock("@/lib/db", () => {
  const tx = { variableSet: { deleteMany: m.setDelete }, configVariable: { deleteMany: m.varDelete } };
  return { prisma: { variableSet: { count: m.count, create: m.create, updateMany: m.updateMany }, $transaction: async (fn: (t: typeof tx) => unknown) => fn(tx) } };
});
import { DELETE, POST } from "../route";
const admin = { isAuthenticated: true, organizationId: "org1", userId: "u1", email: "a@example.invalid", roles: ["owner"] };
const req = (method: string, body: unknown) => new NextRequest("http://localhost/api/control/variables/sets", { method, body: JSON.stringify(body), headers: { origin: "http://localhost" } });
beforeEach(() => { vi.clearAllMocks(); m.ctx.mockResolvedValue(admin); m.sameOrigin.mockReturnValue(true); m.count.mockResolvedValue(0); });

describe("/api/control/variables/sets", () => {
  it("creates a set with a normalized selector and audits it", async () => {
    m.create.mockResolvedValue({ slug: "eu", version: 1 });
    const r = await POST(req("POST", { slug: "eu", name: " EU region ", selector: "Region:EU  tenant:*" }));
    expect(r.status).toBe(201);
    expect(m.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ organizationId: "org1", slug: "eu", name: "EU region", selector: "region:eu tenant:*" }) }));
    expect(m.audit).toHaveBeenCalledWith(expect.objectContaining({ entityRef: "variable_set:eu" }));
  });
  it("updates only when the version matches", async () => {
    m.updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
    expect((await POST(req("POST", { slug: "eu", name: "EU", selector: "region:eu", expectedVersion: 2 }))).status).toBe(200);
    expect(m.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { organizationId: "org1", slug: "eu", version: 2 } }));
    expect((await POST(req("POST", { slug: "eu", name: "EU", selector: "region:eu", expectedVersion: 2 }))).status).toBe(409);
  });
  it("deletes the set and its variables together, or neither", async () => {
    m.setDelete.mockResolvedValueOnce({ count: 1 }); m.varDelete.mockResolvedValueOnce({ count: 3 });
    const r = await DELETE(req("DELETE", { slug: "eu", expectedVersion: 1 }));
    expect(await r.json()).toEqual({ ok: true, data: { variablesRemoved: 3 } });
    expect(m.varDelete).toHaveBeenCalledWith({ where: { organizationId: "org1", scopeKey: "set:eu" } });
    m.setDelete.mockResolvedValueOnce({ count: 0 }); m.varDelete.mockClear();
    expect((await DELETE(req("DELETE", { slug: "eu", expectedVersion: 1 }))).status).toBe(409);
    expect(m.varDelete).not.toHaveBeenCalled();
  });
  it("refuses non-admins, cross-origin requests, invalid definitions and the set limit", async () => {
    expect((await POST(req("POST", { slug: "EU!", name: "", selector: "eu" }))).status).toBe(422);
    m.count.mockResolvedValueOnce(50);
    expect((await POST(req("POST", { slug: "eu", name: "EU", selector: "region:eu" }))).status).toBe(409);
    m.sameOrigin.mockReturnValueOnce(false);
    expect((await POST(req("POST", { slug: "eu", name: "EU", selector: "region:eu" }))).status).toBe(403);
    m.ctx.mockResolvedValueOnce({ ...admin, roles: ["viewer"] });
    expect((await DELETE(req("DELETE", { slug: "eu", expectedVersion: 1 }))).status).toBe(403);
  });
});
