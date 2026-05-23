/**
 * Pure eval-run comparator — Phase 393.
 *
 * Takes a (previous, current) pair of EvalRun snapshots and returns
 * a closed-union diff of every regression and improvement. Used by
 * the release-gate to refuse deploys when quality has degraded and
 * by the admin trend view to surface "this is what changed last
 * night."
 *
 * Closed-union RegressionKind so the UI + audit can render specific
 * badges per regression class:
 *
 *   - new_failure              — task previously passed, now fails
 *   - new_error                — task previously did not error, now errors
 *   - score_drop               — task score fell below configured delta
 *   - cost_increase            — single task cost grew > configured delta
 *   - run_cost_increase        — total run cost grew > configured ratio
 *   - run_pass_rate_drop       — overall pass-rate fell below configured delta
 *   - corpus_shrunk            — current run has fewer tasks than previous
 *
 * Symmetric improvement kinds are tracked too (`new_pass`, `score_rise`,
 * `cost_decrease`, `run_pass_rate_rise`) so the gate can distinguish
 * "stable but cheaper" from "regressed" — operators see both columns
 * in the admin trend page.
 *
 * Pure — no Prisma, no I/O.
 */

export type RegressionKind =
  | "new_failure"
  | "new_error"
  | "score_drop"
  | "cost_increase"
  | "run_cost_increase"
  | "run_pass_rate_drop"
  | "corpus_shrunk";

export type ImprovementKind =
  | "new_pass"
  | "score_rise"
  | "cost_decrease"
  | "run_pass_rate_rise";

export interface PerTaskDelta {
  taskKey: string;
  kind: RegressionKind | ImprovementKind;
  previous: {
    outcome: "pass" | "fail" | "errored" | "skipped";
    score: number;
    costCents?: number;
  } | null;
  current: {
    outcome: "pass" | "fail" | "errored" | "skipped";
    score: number;
    costCents?: number;
  } | null;
  delta: number;
  message: string;
}

export interface RunLevelDelta {
  kind: RegressionKind | ImprovementKind;
  previous: number;
  current: number;
  delta: number;
  message: string;
}

export interface CompareEvalRunsResult {
  /** Closed-union regressions for the release gate. */
  regressions: ReadonlyArray<PerTaskDelta | RunLevelDelta>;
  /** Symmetric improvements — informational only. */
  improvements: ReadonlyArray<PerTaskDelta | RunLevelDelta>;
  /** True when zero regressions found. */
  clean: boolean;
  /** Summary counts for the audit blob. */
  counts: {
    regressionCount: number;
    improvementCount: number;
    newFailures: number;
    newErrors: number;
    scoreDrops: number;
    costIncreases: number;
  };
}

export interface EvalCaseSnapshot {
  taskKey: string;
  outcome: "pass" | "fail" | "errored" | "skipped";
  score: number;
  /** Cost is per-case for the propose stage; optional because older runs may not have it. */
  costCents?: number;
}

export interface EvalRunSnapshot {
  runId: string;
  startedAt: Date;
  passCount: number;
  failCount: number;
  skippedCount: number;
  totalCases: number;
  totalCostCents: number;
  cases: ReadonlyArray<EvalCaseSnapshot>;
}

export interface CompareEvalRunsOptions {
  /** Per-task score regression threshold (default: 0.1 = 10 pts). */
  scoreDropThreshold?: number;
  /** Per-task cost increase threshold in cents (default: 100). */
  costIncreaseCentsThreshold?: number;
  /** Run-level cost ratio (default: 1.5 = 50% growth flags). */
  runCostRatioThreshold?: number;
  /** Run-level pass-rate drop in absolute pts (default: 0.1 = 10 pts). */
  runPassRateDropThreshold?: number;
}

const DEFAULT_OPTS: Required<CompareEvalRunsOptions> = {
  scoreDropThreshold: 0.1,
  costIncreaseCentsThreshold: 100,
  runCostRatioThreshold: 1.5,
  runPassRateDropThreshold: 0.1,
};

