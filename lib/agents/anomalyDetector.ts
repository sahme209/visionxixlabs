/**
 * Pure time-series anomaly detector.
 *
 * Input: a window of numeric samples (latest first or oldest first —
 * order-independent because we sort) + an optional baseline split.
 * Output: a typed AnomalyReport per metric — outlier indices,
 * deviation magnitude, closed-union verdict, expected range.
 *
 * Pure / deterministic. Uses median + MAD (median absolute deviation)
 * instead of mean + stddev so single huge spikes don't poison the
 * baseline. Bounded false-positive rate by configurable z-threshold.
 *
 * Why this matters for AGI:
 *   The detector is the upstream of every reactive workflow on the
 *   platform. A noisy detector creates loud alerts; a brittle one
 *   misses real incidents. MAD-based z-scores split the difference.
 */

export type AnomalyKind = "spike" | "dip" | "drift" | "missing_data" | "none";

export type SeverityTier = "info" | "warn" | "high" | "critical";

export interface MetricSample {
  /** ISO timestamp of the observation. */
  at: string;
  /** Numeric value (latency ms, % CPU, $ cost, etc.). */
  value: number;
}

export interface AnomalyReport {
  /** Stable id for the metric being checked. */
  metricId: string;
  /** Closed-union anomaly kind. */
  kind: AnomalyKind;
  severity: SeverityTier;
  /** Indices (relative to the input) flagged as outliers. */
  outlierIndices: readonly number[];
  /** Robust statistics computed from the baseline split. */
  baselineStats: {
    median: number;
    mad: number;
    n: number;
  };
  /** Expected value range around the baseline median. */
  expectedRange: { lower: number; upper: number };
  /** Z-equivalent score for the worst outlier (MAD-based). */
  worstZ: number;
  /** Operator-readable rationale. */
  rationale: string;
}

export interface AnomalyConfig {
  /**
   * Fraction of the window reserved as baseline. Defaults to 0.7 —
   * older samples baseline the newer ones.
   */
  baselineFraction?: number;
  /**
   * MAD-z threshold above which a sample counts as an outlier.
   * Default 3.5 (industry convention for robust outlier detection).
   */
  zThreshold?: number;
  /**
   * Drift threshold: if the median of the newest window differs from
   * the baseline median by more than driftMagnitude × baseline MAD,
   * raise a "drift" anomaly even when individual samples are inside
   * range. Default 2.5.
   */
  driftMagnitude?: number;
}

const DEFAULT_BASELINE_FRACTION = 0.7;
const DEFAULT_Z_THRESHOLD = 3.5;
const DEFAULT_DRIFT_MAGNITUDE = 2.5;
// MAD * 1.4826 → normal-equivalent stddev (for Gaussian distributions).
const MAD_CONSTANT = 1.4826;

