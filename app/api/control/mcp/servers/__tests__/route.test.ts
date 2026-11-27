// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const m = vi.hoisted(() => ({ ctx: vi.fn(), sameOrigin: true, findMany: vi.fn(), count: vi.fn(), create: vi.fn(), findFirst: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn(), audit: vi.fn(), check: vi.fn() }));
vi.mock("@/lib/auth/currentContext", () => ({ currentContext: m.ctx }));
vi.mock("@/lib/auth/requestOrigin", () => ({ isSameOriginRequest: () => m.sameOrigin }));
vi.mock("@/lib/audit/secureAudit", () => ({ record: m.audit }));
vi.mock("@/lib/integrations/mcp/mcpConnectionCheck", () => ({ checkMcpServer: m.check }));
vi.mock("@/lib/db", () => ({ prisma: { workspaceMcpServer: { findMany: m.findMany, count: m.count, create: m.create, findFirst: m.findFirst, updateMany: m.updateMany, deleteMany: m.deleteMany } } }));
import { DELETE, GET, PATCH, POST } from "../route";
import { POST as CHECK } from "../[id]/check/route";

const admin = { isAuthenticated: true, organizationId: "org_1", userId: "u_1", email: "a@x.test", roles: ["admin"] };
const viewer = { ...admin, roles: ["viewer"] };
const req = (method: string, body?: unknown) => new NextRequest("http://localhost/api/control/mcp/servers", { method, body: body === undefined ? undefined : JSON.stringify(body) });
const add = { registryName: "com.microsoft/microsoft-learn-mcp", title: "Microsoft Learn MCP", version: "1.0.0", remoteUrl: "https://learn.microsoft.com/api/mcp", transport: "streamable-http" };
beforeEach(() => {
  vi.clearAllMocks(); m.sameOrigin = true; m.ctx.mockResolvedValue(admin); m.findMany.mockResolvedValue([]); m.count.mockResolvedValue(0);
  m.create.mockImplementation(async (a: { data: Record<string, unknown> }) => ({ id: "s1", ...a.data })); m.updateMany.mockResolvedValue({ count: 1 }); m.deleteMany.mockResolvedValue({ count: 1 });
});

describe("/api/control/mcp/servers", () => {
  it("lists the workspace's servers and says whether the viewer can edit", async () => {
    m.ctx.mockResolvedValue(viewer);
    const body = await (await GET()).json();
    expect(body.data.canEdit).toBe(false);
    expect(m.findMany.mock.calls[0][0].where).toEqual({ organizationId: "org_1" });
  });
  it("lets only owners and admins add, and only same-origin", async () => {
    m.ctx.mockResolvedValue(viewer);
    expect((await POST(req("POST", add))).status).toBe(403);
    m.ctx.mockResolvedValue(admin); m.sameOrigin = false;
    expect((await POST(req("POST", add))).status).toBe(403);
    expect(m.create).not.toHaveBeenCalled();
  });
  it("adds a server disabled, storing only its public https endpoint", async () => {
    const res = await POST(req("POST", add));
    expect(res.status).toBe(201);
    expect(m.create.mock.calls[0][0].data).toEqual({ organizationId: "org_1", registryName: add.registryName, title: add.title, version: "1.0.0", remoteUrl: add.remoteUrl, transport: "streamable-http", enabled: false, addedByUserId: "u_1" });
    expect(m.audit.mock.calls[0][0].detail).toMatchObject({ kind: "mcp_server.add", host: "learn.microsoft.com" });
  });
  it("refuses http, credentials in the URL, templated URLs and unknown fields", async () => {
    for (const remoteUrl of ["http://x.example.com/mcp", "https://u:p@x.example.com/mcp", "https://{tenant}.example.com/mcp"]) expect((await POST(req("POST", { ...add, remoteUrl }))).status).toBe(400);
    expect((await POST(req("POST", { ...add, apiKey: "x" }))).status).toBe(400);
    expect(m.create).not.toHaveBeenCalled();
  });
  it("refuses duplicates and more than 50 servers", async () => {
    m.create.mockRejectedValueOnce(Object.assign(new Error("dup"), { code: "P2002" }));
    expect((await (await POST(req("POST", add))).json()).error).toBe("mcp_server_already_added");
    m.count.mockResolvedValue(50);
    expect((await POST(req("POST", add))).status).toBe(409);
  });
  it("enables only after a passing connection check, scoped to the workspace", async () => {
    m.findFirst.mockResolvedValue({ lastCheckOutcome: "needs_credentials" });
    expect((await (await PATCH(req("PATCH", { id: "s1", enabled: true }))).json()).error).toBe("mcp_server_check_required");
    m.findFirst.mockResolvedValue({ lastCheckOutcome: "ok" });
    expect((await PATCH(req("PATCH", { id: "s1", enabled: true }))).status).toBe(200);
    expect(m.updateMany.mock.calls[0][0]).toEqual({ where: { id: "s1", organizationId: "org_1" }, data: { enabled: true } });
    m.findFirst.mockResolvedValue(null);
    expect((await PATCH(req("PATCH", { id: "other", enabled: false }))).status).toBe(404);
  });
  it("removes only within the workspace", async () => {
    expect((await DELETE(req("DELETE", { id: "s1" }))).status).toBe(200);
    expect(m.deleteMany.mock.calls[0][0].where).toEqual({ id: "s1", organizationId: "org_1" });
    m.deleteMany.mockResolvedValue({ count: 0 });
    expect((await DELETE(req("DELETE", { id: "s2" }))).status).toBe(404);
  });
});

describe("/api/control/mcp/servers/[id]/check", () => {
  const check = (id = "s1") => CHECK(new NextRequest(`http://localhost/api/control/mcp/servers/${id}/check`, { method: "POST" }), { params: Promise.resolve({ id }) });
  it("records the outcome and tool names, and disables a server that no longer passes", async () => {
    m.findFirst.mockResolvedValue({ remoteUrl: "https://learn.microsoft.com/api/mcp", lastCheckAt: null });
    m.check.mockResolvedValue({ outcome: "ok", detail: "3 tools listed.", serverName: "x", tools: ["a", "b", "c"] });
    expect((await check()).status).toBe(200);
    expect(m.updateMany.mock.calls[1][0].data).toMatchObject({ lastCheckOutcome: "ok", toolNames: ["a", "b", "c"] });
    expect(m.updateMany.mock.calls[1][0].data.enabled).toBeUndefined();
    m.check.mockResolvedValue({ outcome: "unreachable", detail: "x", serverName: null, tools: [] });
    await check();
    expect(m.updateMany.mock.calls[3][0].data).toMatchObject({ lastCheckOutcome: "unreachable", enabled: false });
  });
  it("is admin-only and rate limited per server", async () => {
    m.ctx.mockResolvedValue(viewer);
    expect((await check()).status).toBe(403);
    m.ctx.mockResolvedValue(admin);
    m.findFirst.mockResolvedValue({ remoteUrl: "https://x.example.com", lastCheckAt: new Date() });
    expect((await check()).status).toBe(429);
    expect(m.check).not.toHaveBeenCalled();
  });
});
