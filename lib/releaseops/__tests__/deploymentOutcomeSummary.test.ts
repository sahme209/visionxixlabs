import { describe, expect, it } from "vitest";
import { summarizeDeploymentOutcomes } from "../deploymentOutcomeSummary";
const at = (m: number) => new Date(Date.UTC(2026, 10, 20, 10, m));
describe("deployment outcome summary", () => {
  it("counts only recorded conclusions and takes the median recorded duration", () => {
    const s = summarizeDeploymentOutcomes([
      { status: "completed", conclusion: "success", createdAt: at(0), completedAt: at(4) },
      { status: "completed", conclusion: "success", createdAt: at(0), completedAt: at(10) },
      { status: "completed", conclusion: "failure", createdAt: at(0), completedAt: at(6) },
      { status: "in_progress", conclusion: null, createdAt: at(0), completedAt: null },
      { status: "completed", conclusion: "neutral", createdAt: at(0), completedAt: at(2) },
      { status: "tracking_unavailable", conclusion: null, createdAt: at(0), completedAt: null },
    ], false);
    expect(s).toMatchObject({ windowDays: 30, recorded: 6, inProgress: 1, succeeded: 2, failed: 1, successRate: 66.7, medianSeconds: 360, truncated: false });
  });
  it("reports no rate or duration when nothing concluded", () => {
    expect(summarizeDeploymentOutcomes([], true)).toMatchObject({ successRate: null, medianSeconds: null, recorded: 0, truncated: true });
  });
  it("ignores impossible durations without dropping the outcome count", () => {
    const s = summarizeDeploymentOutcomes([{ status: "completed", conclusion: "success", createdAt: at(10), completedAt: at(5) }], false);
    expect(s).toMatchObject({ succeeded: 1, successRate: 100, medianSeconds: null });
  });
});

describe("daily trend", () => {
  it("buckets runs by UTC day, oldest first, and keeps the previous window count unless truncated", () => {
    const now = new Date(Date.UTC(2026, 10, 26, 12));
    const row = (d: number) => ({ status: "completed", conclusion: "success", createdAt: new Date(Date.UTC(2026, 10, d, 9)), completedAt: new Date(Date.UTC(2026, 10, d, 10)) });
    const old = { ...row(1), createdAt: new Date(Date.UTC(2026, 9, 10, 9)) };
    const s = summarizeDeploymentOutcomes([row(26), row(26), row(25), old], false, now, 7);
    expect(s.daily).toHaveLength(30);
    expect(s.daily[29]).toBe(2); expect(s.daily[28]).toBe(1); expect(s.daily.reduce((a, b) => a + b, 0)).toBe(3);
    expect(s.previousRecorded).toBe(7);
    expect(summarizeDeploymentOutcomes([], true, now, 7).previousRecorded).toBeNull();
  });
});
