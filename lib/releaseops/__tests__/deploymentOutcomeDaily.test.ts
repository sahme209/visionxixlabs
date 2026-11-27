import { describe, expect, it } from "vitest";
import { summarizeDeploymentOutcomes } from "../deploymentOutcomeSummary";
describe("daily outcome split", () => {
  it("splits each day's runs by result", () => {
    const now = new Date("2026-11-27T12:00:00Z");
    const s = summarizeDeploymentOutcomes([
      { status: "completed", conclusion: "success", createdAt: new Date("2026-11-27T01:00:00Z"), completedAt: new Date("2026-11-27T01:10:00Z") },
      { status: "completed", conclusion: "failure", createdAt: new Date("2026-11-27T02:00:00Z"), completedAt: new Date("2026-11-27T02:10:00Z") },
      { status: "in_progress", conclusion: null, createdAt: new Date("2026-11-26T02:00:00Z"), completedAt: null },
      { status: "completed", conclusion: "skipped", createdAt: new Date("2026-11-26T03:00:00Z"), completedAt: new Date("2026-11-26T03:01:00Z") },
    ], false, now);
    expect(s.dailyOutcome.at(-1)).toEqual({ succeeded: 1, failed: 1, running: 0, other: 0 });
    expect(s.dailyOutcome.at(-2)).toEqual({ succeeded: 0, failed: 0, running: 1, other: 1 });
    expect(s.dailyOutcome).toHaveLength(s.daily.length);
  });
});
