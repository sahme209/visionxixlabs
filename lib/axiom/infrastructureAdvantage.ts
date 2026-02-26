import type { OperatorProfile } from "@/lib/cloudOperator/types";
import type { CloudOperatorScores } from "@/lib/cloudStudio/scoring";
import { computeCloudOperatorScores } from "@/lib/cloudStudio/scoring";

export type AxiomProfile = OperatorProfile & {
  // Reserved for future extensions (e.g. website builder / Cloud Studio context)
  contextType?: "operator" | "cloud-studio" | "website-builder";
};

export type AxiomScores = {
  infrastructureScore: number;
  estimatedAnnualSavings: number | null;
  riskExposureLevel: string;
  deploymentFrictionIndex: number;
  complexityTier: string;
  automationReadinessScore: number;
  // Raw underlying scores for transparency
  operatorScores: CloudOperatorScores;
};

export type PlanTask = {
  technicalAction: string;
  businessImpact: string;
  estimatedImprovementEffect: string;
};

export type PlanPhase = {
  label: string;
  dayRange: string;
  category: "Critical" | "High Impact" | "Strategic" | "Optimization";
  tasks: PlanTask[];
};

export type ThirtyDayPlan = {
  executiveSummary: {
    infrastructureScore: number;
    estimatedAnnualSavings: number | null;
    riskExposureLevel: string;
    complexityTier: string;
    deploymentFrictionIndex: number;
  };
  prioritizedCategories: {
    critical: PlanTask[];
    highImpact: PlanTask[];
    strategic: PlanTask[];
    optimization: PlanTask[];
  };
  timeSequencedPlan: {
    stabilization: PlanPhase;
    costOptimization: PlanPhase;
    deploymentAcceleration: PlanPhase;
    scalabilityHardening: PlanPhase;
  };
};

export type AxiomResult = {
  scores: AxiomScores;
  plan: ThirtyDayPlan;
  // Simple placeholders for Growth/Enterprise features
  trendSignals?: string[];
  driftSignals?: string[];
};

function computeDeploymentFrictionIndex(scores: CloudOperatorScores): number {
  // Start from inverse of CI/CD maturity and adjust for complexity
  let friction = 100 - (scores.ciCdMaturityScore || 0);
  if (scores.architectureComplexityTier === "Enterprise") {
    friction += 10;
  } else if (scores.architectureComplexityTier === "Growth") {
    friction += 5;
  }
  return Math.min(100, Math.max(0, friction));
}

function computeInfrastructureScore(scores: CloudOperatorScores): number {
  // Weighted composite of readiness, cost efficiency, CI/CD maturity and inverse risk.
  const readiness = scores.infrastructureReadinessScore || 0;
  const cost = scores.costEfficiencyScore || 0;
  const cicd = scores.ciCdMaturityScore || 0;
  const risk =
    scores.securityRiskLevel === "High" ? 0 : scores.securityRiskLevel === "Medium" ? 50 : 100;

  const raw =
    readiness * 0.4 +
    cost * 0.2 +
    cicd * 0.2 +
    risk * 0.2;

  return Math.round(Math.min(100, Math.max(0, raw)));
}

function computeAutomationReadinessScore(
  profile: AxiomProfile,
  scores: CloudOperatorScores
): number {
  // Start from CI/CD maturity as base signal.
  let readiness = scores.ciCdMaturityScore || 50;

  // Penalize if CI/CD is explicitly absent.
  if (profile.hasCiCd === "no") {
    readiness -= 20;
  }

  // Adjust based on architecture complexity: higher complexity requires stronger automation.
  if (scores.architectureComplexityTier === "Enterprise") {
    if ((scores.infrastructureReadinessScore || 0) >= 70 && readiness < 70) {
      readiness -= 10;
    } else if (readiness >= 70) {
      readiness += 5;
    }
  } else if (scores.architectureComplexityTier === "Growth" && readiness >= 60) {
    readiness += 5;
  }

  return Math.round(Math.min(100, Math.max(0, readiness)));
}

