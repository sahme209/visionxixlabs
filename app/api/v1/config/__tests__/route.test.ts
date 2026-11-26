import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const m = vi.hoisted(() => ({ auth: vi.fn(), env: vi.fn(), sets: vi.fn(), vars: vi.fn(), checks: vi.fn() }));
vi.mock("@/lib/security/authenticateApiKey", () => ({ authenticateApiKey: m.auth }));
vi.mock("@/lib/db", () => ({ prisma: { environment: { findMany: m.env }, variableSet: { findMany: m.sets }, configVariable: { findMany: m.vars }, deploymentCheck: { findMany: m.checks } } }));
import { GET } from "../route";
const call = () => GET(new NextRequest("https://x.test/api/v1/config", { headers: { authorization: "Bearer k" } }));
beforeEach(() => {
  vi.clearAllMocks();
  m.auth.mockResolvedValue({ ok: true, organizationId: "org1", apiKeyId: "k1" });
  m.env.mockResolvedValue([{ id: "e1", slug: "prod", name: "Production", tier: "prod", tags: ["region:eu"], changeWindowRuleJson: { utcWindows: [{ start: "22:00", end: "02:00" }] } }]);
  m.sets.mockResolvedValue([{ slug: "eu", name: "EU", selector: "region:eu", version: 1 }]);
  m.vars.mockResolvedValue([{ key: "A", value: "1", scopeKey: "workspace", version: 1 }, { key: "B", value: "secret://aws-sm/x", scopeKey: "env:e1", version: 2 }, { key: "C", value: "eu", scopeKey: "set:eu", version: 1 }]);
  m.checks.mockResolvedValue([{ key: "smoke", name: "Smoke", kind: "smoke_test", stage: "verify", mode: "blocking", spec: {}, enabled: true, version: 3 }]);
});
describe("GET /api/v1/config", () => {
  it("returns the workspace configuration as code, scoped to the key's workspace", async () => {
    const body = await (await call()).json();
    expect(m.auth).toHaveBeenCalledWith(expect.objectContaining({ requiredScope: "config:read" }));
    expect(m.env.mock.calls[0][0].where).toEqual({ organizationId: "org1" });
    expect(body.environments).toEqual([{ slug: "prod", name: "Production", tier: "prod", tags: ["region:eu"], changeWindow: { utcWindows: [{ start: "22:00", end: "02:00" }] } }]);
    expect(body.variables).toEqual([{ key: "A", value: "1", version: 1, scope: "workspace" }, { key: "B", value: "secret://aws-sm/x", version: 2, scope: "environment", environment: "prod" }, { key: "C", value: "eu", version: 1, scope: "set", set: "eu" }]);
    expect(body.checks).toMatchObject({ kind: "v19.checks", version: 1, checks: [{ key: "smoke", version: 3 }] });
  });
  it("refuses without the scope and hides storage errors", async () => {
    m.auth.mockResolvedValueOnce({ ok: false, reason: "insufficient_scope", httpStatus: 403, requiredScope: "config:read" });
    expect((await call()).status).toBe(403);
    m.env.mockRejectedValueOnce(new Error("db host 10.0.0.1"));
    const r = await call();
    expect(r.status).toBe(503);
    expect(JSON.stringify(await r.json())).not.toContain("10.0.0.1");
  });
});
