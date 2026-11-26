// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const m = vi.hoisted(() => ({ session: vi.fn(), checks: vi.fn(), results: vi.fn() }));
vi.mock("@/lib/desktop/resolveRequestDesktopSession", () => ({ resolveRequestDesktopSession: m.session }));
vi.mock("@/lib/db", () => ({ prisma: { deploymentCheck: { findMany: m.checks }, deploymentCheckResult: { findMany: m.results } } }));
import { GET } from "../route";
const a = "a".repeat(40), b = "b".repeat(40);
const call = (q: string) => GET(new NextRequest(`http://localhost/api/desktop/checks/results?commits=${q}`));
beforeEach(() => { vi.clearAllMocks(); m.session.mockResolvedValue({ organizationId: "org1" }); m.checks.mockResolvedValue([{ key: "smoke" }, { key: "scan" }]); });
describe("GET /api/desktop/checks/results", () => {
  it("summarizes the latest result per blocking check for each commit", async () => {
    m.results.mockResolvedValue([
      { checkKey: "smoke", releaseRef: a, status: "failed", reportedAt: new Date("2026-11-26T10:00:00Z") },
      { checkKey: "smoke", releaseRef: a, status: "passed", reportedAt: new Date("2026-11-26T11:00:00Z") },
      { checkKey: "scan", releaseRef: a, status: "failed", reportedAt: new Date("2026-11-26T11:00:00Z") },
    ]);
    const body = await (await call(`${a},${b}`)).json();
    expect(body.data.commits[a]).toEqual({ total: 2, passed: 1, failed: 1, missing: 0 });
    expect(body.data.commits[b]).toEqual({ total: 2, passed: 0, failed: 0, missing: 2 });
  });
  it("validates commits, needs a session, and reports storage failure", async () => {
    expect((await call("abc")).status).toBe(400);
    m.session.mockResolvedValueOnce(null);
    expect((await call(a)).status).toBe(401);
    m.checks.mockRejectedValueOnce(new Error("down"));
    expect((await call(a)).status).toBe(503);
  });
});
