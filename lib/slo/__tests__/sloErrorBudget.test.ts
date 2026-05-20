/**
 * Vitest unit tests for the pure SLO error-budget tracker.
 */

import { describe, it, expect } from "vitest";
import { computeSloReport } from "../sloErrorBudget";

const bucket = (good: number, total: number, dateKey = "2026-05-01") => ({ dateKey, goodCount: good, totalCount: total });

describe("sloErrorBudget", () => {
  it("no traffic → availability=1, healthy", () => {
    const r = computeSloReport({ windowDays: 30, targetAvailability: 0.999, buckets: [] });
    expect(r.observedAvailability).toBe(1);
    expect(r.verdict).toBe("healthy");
  });

  it("perfect requests → exactly at target", () => {
    const r = computeSloReport({
      windowDays: 30, targetAvailability: 0.999,
      buckets: [bucket(1000, 1000)],
    });
    expect(r.observedAvailability).toBe(1);
    expect(r.totalFailures).toBe(0);
    expect(r.verdict).toBe("healthy");
  });

  it("computes budget = floor(total * (1 - target))", () => {
    const r = computeSloReport({
      windowDays: 30, targetAvailability: 0.99,
      buckets: [bucket(900, 1000)],
    });
    expect(r.budgetFailures).toBe(10);
    expect(r.totalFailures).toBe(100);
    expect(r.remainingBudget).toBe(-90);
    expect(r.verdict).toBe("exhausted");
  });

  it("burn rate above 1 → burning_fast (when budget not yet exhausted)", () => {
    // 99% target, allow 1 failure per 100. Two failures per 100 = 2x burn rate.
    // We need to NOT exhaust the budget yet — 200 total + 4 failures.
    const r = computeSloReport({
      windowDays: 30, targetAvailability: 0.99,
      buckets: [bucket(196, 200)],
    });
    expect(r.burnRate).toBeCloseTo(2, 1);
    // budget=floor(200*0.01)=2; failures=4 → exhausted
    expect(r.verdict).toBe("exhausted");
  });

  it("burning_fast when burnRate>1 but budget not yet exhausted", () => {
    // 99.5% target → allowedRate=0.005. 2000 total, 6 failures:
    // budget=floor(2000*0.005)=10, remaining=4, burnRate=0.003/0.005=0.6 → healthy.
    // Bump failures to 12 so burnRate=12/2000 / 0.005 = 1.2 AND budget exhausts at 10.
    const r = computeSloReport({
      windowDays: 30, targetAvailability: 0.995,
      buckets: [bucket(1988, 2000)],
    });
    // 2000 total → budget=10, failures=12 → exhausted (negative remaining).
    expect(r.budgetFailures).toBe(10);
    expect(r.totalFailures).toBe(12);
    expect(r.remainingBudget).toBe(-2);
    expect(r.burnRate).toBeGreaterThan(1);
    expect(r.verdict).toBe("exhausted");
  });

  it("clamps goodCount to totalCount", () => {
    const r = computeSloReport({
      windowDays: 30, targetAvailability: 0.99,
      buckets: [bucket(9999, 100)], // good > total
    });
    expect(r.observedAvailability).toBe(1);
  });

  it("ignores buckets with totalCount <= 0", () => {
    const r = computeSloReport({
      windowDays: 30, targetAvailability: 0.99,
      buckets: [bucket(0, 0), bucket(100, 100)],
    });
    expect(r.totalRequests).toBe(100);
  });

  it("target=1.0 → allowedRate=0 → burnRate=Infinity when any failure", () => {
    const r = computeSloReport({
      windowDays: 30, targetAvailability: 1.0,
      buckets: [bucket(99, 100)],
    });
    expect(r.burnRate).toBe(Infinity);
    expect(r.verdict).toBe("exhausted");
  });
});
