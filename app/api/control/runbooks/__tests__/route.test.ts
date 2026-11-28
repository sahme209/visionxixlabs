// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const m = vi.hoisted(() => ({ ctx: vi.fn(), findMany: vi.fn(), count: vi.fn(), create: vi.fn(), updateMany: vi.fn(), audit: vi.fn(), sameOrigin: vi.fn(() => true) }));
vi.mock("@/lib/auth/currentContext", () => ({ currentContext: m.ctx }));
vi.mock("@/lib/auth/requestOrigin", () => ({ isSameOriginRequest: m.sameOrigin }));
vi.mock("@/lib/audit/secureAudit", () => ({ record: m.audit }));
vi.mock("@/lib/db", () => ({ prisma: { workspaceRunbook: { findMany: m.findMany, count: m.count, create: m.create, updateMany: m.updateMany } } }));
import { GET, POST } from "../route";
import { GET as EXPORT } from "../export/route";

const admin = { isAuthenticated: true, organizationId: "org1", userId: "u1", email: "a@example.invalid", roles: ["owner"] };
const runbook = { key: "failed-deploy", title: "A deploy failed", trigger: "deployment_failed", enabled: true, steps: [{ title: "Roll back", detail: "Use the desktop app.", approval: "one_admin" }] };
const post = (body: unknown) => POST(new NextRequest("http://localhost/api/control/runbooks", { method: "POST", body: JSON.stringify(body) }));
beforeEach(() => { vi.clearAllMocks(); m.ctx.mockResolvedValue(admin); m.sameOrigin.mockReturnValue(true); m.count.mockResolvedValue(0); m.create.mockResolvedValue({}); m.updateMany.mockResolvedValue({ count: 1 }); m.findMany.mockResolvedValue([]); });

describe("/api/control/runbooks", () => {
  it("members read; only admins write", async () => {
    m.ctx.mockResolvedValue({ ...admin, roles: ["viewer"] });
    expect((await (await GET()).json()).data.canEdit).toBe(false);
    expect((await post({ runbook })).status).toBe(403);
    expect(m.create).not.toHaveBeenCalled();
  });
  it("creates scoped to the workspace, then updates only at the expected version", async () => {
    expect((await post({ runbook })).status).toBe(201);
    expect(m.create.mock.calls[0][0].data).toMatchObject({ organizationId: "org1", key: "failed-deploy", trigger: "deployment_failed", updatedByUserId: "u1" });
    expect(await (await post({ runbook, expectedVersion: 2 })).json()).toEqual({ ok: true, data: { key: "failed-deploy", version: 3 } });
    expect(m.updateMany.mock.calls[0][0].where).toEqual({ organizationId: "org1", key: "failed-deploy", version: 2 });
    m.updateMany.mockResolvedValueOnce({ count: 0 });
    expect((await (await post({ runbook, expectedVersion: 2 })).json()).error).toBe("runbook_changed");
  });
  it("refuses destructive steps, cross-origin writes and unknown fields", async () => {
    const r = await post({ runbook: { ...runbook, steps: [{ title: "x", detail: "DROP TABLE users;", approval: "two_admins" }] } });
    expect(r.status).toBe(422);
    m.sameOrigin.mockReturnValueOnce(false);
    expect((await post({ runbook })).status).toBe(403);
    expect((await post({ runbook, extra: true })).status).toBe(400);
    expect(m.create).not.toHaveBeenCalled();
  });
  it("exports valid runbooks as a file", async () => {
    m.findMany.mockResolvedValue([runbook, { ...runbook, key: "Bad Key" }]);
    const r = await EXPORT();
    expect(r.headers.get("content-disposition")).toContain("v19-runbooks.json");
    const doc = JSON.parse(await r.text());
    expect(doc.runbooks.map((x: { key: string }) => x.key)).toEqual(["failed-deploy"]);
    expect(m.findMany.mock.calls[0][0].where).toEqual({ organizationId: "org1" });
  });
});
