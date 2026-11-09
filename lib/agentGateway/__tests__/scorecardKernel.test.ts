import { describe, expect, it } from "vitest";
import { buildScorecards, type ScorecardRow } from "../scorecardKernel";

const row = (over: Partial<ScorecardRow> = {}): ScorecardRow => ({ apiKeyId: "k1", agentName: "cursor", status: "completed", policyDecision: "require_approval", riskLevel: "medium", outcome: "succeeded", createdAt: new Date("2026-11-09T00:00:00Z"), ...over });
const many = (n: number, over: Partial<ScorecardRow> = {}) => Array.from({ length: n }, (_, i) => row({ createdAt: new Date(Date.UTC(2026, 10, 1, 0, i)), ...over }));

describe("agent scorecards", () => {
  it("groups by API key and calls a short history new", () => {
    const cards = buildScorecards([...many(3), ...many(12, { apiKeyId: "k2", agentName: "claude-code" })]);
    expect(cards.map((c) => c.apiKeyId)).toEqual(["k2", "k1"]);
    expect(cards[1].trust).toBe("new");
  });

  it("calls a consistently successful agent reliable", () => {
    const [c] = buildScorecards(many(12));
    expect(c).toMatchObject({ trust: "reliable", requests: 12, succeeded: 12, approved: 12, successRate: 1 });
  });

  it("flags an agent with low success, many rejections or many denials for review", () => {
    expect(buildScorecards([...many(6), ...many(6, { outcome: "failed", status: "failed" })])[0].trust).toBe("needs_review");
    expect(buildScorecards([...many(4), ...many(8, { status: "rejected", outcome: null })])[0].trust).toBe("needs_review");
    expect(buildScorecards([...many(8), ...many(4, { policyDecision: "deny", status: "rejected", outcome: null })])[0].trust).toBe("needs_review");
  });

  it("counts approved actions with no reported outcome", () => {
    const [c] = buildScorecards([...many(10), ...many(3, { status: "approved", outcome: null })]);
    expect(c.unreportedAfterApproval).toBe(3);
    expect(c.trust).not.toBe("reliable");
    expect(c.trustReasons.join(" ")).toMatch(/no reported outcome/);
  });

  it("always states that trust never changes policy", () => {
    for (const c of buildScorecards([...many(2), ...many(20, { apiKeyId: "k9" })])) expect(c.trustReasons.at(-1)).toMatch(/never changes what policy allows/);
  });
});
