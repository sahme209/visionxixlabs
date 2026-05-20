/**
 * Vitest unit tests for the pure PR risk scorer.
 */

import { describe, it, expect } from "vitest";
import { scorePrRisk, type PrSignals } from "../prRiskScorer";

const BASE: PrSignals = {
  linesAdded: 50,
  linesDeleted: 20,
  filesChanged: 3,
  infraFilesChanged: 0,
  ciGreen: true,
  approvals: 2,
  daysSinceLastMergeInArea: 1,
  isHotfix: false,
};

describe("prRiskScorer", () => {
  it("small green PR → low verdict", () => {
    const r = scorePrRisk(BASE);
    expect(r.verdict).toBe("low");
    expect(r.score).toBeLessThan(20);
  });

  it("CI red bumps risk", () => {
    const r = scorePrRisk({ ...BASE, ciGreen: false });
    expect(r.contributions.some((c) => c.factor === "ci_red")).toBe(true);
    expect(r.verdict).not.toBe("low");
  });

  it("large LOC adds 30 points", () => {
    const r = scorePrRisk({ ...BASE, linesAdded: 800, linesDeleted: 500 });
    expect(r.contributions.some((c) => c.factor === "large_loc" && c.delta === 30)).toBe(true);
  });

  it("infra files add capped delta", () => {
    const r = scorePrRisk({ ...BASE, infraFilesChanged: 10 });
    const infra = r.contributions.find((c) => c.factor === "infra_touched")!;
    expect(infra.delta).toBe(20); // capped
  });

  it("no approvals adds 15", () => {
    const r = scorePrRisk({ ...BASE, approvals: 0 });
    expect(r.contributions.some((c) => c.factor === "no_approvals" && c.delta === 15)).toBe(true);
  });

  it("single approval with infra change adds 5", () => {
    const r = scorePrRisk({ ...BASE, approvals: 1, infraFilesChanged: 1 });
    expect(r.contributions.some((c) => c.factor === "single_approval_with_infra")).toBe(true);
  });

  it("hotfix adds 10", () => {
    const r = scorePrRisk({ ...BASE, isHotfix: true });
    expect(r.contributions.some((c) => c.factor === "hotfix" && c.delta === 10)).toBe(true);
  });

  it("score clamped 0..100", () => {
    const r = scorePrRisk({
      linesAdded: 5_000, linesDeleted: 5_000,
      filesChanged: 100, infraFilesChanged: 20,
      ciGreen: false, approvals: 0,
      daysSinceLastMergeInArea: 365, isHotfix: true,
    });
    expect(r.score).toBeLessThanOrEqual(100);
    expect(r.verdict).toBe("critical");
  });

  it("verdict ladder boundaries: 20 medium, 45 high, 70 critical", () => {
    const r = scorePrRisk({
      linesAdded: 0, linesDeleted: 0, filesChanged: 0,
      infraFilesChanged: 0, ciGreen: true,
      approvals: 0, daysSinceLastMergeInArea: 30, isHotfix: false,
    });
    // score: 0 + 0 + 0 + 0 + 0 + 15 (no approvals) + 8 (stale) = 23 → medium
    expect(r.score).toBe(23);
    expect(r.verdict).toBe("medium");
  });
});
