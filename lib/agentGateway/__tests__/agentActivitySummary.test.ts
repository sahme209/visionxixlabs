import { describe, expect, it } from "vitest";
import { summarizeAgentActivity } from "../agentActivitySummary";
describe("agent activity summary", () => {
  it("counts decisions, lanes and distinct agents", () => {
    const rows = [
      { status: "approved", reviewTriage: { lane: "auto" }, agentName: "cursor" },
      { status: "completed", reviewTriage: { lane: "careful" }, agentName: "claude-code" },
      { status: "rejected", reviewTriage: { lane: "two_person" }, agentName: "claude-code" },
      { status: "pending", reviewTriage: null, agentName: "cursor" },
    ];
    expect(summarizeAgentActivity(rows)).toEqual({ total: 4, approved: 2, rejected: 1, pending: 1, agents: 2, byLane: [
      { lane: "auto", label: "Allowed by policy", count: 1 }, { lane: "careful", label: "Careful review", count: 1 }, { lane: "two_person", label: "Two approvers", count: 1 },
    ] });
  });
});
