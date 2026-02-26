import type { CloudOperatorScores } from "@/lib/cloudStudio/scoring";

export type OperatorTier = "free" | "pro" | "growth" | "enterprise";

export type OperatorProfile = {
  projectType: string;
  hostingProvider: string;
  monthlySpend: string;
  trafficLevel: "Low" | "Medium" | "High";
  hasCiCd: "yes" | "no";
  publicExposure: "API" | "Public Web" | "Internal Only" | "Other";
  complianceNeeds: string;
  gitProvider: "GitHub" | "GitLab" | "Bitbucket" | "None" | "Other";
  primaryGoal: "Launch faster" | "Reduce costs" | "Improve security" | "Scale architecture" | string;
};

export type LaunchModule = {
  architecturePlan?: string;
  ciCdYaml?: string;
  dockerfile?: string;
  deploymentSteps?: string[];
  cliCommands?: string[];
  terraformTemplates?: string[];
};

export type OptimizeModule = {
  costBreakdown?: string;
  estimatedAnnualSavings?: number | null;
  reservedInstanceSuggestions?: string[];
  storageTierChanges?: string[];
  scalingAdjustments?: string[];
};

export type SecureModule = {
  riskSummary?: string;
  iamRecommendations?: string;
  networkSegmentation?: string;
  hardeningChecklist?: string[];
  publicAttackSurfaceFindings?: string[];
};

export type BusinessModule = {
  businessImpactSummary?: string;
  implementationEffortHoursLow?: number | null;
  implementationEffortHoursHigh?: number | null;
  recommendedNextAction?: string;
};

export type DetectionSignals = {
  infrastructureAntiPatterns?: string[];
  overprovisioningSignals?: string[];
  idleResources?: string[];
  publicAttackSurface?: string[];
  deploymentBottlenecks?: string[];
  ciCdInefficiencies?: string[];
};

/** AI-generated task for 30-day plan phases */
export type PlanTask = {
  technicalAction: string;
  businessImpact: string;
  estimatedImprovementEffect: string;
};

/** AI-generated phase with tasks */
export type CustomPlanPhase = {
  label: string;
  dayRange: string;
  category: string;
  tasks: PlanTask[];
};

/** AI-generated 30-day plan (overrides deterministic templates when present) */
export type CustomThirtyDayPlan = {
  stabilization?: CustomPlanPhase;
  costOptimization?: CustomPlanPhase;
  deploymentAcceleration?: CustomPlanPhase;
  scalabilityHardening?: CustomPlanPhase;
};

export type OperatorEngineOutput = {
  launch?: LaunchModule;
  optimize?: OptimizeModule;
  secure?: SecureModule;
  business?: BusinessModule;
  detections?: DetectionSignals;
  recommendedImprovements?: string[];
  thirtyDayPlan?: CustomThirtyDayPlan;
  scores?: CloudOperatorScores;
  generatedAt?: string;
};

