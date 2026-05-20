/**
 * Pure SLO burn forecaster.
 *
 * Given a recent (or current) error-budget snapshot + the burn rate
 * from sloErrorBudget.computeSloReport, project:
 *   - hoursUntilExhausted at the current burn rate
 *   - target burn rate to last out the window
 *   - a remediation-urgency tier
 *
 * Pure / deterministic. No DB.
 */

export interface BurnForecastInput {
  /** Total request volume so far in the window. */
  totalRequestsSoFar: number;
  /** Failure count so far in the window. */
  totalFailuresSoFar: number;
  /** Max allowed failures over the window for the target. */
  budgetFailures: number;
  /** Hours elapsed in the window so far. */
  hoursElapsed: number;
  /** Total window length in hours. */
  windowHours: number;
  /** Current burn rate from sloErrorBudget (failureRate / allowedRate). */
  currentBurnRate: number;
}

export interface BurnForecast {
  remainingBudget: number;
  remainingHours: number;
  /** Failures per hour observed so far in the window. */
  failuresPerHour: number;
  /** Hours until remainingBudget hits zero at the current pace; null when not on track to exhaust. */
  hoursUntilExhausted: number | null;
  /** Burn rate that would just exhaust the budget exactly at window end (>= 1 means we have headroom). */
  sustainableBurnRate: number;
  urgency: "ok" | "tighten_soon" | "act_now" | "exhausted";
}

export function forecastBurn(input: BurnForecastInput): BurnForecast {
  const remainingBudget = Math.max(0, input.budgetFailures - input.totalFailuresSoFar);
  const remainingHours = Math.max(0, input.windowHours - input.hoursElapsed);
  const failuresPerHour = input.hoursElapsed === 0 ? 0 : input.totalFailuresSoFar / input.hoursElapsed;
  const hoursUntilExhausted = failuresPerHour > 0 && remainingBudget > 0
    ? remainingBudget / failuresPerHour
    : null;

  // Sustainable burn rate = (remainingBudget / remainingHours) / failureRateSoFar.
  // Caller already has currentBurnRate; we compute sustainable as the burn we
  // would need to keep below to last the remaining window:
  //   sustainable = remainingBudget / (remainingHours * failureRateSoFar's allowed share)
  // We don't have allowedRate here, so we express it as a ratio of current
  // failuresPerHour: 1 means break-even.
  const sustainableBurnRate = failuresPerHour === 0 || remainingHours === 0
    ? Infinity
    : (remainingBudget / remainingHours) / failuresPerHour;

  let urgency: BurnForecast["urgency"];
  if (input.totalFailuresSoFar > input.budgetFailures) {
    urgency = "exhausted";
  } else if (hoursUntilExhausted !== null && hoursUntilExhausted <= remainingHours) {
    urgency = "act_now";
  } else if (input.currentBurnRate >= 1) {
    urgency = "tighten_soon";
  } else {
    urgency = "ok";
  }

  return {
    remainingBudget,
    remainingHours,
    failuresPerHour,
    hoursUntilExhausted,
    sustainableBurnRate,
    urgency,
  };
}
