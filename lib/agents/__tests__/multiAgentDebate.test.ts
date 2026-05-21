import { describe, it, expect } from "vitest";
import {
  reconcileDebate,
  DEFAULT_DEBATE_CONFIG,
  type AgentProposal,
  type DebateConfig,
} from "../multiAgentDebate";

function prop(
  agentId: string,
  verdict: AgentProposal["verdict"],
  tier: AgentProposal["tier"] = "reasoning",
  confidence = 0.8,
): AgentProposal {
  return { agentId, verdict, tier, confidence, rationale: `${agentId} says ${verdict}` };
}

describe("reconcileDebate", () => {
  it("empty proposals → needs_more_info + dissent", () => {
    const r = reconcileDebate([]);
    expect(r.finalVerdict).toBe("needs_more_info");
    expect(r.consensus).toBe("dissent");
  });

  it("3-of-3 approve → unanimous_approve", () => {
    const r = reconcileDebate([prop("a", "approve"), prop("b", "approve"), prop("c", "approve")]);
    expect(r.consensus).toBe("unanimous_approve");
    expect(r.finalVerdict).toBe("approve");
    expect(r.dissenters).toEqual([]);
  });

  it("2-of-3 approve → quorum_approve + dissent surfaced", () => {
    const r = reconcileDebate([prop("a", "approve"), prop("b", "approve"), prop("c", "reject")]);
    expect(r.consensus).toBe("quorum_approve");
    expect(r.finalVerdict).toBe("approve");
    expect(r.dissenters.length).toBe(1);
    expect(r.dissenters[0].agentId).toBe("c");
  });

  it("1-of-3 approve + 2 reject → quorum_reject", () => {
    const r = reconcileDebate([prop("a", "approve"), prop("b", "reject"), prop("c", "reject")]);
    expect(r.finalVerdict).toBe("reject");
    expect(r.consensus).toBe("quorum_reject");
  });

  it("safety-tier reject → safety_veto regardless of other votes", () => {
    const r = reconcileDebate([
      prop("a", "approve"),
      prop("b", "approve"),
      prop("c", "reject", "safety"),
    ]);
    expect(r.consensus).toBe("safety_veto");
    expect(r.finalVerdict).toBe("reject");
    expect(r.narrative).toMatch(/safety veto/i);
  });

  it("safety veto can be disabled via config", () => {
    const config: DebateConfig = { ...DEFAULT_DEBATE_CONFIG, safetyVeto: false };
    const r = reconcileDebate(
      [prop("a", "approve"), prop("b", "approve"), prop("c", "reject", "safety")],
      config,
    );
    expect(r.consensus).toBe("quorum_approve");
    expect(r.finalVerdict).toBe("approve");
  });

  it("unanimous quorum requires all agents", () => {
    const r = reconcileDebate(
      [prop("a", "approve"), prop("b", "approve"), prop("c", "reject")],
      { quorum: "unanimous", safetyVeto: true },
    );
    // Not unanimous → falls through to dissent / needs_more_info
    expect(r.consensus).not.toBe("unanimous_approve");
  });

  it("weighted_majority resolves close votes via confidence", () => {
    const r = reconcileDebate(
      [
        prop("a", "approve", "reasoning", 0.9),
        prop("b", "reject",  "reasoning", 0.4),
        prop("c", "reject",  "reasoning", 0.4),
      ],
      { quorum: "weighted_majority", safetyVeto: true },
    );
    // 2 rejects > 1 approve, but weighted: 0.9 < 0.4 + 0.4 = 0.8?
    // Actually 0.9 > 0.8 → approve wins.
    expect(r.finalVerdict).toBe("approve");
  });

  it("3-of-5 quorum honoured", () => {
    const r = reconcileDebate(
      [
        prop("a", "approve"), prop("b", "approve"), prop("c", "approve"),
        prop("d", "reject"),  prop("e", "reject"),
      ],
      { quorum: "council_3_of_5", safetyVeto: true },
    );
    expect(r.finalVerdict).toBe("approve");
    expect(r.consensus).toBe("quorum_approve");
    expect(r.dissenters.length).toBe(2);
  });

  it("no quorum + escalate present → escalate", () => {
    const r = reconcileDebate([
      prop("a", "approve"),
      prop("b", "escalate"),
      prop("c", "needs_more_info"),
    ]);
    expect(r.consensus).toBe("dissent");
    expect(r.finalVerdict).toBe("escalate");
  });

  it("verdictCounts reflect all proposals", () => {
    const r = reconcileDebate([
      prop("a", "approve"),
      prop("b", "approve"),
      prop("c", "reject"),
      prop("d", "needs_more_info"),
    ]);
    expect(r.verdictCounts.approve).toBe(2);
    expect(r.verdictCounts.reject).toBe(1);
    expect(r.verdictCounts.needs_more_info).toBe(1);
    expect(r.verdictCounts.escalate).toBe(0);
  });

  it("weightedConfidence reflects winning side's avg", () => {
    const r = reconcileDebate([
      prop("a", "approve", "reasoning", 0.9),
      prop("b", "approve", "reasoning", 0.8),
      prop("c", "reject",  "reasoning", 0.5),
    ]);
    expect(r.weightedConfidence).toBeCloseTo(0.85, 2);
  });

  it("safety veto narrative names the dissenting safety agent", () => {
    const r = reconcileDebate([
      prop("a", "approve"),
      prop("b", "reject", "safety"),
    ]);
    expect(r.narrative).toContain("b");
  });
});
