/**
 * Pure ML model drift detector.
 *
 * Implements Population Stability Index (PSI) over feature histograms.
 * Operators feed in (baseline distribution, current distribution) per
 * feature; we report drift severity per feature + an overall rollup.
 *
 *   PSI < 0.1  → stable
 *   PSI < 0.25 → drifting
 *   PSI ≥ 0.25 → significant drift
 *
 * Pure / deterministic.
 */

export interface DistributionBucket {
  label: string;
  /** Count of observations in this bucket. */
  count: number;
}

export interface FeatureDriftInput {
  feature: string;
  baseline: readonly DistributionBucket[];
  current: readonly DistributionBucket[];
}

export interface FeatureDriftRow {
  feature: string;
  psi: number;
  status: "stable" | "drifting" | "significant_drift";
  /** Per-bucket contribution to the PSI total — operators see what shifted. */
  topShifts: Array<{ label: string; expectedShare: number; actualShare: number; contribution: number }>;
}

export interface DriftReport {
  rows: FeatureDriftRow[];
  /** Worst feature status. */
  overall: "stable" | "drifting" | "significant_drift";
}

const SMOOTHING = 1e-6;

const sum = (xs: readonly number[]): number => xs.reduce((a, b) => a + b, 0);

function psiContribution(baselineShare: number, currentShare: number): number {
  // PSI bucket = (current − baseline) * ln(current / baseline). Add a tiny
  // epsilon so a missing bucket doesn't divide by zero.
  const a = currentShare + SMOOTHING;
  const b = baselineShare + SMOOTHING;
  return (a - b) * Math.log(a / b);
}

function statusOf(psi: number): FeatureDriftRow["status"] {
  if (psi < 0.1) return "stable";
  if (psi < 0.25) return "drifting";
  return "significant_drift";
}

function alignBuckets(
  baseline: readonly DistributionBucket[],
  current: readonly DistributionBucket[],
): Array<{ label: string; baselineCount: number; currentCount: number }> {
  const map = new Map<string, { baselineCount: number; currentCount: number }>();
  for (const b of baseline) {
    const e = map.get(b.label) ?? { baselineCount: 0, currentCount: 0 };
    e.baselineCount += b.count;
    map.set(b.label, e);
  }
  for (const c of current) {
    const e = map.get(c.label) ?? { baselineCount: 0, currentCount: 0 };
    e.currentCount += c.count;
    map.set(c.label, e);
  }
  return [...map.entries()].map(([label, v]) => ({ label, ...v }));
}

export function computeFeaturePsi(input: FeatureDriftInput): FeatureDriftRow {
  const aligned = alignBuckets(input.baseline, input.current);
  const baselineTotal = sum(aligned.map((a) => a.baselineCount));
  const currentTotal = sum(aligned.map((a) => a.currentCount));

  if (baselineTotal === 0 || currentTotal === 0) {
    return {
      feature: input.feature,
      psi: 0,
      status: "stable",
      topShifts: [],
    };
  }

  const perBucket = aligned.map((a) => {
    const expectedShare = a.baselineCount / baselineTotal;
    const actualShare = a.currentCount / currentTotal;
    const contribution = psiContribution(expectedShare, actualShare);
    return { label: a.label, expectedShare, actualShare, contribution };
  });

  const psi = sum(perBucket.map((x) => x.contribution));
  // Show the top-3 buckets driving the PSI.
  const topShifts = [...perBucket]
    .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))
    .slice(0, 3);

  return { feature: input.feature, psi, status: statusOf(psi), topShifts };
}

export function detectModelDrift(features: readonly FeatureDriftInput[]): DriftReport {
  const rows = features.map(computeFeaturePsi)
    .sort((a, b) => b.psi - a.psi);
  const worst = rows.reduce<DriftReport["overall"]>((acc, r) => {
    const rank: Record<FeatureDriftRow["status"], number> = { stable: 0, drifting: 1, significant_drift: 2 };
    return rank[r.status] > rank[acc] ? r.status : acc;
  }, "stable");
  return { rows, overall: worst };
}
