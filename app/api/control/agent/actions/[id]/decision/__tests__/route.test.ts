import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({ currentContext: vi.fn(), canDecideApprovals: vi.fn(), isSameOriginRequest: vi.fn(), decide: vi.fn() }));
vi.mock("@/lib/auth/currentContext", () => ({ currentContext: mocks.currentContext }));
vi.mock("@/lib/auth/platformAdmin", () => ({ canDecideApprovals: mocks.canDecideApprovals }));
vi.mock("@/lib/auth/requestOrigin", () => ({ isSameOriginRequest: mocks.isSameOriginRequest }));
vi.mock("@/lib/axiom/agentRuntime/browserApprovalDecision", () => ({ decideAgentAction: mocks.decide }));

function request(decision: string) { return new NextRequest("https://visionxixlabs.com/api/control/agent/actions/p-1/decision", { method: "POST", headers: { origin: "https://visionxixlabs.com" }, body: JSON.stringify({ decision }) }); }
const params = { params: Promise.resolve({ id: "p-1" }) };

describe("POST browser agent action decision", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isSameOriginRequest.mockReturnValue(true);
    mocks.canDecideApprovals.mockReturnValue(true);
    mocks.currentContext.mockResolvedValue({ isAuthenticated: true, userId: "reviewer-1", organizationId: "org-1", email: "reviewer@example.com", roles: ["security_reviewer"] });
    mocks.decide.mockResolvedValue({ ok: true, status: "rejected" });
  });

  it("rejects cross-origin session mutations", async () => {
    mocks.isSameOriginRequest.mockReturnValue(false);
    const { POST } = await import("../route");
    expect((await POST(request("reject"), params)).status).toBe(403);
    expect(mocks.currentContext).not.toHaveBeenCalled();
  });

  it("requires an approver role", async () => {
    mocks.canDecideApprovals.mockReturnValue(false);
    const { POST } = await import("../route");
    expect((await POST(request("approve"), params)).status).toBe(403);
    expect(mocks.decide).not.toHaveBeenCalled();
  });

  it("passes only server-derived organization and actor authority", async () => {
    const { POST } = await import("../route");
    expect((await POST(request("reject"), params)).status).toBe(200);
    expect(mocks.decide).toHaveBeenCalledWith(expect.objectContaining({ organizationId: "org-1", proposalId: "p-1", actorUserId: "reviewer-1", actorRole: "security_reviewer", decision: "reject" }));
  });
});
