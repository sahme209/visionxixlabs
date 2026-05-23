import { describe, it, expect } from "vitest";
import { assertEvalReleaseHealthy } from "../assertEvalReleaseHealthy";
import type { EvalRunSnapshot, EvalCaseSnapshot, CompareEvalRunsResult } from "../compareEvalRuns";

function caseSnap(
  taskKey: string,
  outcome: EvalCaseSnapshot["outcome"],
  score: number,
): EvalCaseSnapshot {
  return { taskKey, outcome, score };
}

function runSnap(cases: EvalCaseSnapshot[]): EvalRunSnapshot {
  return {
    runId: "r",
    startedAt: new Date(),
    passCount: cases.filter((c) => c.outcome === "pass").length,
    failCount: cases.filter((c) => c.outcome === "fail").length,
    skippedCount: cases.filter((c) => c.outcome === "skipped").length,
    totalCases: cases.length,
    totalCostCents: 0,
    cases,
  };
}

const cleanDiff: CompareEvalRunsResult = {
  regressions: [],
  improvements: [],
  clean: true,
  counts: { regressionCount: 0, improvementCount: 0, newFailures: 0, newErrors: 0, scoreDrops: 0, costIncreases: 0 },
};

describe("assertEvalReleaseHealthy — passing", () => {
  it("passes when all checks clean", () => {
    const current = runSnap([
      caseSnap("a", "pass", 1), caseSnap("b", "pass", 1), caseSnap("c", "pass", 0.9),
    ]);
    const g = assertEvalReleaseHealthy({ current, diff: cleanDiff, runStatus: "completed" });
    expect(g.passed).toBe(true);
    expect(g.blockers).toEqual([]);
    expect(g.summary).toContain("passed");
  });
});

describe("assertEvalReleaseHealthy — absolute health", () => {
  it("blocks when pass rate below floor", () => {
    const current = runSnap([
      caseSnap("a", "pass", 1), caseSnap("b", "fail", 0), caseSnap("c", "fail", 0),
    ]); // 1/3 = 33%
    const g = assertEvalReleaseHealthy({ current, diff: cleanDiff, runStatus: "completed" });
    expect(g.passed).toBe(false);
    expect(g.blockers.some((b) => b.kind === "pass_rate_below_floor")).toBe(true);
  });

  it("blocks when average score below floor", () => {
    const current = runSnap([
      caseSnap("a", "pass", 0.5), caseSnap("b", "pass", 0.5), caseSnap("c", "pass", 0.5),
    ]); // 100% pass rate but avg score 0.5 < 0.6
    const g = assertEvalReleaseHealthy({ current, diff: cleanDiff, runStatus: "completed" });
    expect(g.passed).toBe(false);
    expect(g.blockers.some((b) => b.kind === "average_score_below_floor")).toBe(true);
  });

  it("blocks when too many errored cases", () => {
    const current = runSnap([
      caseSnap("a", "pass", 1), caseSnap("b", "errored", 0), caseSnap("c", "errored", 0),
    ]); // 2 errored > default 1
    const g = assertEvalReleaseHealthy({ current, diff: cleanDiff, runStatus: "completed" });
    expect(g.blockers.some((b) => b.kind === "too_many_errored_cases")).toBe(true);
  });

  it("blocks when run did not complete", () => {
    const current = runSnap([caseSnap("a", "pass", 1)]);
    const g = assertEvalReleaseHealthy({ current, diff: cleanDiff, runStatus: "failed" });
    expect(g.blockers.some((b) => b.kind === "run_did_not_complete")).toBe(true);
  });

  it("ignores skipped cases when computing average score", () => {
    const current = runSnap([
      caseSnap("a", "pass", 1), caseSnap("b", "pass", 1),
      caseSnap("c", "skipped", 0), caseSnap("d", "skipped", 0),
    ]);
    const g = assertEvalReleaseHealthy({ current, diff: cleanDiff, runStatus: "completed" });
    expect(g.averageScore).toBe(1);
    expect(g.passed).toBe(true);
  });
});

