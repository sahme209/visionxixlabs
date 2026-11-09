import { describe, expect, it } from "vitest";
import { classifyAccountIntent, composeAccountAnswer, diagnose } from "../accountIntents";

describe("Ask Axiom account intents", () => {
  it.each([
    ["which agent requests are waiting", "agent_requests"],
    ["is cursor waiting for approval", "agent_requests"],
    ["what approvals are pending", "pending_approvals"],
    ["what's waiting for me", "pending_approvals"],
    ["is our audit log intact", "audit_integrity"],
    ["which integrations are connected", "connections"],
    ["what happened recently", "recent_activity"],
    ["I need admin access", "access_request"],
    ["run a health check on our workspace", "diagnostic"],
    ["something is broken, what's wrong", "diagnostic"],
    ["why can't I approve this deployment", "access_request"],
  ])("classifies %s", (q, intent) => expect(classifyAccountIntent(q)).toBe(intent));

  it("returns null for non-account questions so the docs answer stands", () => {
    expect(classifyAccountIntent("how does pricing work")).toBeNull();
  });

  it("composes honest, bounded answers with a place to act", () => {
    expect(composeAccountAnswer("agent_requests", { pendingAgentRequests: 0 }).answer).toMatch(/No AI agent/);
    expect(composeAccountAnswer("agent_requests", { pendingAgentRequests: 2 })).toMatchObject({ href: "/control/agent-gateway", answer: expect.stringMatching(/2 AI agent requests are waiting/) });
    expect(composeAccountAnswer("pending_approvals", { pendingProposals: 1, pendingCloudItems: 2, pendingAgentRequests: 0 }).answer).toMatch(/1 Agent proposals, 2 cloud actions/);
    expect(composeAccountAnswer("connections", { connections: [{ provider: "github", status: "active" }, { provider: "prefect", status: "revoked" }] }).answer).toMatch(/does not prove every operation works/);
    expect(composeAccountAnswer("audit_integrity", { latestSeal: null }).answer).toMatch(/not been sealed/);
    expect(composeAccountAnswer("recent_activity", { recentEvents: [] }).answer).toBe("No recorded activity yet.");
  });
});


describe("Ask Axiom diagnostic", () => {
  const now = new Date("2026-11-09T00:00:00Z");
  const base = { connections: [], keysExpiringSoon: 0, expiredAgentRequests: 0, oldPendingProposals: 0, latestSealAt: new Date("2026-11-01T00:00:00Z"), now };
  it("reports nothing when the workspace is healthy, and says it is a saved-state check", () => {
    expect(diagnose(base)).toEqual([]);
    expect(composeAccountAnswer("diagnostic", { findings: [] }).answer).toMatch(/not a live test/);
  });
  it("puts problems that stop work first and links each to where to fix it", () => {
    const f = diagnose({ ...base, connections: [{ provider: "github", status: "active" }, { provider: "prefect", status: "revoked" }], keysExpiringSoon: 2, expiredAgentRequests: 1, latestSealAt: null });
    expect(f.map((x) => x.severity)).toEqual(["attention", "attention", "info", "info"]);
    expect(f[0]).toMatchObject({ href: "/control/integrations", text: expect.stringMatching(/prefect \(revoked\)/) });
    expect(f[1].href).toBe("/control/api-keys");
    expect(f.some((x) => /never been sealed/.test(x.text))).toBe(true);
  });
  it("flags an old seal", () => {
    expect(diagnose({ ...base, latestSealAt: new Date("2026-09-01T00:00:00Z") })[0].text).toMatch(/last sealed 69 days ago/);
  });
});
