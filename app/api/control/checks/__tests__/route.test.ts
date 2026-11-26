// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { Prisma } from "@/lib/prismaClient";

const m = vi.hoisted(() => ({ ctx: vi.fn(), sameOrigin: vi.fn(() => true), audit: vi.fn(), findMany: vi.fn(), count: vi.fn(), create: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn() }));
vi.mock("@/lib/auth/currentContext", () => ({ currentContext: m.ctx }));
vi.mock("@/lib/auth/requestOrigin", () => ({ isSameOriginRequest: m.sameOrigin }));
vi.mock("@/lib/audit/secureAudit", () => ({ record: m.audit }));
vi.mock("@/lib/db", () => ({ prisma: { deploymentCheck: { findMany: m.findMany, count: m.count, create: m.create, updateMany: m.updateMany, deleteMany: m.deleteMany } } }));
import { DELETE, GET, POST } from "../route";

const admin = { isAuthenticated: true, organizationId: "org1", userId: "u1", email: "a@example.invalid", roles: ["owner"] };
const req = (method: string, body: unknown) => new NextRequest("http://localhost/api/control/checks", { method, body: JSON.stringify(body) });
const smoke = { key: "health-probe", name: "Health probe", kind: "smoke_test", stage: "verify", mode: "blocking", spec: { url: "https://app.example.invalid/health", expectStatus: 200, maxLatencyMs: 500 } };
beforeEach(() => { vi.clearAllMocks(); m.sameOrigin.mockReturnValue(true); m.ctx.mockResolvedValue(admin); m.count.mockResolvedValue(0); });

describe("/api/control/checks", () => {
  it("GET returns checks and per-stage coverage for members", async () => {
    m.ctx.mockResolvedValue({ ...admin, roles: ["viewer"] });
    m.findMany.mockResolvedValue([{ ...smoke, enabled: true, version: 1, updatedAt: new Date() }]);
    const body = await (await GET()).json();
    expect(body.data.canEdit).toBe(false);
    expect(body.data.coverage.uncovered).toEqual(["plan", "validate", "approve", "deploy", "recover"]);
  });
  it("refuses non-admins and invalid specs without writing", async () => {
    m.ctx.mockResolvedValue({ ...admin, roles: ["viewer"] });
    expect((await POST(req("POST", { check: smoke }))).status).toBe(403);
    m.ctx.mockResolvedValue(admin);
    const r = await POST(req("POST", { check: { ...smoke, spec: { ...smoke.spec, url: "http://insecure.example.invalid" } } }));
    expect(r.status).toBe(422);
    expect(m.create).not.toHaveBeenCalled();
  });
  it("creates once, conflicts on duplicate keys, and updates only from the current version", async () => {
    m.create.mockResolvedValueOnce({});
    expect((await POST(req("POST", { check: smoke }))).status).toBe(201);
    m.create.mockRejectedValueOnce(new Prisma.PrismaClientKnownRequestError("dup", { code: "P2002", clientVersion: "x" }));
    expect((await POST(req("POST", { check: smoke }))).status).toBe(409);
    m.updateMany.mockResolvedValueOnce({ count: 0 });
    expect((await POST(req("POST", { check: smoke, expectedVersion: 3 }))).status).toBe(409);
    expect(m.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { organizationId: "org1", key: "health-probe", version: 3 } }));
    m.updateMany.mockResolvedValueOnce({ count: 1 });
    expect((await (await POST(req("POST", { check: smoke, expectedVersion: 3, enabled: false }))).json()).data.version).toBe(4);
    m.deleteMany.mockResolvedValueOnce({ count: 1 });
    expect((await DELETE(req("DELETE", { key: "health-probe", expectedVersion: 4 }))).status).toBe(200);
  });
});
