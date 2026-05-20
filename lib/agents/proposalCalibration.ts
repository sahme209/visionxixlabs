/**
 * Pure proposal-calibration calculator.
 *
 * For each (authorAgent, target) bucket, compute:
 *   - total proposals decided (approved/rejected/applied count toward this)
 *   - approval rate (approved+applied / decided)
 *   - average self-declared confidence
 *   - calibration gap = avgConfidence - approvalRate
 *
 * The gap surfaces over-confident agents (positive gap) or under-confident
 * ones (negative gap). Operators use this to retune charters or to mute
 * agents whose proposals systematically fail vetting.
 *
 * Pure — fixtures only, no DB. Route handler does the Prisma read.
 */

import type { ProposalStatus, ProposalTarget } from "./methodProposalModel";

export interface RawProposal {
  authorAgent: string;
  target: ProposalTarget;
  status: ProposalStatus;
  confidence: number;
}

export interface CalibrationBucket {
  authorAgent: string;
  target: ProposalTarget;
  decided: number;
  approvedOrApplied: number;
  approvalRate: number;       // 0..1
  avgConfidence: number;      // 0..1
  /** avgConfidence - approvalRate. Positive => over-confident. */
  calibrationGap: number;
  /** Verdict tag: "calibrated" (|gap| <= 0.1), "over_confident" (gap > 0.1), "under_confident" (gap < -0.1). */
  verdict: "calibrated" | "over_confident" | "under_confident";
}

export interface CalibrationReport {
  totalConsidered: number;
  buckets: CalibrationBucket[];
}

const CALIBRATED_BAND = 0.1;

const clamp01 = (n: number): number => (n < 0 ? 0 : n > 1 ? 1 : n);

const TERMINAL: ReadonlySet<ProposalStatus> = new Set<ProposalStatus>(["approved", "applied", "rejected"]);
const POSITIVE: ReadonlySet<ProposalStatus> = new Set<ProposalStatus>(["approved", "applied"]);

export function buildCalibrationReport(rows: readonly RawProposal[]): CalibrationReport {
  type Bucket = { decided: number; positive: number; confSum: number };
  const map = new Map<string, Bucket & { authorAgent: string; target: ProposalTarget }>();
  let considered = 0;

  for (const r of rows) {
    if (!TERMINAL.has(r.status)) continue;
    considered += 1;
    const key = `${r.authorAgent}::${r.target}`;
    const b = map.get(key) ?? { authorAgent: r.authorAgent, target: r.target, decided: 0, positive: 0, confSum: 0 };
    b.decided += 1;
    if (POSITIVE.has(r.status)) b.positive += 1;
    b.confSum += clamp01(r.confidence);
    map.set(key, b);
  }

  const buckets: CalibrationBucket[] = [];
  for (const b of map.values()) {
    const approvalRate = b.decided === 0 ? 0 : b.positive / b.decided;
    const avgConfidence = b.decided === 0 ? 0 : b.confSum / b.decided;
    const calibrationGap = avgConfidence - approvalRate;
    const verdict: CalibrationBucket["verdict"] =
      calibrationGap > CALIBRATED_BAND ? "over_confident"
      : calibrationGap < -CALIBRATED_BAND ? "under_confident"
      : "calibrated";
    buckets.push({
      authorAgent: b.authorAgent,
      target: b.target,
      decided: b.decided,
      approvedOrApplied: b.positive,
      approvalRate,
      avgConfidence,
      calibrationGap,
      verdict,
    });
  }

  buckets.sort((a, b) => {
    if (a.authorAgent !== b.authorAgent) return a.authorAgent < b.authorAgent ? -1 : 1;
    return a.target < b.target ? -1 : 1;
  });

  return { totalConsidered: considered, buckets };
}
