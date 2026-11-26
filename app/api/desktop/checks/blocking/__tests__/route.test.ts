// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const m = vi.hoisted(() => ({ session: vi.fn(), findMany: vi.fn() }));
vi.mock("@/lib/desktop/resolveRequestDesktopSession", () => ({ resolveRequestDesktopSession: m.session }));
vi.mock("@/lib/db", () => ({ prisma: { deploymentCheck: { findMany: m.findMany } } }));
import { GET } from "../route";
const call = () => GET(new NextRequest("http://localhost/api/desktop/checks/blocking"));
beforeEach(() => { vi.clearAllMocks(); m.session.mockResolvedValue({ organizationId: "org1" }); });
describe("GET /api/desktop/checks/blocking", () => {
  it("lists enabled blocking checks before Deploy in stage order", async () => {
    m.findMany.mockResolvedValue([{ key: "z", name: "Z", kind: "manual_checklist", stage: "approve" }, { key: "a", name: "A", kind: "health_check", stage: "validate" }, { key: "b", name: "B", kind: "smoke_test", stage: "plan" }]);
    const body = await (await call()).json();
    expect(body.data.checks.map((c: { key: string }) => c.key)).toEqual(["b", "a", "z"]);
    expect(body.data.checks.every((c: { enforced: boolean }) => c.enforced)).toBe(true);
    expect(m.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { organizationId: "org1", enabled: true, mode: "blocking", stage: { in: ["plan", "validate", "approve"] } } }));
  });
  it("requires a desktop session and reports storage failure", async () => {
    m.session.mockResolvedValueOnce(null);
    expect((await call()).status).toBe(401);
    m.findMany.mockRejectedValueOnce(new Error("down"));
    expect((await call()).status).toBe(503);
  });
});