function buildDeterministicTasks(
  profile: AxiomProfile,
  scores: CloudOperatorScores
): {
  critical: PlanTask[];
  highImpact: PlanTask[];
  strategic: PlanTask[];
  optimization: PlanTask[];
} {
  const critical: PlanTask[] = [];
  const highImpact: PlanTask[] = [];
  const strategic: PlanTask[] = [];
  const optimization: PlanTask[] = [];

  const provider = profile.hostingProvider;
  const spend = scores.estimatedAnnualSavings;

  // Critical: security and availability
  if (scores.securityRiskLevel === "High") {
    critical.push({
      technicalAction: `Lock down public exposure and enforce least-privilege IAM policies on ${provider} workloads.`,
      businessImpact: "Reduces immediate breach and compliance risk for externally facing systems.",
      estimatedImprovementEffect: "High reduction in security risk within first week.",
    });
  }

  // High impact: cost and architecture
  if (spend && spend > 20000) {
    highImpact.push({
      technicalAction: `Introduce right-sizing and reserved capacity for top 3 cost drivers in ${provider}.`,
      businessImpact: "Captures material savings while maintaining current performance levels.",
      estimatedImprovementEffect: "10–25% reduction in annualized infrastructure spend.",
    });
  }

  highImpact.push({
    technicalAction: "Standardize staging and production environments on a single reference architecture.",
    businessImpact: "Reduces deployment friction and failure risk by eliminating environment drift.",
    estimatedImprovementEffect: "Noticeable drop in failed deploys and rollback incidents.",
  });

  // Strategic: scaling and platform
  strategic.push({
    technicalAction: "Define a clear multi-environment strategy with capacity thresholds and autoscaling policies.",
    businessImpact: "Prepares the platform for demand spikes without overprovisioning day-to-day.",
    estimatedImprovementEffect: "Improved ability to handle traffic spikes with predictable cost envelope.",
  });

  // Optimization: cleanup and hygiene
  optimization.push({
    technicalAction: "Audit idle resources and unattached volumes across all environments and schedule safe cleanup.",
    businessImpact: "Eliminates silent waste while freeing budget for higher-impact work.",
    estimatedImprovementEffect: "Low-risk savings and simpler operational footprint.",
  });

  optimization.push({
    technicalAction: "Introduce basic tagging standards for cost, environment, and ownership across resources.",
    businessImpact: "Improves visibility and speeds up future optimization and incident response.",
    estimatedImprovementEffect: "Medium improvement in cost attribution and operational clarity.",
  });

  return { critical, highImpact, strategic, optimization };
}

export function generateInfrastructureAdvantageModel(
  profile: AxiomProfile,
  existingScores?: CloudOperatorScores | null
): AxiomResult {
  const operatorScores = existingScores ?? computeCloudOperatorScores(profile);

  const infrastructureScore = computeInfrastructureScore(operatorScores);
  const deploymentFrictionIndex = computeDeploymentFrictionIndex(operatorScores);
  const automationReadinessScore = computeAutomationReadinessScore(profile, operatorScores);

  const scores: AxiomScores = {
    infrastructureScore,
    estimatedAnnualSavings: operatorScores.estimatedAnnualSavings,
    riskExposureLevel: operatorScores.securityRiskLevel,
    deploymentFrictionIndex,
    complexityTier: operatorScores.architectureComplexityTier,
    automationReadinessScore,
    operatorScores,
  };

  const deterministicTasks = buildDeterministicTasks(profile, operatorScores);

  const plan: ThirtyDayPlan = {
    executiveSummary: {
      infrastructureScore: scores.infrastructureScore,
      estimatedAnnualSavings: scores.estimatedAnnualSavings,
      riskExposureLevel: scores.riskExposureLevel,
      complexityTier: scores.complexityTier,
      deploymentFrictionIndex: scores.deploymentFrictionIndex,
    },
    prioritizedCategories: {
      critical: deterministicTasks.critical,
      highImpact: deterministicTasks.highImpact,
      strategic: deterministicTasks.strategic,
      optimization: deterministicTasks.optimization,
    },
    timeSequencedPlan: {
      stabilization: {
        label: "Days 1–3: Stabilization",
        dayRange: "1-3",
        category: "Critical",
        tasks: deterministicTasks.critical,
      },
      costOptimization: {
        label: "Days 4–10: Cost Optimization",
        dayRange: "4-10",
        category: "High Impact",
        tasks: deterministicTasks.highImpact,
      },
      deploymentAcceleration: {
        label: "Days 11–20: Deployment Acceleration",
        dayRange: "11-20",
        category: "Strategic",
        tasks: deterministicTasks.strategic,
      },
      scalabilityHardening: {
        label: "Days 21–30: Scalability Hardening",
        dayRange: "21-30",
        category: "Optimization",
        tasks: deterministicTasks.optimization,
      },
    },
  };

  return {
    scores,
    plan,
    trendSignals: [],
    driftSignals: [],
  };
}

