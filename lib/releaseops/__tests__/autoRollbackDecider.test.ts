/**
 * Vitest unit tests for the pure auto-rollback decider.
 */

import { describe, it, expect } from "vitest";
import { decideAutoRollback, type RollbackSignals } from "../autoRollbackDecider";

const BASE: RollbackSignals = {
  p95LatencyNowMs: 100, p95LatencyBeforeMs: 100,
  errorRateNow: 0.01,   errorRateBefore: 0.01,
  saturationNow: 0.5,   saturationBefore: 0.5,
  minutesSinceDeploy: 30,
  anomalyDetected: false,
};

describe("autoRollbackDecider", () => {
  it("steady metrics → no_rollback", () => {
    const r = decideAutoRollback(BASE);
    expect(r.verdict).toBe("no_rollback");
    expect(r.confidence).toBe(0);
  });

  it("p95 regression alone → watch (single hit)", () => {
    const r = decideAutoRollback({ ...BASE, p95LatencyNowMs: 200 });
    expect(r.verdict).toBe("watch");
    expect(r.reasons.some((s) => s.toLowerCase().includes("p95"))).toBe(true);
  });

  it("two hits → recommend_rollback", () => {
    const r = decideAutoRollback({
      ...BASE,
      p95LatencyNowMs: 200,
      errorRateNow: 0.05, // +4pp delta vs 0.01 baseline (> +2pp)
    });
    expect(r.verdict).toBe("recommend_rollback");
    expect(r.confidence).toBeCloseTo(0.8, 1);
  });

  it("three hits push confidence to 1.0", () => {
    const r = decideAutoRollback({
      ...BASE,
      p95LatencyNowMs: 200, errorRateNow: 0.05, saturationNow: 0.95,
    });
    expect(r.verdict).toBe("recommend_rollback");
    expect(r.confidence).toBeGreaterThanOrEqual(1.0);
  });

  it("anomaly detector counts as one signal", () => {
    const r = decideAutoRollback({ ...BASE, anomalyDetected: true, saturationNow: 0.95 });
    expect(r.verdict).toBe("recommend_rollback");
  });

  it("blocks rollback when minutesSinceDeploy < threshold", () => {
    const r = decideAutoRollback({
      ...BASE, p95LatencyNowMs: 999, errorRateNow: 0.99,
      saturationNow: 0.99, anomalyDetected: true, minutesSinceDeploy: 1,
    });
    expect(r.verdict).toBe("no_rollback");
    expect(r.reasons[0]).toContain("since deploy");
  });

  it("respects custom thresholds", () => {
    const r = decideAutoRollback(
      { ...BASE, p95LatencyNowMs: 105 },
      { p95RegressionRatio: 1.02 },
    );
    expect(r.reasons.some((s) => s.includes("p95"))).toBe(true);
  });

  it("p95 ratio uses pre-deploy as denominator (zero before doesn't false-fire)", () => {
    const r = decideAutoRollback({ ...BASE, p95LatencyBeforeMs: 0 });
    expect(r.reasons.find((s) => s.toLowerCase().includes("p95"))).toBeUndefined();
  });
});
