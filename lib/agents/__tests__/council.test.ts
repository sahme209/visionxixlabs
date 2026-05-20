/**
 * Vitest unit tests for the council consensus helper.
 *
 * Locks in: weighted vote tally, two-thirds default threshold,
 * empty-input safety, confidence clamping, dissent ordering by
 * confidence, desiredVerdict override semantics.
 */

import { describe, it, expect } from "vitest";
import { tallyCouncil, type AgentVote } from "../council";

const VOTE = (agent: string, verdict: "approve" | "reject" | "abstain", confidence: number): AgentVote => ({
  agent: agent as AgentVote["agent"],
  verdict,
  confidence,
  rationale: `${agent} says ${verdict}`,
});

describe("council consensus", () => {
  it("empty input → not passed, decision null", () => {
    const r = tallyCouncil([]);
    expect(r.passed).toBe(false);
    expect(r.decision).toBeNull();
    expect(r.totalVotes).toBe(0);
  });

  it("unanimous approve passes at default threshold", () => {
    const r = tallyCouncil([
      VOTE("reasoner", "approve", 0.9),
      VOTE("simulator", "approve", 0.85),
      VOTE("policy_gate", "approve", 0.8),
    ]);
    expect(r.passed).toBe(true);
    expect(r.decision).toBe("approve");
    expect(r.supportRatio).toBe(1);
    expect(r.dissent.length).toBe(0);
  });

  it("simple majority fails the default two-thirds threshold", () => {
    const r = tallyCouncil([
      VOTE("reasoner", "approve", 0.6),
      VOTE("simulator", "reject", 0.55),
    ]);
    // 0.6 / (0.6 + 0.55) ≈ 0.52 — below 0.66 threshold.
    expect(r.passed).toBe(false);
    expect(r.decision).toBe("approve");
  });

  it("two-thirds support passes the default threshold", () => {
    const r = tallyCouncil([
      VOTE("a", "approve", 1.0),
      VOTE("b", "approve", 1.0),
      VOTE("c", "reject", 1.0),
    ]);
    expect(r.passed).toBe(true);
    expect(r.decision).toBe("approve");
    expect(r.supportRatio).toBeCloseTo(2 / 3, 5);
    expect(r.dissent.length).toBe(1);
    expect(r.dissent[0].agent).toBe("c");
  });

  it("dissent is sorted by confidence descending", () => {
    // approve total 1.0 + 0.95 = 1.95 beats reject total 0.3 + 0.9 + 0.6 = 1.8.
    // Decision = approve. Dissenters = b/c/d (all reject), sorted by conf desc.
    const r = tallyCouncil([
      VOTE("a", "approve", 1.0),
      VOTE("e", "approve", 0.95),
      VOTE("b", "reject", 0.3),
      VOTE("c", "reject", 0.9),
      VOTE("d", "reject", 0.6),
    ]);
    expect(r.decision).toBe("approve");
    expect(r.dissent.map((v) => v.agent)).toEqual(["c", "d", "b"]);
  });

  it("clamps confidence outside [0, 1]", () => {
    const r = tallyCouncil([
      VOTE("a", "approve", 999), // clamped to 1
      VOTE("b", "reject", -5),   // clamped to 0
    ]);
    expect(r.supportWeight).toBe(1);
    expect(r.opposeWeight).toBe(0);
    expect(r.passed).toBe(true);
  });

  it("custom passThreshold respected", () => {
    const r = tallyCouncil([
      VOTE("a", "approve", 0.6),
      VOTE("b", "reject", 0.4),
    ], { passThreshold: 0.55 });
    // support 0.6 / 1.0 = 0.6 >= 0.55 → passed
    expect(r.passed).toBe(true);
  });

  it("desiredVerdict forces the decision label regardless of weights", () => {
    const r = tallyCouncil([
      VOTE("a", "reject", 0.9),
      VOTE("b", "reject", 0.9),
    ], { desiredVerdict: "approve" });
    expect(r.decision).toBe("approve");
    expect(r.supportWeight).toBe(0);
    expect(r.passed).toBe(false);
  });
});
