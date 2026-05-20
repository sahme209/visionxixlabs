/**
 * Vitest unit tests for the pure Web Vitals budget tracker.
 */

import { describe, it, expect } from "vitest";
import { DEFAULT_BUDGETS, trackWebVitals, type VitalsMeasurement } from "../webVitalsBudgetTracker";

const M = (route: string, lcp: number, cls: number, inp: number, tbt: number, ttfb: number): VitalsMeasurement =>
  ({ route, lcp, cls, inp, tbt, ttfb });

describe("trackWebVitals", () => {
  it("empty → overall good", () => {
    const r = trackWebVitals({ measurements: [] });
    expect(r.overall).toBe("good");
    expect(r.rows).toEqual([]);
  });

  it("all within 'good' → good row status", () => {
    const r = trackWebVitals({
      measurements: [M("/", 2000, 0.05, 100, 100, 500)],
    });
    expect(r.rows[0].status).toBe("good");
    expect(r.overall).toBe("good");
  });

  it("LCP between good (2500) and poor (4000) → needs_improvement", () => {
    const r = trackWebVitals({
      measurements: [M("/", 3000, 0.05, 100, 100, 500)],
    });
    expect(r.rows[0].status).toBe("needs_improvement");
  });

  it("CLS > 0.25 → poor", () => {
    const r = trackWebVitals({
      measurements: [M("/", 1000, 0.5, 100, 100, 500)],
    });
    expect(r.rows[0].status).toBe("poor");
    expect(r.overall).toBe("poor");
  });

  it("worst-cell propagates to row status", () => {
    const r = trackWebVitals({
      measurements: [M("/", 1000, 0.5, 100, 100, 500)],
    });
    const clsCell = r.rows[0].cells.find((c) => c.name === "cls")!;
    expect(clsCell.status).toBe("poor");
  });

  it("rows sorted worst-first", () => {
    const r = trackWebVitals({
      measurements: [
        M("/good", 1000, 0.05, 100, 100, 500),
        M("/bad",  9999, 0.9, 9999, 9999, 9999),
      ],
    });
    expect(r.rows[0].route).toBe("/bad");
  });

  it("custom budgets override defaults", () => {
    const r = trackWebVitals({
      measurements: [M("/", 1500, 0.05, 100, 100, 500)],
      options: { budgets: { lcp: { good: 1000, poor: 1500 } } },
    });
    // LCP=1500 means status="needs_improvement" (between 1000 good and >1500 poor).
    expect(r.rows[0].status).toBe("needs_improvement");
  });

  it("totals count per status", () => {
    const r = trackWebVitals({
      measurements: [
        M("/a", 1000, 0.05, 100, 100, 500),    // good
        M("/b", 3000, 0.05, 100, 100, 500),    // needs_improvement
        M("/c", 5000, 0.5,  9999, 9999, 9999), // poor
      ],
    });
    expect(r.totals).toEqual({ good: 1, needs_improvement: 1, poor: 1 });
  });

  it("DEFAULT_BUDGETS includes LCP/CLS/INP/TBT/TTFB", () => {
    expect(DEFAULT_BUDGETS.lcp.good).toBe(2500);
    expect(DEFAULT_BUDGETS.cls.poor).toBe(0.25);
    expect(DEFAULT_BUDGETS.inp.good).toBe(200);
  });
});
