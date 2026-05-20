/**
 * Vitest unit tests for the pure SLO burn forecaster.
 */

import { describe, it, expect } from "vitest";
import { forecastBurn } from "../burnForecaster";

describe("burnForecaster", () => {
  it("zero failures so far → ok urgency, no exhaustion projection", () => {
    const r = forecastBurn({
      totalRequestsSoFar: 1000, totalFailuresSoFar: 0,
      budgetFailures: 10, hoursElapsed: 1, windowHours: 24,
      currentBurnRate: 0,
    });
    expect(r.urgency).toBe("ok");
    expect(r.hoursUntilExhausted).toBeNull();
    expect(r.failuresPerHour).toBe(0);
  });

  it("burning fast but still ok urgency until projected exhaustion crosses window", () => {
    const r = forecastBurn({
      totalRequestsSoFar: 1000, totalFailuresSoFar: 5,
      budgetFailures: 10, hoursElapsed: 1, windowHours: 24,
      currentBurnRate: 1.2,
    });
    // 5 budget left, 5/h pace → 1h until exhausted, well within 23 remaining → act_now
    expect(r.urgency).toBe("act_now");
  });

  it("exhausted when totalFailures > budget", () => {
    const r = forecastBurn({
      totalRequestsSoFar: 1000, totalFailuresSoFar: 50,
      budgetFailures: 10, hoursElapsed: 12, windowHours: 24,
      currentBurnRate: 5,
    });
    expect(r.urgency).toBe("exhausted");
    expect(r.remainingBudget).toBe(0);
  });

  it("tighten_soon when burn>=1 but exhaustion is outside the window", () => {
    const r = forecastBurn({
      totalRequestsSoFar: 1000, totalFailuresSoFar: 2,
      budgetFailures: 100, hoursElapsed: 1, windowHours: 24,
      currentBurnRate: 1.0,
    });
    // 98 budget left, 2/h pace → 49h until exhausted, > 23 remaining → tighten_soon
    expect(r.urgency).toBe("tighten_soon");
  });

  it("sustainable burn rate is Infinity when no failures yet", () => {
    const r = forecastBurn({
      totalRequestsSoFar: 100, totalFailuresSoFar: 0,
      budgetFailures: 10, hoursElapsed: 1, windowHours: 24,
      currentBurnRate: 0,
    });
    expect(r.sustainableBurnRate).toBe(Infinity);
  });

  it("hoursUntilExhausted = remainingBudget / failuresPerHour", () => {
    const r = forecastBurn({
      totalRequestsSoFar: 1000, totalFailuresSoFar: 2,
      budgetFailures: 12, hoursElapsed: 2, windowHours: 24,
      currentBurnRate: 1,
    });
    // failuresPerHour = 2/2 = 1; remaining = 10 → 10h
    expect(r.hoursUntilExhausted).toBeCloseTo(10, 5);
  });

  it("clamps remainingHours and remainingBudget to >= 0", () => {
    const r = forecastBurn({
      totalRequestsSoFar: 1000, totalFailuresSoFar: 50,
      budgetFailures: 10, hoursElapsed: 30, windowHours: 24,
      currentBurnRate: 5,
    });
    expect(r.remainingBudget).toBe(0);
    expect(r.remainingHours).toBe(0);
  });
});
