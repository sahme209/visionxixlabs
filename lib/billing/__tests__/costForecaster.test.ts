/**
 * Vitest unit tests for the pure cost forecaster.
 */

import { describe, it, expect } from "vitest";
import { forecastCost } from "../costForecaster";

const point = (dateKey: string, value: number) => ({ dateKey, value });

describe("costForecaster", () => {
  it("empty window → zero forecast", () => {
    const r = forecastCost({ windowDaily: [], month: "2026-05" });
    expect(r.averageDailyUsage).toBe(0);
    expect(r.projectedMonthEnd).toBe(0);
    expect(r.windowTotal).toBe(0);
  });

  it("computes average daily usage from the window", () => {
    const r = forecastCost({
      windowDaily: [point("2026-05-01", 100), point("2026-05-02", 200), point("2026-05-03", 300)],
      month: "2026-05",
      daysInMonth: 31,
    });
    expect(r.averageDailyUsage).toBe(200);
    expect(r.projectedMonthEnd).toBe(200 * 31);
    expect(r.windowTotal).toBe(600);
  });

  it("flags willExceedCap when projection >= cap", () => {
    const r = forecastCost({
      windowDaily: [point("2026-05-01", 1000)],
      month: "2026-05",
      cap: 20_000,
      daysInMonth: 30,
    });
    expect(r.projectedMonthEnd).toBe(30_000);
    expect(r.willExceedCap).toBe(true);
    expect(r.capRatio).toBe(1.5);
  });

  it("does NOT flag willExceedCap when under", () => {
    const r = forecastCost({
      windowDaily: [point("2026-05-01", 100)],
      month: "2026-05",
      cap: 10_000,
      daysInMonth: 30,
    });
    expect(r.willExceedCap).toBe(false);
    expect(r.capRatio).toBeCloseTo(0.3, 5);
  });

  it("returns capRatio=0 when no cap supplied", () => {
    const r = forecastCost({
      windowDaily: [point("2026-05-01", 100)],
      month: "2026-05",
    });
    expect(r.capRatio).toBe(0);
    expect(r.willExceedCap).toBe(false);
  });

  it("clamps daysInMonth to [28, 31]", () => {
    const a = forecastCost({ windowDaily: [point("d", 1)], month: "x", daysInMonth: 1 });
    const b = forecastCost({ windowDaily: [point("d", 1)], month: "x", daysInMonth: 999 });
    expect(a.daysInMonth).toBe(28);
    expect(b.daysInMonth).toBe(31);
  });

  it("clamps asOfDay to [1, daysInMonth]", () => {
    const a = forecastCost({ windowDaily: [point("d", 1)], month: "x", asOfDayOfMonth: 0, daysInMonth: 30 });
    const b = forecastCost({ windowDaily: [point("d", 1)], month: "x", asOfDayOfMonth: 50, daysInMonth: 30 });
    expect(a.asOfDay).toBe(1);
    expect(b.asOfDay).toBe(30);
  });
});
