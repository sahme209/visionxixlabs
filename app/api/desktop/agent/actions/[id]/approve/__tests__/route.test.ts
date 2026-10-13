import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({ resolve: vi.fn(), decide: vi.fn() }));
vi.mock("@/lib/desktop/resolveRequestDesktopSession", () => ({ resolveRequestDesktopSession: mocks.resolve }));
vi.mock("@/lib/axiom/agentRuntime/browserApprovalDecision", () => ({ decideAgentAction: mocks.decide }));

const session = { id: "sess-1", userId: "reviewer-1", organizationId: "org-1", credentialKind: "desktop_session", role: "admin" };
const params = { params: Promise.resolve({ id: "ap-1" }) };
const request = () => new NextRequest("https://visionxixlabs.com/api/desktop/agent/actions/ap-1/approve", { method: "POST" });

describe("desktop agent approval route", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.resolve.mockResolvedValue(session); mocks.decide.mockResolvedValue({ ok: true, status: "executed" }); });

  it("requires a capability-authorized desktop session", async () => {
    mocks.resolve.mockResolvedValue(undefined);
    const { POST } = await import("../route");
    expect((await POST(request(), params)).status).toBe(401);
    expect(mocks.decide).not.toHaveBeenCalled();
  });

  it("uses the same protected decision service as browser governance", async () => {
    const { POST } = await import("../route");
    const response = await POST(request(), params);
    expect(response.status).toBe(200);
    expect(mocks.decide).toHaveBeenCalledWith(expect.objectContaining({ organizationId: "org-1", proposalId: "ap-1", actorUserId: "reviewer-1", actorRole: "admin", decision: "approve" }));
  });

  it("preserves one-shot conflict responses", async () => {
    mocks.decide.mockResolvedValue({ ok: false, error: "already_decided" });
    const { POST } = await import("../route");
    expect((await POST(request(), params)).status).toBe(409);
  });
});
