/**
 * Pure SLO error-budget tracker.
 *
 * Given a target (e.g. 99.9% over 30 days) and a stream of bucketed
 * (good, total) request counts, compute:
 *   - rolling-window availability
 *   - remaining error budget (in failed-request units)
 *   - burn rate vs. budget pace
 *
 * Pure — no DB. Caller is responsible for the data window.
 */

export interface SloBucket {
  /** UTC date key, YYYY-MM-DD. */
  dateKey: string;
  goodCount: number;
  totalCount: number;
}

export interface SloInput {
  windowDays: number;            // e.g. 30
  /** Target availability in (0, 1). e.g. 0.999. */
  targetAvailability: number;
  buckets: readonly SloBucket[];
}

export interface SloReport {
  windowDays: number;
  targetAvailability: number;
  observedAvailability: number;
  totalRequests: number;
  totalFailures: number;
  /** Maximum allowed failures over the window for the target. */
  budgetFailures: number;
  /** budgetFailures - totalFailures (negative = exhausted). */
  remainingBudget: number;
  /** observed failure rate / (1 - target). >1 = burning faster than budget. */
  burnRate: number;
  /** Verdict ladder. */
  verdict: "healthy" | "burning_fast" | "exhausted";
}

const clamp01 = (n: number): number => Math.max(0, Math.min(1, n));

export function computeSloReport(input: SloInput): SloReport {
  const target = clamp01(input.targetAvailability);
  const windowDays = Math.max(1, input.windowDays);

  let goodTotal = 0;
  let total = 0;
  for (const b of input.buckets) {
    if (b.totalCount <= 0) continue;
    goodTotal += Math.max(0, Math.min(b.goodCount, b.totalCount));
    total += b.totalCount;
  }
  const failures = Math.max(0, total - goodTotal);
  const observedAvailability = total === 0 ? 1 : goodTotal / total;

  // Allowed failures over the window for the target.
  const budgetFailures = Math.floor(total * (1 - target));
  const remainingBudget = budgetFailures - failures;

  // Burn rate: how fast we're using budget vs. the target failure rate.
  const failureRate = total === 0 ? 0 : failures / total;
  const allowedRate = 1 - target;
  const burnRate = allowedRate <= 0 ? Infinity : failureRate / allowedRate;

  const verdict: SloReport["verdict"] =
    remainingBudget < 0 ? "exhausted"
    : burnRate >= 1 ? "burning_fast"
    : "healthy";

  return {
    windowDays,
    targetAvailability: target,
    observedAvailability,
    totalRequests: total,
    totalFailures: failures,
    budgetFailures,
    remainingBudget,
    burnRate,
    verdict,
  };
}
