import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyStarterToken } from "@/lib/starterToken";
import {
  canDownloadConfigs,
  canViewTechnicalOutputs,
  hasContinuousReassessment,
  hasEnterpriseEngagement,
  resolveOperatorTier,
} from "@/lib/cloudOperator/pricing";
import type { OperatorTier } from "@/lib/cloudOperator/types";

/**
 * GET /api/cloud-operator/status?token=XXX
 * Returns status and output for the AI Cloud Operator request.
 * Tier-gates access to technical outputs and downloads.
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.json({ error: "Token required" }, { status: 400 });
  }

  const result = verifyStarterToken(token);
  if ("error" in result) {
    return NextResponse.json(
      { error: result.error === "expired" ? "Token expired" : "Invalid token" },
      { status: 401 }
    );
  }

  try {
    const lead = await prisma.lead.findUnique({
      where: { id: result.leadId },
    });

    if (!lead || lead.source !== "cloud-operator") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const payload = (lead.fullPayload as Record<string, unknown>) || {};
    const tier = resolveOperatorTier(payload.tier as string | undefined) as OperatorTier;
    const outputStatus = (payload.outputStatus as string) || "pending";

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
      | (import("@/lib/axiom/infrastructureAdvantage").AxiomResult | import("@/lib/axiom/infrastructureAdvantage").ThirtyDayPlan)
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

    const axiomPlanExplicit = payload.axiomPlan as
      | import("@/lib/axiom/infrastructureAdvantage").ThirtyDayPlan
      | null
      | undefined;

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
        : (rawAxiomResult as import("@/lib/axiom/infrastructureAdvantage").ThirtyDayPlan | null | undefined) || null);

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

    const response: Record<string, unknown> = {
      leadId: lead.id,
      status: lead.status,
      outputStatus,
      tier,
      canViewTechnicalOutputs: canViewTechnicalOutputs(tier),
      canDownloadConfigs: canDownloadConfigs(tier),
      hasContinuousReassessment: hasContinuousReassessment(tier),
      hasEnterpriseEngagement: hasEnterpriseEngagement(tier),
      infrastructureReadinessScore: scores?.infrastructureReadinessScore ?? null,
      costEfficiencyScore: scores?.costEfficiencyScore ?? null,
      securityRiskLevel: scores?.securityRiskLevel ?? null,
      ciCdMaturityScore: scores?.ciCdMaturityScore ?? null,
      architectureComplexity: scores?.architectureComplexityTier ?? null,
      estimatedAnnualSavings:
        scores?.estimatedAnnualSavings ??
        operatorOutput?.optimize?.estimatedAnnualSavings ??
        null,
      // Axiom Executive Summary – always returned
      infrastructureScore: axiomScores?.infrastructureScore ?? scores?.infrastructureReadinessScore ?? null,
      axiomEstimatedAnnualSavings:
        axiomScores?.estimatedAnnualSavings ??
        scores?.estimatedAnnualSavings ??
        operatorOutput?.optimize?.estimatedAnnualSavings ??
        null,
      riskExposureLevel: axiomScores?.riskExposureLevel ?? scores?.securityRiskLevel ?? null,
      deploymentFrictionIndex: axiomScores?.deploymentFrictionIndex ?? null,
      complexityTier: axiomScores?.complexityTier ?? scores?.architectureComplexityTier ?? null,
      automationReadinessScore: axiomScores?.automationReadinessScore ?? null,
      recommendedImprovements: operatorOutput?.recommendedImprovements ?? [],
      businessImpactSummary: operatorOutput?.business?.businessImpactSummary ?? "",
      recommendedNextAction: operatorOutput?.business?.recommendedNextAction ?? "",
      trend,
    };

    // Tier-gated 30-Day roadmap exposure
    if (axiomPlan && canViewTechnicalOutputs(tier)) {
      response.axiomPlan = axiomPlan;
    }

    if (operatorOutput && canViewTechnicalOutputs(tier)) {
      response.launch = operatorOutput.launch ?? null;
      response.optimize = operatorOutput.optimize ?? null;
      response.secure = operatorOutput.secure ?? null;
      response.detections = operatorOutput.detections ?? null;
    }

    return NextResponse.json(response);
  } catch (e) {
    console.error("[cloud-operator status]", e);
    return NextResponse.json({ error: "Failed to fetch status" }, { status: 500 });
  }
}

