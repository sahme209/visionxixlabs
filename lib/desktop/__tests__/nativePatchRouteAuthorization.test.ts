import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const m = vi.hoisted(() => ({
  verifyToken: vi.fn(), session: vi.fn(), touch: vi.fn(), access: vi.fn(), membership: vi.fn(),
  memberUpdate: vi.fn(), automationFind: vi.fn(), automationUpdate: vi.fn(), audit: vi.fn(),
}));
vi.mock("../desktopToken", async original => ({ ...await original<typeof import("../desktopToken")>(), verifyDesktopToken: m.verifyToken }));
vi.mock("../desktopSession", () => ({ resolveActiveSession: m.session, touchDesktopSession: m.touch }));
vi.mock("../desktopCommercialAccess", () => ({ readDesktopCommercialAccess: m.access }));
vi.mock("@/lib/observability/logger", () => ({ createLogger: () => ({ info: vi.fn(), error: vi.fn() }) }));
vi.mock("@/lib/releaseops/auditEventResponder", () => ({ appendAuditEvent: m.audit }));
vi.mock("@/lib/db", () => ({ prisma: {
  orgMembership: { findUnique: m.membership, update: m.memberUpdate }, user: { findUnique: async () => null },
  airflowAutomation: { findFirst: m.automationFind, update: m.automationUpdate },
  // Not enrolled in Governance: promotions stay allowed (enrolled refusal is covered in team role tests).
  durableAgentWorkflow: { findMany: async () => [] },
} }));
import { PATCH as members } from "../../../app/api/desktop/workspace-members/route";
import { PATCH as automation } from "../../../app/api/desktop/airflow/automations/[id]/route";

beforeEach(() => {
  vi.resetAllMocks();
  m.verifyToken.mockReturnValue({ sessionId: "synthetic-session" });
  m.session.mockResolvedValue({ id: "synthetic-session", userId: "actor", organizationId: "owned-org" });
  m.access.mockResolvedValue({ allowed: true });
  m.membership.mockResolvedValue({ acceptedAt: new Date(), role: "owner" });
  m.memberUpdate.mockResolvedValue({ userId: "target", role: "operator", updatedAt: new Date() });
  m.automationFind.mockResolvedValue({ id: "automation_1", name: "Synthetic", organizationId: "owned-org" });
  m.automationUpdate.mockResolvedValue({ id: "automation_1", name: "Synthetic", enabled: false });
});
function request(path: string, body: unknown, token: string | null = "synthetic-token") {
  return new NextRequest(`https://visionxixlabs.com/api/desktop/${path}`, { method: "PATCH", headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
}
const routes = [
  { name: "members", invoke: (token?: string | null) => members(request("workspace-members", { userId: "target", role: "operator", organizationId: "forged-org" }, token)) },
  { name: "automation", invoke: (token?: string | null) => automation(request("airflow/automations/automation_1", { enabled: false, organizationId: "forged-org" }, token), { params: Promise.resolve({ id: "automation_1" }) }) },
];
for (const route of routes) {
  it.each(["missing", "api_key", "revoked", "unaccepted", "demoted", "unentitled"])(`${route.name} PATCH preserves real session resolver denial: %s`, async reason => {
    if (reason === "revoked") m.session.mockResolvedValue(null);
    if (reason === "unaccepted") m.membership.mockResolvedValue({ acceptedAt: null, role: "owner" });
    if (reason === "demoted") m.membership.mockResolvedValue({ acceptedAt: new Date(), role: "read_only" });
    if (reason === "unentitled") m.access.mockResolvedValue({ allowed: false });
    expect((await route.invoke(reason === "missing" ? null : reason === "api_key" ? "vxlk_synthetic" : undefined)).status).toBe(401);
    expect(m.memberUpdate).not.toHaveBeenCalled(); expect(m.automationUpdate).not.toHaveBeenCalled(); expect(m.audit).not.toHaveBeenCalled();
  });
}
it.each(["owner", "admin"])("%s member change remains tenant-bound and audited", async role => {
  m.membership.mockImplementation(async ({ where }) => ({ acceptedAt: new Date(), role: where.userId_organizationId.userId === "actor" ? role : "read_only" }));
  expect((await routes[0].invoke()).status).toBe(200);
  expect(m.memberUpdate).toHaveBeenCalledWith(expect.objectContaining({ where: { userId_organizationId: { userId: "target", organizationId: "owned-org" } }, data: { role: "operator" } }));
  expect(m.audit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ organizationId: "owned-org", actorUserId: "actor", kind: "workspace.member_role_changed" }));
});
it.each(["owner", "admin"])("%s automation toggle keeps tenant lookup and audited enabled-only update", async role => {
  m.membership.mockResolvedValue({ acceptedAt: new Date(), role });
  expect((await routes[1].invoke()).status).toBe(200);
  expect(m.automationFind).toHaveBeenCalledWith({ where: { id: "automation_1", organizationId: "owned-org" } });
  expect(m.automationUpdate).toHaveBeenCalledWith({ where: { id: "automation_1" }, data: { enabled: false } });
  expect(m.audit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ organizationId: "owned-org", actorUserId: "actor", kind: "airflow.automation.paused" }));
});
it.each([
  { body: { userId: "actor", role: "operator" }, status: 409 },
  { body: { userId: "target", role: "owner" }, status: 400 },
  { body: { userId: "", role: "operator" }, status: 400 },
])("member PATCH refuses protected/invalid body %j", async ({ body, status }) => {
  expect((await members(request("workspace-members", body))).status).toBe(status);
  expect(m.memberUpdate).not.toHaveBeenCalled();
});
it("cannot mutate another owner or a missing/cross-tenant member", async () => {
  expect((await routes[0].invoke()).status).toBe(409); // Target is owner in default fixture.
  m.membership.mockImplementation(async ({ where }) => where.userId_organizationId.userId === "actor" ? { acceptedAt: new Date(), role: "owner" } : null);
  expect((await routes[0].invoke()).status).toBe(404); expect(m.memberUpdate).not.toHaveBeenCalled();
});
it("automation PATCH refuses invalid enabled and missing/cross-tenant automation", async () => {
  expect((await automation(request("airflow/automations/automation_1", { enabled: "true" }), { params: Promise.resolve({ id: "automation_1" }) })).status).toBe(400);
  m.automationFind.mockResolvedValue(null); expect((await routes[1].invoke()).status).toBe(404);
  expect(m.automationUpdate).not.toHaveBeenCalled();
});
