import { describe, it, expect } from "vitest";
import {
  compareEvalRuns,
  type EvalRunSnapshot,
  type EvalCaseSnapshot,
} from "../compareEvalRuns";

function caseSnap(
  taskKey: string,
  outcome: EvalCaseSnapshot["outcome"],
  score: number,
  costCents?: number,
): EvalCaseSnapshot {
  return { taskKey, outcome, score, costCents };
}

function runSnap(cases: EvalCaseSnapshot[]): EvalRunSnapshot {
  const passCount = cases.filter((c) => c.outcome === "pass").length;
  const failCount = cases.filter((c) => c.outcome === "fail").length;
  const skippedCount = cases.filter((c) => c.outcome === "skipped").length;
  const totalCostCents = cases.reduce((acc, c) => acc + (c.costCents ?? 0), 0);
  return {
    runId: `run_${Math.random().toString(36).slice(2, 8)}`,
    startedAt: new Date(),
    passCount,
    failCount,
    skippedCount,
    totalCases: cases.length,
    totalCostCents,
    cases,
  };
}

describe("compareEvalRuns — first-ever run", () => {
  it("returns clean when previous is null", () => {
    const r = compareEvalRuns(null, runSnap([caseSnap("a", "pass", 1)]));
    expect(r.clean).toBe(true);
    expect(r.regressions).toEqual([]);
    expect(r.improvements).toEqual([]);
    expect(r.counts.regressionCount).toBe(0);
  });
});

describe("compareEvalRuns — per-task regressions", () => {
  it("flags pass → fail as new_failure", () => {
    const prev = runSnap([caseSnap("trivial_typo", "pass", 1)]);
    const curr = runSnap([caseSnap("trivial_typo", "fail", 0.2)]);
    const r = compareEvalRuns(prev, curr);
    expect(r.regressions.some((rg) => rg.kind === "new_failure")).toBe(true);
    expect(r.clean).toBe(false);
    expect(r.counts.newFailures).toBe(1);
  });

  it("flags pass → errored as new_error", () => {
    const prev = runSnap([caseSnap("typo", "pass", 1)]);
    const curr = runSnap([caseSnap("typo", "errored", 0)]);
    const r = compareEvalRuns(prev, curr);
    expect(r.regressions.some((rg) => rg.kind === "new_error")).toBe(true);
    expect(r.counts.newErrors).toBe(1);
  });

  it("flags score drop above threshold", () => {
    const prev = runSnap([caseSnap("x", "pass", 0.9)]);
    const curr = runSnap([caseSnap("x", "pass", 0.7)]); // delta = -0.2, > 0.1
    const r = compareEvalRuns(prev, curr);
    expect(r.regressions.some((rg) => rg.kind === "score_drop")).toBe(true);
    expect(r.counts.scoreDrops).toBe(1);
  });

  it("does NOT flag score drop below threshold", () => {
    const prev = runSnap([caseSnap("x", "pass", 0.9)]);
    const curr = runSnap([caseSnap("x", "pass", 0.85)]); // delta = -0.05, < 0.1
    const r = compareEvalRuns(prev, curr);
    expect(r.regressions.some((rg) => rg.kind === "score_drop")).toBe(false);
  });

  it("flags per-task cost increase above threshold", () => {
    const prev = runSnap([caseSnap("x", "pass", 1, 50)]);
    const curr = runSnap([caseSnap("x", "pass", 1, 200)]); // +150 > 100
    const r = compareEvalRuns(prev, curr);
    expect(r.regressions.some((rg) => rg.kind === "cost_increase")).toBe(true);
  });

  it("respects custom thresholds", () => {
    const prev = runSnap([caseSnap("x", "pass", 0.9)]);
    const curr = runSnap([caseSnap("x", "pass", 0.85)]);
    const r = compareEvalRuns(prev, curr, { scoreDropThreshold: 0.04 });
    expect(r.regressions.some((rg) => rg.kind === "score_drop")).toBe(true);
  });
});

