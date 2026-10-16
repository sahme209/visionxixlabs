import { beforeEach, describe, expect, it, vi } from "vitest";
const db = vi.hoisted(() => ({ findFirst: vi.fn(), updateMany: vi.fn(), findMany: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: { axiomApprovalItem: db } }));
import { decideItem, getItemHistory } from "../approvalCenter";

describe("approval decision consumption", () => {
  beforeEach(() => vi.resetAllMocks());
  it("allows one competing decision and preserves its actor and terminal status", async () => {
    const original = { id: "item", organizationId: "tenant", status: "pending", updatedAt: new Date(1), note: null };
    let row = { ...original } as Record<string, unknown>;
    let readers = 0;
    let release!: () => void;
    const bothRead = new Promise<void>((resolve) => { release = resolve; });
    db.findFirst.mockImplementation(async () => {
      const snapshot = { ...row };
      if (++readers === 2) release();
      await bothRead;
      return snapshot;
    });
    db.updateMany.mockImplementation(async ({ where, data }) => {
      // Atomic persistence boundary, shared by the actual concurrent service calls.
      if (!Object.entries(where).every(([key, value]) => row[key] === value)) return { count: 0 };
      row = { ...row, ...data, updatedAt: new Date(2) };
      return { count: 1 };
    });
    const results = await Promise.all([
      decideItem({ itemId: "item", organizationId: "tenant", userId: "alice", action: "approve" }),
      decideItem({ itemId: "item", organizationId: "tenant", userId: "bob", action: "reject" }),
    ]);
    expect(results.filter((r) => r.success)).toHaveLength(1);
    expect(results.filter((r) => !r.success)).toHaveLength(1);
    expect(row).toMatchObject({ status: "approved", decidedBy: "alice", snoozedUntil: null });
    expect(row.decidedAt).toBeInstanceOf(Date);
  });
  it.each(["approved", "applied", "failed", "rejected", "expired"])("cannot overwrite %s", async (status) => {
    db.findFirst.mockResolvedValue({ id: "item", status });
    expect((await decideItem({ itemId: "item", organizationId: "tenant", userId: "alice", action: "approve" })).success).toBe(false);
    expect(db.updateMany).not.toHaveBeenCalled();
  });
  it("scopes lookup to the authenticated tenant and does not mutate missing items", async () => {
    db.findFirst.mockResolvedValue(null);
    expect((await decideItem({ itemId: "foreign", organizationId: "tenant", userId: "alice", action: "approve" })).success).toBe(false);
    expect(db.findFirst).toHaveBeenCalledWith({ where: { id: "foreign", organizationId: "tenant" } });
    expect(db.updateMany).not.toHaveBeenCalled();
  });
  it("rejects a changed revision even when status is still actionable", async () => {
    db.findFirst.mockResolvedValue({ id: "item", status: "pending", updatedAt: new Date(1) });
    db.updateMany.mockResolvedValue({ count: 0 });
    expect((await decideItem({ itemId: "item", organizationId: "tenant", userId: "alice", action: "approve" })).success).toBe(false);
    expect(db.updateMany.mock.calls[0][0].where.updatedAt).toEqual(new Date(1));
  });
});

it("restricts persisted history reads to the supplied authorized organization", async () => {
  db.findMany.mockResolvedValue([]);
  expect(await getItemHistory("foreign-plan", "tenant")).toEqual([]);
  expect(db.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { planItemId: "foreign-plan", organizationId: "tenant" } }));
});
