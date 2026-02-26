/**
 * Phase 6: Axiom Enterprise Readiness Brief.
 * Given scores, drift, trends — returns 1-page structured output.
 */

export type EnterpriseBrief = {
  biggestRiskExposures: string[];
  biggestSavingsLevers: string[];
  governanceGaps: string[];
  recommended90DayOutline: string[];
  recommendedEngagementModel: string;
};

type ScoresLike = {
  infrastructureScore?: number;
  riskExposureLevel?: string;
  estimatedAnnualSavings?: number | null;
  deploymentFrictionIndex?: number;
  complexityTier?: string;
};

type DriftLike = {
  signals?: string[];
  recommendedNextActions?: string[];
} | null | undefined;

type TrendLike = {
  scoreDelta?: number | null;
  savingsDelta?: number | null;
} | null | undefined;

export function generateEnterpriseBrief(
  scores: ScoresLike | null | undefined,
  drift: DriftLike,
  trend: TrendLike
): EnterpriseBrief {
  const riskLevel = scores?.riskExposureLevel ?? "Medium";
  const savings = scores?.estimatedAnnualSavings ?? 0;
  const friction = scores?.deploymentFrictionIndex ?? 50;
  const complexity = scores?.complexityTier ?? "Growth";

  const biggestRiskExposures: string[] = [];
  if (riskLevel === "High") {
    biggestRiskExposures.push("Security posture requires immediate attention");
  }
  if (friction > 70) {
    biggestRiskExposures.push("Deployment friction indicates environment drift and manual processes");
  }
  if (complexity === "Enterprise" && (scores?.infrastructureScore ?? 0) < 60) {
    biggestRiskExposures.push("Complexity exceeds current infrastructure readiness");
  }
  if (biggestRiskExposures.length === 0) {
    biggestRiskExposures.push("Review public exposure and IAM policies for compliance");
  }

  const biggestSavingsLevers: string[] = [];
  if (savings > 20000) {
    biggestSavingsLevers.push("Right-sizing and reserved capacity for top cost drivers");
  }
  biggestSavingsLevers.push("Storage tier optimization and lifecycle policies");
  biggestSavingsLevers.push("Idle resource cleanup and tagging discipline");

  const governanceGaps: string[] = [];
  if (!drift?.recommendedNextActions?.length) {
    governanceGaps.push("No formal drift detection or remediation cadence");
  }
  if (trend?.scoreDelta != null && trend.scoreDelta < 0) {
    governanceGaps.push("Infrastructure score trending down — review recent changes");
  }
  governanceGaps.push("Establish baseline tagging and cost attribution");
  governanceGaps.push("Define change management and rollback procedures");

  const recommended90DayOutline: string[] = [
    "Month 1: Stabilize security posture, address critical risks",
    "Month 2: Implement cost optimization levers, establish governance baseline",
    "Month 3: Automate drift detection, formalize change and incident response",
  ];

  const recommendedEngagementModel =
    complexity === "Enterprise"
      ? "Dedicated engagement with weekly check-ins and quarterly strategic reviews"
      : "Phased engagement with bi-weekly reviews and self-serve playbooks";

  return {
    biggestRiskExposures,
    biggestSavingsLevers,
    governanceGaps,
    recommended90DayOutline,
    recommendedEngagementModel,
  };
}
