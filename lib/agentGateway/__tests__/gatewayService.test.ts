import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ create: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), updateMany: vi.fn(), keyFind: vi.fn(), audit: vi.fn(), envs: vi.fn(async () => [] as unknown[]) }));
vi.mock("@/lib/db", () => ({ prisma: { agentGatewayRequest: { create: db.create, findFirst: db.findFirst, findMany: db.findMany, updateMany: db.updateMany }, apiKey: { findFirst: db.keyFind }, environment: { findMany: db.envs } } }));
vi.mock("@/lib/releaseops/auditEventResponder", () => ({ appendAuditEvent: db.audit }));
const hooks = vi.hoisted(() => ({ dispatch: vi.fn() }));
vi.mock("@/lib/webhooks/dispatchWebhookEvent", () => ({ dispatchWebhookEvent: hooks.dispatch }));
import { createGatewayRequest, decideGatewayRequest, getGatewayRequest, recordGatewayOutcome } from "../gatewayService";

const caller = { organizationId: "org", apiKeyId: "key" };
const NOW = new Date("2026-11-09T00:00:00Z");
const row = (over: Record<string, unknown> = {}) => ({ id: "r1", organizationId: "org", apiKeyId: "key", agentName: "cursor", actionKind: "deploy", environment: "production", target: "acme/web", summary: "Ship v2", riskLevel: "high", policyDecision: "require_approval", policyReasons: [], actionDigest: "d", status: "pending", decidedByUserId: null, decidedAt: null, decisionNote: null, outcome: null, outcomeDetail: null, outcomeAt: null, expiresAt: new Date(NOW.getTime() + 3600_000), createdAt: NOW, updatedAt: NOW, ...over });

beforeEach(() => { vi.clearAllMocks(); db.create.mockImplementation(async ({ data }) => ({ ...row(), ...data, id: "r1" })); db.updateMany.mockResolvedValue({ count: 1 }); });

