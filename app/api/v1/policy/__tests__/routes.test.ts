// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const m = vi.hoisted(() => ({ auth: vi.fn(), key: vi.fn(), user: vi.fn(), membership: vi.fn(), pending: vi.fn(), create: vi.fn(), findReq: vi.fn(), rules: vi.fn(), autopilot: vi.fn(), audit: vi.fn() }));
vi.mock("@/lib/security/authenticateApiKey", () => ({ authenticateApiKey: m.auth }));
vi.mock("@/lib/audit/secureAudit", () => ({ record: m.audit }));
vi.mock("@/app/api/control/policy/shared", () => ({ readPolicyRules: m.rules, readAutopilot: m.autopilot }));
vi.mock("@/lib/db", () => ({ prisma: { apiKey: { findFirst: m.key }, user: { findFirst: m.user }, orgMembership: { findFirst: m.membership }, policyChangeRequest: { findMany: m.pending, create: m.create, findFirst: m.findReq } } }));
import { GET as getPolicy } from "../route";
import { POST } from "../requests/route";
import { GET as getRequest } from "../requests/[id]/route";

const rule = (key: string, over: Record<string, unknown> = {}) => ({ key, label: key, severity: "high", blocking: true, exceptionAllowed: false, approverRole: null, evidenceRequired: true, enabled: true, description: null, ...over });
const doc = (rules: unknown[], extra: Record<string, unknown> = {}) => ({ kind: "v19.policy", version: 1, rules, ...extra });
const req = (body?: unknown) => new NextRequest("http://localhost/x", { method: body === undefined ? "GET" : "POST", ...(body === undefined ? {} : { body: JSON.stringify(body) }), headers: { authorization: "Bearer k" } });
beforeEach(() => {
  vi.clearAllMocks();
  m.auth.mockResolvedValue({ ok: true, apiKeyId: "key1", organizationId: "org1", scopes: ["policy:propose"], env: "live" });
  m.key.mockResolvedValue({ createdBy: "Admin@Example.test" });
  m.user.mockResolvedValue({ id: "u_admin" });
  m.membership.mockResolvedValue({ userId: "u_admin" });
  m.rules.mockResolvedValue([rule("a")]);
  m.autopilot.mockResolvedValue(null);
  m.pending.mockResolvedValue([]);
  m.create.mockResolvedValue({ id: "req1" });
});

describe("/api/v1/policy", () => {
  it("requires policy:propose", async () => {
    m.auth.mockResolvedValueOnce({ ok: false, reason: "insufficient_scope", httpStatus: 403, requiredScope: "policy:propose" });
    expect((await getPolicy(req())).status).toBe(403);
    expect(m.auth).toHaveBeenCalledWith(expect.objectContaining({ requiredScope: "policy:propose" }));
  });
  it("returns the current document and digest", async () => {
    const body = await (await getPolicy(req())).json();
    expect(body.document.rules.map((r: { key: string }) => r.key)).toEqual(["a"]);
    expect(body.digest).toMatch(/^[0-9a-f]{64}$/);
  });
  it("creates a request proposed by the key's creator and applies nothing", async () => {
    const r = await POST(req({ document: doc([rule("a", { blocking: false })]) }));
    expect(r.status).toBe(201);
    expect(await r.json()).toMatchObject({ ok: true, request: { id: "req1", status: "pending", loosens: true, existing: false } });
    expect(m.create.mock.calls[0][0].data).toMatchObject({ organizationId: "org1", proposedByUserId: "u_admin", loosens: true });
    expect(m.membership.mock.calls[0][0].where).toMatchObject({ userId: "u_admin", organizationId: "org1" });
  });
  it("returns unchanged for the current rules and reuses an identical pending request", async () => {
    expect(await (await POST(req({ document: doc([rule("a")]) }))).json()).toEqual({ ok: true, unchanged: true });
    const proposed = doc([rule("b")]);
    m.pending.mockResolvedValueOnce([{ id: "reqOld", documentJson: proposed, loosens: true }]);
    expect(await (await POST(req({ document: proposed }))).json()).toMatchObject({ request: { id: "reqOld", existing: true } });
    expect(m.create).not.toHaveBeenCalled();
  });
  it("refuses keys whose creator is no longer an owner or admin, and invalid documents", async () => {
    m.membership.mockResolvedValueOnce(null);
    expect((await POST(req({ document: doc([rule("b")]) }))).status).toBe(403);
    expect((await POST(req({ document: doc([], { autopilot: { deploy: { environments: ["production"], maxFiles: 1 } } }) }))).status).toBe(422);
    expect((await POST(req({ document: doc([]), extra: 1 }))).status).toBe(400);
    expect(m.create).not.toHaveBeenCalled();
  });
  it("reports a request's status within the workspace", async () => {
    m.findReq.mockResolvedValueOnce({ id: "req1", status: "applied", loosens: false, decidedAt: null, createdAt: new Date() });
    const r = await getRequest(req(), { params: Promise.resolve({ id: "req1" }) });
    expect((await r.json()).request.status).toBe("applied");
    expect(m.findReq.mock.calls[0][0].where).toEqual({ id: "req1", organizationId: "org1" });
    m.findReq.mockResolvedValueOnce(null);
    expect((await getRequest(req(), { params: Promise.resolve({ id: "nope" }) })).status).toBe(404);
  });
});
