/**
 * Pure run-level telemetry rollup — Phase 400.
 *
 * Given the per-stage telemetry rows for a run, compute the totals the
 * runner uses for the cumulative-cost budget gate AND the admin view
 * uses for the trend page. Pure so the same kernel powers both
 * surfaces.
 *
 * Why per-stage AND a rollup:
 *   - per-stage tells the operator "which stage cost what" (debug)
 *   - rollup tells the runner "have we burned the whole budget" (gate)
 *
 * No I/O.
 */

import type { StageTelemetry } from "./extractStageTelemetry";

export interface StageTelemetryRow extends StageTelemetry {
  stageId: string;
  stageKind: string;
  /** "queued" | "running" | "succeeded" | "failed" | ... */
  status: string;
  ordering: number;
}

export interface RunTelemetryRollup {
  totalCostCents: number;
  totalTokensInput: number;
  totalTokensOutput: number;
  totalLatencyMs: number;
  /** Stages with non-zero cost, ordered by cost desc — the "top spenders." */
  topByCostCents: ReadonlyArray<StageTelemetryRow>;
  /** Counts to surface at-a-glance health. */
  stageCount: number;
  succeededCount: number;
  failedCount: number;
  /** True when at least one stage has costCents > 0 (helps the UI skip the empty trend). */
  hasCost: boolean;
}

const TOP_SPENDERS_DEFAULT = 5;

export function rollupStageTelemetry(
  stages: ReadonlyArray<StageTelemetryRow>,
  options: { topN?: number } = {},
): RunTelemetryRollup {
  const topN = options.topN ?? TOP_SPENDERS_DEFAULT;

  let totalCostCents = 0;
  let totalTokensInput = 0;
  let totalTokensOutput = 0;
  let totalLatencyMs = 0;
  let succeededCount = 0;
  let failedCount = 0;

  for (const s of stages) {
    totalCostCents += s.costCents;
    totalTokensInput += s.tokensInput;
    totalTokensOutput += s.tokensOutput;
    totalLatencyMs += s.latencyMs;
    if (s.status === "succeeded") succeededCount++;
    else if (s.status === "failed") failedCount++;
  }

  const topByCostCents = stages
    .filter((s) => s.costCents > 0)
    .slice()
    .sort((a, b) => b.costCents - a.costCents)
    .slice(0, topN);

  return {
    totalCostCents,
    totalTokensInput,
    totalTokensOutput,
    totalLatencyMs,
    topByCostCents,
    stageCount: stages.length,
    succeededCount,
    failedCount,
    hasCost: totalCostCents > 0,
  };
}
