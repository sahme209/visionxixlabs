// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { policyDigest } from "@/lib/releaseops/policyAsCode";

const m = vi.hoisted(() => ({ ctx: vi.fn(), audit: vi.fn(), findFirst: vi.fn(), updateMany: vi.fn(), rules: vi.fn(), ruleUpdateMany: vi.fn(), upsert: vi.fn(), queryRaw: vi.fn(), autopilot: vi.fn(async () => null as unknown), autopilotUpsert: vi.fn() }));
vi.mock("@/lib/auth/requestOrigin", () => ({ isSameOriginRequest: () => true }));
vi.mock("@/lib/audit/secureAudit", () => ({ record: m.audit }));
vi.mock("../../../../shared", () => ({ policyAdminContext: m.ctx, readAutopilot: m.autopilot }));
vi.mock("@/lib/db", () => {
  const tx = { $executeRaw: m.queryRaw, policyChangeRequest: { findFirst: m.findFirst, updateMany: m.updateMany }, policyRule: { findMany: m.rules, updateMany: m.ruleUpdateMany, upsert: m.upsert }, workspaceReleaseAutopilot: { upsert: m.autopilotUpsert } };
  return { prisma: { $transaction: async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx) } };
});
import { POST } from "../route";

const rule = (key: string, over: Record<string, unknown> = {}) => ({ key, label: key, severity: "high", blocking: true, exceptionAllowed: false, approverRole: null, evidenceRequired: true, enabled: true, description: null, ...over });
const call = (decision: string) => POST(new NextRequest("http://localhost/x", { method: "POST", body: JSON.stringify({ decision }) }), { params: Promise.resolve({ id: "req1" }) });
let current = [rule("a"), rule("b")];
beforeEach(async () => {
  vi.clearAllMocks();
  current = [rule("a"), rule("b")];
  m.ctx.mockResolvedValue({ organizationId: "org1", userId: "reviewer" });
  m.rules.mockImplementation(async () => current);
  m.findFirst.mockResolvedValue({ status: "pending", proposedByUserId: "author", baseDigest: await policyDigest(current), documentJson: { kind: "v19.policy", version: 1, rules: [rule("a", { blocking: false }), rule("c")] } });
  m.updateMany.mockResolvedValue({ count: 1 });
});
describe("policy change request decisions", () => {
  it("applies an approved request in one transaction: upserts, and disables removed rules", async () => {
    const r = await call("approve");
    expect(await r.json()).toEqual({ ok: true, data: { result: "applied" } });
    expect(m.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "req1", organizationId: "org1", status: "pending" }, data: expect.objectContaining({ status: "applied", decidedByUserId: "reviewer" }) }));
    expect(m.upsert.mock.calls.map((c) => c[0].where.organizationId_key.key)).toEqual(["c", "a"]);
    expect(m.ruleUpdateMany).toHaveBeenCalledWith({ where: { organizationId: "org1", key: "b" }, data: { enabled: false } });
    expect(m.queryRaw).toHaveBeenCalled();
  });
  it("refuses self-approval and already-decided requests", async () => {
    m.ctx.mockResolvedValueOnce({ organizationId: "org1", userId: "author" });
    expect((await call("approve")).status).toBe(403);
    m.findFirst.mockResolvedValueOnce({ status: "applied", proposedByUserId: "author", baseDigest: "x", documentJson: {} });
    expect((await call("approve")).status).toBe(409);
    expect(m.upsert).not.toHaveBeenCalled();
  });
  it("marks the request stale and changes nothing when rules changed since review", async () => {
    current = [rule("a"), rule("b", { severity: "low" })];
    const r = await call("approve");
    expect(r.status).toBe(409);
    expect((await r.json()).error).toBe("policy_changed_since_request");
    expect(m.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "stale" }) }));
    expect(m.upsert).not.toHaveBeenCalled();
  });
  it("records a rejection without touching rules", async () => {
    expect(await (await call("reject")).json()).toEqual({ ok: true, data: { result: "rejected" } });
    expect(m.rules).not.toHaveBeenCalled();
  });
  it("applies a reviewed autopilot rule with the rules, and leaves it alone when unchanged", async () => {
    m.findFirst.mockResolvedValueOnce({ status: "pending", proposedByUserId: "author", baseDigest: await policyDigest(current), documentJson: { kind: "v19.policy", version: 1, rules: current, autopilot: { deploy: { environments: ["staging"], maxFiles: 4 } } } });
    expect((await call("approve")).status).toBe(200);
    expect(m.autopilotUpsert).toHaveBeenCalledWith({ where: { organizationId: "org1" }, create: { organizationId: "org1", deployEnvironments: ["staging"], maxFiles: 4, appliedRequestId: "req1" }, update: { deployEnvironments: ["staging"], maxFiles: 4, appliedRequestId: "req1" } });
    m.autopilotUpsert.mockClear();
    await call("approve");
    expect(m.autopilotUpsert).not.toHaveBeenCalled();
  });
  it("is stale when autopilot changed since review", async () => {
    m.autopilot.mockResolvedValueOnce({ deployEnvironments: ["staging"], maxFiles: 2 });
    const r = await call("approve");
    expect((await r.json()).error).toBe("policy_changed_since_request");
    expect(m.autopilotUpsert).not.toHaveBeenCalled();
  });
});

