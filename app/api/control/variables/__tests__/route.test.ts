// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { Prisma } from "@/lib/prismaClient";

const m = vi.hoisted(() => ({
  ctx: vi.fn(), sameOrigin: vi.fn(() => true), audit: vi.fn(),
  envFindMany: vi.fn(), envFindFirst: vi.fn(),
  varFindMany: vi.fn(), setFindMany: vi.fn(async () => [] as unknown[]), setFindFirst: vi.fn(), execFindMany: vi.fn(async () => [] as unknown[]), varCount: vi.fn(), varCreate: vi.fn(), varUpdateMany: vi.fn(), varDeleteMany: vi.fn(),
}));
vi.mock("@/lib/auth/currentContext", () => ({ currentContext: m.ctx }));
vi.mock("@/lib/auth/requestOrigin", () => ({ isSameOriginRequest: m.sameOrigin }));
vi.mock("@/lib/audit/secureAudit", () => ({ record: m.audit }));
vi.mock("@/lib/db", () => ({ prisma: {
  environment: { findMany: m.envFindMany, findFirst: m.envFindFirst },
  deploymentExecution: { findMany: m.execFindMany },
  variableSet: { findMany: m.setFindMany, findFirst: m.setFindFirst },
  configVariable: { findMany: m.varFindMany, count: m.varCount, create: m.varCreate, updateMany: m.varUpdateMany, deleteMany: m.varDeleteMany },
} }));
import { DELETE, GET, POST } from "../route";

const admin = { isAuthenticated: true, organizationId: "org1", userId: "u1", email: "a@example.invalid", roles: ["owner"] };
const viewer = { ...admin, roles: ["viewer"] };
const req = (method: string, body: unknown) => new NextRequest("http://localhost/api/control/variables", { method, body: JSON.stringify(body), headers: { origin: "http://localhost" } });

beforeEach(() => {
  vi.clearAllMocks(); m.sameOrigin.mockReturnValue(true); m.ctx.mockResolvedValue(admin);
  m.envFindFirst.mockResolvedValue({ id: "prod" }); m.varCount.mockResolvedValue(0);
});

