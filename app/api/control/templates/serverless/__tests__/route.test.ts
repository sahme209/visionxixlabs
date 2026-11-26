// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const m = vi.hoisted(() => ({ ctx: vi.fn() }));
vi.mock("@/lib/auth/currentContext", () => ({ currentContext: m.ctx }));
import { GET } from "../route";
const call = (q: string) => GET(new NextRequest(`http://localhost/api/control/templates/serverless?${q}`));
beforeEach(() => m.ctx.mockResolvedValue({ isAuthenticated: true, organizationId: "org1", roles: ["member"] }));
describe("GET /api/control/templates/serverless", () => {
  it("downloads a generated workflow for members", async () => {
    const r = await call("platform=gcp_cloud_run&name=checkout&region=europe-west1&canaryPercent=25&resourceGroup=");
    expect(r.status).toBe(200);
    expect(r.headers.get("content-disposition")).toBe('attachment; filename="v19-cloud-run-checkout.yml"');
    expect(await r.text()).toContain("candidate=25");
  });
  it("refuses non-members and invalid input", async () => {
    expect((await call("platform=azure_functions&name=f&region=eastus")).status).toBe(400);
    m.ctx.mockResolvedValueOnce({ isAuthenticated: false });
    expect((await call("platform=aws_lambda&name=f&region=us-east-1")).status).toBe(403);
  });
});
