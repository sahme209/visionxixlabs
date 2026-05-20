/**
 * Decision rationale heat-map builder.
 *
 * Aggregates AutonomyDecisionRationale rows into a stage × outcome
 * heat-map. Operators answer "where do my halts cluster?" in one
 * glance instead of scrolling through individual rows.
 *
 * Output: a 2D grid keyed on (stage, outcome) plus a per-stage
 * totals strip + a per-outcome totals strip.
 *
 * Hard rules:
 *   - Tenant-scoped at the read layer.
 *   - Best-effort: a DB failure returns an empty grid.
 *   - The stages array is built from the rows observed, not a closed
 *     enumeration — adding a new stage in the autonomy runner shows up
 *     automatically.
 */

import "server-only";

import { prisma } from "@/lib/db";

export interface HeatmapCell {
  stage: string;
  outcome: string;
  count: number;
}

export interface DecisionHeatmap {
  generatedAt: string;
  windowStart: string;
  windowEnd: string;
  totalRows: number;
  stages: string[];
  outcomes: string[];
  cells: HeatmapCell[];
  /** Per-stage row totals (sum across all outcomes). */
  perStageTotal: Record<string, number>;
  /** Per-outcome row totals (sum across all stages). */
  perOutcomeTotal: Record<string, number>;
  /** Cells with count > 0 sorted desc — top "hot spots". */
  topHotspots: HeatmapCell[];
}

const WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export async function buildDecisionHeatmap(opts: {
  organizationId: string;
  windowMs?: number;
}): Promise<DecisionHeatmap> {
  const end = new Date();
  const start = new Date(end.getTime() - (opts.windowMs ?? WINDOW_MS));

  let rows: Array<{ haltedAtStage: string | null; outcome: string }> = [];
  try {
    rows = await prisma.autonomyDecisionRationale.findMany({
      where: {
        organizationId: opts.organizationId,
        createdAt: { gte: start, lte: end },
      },
      select: { haltedAtStage: true, outcome: true },
      take: 5000,
    });
  } catch {
    // Empty heat-map — DB failure is non-fatal.
  }

  // For every row, the (stage, outcome) pair is:
  //   stage = haltedAtStage when present, else "completed_through_audit"
  //   outcome = the canonical AutonomyCandidate outcome literal
  const cellMap = new Map<string, number>();
  const stageSet = new Set<string>();
  const outcomeSet = new Set<string>();
  const perStageTotal: Record<string, number> = {};
  const perOutcomeTotal: Record<string, number> = {};

  for (const r of rows) {
    const stage = r.haltedAtStage ?? "completed_through_audit";
    const outcome = r.outcome;
    stageSet.add(stage);
    outcomeSet.add(outcome);
    const key = `${stage}::${outcome}`;
    cellMap.set(key, (cellMap.get(key) ?? 0) + 1);
    perStageTotal[stage] = (perStageTotal[stage] ?? 0) + 1;
    perOutcomeTotal[outcome] = (perOutcomeTotal[outcome] ?? 0) + 1;
  }

  const cells: HeatmapCell[] = Array.from(cellMap.entries()).map(([key, count]) => {
    const [stage, outcome] = key.split("::");
    return { stage, outcome, count };
  });

  // Stable ordering — alphabetical for deterministic UI output.
  const stages = Array.from(stageSet).sort();
  const outcomes = Array.from(outcomeSet).sort();
  const topHotspots = [...cells].sort((a, b) => b.count - a.count).slice(0, 10);

  return {
    generatedAt: new Date().toISOString(),
    windowStart: start.toISOString(),
    windowEnd: end.toISOString(),
    totalRows: rows.length,
    stages,
    outcomes,
    cells,
    perStageTotal,
    perOutcomeTotal,
    topHotspots,
  };
}
