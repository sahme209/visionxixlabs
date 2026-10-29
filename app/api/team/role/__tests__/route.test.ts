/**
 * Organization membership lifecycle — role change / revocation side.
 * Locks in: tenant isolation on the target lookup (a membership from
 * another organization is indistinguishable from a nonexistent one),
 * the owner-role and self-modification protections, that removal
 * actually deletes the row and audits with the prior role as evidence,
 * and that a role change audits the before/after role.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireContext: vi.fn(),
  findMembership: vi.fn(),
  deleteMembership: vi.fn(),
  updateMembership: vi.fn(),
  updateManyMembership: vi.fn(),
  deleteManyMembership: vi.fn(),
  recordAudit: vi.fn(),
}));

vi.mock("@/lib/auth/currentContext", () => ({ requireContext: mocks.requireContext }));
vi.mock("@/lib/db", () => ({
  prisma: {
    orgMembership: {
      findUnique: mocks.findMembership,
      delete: mocks.deleteMembership,
      update: mocks.updateMembership,
      updateMany: mocks.updateManyMembership,
      deleteMany: mocks.deleteManyMembership,
    },
  },
}));
vi.mock("@/lib/workforce/domains/inviteLinks", () => ({
  ASSIGNABLE_ROLES: ["admin", "operator", "security_reviewer", "finance_viewer", "read_only"],
}));
vi.mock("@/lib/audit/requiredAudit", () => ({ recordRequiredAudit: mocks.recordAudit }));

function formRequest(fields: Record<string, string>) {
  const body = new URLSearchParams(fields);
  return new Request("https://visionxixlabs.com/api/team/role", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
}

function locationOf(res: Response): URL {
  return new URL(res.headers.get("location") ?? "");
}

// findMembership is called twice per request: once for the CALLER's own
// role (keyed by userId_organizationId), once for the TARGET row (keyed
// by id). Route by call shape.
function mockMembershipLookups(callerRole: string | null, target: Record<string, unknown> | null) {
  mocks.findMembership.mockImplementation((args: { where: Record<string, unknown> }) => {
    if ("userId_organizationId" in args.where) {
      return Promise.resolve(callerRole ? { role: callerRole, acceptedAt: new Date() } : null);
    }
    return Promise.resolve(target);
  });
}

describe("POST /api/team/role — role change and revocation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireContext.mockResolvedValue({ userId: "user-1", organizationId: "org-1", email: "owner@acme.test" });
  });

  it("rejects a request with no membershipId", async () => {
    mockMembershipLookups("owner", null);
    const { POST } = await import("../route");
    const res = await POST(formRequest({ action: "remove" }));
    expect(locationOf(res).searchParams.get("error")).toBe("missing_membership_id");
  });

  it("denies a caller who is not owner/admin — never deletes or updates", async () => {
    mockMembershipLookups("operator", { id: "mem-2", role: "read_only", organizationId: "org-1", userId: "user-2" });
    const { POST } = await import("../route");
    const res = await POST(formRequest({ membershipId: "mem-2", action: "remove" }));

    expect(locationOf(res).searchParams.get("error")).toBe("insufficient_permission");
    expect(mocks.deleteMembership).not.toHaveBeenCalled();
  });

  it("a cross-tenant membership id is indistinguishable from a nonexistent one", async () => {
    mockMembershipLookups("owner", { id: "mem-2", role: "read_only", organizationId: "org-OTHER", userId: "user-2" });
    const { POST } = await import("../route");
    const res = await POST(formRequest({ membershipId: "mem-2", action: "remove" }));

    expect(locationOf(res).searchParams.get("error")).toBe("not_found");
    expect(mocks.deleteMembership).not.toHaveBeenCalled();
  });

  it("refuses to modify an owner-role membership through this surface", async () => {
    mockMembershipLookups("owner", { id: "mem-2", role: "owner", organizationId: "org-1", userId: "user-2" });
    const { POST } = await import("../route");
    const res = await POST(formRequest({ membershipId: "mem-2", action: "remove" }));

    expect(locationOf(res).searchParams.get("error")).toBe("cannot_modify_owner");
    expect(mocks.deleteMembership).not.toHaveBeenCalled();
  });

  it("refuses to let a caller modify their own membership through this surface", async () => {
    mockMembershipLookups("admin", { id: "mem-1", role: "admin", organizationId: "org-1", userId: "user-1" });
    const { POST } = await import("../route");
    const res = await POST(formRequest({ membershipId: "mem-1", action: "remove" }));

    expect(locationOf(res).searchParams.get("error")).toBe("cannot_modify_self");
    expect(mocks.deleteMembership).not.toHaveBeenCalled();
  });

  it("removal actually deletes the row and audits members.remove with the prior role as evidence", async () => {
    mockMembershipLookups("owner", { id: "mem-2", role: "operator", organizationId: "org-1", userId: "user-2" });
    mocks.deleteMembership.mockResolvedValue({});
    const { POST } = await import("../route");
    const res = await POST(formRequest({ membershipId: "mem-2", action: "remove" }));

    expect(locationOf(res).searchParams.get("notice")).toBe("removed");
    expect(mocks.deleteMembership).toHaveBeenCalledWith({ where: { id: "mem-2" } });
    expect(mocks.recordAudit).toHaveBeenCalledWith(expect.objectContaining({
      action: "members.remove",
      outcome: "success",
      detail: expect.objectContaining({ priorRole: "operator" }),
    }));
  });

  it("rejects an invalid target role on a role-change request", async () => {
    mockMembershipLookups("owner", { id: "mem-2", role: "operator", organizationId: "org-1", userId: "user-2" });
    const { POST } = await import("../route");
    const res = await POST(formRequest({ membershipId: "mem-2", action: "change_role", role: "superuser" }));

    expect(locationOf(res).searchParams.get("error")).toBe("invalid_role");
    expect(mocks.updateMembership).not.toHaveBeenCalled();
  });

  it("a valid role change updates the row and audits governance.update with before/after roles", async () => {
    mockMembershipLookups("owner", { id: "mem-2", role: "operator", organizationId: "org-1", userId: "user-2" });
    mocks.updateMembership.mockResolvedValue({});
    const { POST } = await import("../route");
    const res = await POST(formRequest({ membershipId: "mem-2", action: "change_role", role: "security_reviewer" }));

    expect(locationOf(res).searchParams.get("notice")).toBe("role_updated");
    expect(mocks.updateMembership).toHaveBeenCalledWith({ where: { id: "mem-2" }, data: { role: "security_reviewer" } });
    expect(mocks.recordAudit).toHaveBeenCalledWith(expect.objectContaining({
      action: "governance.update",
      detail: expect.objectContaining({ priorRole: "operator", newRole: "security_reviewer" }),
    }));
  });

  it.each(["owner", "admin"])("denies pending %s membership before any target mutation", async (role) => {
    mocks.requireContext.mockResolvedValue({ userId: "user-1", organizationId: "org-1", email: "pending@example.test", roles: [] });
    mocks.findMembership.mockImplementation((args: { where: Record<string, unknown> }) => Promise.resolve(
      "userId_organizationId" in args.where
        ? { role, acceptedAt: null }
        : { id: "mem-2", role: "operator", organizationId: "org-1", userId: "user-2" },
    ));
    const { POST } = await import("../route");
    const res = await POST(formRequest({ membershipId: "mem-2", action: "remove" }));
    expect(locationOf(res).searchParams.get("error")).toBe("insufficient_permission");
    expect(mocks.deleteMembership).not.toHaveBeenCalled();
    expect(mocks.updateMembership).not.toHaveBeenCalled();
    expect(mocks.recordAudit).not.toHaveBeenCalled();
  });

  it("does not recover stale administrative claims after durable membership is removed", async () => {
    mocks.requireContext.mockResolvedValue({ userId: "user-1", organizationId: "org-1", email: "old@example.test", roles: ["owner"] });
    mocks.findMembership.mockResolvedValue(null);
    const { POST } = await import("../route");
    const res = await POST(formRequest({ membershipId: "mem-2", action: "remove" }));
    expect(locationOf(res).searchParams.get("error")).toBe("insufficient_permission");
    expect(mocks.deleteMembership).not.toHaveBeenCalled();
  });

  it("fails closed when the current membership lookup is unavailable", async () => {
    mocks.findMembership.mockRejectedValue(Error("unavailable"));
    const { POST } = await import("../route");
    const res = await POST(formRequest({ membershipId: "mem-2", action: "remove" }));
    expect(locationOf(res).searchParams.get("error")).toBe("insufficient_permission");
    expect(mocks.deleteMembership).not.toHaveBeenCalled();
  });
  it.each(["remove", "change_role"])("discloses an unconfirmed audit after %s without replaying the mutation", async action => {
    mockMembershipLookups("owner", { id: "mem-2", role: "read_only", organizationId: "org-1", userId: "user-2" });
    mocks.recordAudit.mockRejectedValueOnce(Error("private audit diagnostic"));
    const { POST } = await import("../route");
    const result = await POST(formRequest({ membershipId: "mem-2", action, role: "operator" }));
    expect(locationOf(result).searchParams.get("error")).toBe("audit_unconfirmed");
    expect(locationOf(result).searchParams.has("notice")).toBe(false);
    expect(action === "remove" ? mocks.deleteMembership : mocks.updateMembership).toHaveBeenCalledOnce();
    expect(mocks.recordAudit).toHaveBeenCalledOnce();
  });

});

describe('advisory desktop navigation fences role forms without granting authority',()=>{
 const now=Date.parse('2026-10-24T12:00:00.000Z');
 const intent=()=>({returnIntent:'members_handoff',destination:'members',expectedUserId:'user-1',organizationId:'org-1',membershipAcceptedAt:'2026-10-20T12:00:00.000Z',membershipUpdatedAt:'2026-10-21T12:00:00.000Z',issuedAt:new Date(now).toISOString(),expiresAt:new Date(now+300000).toISOString()});
 const freshOwn=()=>({role:'owner',acceptedAt:new Date(intent().membershipAcceptedAt),updatedAt:new Date(intent().membershipUpdatedAt)});
 const request=(extra:Record<string,string>={},origin='https://visionxixlabs.com')=>new Request('https://visionxixlabs.com/api/team/role',{method:'POST',headers:{origin,'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({...intent(),membershipId:'target',role:'read_only',...extra})});
 beforeEach(()=>{vi.clearAllMocks();vi.spyOn(Date,'now').mockReturnValue(now);mocks.requireContext.mockResolvedValue({sessionUserId:'user-1',userId:'user-1',organizationId:'org-1',email:'u@test.invalid'});mocks.findMembership.mockImplementation(async({where}:{where:Record<string,unknown>})=>'id'in where?{id:'target',role:'operator',userId:'other',organizationId:'org-1'}:freshOwn());mocks.updateMembership.mockResolvedValue({});mocks.updateManyMembership.mockResolvedValue({count:1});mocks.deleteManyMembership.mockResolvedValue({count:1});mocks.recordAudit.mockResolvedValue(undefined);});
 it('refuses partial, wrong-account/workspace, foreign-origin and expired intents without touching a target',async()=>{const {POST}=await import('../route');for(const extra of [{expectedUserId:'different'},{organizationId:'other'},{destination:'https://evil.test'},{issuedAt:'invalid'},{expiresAt:new Date(now).toISOString()}] as Array<Record<string,string>>){await POST(request(extra));expect(mocks.updateMembership).not.toHaveBeenCalled();expect(mocks.findMembership).not.toHaveBeenCalled();}await POST(request({},'https://foreign.test'));expect(mocks.findMembership).not.toHaveBeenCalled();const partial=new Request('https://visionxixlabs.com/api/team/role',{method:'POST',headers:{origin:'https://visionxixlabs.com','content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({membershipId:'target',expectedUserId:'user-1',role:'read_only'})});await POST(partial);expect(mocks.updateMembership).not.toHaveBeenCalled();vi.restoreAllMocks();});
 it('requires fresh context and exact accepted membership revision immediately before write',async()=>{const {POST}=await import('../route');mocks.requireContext.mockResolvedValueOnce({sessionUserId:'user-1',userId:'user-1',organizationId:'org-1',email:'u@test.invalid'}).mockResolvedValue({sessionUserId:'other',userId:'other',organizationId:'org-1',email:'o@test.invalid'});await POST(request());expect(mocks.updateMembership).not.toHaveBeenCalled();mocks.requireContext.mockResolvedValue({sessionUserId:'user-1',userId:'user-1',organizationId:'org-1',email:'u@test.invalid'});let ownReads=0;mocks.findMembership.mockImplementation(async({where}:{where:Record<string,unknown>})=>'id'in where?{id:'target',role:'operator',userId:'other',organizationId:'org-1'}:++ownReads===1?freshOwn():{...freshOwn(),updatedAt:new Date(now)});await POST(request());expect(mocks.updateMembership).not.toHaveBeenCalled();vi.restoreAllMocks();});
 it('retains authorized role write and required audit but returns through the guarded destination',async()=>{const {POST}=await import('../route');const response=await POST(request());expect(mocks.updateManyMembership).toHaveBeenCalledOnce();expect(mocks.updateMembership).not.toHaveBeenCalled();expect(mocks.recordAudit).toHaveBeenCalledOnce();expect(locationOf(response).pathname).toBe('/workspace-handoff');expect(locationOf(response).searchParams.get('expectedUserId')).toBe('user-1');vi.restoreAllMocks();});
 it.each(['remove','change_role'])('refuses %s if target is promoted to owner during final actor revalidation',async action=>{const {POST}=await import('../route');let currentRole='operator';let contextReads=0;mocks.requireContext.mockImplementation(async()=>{if(++contextReads===2)currentRole='owner';return{sessionUserId:'user-1',userId:'user-1',organizationId:'org-1',email:'u@test.invalid'};});mocks.findMembership.mockImplementation(async({where}:{where:Record<string,unknown>})=>'id'in where?{id:'target',role:currentRole,userId:'other',organizationId:'org-1'}:freshOwn());const cas=vi.fn(async({where}:{where:{id:string;organizationId:string;userId:string;role:string;NOT:unknown}})=>{expect(where).toEqual({id:'target',organizationId:'org-1',userId:'other',role:'operator',NOT:[{userId:'user-1'},{role:'owner'}]});return{count:where.role===currentRole?1:0};});mocks.updateManyMembership.mockImplementation(cas);mocks.deleteManyMembership.mockImplementation(cas);const response=await POST(request({action}));expect(response.status).toBe(409);expect(cas).toHaveBeenCalledOnce();expect(mocks.updateMembership).not.toHaveBeenCalled();expect(mocks.deleteMembership).not.toHaveBeenCalled();expect(mocks.recordAudit).not.toHaveBeenCalled();vi.restoreAllMocks();});

});
