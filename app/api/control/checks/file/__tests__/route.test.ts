// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const m = vi.hoisted(() => ({ ctx: vi.fn(), admin: true, sameOrigin: true, findMany: vi.fn(), create: vi.fn(), updateMany: vi.fn(), audit: vi.fn() }));
vi.mock("@/lib/auth/currentContext", () => ({ currentContext: m.ctx }));
vi.mock("@/lib/auth/platformAdmin", () => ({ isAdminOrOwner: () => m.admin }));
vi.mock("@/lib/auth/requestOrigin", () => ({ isSameOriginRequest: () => m.sameOrigin }));
vi.mock("@/lib/audit/secureAudit", () => ({ record: m.audit }));
vi.mock("@/lib/db", () => {
  const tx = { deploymentCheck: { create: m.create, updateMany: m.updateMany } };
  return { prisma: { deploymentCheck: { findMany: m.findMany }, $transaction: async (fn: (t: typeof tx) => unknown) => fn(tx) } };
});
import { GET, POST } from "../route";
import { checksDigest } from "@/lib/releaseops/checksAsCode";

const smoke = { key: "smoke", name: "Smoke", kind: "smoke_test", stage: "verify", mode: "blocking", spec: { url: "https://x.example.test", expectStatus: 200, maxLatencyMs: 500 }, enabled: true, version: 2 };
const file = (checks: unknown[]) => JSON.stringify({ kind: "v19.checks", version: 1, checks });
const post = (body: unknown) => POST(new NextRequest("http://localhost/api/control/checks/file", { method: "POST", body: JSON.stringify(body) }));
beforeEach(() => { vi.clearAllMocks(); m.admin = true; m.sameOrigin = true; m.ctx.mockResolvedValue({ isAuthenticated: true, organizationId: "org1", userId: "u1", email: "a@x.test", roles: ["owner"] }); m.findMany.mockResolvedValue([smoke]); m.updateMany.mockResolvedValue({ count: 1 }); });

describe("/api/control/checks/file", () => {
  it("exports a downloadable checks file", async () => {
    const r = await GET();
    expect(r.headers.get("content-disposition")).toContain("v19-checks.json");
    expect(JSON.parse(await r.text()).checks[0].key).toBe("smoke");
  });
  it("previews a plan, then applies it only against the same stored checks", async () => {
    const text = file([{ ...smoke, mode: "advisory", version: undefined }].map(({ version: _v, ...c }) => c));
    const preview = await (await post({ text })).json();
    expect(preview.data.plan.loosening).toEqual(["smoke: no longer blocks deployments"]);
    expect(preview.data.digest).toBe(checksDigest([smoke]));
    expect(m.updateMany).not.toHaveBeenCalled();
    expect((await post({ text, apply: true, expectedDigest: "stale" })).status).toBe(409);
    const applied = await (await post({ text, apply: true, expectedDigest: preview.data.digest })).json();
    expect(applied).toEqual({ ok: true, data: { applied: 1 } });
    expect(m.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { organizationId: "org1", key: "smoke", version: 2 } }));
    expect(m.audit).toHaveBeenCalledWith(expect.objectContaining({ entityRef: "deployment_checks:file" }));
  });
  it("disables checks the file leaves out and rolls back on a concurrent change", async () => {
    const preview = await (await post({ text: file([]) })).json();
    expect(preview.data.plan.ops).toEqual([{ op: "disable", key: "smoke", expectedVersion: 2 }]);
    m.updateMany.mockResolvedValueOnce({ count: 0 });
    const r = await post({ text: file([]), apply: true, expectedDigest: preview.data.digest });
    expect(r.status).toBe(409);
  });
  it("refuses non-admins, cross-origin requests and invalid files", async () => {
    expect((await post({ text: "{" })).status).toBe(422);
    m.admin = false; expect((await post({ text: file([]) })).status).toBe(403);
    m.admin = true; m.sameOrigin = false; expect((await post({ text: file([]) })).status).toBe(403);
  });
});
