// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const m = vi.hoisted(() => ({ ctx: vi.fn(), exec: vi.fn(), env: vi.fn(), results: vi.fn(), events: vi.fn(), audit: vi.fn() }));
vi.mock("@/lib/auth/currentContext", () => ({ currentContext: m.ctx }));
vi.mock("@/lib/audit/secureAudit", () => ({ record: m.audit }));
vi.mock("@/lib/db", () => ({ prisma: { deploymentExecution: { findMany: m.exec }, environment: { findMany: m.env }, deploymentCheckResult: { findMany: m.results }, auditEvent: { findMany: m.events } } }));
import { GET } from "../route";

const SHA = "b".repeat(40);
const call = (q: string) => GET(new NextRequest(`http://localhost/api/control/releases/evidence-pack?${q}`));
beforeEach(() => {
  vi.clearAllMocks();
  m.ctx.mockResolvedValue({ isAuthenticated: true, organizationId: "org1", userId: "u1", roles: ["member"] });
  m.exec.mockResolvedValue([{ id: "d1", environmentId: "e1", sourceRef: "main", triggeredByUserId: "u1", source: "desktop", status: "completed", conclusion: "success", rollbackStatus: "not_started", branchPolicyId: "bp1", pullRequestUrl: null, workflowUrl: null, configDigest: "cfg", createdAt: new Date("2026-11-26T10:00:00Z"), completedAt: new Date("2026-11-26T10:03:00Z") }]);
  m.env.mockResolvedValue([{ id: "e1", name: "Production", tier: "prod" }]);
  m.results.mockResolvedValue([{ checkKey: "smoke", checkVersion: 1, stage: "production", status: "passed", environmentSlug: "prod", runUrl: null, reportedAt: new Date("2026-11-26T10:04:00Z") }]);
  m.events.mockResolvedValue([{ kind: "release.transition", subjectId: "d1", outcome: "ok", summary: "Deployed", actorUserId: "u1", createdAt: new Date("2026-11-26T10:03:00Z") }]);
});
describe("GET /api/control/releases/evidence-pack", () => {
  it("downloads a scoped, digested pack and audits the export", async () => {
    const r = await call(`repository=acme/web&commit=${SHA}`);
    expect(r.status).toBe(200);
    expect(r.headers.get("content-disposition")).toBe(`attachment; filename="v19-evidence-acme-web-${SHA.slice(0, 12)}.json"`);
    const body = await r.json();
    expect(body.format).toBe("v19.release-evidence/v1");
    expect(body.summary).toMatchObject({ deployments: 1, environmentsReached: ["Production"], checksPassed: 1, auditEvents: 1 });
    expect(r.headers.get("x-v19-evidence-digest")).toBe(body.digest.value);
    expect(m.exec).toHaveBeenCalledWith(expect.objectContaining({ where: { organizationId: "org1", repositoryFullName: "acme/web", sourceCommitSha: { in: [SHA, SHA] } } }));
    expect(m.events).toHaveBeenCalledWith(expect.objectContaining({ where: { organizationId: "org1", subjectId: { in: ["d1"] } } }));
    expect(m.audit).toHaveBeenCalledWith(expect.objectContaining({ action: "audit.export", entityRef: `release_evidence:acme/web@${SHA}` }));
  });
  it("requires membership, a repository and a full commit, and reports unavailable stores", async () => {
    m.ctx.mockResolvedValueOnce({ isAuthenticated: false });
    expect((await call(`repository=acme/web&commit=${SHA}`)).status).toBe(403);
    expect((await call(`repository=acme&commit=${SHA}`)).status).toBe(400);
    expect((await call("repository=acme/web&commit=abc123")).status).toBe(400);
    m.exec.mockRejectedValueOnce(new Error("db"));
    expect((await call(`repository=acme/web&commit=${SHA}`)).status).toBe(503);
  });
});