function median(xs: readonly number[]): number {
  if (xs.length === 0) return NaN;
  const sorted = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

function madAround(xs: readonly number[], center: number): number {
  if (xs.length === 0) return 0;
  return median(xs.map((x) => Math.abs(x - center)));
}

function severityFromZ(worstZ: number): SeverityTier {
  if (worstZ >= 8)   return "critical";
  if (worstZ >= 5)   return "high";
  if (worstZ >= 3.5) return "warn";
  return "info";
}

export function detectAnomalies(
  metricId: string,
  samplesIn: readonly MetricSample[],
  config: AnomalyConfig = {},
): AnomalyReport {
  const fraction = config.baselineFraction ?? DEFAULT_BASELINE_FRACTION;
  const zThreshold = config.zThreshold ?? DEFAULT_Z_THRESHOLD;
  const driftMag = config.driftMagnitude ?? DEFAULT_DRIFT_MAGNITUDE;

  if (samplesIn.length === 0) {
    return {
      metricId,
      kind: "missing_data",
      severity: "warn",
      outlierIndices: [],
      baselineStats: { median: NaN, mad: 0, n: 0 },
      expectedRange: { lower: NaN, upper: NaN },
      worstZ: 0,
      rationale: "No samples — flag as missing data.",
    };
  }

  // Sort ascending by timestamp so the baseline is the OLDER slice.
  const samples = [...samplesIn].sort(
    (a, b) => new Date(a.at).getTime() - new Date(b.at).getTime(),
  );

  // Need enough samples for both baseline + check window.
  const splitIdx = Math.max(1, Math.floor(samples.length * fraction));
  const baseline = samples.slice(0, splitIdx).map((s) => s.value);
  const checkWindow = samples.slice(splitIdx);

  if (baseline.length < 3) {
    return {
      metricId,
      kind: "missing_data",
      severity: "info",
      outlierIndices: [],
      baselineStats: { median: NaN, mad: 0, n: baseline.length },
      expectedRange: { lower: NaN, upper: NaN },
      worstZ: 0,
      rationale: `Baseline window has only ${baseline.length} sample(s) — need ≥ 3 for a robust median.`,
    };
  }

  const baseMedian = median(baseline);
  const baseMad = madAround(baseline, baseMedian);
  // Avoid divide-by-zero when MAD = 0 (constant baseline). Substitute a
  // tiny epsilon so any deviation from a flat baseline registers.
  const denom = baseMad === 0 ? 1e-9 : baseMad * MAD_CONSTANT;

  // Score each sample in the check window.
  let worstZ = 0;
  const outlierIndices: number[] = [];
  for (let i = 0; i < checkWindow.length; i++) {
    const v = checkWindow[i].value;
    const z = Math.abs((v - baseMedian) / denom);
    if (z >= zThreshold) {
      outlierIndices.push(splitIdx + i);
    }
    if (z > worstZ) worstZ = z;
  }

  // Detect drift: median of the check window vs. baseline median.
  const checkMedian = checkWindow.length > 0 ? median(checkWindow.map((s) => s.value)) : baseMedian;
  const driftDelta = Math.abs(checkMedian - baseMedian);
  const driftThresholdValue = driftMag * (baseMad === 0 ? 1e-9 : baseMad);
  const drifted = driftDelta >= driftThresholdValue && checkWindow.length >= 3;

  let kind: AnomalyKind;
  if (outlierIndices.length > 0) {
    // Determine direction from the worst outlier.
    const worstIdx = outlierIndices.reduce((acc, i) => {
      const z = Math.abs((samples[i].value - baseMedian) / denom);
      const az = Math.abs((samples[acc].value - baseMedian) / denom);
      return z > az ? i : acc;
    }, outlierIndices[0]);
    kind = samples[worstIdx].value >= baseMedian ? "spike" : "dip";
  } else if (drifted) {
    kind = "drift";
  } else {
    kind = "none";
  }

  // Severity: drift earns at least warn even if no point crosses z=3.5.
  let severity = severityFromZ(worstZ);
  if (kind === "drift" && severity === "info") severity = "warn";

  const expectedRange = {
    lower: baseMedian - zThreshold * baseMad * MAD_CONSTANT,
    upper: baseMedian + zThreshold * baseMad * MAD_CONSTANT,
  };

  const reasons: string[] = [];
  reasons.push(`baseline n=${baseline.length}, median=${baseMedian.toFixed(2)}, MAD=${baseMad.toFixed(2)}`);
  if (outlierIndices.length > 0) reasons.push(`${outlierIndices.length} outlier(s) at z≥${zThreshold}`);
  if (drifted) reasons.push(`drift Δ=${driftDelta.toFixed(2)} ≥ ${driftThresholdValue.toFixed(2)}`);
  if (kind === "none") reasons.push("series within expected band");

  return {
    metricId,
    kind,
    severity,
    outlierIndices,
    baselineStats: { median: baseMedian, mad: baseMad, n: baseline.length },
    expectedRange,
    worstZ: Math.round(worstZ * 100) / 100,
    rationale: reasons.join(" · "),
  };
}
