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
    expect(s).toEqual({ windowDays: 30, recorded: 6, inProgress: 1, succeeded: 2, failed: 1, successRate: 66.7, medianSeconds: 360, truncated: false });
  });
  it("reports no rate or duration when nothing concluded", () => {
    expect(summarizeDeploymentOutcomes([], true)).toMatchObject({ successRate: null, medianSeconds: null, recorded: 0, truncated: true });
  });
  it("ignores impossible durations without dropping the outcome count", () => {
    const s = summarizeDeploymentOutcomes([{ status: "completed", conclusion: "success", createdAt: at(10), completedAt: at(5) }], false);
    expect(s).toMatchObject({ succeeded: 1, successRate: 100, medianSeconds: null });
  });
});
