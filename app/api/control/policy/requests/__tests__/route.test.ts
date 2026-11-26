// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const m = vi.hoisted(() => ({ ctx: vi.fn(), rules: vi.fn(), create: vi.fn(), audit: vi.fn() }));
vi.mock("@/lib/auth/requestOrigin", () => ({ isSameOriginRequest: () => true }));
vi.mock("@/lib/audit/secureAudit", () => ({ record: m.audit }));
vi.mock("../../shared", () => ({ policyAdminContext: m.ctx, readPolicyRules: m.rules }));
vi.mock("@/lib/db", () => ({ prisma: { policyChangeRequest: { create: m.create, findMany: vi.fn(async () => []) } } }));
import { POST } from "../route";
const rule = (key: string, over: Record<string, unknown> = {}) => ({ key, label: key, severity: "high", blocking: true, exceptionAllowed: false, approverRole: null, evidenceRequired: true, enabled: true, description: null, ...over });
const call = (doc: unknown) => POST(new NextRequest("http://localhost/x", { method: "POST", body: typeof doc === "string" ? doc : JSON.stringify(doc) }));
beforeEach(() => { vi.clearAllMocks(); m.ctx.mockResolvedValue({ organizationId: "org1", userId: "author" }); m.rules.mockResolvedValue([rule("a")]); m.create.mockResolvedValue({ id: "req1" }); });
describe("POST /api/control/policy/requests", () => {
  it("stores the document with its diff, loosening flag and base digest, applying nothing", async () => {
    const r = await call({ kind: "v19.policy", version: 1, rules: [rule("a", { blocking: false })] });
    expect(r.status).toBe(201);
    const data = m.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ organizationId: "org1", loosens: true, proposedByUserId: "author" });
    expect(data.baseDigest).toMatch(/^[0-9a-f]{64}$/);
  });
  it("refuses unchanged and invalid documents", async () => {
    expect((await call({ kind: "v19.policy", version: 1, rules: [rule("a")] })).status).toBe(409);
    expect((await call("{")).status).toBe(422);
    expect(m.create).not.toHaveBeenCalled();
  });
});