describe("assertEvalReleaseHealthy — relative health", () => {
  it("blocks on new failures vs previous run", () => {
    const current = runSnap([caseSnap("a", "pass", 1), caseSnap("b", "fail", 0)]);
    const diff: CompareEvalRunsResult = {
      ...cleanDiff,
      counts: { ...cleanDiff.counts, newFailures: 1 },
      clean: false,
    };
    const g = assertEvalReleaseHealthy({ current, diff, runStatus: "completed" });
    expect(g.blockers.some((b) => b.kind === "new_failures_above_max")).toBe(true);
  });

  it("blocks on new errors vs previous run", () => {
    const current = runSnap([caseSnap("a", "pass", 1)]);
    const diff: CompareEvalRunsResult = {
      ...cleanDiff,
      counts: { ...cleanDiff.counts, newErrors: 1 },
      clean: false,
    };
    const g = assertEvalReleaseHealthy({ current, diff, runStatus: "completed" });
    expect(g.blockers.some((b) => b.kind === "new_errors_above_max")).toBe(true);
  });

  it("blocks on excessive score drops", () => {
    const current = runSnap([
      caseSnap("a", "pass", 1), caseSnap("b", "pass", 1), caseSnap("c", "pass", 1),
    ]);
    const diff: CompareEvalRunsResult = {
      ...cleanDiff,
      counts: { ...cleanDiff.counts, scoreDrops: 5 },
      clean: false,
    };
    const g = assertEvalReleaseHealthy({ current, diff, runStatus: "completed" });
    expect(g.blockers.some((b) => b.kind === "score_drops_above_max")).toBe(true);
  });

  it("blocks on corpus shrinkage by default", () => {
    const current = runSnap([caseSnap("a", "pass", 1)]);
    const diff: CompareEvalRunsResult = {
      ...cleanDiff,
      regressions: [{
        kind: "corpus_shrunk",
        previous: 5,
        current: 1,
        delta: -4,
        message: "Corpus shrunk: 5 → 1 task(s).",
      }],
      clean: false,
    };
    const g = assertEvalReleaseHealthy({ current, diff, runStatus: "completed" });
    expect(g.blockers.some((b) => b.kind === "corpus_shrunk")).toBe(true);
  });

  it("downgrades corpus shrinkage when allowCorpusShrink=true", () => {
    const current = runSnap([caseSnap("a", "pass", 1)]);
    const diff: CompareEvalRunsResult = {
      ...cleanDiff,
      regressions: [{
        kind: "corpus_shrunk",
        previous: 5,
        current: 1,
        delta: -4,
        message: "Corpus shrunk: 5 → 1 task(s).",
      }],
      clean: false,
    };
    const g = assertEvalReleaseHealthy({
      current, diff, runStatus: "completed",
      thresholds: { allowCorpusShrink: true },
    });
    expect(g.blockers.some((b) => b.kind === "corpus_shrunk")).toBe(false);
  });
});

describe("assertEvalReleaseHealthy — threshold overrides", () => {
  it("relaxes pass-rate floor when override provided", () => {
    const current = runSnap([
      caseSnap("a", "pass", 1), caseSnap("b", "fail", 0), caseSnap("c", "pass", 1),
    ]); // 2/3 = 66.7%
    // default min is 0.7 — would block. Override to 0.6 — passes.
    const g = assertEvalReleaseHealthy({
      current, diff: cleanDiff, runStatus: "completed",
      thresholds: { minPassRate: 0.6 },
    });
    expect(g.passed).toBe(true);
  });

  it("disables completion requirement when requireRunCompleted=false", () => {
    const current = runSnap([caseSnap("a", "pass", 1)]);
    const g = assertEvalReleaseHealthy({
      current, diff: cleanDiff, runStatus: "running",
      thresholds: { requireRunCompleted: false },
    });
    expect(g.blockers.some((b) => b.kind === "run_did_not_complete")).toBe(false);
  });
});

describe("assertEvalReleaseHealthy — summary string", () => {
  it("names blockers in failure summary", () => {
    const current = runSnap([caseSnap("a", "fail", 0), caseSnap("b", "fail", 0)]);
    const diff: CompareEvalRunsResult = {
      ...cleanDiff,
      counts: { ...cleanDiff.counts, newFailures: 2 },
      clean: false,
    };
    const g = assertEvalReleaseHealthy({ current, diff, runStatus: "completed" });
    expect(g.summary).toContain("blocked");
    expect(g.summary).toContain("new_failures_above_max");
  });
});
