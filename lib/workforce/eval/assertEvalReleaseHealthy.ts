/**
 * Pure release-gate kernel — Phase 393.
 *
 * Takes a (latest EvalRun, regression-diff) pair and decides whether
 * the platform is healthy enough to deploy. Returns a closed-union
 * GateDecision with the specific reason(s) the gate fired so the CI
 * + admin UI can render exactly what blocked release.
 *
 * Two layers of checks:
 *
 *  1. Absolute health — the latest run on its own:
 *     - pass-rate must be ≥ minPassRate
 *     - score average must be ≥ minAverageScore
 *     - errored count must be ≤ maxErroredCases
 *     - run status must be "completed" (not "failed" mid-run)
 *
 *  2. Relative health — vs. the previous run:
 *     - new failures must be ≤ maxNewFailures
 *     - new errors must be ≤ maxNewErrors
 *     - score-drop count must be ≤ maxScoreDrops
 *     - corpus must not have shrunk
 *
 * Defaults are intentionally strict for `cron_daily` — a release that
 * regresses one test is one that shouldn't ship. CI smoke runs can
 * relax thresholds via the options override.
 *
 * Pure — no Prisma, no I/O.
 */

import type { CompareEvalRunsResult, EvalRunSnapshot } from "./compareEvalRuns";

export type GateBlockerKind =
  | "pass_rate_below_floor"
  | "average_score_below_floor"
  | "too_many_errored_cases"
  | "run_did_not_complete"
  | "new_failures_above_max"
  | "new_errors_above_max"
  | "score_drops_above_max"
  | "corpus_shrunk";

export interface GateBlocker {
  kind: GateBlockerKind;
  message: string;
  observed: number;
  threshold: number;
}

export interface GateDecision {
  /** True iff the release is allowed. */
  passed: boolean;
  /** Closed-union list of every reason the gate blocked. */
  blockers: ReadonlyArray<GateBlocker>;
  /** Latest pass rate, 0..1. */
  passRate: number;
  /** Latest average score (across non-skipped cases), 0..1. */
  averageScore: number;
  /** Summary string for audit + CI logs. */
  summary: string;
}

export interface GateThresholds {
  minPassRate?: number;
  minAverageScore?: number;
  maxErroredCases?: number;
  maxNewFailures?: number;
  maxNewErrors?: number;
  maxScoreDrops?: number;
  /** When true, a corpus_shrunk regression is downgraded to a warning (admin manually deleted a task). */
  allowCorpusShrink?: boolean;
  /** When true, an incomplete run still blocks the gate. */
  requireRunCompleted?: boolean;
}

const DEFAULT_THRESHOLDS: Required<GateThresholds> = {
  minPassRate: 0.7,
  minAverageScore: 0.6,
  maxErroredCases: 1,
  maxNewFailures: 0,
  maxNewErrors: 0,
  maxScoreDrops: 1,
  allowCorpusShrink: false,
  requireRunCompleted: true,
};

function passRate(run: EvalRunSnapshot): number {
  const scoreable = run.passCount + run.failCount;
  if (scoreable === 0) return 0;
  return run.passCount / scoreable;
}

function averageScore(run: EvalRunSnapshot): number {
  const nonSkipped = run.cases.filter((c) => c.outcome !== "skipped");
  if (nonSkipped.length === 0) return 0;
  const sum = nonSkipped.reduce((acc, c) => acc + c.score, 0);
  return sum / nonSkipped.length;
}

function erroredCount(run: EvalRunSnapshot): number {
  return run.cases.filter((c) => c.outcome === "errored").length;
}

export interface AssertGateInput {
  current: EvalRunSnapshot;
  /** Output of compareEvalRuns(previous, current). */
  diff: CompareEvalRunsResult;
  /** Run status from EvalRun.status — "completed" | "failed" | "running" | "pending". */
  runStatus: string;
  thresholds?: GateThresholds;
}

export function assertEvalReleaseHealthy(input: AssertGateInput): GateDecision {
  const t = { ...DEFAULT_THRESHOLDS, ...(input.thresholds ?? {}) };
  const blockers: GateBlocker[] = [];

  const rate = passRate(input.current);
  const avg = averageScore(input.current);
  const errored = erroredCount(input.current);

  // -------- absolute health --------
  if (t.requireRunCompleted && input.runStatus !== "completed") {
    blockers.push({
      kind: "run_did_not_complete",
      message: `Eval run did not complete (status: ${input.runStatus}).`,
      observed: 0,
      threshold: 0,
    });
  }

  if (rate < t.minPassRate) {
    blockers.push({
      kind: "pass_rate_below_floor",
      message: `Pass rate ${(rate * 100).toFixed(1)}% is below floor ${(t.minPassRate * 100).toFixed(1)}%.`,
      observed: rate,
      threshold: t.minPassRate,
    });
  }

  if (avg < t.minAverageScore) {
    blockers.push({
      kind: "average_score_below_floor",
      message: `Average score ${avg.toFixed(2)} is below floor ${t.minAverageScore.toFixed(2)}.`,
      observed: avg,
      threshold: t.minAverageScore,
    });
  }

  if (errored > t.maxErroredCases) {
    blockers.push({
      kind: "too_many_errored_cases",
      message: `${errored} case(s) errored; max allowed ${t.maxErroredCases}.`,
      observed: errored,
      threshold: t.maxErroredCases,
    });
  }

  // -------- relative health (vs. previous run) --------
  if (input.diff.counts.newFailures > t.maxNewFailures) {
    blockers.push({
      kind: "new_failures_above_max",
      message: `${input.diff.counts.newFailures} new failure(s) vs. previous run; max allowed ${t.maxNewFailures}.`,
      observed: input.diff.counts.newFailures,
      threshold: t.maxNewFailures,
    });
  }

  if (input.diff.counts.newErrors > t.maxNewErrors) {
    blockers.push({
      kind: "new_errors_above_max",
      message: `${input.diff.counts.newErrors} new error(s) vs. previous run; max allowed ${t.maxNewErrors}.`,
      observed: input.diff.counts.newErrors,
      threshold: t.maxNewErrors,
    });
  }

  if (input.diff.counts.scoreDrops > t.maxScoreDrops) {
    blockers.push({
      kind: "score_drops_above_max",
      message: `${input.diff.counts.scoreDrops} task(s) saw score drops; max allowed ${t.maxScoreDrops}.`,
      observed: input.diff.counts.scoreDrops,
      threshold: t.maxScoreDrops,
    });
  }

  if (!t.allowCorpusShrink) {
    const shrunk = input.diff.regressions.find((r) => r.kind === "corpus_shrunk");
    if (shrunk) {
      blockers.push({
        kind: "corpus_shrunk",
        message: shrunk.message,
        observed: input.current.totalCases,
        threshold: input.current.totalCases + 1,
      });
    }
  }

  const passed = blockers.length === 0;
  const summary = passed
    ? `Release gate passed · pass rate ${(rate * 100).toFixed(1)}% · avg score ${avg.toFixed(2)} · 0 regressions.`
    : `Release gate blocked · ${blockers.length} blocker(s): ${blockers.map((b) => b.kind).join(", ")}.`;

  return {
    passed,
    blockers,
    passRate: rate,
    averageScore: avg,
    summary,
  };
}
