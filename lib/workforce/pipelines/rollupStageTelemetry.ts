/** Recorded stage telemetry projection, not run-budget admission authority.
 * Numeric cost fields/hasCost remain compatible recorded projections; pending
 * or unknown cost must never be interpreted as a verified final zero. Coding
 * admission uses the durable run/workspace ledger instead of this rollup.
 */

import type { StageTelemetry } from "./extractStageTelemetry";

export type CostState = "pending" | "unknown" | "final";

export interface StageTelemetryRow extends StageTelemetry {
  costState?: CostState;
  finalCostCents?: number | null;
  stageId: string;
  stageKind: string;
  /** "queued" | "running" | "succeeded" | "failed" | ... */
  status: string;
  ordering: number;
}

export interface RunTelemetryRollup {
  /** Recorded projection only; completeness is specified separately. */
  totalCostCents: number;
  costState: CostState;
  finalTotalCostCents: number | null;
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
  options: { topN?: number; runStatus?: string } = {},
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

  const cents = (n: unknown): n is number => typeof n === "number" && Number.isSafeInteger(n) && n >= 0;
  const states = stages.map(s => s.costState === "final" && cents(s.finalCostCents) && s.finalCostCents === s.costCents
    ? "final" : s.costState === "pending" && s.finalCostCents === null ? "pending" : "unknown");
  let costState: CostState = !states.length || states.includes("unknown") || !cents(totalCostCents)
    ? "unknown" : states.includes("pending") ? "pending" : "final";
  if (costState === "final" && options.runStatus !== undefined && !["succeeded", "failed", "cancelled"].includes(options.runStatus)) costState = "unknown";
  return {
    costState,
    finalTotalCostCents: costState === "final" ? totalCostCents : null,
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

/** Fixed SQL projection only: no raw stage output or prompt is needed. */
export interface FinancialCostMarker {
  id: string;
  costShape: string | null;
  totalCents: unknown;
  pendingSettlement: unknown;
}
export function classifyStageCost(stage: {stageKind: string; status: string; costCents: number}, marker?: FinancialCostMarker): {costState: CostState; finalCostCents: number | null} {
  const unknown = {costState: "unknown" as const, finalCostCents: null};
  if (!marker || !Number.isSafeInteger(stage.costCents) || stage.costCents < 0) return unknown;
  const terminal = ["succeeded", "failed", "skipped"].includes(stage.status);
  if (marker.costShape === "object") {
    if (marker.pendingSettlement === true && marker.totalCents === null) return {costState: "pending", finalCostCents: null};
    if (terminal && marker.pendingSettlement === false && typeof marker.totalCents === "number" && Number.isSafeInteger(marker.totalCents) && marker.totalCents >= 0 && marker.totalCents === stage.costCents) {
      return {costState: "final", finalCostCents: marker.totalCents};
    }
    return unknown;
  }
  // Existing non-coding terminal telemetry retains its recorded projection.
  // Missing/unbound coding metadata, including succeeded legacy rows, is unknown.
  return marker.costShape === null && stage.stageKind !== "code_propose" && terminal
    ? {costState: "final", finalCostCents: stage.costCents} : unknown;
}
