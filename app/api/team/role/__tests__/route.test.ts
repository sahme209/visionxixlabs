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
  recordAudit: vi.fn(),
}));

vi.mock("@/lib/auth/currentContext", () => ({ requireContext: mocks.requireContext }));
vi.mock("@/lib/db", () => ({
  prisma: {
    orgMembership: {
      findUnique: mocks.findMembership,
      delete: mocks.deleteMembership,
      update: mocks.updateMembership,
    },
  },
}));
vi.mock("@/lib/workforce/domains/inviteLinks", () => ({
  ASSIGNABLE_ROLES: ["admin", "operator", "security_reviewer", "finance_viewer", "read_only"],
}));
vi.mock("@/lib/audit/secureAudit", () => ({ record: mocks.recordAudit }));

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
      return Promise.resolve(callerRole ? { role: callerRole } : null);
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
});
