import { describe, expect, it } from "vitest";
import { changeFailureRate } from "../changeFailureRate";

const d = new Date("2026-11-20T00:00:00Z");
describe("changeFailureRate", () => {
  it("counts failed, rolled back and incident-linked releases among finished ones", () => {
    const out = changeFailureRate([
      { id: "a", status: "deployed", actualDeployEnd: d }, { id: "b", status: "deployed", actualDeployEnd: d },
      { id: "c", status: "failed", actualDeployEnd: d }, { id: "d", status: "rolled_back", actualDeployEnd: d },
      { id: "e", status: "deploying", actualDeployEnd: null }, { id: "f", status: "deployed", actualDeployEnd: null },
    ], new Set(["b", "c", "e"]));
    expect(out).toEqual({ finished: 4, failedChanges: 3, byReason: { failedOrRolledBack: 2, incidentOnly: 1 }, ratePercent: 75 });
  });
  it("returns no rate without finished releases", () => {
    expect(changeFailureRate([], new Set()).ratePercent).toBeNull();
  });
});
