// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const m = vi.hoisted(() => ({ session: vi.fn(), findFirst: vi.fn(), updateMany: vi.fn(), audit: vi.fn(async () => true), governed: vi.fn() }));
vi.mock("@/lib/desktop/resolveRequestDesktopSession", () => ({ resolveRequestDesktopSession: m.session }));
vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("@/lib/prismaClient", () => ({ Prisma: { DbNull: "DbNull" } }));
vi.mock("@/lib/releaseops/auditEventResponder", () => ({ appendAuditEvent: m.audit }));
vi.mock("@/lib/desktop/configurationMutationRefusal", () => ({ withUnenrolledConfigurationMutation: m.governed }));
import { PUT } from "../route";

const updatedAt = new Date("2026-11-26T00:00:00Z");
const stored = { utcWindows: [{ start: "22:00", end: "02:00" }], weekdays: ["Tue"] };
const call = (body: unknown, id = "env_1") => PUT(new NextRequest(`http://localhost/api/desktop/environments/${id}/change-window`, { method: "PUT", body: JSON.stringify(body) }), { params: Promise.resolve({ id }) });
beforeEach(() => {
  vi.clearAllMocks();
  m.session.mockResolvedValue({ id: "s1", userId: "u1", organizationId: "org1", credentialKind: "desktop_session" });
  m.governed.mockImplementation(async (_r: unknown, _s: unknown, _sig: unknown, assert: () => Promise<void>, mutate: (tx: unknown) => Promise<unknown>) => { await assert(); return mutate({ environment: { findFirst: m.findFirst, updateMany: m.updateMany } }); });
  m.findFirst.mockResolvedValue({ id: "env_1", name: "Prod", changeWindowRuleJson: stored, updatedAt });
  m.updateMany.mockResolvedValue({ count: 1 });
});
describe("PUT /api/desktop/environments/{id}/change-window", () => {
  it("saves a normalized rule with compare-and-set on the rule read and updatedAt, then audits", async () => {
    const rule = { weekdays: ["Mon", "Mon"], utcWindows: [{ start: "09:00", end: "17:00" }], freezes: [{ startUtc: "2026-12-20T00:00:00Z", endUtc: "2027-01-02T00:00:00Z", reason: " Holidays " }] };
    const r = await call({ rule, expectedRule: { weekdays: ["Tue"], utcWindows: [{ end: "02:00", start: "22:00" }] } });
    expect(r.status).toBe(200);
    const saved = { weekdays: ["Mon"], utcWindows: [{ start: "09:00", end: "17:00" }], freezes: [{ startUtc: "2026-12-20T00:00:00.000Z", endUtc: "2027-01-02T00:00:00.000Z", reason: "Holidays" }] };
    expect(await r.json()).toEqual({ ok: true, data: { id: "env_1", changeWindowRule: saved } });
    expect(m.session).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ requiredCapability: "policy:manage" }));
    expect(m.updateMany).toHaveBeenCalledWith({ where: { id: "env_1", organizationId: "org1", updatedAt }, data: { changeWindowRuleJson: saved } });
    expect(m.audit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ kind: "environment.update", summary: expect.stringContaining("1 window(s) on Mon, 1 freeze(s)") }));
  });
  it("clears the rule with null", async () => {
    expect((await call({ rule: null, expectedRule: stored })).status).toBe(200);
    expect(m.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { changeWindowRuleJson: "DbNull" } }));
  });
  it("refuses stale edits, invalid rules, extra fields, unknown environments and unavailable governance", async () => {
    expect((await call({ rule: null, expectedRule: null })).status).toBe(409);
    m.updateMany.mockResolvedValueOnce({ count: 0 });
    expect((await call({ rule: null, expectedRule: stored })).status).toBe(409);
    expect((await call({ rule: { utcWindows: [{ start: "9", end: "5" }] }, expectedRule: stored })).status).toBe(422);
    expect((await call({ rule: null, expectedRule: stored, extra: 1 })).status).toBe(400);
    m.findFirst.mockResolvedValueOnce(null);
    expect((await call({ rule: null, expectedRule: null })).status).toBe(404);
    m.governed.mockRejectedValueOnce(new Error("x"));
    expect((await call({ rule: null, expectedRule: stored })).status).toBe(409);
    m.session.mockResolvedValueOnce(null);
    expect((await call({ rule: null, expectedRule: null })).status).toBe(401);
    expect(m.audit).not.toHaveBeenCalled();
  });
});
