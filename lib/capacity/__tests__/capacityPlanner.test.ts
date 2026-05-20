/**
 * Vitest unit tests for the pure capacity planner.
 */

import { describe, it, expect } from "vitest";
import { planCapacity } from "../capacityPlanner";

describe("capacityPlanner", () => {
  it("empty input → observedPeak=0, ok verdict", () => {
    const r = planCapacity({ peakUtilizationByPeriod: [], currentUnits: 4 });
    expect(r.observedPeak).toBe(0);
    expect(r.verdict).toBe("ok");
    expect(r.additionalUnits).toBe(0);
  });

  it("scale_up_now when observed peak >= target", () => {
    const r = planCapacity({
      peakUtilizationByPeriod: [0.85],
      currentUnits: 4,
      targetUtilization: 0.7,
      growthRate: 0,
    });
    expect(r.verdict).toBe("scale_up_now");
    expect(r.recommendedUnits).toBeGreaterThanOrEqual(r.recommendedUnits);
  });

  it("scale_up_soon when projection but not current crosses target", () => {
    const r = planCapacity({
      peakUtilizationByPeriod: [0.5],
      currentUnits: 10,
      targetUtilization: 0.7,
      growthRate: 0.1,
      planAheadPeriods: 4,
    });
    // projection = 0.5 * 1.1^4 ≈ 0.732 → above 0.7
    expect(r.projectedPeak).toBeGreaterThan(0.7);
    expect(r.verdict).toBe("scale_up_soon");
  });

  it("ok verdict when projection stays below target", () => {
    const r = planCapacity({
      peakUtilizationByPeriod: [0.3],
      currentUnits: 10,
      targetUtilization: 0.7,
      growthRate: 0,
    });
    expect(r.verdict).toBe("ok");
  });

  it("clamps targetUtilization to [0, 1]", () => {
    const a = planCapacity({ peakUtilizationByPeriod: [0.5], currentUnits: 4, targetUtilization: -1 });
    const b = planCapacity({ peakUtilizationByPeriod: [0.5], currentUnits: 4, targetUtilization: 5 });
    expect(a.targetUtilization).toBe(0);
    expect(b.targetUtilization).toBe(1);
  });

  it("recommends 0 units when currentUnits <= 0", () => {
    const r = planCapacity({ peakUtilizationByPeriod: [0.8], currentUnits: 0 });
    expect(r.recommendedUnits).toBe(0);
    expect(r.additionalUnits).toBe(0);
  });

  it("growth rate compounds over plan-ahead periods", () => {
    const r = planCapacity({
      peakUtilizationByPeriod: [0.4],
      currentUnits: 5,
      targetUtilization: 0.7,
      growthRate: 0.2,
      planAheadPeriods: 3,
    });
    // 0.4 * 1.2^3 = 0.6912
    expect(r.projectedPeak).toBeCloseTo(0.6912, 3);
  });

  it("clamps projected peak at 1.0", () => {
    const r = planCapacity({
      peakUtilizationByPeriod: [0.95],
      currentUnits: 4,
      targetUtilization: 0.7,
      growthRate: 1.0,    // doubles each period
      planAheadPeriods: 4,
    });
    expect(r.projectedPeak).toBeLessThanOrEqual(1);
  });
});
