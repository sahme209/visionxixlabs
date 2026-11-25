import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  session: vi.fn(), token: vi.fn(), lead: vi.fn(), conversation: vi.fn(), agent: vi.fn(),
}));
vi.mock("next-auth", () => ({ getServerSession: mocks.session }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/starterToken", () => ({ verifyStarterToken: mocks.token }));
vi.mock("@/lib/db", () => ({ prisma: { lead: { findUnique: mocks.lead, findFirst: mocks.lead } } }));
vi.mock("@/lib/axiomChat/storage", () => ({ createConversation: mocks.conversation }));
vi.mock("@/lib/agents/axiomAssistantAgent", () => ({ runAxiomAssistantAgent: mocks.agent }));
vi.mock("@/lib/rateLimit", () => ({ checkRateLimit: () => true }));
import { POST } from "../route";

const request = (token?: string) => new NextRequest("http://localhost/api/cloud-operator/chat", {
  method: "POST", body: JSON.stringify({ message: "Review the recorded environment", token }),
});

describe("Cloud Operator chat funding authority", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv("AXIOM_PUBLIC_BILLING_POLICY", "axiom_public_anniversary_v1");
    mocks.session.mockResolvedValue(null);
    mocks.token.mockReturnValue({ leadId: "lead-fixture" });
    mocks.lead.mockResolvedValue({ id: "lead-fixture", source: "cloud-operator", userId: "owner-fixture" });
  });
  afterEach(() => vi.unstubAllEnvs());

  it.each([true, false])("does not infer workspace authority from a lead token or session (%j)", async fromToken => {
    if (!fromToken) mocks.session.mockResolvedValueOnce({ user: { id: "owner-fixture" } });
    const response = await POST(request(fromToken ? "fixture-token" : undefined));
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ code: "ai.workspace_admission_required" });
    expect(mocks.conversation).not.toHaveBeenCalled();
    expect(mocks.agent).not.toHaveBeenCalled();
  });

  it("still validates lead authentication before checking workspace AI access", async () => {
    mocks.token.mockReturnValueOnce({ error: "expired" });
    expect((await POST(request("expired-fixture-token"))).status).toBe(401);
    expect(mocks.lead).not.toHaveBeenCalled();
    expect(mocks.agent).not.toHaveBeenCalled();
  });

  it("preserves the previously configured legacy route outside public prepaid billing", async () => {
    vi.stubEnv("AXIOM_PUBLIC_BILLING_POLICY", "");
    mocks.conversation.mockResolvedValue({ id: "conversation-fixture" });
    mocks.agent.mockResolvedValue({ assistantMessage: "Fixture response" });
    const response = await POST(request("fixture-token"));
    expect(await response.json()).toMatchObject({ conversationId: "conversation-fixture", assistantMessage: "Fixture response" });
    expect(mocks.agent).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ leadId: "lead-fixture" }));
  });
});
