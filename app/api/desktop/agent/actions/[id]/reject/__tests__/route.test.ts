import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({ resolve: vi.fn(), decide: vi.fn() }));
vi.mock("@/lib/desktop/resolveRequestDesktopSession", () => ({ resolveRequestDesktopSession: mocks.resolve }));
vi.mock("@/lib/axiom/agentRuntime/browserApprovalDecision", () => ({ decideAgentAction: mocks.decide }));

const session = { id: "sess-1", userId: "reviewer-1", organizationId: "org-1", credentialKind: "desktop_session", role: "security_reviewer" };
const params = { params: Promise.resolve({ id: "ap-1" }) };
const request = () => new NextRequest("https://visionxixlabs.com/api/desktop/agent/actions/ap-1/reject", { method: "POST" });

describe("desktop agent rejection route", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.resolve.mockResolvedValue(session); mocks.decide.mockResolvedValue({ ok: true, status: "rejected" }); });

  it("requires a capability-authorized desktop session", async () => {
    mocks.resolve.mockResolvedValue(undefined);
    const { POST } = await import("../route");
    expect((await POST(request(), params)).status).toBe(401);
  });

  it("uses the same protected decision service as browser governance", async () => {
    const { POST } = await import("../route");
    expect((await POST(request(), params)).status).toBe(200);
    expect(mocks.decide).toHaveBeenCalledWith(expect.objectContaining({ organizationId: "org-1", proposalId: "ap-1", actorUserId: "reviewer-1", actorRole: "security_reviewer", decision: "reject" }));
  });
});

it("lets an ordinary paired requester reach the authoritative self-stop transaction",async()=>{vi.clearAllMocks();mocks.resolve.mockResolvedValue({...session,userId:"requester",role:"read_only"});mocks.decide.mockResolvedValue({ok:true,status:"rejected"});const {POST}=await import("../route");expect((await POST(request(),params)).status).toBe(200);expect(mocks.resolve).toHaveBeenCalledWith(expect.anything(),expect.objectContaining({requiredCapability:"workspace:read",requireWorkspaceMembership:true,allowApiKey:false,recordHeartbeat:false,requireActiveAccess:false}));expect(mocks.decide).toHaveBeenCalledWith(expect.objectContaining({actorUserId:"requester",decision:"reject"}));});
it("retains the authoritative refusal for another user's proposal",async()=>{vi.clearAllMocks();mocks.resolve.mockResolvedValue({...session,userId:"reader",role:"read_only"});mocks.decide.mockResolvedValue({ok:false,error:"approval_authority_required"});const {POST}=await import("../route");expect((await POST(request(),params)).status).toBe(403);});
