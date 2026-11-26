// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const m = vi.hoisted(() => ({ auth: vi.fn(), envFindFirst: vi.fn(), varFindMany: vi.fn() }));
vi.mock("@/lib/security/authenticateApiKey", () => ({ authenticateApiKey: m.auth }));
vi.mock("@/lib/db", () => ({ prisma: { environment: { findFirst: m.envFindFirst }, configVariable: { findMany: m.varFindMany }, variableSet: { findMany: async () => [] } } }));
import { GET } from "../route";
import { resolvedDigest } from "@/lib/releaseops/scopedVariables";

const call = (slug: string) => GET(new NextRequest(`http://localhost/api/v1/environments/${slug}/variables`, { headers: { authorization: "Bearer vxlk_test" } }), { params: Promise.resolve({ slug }) });
beforeEach(() => { vi.clearAllMocks(); m.auth.mockResolvedValue({ ok: true, apiKeyId: "k", organizationId: "org1", scopes: ["pipeline:read"], env: "live" }); });

describe("GET /api/v1/environments/{slug}/variables", () => {
  it("requires pipeline:read and passes the auth refusal through", async () => {
    m.auth.mockResolvedValueOnce({ ok: false, reason: "insufficient_scope", httpStatus: 403, requiredScope: "pipeline:read" });
    const r = await call("prod");
    expect(r.status).toBe(403);
    expect(await r.json()).toEqual({ ok: false, error: "insufficient_scope", requiredScope: "pipeline:read" });
    expect(m.auth).toHaveBeenCalledWith(expect.objectContaining({ requiredScope: "pipeline:read" }));
  });
  it("returns the environment's resolved variables, sources and fingerprint, scoped to the key's workspace", async () => {
    m.envFindFirst.mockResolvedValue({ id: "e_prod", slug: "prod", name: "Production" });
    m.varFindMany.mockResolvedValue([{ key: "REGION", value: "eu", scopeKey: "workspace" }, { key: "LOG_LEVEL", value: "info", scopeKey: "workspace" }, { key: "LOG_LEVEL", value: "warn", scopeKey: "env:e_prod" }, { key: "X", value: "dev-only", scopeKey: "env:e_dev" }]);
    const body = await (await call("prod")).json();
    expect(m.envFindFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { organizationId: "org1", slug: "prod" } }));
    expect(body.variables).toEqual({ LOG_LEVEL: "warn", REGION: "eu" });
    expect(body.sources).toEqual({ LOG_LEVEL: "environment", REGION: "workspace" });
    expect(body.digest).toBe(resolvedDigest([{ key: "LOG_LEVEL", value: "warn", source: "environment" }, { key: "REGION", value: "eu", source: "workspace" }]));
  });
  it("returns secret references unresolved and lists them under secretRefs", async () => {
    m.envFindFirst.mockResolvedValue({ id: "e_prod", slug: "prod", name: "Production" });
    m.varFindMany.mockResolvedValue([{ key: "DB_URL", value: "secret://aws-sm/prod/db#url", scopeKey: "workspace" }]);
    const body = await (await call("prod")).json();
    expect(body.variables).toEqual({ DB_URL: "secret://aws-sm/prod/db#url" });
    expect(body.secretRefs).toEqual({ DB_URL: { provider: "aws-sm", path: "prod/db", field: "url" } });
  });
  it("refuses malformed slugs, reports unknown environments and hides storage errors", async () => {
    expect((await call("../x")).status).toBe(400);
    m.envFindFirst.mockResolvedValueOnce(null);
    expect((await call("nope")).status).toBe(404);
    m.envFindFirst.mockRejectedValueOnce(new Error("db at 10.1.2.3 down"));
    const r = await call("prod");
    expect(r.status).toBe(503);
    expect(JSON.stringify(await r.json())).not.toContain("10.1.2.3");
  });
});
