/**
 * Pure AGI capability scorecard.
 *
 * Folds the platform validation matrix into a per-area summary used by
 * the readiness dashboard + the SaaS-front trust page. Higher-level
 * than summarizeValidation: returns one row per "area" with a 0..1
 * score, raw status counts, and a verdict ladder.
 *
 * Pure — caller passes the matrix in (no DB).
 */

import type { ValidationRow, ValidationStatus } from "@/lib/validation/platformValidationMatrix";

export type CapabilityArea = ValidationRow["area"];

export interface AreaScorecard {
  area: CapabilityArea;
  total: number;
  passing: number;
  partial: number;
  failing: number;
  preview: number;
  blocked: number;
  /** 0..1 weighted score (matches summarizeValidation's weights). */
  score: number;
  verdict: "strong" | "solid" | "in_progress" | "behind";
}

export interface AgiCapabilityScorecard {
  rows: AreaScorecard[];
  /** Overall weighted score across all rows. */
  overallScore: number;
}

const STATUS_WEIGHT: Record<ValidationStatus, number> = {
  passing: 1, partial: 0.6, preview: 0.4, blocked: 0.2, failing: 0,
};

const verdictOf = (score: number): AreaScorecard["verdict"] => {
  if (score >= 0.9) return "strong";
  if (score >= 0.75) return "solid";
  if (score >= 0.5) return "in_progress";
  return "behind";
};

export function buildAgiCapabilityScorecard(matrix: readonly ValidationRow[]): AgiCapabilityScorecard {
  const byArea = new Map<CapabilityArea, AreaScorecard>();

  for (const row of matrix) {
    const a = byArea.get(row.area) ?? {
      area: row.area,
      total: 0, passing: 0, partial: 0, failing: 0, preview: 0, blocked: 0,
      score: 0, verdict: "behind",
    };
    a.total += 1;
    a[row.status] += 1;
    byArea.set(row.area, a);
  }

  let totalScoreNumerator = 0;
  let totalCount = 0;

  for (const a of byArea.values()) {
    const num =
      a.passing * STATUS_WEIGHT.passing
      + a.partial * STATUS_WEIGHT.partial
      + a.preview * STATUS_WEIGHT.preview
      + a.blocked * STATUS_WEIGHT.blocked
      + a.failing * STATUS_WEIGHT.failing;
    a.score = a.total === 0 ? 0 : num / a.total;
    a.verdict = verdictOf(a.score);
    totalScoreNumerator += num;
    totalCount += a.total;
  }

  // Stable area order: sort by score desc then area asc.
  const rows = [...byArea.values()].sort((a, b) => {
    if (a.score !== b.score) return b.score - a.score;
    return a.area < b.area ? -1 : 1;
  });

  return {
    rows,
    overallScore: totalCount === 0 ? 0 : totalScoreNumerator / totalCount,
  };
}
