import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ context: vi.fn(), allowed: vi.fn(), findUnique: vi.fn(), updateMany: vi.fn(), audit: vi.fn() }));
vi.mock("@/lib/auth/currentContext", () => ({ requireContext: mocks.context }));
vi.mock("@/lib/auth/platformAdmin", () => ({ canDecideApprovals: mocks.allowed }));
vi.mock("@/lib/db", () => ({ prisma: { axiomApprovalItem: { findUnique: mocks.findUnique, updateMany: mocks.updateMany } } }));
vi.mock("@/lib/audit/secureAudit", () => ({ record: mocks.audit }));
import { POST } from "@/app/api/approvals/decide/route";
import { NextRequest } from "next/server";
function request(action = "approve") {
  return new NextRequest("https://example.com/api/approvals/decide", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", origin: "https://example.com", referer: "https://example.com/dashboard/approvals" }, body: new URLSearchParams({ itemId: "item", action }) });
}
describe("form approval boundary", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.context.mockResolvedValue({ userId: "alice", organizationId: "tenant", roles: ["owner"] });
    mocks.allowed.mockReturnValue(true);
    mocks.findUnique.mockResolvedValue({ id: "item", organizationId: "tenant", status: "pending", updatedAt: new Date(1), title: "Finding" });
    mocks.updateMany.mockResolvedValue({ count: 1 });
  });
  it("returns conflict without a success audit when another decision won", async () => {
    mocks.updateMany.mockResolvedValue({ count: 0 });
    expect((await POST(request())).status).toBe(409);
    expect(mocks.audit).not.toHaveBeenCalled();
  });
  it("records decision actor/revision and preserves the committed outcome during audit outage", async () => {
    mocks.audit.mockRejectedValue(new Error("audit unavailable"));
    expect((await POST(request())).status).toBe(303);
    expect(mocks.updateMany).toHaveBeenCalledWith({ where: { id: "item", organizationId: "tenant", status: "pending", updatedAt: new Date(1) }, data: { status: "approved", decidedBy: "alice", decidedAt: expect.any(Date), snoozedUntil: null } });
  });
  it("refuses a foreign tenant", async () => {
    mocks.findUnique.mockResolvedValue({ organizationId: "other" });
    expect((await POST(request())).status).toBe(404);
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });
  it("refuses a revoked approver", async () => {
    mocks.allowed.mockReturnValue(false);
    expect((await POST(request())).status).toBe(403);
    expect(mocks.findUnique).not.toHaveBeenCalled();
  });
  it("never overwrites an applied item", async () => {
    mocks.findUnique.mockResolvedValue({ organizationId: "tenant", status: "applied" });
    expect((await POST(request())).status).toBe(409);
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });
});

it.each([null, "null", "https://attacker.example"])("refuses form origin %s before authorization or approval IO", async (origin) => {
  vi.clearAllMocks();
  const req = request();
  if (origin === null) req.headers.delete("origin"); else req.headers.set("origin", origin);
  expect((await POST(req)).status).toBe(403);
  expect(mocks.context).not.toHaveBeenCalled();
  expect(mocks.findUnique).not.toHaveBeenCalled();
  expect(mocks.updateMany).not.toHaveBeenCalled();
  expect(mocks.audit).not.toHaveBeenCalled();
});

describe("committed approval redirect compatibility", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.context.mockResolvedValue({ userId: "alice", organizationId: "tenant", roles: ["owner"] });
    mocks.allowed.mockReturnValue(true);
    mocks.findUnique.mockResolvedValue({ id: "item", organizationId: "tenant", status: "pending", updatedAt: new Date(1), title: "Finding" });
    mocks.updateMany.mockResolvedValue({ count: 1 });
  });
  it.each([null, "https://attacker.example/dashboard/approvals", "malformed referer", "https://example.com/dashboard/settings", "https://user:pass@example.com/dashboard/approvals"])("safely returns to the queue for referer %s", async (referer) => {
    const req = request();
    if (referer === null) req.headers.delete("referer"); else req.headers.set("referer", referer);
    const response = await POST(req);
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("https://example.com/dashboard/approvals");
    expect(mocks.updateMany).toHaveBeenCalledTimes(1);
    expect(mocks.audit).toHaveBeenCalledTimes(1);
  });
  it("preserves only same-origin queue query parameters", async () => {
    const req = request();
    req.headers.set("referer", "https://example.com/dashboard/approvals?status=pending#untrusted-fragment");
    const response = await POST(req);
    expect(response.headers.get("location")).toBe("https://example.com/dashboard/approvals?status=pending");
  });
  it("does not redirect or audit when the decision loses", async () => {
    mocks.updateMany.mockResolvedValue({ count: 0 });
    const req = request(); req.headers.delete("referer");
    const response = await POST(req);
    expect(response.status).toBe(409);
    expect(response.headers.get("location")).toBeNull();
    expect(mocks.audit).not.toHaveBeenCalled();
  });
});
