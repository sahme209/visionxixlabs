/**
 * Organization membership lifecycle — invite side. Locks in: only
 * owner/admin can mint an invite, invalid input is rejected before any
 * token is minted, and a successful invite writes a correlation-ID
 * audit event.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireContext: vi.fn(),
  findMembership: vi.fn(),
  createInviteToken: vi.fn(),
  recordAudit: vi.fn(),
  enrollment: vi.fn(),
}));

vi.mock("@/lib/auth/currentContext", () => ({ requireContext: mocks.requireContext }));
vi.mock("@/lib/db", () => ({ prisma: { orgMembership: { findUnique: mocks.findMembership }, durableAgentWorkflow: { findMany: mocks.enrollment } } }));
vi.mock("@/lib/workforce/domains/inviteLinks", () => ({
  createInviteToken: mocks.createInviteToken,
  ASSIGNABLE_ROLES: ["admin", "operator", "security_reviewer", "finance_viewer", "read_only"],
}));
vi.mock("@/lib/audit/requiredAudit", () => ({ recordRequiredAudit: mocks.recordAudit }));

function formRequest(fields: Record<string, string>) {
  const body = new URLSearchParams(fields);
  return new Request("https://visionxixlabs.com/api/team/invite", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
}

function locationOf(res: Response): URL {
  return new URL(res.headers.get("location") ?? "");
}

describe("POST /api/team/invite — organization membership lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireContext.mockResolvedValue({ userId: "user-1", organizationId: "org-1", email: "owner@acme.test" });
    mocks.createInviteToken.mockReturnValue("fake-invite-token");
    mocks.enrollment.mockResolvedValue([]);
  });

  it("refuses a new invitation while the workspace is enrolled in Governance — never mints a token", async () => {
    mocks.findMembership.mockResolvedValue({ role: "owner", acceptedAt: new Date() });
    mocks.enrollment.mockResolvedValue([{ id: "governance_active_fixture", organizationId: "org-1", workflowKind: "governance_baseline_active_v1" }]);
    const { POST } = await import("../route");
    const res = await POST(formRequest({ email: "new@acme.test", role: "read_only" }));
    expect(locationOf(res).searchParams.get("error")).toBe("governance_enrolled_privilege_increase");
    expect(mocks.createInviteToken).not.toHaveBeenCalled();
    expect(mocks.recordAudit).not.toHaveBeenCalled();
  });

  it("rejects an invalid email before checking permission or minting a token", async () => {
    const { POST } = await import("../route");
    const res = await POST(formRequest({ email: "not-an-email", role: "operator" }));

    expect(locationOf(res).searchParams.get("error")).toBe("invalid_email");
    expect(mocks.findMembership).not.toHaveBeenCalled();
    expect(mocks.createInviteToken).not.toHaveBeenCalled();
  });

  it("rejects an invalid role", async () => {
    const { POST } = await import("../route");
    const res = await POST(formRequest({ email: "new@acme.test", role: "superuser" }));

    expect(locationOf(res).searchParams.get("error")).toBe("invalid_role");
    expect(mocks.createInviteToken).not.toHaveBeenCalled();
  });

  it("denies a caller who is not owner/admin in this workspace — never mints a token", async () => {
    mocks.findMembership.mockResolvedValue({ role: "operator", acceptedAt: new Date() });
    const { POST } = await import("../route");
    const res = await POST(formRequest({ email: "new@acme.test", role: "operator" }));

    expect(locationOf(res).searchParams.get("error")).toBe("insufficient_permission");
    expect(mocks.createInviteToken).not.toHaveBeenCalled();
  });

  it("mints an invite for an owner/admin caller and audits it with a correlation id", async () => {
    mocks.findMembership.mockResolvedValue({ role: "admin", acceptedAt: new Date() });
    const { POST } = await import("../route");
    const res = await POST(formRequest({ email: "new@acme.test", role: "operator" }));

    expect(locationOf(res).searchParams.get("notice")).toBe("invite_sent");
    expect(mocks.createInviteToken).toHaveBeenCalledWith("org-1", "new@acme.test", "operator", "user-1");
    expect(mocks.recordAudit).toHaveBeenCalledWith(expect.objectContaining({
      action: "members.invite",
      outcome: "success",
      correlationId: expect.any(String),
    }));
  });

  it.each(["owner", "admin"])("does not mint invitations for pending %s membership", async (role) => {
    mocks.findMembership.mockResolvedValue({ role, acceptedAt: null });
    const { POST } = await import("../route");
    const res = await POST(formRequest({ email: "new@example.test", role: "read_only" }));
    expect(locationOf(res).searchParams.get("error")).toBe("insufficient_permission");
    expect(mocks.createInviteToken).not.toHaveBeenCalled();
    expect(mocks.recordAudit).not.toHaveBeenCalled();
  });

  it("does not trust administrative claims after the membership is deleted", async () => {
    mocks.requireContext.mockResolvedValue({ userId: "user-1", organizationId: "org-1", email: "old@example.test", roles: ["owner"] });
    mocks.findMembership.mockResolvedValue(null);
    const { POST } = await import("../route");
    const res = await POST(formRequest({ email: "new@example.test", role: "read_only" }));
    expect(locationOf(res).searchParams.get("error")).toBe("insufficient_permission");
    expect(mocks.createInviteToken).not.toHaveBeenCalled();
  });

  it("does not mint a token when current membership lookup fails", async () => {
    mocks.findMembership.mockRejectedValue(Error("unavailable"));
    const { POST } = await import("../route");
    const res = await POST(formRequest({ email: "new@example.test", role: "read_only" }));
    expect(locationOf(res).searchParams.get("error")).toBe("insufficient_permission");
    expect(mocks.createInviteToken).not.toHaveBeenCalled();
  });
  it("withholds the invitation link when required audit persistence fails", async () => {
    mocks.findMembership.mockResolvedValue({ role: "admin", acceptedAt: new Date() });
    mocks.recordAudit.mockRejectedValueOnce(Error("private audit diagnostic"));
    const { POST } = await import("../route");
    const result = await POST(formRequest({ email: "disposable@example.test", role: "read_only" }));
    expect(locationOf(result).searchParams.get("error")).toBe("audit_unconfirmed");
    expect(locationOf(result).searchParams.has("inviteUrl")).toBe(false);
    expect(locationOf(result).searchParams.has("notice")).toBe(false);
    expect(mocks.createInviteToken).toHaveBeenCalledOnce();
  });

});
