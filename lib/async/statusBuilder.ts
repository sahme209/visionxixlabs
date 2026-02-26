import type { Lead } from "@prisma/client";
import {
  canDownloadConfigs,
  canViewTechnicalOutputs,
  hasContinuousReassessment,
  hasEnterpriseEngagement,
  resolveOperatorTier,
} from "@/lib/cloudOperator/pricing";
import type { OperatorTier } from "@/lib/cloudOperator/types";
import { canViewFullOutput, canDownload } from "@/lib/cloudStudio/pricing";
import type { CloudStudioTier } from "@/lib/cloudStudio/types";
import { resolveTier as resolveWebsiteTier } from "@/lib/websiteBuildPricing";
import type { AxiomResult, ThirtyDayPlan } from "@/lib/axiom/infrastructureAdvantage";

type EngineType = "operator" | "cloud-studio" | "website";

type BuildEngineStatusResponseArgs = {
  lead: Lead;
  engineType: EngineType;
  /**
   * Optional pre-resolved tier string. If omitted, the helper will derive
   * tier from the stored payload using the appropriate resolver.
   */
  tier?: string;
  /**
   * Optional payload override; if not provided, lead.fullPayload is used.
   */
  payloadOverride?: Record<string, unknown>;
};

/**
 * Shared helper to build normalized engine status responses across different
 * flows (Cloud Operator, Cloud Studio, Website Builder) without changing
 * existing response field names.
 *
 * Responsibilities:
 * - Normalize outputStatus
 * - Apply tier gating helpers
 * - Expose Axiom / infrastructure metrics in a consistent way
 */
