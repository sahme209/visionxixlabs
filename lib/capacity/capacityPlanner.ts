/**
 * Pure capacity planner.
 *
 * Given a peak utilization history + an optional growth rate, suggest
 * a headroom target and the number of additional units (replicas /
 * vCPU / GB) the operator should pre-provision.
 *
 * Pure / deterministic. No DB.
 */

export interface CapacityInput {
  /** Peak utilization fraction observed per period (0..1). */
  peakUtilizationByPeriod: readonly number[];
  /** Current capacity (in units the caller picks). */
  currentUnits: number;
  /** Target peak utilization fraction (default 0.7). */
  targetUtilization?: number;
  /** Growth-rate hint per period (default 0). 0.05 = 5% per period. */
  growthRate?: number;
  /** How many periods ahead to plan for (default 4). */
  planAheadPeriods?: number;
}

export interface CapacityReport {
  /** Max peak observed in the input window. */
  observedPeak: number;
  /** Suggested target peak fraction used for the calc. */
  targetUtilization: number;
  /** Projected peak utilization after `planAheadPeriods` of growth. */
  projectedPeak: number;
  /** Units needed to hit targetUtilization at the projected peak. */
  recommendedUnits: number;
  /** recommendedUnits - currentUnits. */
  additionalUnits: number;
  /** Verdict ladder. */
  verdict: "ok" | "scale_up_soon" | "scale_up_now";
}

const clamp01 = (n: number): number => Math.max(0, Math.min(1, n));

export function planCapacity(input: CapacityInput): CapacityReport {
  const target = clamp01(input.targetUtilization ?? 0.7);
  const growth = Math.max(0, input.growthRate ?? 0);
  const ahead = Math.max(0, input.planAheadPeriods ?? 4);
  const observedPeak = input.peakUtilizationByPeriod.length === 0
    ? 0
    : Math.max(...input.peakUtilizationByPeriod);

  const projectedPeak = clamp01(observedPeak * Math.pow(1 + growth, ahead));

  // currentUnits * observedPeak = current absolute load.
  // recommendedUnits ≈ (projectedPeak * currentUnits) / target.
  // Guard against div-by-zero when target is 0 → recommend infinite would be
  // bad UX; instead bump target to a small epsilon so the recommendation is
  // finite and operators see "very large additional units".
  const safeTarget = target === 0 ? 0.01 : target;
  const recommendedUnits = input.currentUnits <= 0
    ? 0
    : Math.ceil((projectedPeak * input.currentUnits) / safeTarget);

  const additionalUnits = Math.max(0, recommendedUnits - input.currentUnits);

  const verdict: CapacityReport["verdict"] =
    observedPeak >= target ? "scale_up_now"
    : projectedPeak >= target ? "scale_up_soon"
    : "ok";

  return {
    observedPeak,
    targetUtilization: target,
    projectedPeak,
    recommendedUnits,
    additionalUnits,
    verdict,
  };
}
