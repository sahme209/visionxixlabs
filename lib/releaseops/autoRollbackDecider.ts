/**
 * Pure auto-rollback decider.
 *
 * Decides whether a recent deploy should be ROLLED BACK based on
 * post-deploy signals. Approval-only-no-execution: this module
 * RECOMMENDS the rollback; humans approve and the runbook executes.
 *
 * Inputs are aggregate thresholds + observed values; output is a
 * structured recommendation with a reason ladder.
 */

export interface RollbackSignals {
  /** p95 latency now (ms) and before deploy (ms). */
  p95LatencyNowMs: number;
  p95LatencyBeforeMs: number;
  /** Error-rate (0..1) now and before. */
  errorRateNow: number;
  errorRateBefore: number;
  /** Saturation now (0..1) and before. */
  saturationNow: number;
  saturationBefore: number;
  /** Minutes since the deploy. */
  minutesSinceDeploy: number;
  /** Anomaly detector said today's metrics are out of band. */
  anomalyDetected: boolean;
}

export interface RollbackThresholds {
  /** Multiplier for p95 latency regression (default 1.5x). */
  p95RegressionRatio?: number;
  /** Absolute increase in error rate to trigger (default +0.02 = +2pp). */
  errorRateDeltaTrigger?: number;
  /** Saturation level to trigger (default 0.9). */
  saturationTrigger?: number;
  /** Minimum minutes after deploy before recommending rollback (default 5). */
  minMinutesAfterDeploy?: number;
}

export type RollbackVerdict =
  | "no_rollback"
  | "watch"
  | "recommend_rollback";

export interface RollbackRecommendation {
  verdict: RollbackVerdict;
  reasons: string[];
  /** Confidence in the recommendation (0..1). */
  confidence: number;
}

export function decideAutoRollback(
  signals: RollbackSignals,
  thresholds: RollbackThresholds = {},
): RollbackRecommendation {
  const p95Ratio = thresholds.p95RegressionRatio ?? 1.5;
  const errorDelta = thresholds.errorRateDeltaTrigger ?? 0.02;
  const satTrigger = thresholds.saturationTrigger ?? 0.9;
  const minMins = thresholds.minMinutesAfterDeploy ?? 5;

  const reasons: string[] = [];

  if (signals.minutesSinceDeploy < minMins) {
    return { verdict: "no_rollback", reasons: [`only ${signals.minutesSinceDeploy}m since deploy (< ${minMins}m)`], confidence: 0 };
  }

  const p95Hit = signals.p95LatencyBeforeMs > 0
    && signals.p95LatencyNowMs / signals.p95LatencyBeforeMs >= p95Ratio;
  if (p95Hit) {
    reasons.push(`p95 latency ${(signals.p95LatencyNowMs / signals.p95LatencyBeforeMs).toFixed(2)}× pre-deploy`);
  }

  const errorHit = (signals.errorRateNow - signals.errorRateBefore) >= errorDelta;
  if (errorHit) {
    reasons.push(`error rate +${((signals.errorRateNow - signals.errorRateBefore) * 100).toFixed(1)}pp`);
  }

  const satHit = signals.saturationNow >= satTrigger;
  if (satHit) {
    reasons.push(`saturation ${(signals.saturationNow * 100).toFixed(0)}% ≥ ${(satTrigger * 100).toFixed(0)}%`);
  }

  if (signals.anomalyDetected) {
    reasons.push("anomaly detector flagged out-of-band metrics");
  }

  const hits = [p95Hit, errorHit, satHit, signals.anomalyDetected].filter(Boolean).length;
  const verdict: RollbackVerdict =
    hits >= 2 ? "recommend_rollback"
    : hits === 1 ? "watch"
    : "no_rollback";

  // Confidence = min(1, 0.4 * hits). Two hits → 0.8; three → 1.0.
  const confidence = Math.min(1, 0.4 * hits);

  return { verdict, reasons, confidence };
}
