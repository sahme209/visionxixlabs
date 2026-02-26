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
  /** Phase 8: Strategic meta-metric (0–100) for board-level readiness */
  strategicReadinessScore?: number;
  /** Phase 9: Enterprise readiness (0–100) for sales intelligence */
  enterpriseReadinessIndex?: number;
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

/** Phase 5: Quality gate from validators */
export type AxiomQuality = { pass: boolean; issues: string[] };

/** Phase 5: Playbook pack from 30-day plan (schema matches lib/axiom/playbooks.ts) */
export type AxiomPlaybooks = {
  phasePlaybooks: Array<{
    phaseName: string;
    objective: string;
    prerequisites: string[];
    stepByStep: Array<{ step: string; command?: string; file?: string; validation?: string }>;
    rollbackPlan: string[];
    successCriteria: string[];
  }>;
  cutoverChecklist: string[];
  ownerRoles: string[];
  estimatedEffortHours: number;
};

/** Phase 5: Policy pack (Enterprise only) */
export type AxiomPolicyPack = {
  iamTemplates: string[];
  networkSegmentation: string[];
  loggingMonitoring: string[];
  incidentResponse: string[];
};

export type AxiomResult = {
  scores: AxiomScores;
  plan: ThirtyDayPlan;
  // Simple placeholders for Growth/Enterprise features
  trendSignals?: string[];
  /** Phase 4: Full drift report from drift detector (Growth+) */
  driftSignals?: { hasDrift: boolean; driftLevel: string; signals: string[]; recommendedNextActions: string[] } | string[];
  /** Phase 9: Deal acceleration signals for sales intelligence */
  dealSignals?: import("./dealSignals").DealSignals;
  /** Phase 5: Playbooks generated from 30-day plan */
  playbooks?: AxiomPlaybooks;
  /** Phase 5: Quality gate (pass/issues) */
  quality?: AxiomQuality;
  /** Phase 5: Policy pack (Enterprise only) */
  policyPack?: AxiomPolicyPack;
  /** Phase 7: Deterministic score explainability */
  explainability?: import("./explainability").ScoreExplanation;
};

function computeStrategicReadinessScore(
  infrastructureScore: number,
  frictionIndex: number,
  riskLevel: string,
  automationReadiness: number,
  complexityTier: string
): number {
  const riskScore = riskLevel === "High" ? 0 : riskLevel === "Medium" ? 50 : 100;
  const frictionScore = Math.max(0, 100 - frictionIndex);
  const complianceMaturity = complexityTier === "Enterprise" ? 70 : complexityTier === "Growth" ? 60 : 50;
  const raw =
    infrastructureScore * 0.3 +
    frictionScore * 0.15 +
    riskScore * 0.2 +
    automationReadiness * 0.25 +
    complianceMaturity * 0.1;
  return Math.round(Math.min(100, Math.max(0, raw)));
}

/** Phase 9: Enterprise Readiness Index (0–100) for sales intelligence */
export function computeEnterpriseReadinessIndex(params: {
  complianceMaturity: number; // 0–100 from complexityTier
  multiRegionComplexity: number; // 0–100, Enterprise=80 Growth=50 else=30
  automationReadiness: number;
  driftDetected: boolean;
  trendVolatilityScore: number; // 0–100, 0=none
  monthlySpendProxy: number;
}): number {
  const { complianceMaturity, multiRegionComplexity, automationReadiness, driftDetected, trendVolatilityScore, monthlySpendProxy } = params;
  const driftPenalty = driftDetected ? 15 : 0;
  const spendScore = monthlySpendProxy > 100000 ? 90 : monthlySpendProxy > 50000 ? 70 : monthlySpendProxy > 20000 ? 50 : 30;
  const raw =
    complianceMaturity * 0.2 +
    multiRegionComplexity * 0.15 +
    automationReadiness * 0.25 +
    (100 - driftPenalty) * 0.1 +
    Math.min(100, trendVolatilityScore + 50) * 0.1 +
    spendScore * 0.2;
  return Math.round(Math.min(100, Math.max(0, raw)));
}

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

/** AI-generated phase; maps to PlanPhase when valid */
function toPlanPhase(
  custom: { label?: string; dayRange?: string; category?: string; tasks?: Array<{ technicalAction: string; businessImpact: string; estimatedImprovementEffect: string }> } | undefined,
  fallback: PlanPhase
): PlanPhase {
  if (!custom?.tasks?.length) return fallback;
  return {
    label: custom.label || fallback.label,
    dayRange: custom.dayRange || fallback.dayRange,
    category: (custom.category as PlanPhase["category"]) || fallback.category,
    tasks: custom.tasks.map((t) => ({
      technicalAction: t.technicalAction || "",
      businessImpact: t.businessImpact || "",
      estimatedImprovementEffect: t.estimatedImprovementEffect || "",
    })),
  };
}

export function generateInfrastructureAdvantageModel(
  profile: AxiomProfile,
  existingScores?: CloudOperatorScores | null,
  customPlan?: {
    stabilization?: { label?: string; dayRange?: string; category?: string; tasks?: PlanTask[] };
    costOptimization?: { label?: string; dayRange?: string; category?: string; tasks?: PlanTask[] };
    deploymentAcceleration?: { label?: string; dayRange?: string; category?: string; tasks?: PlanTask[] };
    scalabilityHardening?: { label?: string; dayRange?: string; category?: string; tasks?: PlanTask[] };
  } | null
): AxiomResult {
  const operatorScores = existingScores ?? computeCloudOperatorScores(profile);

  const infrastructureScore = computeInfrastructureScore(operatorScores);
  const deploymentFrictionIndex = computeDeploymentFrictionIndex(operatorScores);
  const automationReadinessScore = computeAutomationReadinessScore(profile, operatorScores);

  const strategicReadinessScore = computeStrategicReadinessScore(
    infrastructureScore,
    deploymentFrictionIndex,
    operatorScores.securityRiskLevel,
    automationReadinessScore,
    operatorScores.architectureComplexityTier
  );

  const scores: AxiomScores = {
    infrastructureScore,
    estimatedAnnualSavings: operatorScores.estimatedAnnualSavings,
    riskExposureLevel: operatorScores.securityRiskLevel,
    deploymentFrictionIndex,
    complexityTier: operatorScores.architectureComplexityTier,
    automationReadinessScore,
    strategicReadinessScore,
    operatorScores,
  };

  const deterministicTasks = buildDeterministicTasks(profile, operatorScores);

  const baseStabilization: PlanPhase = { label: "Days 1–3: Stabilization", dayRange: "1-3", category: "Critical", tasks: deterministicTasks.critical };
  const baseCost: PlanPhase = { label: "Days 4–10: Cost Optimization", dayRange: "4-10", category: "High Impact", tasks: deterministicTasks.highImpact };
  const baseDeploy: PlanPhase = { label: "Days 11–20: Deployment Acceleration", dayRange: "11-20", category: "Strategic", tasks: deterministicTasks.strategic };
  const baseScale: PlanPhase = { label: "Days 21–30: Scalability Hardening", dayRange: "21-30", category: "Optimization", tasks: deterministicTasks.optimization };

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
      stabilization: toPlanPhase(customPlan?.stabilization, baseStabilization),
      costOptimization: toPlanPhase(customPlan?.costOptimization, baseCost),
      deploymentAcceleration: toPlanPhase(customPlan?.deploymentAcceleration, baseDeploy),
      scalabilityHardening: toPlanPhase(customPlan?.scalabilityHardening, baseScale),
    },
  };

  return {
    scores,
    plan,
    trendSignals: [],
    driftSignals: [],
  };
}

