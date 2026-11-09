import { describe, expect, it } from "vitest";
import { classifyAccountIntent, composeAccountAnswer } from "../accountIntents";

describe("Ask Axiom account intents", () => {
  it.each([
    ["which agent requests are waiting", "agent_requests"],
    ["is cursor waiting for approval", "agent_requests"],
    ["what approvals are pending", "pending_approvals"],
    ["what's waiting for me", "pending_approvals"],
    ["is our audit log intact", "audit_integrity"],
    ["which integrations are connected", "connections"],
    ["what happened recently", "recent_activity"],
  ])("classifies %s", (q, intent) => expect(classifyAccountIntent(q)).toBe(intent));

  it("returns null for non-account questions so the docs answer stands", () => {
    expect(classifyAccountIntent("how does pricing work")).toBeNull();
  });

  it("composes honest, bounded answers with a place to act", () => {
    expect(composeAccountAnswer("agent_requests", { pendingAgentRequests: 0 }).answer).toMatch(/No AI agent/);
    expect(composeAccountAnswer("agent_requests", { pendingAgentRequests: 2 })).toMatchObject({ href: "/dashboard/agent-gateway", answer: expect.stringMatching(/2 AI agent requests are waiting/) });
    expect(composeAccountAnswer("pending_approvals", { pendingProposals: 1, pendingCloudItems: 2, pendingAgentRequests: 0 }).answer).toMatch(/1 Agent proposals, 2 cloud actions/);
    expect(composeAccountAnswer("connections", { connections: [{ provider: "github", status: "active" }, { provider: "prefect", status: "revoked" }] }).answer).toMatch(/does not prove every operation works/);
    expect(composeAccountAnswer("audit_integrity", { latestSeal: null }).answer).toMatch(/not been sealed/);
    expect(composeAccountAnswer("recent_activity", { recentEvents: [] }).answer).toBe("No recorded activity yet.");
  });
});
