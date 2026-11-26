import { describe, expect, it } from "vitest";
import { summarizeGateRefusals } from "../gateRefusalSummary";
describe("gate refusal summary", () => {
  it("counts refusals by reason with plain labels, most frequent first", () => {
    expect(summarizeGateRefusals([{ detailJson: { reason: "deployment_freeze_active" } }, { detailJson: { reason: "deployment_checks_blocking" } }, { detailJson: { reason: "deployment_checks_blocking" } }, { detailJson: null }])).toEqual({ total: 4, byReason: [
      { reason: "deployment_checks_blocking", label: "Blocking checks not passed", count: 2 },
      { reason: "deployment_freeze_active", label: "During a freeze", count: 1 },
      { reason: "other", label: "Other", count: 1 },
    ] });
  });
});
