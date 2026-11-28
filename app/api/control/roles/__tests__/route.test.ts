// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const m = vi.hoisted(() => ({ ctx: vi.fn(), sameOrigin: true, roles: { findMany: vi.fn(), count: vi.fn(), create: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn(), findFirst: vi.fn() }, members: { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() }, audit: vi.fn() }));
vi.mock("@/lib/auth/currentContext", () => ({ currentContext: m.ctx }));
vi.mock("@/lib/auth/requestOrigin", () => ({ isSameOriginRequest: () => m.sameOrigin }));
vi.mock("@/lib/audit/secureAudit", () => ({ record: m.audit }));
vi.mock("@/lib/db", () => {
  const tx = { orgMembership: m.members, workspaceCustomRole: m.roles };
  return { prisma: { workspaceCustomRole: m.roles, orgMembership: m.members, $transaction: async (fn: (t: typeof tx) => unknown) => fn(tx) } };
});
import { DELETE, GET, PATCH, POST } from "../route";
import { POST as ASSIGN } from "../assign/route";

const admin = { isAuthenticated: true, organizationId: "org_1", userId: "u_1", email: "a@x.test", roles: ["admin"] };
const req = (method: string, body?: unknown, path = "/api/control/roles") => new NextRequest(`http://localhost${path}`, { method, body: body === undefined ? undefined : JSON.stringify(body) });
const role = { name: "No bypass", removedCapabilities: ["deploy:production_bypass"] };
beforeEach(() => {
  vi.clearAllMocks(); m.sameOrigin = true; m.ctx.mockResolvedValue(admin);
  m.roles.findMany.mockResolvedValue([]); m.members.findMany.mockResolvedValue([]); m.roles.count.mockResolvedValue(0);
  m.roles.create.mockImplementation(async (a: { data: Record<string, unknown> }) => ({ id: "r1", ...a.data })); m.roles.updateMany.mockResolvedValue({ count: 1 }); m.roles.deleteMany.mockResolvedValue({ count: 1 });
  m.members.findUnique.mockResolvedValue({ role: "operator", acceptedAt: new Date() }); m.roles.findFirst.mockResolvedValue({ id: "r1" });
});

describe("/api/control/roles", () => {
  it("lists roles and members for any member; only admins may change them", async () => {
    m.ctx.mockResolvedValue({ ...admin, roles: ["viewer"] });
    expect((await (await GET()).json()).data.canEdit).toBe(false);
    expect((await POST(req("POST", role))).status).toBe(403);
    expect((await ASSIGN(req("POST", { userId: "u_2", customRoleId: "r1" }, "/api/control/roles/assign"))).status).toBe(403);
  });
  it("creates a validated role in the workspace", async () => {
    expect((await POST(req("POST", role))).status).toBe(201);
    expect(m.roles.create.mock.calls[0][0].data).toEqual({ organizationId: "org_1", name: "No bypass", description: "", removedCapabilities: ["deploy:production_bypass"], createdByUserId: "u_1" });
    expect((await POST(req("POST", { name: "x", removedCapabilities: ["god:mode"] }))).status).toBe(400);
  });
  it("updates and deletes only within the workspace, clearing members on delete", async () => {
    expect((await PATCH(req("PATCH", { id: "r1", ...role }))).status).toBe(200);
    expect(m.roles.updateMany.mock.calls[0][0].where).toEqual({ id: "r1", organizationId: "org_1" });
    expect((await DELETE(req("DELETE", { id: "r1" }))).status).toBe(200);
    expect(m.members.updateMany.mock.calls[0][0]).toEqual({ where: { organizationId: "org_1", customRoleId: "r1" }, data: { customRoleId: null } });
    m.roles.deleteMany.mockResolvedValue({ count: 0 });
    expect((await DELETE(req("DELETE", { id: "r9" }))).status).toBe(404);
  });
  it("assigns only to non-admin members, only roles from this workspace, and can clear", async () => {
    const assign = (b: unknown) => ASSIGN(req("POST", b, "/api/control/roles/assign"));
    expect((await assign({ userId: "u_2", customRoleId: "r1" })).status).toBe(200);
    expect(m.members.update.mock.calls[0][0]).toEqual({ where: { userId_organizationId: { userId: "u_2", organizationId: "org_1" } }, data: { customRoleId: "r1" } });
    m.members.findUnique.mockResolvedValue({ role: "admin", acceptedAt: new Date() });
    expect((await (await assign({ userId: "u_3", customRoleId: "r1" })).json()).error).toBe("role_not_assignable_to_owner_or_admin");
    expect((await assign({ userId: "u_3", customRoleId: null })).status).toBe(200);
    m.members.findUnique.mockResolvedValue({ role: "operator", acceptedAt: new Date() }); m.roles.findFirst.mockResolvedValue(null);
    expect((await assign({ userId: "u_2", customRoleId: "other-org-role" })).status).toBe(404);
    m.members.findUnique.mockResolvedValue(null);
    expect((await assign({ userId: "ghost", customRoleId: null })).status).toBe(404);
  });
});
