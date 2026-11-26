// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const m = vi.hoisted(() => ({ ctx: vi.fn(), admin: true, sameOrigin: true, findMany: vi.fn(), updateMany: vi.fn(), audit: vi.fn(), dispatch: vi.fn(async () => ({})), unenrolled: vi.fn(async () => true) }));
vi.mock("@/lib/auth/currentContext", () => ({ currentContext: m.ctx }));
vi.mock("@/lib/auth/platformAdmin", () => ({ isAdminOrOwner: () => m.admin }));
vi.mock("@/lib/auth/requestOrigin", () => ({ isSameOriginRequest: () => m.sameOrigin }));
vi.mock("@/lib/audit/secureAudit", () => ({ record: m.audit }));
vi.mock("@/lib/governance/intelligence/enrolledRefusal", () => ({ workspaceUnenrolled: m.unenrolled }));
vi.mock("@/lib/webhooks/dispatchWebhookEvent", () => ({ dispatchWebhookEvent: m.dispatch }));
vi.mock("@/lib/prismaClient", () => ({ Prisma: { DbNull: "DbNull" } }));
vi.mock("@/lib/db", () => {
  const tx = { environment: { updateMany: m.updateMany } };
  return { prisma: { environment: { findMany: m.findMany }, $transaction: async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx) } };
});
import { GET, POST } from "../route";

const t = new Date("2026-11-27T00:00:00Z");
const post = (body: unknown) => POST(new NextRequest("http://localhost/x", { method: "POST", body: JSON.stringify(body) }));
beforeEach(() => {
  vi.clearAllMocks(); m.admin = true; m.sameOrigin = true;
  m.ctx.mockResolvedValue({ isAuthenticated: true, organizationId: "org1", userId: "u1", email: "a@x.test", roles: ["owner"] });
  m.updateMany.mockResolvedValue({ count: 1 });
});

describe("/api/control/environments/freeze", () => {
  it("freezes production environments now and records who did it", async () => {
    m.findMany.mockResolvedValue([{ id: "p1", name: "Prod", tier: "prod", changeWindowRuleJson: null, updatedAt: t }, { id: "p2", name: "Prod EU", tier: "prod", changeWindowRuleJson: { weekdays: [] }, updatedAt: t }]);
    const res = await post({ action: "start", scope: "production", hours: 4, reason: "Incident 42" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.environments).toEqual(["Prod"]);
    expect(body.data.skipped[0]).toMatch(/^Prod EU: its change window cannot be read/);
    expect(m.findMany.mock.calls[0][0].where).toEqual({ organizationId: "org1", tier: "prod" });
    const write = m.updateMany.mock.calls[0][0];
    expect(write.where).toEqual({ id: "p1", organizationId: "org1", updatedAt: t });
    expect(write.data.changeWindowRuleJson.freezes[0]).toMatchObject({ reason: "Incident 42" });
    expect(Date.parse(write.data.changeWindowRuleJson.freezes[0].endUtc) - Date.parse(write.data.changeWindowRuleJson.freezes[0].startUtc)).toBe(4 * 3_600_000);
    expect(m.dispatch).toHaveBeenCalledWith(expect.objectContaining({ organizationId: "org1", eventKind: "deployment.freeze_started", data: expect.objectContaining({ reason: "Incident 42", environments: ["Prod"], scope: "production" }) }));
    expect(m.audit).toHaveBeenCalledWith(expect.objectContaining({ entityRef: "deployment_freeze", detail: expect.objectContaining({ kind: "deployment_freeze.start", environments: ["Prod"] }) }));
  });
  it("ends a freeze early by reason, keeping it as a shortened record", async () => {
    const start = new Date(Date.now() - 3_600_000).toISOString(), end = new Date(Date.now() + 3_600_000).toISOString();
    m.findMany.mockResolvedValue([{ id: "p1", name: "Prod", tier: "prod", changeWindowRuleJson: { freezes: [{ startUtc: start, endUtc: end, reason: "Incident 42" }] }, updatedAt: t }]);
    const res = await post({ action: "end", reason: "Incident 42" });
    expect(res.status).toBe(200);
    const f = m.updateMany.mock.calls[0][0].data.changeWindowRuleJson.freezes[0];
    expect(f).toMatchObject({ startUtc: new Date(start).toISOString(), reason: "Incident 42" });
    expect(Math.abs(Date.parse(f.endUtc) - Date.now())).toBeLessThan(5_000);
    expect(m.dispatch).toHaveBeenCalledWith(expect.objectContaining({ eventKind: "deployment.freeze_ended" }));
    expect((await post({ action: "end", reason: "Other" })).status).toBe(409);
  });
  it("lists active freezes for members", async () => {
    const start = new Date(Date.now() - 3_600_000).toISOString(), end = new Date(Date.now() + 3_600_000).toISOString();
    m.admin = false;
    m.findMany.mockResolvedValue([{ id: "p1", name: "Prod", tier: "prod", changeWindowRuleJson: { freezes: [{ startUtc: start, endUtc: end, reason: "Incident 42" }] }, updatedAt: t }]);
    const body = await (await GET()).json();
    expect(body.data).toMatchObject({ canEdit: false, freezes: [{ reason: "Incident 42", environments: ["Prod"] }], unreadable: [] });
  });
  it("refuses concurrent edits, bad input, enrolled workspaces, members and cross-origin calls", async () => {
    m.findMany.mockResolvedValue([{ id: "p1", name: "Prod", tier: "prod", changeWindowRuleJson: null, updatedAt: t }]);
    m.updateMany.mockResolvedValueOnce({ count: 0 });
    expect((await post({ action: "start", scope: "all", hours: 2, reason: "Incident" })).status).toBe(409);
    expect((await post({ action: "start", scope: "all", hours: 999, reason: "Incident" })).status).toBe(400);
    m.unenrolled.mockResolvedValueOnce(false);
    expect((await post({ action: "start", scope: "all", hours: 2, reason: "Incident" })).status).toBe(409);
    m.admin = false;
    expect((await post({ action: "start", scope: "all", hours: 2, reason: "Incident" })).status).toBe(403);
    m.admin = true; m.sameOrigin = false;
    expect((await post({ action: "start", scope: "all", hours: 2, reason: "Incident" })).status).toBe(403);
  });
});
