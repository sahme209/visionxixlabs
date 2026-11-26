// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const m = vi.hoisted(() => ({ session: vi.fn(), findFirst: vi.fn(), updateMany: vi.fn(), audit: vi.fn(async () => true), governed: vi.fn() }));
vi.mock("@/lib/desktop/resolveRequestDesktopSession", () => ({ resolveRequestDesktopSession: m.session }));
vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("@/lib/releaseops/auditEventResponder", () => ({ appendAuditEvent: m.audit }));
vi.mock("@/lib/desktop/configurationMutationRefusal", () => ({ withUnenrolledConfigurationMutation: m.governed }));
import { PUT } from "../route";

const call = (body: unknown, id = "env_1") => PUT(new NextRequest(`http://localhost/api/desktop/environments/${id}/tags`, { method: "PUT", body: JSON.stringify(body) }), { params: Promise.resolve({ id }) });
beforeEach(() => {
  vi.clearAllMocks();
  m.session.mockResolvedValue({ id: "s1", userId: "u1", organizationId: "org1", credentialKind: "desktop_session" });
  m.governed.mockImplementation(async (_repo: unknown, _scope: unknown, _signal: unknown, assert: () => Promise<void>, mutate: (tx: unknown) => Promise<unknown>) => { await assert(); return mutate({ environment: { findFirst: m.findFirst, updateMany: m.updateMany } }); });
  m.findFirst.mockResolvedValue({ id: "env_1", name: "Acme EU", tags: ["ring:0"] });
  m.updateMany.mockResolvedValue({ count: 1 });
});
describe("PUT /api/desktop/environments/{id}/tags", () => {
  it("replaces tags through the governed mutation, compare-and-set on the tags read, and audits", async () => {
    const r = await call({ tags: ["Tenant:Acme", "ring:1"], expectedTags: ["ring:0"] });
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true, data: { id: "env_1", tags: ["ring:1", "tenant:acme"] } });
    expect(m.session).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ requiredCapability: "policy:manage" }));
    expect(m.updateMany).toHaveBeenCalledWith({ where: { id: "env_1", organizationId: "org1", tags: { equals: ["ring:0"] } }, data: { tags: ["ring:1", "tenant:acme"] } });
    expect(m.audit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ kind: "environment.update", subjectId: "env_1" }));
  });
  it("refuses stale edits, invalid tags, unknown environments and unavailable governance", async () => {
    expect((await call({ tags: ["ring:1"], expectedTags: [] })).status).toBe(409);
    expect((await call({ tags: ["nope"], expectedTags: ["ring:0"] })).status).toBe(422);
    m.findFirst.mockResolvedValueOnce(null);
    expect((await call({ tags: [], expectedTags: [] })).status).toBe(404);
    m.governed.mockRejectedValueOnce(new Error("governance_configuration_mutation_unavailable"));
    expect((await call({ tags: [], expectedTags: ["ring:0"] })).status).toBe(409);
    m.session.mockResolvedValueOnce(null);
    expect((await call({ tags: [], expectedTags: [] })).status).toBe(401);
    expect(m.audit).not.toHaveBeenCalled();
  });
});
