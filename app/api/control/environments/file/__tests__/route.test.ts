// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const m = vi.hoisted(() => ({ ctx: vi.fn(), admin: true, sameOrigin: true, findMany: vi.fn(), create: vi.fn(), updateMany: vi.fn(), audit: vi.fn(), unenrolled: vi.fn(async () => true) }));
vi.mock("@/lib/auth/currentContext", () => ({ currentContext: m.ctx }));
vi.mock("@/lib/auth/platformAdmin", () => ({ isAdminOrOwner: () => m.admin }));
vi.mock("@/lib/auth/requestOrigin", () => ({ isSameOriginRequest: () => m.sameOrigin }));
vi.mock("@/lib/audit/secureAudit", () => ({ record: m.audit }));
vi.mock("@/lib/governance/intelligence/enrolledRefusal", () => ({ workspaceUnenrolled: m.unenrolled }));
vi.mock("@/lib/prismaClient", () => ({ Prisma: { DbNull: "DbNull", PrismaClientKnownRequestError: class extends Error { code = ""; } } }));
vi.mock("@/lib/db", () => {
  const tx = { environment: { create: m.create, updateMany: m.updateMany } };
  return { prisma: { environment: { findMany: m.findMany }, $transaction: async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx) } };
});
import { GET, POST } from "../route";

const t = new Date("2026-11-27T00:00:00Z");
const stored = [{ id: "e1", slug: "dev", name: "Dev", tier: "dev", displayOrder: 0, tags: [], changeWindowRuleJson: null, updatedAt: t }];
const file = (envs: unknown[]) => JSON.stringify({ kind: "v19.environments", version: 1, environments: envs });
const post = (body: unknown) => POST(new NextRequest("http://localhost/api/control/environments/file", { method: "POST", body: JSON.stringify(body) }));
beforeEach(() => {
  vi.clearAllMocks(); m.admin = true; m.sameOrigin = true;
  m.ctx.mockResolvedValue({ isAuthenticated: true, organizationId: "org1", userId: "u1", email: "a@x.test", roles: ["owner"] });
  m.findMany.mockResolvedValue(stored); m.updateMany.mockResolvedValue({ count: 1 }); m.create.mockResolvedValue({});
});

describe("/api/control/environments/file", () => {
  it("downloads the environments file for members", async () => {
    const res = await GET();
    expect(res.headers.get("Content-Disposition")).toContain("v19-environments.json");
    expect(JSON.parse(await res.text()).environments[0]).toMatchObject({ slug: "dev", tier: "dev" });
    expect(m.findMany.mock.calls[0][0].where).toEqual({ organizationId: "org1" });
  });
  it("previews, then applies the plan only with the previewed digest", async () => {
    const text = file([{ slug: "dev", name: "Development", tier: "dev", displayOrder: 0 }, { slug: "qa", name: "QA", tier: "qa", displayOrder: 1, tags: ["ring:1"] }]);
    const preview = await (await post({ text })).json();
    expect(preview.data.plan.ops).toHaveLength(2);
    expect(m.create).not.toHaveBeenCalled();
    expect((await post({ text, apply: true, expectedDigest: "stale" })).status).toBe(409);
    const res = await post({ text, apply: true, expectedDigest: preview.data.digest });
    expect((await res.json()).data.applied).toBe(2);
    expect(m.updateMany.mock.calls[0][0]).toMatchObject({ where: { id: "e1", organizationId: "org1", updatedAt: t }, data: { name: "Development" } });
    expect(m.create.mock.calls[0][0].data).toMatchObject({ organizationId: "org1", slug: "qa", tier: "qa", tags: ["ring:1"], changeWindowRuleJson: "DbNull" });
    expect(m.audit).toHaveBeenCalledWith(expect.objectContaining({ entityRef: "environments:file" }));
  });
  it("refuses tier changes, concurrent edits, enrolled workspaces and non-admins", async () => {
    const tier = file([{ slug: "dev", name: "Dev", tier: "prod" }]);
    const d1 = (await (await post({ text: tier })).json()).data.digest;
    expect((await post({ text: tier, apply: true, expectedDigest: d1 })).status).toBe(422);
    const text = file([{ slug: "dev", name: "Development", tier: "dev" }]);
    const d2 = (await (await post({ text })).json()).data.digest;
    m.updateMany.mockResolvedValueOnce({ count: 0 });
    expect((await post({ text, apply: true, expectedDigest: d2 })).status).toBe(409);
    m.unenrolled.mockResolvedValueOnce(false);
    expect((await post({ text, apply: true, expectedDigest: d2 })).status).toBe(409);
    m.admin = false;
    expect((await post({ text })).status).toBe(403);
    m.admin = true; m.sameOrigin = false;
    expect((await post({ text })).status).toBe(403);
  });
  it("returns file issues for an invalid file", async () => {
    const res = await post({ text: file([{ slug: "x", name: "X", tier: "live" }]) });
    expect(res.status).toBe(422);
    expect((await res.json()).issues[0]).toMatch(/environments\.0\.tier/);
  });
});
