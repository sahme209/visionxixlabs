/**
 * Pure confidence calibrator — closes the learning loop.
 *
 * Input: a kernel's historical proposal outcomes — approved, rejected,
 * approved-then-rolled-back, never-decided. Output: a calibrated
 * accuracy + a closed-union recommendation for the operator
 * (trust_more / trust_same / trust_less / pause).
 *
 * Pure / deterministic. The calibrator never touches a model; it
 * computes Wilson lower-bound intervals so kernels with few samples
 * don't get overconfident in either direction.
 *
 * Why this matters for AGI:
 *   Self-improvement requires honest measurement. A kernel that
 *   over-claims its accuracy poisons the meta-reasoner that picks it.
 */

export type OutcomeKind =
  | "approved"          // operator accepted the proposal
  | "approved_rollback" // accepted but later rolled back → counts against
  | "rejected"          // operator rejected
  | "expired"           // operator never decided in the window
  | "auto_applied";     // proposal had no_gate and ran successfully

export interface OutcomeRecord {
  /** When the outcome was finalised. */
  decidedAt: Date;
  kind: OutcomeKind;
  /** True when this outcome contributed to a confirmed real-world result. */
  confirmed: boolean;
}

export type TrustRecommendation =
  | "trust_more"
  | "trust_same"
  | "trust_less"
  | "pause";

export interface CalibrationResult {
  kernelId: string;
  /** Total relevant outcomes counted. */
  samples: number;
  /** Naive accuracy (approved + auto_applied) / total. */
  rawAccuracy: number;
  /**
   * Wilson lower bound at 95% confidence. The meta-reasoner should
   * read THIS, not rawAccuracy, when picking kernels — it accounts
   * for small-sample noise.
   */
  calibratedAccuracy: number;
  /** Approved-then-rolled-back rate — high values trigger pause. */
  rollbackRate: number;
  recommendation: TrustRecommendation;
  rationale: string;
}

const MIN_SAMPLES_FOR_TRUST_MORE = 20;
const ROLLBACK_PAUSE_THRESHOLD = 0.1; // 10% rollback rate → pause

// Wilson score interval lower bound at 95% (z = 1.96).
function wilsonLower(successes: number, total: number): number {
  if (total === 0) return 0;
  const z = 1.96;
  const phat = successes / total;
  const denom = 1 + (z * z) / total;
  const center = phat + (z * z) / (2 * total);
  const margin = z * Math.sqrt((phat * (1 - phat) + (z * z) / (4 * total)) / total);
  const lower = (center - margin) / denom;
  return Math.max(0, Math.min(1, lower));
}

function isSuccess(o: OutcomeRecord): boolean {
  return (o.kind === "approved" || o.kind === "auto_applied") && o.confirmed !== false;
}

function isFailure(o: OutcomeRecord): boolean {
  return o.kind === "rejected" || o.kind === "approved_rollback";
}

export interface CalibrationInput {
  kernelId: string;
  /** Outcomes to consider — newest first or oldest first, order-independent. */
  outcomes: ReadonlyArray<OutcomeRecord>;
  /** Optional baseline trust score the kernel started with. Defaults 0.5. */
  baseline?: number;
}

export function calibrateKernel(input: CalibrationInput): CalibrationResult {
  const relevant = input.outcomes.filter((o) => o.kind !== "expired");
  const samples = relevant.length;

  if (samples === 0) {
    return {
      kernelId: input.kernelId,
      samples: 0,
      rawAccuracy: input.baseline ?? 0.5,
      calibratedAccuracy: input.baseline ?? 0.5,
      rollbackRate: 0,
      recommendation: "trust_same",
      rationale: "No decided outcomes yet — keep baseline trust.",
    };
  }

  const successes = relevant.filter(isSuccess).length;
  const failures = relevant.filter(isFailure).length;
  const rollbacks = relevant.filter((o) => o.kind === "approved_rollback").length;
  const approvedDecisions = relevant.filter((o) => o.kind === "approved").length;

  const rawAccuracy = samples === 0 ? 0 : successes / samples;
  const calibrated = wilsonLower(successes, samples);
  const rollbackRate = approvedDecisions + rollbacks > 0
    ? rollbacks / (approvedDecisions + rollbacks)
    : 0;

  let recommendation: TrustRecommendation;
  let rationale: string;

  if (rollbackRate >= ROLLBACK_PAUSE_THRESHOLD && samples >= 10) {
    recommendation = "pause";
    rationale = `Approved-then-rolled-back rate ${(rollbackRate * 100).toFixed(1)}% (n=${samples}) — pause for human review of the kernel's prompts / heuristics.`;
  } else if (calibrated >= 0.7 && samples >= MIN_SAMPLES_FOR_TRUST_MORE) {
    recommendation = "trust_more";
    rationale = `Calibrated accuracy ${(calibrated * 100).toFixed(1)}% on ${samples} samples — auto-stage low-risk proposals.`;
  } else if (calibrated < 0.35 && samples >= 10) {
    recommendation = "trust_less";
    rationale = `Calibrated accuracy ${(calibrated * 100).toFixed(1)}% on ${samples} samples — escalate to single approval even for low-risk tasks.`;
  } else if (samples < 5) {
    recommendation = "trust_same";
    rationale = `Only ${samples} sample(s) — need more outcomes before adjusting trust.`;
  } else if (failures > successes) {
    recommendation = "trust_less";
    rationale = `${failures} failures vs ${successes} successes on ${samples} samples — lower the trust floor.`;
  } else {
    recommendation = "trust_same";
    rationale = `Calibrated ${(calibrated * 100).toFixed(1)}% on ${samples} samples — within the steady-state band.`;
  }

  return {
    kernelId: input.kernelId,
    samples,
    rawAccuracy: Math.round(rawAccuracy * 1000) / 1000,
    calibratedAccuracy: Math.round(calibrated * 1000) / 1000,
    rollbackRate: Math.round(rollbackRate * 1000) / 1000,
    recommendation,
    rationale,
  };
}

/**
 * Batch helper: calibrate a whole kernel catalog at once. Returns
 * results in deterministic kernelId order so the cockpit can diff.
 */
export function calibrateAll(
  inputs: ReadonlyArray<CalibrationInput>,
): readonly CalibrationResult[] {
  return [...inputs]
    .map((i) => calibrateKernel(i))
    .sort((a, b) => a.kernelId.localeCompare(b.kernelId));
}