describe("agent gateway service", () => {
  it("stores the kernel decision; allow is approved at once and deny is rejected", async () => {
    const allowed = await createGatewayRequest(caller, { actionKind: "read", environment: "development", target: "acme/web", summary: "Look" }, NOW);
    expect(allowed.ok && allowed.request).toMatchObject({ status: "approved", mayProceed: true, reason: "allowed_by_policy" });
    const denied = await createGatewayRequest(caller, { actionKind: "secret_access", environment: "production", target: "vault", summary: "Read" }, NOW);
    expect(denied.ok && denied.request).toMatchObject({ status: "rejected", mayProceed: false, reason: "denied_by_policy" });
    const pending = await createGatewayRequest(caller, { actionKind: "deploy", environment: "production", target: "acme/web", summary: "Ship" }, NOW);
    expect(pending.ok && pending.request).toMatchObject({ status: "pending", mayProceed: false });
    expect(db.create.mock.calls[2][0].data).toMatchObject({ organizationId: "org", apiKeyId: "key", actionDigest: expect.stringMatching(/^[0-9a-f]{64}$/) });
  });

  it("attaches a change passport with the reported model and tools and the key's creator as owner", async () => {
    db.keyFind.mockResolvedValueOnce({ createdBy: "owner-1" });
    const r = await createGatewayRequest(caller, { actionKind: "deploy", environment: "production", target: "acme/web", summary: "Ship", agentName: "claude-code", model: "claude-opus", tools: ["git", "bash"] }, NOW);
    const data = db.create.mock.calls[0][0].data;
    expect(data.passport).toMatchObject({ origin: "external_agent", agent: "claude-code", model: "claude-opus", tools: ["git", "bash"], ownerUserId: "owner-1" });
    expect(data).not.toHaveProperty("agentModel");
    expect(r.ok && r.request.passport).toMatchObject({ agent: "claude-code", model: "claude-opus" });
    const withoutModel = await createGatewayRequest(caller, { actionKind: "deploy", environment: "production", target: "acme/web", summary: "Ship", agentName: "claude-code", model: "x", tools: ["git"] }, NOW);
    expect(withoutModel.ok && withoutModel.request.actionDigest).toBe(r.ok && r.request.actionDigest); // passport facts never change the approval digest
    expect(await createGatewayRequest(caller, { actionKind: "read", target: "x", summary: "y", tools: "git" }, NOW)).toEqual({ ok: false, error: "invalid_tools" });
  });

  it("denies an agent's production deploy while a production environment is frozen", async () => {
    db.envs.mockResolvedValueOnce([{ name: "Production", changeWindowRuleJson: { freezes: [{ startUtc: "2026-11-01T00:00:00Z", endUtc: "2026-12-01T00:00:00Z", reason: "Peak season" }] } }]);
    const r = await createGatewayRequest(caller, { actionKind: "deploy", environment: "production", target: "acme/web", summary: "Ship" }, NOW);
    expect(r.ok && r.request).toMatchObject({ status: "rejected", mayProceed: false, policyDecision: "deny" });
    expect(db.create.mock.calls[0][0].data.policyReasons.at(-1)).toMatch(/Production is frozen \(Peak season\)/);
    db.envs.mockResolvedValueOnce([{ name: "Production", changeWindowRuleJson: { freezes: [{ startUtc: "2026-11-01T00:00:00Z", endUtc: "2026-12-01T00:00:00Z", reason: "Peak season" }] } }]);
    const read = await createGatewayRequest(caller, { actionKind: "read", environment: "production", target: "acme/web", summary: "Look" }, NOW);
    expect(read.ok && read.request.policyDecision).not.toBe("deny");
  });

  it("scopes reads to the calling workspace and key", async () => {
    db.findFirst.mockResolvedValue(null);
    expect(await getGatewayRequest(caller, "r1")).toBeNull();
    expect(db.findFirst).toHaveBeenCalledWith({ where: { id: "r1", organizationId: "org", apiKeyId: "key" } });
  });

  it("accepts an outcome once, only for approved requests", async () => {
    db.findFirst.mockResolvedValueOnce(row({ status: "pending" }));
    expect(await recordGatewayOutcome(caller, "r1", { outcome: "succeeded" })).toMatchObject({ ok: false, error: "not_reportable" });
    db.findFirst.mockResolvedValueOnce(row({ status: "approved" })).mockResolvedValueOnce(row({ status: "completed", outcome: "succeeded" }));
    expect(await recordGatewayOutcome(caller, "r1", { outcome: "succeeded" })).toMatchObject({ ok: true });
    expect(await recordGatewayOutcome(caller, "r1", { outcome: "yay" })).toMatchObject({ ok: false, error: "invalid_outcome" });
  });

  it("forbids self-approval by the key's creator and fails closed without an email", async () => {
    db.findFirst.mockResolvedValue(row()); db.keyFind.mockResolvedValue({ createdBy: "Owner@Acme.com" });
    expect(await decideGatewayRequest({ organizationId: "org", userId: "u", userEmail: "owner@acme.com", id: "r1", decision: "approve" }, NOW)).toMatchObject({ ok: false, error: "self_approval_forbidden" });
    expect(await decideGatewayRequest({ organizationId: "org", userId: "u", userEmail: null, id: "r1", decision: "approve" }, NOW)).toMatchObject({ ok: false, error: "approver_identity_unverified" });
    expect(db.updateMany).not.toHaveBeenCalled();
  });

  it("lets another admin approve a pending, unexpired request bound to its digest", async () => {
    db.findFirst.mockResolvedValueOnce(row()).mockResolvedValueOnce(row({ status: "approved", decidedByUserId: "u2" }));
    db.keyFind.mockResolvedValue({ createdBy: "owner@acme.com" });
    const r = await decideGatewayRequest({ organizationId: "org", userId: "u2", userEmail: "reviewer@acme.com", id: "r1", decision: "approve", note: "ok" }, NOW);
    expect(r).toMatchObject({ ok: true, request: { status: "approved", mayProceed: true } });
    expect(db.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "r1", organizationId: "org", status: "pending", actionDigest: "d", expiresAt: { gt: NOW } } }));
  });

  it("triages on arrival and needs two different admins for a two-person lane", async () => {
    const created = await createGatewayRequest(caller, { actionKind: "deploy", environment: "production", target: "acme/web", summary: "Ship", changedFiles: ["prisma/migrations/1/migration.sql"] }, NOW);
    expect(db.create.mock.calls[0][0].data.reviewTriage).toMatchObject({ lane: "two_person", approvalsRequired: 2 });
    expect(created.ok && created.request.triage).toMatchObject({ lane: "two_person" });
    const triage = { lane: "two_person", approvalsRequired: 2, reason: "x" };
    db.keyFind.mockResolvedValue({ createdBy: "owner@acme.com" });
    db.findFirst.mockResolvedValueOnce(row({ reviewTriage: triage, firstApproverUserId: null })).mockResolvedValueOnce(row({ reviewTriage: triage, firstApproverUserId: "u2" }));
    const first = await decideGatewayRequest({ organizationId: "org", userId: "u2", userEmail: "a@acme.com", id: "r1", decision: "approve" }, NOW);
    expect(first).toMatchObject({ ok: true, request: { status: "pending", mayProceed: false, awaitingSecondApprover: true } });
    expect(db.updateMany).toHaveBeenLastCalledWith(expect.objectContaining({ data: { firstApproverUserId: "u2", firstApprovedAt: NOW } }));
    db.findFirst.mockResolvedValueOnce(row({ reviewTriage: triage, firstApproverUserId: "u2" }));
    expect(await decideGatewayRequest({ organizationId: "org", userId: "u2", userEmail: "a@acme.com", id: "r1", decision: "approve" }, NOW)).toMatchObject({ ok: false, error: "second_approver_must_differ" });
    db.findFirst.mockResolvedValueOnce(row({ reviewTriage: triage, firstApproverUserId: "u2" })).mockResolvedValueOnce(row({ status: "approved", reviewTriage: triage, firstApproverUserId: "u2", decidedByUserId: "u3" }));
    const second = await decideGatewayRequest({ organizationId: "org", userId: "u3", userEmail: "b@acme.com", id: "r1", decision: "approve" }, NOW);
    expect(second).toMatchObject({ ok: true, request: { status: "approved", mayProceed: true } });
    expect(db.updateMany).toHaveBeenLastCalledWith(expect.objectContaining({ where: expect.objectContaining({ firstApproverUserId: "u2" }), data: expect.objectContaining({ status: "approved", decidedByUserId: "u3" }) }));
  });

  it("refuses expired, settled or non-approval requests", async () => {
    db.keyFind.mockResolvedValue({ createdBy: "owner@acme.com" });
    db.findFirst.mockResolvedValueOnce(row({ expiresAt: new Date(NOW.getTime() - 1) }));
    expect(await decideGatewayRequest({ organizationId: "org", userId: "u2", userEmail: "r@acme.com", id: "r1", decision: "approve" }, NOW)).toMatchObject({ error: "expired" });
    db.findFirst.mockResolvedValueOnce(row({ status: "approved" }));
    expect(await decideGatewayRequest({ organizationId: "org", userId: "u2", userEmail: "r@acme.com", id: "r1", decision: "approve" }, NOW)).toMatchObject({ error: "not_pending" });
    expect(await decideGatewayRequest({ organizationId: "org", userId: "u2", userEmail: "r@acme.com", id: "r1", decision: "maybe" }, NOW)).toMatchObject({ error: "invalid_decision" });
  });
});


describe("agent gateway webhooks", () => {
  it("notifies approvers only for pending requests, and a webhook failure never blocks the request", async () => {
    hooks.dispatch.mockRejectedValue(new Error("endpoint down"));
    const pending = await createGatewayRequest(caller, { actionKind: "deploy", environment: "production", target: "acme/web", summary: "Ship" }, NOW);
    expect(pending.ok).toBe(true);
    expect(hooks.dispatch).toHaveBeenCalledWith(expect.objectContaining({ eventKind: "agent_gateway.request_pending", organizationId: "org" }));
    hooks.dispatch.mockClear();
    await createGatewayRequest(caller, { actionKind: "read", environment: "development", target: "acme/web", summary: "Look" }, NOW);
    expect(hooks.dispatch).not.toHaveBeenCalled();
  });
});
