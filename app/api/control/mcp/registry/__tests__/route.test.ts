// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const m = vi.hoisted(() => ({ ctx: vi.fn(), fetchPage: vi.fn() }));
vi.mock("@/lib/auth/currentContext", () => ({ currentContext: m.ctx }));
vi.mock("@/lib/integrations/mcp/mcpRegistry", () => ({ fetchRegistryPage: m.fetchPage }));
import { GET } from "../route";
const get = (q: string) => GET(new NextRequest(`http://localhost/api/control/mcp/registry${q}`));
beforeEach(() => { vi.clearAllMocks(); m.ctx.mockResolvedValue({ isAuthenticated: true, organizationId: "org1", roles: ["member"] }); m.fetchPage.mockResolvedValue({ servers: [], nextCursor: null, dropped: 0 }); });
describe("GET /api/control/mcp/registry", () => {
  it("passes the search and cursor through for members", async () => {
    const res = await get("?search=postgres&cursor=a%3A1");
    expect(res.status).toBe(200);
    expect(m.fetchPage).toHaveBeenCalledWith({ search: "postgres", cursor: "a:1" });
  });
  it("refuses non-members and bad queries, and reports an unavailable registry", async () => {
    expect((await get(`?search=${"x".repeat(101)}`)).status).toBe(400);
    m.fetchPage.mockRejectedValueOnce(new Error("registry_http_503"));
    expect((await get("")).status).toBe(503);
    m.ctx.mockResolvedValue({ isAuthenticated: true, organizationId: "org1", roles: [] });
    expect((await get("")).status).toBe(403);
  });
});