describe("compareEvalRuns — run-level regressions", () => {
  it("flags pass-rate drop", () => {
    const prev = runSnap([
      caseSnap("a", "pass", 1), caseSnap("b", "pass", 1),
      caseSnap("c", "pass", 1), caseSnap("d", "pass", 1),
      caseSnap("e", "fail", 0),
    ]); // pass rate 4/5 = 0.8
    const curr = runSnap([
      caseSnap("a", "pass", 1), caseSnap("b", "fail", 0),
      caseSnap("c", "fail", 0), caseSnap("d", "fail", 0),
      caseSnap("e", "fail", 0),
    ]); // pass rate 1/5 = 0.2
    const r = compareEvalRuns(prev, curr);
    expect(r.regressions.some((rg) => rg.kind === "run_pass_rate_drop")).toBe(true);
  });

  it("flags run-cost increase above ratio", () => {
    const prev = runSnap([caseSnap("a", "pass", 1, 100)]);
    const curr = runSnap([caseSnap("a", "pass", 1, 200)]); // 2x prev
    const r = compareEvalRuns(prev, curr);
    expect(r.regressions.some((rg) => rg.kind === "run_cost_increase")).toBe(true);
  });

  it("does NOT divide by zero when previous run had zero cost", () => {
    const prev = runSnap([caseSnap("a", "skipped", 0, 0)]);
    const curr = runSnap([caseSnap("a", "pass", 1, 50)]);
    const r = compareEvalRuns(prev, curr);
    // Should not have any run_cost_increase finding — previous was 0¢.
    expect(r.regressions.some((rg) => rg.kind === "run_cost_increase")).toBe(false);
  });

  it("flags corpus shrinkage", () => {
    const prev = runSnap([
      caseSnap("a", "pass", 1), caseSnap("b", "pass", 1), caseSnap("c", "pass", 1),
    ]);
    const curr = runSnap([caseSnap("a", "pass", 1)]); // 1 < 3
    const r = compareEvalRuns(prev, curr);
    expect(r.regressions.some((rg) => rg.kind === "corpus_shrunk")).toBe(true);
  });
});

describe("compareEvalRuns — improvements", () => {
  it("flags new_pass when fail → pass", () => {
    const prev = runSnap([caseSnap("x", "fail", 0.3)]);
    const curr = runSnap([caseSnap("x", "pass", 1)]);
    const r = compareEvalRuns(prev, curr);
    expect(r.improvements.some((im) => im.kind === "new_pass")).toBe(true);
  });

  it("flags score rise above threshold", () => {
    const prev = runSnap([caseSnap("x", "pass", 0.6)]);
    const curr = runSnap([caseSnap("x", "pass", 0.95)]); // +0.35
    const r = compareEvalRuns(prev, curr);
    expect(r.improvements.some((im) => im.kind === "score_rise")).toBe(true);
  });

  it("flags pass-rate rise", () => {
    const prev = runSnap([
      caseSnap("a", "fail", 0), caseSnap("b", "fail", 0),
      caseSnap("c", "pass", 1),
    ]);
    const curr = runSnap([
      caseSnap("a", "pass", 1), caseSnap("b", "pass", 1),
      caseSnap("c", "pass", 1),
    ]);
    const r = compareEvalRuns(prev, curr);
    expect(r.improvements.some((im) => im.kind === "run_pass_rate_rise")).toBe(true);
  });

  it("flags cost decrease per-task", () => {
    const prev = runSnap([caseSnap("x", "pass", 1, 500)]);
    const curr = runSnap([caseSnap("x", "pass", 1, 100)]); // -400 < -100
    const r = compareEvalRuns(prev, curr);
    expect(r.improvements.some((im) => im.kind === "cost_decrease")).toBe(true);
  });
});

describe("compareEvalRuns — new + missing tasks", () => {
  it("ignores brand-new tasks not present in previous", () => {
    const prev = runSnap([caseSnap("a", "pass", 1)]);
    const curr = runSnap([
      caseSnap("a", "pass", 1),
      caseSnap("b", "fail", 0), // new task
    ]);
    const r = compareEvalRuns(prev, curr);
    // 'b' wasn't in prev, so its fail should NOT count as new_failure.
    expect(r.regressions.some((rg) => "taskKey" in rg && rg.taskKey === "b")).toBe(false);
  });

  it("does not flag tasks missing from current — corpus_shrunk catches it", () => {
    const prev = runSnap([
      caseSnap("a", "pass", 1), caseSnap("b", "pass", 1),
    ]);
    const curr = runSnap([caseSnap("a", "pass", 1)]);
    const r = compareEvalRuns(prev, curr);
    const corpus = r.regressions.find((rg) => rg.kind === "corpus_shrunk");
    expect(corpus).toBeDefined();
    // No per-task entry for 'b'
    expect(r.regressions.some((rg) => "taskKey" in rg && rg.taskKey === "b")).toBe(false);
  });
});

describe("compareEvalRuns — counts", () => {
  it("counts each regression kind correctly", () => {
    const prev = runSnap([
      caseSnap("a", "pass", 1, 50),
      caseSnap("b", "pass", 1, 50),
      caseSnap("c", "pass", 1, 50),
    ]);
    const curr = runSnap([
      caseSnap("a", "fail", 0, 50),      // new_failure
      caseSnap("b", "errored", 0, 50),    // new_error
      caseSnap("c", "pass", 0.5, 200),    // score_drop + cost_increase
    ]);
    const r = compareEvalRuns(prev, curr);
    expect(r.counts.newFailures).toBe(1);
    expect(r.counts.newErrors).toBe(1);
    // Score drops are emitted independently of outcome flips so the gate
    // catches "barely passing" cases too — a, b, c all dropped, so 3.
    expect(r.counts.scoreDrops).toBe(3);
    expect(r.counts.costIncreases).toBeGreaterThanOrEqual(1);
    expect(r.clean).toBe(false);
  });
});
