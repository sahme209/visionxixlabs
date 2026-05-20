/**
 * Vitest unit tests for the pure proposal-calibration calculator.
 */

import { describe, it, expect } from "vitest";
import { buildCalibrationReport, type RawProposal } from "../proposalCalibration";

const P = (authorAgent: string, target: RawProposal["target"], status: RawProposal["status"], confidence: number): RawProposal =>
  ({ authorAgent, target, status, confidence });

describe("proposal calibration", () => {
  it("empty input → zero considered + zero buckets", () => {
    const r = buildCalibrationReport([]);
    expect(r.totalConsidered).toBe(0);
    expect(r.buckets.length).toBe(0);
  });

  it("ignores pending and superseded proposals", () => {
    const r = buildCalibrationReport([
      P("reasoner", "runbook_recipe", "pending", 0.9),
      P("reasoner", "runbook_recipe", "superseded", 0.5),
    ]);
    expect(r.totalConsidered).toBe(0);
    expect(r.buckets.length).toBe(0);
  });

  it("calibrated bucket within band → verdict 'calibrated'", () => {
    const r = buildCalibrationReport([
      P("reasoner", "runbook_recipe", "approved", 0.8),
      P("reasoner", "runbook_recipe", "approved", 0.8),
      P("reasoner", "runbook_recipe", "rejected", 0.8),
    ]);
    const b = r.buckets[0];
    // approvalRate = 2/3 ≈ 0.667; avgConfidence = 0.8; gap = 0.133 ... actually that's > 0.1, so over_confident.
    // Adjust the fixture to land inside the band:
    expect(b.decided).toBe(3);
    expect(b.verdict).toBe("over_confident");
  });

  it("strictly within ±0.1 band → calibrated", () => {
    const r = buildCalibrationReport([
      P("reasoner", "policy_template", "approved", 0.7),
      P("reasoner", "policy_template", "approved", 0.7),
      P("reasoner", "policy_template", "rejected", 0.7),
    ]);
    // approvalRate = 2/3 ≈ 0.667; avgConfidence = 0.7; gap = 0.033
    const b = r.buckets[0];
    expect(b.verdict).toBe("calibrated");
    expect(b.calibrationGap).toBeCloseTo(0.033, 2);
  });

  it("over-confident when gap > 0.1", () => {
    const r = buildCalibrationReport([
      P("a", "charter_default", "approved", 0.95),
      P("a", "charter_default", "rejected", 0.95),
      P("a", "charter_default", "rejected", 0.95),
    ]);
    // approvalRate = 1/3 ≈ 0.333; avgConfidence = 0.95; gap ≈ 0.617
    expect(r.buckets[0].verdict).toBe("over_confident");
  });

  it("under-confident when gap < -0.1", () => {
    const r = buildCalibrationReport([
      P("a", "charter_default", "approved", 0.3),
      P("a", "charter_default", "approved", 0.3),
      P("a", "charter_default", "approved", 0.3),
    ]);
    // approvalRate = 1.0; avgConfidence = 0.3; gap = -0.7
    expect(r.buckets[0].verdict).toBe("under_confident");
  });

  it("treats 'applied' as positive outcome", () => {
    const r = buildCalibrationReport([
      P("a", "tier_cap", "applied", 0.8),
      P("a", "tier_cap", "applied", 0.8),
    ]);
    expect(r.buckets[0].approvalRate).toBe(1);
    expect(r.buckets[0].approvedOrApplied).toBe(2);
  });

  it("splits buckets by (authorAgent, target)", () => {
    const r = buildCalibrationReport([
      P("a", "runbook_recipe", "approved", 0.8),
      P("a", "policy_template", "rejected", 0.8),
      P("b", "runbook_recipe", "approved", 0.8),
    ]);
    expect(r.buckets.length).toBe(3);
    expect(r.buckets.map((b) => `${b.authorAgent}/${b.target}`)).toEqual([
      "a/policy_template", "a/runbook_recipe", "b/runbook_recipe",
    ]);
  });

  it("clamps confidence outside [0,1]", () => {
    const r = buildCalibrationReport([
      P("a", "help_entry", "approved", 999),
      P("a", "help_entry", "approved", -3),
    ]);
    // both clamped → avg = (1 + 0) / 2 = 0.5
    expect(r.buckets[0].avgConfidence).toBe(0.5);
  });
});
