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
}));

vi.mock("@/lib/auth/currentContext", () => ({ requireContext: mocks.requireContext }));
vi.mock("@/lib/db", () => ({ prisma: { orgMembership: { findUnique: mocks.findMembership } } }));
vi.mock("@/lib/workforce/domains/inviteLinks", () => ({
  createInviteToken: mocks.createInviteToken,
  ASSIGNABLE_ROLES: ["admin", "operator", "security_reviewer", "finance_viewer", "read_only"],
}));
vi.mock("@/lib/audit/secureAudit", () => ({ record: mocks.recordAudit }));

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
    mocks.findMembership.mockResolvedValue({ role: "operator" });
    const { POST } = await import("../route");
    const res = await POST(formRequest({ email: "new@acme.test", role: "operator" }));

    expect(locationOf(res).searchParams.get("error")).toBe("insufficient_permission");
    expect(mocks.createInviteToken).not.toHaveBeenCalled();
  });

  it("mints an invite for an owner/admin caller and audits it with a correlation id", async () => {
    mocks.findMembership.mockResolvedValue({ role: "admin" });
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
});
