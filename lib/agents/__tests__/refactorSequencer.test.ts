import { describe, it, expect } from "vitest";
import { sequenceRefactor, summarize, type RefactorStep } from "../refactorSequencer";

const STEP = (partial: Partial<RefactorStep> & { id: string }): RefactorStep => {
  const { id, ...overrides } = partial;
  return {
    kind: "behavior_neutral",
    touches: [],
    dependsOn: [],
    coveredBy: [],
    preservesBehavior: true,
    ...overrides,
    id,
    rationale: partial.rationale ?? id,
  };
};

describe("refactorSequencer", () => {
  it("empty input → empty sequence", () => {
    const r = sequenceRefactor([]);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.steps).toEqual([]);
  });

  it("orders by dependency — A depended-on by B comes first", () => {
    const r = sequenceRefactor([
      STEP({ id: "B", dependsOn: ["A"] }),
      STEP({ id: "A" }),
    ]);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.steps.map((s) => s.step.id)).toEqual(["A", "B"]);
      expect(r.steps[1].orderingReason).toMatch(/A/);
    }
  });

  it("breaks ties alphabetically among ready steps", () => {
    const r = sequenceRefactor([STEP({ id: "Z" }), STEP({ id: "A" })]);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.steps.map((s) => s.step.id)).toEqual(["A", "Z"]);
  });

  it("detects a cycle", () => {
    const r = sequenceRefactor([
      STEP({ id: "A", dependsOn: ["B"] }),
      STEP({ id: "B", dependsOn: ["A"] }),
    ]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe("cycle");
  });

  it("detects an unknown dependency", () => {
    const r = sequenceRefactor([STEP({ id: "A", dependsOn: ["ghost"] })]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe("unknown_dependency");
  });

  it("verdict: behavior_neutral with tests → safe", () => {
    const r = sequenceRefactor([STEP({ id: "A", coveredBy: ["a.test.ts"] })]);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.steps[0].verdict).toBe("safe");
  });

  it("verdict: behavior_neutral without tests → needs_test", () => {
    const r = sequenceRefactor([STEP({ id: "A" })]);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.steps[0].verdict).toBe("needs_test");
  });

  it("verdict: behavior_changing without tests → blocked", () => {
    const r = sequenceRefactor([
      STEP({ id: "A", kind: "behavior_changing", preservesBehavior: false }),
    ]);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.steps[0].verdict).toBe("blocked");
  });

  it("verdict: behavior_changing with tests → needs_review", () => {
    const r = sequenceRefactor([
      STEP({ id: "A", kind: "behavior_changing", preservesBehavior: false, coveredBy: ["a.test.ts"] }),
    ]);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.steps[0].verdict).toBe("needs_review");
  });

  it("rollback story differs by step kind", () => {
    const r = sequenceRefactor([
      STEP({ id: "ren", kind: "rename" }),
      STEP({ id: "mv",  kind: "move" }),
    ]);
    expect(r.ok).toBe(true);
    if (r.ok) {
      const ren = r.steps.find((s) => s.step.id === "ren");
      const mv  = r.steps.find((s) => s.step.id === "mv");
      expect(ren?.rollback).toMatch(/codemod/);
      expect(mv?.rollback).toMatch(/import-fix/);
    }
  });

  it("summarize counts verdicts across the sequence", () => {
    const r = sequenceRefactor([
      STEP({ id: "a", coveredBy: ["a.t"] }),                              // safe
      STEP({ id: "b" }),                                                  // needs_test
      STEP({ id: "c", kind: "behavior_changing", preservesBehavior: false, coveredBy: ["c.t"] }), // needs_review
      STEP({ id: "d", kind: "behavior_changing", preservesBehavior: false }), // blocked
    ]);
    expect(r.ok).toBe(true);
    if (r.ok) {
      const sum = summarize(r.steps);
      expect(sum.safe).toBe(1);
      expect(sum.needsTest).toBe(1);
      expect(sum.needsReview).toBe(1);
      expect(sum.blocked).toBe(1);
      expect(sum.totalSteps).toBe(4);
    }
  });
});
