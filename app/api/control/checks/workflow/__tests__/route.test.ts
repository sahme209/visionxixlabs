// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const m = vi.hoisted(() => ({ ctx: vi.fn(), findMany: vi.fn() }));
vi.mock("@/lib/auth/currentContext", () => ({ currentContext: m.ctx }));
vi.mock("@/lib/db", () => ({ prisma: { deploymentCheck: { findMany: m.findMany } } }));
import { GET } from "../route";

const row = { key: "health-probe", name: "Health probe", kind: "smoke_test", stage: "verify", mode: "blocking", enabled: true, version: 2, spec: { url: "https://a.example.invalid/h", expectStatus: 200, maxLatencyMs: 500 } };
beforeEach(() => { vi.clearAllMocks(); m.ctx.mockResolvedValue({ isAuthenticated: true, organizationId: "org1", roles: ["viewer"] }); m.findMany.mockResolvedValue([row]); });
describe("GET /api/control/checks/workflow", () => {
  it("returns the generated workflow for members, scoped to their workspace", async () => {
    const body = await (await GET(new NextRequest("http://localhost/api/control/checks/workflow"))).json();
    expect(body.data.included).toEqual(["health-probe"]);
    expect(m.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { organizationId: "org1" } }));
  });
  it("downloads YAML and refuses non-members", async () => {
    const r = await GET(new NextRequest("http://localhost/api/control/checks/workflow?format=yaml"));
    expect(r.headers.get("content-disposition")).toContain("v19-deployment-checks.yml");
    expect(await r.text()).toContain("name: V19 deployment checks");
    m.ctx.mockResolvedValueOnce({ isAuthenticated: false });
    expect((await GET(new NextRequest("http://localhost/api/control/checks/workflow"))).status).toBe(403);
  });
});
