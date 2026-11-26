// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const m = vi.hoisted(() => ({ auth: vi.fn(), apply: vi.fn(), prior: vi.fn(), append: vi.fn(async () => true) }));
vi.mock("@/lib/security/authenticateApiKey", () => ({ authenticateApiKey: m.auth }));
vi.mock("@/lib/releaseops/deploymentFreezeStore", () => ({ applyDeploymentFreeze: m.apply }));
vi.mock("@/lib/releaseops/auditEventResponder", () => ({ appendAuditEvent: m.append }));
vi.mock("@/lib/db", () => ({ prisma: { auditEvent: { findFirst: m.prior } } }));
import { POST } from "../route";
const post = (body: unknown) => POST(new NextRequest("http://localhost/api/v1/environments/freeze", { method: "POST", body: JSON.stringify(body), headers: { authorization: "Bearer vxl_test" } }));
beforeEach(() => {
  vi.clearAllMocks();
  m.auth.mockResolvedValue({ ok: true, organizationId: "org1", apiKeyId: "k1" });
  m.prior.mockResolvedValue(null);
  m.apply.mockResolvedValue({ ok: true, environments: ["Prod"], skipped: [], endsAt: "2026-11-27T16:00:00.000Z" });
});

describe("POST /api/v1/environments/freeze", () => {
  it("starts a production freeze for a key with freeze:start and records it", async () => {
    const res = await post({ scope: "production", hours: 4, reason: "PD incident Q1X", idempotencyKey: "pd-Q1X-trigger" });
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ ok: true, environments: ["Prod"], endsAt: "2026-11-27T16:00:00.000Z" });
    expect(m.auth.mock.calls[0][0].requiredScope).toBe("freeze:start");
    expect(m.apply).toHaveBeenCalledWith("org1", { action: "start", scope: "production", hours: 4, reason: "PD incident Q1X" });
    expect(m.append).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ organizationId: "org1", kind: "environment.freeze", subjectId: "freeze:pd-Q1X-trigger", actorUserId: null }));
  });
  it("returns the original result for a retried idempotency key without freezing again", async () => {
    m.prior.mockResolvedValue({ summary: "API key froze Prod" });
    const res = await post({ scope: "production", hours: 4, reason: "PD incident Q1X", idempotencyKey: "pd-Q1X-trigger" });
    expect(await res.json()).toMatchObject({ ok: true, duplicate: true });
    expect(m.apply).not.toHaveBeenCalled();
  });
  it("only starts freezes: no end action, at most 24 hours", async () => {
    expect((await post({ action: "end", reason: "x" })).status).toBe(422);
    expect((await post({ scope: "production", hours: 48, reason: "too long" })).status).toBe(422);
    expect(m.apply).not.toHaveBeenCalled();
  });
  it("passes through authentication and freeze refusals", async () => {
    m.auth.mockResolvedValueOnce({ ok: false, httpStatus: 403, reason: "scope_insufficient", requiredScope: "freeze:start" });
    expect((await post({ scope: "all", hours: 1, reason: "Incident" })).status).toBe(403);
    m.apply.mockResolvedValueOnce({ ok: false, error: "governance_configuration_mutation_unavailable" });
    const r = await post({ scope: "all", hours: 1, reason: "Incident" });
    expect(r.status).toBe(409);
    expect((await r.json()).error).toBe("governance_configuration_mutation_unavailable");
  });
});
