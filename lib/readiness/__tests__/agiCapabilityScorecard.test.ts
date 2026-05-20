/**
 * Vitest unit tests for the pure AGI capability scorecard.
 */

import { describe, it, expect } from "vitest";
import { buildAgiCapabilityScorecard } from "../agiCapabilityScorecard";
import type { ValidationRow } from "@/lib/validation/platformValidationMatrix";

const ROW = (id: string, area: ValidationRow["area"], status: ValidationRow["status"]): ValidationRow => ({
  id, area, status,
  capability: "(test)",
  evidence: "(test)",
});

describe("agiCapabilityScorecard", () => {
  it("empty input → overall 0", () => {
    const r = buildAgiCapabilityScorecard([]);
    expect(r.rows.length).toBe(0);
    expect(r.overallScore).toBe(0);
  });

  it("all-passing area → score 1, verdict strong", () => {
    const r = buildAgiCapabilityScorecard([
      ROW("a", "aws", "passing"),
      ROW("b", "aws", "passing"),
    ]);
    const aws = r.rows.find((x) => x.area === "aws")!;
    expect(aws.score).toBe(1);
    expect(aws.verdict).toBe("strong");
  });

  it("partial-only area → score 0.6, verdict in_progress", () => {
    const r = buildAgiCapabilityScorecard([ROW("a", "azure", "partial")]);
    const az = r.rows[0];
    expect(az.score).toBeCloseTo(0.6, 5);
    expect(az.verdict).toBe("in_progress");
  });

  it("failing area → score 0, verdict behind", () => {
    const r = buildAgiCapabilityScorecard([ROW("a", "gcp", "failing")]);
    expect(r.rows[0].score).toBe(0);
    expect(r.rows[0].verdict).toBe("behind");
  });

  it("verdict ladder boundaries: 0.9 strong, 0.75 solid, 0.5 in_progress, <0.5 behind", () => {
    // 9 passing + 1 failing = 0.9 → strong
    const strong = buildAgiCapabilityScorecard([
      ...Array(9).fill(0).map((_, i) => ROW(`a${i}`, "aws", "passing")),
      ROW("af", "aws", "failing"),
    ]);
    expect(strong.rows[0].verdict).toBe("strong");

    // 3 passing + 1 failing = 0.75 → solid
    const solid = buildAgiCapabilityScorecard([
      ROW("a", "aws", "passing"), ROW("b", "aws", "passing"), ROW("c", "aws", "passing"),
      ROW("d", "aws", "failing"),
    ]);
    expect(solid.rows[0].verdict).toBe("solid");
  });

  it("rows sorted by score desc then area asc", () => {
    const r = buildAgiCapabilityScorecard([
      ROW("a", "aws", "passing"),
      ROW("b", "azure", "failing"),
      ROW("c", "gcp", "passing"),
    ]);
    expect(r.rows[0].score).toBeGreaterThanOrEqual(r.rows[1].score);
    expect(r.rows[r.rows.length - 1].area).toBe("azure");
  });

  it("overallScore is global weighted mean across all rows", () => {
    const r = buildAgiCapabilityScorecard([
      ROW("a", "aws", "passing"),     // 1
      ROW("b", "aws", "partial"),     // 0.6
      ROW("c", "azure", "failing"),   // 0
    ]);
    expect(r.overallScore).toBeCloseTo(1.6 / 3, 5);
  });

  it("status counts split correctly across areas", () => {
    const r = buildAgiCapabilityScorecard([
      ROW("a", "aws", "passing"),
      ROW("b", "aws", "partial"),
      ROW("c", "aws", "blocked"),
      ROW("d", "aws", "preview"),
      ROW("e", "aws", "failing"),
    ]);
    const aws = r.rows.find((x) => x.area === "aws")!;
    expect(aws).toMatchObject({ passing: 1, partial: 1, blocked: 1, preview: 1, failing: 1, total: 5 });
  });
});
