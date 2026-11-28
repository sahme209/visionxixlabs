import { describe, expect, it } from "vitest";
import { ARR_GOAL_CENTS, formatMonths, growthPlan } from "../growth";

const base = { mrrListCents: 0, last30Cents: 0, previous30Cents: 0, paidWorkspaces: 0, activeWorkspaces: 0, aiCostCents: 0, aiBilledCents: 0 };
describe("growthPlan", () => {
  it("annualises recurring and collected revenue and measures progress to $100M ARR", () => {
    const p = growthPlan({ ...base, mrrListCents: 870_000, last30Cents: 130_000, previous30Cents: 100_000, paidWorkspaces: 10, activeWorkspaces: 20, aiCostCents: 4_000, aiBilledCents: 10_000 });
    expect(p.arrCents).toBe(12_000_000);
    expect(p.monthlyGrowth).toBeCloseTo(0.3);
    expect(p.progressPct).toBeCloseTo(0.12);
    expect(p.arpaMonthlyCents).toBe(100_000);
    expect(p.aiCostPerActiveWorkspaceCents).toBe(200);
    expect(p.aiGrossMarginPct).toBe(60);
    expect(p.milestones[0]).toEqual({ arrCents: 100_000_000, reached: false, monthsAtCurrentGrowth: Math.ceil(Math.log(100_000_000 / 12_000_000) / Math.log(1.3)) });
    expect(p.neededMonthlyGrowth5y).toBeCloseTo(Math.pow(ARR_GOAL_CENTS / 12_000_000, 1 / 60) - 1);
  });
  it("is honest with no revenue, no prior month or shrinking revenue", () => {
    const none = growthPlan(base);
    expect(none).toMatchObject({ arrCents: 0, monthlyGrowth: null, neededMonthlyGrowth5y: null, arpaMonthlyCents: null, aiGrossMarginPct: null });
    expect(none.milestones.every((m) => m.monthsAtCurrentGrowth === null)).toBe(true);
    const shrinking = growthPlan({ ...base, last30Cents: 50, previous30Cents: 100 });
    expect(shrinking.monthlyGrowth).toBe(-0.5);
    expect(shrinking.milestones[0].monthsAtCurrentGrowth).toBeNull();
  });
  it("marks reached milestones", () => {
    const p = growthPlan({ ...base, mrrListCents: 10_000_000 });
    expect(p.milestones.map((m) => m.reached)).toEqual([true, false, false, false]);
    expect(p.milestones[0].monthsAtCurrentGrowth).toBe(0);
  });
  it("formats months", () => {
    expect(formatMonths(null)).toBe("not at the current pace");
    expect(formatMonths(0)).toBe("reached");
    expect(formatMonths(40)).toBe("3 years 4 months");
    expect(formatMonths(11)).toBe("11 months");
    expect(formatMonths(24)).toBe("2 years");
  });
});
