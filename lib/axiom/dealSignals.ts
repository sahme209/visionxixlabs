/**
 * Phase 9: Deal Signal Engine — Enterprise sales intelligence.
 * Deterministic rules. No AI.
 * Converts infrastructure intelligence into deal acceleration signals.
 */

export type DealSignalsInput = {
  axiomScores: {
    infrastructureScore?: number;
    estimatedAnnualSavings?: number | null;
    riskExposureLevel?: string;
    deploymentFrictionIndex?: number;
    automationReadinessScore?: number;
    complexityTier?: string;
    strategicReadinessScore?: number;
  };
  strategicReadinessScore?: number;
  driftSignals?: { hasDrift?: boolean; driftLevel?: string };
  tier: "free" | "pro" | "growth" | "enterprise";
  organizationSize?: string;
  monthlySpend?: string;
};

export type DealSignals = {
  urgencyLevel: "low" | "medium" | "high" | "critical";
  expansionProbability: number;
  enterpriseLikelihood: number;
  topBusinessDrivers: string[];
  objectionPrediction: string[];
  decisionMakerTargets: string[];
  recommendedSalesAngle: string[];
  riskOfChurn: "low" | "medium" | "high";
};

function parseSpendProxy(monthlySpend?: string): number {
  if (!monthlySpend) return 0;
  const s = String(monthlySpend).replace(/[,$kKmM]/g, "");
  const n = parseFloat(s);
  if (isNaN(n)) return 0;
  if (/k/i.test(String(monthlySpend))) return n * 1000;
  if (/m/i.test(String(monthlySpend))) return n * 1_000_000;
  return n;
}

export function generateDealSignals(input: DealSignalsInput): DealSignals {
  const scores = input.axiomScores;
  const savings = scores.estimatedAnnualSavings ?? 0;
  const risk = scores.riskExposureLevel ?? "Medium";
  const friction = scores.deploymentFrictionIndex ?? 50;
  const auto = scores.automationReadinessScore ?? 50;
  const tier = input.tier;
  const hasDrift = input.driftSignals?.hasDrift ?? false;
  const spendProxy = parseSpendProxy(input.monthlySpend);

  let urgencyLevel: DealSignals["urgencyLevel"] = "low";
  if (risk === "High" && (savings > 20000 || spendProxy > 50000)) urgencyLevel = "critical";
  else if (risk === "High" || (hasDrift && savings > 10000)) urgencyLevel = "high";
  else if (friction > 70 || savings > 30000) urgencyLevel = "high";
  else if (savings > 10000 || hasDrift || friction > 60) urgencyLevel = "medium";

  let expansionProbability = 30;
  if (hasDrift && tier === "growth") expansionProbability = 75;
  else if (hasDrift && tier === "pro") expansionProbability = 65;
  else if (auto < 40 && savings > 15000 && savings < 50000) expansionProbability = 70; // Pro upgrade case
  else if (savings > 50000) expansionProbability = 80;
  else if (friction > 70) expansionProbability = 60;
  else if (risk === "High") expansionProbability = 55;

  let enterpriseLikelihood = 20;
  if (tier === "enterprise") enterpriseLikelihood = 90;
  else if (tier === "growth" && savings > 50000) enterpriseLikelihood = 65;
  else if (tier === "growth" && risk === "High") enterpriseLikelihood = 55;
  else if (tier === "pro" && savings > 100000) enterpriseLikelihood = 50;
  else if (scores.complexityTier === "Enterprise") enterpriseLikelihood += 25;
  else if (savings > 30000) enterpriseLikelihood += 20;

  const topBusinessDrivers: string[] = [];
  if (savings > 10000) topBusinessDrivers.push("Cost optimization opportunity");
  if (risk === "High") topBusinessDrivers.push("Risk reduction and compliance");
  if (friction > 60) topBusinessDrivers.push("Deployment velocity and reliability");
  if (auto < 50) topBusinessDrivers.push("Automation and CI/CD maturity");
  if (hasDrift) topBusinessDrivers.push("Drift detection and governance");
  if (topBusinessDrivers.length === 0) topBusinessDrivers.push("Infrastructure baseline improvement");

  const objectionPrediction: string[] = [];
  if (savings < 5000) objectionPrediction.push("ROI may be questioned — emphasize risk avoidance");
  if (friction > 80) objectionPrediction.push("Implementation effort concerns — offer phased approach");
  if (tier === "free") objectionPrediction.push("Budget constraints — lead with quick wins");
  objectionPrediction.push("Timing and prioritization — align with current initiatives");

  const decisionMakerTargets: string[] = [];
  if (risk === "High") decisionMakerTargets.push("CISO / Security Lead");
  if (savings > 30000) decisionMakerTargets.push("CFO / Finance");
  decisionMakerTargets.push("CTO / VP Engineering");
  if (friction > 70) decisionMakerTargets.push("DevOps / Platform Lead");

  const recommendedSalesAngle: string[] = [];
  if (risk === "High" && savings > 0) recommendedSalesAngle.push("Lead with risk reduction, follow with savings");
  else if (savings > 30000) recommendedSalesAngle.push("Quantify savings and 3-year projection");
  if (auto < 50 && friction > 60) recommendedSalesAngle.push("Automation and deployment velocity");
  if (hasDrift && tier !== "enterprise") recommendedSalesAngle.push("Drift visibility as gateway to Enterprise");
  if (tier === "free" || tier === "pro") recommendedSalesAngle.push("Roadmap tier unlocks 30-day plan and playbooks");

  let riskOfChurn: DealSignals["riskOfChurn"] = "low";
  if (risk === "High" && tier === "free") riskOfChurn = "high";
  else if (friction > 80 && savings < 5000) riskOfChurn = "medium";
  else if (hasDrift && tier === "free") riskOfChurn = "medium";

  return {
    urgencyLevel,
    expansionProbability: Math.min(100, Math.max(0, expansionProbability)),
    enterpriseLikelihood: Math.min(100, Math.max(0, enterpriseLikelihood)),
    topBusinessDrivers,
    objectionPrediction,
    decisionMakerTargets,
    recommendedSalesAngle,
    riskOfChurn,
  };
}

/** Phase 9: Derive auto-qualification tags from deal signals and scores */
export function deriveTagsFromDealSignals(
  dealSignals: DealSignals,
  axiomScores: { riskExposureLevel?: string; deploymentFrictionIndex?: number; estimatedAnnualSavings?: number | null; automationReadinessScore?: number }
): string[] {
  const tags: string[] = [];
  const risk = axiomScores.riskExposureLevel ?? "Medium";
  const savings = axiomScores.estimatedAnnualSavings ?? 0;
  const friction = axiomScores.deploymentFrictionIndex ?? 50;
  const auto = axiomScores.automationReadinessScore ?? 50;

  if (risk === "High") tags.push("high-risk");
  if (savings > 30000) tags.push("cost-optimization-heavy");
  if (auto < 50 || friction > 70) tags.push("ci-cd-weak");
  if (dealSignals.enterpriseLikelihood > 55) tags.push("enterprise-candidate");
  if (risk === "High" || dealSignals.urgencyLevel === "critical") tags.push("security-critical");

  return [...new Set(tags)];
}
