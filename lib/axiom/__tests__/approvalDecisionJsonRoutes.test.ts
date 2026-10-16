import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ session: vi.fn(), context: vi.fn(), allowed: vi.fn(), decide: vi.fn(), batch: vi.fn(), user: vi.fn(), history: vi.fn(), list: vi.fn() }));
vi.mock("next-auth", () => ({ getServerSession: m.session }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/auth/currentContext", () => ({ currentContext: m.context }));
vi.mock("@/lib/auth/platformAdmin", () => ({ canDecideApprovals: m.allowed }));
vi.mock("@/lib/entitlements", () => ({ getEntitlementsFromPlan: () => ({ axiomExecution: true }) }));
vi.mock("@/lib/db", () => ({ prisma: { user: { findUnique: m.user } } }));
vi.mock("@/lib/axiom/approvalCenter", () => ({ decideItem: m.decide, batchDecide: m.batch, getItemHistory: m.history, listPendingApprovals: m.list, createApprovalItems: vi.fn(), expireStaleItems: vi.fn() }));
import { PUT, GET as historyGET } from "@/app/api/axiom/approvals/[id]/route";
import { POST, GET as listGET } from "@/app/api/axiom/approvals/route";
import { NextRequest } from "next/server";
const req = () => new NextRequest("https://example.com/api/axiom/approvals/item", { method: "PUT", headers: { origin: "https://example.com" }, body: JSON.stringify({ action: "approve", itemIds: ["item"], organizationId: "forged" }) });
describe("JSON approval authority boundaries", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    m.session.mockResolvedValue({ user: { id: "alice" } });
    m.user.mockResolvedValue({ plan: "enterprise" });
    m.context.mockResolvedValue({ userId: "alice", organizationId: "tenant", roles: ["owner"] });
    m.allowed.mockReturnValue(true);
    m.decide.mockResolvedValue({ success: true });
    m.batch.mockResolvedValue({ succeeded: 1, failed: 0 });
  });
  it("forwards only server-resolved tenant identity on single and batch decisions", async () => {
    expect((await PUT(req(), { params: Promise.resolve({ id: "item" }) })).status).toBe(200);
    expect((await POST(req())).status).toBe(200);
    expect(m.decide).toHaveBeenCalledWith(expect.objectContaining({ organizationId: "tenant", userId: "alice" }));
    expect(m.batch).toHaveBeenCalledWith(expect.objectContaining({ organizationId: "tenant", userId: "alice" }));
  });
  it("denies both mutation paths when membership no longer grants approval", async () => {
    m.allowed.mockReturnValue(false);
    expect((await PUT(req(), { params: Promise.resolve({ id: "item" }) })).status).toBe(403);
    expect((await POST(req())).status).toBe(403);
    expect(m.decide).not.toHaveBeenCalled();
    expect(m.batch).not.toHaveBeenCalled();
  });
  it("returns conflict when the shared atomic decision loses", async () => {
    m.decide.mockResolvedValue({ success: false, error: "changed", item: { id: "item", status: "pending" } });
    expect((await PUT(req(), { params: Promise.resolve({ id: "item" }) })).status).toBe(409);
  });
  it("refuses context/session identity disagreement", async () => {
    m.context.mockResolvedValue({ userId: "other", organizationId: "tenant", roles: ["owner"] });
    expect((await PUT(req(), { params: Promise.resolve({ id: "item" }) })).status).toBe(403);
    expect(m.decide).not.toHaveBeenCalled();
  });
});

describe("JSON approval read isolation", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    m.session.mockResolvedValue({ user: { id: "alice" } });
    m.user.mockResolvedValue({ plan: "enterprise" });
    m.context.mockResolvedValue({ userId: "alice", organizationId: "tenant", roles: ["read_only"] });
    m.history.mockResolvedValue([]);
    m.list.mockResolvedValue({ items: [] });
  });
  it("rejects a foreign list request before reading approvals", async () => {
    expect((await listGET(new NextRequest("https://example.com/api/axiom/approvals?organizationId=other"))).status).toBe(404);
    expect(m.list).not.toHaveBeenCalled();
  });
  it("preserves member reads and derives the workspace server-side", async () => {
    expect((await listGET(new NextRequest("https://example.com/api/axiom/approvals"))).status).toBe(200);
    expect(m.list).toHaveBeenCalledWith("tenant", expect.any(Object));
  });
  it("returns the same unavailable history response without cross-tenant lookup", async () => {
    expect((await historyGET(req(), { params: Promise.resolve({ id: "foreign" }) })).status).toBe(404);
    expect(m.history).toHaveBeenCalledWith("foreign", "tenant");
  });
  it("does not read approval data before authentication", async () => {
    m.session.mockResolvedValue(null);
    expect((await listGET(req())).status).toBe(401);
    expect((await historyGET(req(), { params: Promise.resolve({ id: "item" }) })).status).toBe(401);
    expect(m.list).not.toHaveBeenCalled();
    expect(m.history).not.toHaveBeenCalled();
    expect(m.context).not.toHaveBeenCalled();
  });
  it("refuses reads after membership removal", async () => {
    m.context.mockResolvedValue({ userId: "alice", organizationId: "tenant", roles: [] });
    expect((await listGET(req())).status).toBe(403);
    expect(m.list).not.toHaveBeenCalled();
  });
});

it.each([null, "null", "https://attacker.example"])("refuses JSON mutation origin %s including text/plain bodies before IO", async (origin) => {
  vi.clearAllMocks();
  for (const call of [(r: NextRequest) => PUT(r, { params: Promise.resolve({ id: "item" }) }), POST]) {
    const request = req();
    request.headers.set("content-type", "text/plain");
    if (origin === null) request.headers.delete("origin"); else request.headers.set("origin", origin);
    expect((await call(request)).status).toBe(403);
  }
  expect(m.session).not.toHaveBeenCalled();
  expect(m.context).not.toHaveBeenCalled();
  expect(m.user).not.toHaveBeenCalled();
  expect(m.decide).not.toHaveBeenCalled();
  expect(m.batch).not.toHaveBeenCalled();
});
