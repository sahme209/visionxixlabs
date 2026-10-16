import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ context: vi.fn(), audit: vi.fn(), first: vi.fn(), update: vi.fn(), legacyFind: vi.fn(), legacyUpdate: vi.fn(), legacyList: vi.fn() }));
vi.mock("@/lib/auth/currentContext", () => ({ requireContext: mocks.context }));
vi.mock("@/lib/db", () => ({ prisma: { axiomApprovalItem: { findFirst: mocks.first, updateMany: mocks.update, findUnique: mocks.legacyFind, update: mocks.legacyUpdate, findMany: mocks.legacyList } } }));
vi.mock("@/lib/audit/secureAudit", () => ({ record: mocks.audit }));
import { POST as snooze } from "@/app/api/approvals/snooze/route";
import { POST as bulk } from "@/app/api/approvals/bulk-decide/route";
import { decideItem } from "@/lib/axiom/approvalCenter";

type Row = { id: string; organizationId: string; status: string; updatedAt: Date; note: string | null; decidedBy?: string; decidedAt?: Date; snoozedUntil?: Date | null };
const origin = "https://visionxixlabs.com";
let rows: Map<string, Row>;
let beforeReturn: (() => Promise<void>) | undefined;
function form(itemId = "own", crossOrigin = false) { return new NextRequest(`${origin}/api/approvals/snooze`, { method: "POST", headers: { origin: crossOrigin ? "https://other.test" : origin, referer: `${origin}/dashboard/approvals`, "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ itemId, days: "7" }) }); }
function batch(itemIds: unknown = ["own"], action = "approve", crossOrigin = false) { return new NextRequest(`${origin}/api/approvals/bulk-decide`, { method: "POST", headers: { origin: crossOrigin ? "https://other.test" : origin, "Content-Type": "application/json" }, body: JSON.stringify({ itemIds, action }) }); }
beforeEach(() => {
  vi.resetAllMocks(); beforeReturn = undefined;
  rows = new Map([ ["own", { id: "own", organizationId: "tenant", status: "pending", updatedAt: new Date(1), note: null }], ["foreign", { id: "foreign", organizationId: "other", status: "pending", updatedAt: new Date(1), note: null }] ]);
  mocks.context.mockResolvedValue({ userId: "actor", organizationId: "tenant", email: "member@example.test", roles: ["owner"] });
  mocks.audit.mockResolvedValue(undefined);
  mocks.first.mockImplementation(async ({ where }: { where: { id: string; organizationId: string } }) => {
    const row = rows.get(where.id); const snapshot = row?.organizationId === where.organizationId ? { ...row } : null;
    await beforeReturn?.(); return snapshot;
  });
  mocks.legacyFind.mockImplementation(async ({ where }: { where: { id: string } }) => { const row = rows.get(where.id); const snapshot = row ? { ...row } : null; await beforeReturn?.(); return snapshot; });
  mocks.legacyList.mockImplementation(async ({ where }: { where: { id: { in: string[] }; organizationId: string; status: { in: string[] } } }) => {
    const snapshot = [...rows.values()].filter(row => where.id.in.includes(row.id) && row.organizationId === where.organizationId && where.status.in.includes(row.status)).map(row => ({ ...row }));
    await beforeReturn?.(); return snapshot;
  });
  mocks.legacyUpdate.mockImplementation(async ({ where, data }: { where: { id: string }; data: Partial<Row> }) => { const row = rows.get(where.id)!; const updated = { ...row, ...data, updatedAt: new Date(row.updatedAt.getTime() + 1) }; rows.set(where.id, updated); return updated; });
  mocks.update.mockImplementation(async ({ where, data }: { where: { id: string | { in: string[] }; organizationId?: string; status?: string; updatedAt?: Date }; data: Partial<Row> }) => {
    let count = 0;
    for (const [id, row] of rows) {
      if ((typeof where.id === "string" ? id !== where.id : !where.id.in.includes(id)) || (where.organizationId !== undefined && row.organizationId !== where.organizationId) || (where.status !== undefined && row.status !== where.status) || (where.updatedAt !== undefined && row.updatedAt.getTime() !== where.updatedAt.getTime())) continue;
      rows.set(id, { ...row, ...data, updatedAt: new Date(row.updatedAt.getTime() + 1) }); count++;
    }
    return { count };
  });
});

function raceBarrier() {
  let reads = 0; let announce!: () => void; let release!: () => void;
  const first = new Promise<void>(resolve => { announce = resolve; });
  const both = new Promise<void>(resolve => { release = resolve; });
  beforeReturn = async () => { if (++reads === 1) announce(); if (reads === 2) release(); await both; };
  return first;
}

describe("public approval siblings use the scoped decision CAS", () => {
  it("preserves authorized snooze with actual actor/time and a safe fallback redirect", async () => {
    const request = form(); request.headers.delete("referer");
    const response = await snooze(request); expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(`${origin}/dashboard/approvals`);
    expect(rows.get("own")).toMatchObject({ status: "snoozed", decidedBy: "actor", decidedAt: expect.any(Date), snoozedUntil: expect.any(Date) });
    expect(mocks.audit).toHaveBeenCalledTimes(1);
  });
  it.each(["snooze", "bulk"])("denies cross-origin %s before data access", async kind => {
    expect((await (kind === "snooze" ? snooze(form("own", true)) : bulk(batch(["own"], "approve", true)))).status).toBe(403);
    expect(mocks.first).not.toHaveBeenCalled(); expect(mocks.update).not.toHaveBeenCalled(); expect(mocks.audit).not.toHaveBeenCalled();
  });
  it.each([{ roles: [] }, { roles: ["read_only"] }, { roles: ["finance_viewer"] }])("denies non-approver roles $roles", async ({ roles }) => {
    mocks.context.mockResolvedValue({ userId: "actor", organizationId: "tenant", email: "member@example.test", roles });
    expect((await snooze(form())).status).toBe(403); expect((await bulk(batch())).status).toBe(403);
    expect(mocks.first).not.toHaveBeenCalled(); expect(mocks.update).not.toHaveBeenCalled();
  });
  it("never mutates or audits a foreign item", async () => {
    expect((await snooze(form("foreign"))).status).toBe(404);
    expect(await (await bulk(batch(["foreign"]))).json()).toEqual({ ok: true, processed: 0, skipped: 1 });
    expect(rows.get("foreign")?.status).toBe("pending"); expect(mocks.update).not.toHaveBeenCalled(); expect(mocks.audit).not.toHaveBeenCalled();
  });
  it("counts only actual committed unique batch wins and preserves actor/time", async () => {
    const response = await bulk(batch(["own", "own", "foreign"]));
    expect(await response.json()).toEqual({ ok: true, processed: 1, skipped: 2 });
    expect(rows.get("own")).toMatchObject({ status: "approved", decidedBy: "actor", decidedAt: expect.any(Date), snoozedUntil: null });
    expect(mocks.audit).toHaveBeenCalledTimes(1);
  });
  it("cannot overwrite approval with concurrent public snooze", async () => {
    const firstRead = raceBarrier();
    const approving = decideItem({ itemId: "own", organizationId: "tenant", userId: "approver", action: "approve" });
    await firstRead; const snoozing = snooze(form());
    expect((await approving).success).toBe(true); expect((await snoozing).status).toBe(409);
    expect(rows.get("own")).toMatchObject({ status: "approved", decidedBy: "approver" });
    expect(mocks.audit).not.toHaveBeenCalled();
  });
  it("cannot overwrite a rejection with concurrent batch approval", async () => {
    const firstRead = raceBarrier();
    const rejecting = decideItem({ itemId: "own", organizationId: "tenant", userId: "reviewer", action: "reject" });
    await firstRead; const approving = bulk(batch());
    expect((await rejecting).success).toBe(true);
    expect(await (await approving).json()).toEqual({ ok: true, processed: 0, skipped: 1 });
    expect(rows.get("own")).toMatchObject({ status: "rejected", decidedBy: "reviewer" }); expect(mocks.audit).not.toHaveBeenCalled();
  });
  it("batch approval wins over stale snooze without terminal resurrection", async () => {
    const firstRead = raceBarrier(); const approving = bulk(batch());
    await firstRead; const snoozing = snooze(form());
    expect(await (await approving).json()).toEqual({ ok: true, processed: 1, skipped: 0 });
    expect((await snoozing).status).toBe(409);
    expect(rows.get("own")?.status).toBe("approved"); expect(mocks.audit).toHaveBeenCalledTimes(1);
  });
  it.each(["approved", "rejected", "applied", "failed", "expired"])("does not resurrect terminal %s items through either sibling", async status => {
    rows.get("own")!.status = status;
    expect((await snooze(form())).status).toBe(409);
    expect(await (await bulk(batch())).json()).toEqual({ ok: true, processed: 0, skipped: 1 });
    expect(mocks.update).not.toHaveBeenCalled(); expect(mocks.audit).not.toHaveBeenCalled();
  });
  it("audit outages do not undo or duplicate successful decisions", async () => {
    mocks.audit.mockRejectedValue(new Error("audit unavailable"));
    expect((await snooze(form())).status).toBe(303);
    expect(await (await bulk(batch(["own"], "reject"))).json()).toEqual({ ok: true, processed: 1, skipped: 0 });
    expect(rows.get("own")?.status).toBe("rejected");
  });
  it("does not claim success when decision storage cannot confirm the write", async () => {
    mocks.update.mockRejectedValue(new Error("connection lost"));
    expect((await snooze(form())).status).toBe(503); expect((await bulk(batch())).status).toBe(503);
    expect(mocks.audit).not.toHaveBeenCalled();
  });
  it("handles malformed batch JSON safely before item reads", async () => {
    const response = await bulk(new NextRequest(`${origin}/api/approvals/bulk-decide`, { method: "POST", headers: { origin }, body: "{" }));
    expect(response.status).toBe(400); expect(mocks.first).not.toHaveBeenCalled();
  });
});
