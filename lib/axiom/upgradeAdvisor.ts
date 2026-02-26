/**
 * Phase 9: Smart Upgrade Engine — Psychological framing for upgrade prompts.
 * Deterministic. No AI.
 */

import type { DealSignals } from "./dealSignals";

export type UpgradeAdvisorInput = {
  currentTier: "free" | "pro" | "growth" | "enterprise";
  dealSignals: DealSignals;
  axiomScores: {
    infrastructureScore?: number;
    estimatedAnnualSavings?: number | null;
    riskExposureLevel?: string;
    deploymentFrictionIndex?: number;
    automationReadinessScore?: number;
  };
};

export type UpgradeRecommendation = {
  recommendedTier: "pro" | "growth" | "enterprise";
  reasoning: string[];
  urgencyMessage: string;
  expectedValueIncrease: number;
};

const TIER_ORDER = { free: 0, pro: 1, growth: 2, enterprise: 3 };

export function recommendUpgrade(input: UpgradeAdvisorInput): UpgradeRecommendation {
  const { currentTier, dealSignals, axiomScores } = input;
  const savings = axiomScores.estimatedAnnualSavings ?? 0;
  const risk = axiomScores.riskExposureLevel ?? "Medium";
  const friction = axiomScores.deploymentFrictionIndex ?? 50;
  const auto = axiomScores.automationReadinessScore ?? 50;

  let recommendedTier: UpgradeRecommendation["recommendedTier"] = "pro";
  const reasoning: string[] = [];

  if (currentTier === "enterprise") {
    return {
      recommendedTier: "enterprise",
      reasoning: ["Already on Enterprise tier."],
      urgencyMessage: "Continue engaging for renewal and expansion.",
      expectedValueIncrease: 0,
    };
  }

  if (currentTier === "free") {
    recommendedTier = "pro";
    reasoning.push("Roadmap tier unlocks 30-day plan, playbooks, and technical outputs");
    if (risk === "High") {
      reasoning.push("High risk exposure — Pro tier reveals security recommendations");
    }
    if (savings > 10000) {
      reasoning.push(`Estimated $${savings.toLocaleString()}/yr savings — full analysis available in Pro`);
    }
  } else if (currentTier === "pro") {
    if (dealSignals.enterpriseLikelihood > 60 || savings > 50000) {
      recommendedTier = "enterprise";
      reasoning.push("Enterprise candidate — advisory engagement and long-term contract fit");
      if (savings > 50000) reasoning.push("High savings potential justifies Enterprise investment");
    } else if (dealSignals.expansionProbability > 60 || friction > 70) {
      recommendedTier = "growth";
      reasoning.push("Growth tier adds drift detection and trend tracking");
      if (friction > 70) reasoning.push("Deployment friction signals need for continuous assessment");
    } else {
      recommendedTier = "growth";
      reasoning.push("Growth tier enables recurring analysis and drift visibility");
    }
  } else if (currentTier === "growth") {
    if (dealSignals.enterpriseLikelihood > 55 || savings > 50000) {
      recommendedTier = "enterprise";
      reasoning.push("Enterprise program for policy pack, board deck, and dedicated support");
      if (dealSignals.urgencyLevel === "high" || dealSignals.urgencyLevel === "critical") {
        reasoning.push("Urgency level supports accelerated Enterprise engagement");
      }
    } else {
      recommendedTier = "enterprise";
      reasoning.push("Scale to Enterprise for full strategic and compliance tooling");
    }
  }

  const riskPct = risk === "High" ? 28 : risk === "Medium" ? 18 : 10;
  const frictionPct = friction > 70 ? 25 : friction > 50 ? 15 : 8;
  const autoPct = auto < 40 ? 20 : auto < 60 ? 12 : 5;
  const pctLift = Math.round(riskPct * 0.5 + frictionPct * 0.3 + autoPct * 0.2);
  const urgencyMessage =
    recommendedTier === "pro"
      ? `Upgrade to Roadmap Tier to reduce risk exposure by ~${riskPct}% and unlock 3 key optimizations.`
      : recommendedTier === "growth"
      ? `Upgrade to Growth for drift detection and ~${frictionPct}% deployment friction reduction potential.`
      : `Enterprise program delivers full strategic brief, board deck, and compliance tooling.`;

  const valueMap: Record<string, number> = {
    "free->pro": Math.round(savings * 0.15) + 500,
    "pro->growth": Math.round(savings * 0.08) + 300,
    "growth->enterprise": Math.round(savings * 0.1) + 1000,
    "free->growth": Math.round(savings * 0.2) + 800,
    "pro->enterprise": Math.round(savings * 0.15) + 1200,
  };
  const key = `${currentTier}->${recommendedTier}`;
  const expectedValueIncrease = valueMap[key] ?? Math.round(savings * 0.1);

  return {
    recommendedTier,
    reasoning,
    urgencyMessage,
    expectedValueIncrease: Math.max(0, expectedValueIncrease),
  };
}