function passRate(run: EvalRunSnapshot): number {
  const scoreable = run.passCount + run.failCount;
  if (scoreable === 0) return 0;
  return run.passCount / scoreable;
}

/**
 * Compare two EvalRun snapshots and return a closed-union diff.
 *
 * @param previous Older run (may be null if this is the first run ever).
 * @param current  Latest run.
 * @param options  Per-threshold overrides (see CompareEvalRunsOptions).
 */
export function compareEvalRuns(
  previous: EvalRunSnapshot | null,
  current: EvalRunSnapshot,
  options: CompareEvalRunsOptions = {},
): CompareEvalRunsResult {
  const opts = { ...DEFAULT_OPTS, ...options };

  const regressions: Array<PerTaskDelta | RunLevelDelta> = [];
  const improvements: Array<PerTaskDelta | RunLevelDelta> = [];

  // First-ever run has nothing to compare against — return a clean
  // snapshot so the gate doesn't fire on day 1.
  if (previous === null) {
    return {
      regressions: [],
      improvements: [],
      clean: true,
      counts: {
        regressionCount: 0,
        improvementCount: 0,
        newFailures: 0,
        newErrors: 0,
        scoreDrops: 0,
        costIncreases: 0,
      },
    };
  }

  // -------- run-level deltas --------
  const prevPassRate = passRate(previous);
  const currPassRate = passRate(current);
  const passRateDelta = currPassRate - prevPassRate;
  if (passRateDelta <= -opts.runPassRateDropThreshold) {
    regressions.push({
      kind: "run_pass_rate_drop",
      previous: prevPassRate,
      current: currPassRate,
      delta: passRateDelta,
      message: `Pass rate dropped ${(prevPassRate * 100).toFixed(1)}% → ${(currPassRate * 100).toFixed(1)}%.`,
    });
  } else if (passRateDelta >= opts.runPassRateDropThreshold) {
    improvements.push({
      kind: "run_pass_rate_rise",
      previous: prevPassRate,
      current: currPassRate,
      delta: passRateDelta,
      message: `Pass rate rose ${(prevPassRate * 100).toFixed(1)}% → ${(currPassRate * 100).toFixed(1)}%.`,
    });
  }

  // Run-cost guard — only fires when previous was nonzero (avoids
  // divide-by-zero noise when the first run was fully skipped).
  if (previous.totalCostCents > 0) {
    const ratio = current.totalCostCents / previous.totalCostCents;
    if (ratio >= opts.runCostRatioThreshold) {
      regressions.push({
        kind: "run_cost_increase",
        previous: previous.totalCostCents,
        current: current.totalCostCents,
        delta: current.totalCostCents - previous.totalCostCents,
        message: `Total run cost grew ${previous.totalCostCents}¢ → ${current.totalCostCents}¢ (×${ratio.toFixed(2)}).`,
      });
    } else if (ratio <= 1 / opts.runCostRatioThreshold) {
      improvements.push({
        kind: "cost_decrease",
        previous: previous.totalCostCents,
        current: current.totalCostCents,
        delta: current.totalCostCents - previous.totalCostCents,
        message: `Total run cost dropped ${previous.totalCostCents}¢ → ${current.totalCostCents}¢.`,
      });
    }
  }

  // Corpus shrinkage — if today's run has fewer tasks than yesterday,
  // that's suspect (someone might have silently deleted a hard task).
  if (current.totalCases < previous.totalCases) {
    regressions.push({
      kind: "corpus_shrunk",
      previous: previous.totalCases,
      current: current.totalCases,
      delta: current.totalCases - previous.totalCases,
      message: `Corpus shrunk: ${previous.totalCases} → ${current.totalCases} task(s).`,
    });
  }

  // -------- per-task deltas --------
  const prevByKey = new Map<string, EvalCaseSnapshot>();
  for (const c of previous.cases) prevByKey.set(c.taskKey, c);

  for (const curr of current.cases) {
    const prev = prevByKey.get(curr.taskKey);
    if (!prev) continue; // new tasks aren't regressions

    // 1. pass → fail
    if (prev.outcome === "pass" && curr.outcome === "fail") {
      regressions.push({
        taskKey: curr.taskKey,
        kind: "new_failure",
        previous: prev,
        current: curr,
        delta: curr.score - prev.score,
        message: `${curr.taskKey}: previously passed (${prev.score.toFixed(2)}), now fails (${curr.score.toFixed(2)}).`,
      });
    }
    // 2. → errored (any non-errored prior)
    if (prev.outcome !== "errored" && curr.outcome === "errored") {
      regressions.push({
        taskKey: curr.taskKey,
        kind: "new_error",
        previous: prev,
        current: curr,
        delta: curr.score - prev.score,
        message: `${curr.taskKey}: now errors (prev outcome was ${prev.outcome}).`,
      });
    }
    // 3. score drop above threshold (independent of outcome flip — captures
    //    a task that's still "passing" but barely)
    const scoreDelta = curr.score - prev.score;
    if (scoreDelta <= -opts.scoreDropThreshold) {
      regressions.push({
        taskKey: curr.taskKey,
        kind: "score_drop",
        previous: prev,
        current: curr,
        delta: scoreDelta,
        message: `${curr.taskKey}: score dropped ${prev.score.toFixed(2)} → ${curr.score.toFixed(2)} (−${Math.abs(scoreDelta).toFixed(2)}).`,
      });
    }
    // 4. fail → pass (improvement)
    if (prev.outcome !== "pass" && curr.outcome === "pass") {
      improvements.push({
        taskKey: curr.taskKey,
        kind: "new_pass",
        previous: prev,
        current: curr,
        delta: scoreDelta,
        message: `${curr.taskKey}: now passes (prev outcome was ${prev.outcome}).`,
      });
    } else if (scoreDelta >= opts.scoreDropThreshold) {
      improvements.push({
        taskKey: curr.taskKey,
        kind: "score_rise",
        previous: prev,
        current: curr,
        delta: scoreDelta,
        message: `${curr.taskKey}: score rose ${prev.score.toFixed(2)} → ${curr.score.toFixed(2)} (+${scoreDelta.toFixed(2)}).`,
      });
    }
    // 5. per-task cost regression (only when both runs report a cost)
    if (typeof prev.costCents === "number" && typeof curr.costCents === "number") {
      const costDelta = curr.costCents - prev.costCents;
      if (costDelta >= opts.costIncreaseCentsThreshold) {
        regressions.push({
          taskKey: curr.taskKey,
          kind: "cost_increase",
          previous: prev,
          current: curr,
          delta: costDelta,
          message: `${curr.taskKey}: cost grew ${prev.costCents}¢ → ${curr.costCents}¢ (+${costDelta}¢).`,
        });
      } else if (costDelta <= -opts.costIncreaseCentsThreshold) {
        improvements.push({
          taskKey: curr.taskKey,
          kind: "cost_decrease",
          previous: prev,
          current: curr,
          delta: costDelta,
          message: `${curr.taskKey}: cost dropped ${prev.costCents}¢ → ${curr.costCents}¢.`,
        });
      }
    }
  }

  const counts = {
    regressionCount: regressions.length,
    improvementCount: improvements.length,
    newFailures: regressions.filter((r) => r.kind === "new_failure").length,
    newErrors: regressions.filter((r) => r.kind === "new_error").length,
    scoreDrops: regressions.filter((r) => r.kind === "score_drop").length,
    costIncreases: regressions.filter((r) => r.kind === "cost_increase" || r.kind === "run_cost_increase").length,
  };

  return {
    regressions,
    improvements,
    clean: regressions.length === 0,
    counts,
  };
}
