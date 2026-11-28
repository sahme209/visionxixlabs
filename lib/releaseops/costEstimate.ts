/**
 * Cost estimate checks (pure). CI reports Infracost's estimated monthly cost for the infrastructure
 * code of one commit. V19, not CI, decides whether the increase over the previous estimate for a
 * different commit is within the check's limit, so a pipeline cannot pass a change that is over it.
 * The first estimate has nothing to compare with and is recorded as the baseline.
 */
export type CostReason = "over_cost_limit" | "cost_missing";
export interface CostDecision { status: "passed" | "failed" | "error"; reason: CostReason | null; deltaCents: number | null }

export const toCents = (usd: number) => Math.round(usd * 100);

export function evaluateCostResult(input: { reportedStatus: "passed" | "failed" | "error"; costCents: number | null; previousCents: number | null; maxMonthlyIncreaseUsd: number }): CostDecision {
  if (input.costCents === null) return { status: input.reportedStatus === "passed" ? "error" : input.reportedStatus, reason: input.reportedStatus === "passed" ? "cost_missing" : null, deltaCents: null };
  const deltaCents = input.previousCents === null ? null : input.costCents - input.previousCents;
  if (input.reportedStatus !== "passed") return { status: input.reportedStatus, reason: null, deltaCents };
  if (deltaCents !== null && deltaCents > toCents(input.maxMonthlyIncreaseUsd)) return { status: "failed", reason: "over_cost_limit", deltaCents };
  return { status: "passed", reason: null, deltaCents };
}

/** "$1,234.50" from cents. */
export function formatCents(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
}

/** "+$120.00/mo", "−$15.00/mo", "no change". */
export function formatDelta(cents: number): string {
  if (cents === 0) return "no change";
  return `${cents > 0 ? "+" : "−"}${formatCents(Math.abs(cents))}/mo`;
}
