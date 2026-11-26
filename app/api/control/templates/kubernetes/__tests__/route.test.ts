// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const m = vi.hoisted(() => ({ ctx: vi.fn() }));
vi.mock("@/lib/auth/currentContext", () => ({ currentContext: m.ctx }));
import { GET } from "../route";
const call = (q: string) => GET(new NextRequest(`http://localhost/api/control/templates/kubernetes?${q}`));
beforeEach(() => m.ctx.mockResolvedValue({ isAuthenticated: true, organizationId: "org1", roles: ["member"] }));
describe("GET /api/control/templates/kubernetes", () => {
  it("downloads a generated workflow for members", async () => {
    const r = await call("strategy=canary&namespace=shop&deployment=checkout&container=web&canaryReplicas=2&observeMinutes=");
    expect(r.status).toBe(200);
    expect(r.headers.get("content-disposition")).toBe('attachment; filename="v19-k8s-canary-checkout.yml"');
    expect(await r.text()).toContain("--replicas=2");
  });
  it("refuses non-members and invalid input", async () => {
    expect((await call("strategy=rolling&namespace=Shop&deployment=a&container=b")).status).toBe(400);
    m.ctx.mockResolvedValueOnce({ isAuthenticated: false });
    expect((await call("strategy=rolling&namespace=shop&deployment=a&container=b")).status).toBe(403);
  });
});
