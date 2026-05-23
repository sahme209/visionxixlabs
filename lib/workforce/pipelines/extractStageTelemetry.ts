/**
 * Pure stage-telemetry extractor — Phase 400.
 *
 * Stage executors stash usage + cost details in their freeform
 * `outputDetail` JSON. We need a typed, indexed view of the same
 * numbers so:
 *
 *   - the run runner can cumulate cost across stages and halt
 *     runaway runs that exceed a configurable cents budget
 *   - the admin telemetry view can compute per-run totals with a
 *     simple SUM() instead of parsing JSON per row
 *   - downstream billing alerts read from one canonical place
 *
 * This kernel narrows the unknown `outputDetail` (Record<string,
 * unknown>) to the typed StageTelemetry shape. Unknown / missing
 * fields default to 0 — never throw, never let a malformed detail
 * blob break a run's terminal write.
 *
 * Pure — no I/O.
 */

export interface StageTelemetry {
  /** Cost in integer cents (US). Producer should already be ceil-rounded. */
  costCents: number;
  /** Anthropic-style input tokens. */
  tokensInput: number;
  /** Anthropic-style output tokens. */
  tokensOutput: number;
  /** Stage wall-clock milliseconds. */
  latencyMs: number;
}

const EMPTY: StageTelemetry = {
  costCents: 0,
  tokensInput: 0,
  tokensOutput: 0,
  latencyMs: 0,
};

function nonNegativeInt(v: unknown): number {
  if (typeof v !== "number") return 0;
  if (!Number.isFinite(v)) return 0;
  if (v < 0) return 0;
  return Math.floor(v);
}

/**
 * Extract typed telemetry from a stage executor's `outputDetail` blob.
 *
 * Recognized shapes (matched in order; first hit wins):
 *
 *   1. detail.cost.totalCents + detail.usage.{input,output}_tokens
 *      (the canonical shape used by codeProposeRealExecutor)
 *
 *   2. detail.telemetry.{costCents,tokensInput,tokensOutput,latencyMs}
 *      (the new shape future executors can use directly)
 *
 *   3. legacy top-level detail.{costCents,tokensInput,tokensOutput}
 *
 * `latencyMsOverride` lets the pipeline runner inject the measured
 * wall-clock since most executors don't track their own latency.
 */
export function extractStageTelemetry(
  outputDetail: unknown,
  latencyMsOverride?: number,
): StageTelemetry {
  if (outputDetail === null || typeof outputDetail !== "object") {
    return {
      ...EMPTY,
      latencyMs: nonNegativeInt(latencyMsOverride),
    };
  }
  const d = outputDetail as Record<string, unknown>;

  // Shape 2 — explicit `telemetry` block.
  if (d.telemetry && typeof d.telemetry === "object") {
    const t = d.telemetry as Record<string, unknown>;
    return {
      costCents: nonNegativeInt(t.costCents),
      tokensInput: nonNegativeInt(t.tokensInput),
      tokensOutput: nonNegativeInt(t.tokensOutput),
      latencyMs: nonNegativeInt(t.latencyMs ?? latencyMsOverride),
    };
  }

  // Shape 1 — codeProposeRealExecutor shape.
  let costCents = 0;
  if (d.cost && typeof d.cost === "object") {
    const c = d.cost as Record<string, unknown>;
    costCents = nonNegativeInt(c.totalCents);
  }
  let tokensInput = 0;
  let tokensOutput = 0;
  if (d.usage && typeof d.usage === "object") {
    const u = d.usage as Record<string, unknown>;
    tokensInput = nonNegativeInt(u.input_tokens);
    tokensOutput = nonNegativeInt(u.output_tokens);
  }

  // Shape 3 — legacy top-level fields (fallback).
  if (costCents === 0) costCents = nonNegativeInt(d.costCents);
  if (tokensInput === 0) tokensInput = nonNegativeInt(d.tokensInput);
  if (tokensOutput === 0) tokensOutput = nonNegativeInt(d.tokensOutput);

  return {
    costCents,
    tokensInput,
    tokensOutput,
    latencyMs: nonNegativeInt(latencyMsOverride ?? d.latencyMs),
  };
}
