import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyStarterToken } from "@/lib/starterToken";
import {
  resolveOperatorTier,
  hasContinuousReassessment,
  canViewTechnicalOutputs,
  hasEnterpriseEngagement,
} from "@/lib/cloudOperator/pricing";
import { simulateImpact } from "@/lib/axiom/simulator";
import { generateEnterpriseBrief } from "@/lib/axiom/enterpriseBrief";
import { computeFinancialModel } from "@/lib/axiom/financialModel";
import { recommendUpgrade } from "@/lib/axiom/upgradeAdvisor";
import type { OperatorTier } from "@/lib/cloudOperator/types";
import { buildEngineStatusResponse } from "@/lib/async/statusBuilder";

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
    let tier = resolveOperatorTier(payload.tier as string | undefined) as OperatorTier;

    // Phase 6: One-time unlock treats this lead as Pro for roadmap/technical outputs
    const unlock = payload.unlock as {
      type?: string;
      paid?: boolean;
      expiresAt?: string;
    } | undefined;
    const isUnlocked =
      unlock?.type === "roadmap" &&
      unlock?.paid === true &&
      unlock?.expiresAt &&
      new Date(unlock.expiresAt) > new Date();
    if (isUnlocked && tier === "free") {
      tier = "pro";
    }

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

    const base = buildEngineStatusResponse({
      lead,
      engineType: "operator",
      tier,
      payloadOverride: payload,
    });

    const snapshots = await prisma.axiomScoreSnapshot.findMany({
      where: { leadId: lead.id },
      orderBy: { createdAt: "desc" },
      take: hasContinuousReassessment(tier) ? 10 : canViewTechnicalOutputs(tier) ? 2 : 0,
    });

    const rawAxiomResult = payload.axiomResult as {
      scores?: Record<string, unknown>;
      plan?: Record<string, unknown>;
      driftSignals?: { signals: string[] };
      playbooks?: Record<string, unknown>;
      quality?: { pass: boolean; issues: string[] };
      policyPack?: Record<string, unknown>;
    } | null | undefined;
    const driftSignals = rawAxiomResult?.driftSignals;
    if (hasContinuousReassessment(tier) && driftSignals) {
      (base as Record<string, unknown>).driftSignals = driftSignals;
    }

    const axiomScores = rawAxiomResult?.scores;
    const axiomPlan = rawAxiomResult?.plan ?? payload.axiomPlan;
    if (canViewTechnicalOutputs(tier) && axiomScores && axiomPlan) {
      try {
        const sim = simulateImpact(
          axiomScores as Parameters<typeof simulateImpact>[0],
          axiomPlan as Parameters<typeof simulateImpact>[1]
        );
        (base as Record<string, unknown>).simulation = sim;
      } catch {
        // non-fatal
      }
    }

    if (snapshots.length > 0) {
      if (hasContinuousReassessment(tier)) {
        (base as Record<string, unknown>).trendHistory = snapshots.map((s) => ({
          id: s.id,
          createdAt: s.createdAt.toISOString(),
          tier: s.tier,
          provider: s.provider,
          infrastructureScore: s.infrastructureScore,
          estimatedAnnualSavings: s.estimatedAnnualSavings,
          riskExposureLevel: s.riskExposureLevel,
          deploymentFrictionIndex: s.deploymentFrictionIndex,
          complexityTier: s.complexityTier,
          automationReadinessScore: s.automationReadinessScore,
        }));
      } else if (canViewTechnicalOutputs(tier) && snapshots.length >= 2) {
        const [current, previous] = snapshots;
        (base as Record<string, unknown>).trendHistory = {
          lastDelta: {
            scoreDelta:
              current.infrastructureScore != null && previous.infrastructureScore != null
                ? current.infrastructureScore - previous.infrastructureScore
                : null,
            savingsDelta:
              current.estimatedAnnualSavings != null && previous.estimatedAnnualSavings != null
                ? current.estimatedAnnualSavings - previous.estimatedAnnualSavings
                : null,
          },
        };
      }
    }

    const engine = payload.engine as { scoringVersion?: string } | undefined;
    const response: Record<string, unknown> = {
      leadId: lead.id,
      status: lead.status,
      scoringVersion: engine?.scoringVersion ?? null,
      ...base,
      recommendedImprovements: operatorOutput?.recommendedImprovements ?? [],
      businessImpactSummary: operatorOutput?.business?.businessImpactSummary ?? "",
      recommendedNextAction: operatorOutput?.business?.recommendedNextAction ?? "",
    };

    if (operatorOutput && (response.canViewTechnicalOutputs as boolean)) {
      response.launch = operatorOutput.launch ?? null;
      response.optimize = operatorOutput.optimize ?? null;
      response.secure = operatorOutput.secure ?? null;
      response.detections = operatorOutput.detections ?? null;
    }

    // Phase 5: Quality gate badge (all tiers)
    if (rawAxiomResult?.quality) {
      response.quality = rawAxiomResult.quality;
    }

    // Phase 7: Score explainability (all tiers)
    if (rawAxiomResult?.explainability) {
      response.explainability = rawAxiomResult.explainability;
    }

    // Phase 8: Strategic Readiness Score (all tiers)
    const scores = rawAxiomResult?.scores as Record<string, unknown> | undefined;
    if (scores?.strategicReadinessScore != null) {
      response.strategicReadinessScore = scores.strategicReadinessScore;
    }

    // Phase 9: Enterprise Readiness Index (all tiers)
    if (scores?.enterpriseReadinessIndex != null) {
      response.enterpriseReadinessIndex = scores.enterpriseReadinessIndex;
    }

    // Phase 9: Deal signals (Pro+)
    const dealSignals = rawAxiomResult?.dealSignals as {
      urgencyLevel?: string;
      expansionProbability?: number;
      enterpriseLikelihood?: number;
      recommendedSalesAngle?: string[];
    } | undefined;
    if (canViewTechnicalOutputs(tier) && dealSignals && axiomScores) {
      response.dealSignals = dealSignals;
      try {
        const rec = recommendUpgrade({
          currentTier: tier as "free" | "pro" | "growth" | "enterprise",
          dealSignals: dealSignals as Parameters<typeof recommendUpgrade>[0]["dealSignals"],
          axiomScores: axiomScores as Parameters<typeof recommendUpgrade>[0]["axiomScores"],
        });
        response.upgradeRecommendation = rec;
      } catch {
        // non-fatal
      }
    }

    // Phase 8: CFO financial model (Pro+)
    const scoresForFinancial = rawAxiomResult?.scores as Record<string, unknown> | undefined;
    if (canViewTechnicalOutputs(tier) && scoresForFinancial) {
      const financialModel = computeFinancialModel({
        estimatedAnnualSavings: scoresForFinancial.estimatedAnnualSavings as number | null,
        currentSpend: null,
        frictionIndex: scoresForFinancial.deploymentFrictionIndex as number,
        riskExposureLevel: scoresForFinancial.riskExposureLevel as string,
      });
      response.financialModel = financialModel;
    }

    // Phase 5: Playbooks — Pro+ full view; Free gets 2–3 step preview
    const canPro = canViewTechnicalOutputs(tier);
    if (rawAxiomResult?.playbooks && canPro) {
      response.playbooks = rawAxiomResult.playbooks;
    } else if (rawAxiomResult?.playbooks && !canPro) {
      const p = rawAxiomResult.playbooks as { phasePlaybooks?: Array<{ stepByStep?: Array<{ step: string }> }> };
      const first = p?.phasePlaybooks?.[0];
      const preview = first?.stepByStep?.slice(0, 3) ?? [];
      response.playbookPreview = preview.map((s) => s.step);
      response.playbookUpsell = "Upgrade to Pro+ to view full playbooks.";
    }

    // Phase 5: Policy pack — Enterprise full; Pro/Growth preview
    const canEnterprise = hasEnterpriseEngagement(tier);
    if (rawAxiomResult?.policyPack && canEnterprise) {
      response.policyPack = rawAxiomResult.policyPack;
    } else if (rawAxiomResult?.policyPack && !canEnterprise) {
      response.policyPackPreview = "IAM, network segmentation, logging, incident response templates available in Enterprise.";
    }

    // Phase 6: Enterprise Readiness Brief — Enterprise full; Free/Pro/Growth preview
    const axiomScoresObj = axiomScores as { infrastructureScore?: number; riskExposureLevel?: string; estimatedAnnualSavings?: number | null; deploymentFrictionIndex?: number; complexityTier?: string } | null | undefined;
    const trendObj = (base as Record<string, unknown>).trend as { scoreDelta?: number | null; savingsDelta?: number | null } | null | undefined;
    const brief = generateEnterpriseBrief(axiomScoresObj, rawAxiomResult?.driftSignals, trendObj);
    if (canEnterprise) {
      response.enterpriseBrief = brief;
    } else {
      response.enterpriseBriefPreview = {
        biggestRiskExposures: brief.biggestRiskExposures.slice(0, 2),
        biggestSavingsLevers: brief.biggestSavingsLevers.slice(0, 2),
        cta: "Request Enterprise Brief Review Call",
      };
    }

    return NextResponse.json(response);
  } catch (e) {
    console.error("[cloud-operator status]", e);
    return NextResponse.json({ error: "Failed to fetch status" }, { status: 500 });
  }
}

