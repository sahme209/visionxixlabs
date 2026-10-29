import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  resolveRequestDesktopSession: vi.fn(),
  aggregate: vi.fn(),
  readBilling: vi.fn(),
  readAllowance: vi.fn(),
}));

vi.mock("@/lib/desktop/resolveRequestDesktopSession", () => ({
  resolveRequestDesktopSession: mocks.resolveRequestDesktopSession,
}));
vi.mock("@/lib/db", () => ({
  prisma: { usageEvent: { aggregate: mocks.aggregate } },
}));

vi.mock("@/lib/billing/tenantBillingStore", () => ({ readBillingPlanWithAvailability: mocks.readBilling }));
vi.mock("@/lib/billing/currentAIAllowance", () => ({ readCurrentAIAllowance: mocks.readAllowance }));

function request() {
  return new NextRequest("https://visionxixlabs.com/api/desktop/usage-summary", { method: "GET" });
}

const session = { id: "sess-1", userId: "user-1", organizationId: "org-1", role: "owner", credentialKind: "desktop_session" as const };

describe("GET /api/desktop/usage-summary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveRequestDesktopSession.mockResolvedValue(session);
    mocks.aggregate.mockResolvedValue({_sum:{inputTokens:0,outputTokens:0,costCents:0},_count:{_all:0}});
    mocks.readBilling.mockResolvedValue({available:true,plan:{publicPlanId:"free",pricingPlanAvailable:true,pricingPlan:{displayName:"Free"},spec:{label:"Trial"},status:"active",stripeCustomerId:"cus_private",stripeSubscriptionId:"sub_private"}});
    mocks.readAllowance.mockResolvedValue({available:true,baseCents:200,addOnCents:0,poolCents:200,usedCents:0,heldCents:0,includedRemainingCents:200,overagePolicy:"block"});
  });

  it("requires a desktop session", async () => {
    mocks.resolveRequestDesktopSession.mockResolvedValue(undefined);
    const { GET } = await import("../route");
    const res = await GET(request());
    expect(res.status).toBe(401);
  });

  it("returns the aggregated usage for the session's org", async () => {
    mocks.aggregate.mockResolvedValue({
      _sum: { inputTokens: 1000, outputTokens: 200, costCents: 50 },
      _count: { _all: 3 },
    });
    const { GET } = await import("../route");
    const res = await GET(request());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data.aiInvocationCount).toBe(3);
    expect(body.data.aiInputTokens).toBe(1000);
    expect(mocks.aggregate).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ organizationId: "org-1", eventKind: "ai_invocation" }),
    }));
  });
  it("reports the current public plan and allowance without exposing payment identities", async () => {
    const {GET}=await import("../route");
    const res=await GET(request()); const body=await res.json();
    expect(body.data.billingSnapshot).toMatchObject({version:1,canManageBilling:true,plan:{available:true,label:"Free",publicPlanId:"free",hasCustomer:true},allowance:{available:true,includedRemainingCents:200}});
    expect(JSON.stringify(body)).not.toMatch(/cus_private|sub_private|Trial/);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(mocks.readBilling).toHaveBeenCalledWith("org-1");
    expect(mocks.readAllowance).toHaveBeenCalledWith(expect.anything(),"org-1");
    expect(mocks.resolveRequestDesktopSession).toHaveBeenCalledWith(expect.anything(),{requiredScope:"pipeline:read",route:"GET /api/desktop/usage-summary",allowApiKey:false});
  });
  it.each(["operator","read_only","security_reviewer","finance_viewer","unknown"])("does not offer billing management to %s", async role => {
    mocks.resolveRequestDesktopSession.mockResolvedValue({...session,role});
    const {GET}=await import("../route");
    expect((await (await GET(request())).json()).data.billingSnapshot.canManageBilling).toBe(false);
  });
  it("keeps unavailable plan and allowance distinct from a Free plan or zero credit",async()=>{
    mocks.readBilling.mockRejectedValue(new Error("private storage detail"));
    mocks.readAllowance.mockRejectedValue(new Error("private storage detail"));
    const {GET}=await import("../route");const res=await GET(request());const body=await res.json();
    expect(body.data.billingSnapshot.plan).toEqual({available:false});
    expect(body.data.billingSnapshot.allowance).toEqual({available:false});
    expect(JSON.stringify(body)).not.toContain("private storage");
  });
  it("does not present an unusable public pricing contract as verified",async()=>{
    mocks.readBilling.mockResolvedValue({available:true,plan:{pricingPlanAvailable:false,spec:{label:"Trial"},status:"active"}});
    const {GET}=await import("../route");
    expect((await (await GET(request())).json()).data.billingSnapshot.plan).toEqual({available:false});
  });

});