describe("/api/control/variables", () => {
  it("GET resolves each environment and reports gaps", async () => {
    m.ctx.mockResolvedValue(viewer);
    m.envFindMany.mockResolvedValue([{ id: "dev", name: "Dev", slug: "dev", tier: "development" }, { id: "prod", name: "Prod", slug: "prod", tier: "production" }]);
    m.varFindMany.mockResolvedValue([{ key: "REGION", value: "eu", scopeKey: "workspace", version: 1 }, { key: "REPLICAS", value: "3", scopeKey: "env:prod", version: 1 }]);
    const body = await (await GET()).json();
    expect(body.data.canEdit).toBe(false);
    expect(body.data.resolved[1].variables).toEqual([{ key: "REGION", value: "eu", source: "workspace" }, { key: "REPLICAS", value: "3", source: "environment" }]);
    expect(body.data.gaps).toEqual([{ key: "REPLICAS", missingIn: ["dev"] }]);
    expect(body.data.resolved[0].lastDeployment).toBeNull();
  });
  it("GET marks an environment whose configuration changed since its last recorded deployment", async () => {
    m.envFindMany.mockResolvedValue([{ id: "prod", name: "Prod", slug: "prod", tier: "prod" }]);
    m.varFindMany.mockResolvedValue([{ key: "REGION", value: "eu", scopeKey: "workspace", version: 1 }]);
    m.execFindMany.mockResolvedValueOnce([{ environmentId: "prod", configDigest: "old", createdAt: new Date("2026-11-20T00:00:00Z") }, { environmentId: "prod", configDigest: "older", createdAt: new Date("2026-11-10T00:00:00Z") }]);
    const body = await (await GET()).json();
    expect(body.data.resolved[0].lastDeployment).toEqual({ digest: "old", at: "2026-11-20T00:00:00.000Z", changedSince: true });
    m.execFindMany.mockRejectedValueOnce(new Error("down"));
    expect((await (await GET()).json()).data.resolved[0].lastDeployment).toBe("unavailable");
  });
  it("refuses non-admins, cross-origin writes and credential-like values without writing", async () => {
    m.ctx.mockResolvedValue(viewer);
    expect((await POST(req("POST", { key: "A", value: "1", environmentId: null }))).status).toBe(403);
    m.ctx.mockResolvedValue(admin); m.sameOrigin.mockReturnValue(false);
    expect((await POST(req("POST", { key: "A", value: "1", environmentId: null }))).status).toBe(403);
    m.sameOrigin.mockReturnValue(true);
    const r = await POST(req("POST", { key: "GITHUB_TOKEN", value: "x", environmentId: null }));
    expect(r.status).toBe(422);
    expect((await r.json()).issues).toContain("looks_like_secret_key");
    expect(m.varCreate).not.toHaveBeenCalled();
  });
  it("creates once, reports an existing variable as a conflict, and refuses unknown environments", async () => {
    m.varCreate.mockResolvedValueOnce({ key: "REPLICAS", scopeKey: "env:prod", version: 1 });
    expect((await POST(req("POST", { key: "REPLICAS", value: "3", environmentId: "prod" }))).status).toBe(201);
    expect(m.audit).toHaveBeenCalledWith(expect.objectContaining({ action: "governance.update", detail: { kind: "variable.create", key: "REPLICAS", scopeKey: "env:prod" } }));
    m.varCreate.mockRejectedValueOnce(new Prisma.PrismaClientKnownRequestError("dup", { code: "P2002", clientVersion: "x" }));
    expect((await POST(req("POST", { key: "REPLICAS", value: "3", environmentId: "prod" }))).status).toBe(409);
    m.envFindFirst.mockResolvedValueOnce(null);
    expect((await POST(req("POST", { key: "REPLICAS", value: "3", environmentId: "other-org-env" }))).status).toBe(404);
  });
  it("updates and deletes only when the version read is still current", async () => {
    m.varUpdateMany.mockResolvedValueOnce({ count: 0 });
    const stale = await POST(req("POST", { key: "REGION", value: "us", environmentId: null, expectedVersion: 2 }));
    expect(stale.status).toBe(409);
    expect(m.varUpdateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { organizationId: "org1", scopeKey: "workspace", key: "REGION", version: 2 } }));
    m.varUpdateMany.mockResolvedValueOnce({ count: 1 });
    expect((await (await POST(req("POST", { key: "REGION", value: "us", environmentId: null, expectedVersion: 2 }))).json()).data.version).toBe(3);
    m.varDeleteMany.mockResolvedValueOnce({ count: 0 });
    expect((await DELETE(req("DELETE", { key: "REGION", environmentId: null, expectedVersion: 1 }))).status).toBe(409);
    m.varDeleteMany.mockResolvedValueOnce({ count: 1 });
    expect((await DELETE(req("DELETE", { key: "REGION", environmentId: null, expectedVersion: 3 }))).status).toBe(200);
  });
  it("returns 503 without detail when storage fails", async () => {
    m.varUpdateMany.mockRejectedValueOnce(new Error("connection reset by 10.0.0.1"));
    const r = await POST(req("POST", { key: "REGION", value: "us", environmentId: null, expectedVersion: 1 }));
    expect(r.status).toBe(503);
    expect(JSON.stringify(await r.json())).not.toContain("10.0.0.1");
  });
  it("GET applies variable sets by environment tags and reports set conflicts", async () => {
    m.envFindMany.mockResolvedValue([{ id: "eu1", name: "EU 1", slug: "eu1", tier: "prod", tags: ["region:eu", "tenant:acme"] }, { id: "us1", name: "US 1", slug: "us1", tier: "prod", tags: [] }]);
    m.varFindMany.mockResolvedValue([{ key: "CDN", value: "eu.cdn", scopeKey: "set:eu", version: 1 }, { key: "CDN", value: "acme.cdn", scopeKey: "set:acme", version: 1 }]);
    m.setFindMany.mockResolvedValue([{ slug: "eu", name: "EU", selector: "region:eu", description: null, version: 1 }, { slug: "acme", name: "Acme", selector: "tenant:acme", description: null, version: 1 }]);
    const body = await (await GET()).json();
    expect(body.data.sets).toHaveLength(2);
    expect(body.data.resolved[0]).toMatchObject({ appliedSets: ["acme", "eu"], conflicts: [{ key: "CDN", sets: ["acme", "eu"] }], variables: [{ key: "CDN", value: "eu.cdn", source: "set", set: "eu" }] });
    expect(body.data.resolved[1]).toMatchObject({ appliedSets: [], variables: [] });
    expect(body.data.gaps).toEqual([{ key: "CDN", missingIn: ["us1"] }]);
  });
  it("POST writes into an existing set and refuses unknown sets or a set plus an environment", async () => {
    m.setFindFirst.mockResolvedValueOnce({ slug: "eu" });
    m.varCreate.mockResolvedValue({ key: "CDN", scopeKey: "set:eu", version: 1 });
    expect((await POST(req("POST", { key: "CDN", value: "eu.cdn", environmentId: null, setSlug: "eu" }))).status).toBe(201);
    expect(m.varCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ scopeKey: "set:eu", environmentId: null }) }));
    m.setFindFirst.mockResolvedValueOnce(null);
    expect((await POST(req("POST", { key: "CDN", value: "x", environmentId: null, setSlug: "nope" }))).status).toBe(404);
    expect((await POST(req("POST", { key: "CDN", value: "x", environmentId: "prod", setSlug: "eu" }))).status).toBe(400);
  });
});
