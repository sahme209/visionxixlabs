import { describe, expect, it } from "vitest";
import { evaluateCostResult, formatCents, formatDelta, toCents } from "../costEstimate";

describe("evaluateCostResult", () => {
  const base = { maxMonthlyIncreaseUsd: 100 };
  it("records the first estimate as the baseline", () => {
    expect(evaluateCostResult({ ...base, reportedStatus: "passed", costCents: 50_000, previousCents: null })).toEqual({ status: "passed", reason: null, deltaCents: null });
  });
  it("fails a pass that is over the limit, whatever CI said", () => {
    expect(evaluateCostResult({ ...base, reportedStatus: "passed", costCents: 60_001, previousCents: 50_000 })).toEqual({ status: "failed", reason: "over_cost_limit", deltaCents: 10_001 });
  });
  it("passes exactly at the limit and on a decrease", () => {
    expect(evaluateCostResult({ ...base, reportedStatus: "passed", costCents: 60_000, previousCents: 50_000 }).status).toBe("passed");
    expect(evaluateCostResult({ ...base, reportedStatus: "passed", costCents: 10_000, previousCents: 50_000 })).toMatchObject({ status: "passed", deltaCents: -40_000 });
  });
  it("never upgrades a failed or errored run", () => {
    expect(evaluateCostResult({ ...base, reportedStatus: "failed", costCents: 1, previousCents: 1 }).status).toBe("failed");
    expect(evaluateCostResult({ ...base, reportedStatus: "error", costCents: null, previousCents: 1 })).toEqual({ status: "error", reason: null, deltaCents: null });
  });
  it("turns a pass without a cost into an error", () => {
    expect(evaluateCostResult({ ...base, reportedStatus: "passed", costCents: null, previousCents: 1 })).toEqual({ status: "error", reason: "cost_missing", deltaCents: null });
  });
  it("formats money", () => {
    expect(toCents(12.345)).toBe(1235);
    expect(formatCents(123450)).toBe("$1,234.50");
    expect(formatDelta(12000)).toBe("+$120.00/mo");
    expect(formatDelta(-1500)).toBe("−$15.00/mo");
    expect(formatDelta(0)).toBe("no change");
  });
});
