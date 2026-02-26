/**
 * Phase 7: Deterministic score explainability — why did I get this score?
 * No AI. Fully deterministic.
 */

import type { CloudOperatorScores } from "@/lib/cloudStudio/scoring";
import type { OperatorProfileInput } from "@/lib/cloudStudio/scoring";

export type ScoreBreakdownItem = {
  factor: string;
  weight: number;
  value: number;
  contribution: number;
};

export type ScoreExplanation = {
  infrastructureScoreBreakdown: ScoreBreakdownItem[];
  keyDrivers: string[];
  penalties: string[];
  improvementLevers: string[];
};

function riskToValue(riskLevel: string): number {
  if (riskLevel === "High") return 0;
  if (riskLevel === "Medium") return 50;
  return 100;
}

export function generateScoreExplanation(
  _profile: OperatorProfileInput,
  scores: CloudOperatorScores
): ScoreExplanation {
  const readiness = scores.infrastructureReadinessScore ?? 0;
  const cost = scores.costEfficiencyScore ?? 0;
  const cicd = scores.ciCdMaturityScore ?? 0;
  const riskValue = riskToValue(scores.securityRiskLevel ?? "Medium");

  const infrastructureScoreBreakdown: ScoreBreakdownItem[] = [
    { factor: "Infra Readiness", weight: 40, value: readiness, contribution: readiness * 0.4 },
    { factor: "Cost Efficiency", weight: 20, value: cost, contribution: cost * 0.2 },
    { factor: "CI/CD Maturity", weight: 20, value: cicd, contribution: cicd * 0.2 },
    { factor: "Risk (inverse)", weight: 20, value: riskValue, contribution: riskValue * 0.2 },
  ];

  const keyDrivers: string[] = [];
  if (readiness >= 70) keyDrivers.push("Strong infrastructure readiness baseline");
  else if (readiness < 50) keyDrivers.push("Low infrastructure readiness — focus on architecture baseline");

  if (cost >= 70) keyDrivers.push("Cost efficiency in good shape");
  else if (cost < 50) keyDrivers.push("Cost optimization opportunity — right-sizing and reserved capacity");

  if (cicd >= 70) keyDrivers.push("CI/CD maturity supports automation");
  else if (cicd < 50) keyDrivers.push("CI/CD gap — adopt pipeline automation");

  if (scores.securityRiskLevel === "High") keyDrivers.push("Security risk requires immediate attention");
  else if (scores.securityRiskLevel === "Low") keyDrivers.push("Security posture is solid");

  const penalties: string[] = [];
  if (scores.securityRiskLevel === "High") penalties.push("High security risk heavily penalizes composite score");
  if (cicd < 40) penalties.push("Low CI/CD maturity reduces automation readiness");
  if (readiness < 40) penalties.push("Low infrastructure readiness limits score ceiling");

  const improvementLevers: string[] = [];
  if (readiness < 70) improvementLevers.push("Improve architecture baseline and environment parity");
  if (cost < 70) improvementLevers.push("Optimize cost: reserved capacity, storage tiering, idle cleanup");
  if (cicd < 70) improvementLevers.push("Adopt CI/CD: pipeline automation, Git integration");
  if (scores.securityRiskLevel !== "Low") improvementLevers.push("Reduce security risk: IAM hardening, network segmentation");

  return {
    infrastructureScoreBreakdown,
    keyDrivers,
    penalties,
    improvementLevers,
  };
}
