/**
 * Phase 9: Deal Timeline Estimator — Internal sales intelligence.
 * Deterministic. Exposed in internal dashboard only.
 */

export type DealTimelineInput = {
  urgencyLevel: "low" | "medium" | "high" | "critical";
  enterpriseLikelihood: number;
  driftLevel?: string;
};

export type DealTimeline = {
  recommendedFollowUpDays: number;
  expectedSalesCycleLengthDays: number;
  idealEngagementModel: "self-serve" | "consulting-led" | "enterprise-program";
};

export function estimateDealTimeline(input: DealTimelineInput): DealTimeline {
  const { urgencyLevel, enterpriseLikelihood, driftLevel } = input;

  let recommendedFollowUpDays = 14;
  if (urgencyLevel === "critical") recommendedFollowUpDays = 1;
  else if (urgencyLevel === "high") recommendedFollowUpDays = 3;
  else if (urgencyLevel === "medium") recommendedFollowUpDays = 7;
  else if (driftLevel === "high" || enterpriseLikelihood > 70) recommendedFollowUpDays = 5;

  let expectedSalesCycleLengthDays = 60;
  if (enterpriseLikelihood > 80) expectedSalesCycleLengthDays = 90;
  else if (enterpriseLikelihood > 60) expectedSalesCycleLengthDays = 75;
  else if (urgencyLevel === "critical") expectedSalesCycleLengthDays = 30;
  else if (urgencyLevel === "high") expectedSalesCycleLengthDays = 45;

  let idealEngagementModel: DealTimeline["idealEngagementModel"] = "self-serve";
  if (enterpriseLikelihood > 65) idealEngagementModel = "enterprise-program";
  else if (urgencyLevel === "high" || urgencyLevel === "critical" || enterpriseLikelihood > 50) {
    idealEngagementModel = "consulting-led";
  }

  return {
    recommendedFollowUpDays,
    expectedSalesCycleLengthDays,
    idealEngagementModel,
  };
}