export function buildEngineStatusResponse({
  lead,
  engineType,
  tier,
  payloadOverride,
}: BuildEngineStatusResponseArgs): Record<string, unknown> {
  const payload = payloadOverride ?? ((lead.fullPayload as Record<string, unknown>) || {});
  const outputStatus = (payload.outputStatus as string) || "pending";

  if (engineType === "operator") {
    const resolvedTier =
      (tier as OperatorTier | undefined) ??
      (resolveOperatorTier(payload.tier as string | undefined) as OperatorTier);

    const operatorOutput = payload.operatorOutput as
      | {
          launch?: Record<string, unknown>;
          optimize?: { estimatedAnnualSavings?: number | null; [k: string]: unknown };
          secure?: Record<string, unknown>;
          business?: { businessImpactSummary?: string; recommendedNextAction?: string };
          detections?: Record<string, unknown>;
          recommendedImprovements?: string[];
          scores?: {
            infrastructureReadinessScore?: number;
            costEfficiencyScore?: number;
            securityRiskLevel?: string;
            ciCdMaturityScore?: number;
            architectureComplexityTier?: string;
            estimatedAnnualSavings?: number | null;
          } | null;
        }
      | null
      | undefined;

    const rawAxiomResult = payload.axiomResult as
      | (AxiomResult | ThirtyDayPlan)
      | null
      | undefined;

    const axiomScoresExplicit = (payload.axiomScores as
      | {
          infrastructureScore: number;
          estimatedAnnualSavings: number | null;
          riskExposureLevel: string;
          deploymentFrictionIndex: number;
          complexityTier: string;
          automationReadinessScore: number;
        }
      | null
      | undefined) || null;

    const axiomPlanExplicit = payload.axiomPlan as ThirtyDayPlan | null | undefined;

    let axiomScores =
      axiomScoresExplicit ||
      (rawAxiomResult && "scores" in rawAxiomResult
        ? {
            infrastructureScore: rawAxiomResult.scores.infrastructureScore,
            estimatedAnnualSavings: rawAxiomResult.scores.estimatedAnnualSavings,
            riskExposureLevel: rawAxiomResult.scores.riskExposureLevel,
            deploymentFrictionIndex: rawAxiomResult.scores.deploymentFrictionIndex,
            complexityTier: rawAxiomResult.scores.complexityTier,
            automationReadinessScore: rawAxiomResult.scores.automationReadinessScore,
          }
        : null);

    const axiomPlan =
      axiomPlanExplicit ||
      (rawAxiomResult && "plan" in rawAxiomResult
        ? rawAxiomResult.plan
        : (rawAxiomResult as ThirtyDayPlan | null | undefined) || null);

    const scores = operatorOutput?.scores || null;

    // Optional trend tracking based on previous Axiom scores history.
    const axiomHistory = payload.axiomHistory as
      | {
          scores?: {
            infrastructureScore?: number;
            estimatedAnnualSavings?: number | null;
            riskExposureLevel?: string;
          } | null;
        }[]
      | null
      | undefined;

    let trend: { scoreDelta: number | null; savingsDelta: number | null; riskDelta: number | null } | null =
      null;

    if (axiomScores && Array.isArray(axiomHistory) && axiomHistory.length > 0) {
      const lastEntry = axiomHistory[axiomHistory.length - 1];
      const lastScores = lastEntry?.scores || {};

      const currentScore = axiomScores.infrastructureScore ?? null;
      const previousScore =
        typeof lastScores.infrastructureScore === "number" ? lastScores.infrastructureScore : null;

      const currentSavings = axiomScores.estimatedAnnualSavings ?? null;
      const previousSavings =
        typeof lastScores.estimatedAnnualSavings === "number"
          ? lastScores.estimatedAnnualSavings
          : null;

      const currentRisk = axiomScores.riskExposureLevel || null;
      const previousRisk = lastScores.riskExposureLevel || null;

      const scoreDelta =
        currentScore != null && previousScore != null ? currentScore - previousScore : null;
      const savingsDelta =
        currentSavings != null && previousSavings != null
          ? currentSavings - previousSavings
          : null;

      const riskDelta =
        currentRisk && previousRisk && currentRisk !== previousRisk
          ? 0 // placeholder numeric delta; exact interpretation left to clients
          : null;

      trend = { scoreDelta, savingsDelta, riskDelta };
    }

    const base: Record<string, unknown> = {
      outputStatus,
      tier: resolvedTier,
      canViewTechnicalOutputs: canViewTechnicalOutputs(resolvedTier),
      canDownloadConfigs: canDownloadConfigs(resolvedTier),
      hasContinuousReassessment: hasContinuousReassessment(resolvedTier),
      hasEnterpriseEngagement: hasEnterpriseEngagement(resolvedTier),
      infrastructureReadinessScore: scores?.infrastructureReadinessScore ?? null,
      costEfficiencyScore: scores?.costEfficiencyScore ?? null,
      securityRiskLevel: scores?.securityRiskLevel ?? null,
      ciCdMaturityScore: scores?.ciCdMaturityScore ?? null,
      architectureComplexity: scores?.architectureComplexityTier ?? null,
      estimatedAnnualSavings:
        scores?.estimatedAnnualSavings ??
        operatorOutput?.optimize?.estimatedAnnualSavings ??
        null,
      infrastructureScore:
        axiomScores?.infrastructureScore ?? scores?.infrastructureReadinessScore ?? null,
      axiomEstimatedAnnualSavings:
        axiomScores?.estimatedAnnualSavings ??
        scores?.estimatedAnnualSavings ??
        operatorOutput?.optimize?.estimatedAnnualSavings ??
        null,
      riskExposureLevel: axiomScores?.riskExposureLevel ?? scores?.securityRiskLevel ?? null,
      deploymentFrictionIndex: axiomScores?.deploymentFrictionIndex ?? null,
      complexityTier: axiomScores?.complexityTier ?? scores?.architectureComplexityTier ?? null,
      automationReadinessScore: axiomScores?.automationReadinessScore ?? null,
      trend,
    };

    // Tier-gated 30-Day roadmap exposure
    if (axiomPlan && canViewTechnicalOutputs(resolvedTier)) {
      base.axiomPlan = axiomPlan;
    }

    return base;
  }

  if (engineType === "cloud-studio") {
    const resolvedTier = ((tier as CloudStudioTier | undefined) || "free") as CloudStudioTier;
    const output = payload.output as Record<string, unknown> | null;
    const cloudIntelligence = payload.cloudIntelligence as
      | Record<string, unknown>
      | null
      | undefined;

    const rawAxiomResult = payload.axiomResult as
      | (AxiomResult | ThirtyDayPlan)
      | null
      | undefined;

    const axiomScoresExplicit = (payload.axiomScores as
      | {
          infrastructureScore: number;
          estimatedAnnualSavings: number | null;
          riskExposureLevel: string;
          deploymentFrictionIndex: number;
          complexityTier: string;
          automationReadinessScore: number;
        }
      | null
      | undefined) || null;

    const axiomPlanExplicit = payload.axiomPlan as ThirtyDayPlan | null | undefined;

    let axiomScores =
      axiomScoresExplicit ||
      (rawAxiomResult && "scores" in rawAxiomResult
        ? {
            infrastructureScore: rawAxiomResult.scores.infrastructureScore,
            estimatedAnnualSavings: rawAxiomResult.scores.estimatedAnnualSavings,
            riskExposureLevel: rawAxiomResult.scores.riskExposureLevel,
            deploymentFrictionIndex: rawAxiomResult.scores.deploymentFrictionIndex,
            complexityTier: rawAxiomResult.scores.complexityTier,
            automationReadinessScore: rawAxiomResult.scores.automationReadinessScore,
          }
        : null);

    const axiomPlan =
      axiomPlanExplicit ||
      (rawAxiomResult && "plan" in rawAxiomResult
        ? rawAxiomResult.plan
        : (rawAxiomResult as ThirtyDayPlan | null | undefined) || null);

    const base: Record<string, unknown> = {
      outputStatus,
      serviceType: payload.serviceType,
      tier: resolvedTier,
      canViewFullOutput: canViewFullOutput(resolvedTier),
      canDownload: canDownload(resolvedTier),
      cloudIntelligence: cloudIntelligence || null,
      infrastructureScore: axiomScores?.infrastructureScore ?? null,
      axiomEstimatedAnnualSavings: axiomScores?.estimatedAnnualSavings ?? null,
      riskExposureLevel: axiomScores?.riskExposureLevel ?? null,
      deploymentFrictionIndex: axiomScores?.deploymentFrictionIndex ?? null,
      complexityTier: axiomScores?.complexityTier ?? null,
      automationReadinessScore: axiomScores?.automationReadinessScore ?? null,
    };

    // Tier-gated 30-Day roadmap exposure (aligned with Cloud Operator semantics)
    if (axiomPlan && canViewFullOutput(resolvedTier)) {
      base.axiomPlan = axiomPlan;
    }

    // Preserve existing output-derived fields for consumers if present.
    if (output) {
      base.summary = output.summary;
      if (canViewFullOutput(resolvedTier)) {
        base.fullOutput = output.fullOutput;
        base.artifacts = output.artifacts;
      }
      base.generatedAt = output.generatedAt;
    }

    return base;
  }

  // Website builder / generic lead status
  const payloadForm = (payload.form as Record<string, unknown>) || {};
  const previewUrl = payload.previewUrl as string | undefined;
  const infrastructure = (payload.infrastructure as Record<string, unknown>) || {};

  const resolvedTier = resolveWebsiteTier((payloadForm.tier as string) || "starter");
  const tierConfig = { starter: 3, professional: 0, enterprise: 0 }[resolvedTier] ?? 3;
  const revisionCount = (payload.revisionCount as number) || 0;
  const revisionsRemaining = tierConfig > 0 ? Math.max(0, tierConfig - revisionCount) : null;

  return {
    outputStatus,
    previewUrl: previewUrl || null,
    packageReady:
      lead.status === "package_ready" ||
      lead.status === "deploy_ready" ||
      lead.status === "deploy_generating" ||
      lead.status === "published",
    deployReady: lead.status === "deploy_ready" || lead.status === "published",
    revisionsRemaining,
    infrastructure: {
      cloudProvider: infrastructure.cloudProvider || "managed",
      cdnEnabled: infrastructure.cdnEnabled ?? (resolvedTier !== "starter"),
      sslEnabled: infrastructure.sslEnabled ?? true,
      cicdEnabled:
        infrastructure.cicdEnabled ??
        (resolvedTier === "professional" || resolvedTier === "enterprise"),
      securityLevel:
        infrastructure.securityLevel ||
        (resolvedTier === "enterprise"
          ? "hardened"
          : resolvedTier === "professional"
          ? "standard"
          : "basic"),
      addOns: infrastructure.addOns || [],
    },
    form: {
      hasDomain: payloadForm.hasDomain,
      domainName: payloadForm.domainName,
    },
  };
}

