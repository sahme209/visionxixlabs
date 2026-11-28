// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const io = vi.hoisted(() => ({ admin: true, sameOrigin: true, findMany: vi.fn(), violations: vi.fn(async (): Promise<unknown[]> => []) }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/currentContext", () => ({ currentContext: async () => ({ isAuthenticated: true, organizationId: "org_p", userId: "u", email: "a@example.test", roles: ["owner"] }) }));
vi.mock("@/lib/auth/platformAdmin", () => ({ isAdminOrOwner: () => io.admin }));
vi.mock("@/lib/auth/requestOrigin", () => ({ isSameOriginRequest: () => io.sameOrigin }));
vi.mock("@/lib/db", () => ({ prisma: { policyRule: { findMany: io.findMany }, policyViolation: { findMany: io.violations }, workspaceReleaseAutopilot: { findUnique: async () => null } } }));
import { GET } from "../export/route";
import { POST } from "../diff/route";

const rule = (key: string, over: Record<string, unknown> = {}) => ({ key, label: key, severity: "high", blocking: true, exceptionAllowed: false, approverRole: null, evidenceRequired: true, enabled: true, description: null, ...over });
beforeEach(() => { io.admin = true; io.sameOrigin = true; io.findMany.mockReset().mockResolvedValue([rule("min_approvals")]); });
const post = (body: string) => POST(new NextRequest("https://x.test/api/control/policy/diff", { method: "POST", body }));

describe("policy as code routes", () => {
  it("exports the workspace's rules as a downloadable document", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-disposition")).toContain("v19-policy.json");
    expect(JSON.parse(await res.text()).rules[0].key).toBe("min_approvals");
    expect(io.findMany.mock.calls[0][0].where).toEqual({ organizationId: "org_p" });
  });

  it("diffs a proposed document without writing anything", async () => {
    const res = await post(JSON.stringify({ kind: "v19.policy", version: 1, rules: [rule("min_approvals", { blocking: false })] }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data.loosening).toEqual(["min_approvals: no longer blocks releases"]);
    expect(body.data.backtest).toMatchObject({ releases: 0, newlyBlocked: [], newlyUnblocked: [] });
  });

  it("backtests the proposal against recorded violations, and omits the backtest if history cannot be read", async () => {
    io.violations.mockResolvedValueOnce([{ releaseId: "rel_1", exceptionGrantedAt: null, rule: { key: "min_approvals" } }]);
    const body = await (await post(JSON.stringify({ kind: "v19.policy", version: 1, rules: [rule("min_approvals", { blocking: false })] }))).json();
    expect(body.data.backtest).toMatchObject({ releases: 1, blockedNow: 1, blockedProposed: 0, newlyUnblocked: ["rel_1"] });
    io.violations.mockRejectedValueOnce(new Error("db"));
    const fallback = await (await post(JSON.stringify({ kind: "v19.policy", version: 1, rules: [rule("min_approvals")] }))).json();
    expect(fallback.data.backtest).toBeNull();
  });

  it("refuses non-admins, cross-origin posts and invalid documents", async () => {
    io.admin = false;
    expect((await GET()).status).toBe(403);
    io.admin = true; io.sameOrigin = false;
    expect((await post("{}")).status).toBe(403);
    io.sameOrigin = true;
    const bad = await post("{\"kind\":\"other\"}");
    expect(bad.status).toBe(422);
  });
});
