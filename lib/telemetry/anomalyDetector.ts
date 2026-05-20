/**
 * Pure anomaly detector — z-score + EWMA.
 *
 * Given a series of numeric data points, score each point's deviation
 * from the recent baseline. Two methods:
 *   - zScore: classic (x - mean) / std over the supplied window
 *   - ewma:   exponentially weighted moving average with the supplied
 *             alpha; flag points whose absolute deviation from the
 *             EWMA exceeds `bandSigma` * trailing std.
 *
 * Pure / deterministic. Used by the autonomy loop to surface spikes
 * before they page anyone.
 */

export interface AnomalyPoint {
  index: number;
  value: number;
  /** z-score relative to the supplied window (NaN-safe). */
  zScore: number;
  /** EWMA value at this point. */
  ewma: number;
  /** Trailing std of |x - ewma|. */
  ewmaStd: number;
  /** True iff |zScore| >= bandSigma (default 3). */
  anomaly: boolean;
}

export interface AnomalyReport {
  points: AnomalyPoint[];
  /** Indices flagged anomalous. */
  anomalies: number[];
  /** Mean across the whole series. */
  mean: number;
  /** Population std across the whole series. */
  std: number;
}

export interface AnomalyOptions {
  /** Trailing-window size for the z-score baseline. Default 20. */
  window?: number;
  /** EWMA smoothing factor in (0, 1]. Default 0.3. */
  ewmaAlpha?: number;
  /** Sigma multiplier that flags a point as anomalous. Default 3. */
  bandSigma?: number;
}

const meanOf = (xs: readonly number[]): number => {
  if (xs.length === 0) return 0;
  let s = 0;
  for (const x of xs) s += x;
  return s / xs.length;
};

const stdOf = (xs: readonly number[], mean: number): number => {
  if (xs.length === 0) return 0;
  let s = 0;
  for (const x of xs) {
    const d = x - mean;
    s += d * d;
  }
  return Math.sqrt(s / xs.length);
};

export function detectAnomalies(series: readonly number[], opts?: AnomalyOptions): AnomalyReport {
  const window = Math.max(2, opts?.window ?? 20);
  const alpha = Math.max(0.01, Math.min(1, opts?.ewmaAlpha ?? 0.3));
  const bandSigma = Math.max(0.5, opts?.bandSigma ?? 3);

  if (series.length === 0) {
    return { points: [], anomalies: [], mean: 0, std: 0 };
  }

  const globalMean = meanOf(series);
  const globalStd = stdOf(series, globalMean);
  const points: AnomalyPoint[] = [];
  const anomalies: number[] = [];
  let ewma = series[0];
  // Rolling deviation accumulator for EWMA std (Welford-ish, bounded).
  const deviations: number[] = [];

  for (let i = 0; i < series.length; i++) {
    const x = series[i];
    // EWMA update
    ewma = i === 0 ? x : alpha * x + (1 - alpha) * ewma;
    const dev = Math.abs(x - ewma);
    deviations.push(dev);
    if (deviations.length > window) deviations.shift();
    const ewmaStd = stdOf(deviations, meanOf(deviations));

    // z-score over the trailing baseline window (excludes current point).
    const lo = Math.max(0, i - window);
    const baseline = series.slice(lo, i);
    const baseMean = baseline.length > 0 ? meanOf(baseline) : x;
    const baseStd = baseline.length > 0 ? stdOf(baseline, baseMean) : 0;
    const zScore = baseStd > 0 ? (x - baseMean) / baseStd : 0;

    // Anomaly if z-score crosses the band OR EWMA-band crosses.
    const zOver = Math.abs(zScore) >= bandSigma;
    const ewmaOver = ewmaStd > 0 && dev >= bandSigma * ewmaStd;
    const isAnomaly = zOver || ewmaOver;

    points.push({ index: i, value: x, zScore, ewma, ewmaStd, anomaly: isAnomaly });
    if (isAnomaly) anomalies.push(i);
  }

  return { points, anomalies, mean: globalMean, std: globalStd };
}
