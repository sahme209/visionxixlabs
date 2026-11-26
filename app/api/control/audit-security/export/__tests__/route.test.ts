// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const m = vi.hoisted(() => ({ ctx: vi.fn(), admin: true, findMany: vi.fn(), audit: vi.fn() }));
vi.mock("@/lib/auth/currentContext", () => ({ currentContext: m.ctx }));
vi.mock("@/lib/auth/platformAdmin", () => ({ isAdminOrOwner: () => m.admin }));
vi.mock("@/lib/audit/secureAudit", () => ({ record: m.audit }));
vi.mock("@/lib/db", () => ({ prisma: { secureAuditRecord: { findMany: m.findMany } } }));
import { GET } from "../route";
const get = (q: string) => GET(new NextRequest(`http://localhost/api/control/audit-security/export${q}`));
const row = (id: string) => ({ id, occurredAt: new Date("2026-11-27T10:00:00Z"), action: "governance.update", outcome: "success", actorKind: "user", actorUserId: "u1", entityRef: "x", correlationId: "c", source: "live", errorCode: null });
beforeEach(() => { vi.clearAllMocks(); m.admin = true; m.ctx.mockResolvedValue({ isAuthenticated: true, organizationId: "org1", userId: "u1", email: "a@x.test", roles: ["owner"] }); m.findMany.mockResolvedValue([row("a1")]); });

describe("GET /api/control/audit-security/export", () => {
  it("downloads this workspace's records as CSV without detail and audits the export", async () => {
    const res = await get("?days=7");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/csv");
    expect(res.headers.get("Content-Disposition")).toMatch(/v19-audit-7d-\d{4}-\d{2}-\d{2}\.csv/);
    expect((await res.text()).split("\r\n")[1]).toContain("a1");
    const q = m.findMany.mock.calls[0][0];
    expect(q.where.organizationId).toBe("org1");
    expect(q.select).not.toHaveProperty("detail");
    expect(m.audit).toHaveBeenCalledWith(expect.objectContaining({ entityRef: "audit_export", detail: expect.objectContaining({ days: 7, format: "csv", rows: 1, truncated: false }) }));
  });
  it("marks truncation past 10,000 rows and supports NDJSON", async () => {
    m.findMany.mockResolvedValue(Array.from({ length: 10_001 }, (_, i) => row(`a${i}`)));
    const res = await get("?days=90&format=ndjson");
    expect(res.headers.get("X-V19-Truncated")).toBe("true");
    expect((await res.text()).trim().split("\n")).toHaveLength(10_000);
  });
  it("refuses members and bad queries", async () => {
    expect((await get("?days=5")).status).toBe(400);
    expect((await get("?format=xml")).status).toBe(400);
    m.admin = false;
    expect((await get("")).status).toBe(403);
    expect(m.findMany).not.toHaveBeenCalled();
  });
});
