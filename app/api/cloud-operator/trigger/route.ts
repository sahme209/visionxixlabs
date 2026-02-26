import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyStarterToken } from "@/lib/starterToken";
import { checkRateLimit } from "@/lib/rateLimit";
import { checkTieredRateLimit } from "@/lib/rateLimitTiered";
import { generateOperatorEngineOutput } from "@/lib/cloudOperator/generate";
import { resolveOperatorTier } from "@/lib/cloudOperator/pricing";
import type { OperatorProfile, OperatorTier } from "@/lib/cloudOperator/types";
import { runAsyncLeadEngine } from "@/lib/async/engineRunner";
import {
  computeInfrastructureAdvantageScore,
  computeOperatorScores,
  SCORING_VERSION,
} from "@/lib/axiom/scoringRegistry";
import { detectDrift } from "@/lib/axiom/driftDetector";
import { insertAxiomSnapshot } from "@/lib/axiom/snapshotService";
import { generatePlaybooks } from "@/lib/axiom/playbooks";
import { generatePolicyPacks } from "@/lib/axiom/policyPacks";
import {
  validateGithubActionsYaml,
  validateTerraform,
  validateDockerfile,
  validateSecurityChecklist,
} from "@/lib/axiom/validators";
import { hasEnterpriseEngagement } from "@/lib/cloudOperator/pricing";
import { logAudit } from "@/lib/security/auditLog";
import { generateScoreExplanation } from "@/lib/axiom/explainability";
import { generateDealSignals, deriveTagsFromDealSignals } from "@/lib/axiom/dealSignals";
import { computeEnterpriseReadinessIndex } from "@/lib/axiom/infrastructureAdvantage";
import { eventEngineTriggered, eventEngineCompleted, eventEngineFailed, eventDriftDetected } from "@/lib/observability/events";
import type { OperatorProfileInput } from "@/lib/cloudStudio/scoring";

type Generated = {
  operatorOutput: Awaited<ReturnType<typeof generateOperatorEngineOutput>>;
  operatorScores: ReturnType<typeof computeOperatorScores>;
  axiom: ReturnType<typeof computeInfrastructureAdvantageScore>;
  rawProfile: Record<string, unknown>;
  profile: OperatorProfile;
  tier: OperatorTier;
};

/**
 * POST /api/cloud-operator/trigger?token=XXX
 * Generates AI Cloud Operator output for the request.
 * Stores result in fullPayload.operatorOutput and fullPayload.operatorScores.
 */
export async function POST(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.json({ error: "Token required" }, { status: 400 });
  }

  if (!checkRateLimit(`cloud-operator-trigger:${token.slice(0, 32)}`)) {
    return NextResponse.json(
      { error: "Too many requests. Please try again in a minute." },
      { status: 429 }
    );
  }

  const result = verifyStarterToken(token);
  if ("error" in result) {
    return NextResponse.json(
      { error: result.error === "expired" ? "Token expired" : "Invalid token" },
      { status: 401 }
    );
  }

  const leadId = result.leadId;

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "anon";
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  const tierForRate = resolveOperatorTier((lead?.fullPayload as Record<string, unknown>)?.tier as string);
  if (!checkTieredRateLimit(tierForRate, ip)) {
    return NextResponse.json(
      { error: "Too many requests. Please try again in a minute." },
      { status: 429 }
    );
  }

  eventEngineTriggered({ leadId, engineName: "cloud-operator", tier: tierForRate, unifiedTier: tierForRate, scoringVersion: SCORING_VERSION });

  try {
    const { generated } = await runAsyncLeadEngine<Generated>({
      leadId,
      engineName: "cloud-operator",
      expectedSource: "cloud-operator",
      getTier: (_, payload) =>
        String(resolveOperatorTier((payload.tier as string) || "free")),
      isReady: (payload) => !!payload.operatorOutput,
      getExistingResult: (payload) => {
        const o = payload.operatorOutput;
        const a = payload.axiomResult;
        if (!o || !a) return null;
        return {
          operatorOutput: o as Generated["operatorOutput"],
          operatorScores: (payload.operatorScores as Generated["operatorScores"]) || (o as any).scores,
          axiom: a as Generated["axiom"],
          rawProfile: (payload.operatorProfile as Record<string, unknown>) || {},
          profile: {} as OperatorProfile,
          tier: resolveOperatorTier((payload.tier as string) || "free") as OperatorTier,
        };
      },
      async generate({ lead, tier, payload }) {
        const rawProfile = (payload.operatorProfile as Record<string, unknown>) || {};
        const tierResolved = resolveOperatorTier((payload.tier as string) || "free") as OperatorTier;

        const profile: OperatorProfile = {
          projectType: String(rawProfile.projectType ?? "").trim(),
          hostingProvider: String(rawProfile.hostingProvider ?? "").trim(),
          monthlySpend: String(rawProfile.monthlySpend ?? "").trim(),
          trafficLevel: (String(rawProfile.trafficLevel ?? "Low").trim() || "Low") as
            | "Low"
            | "Medium"
            | "High",
          hasCiCd: (String(rawProfile.hasCiCd ?? "no").trim().toLowerCase() === "yes"
            ? "yes"
            : "no") as "yes" | "no",
          publicExposure: (String(rawProfile.publicExposure ?? "Internal Only").trim() ||
            "Internal Only") as "API" | "Public Web" | "Internal Only" | "Other",
          complianceNeeds: String(rawProfile.complianceNeeds ?? "").trim(),
          gitProvider: (String(rawProfile.gitProvider ?? "None").trim() || "None") as
            | "GitHub"
            | "GitLab"
            | "Bitbucket"
            | "None"
            | "Other",
          primaryGoal: String(rawProfile.primaryGoal ?? "").trim(),
        };

        const operatorOutput = await generateOperatorEngineOutput(profile, tierResolved);
        const operatorInput: OperatorProfileInput = {
          projectType: profile.projectType,
          hostingProvider: profile.hostingProvider,
          monthlySpend: profile.monthlySpend,
          trafficLevel: profile.trafficLevel,
          hasCiCd: profile.hasCiCd,
          publicExposure: profile.publicExposure,
          complianceNeeds: profile.complianceNeeds,
          gitProvider: profile.gitProvider,
          primaryGoal: profile.primaryGoal,
        };
        const operatorScores = computeOperatorScores(operatorInput);

        const axiomProfile = { ...profile, contextType: "operator" as const };
        const axiom = computeInfrastructureAdvantageScore(axiomProfile, operatorScores);

        return {
          operatorOutput,
          operatorScores,
          axiom,
          rawProfile,
          profile,
          tier: tierResolved,
        };
      },
      persist({ tier, result }) {
        const { operatorOutput, operatorScores, axiom, rawProfile, profile } = result;
        return {
          operatorProfile: rawProfile,
          operatorOutput,
          operatorScores,
          axiomProfile: { ...profile, contextType: "operator" as const },
          axiomScores: axiom.scores,
          axiomResult: axiom,
          axiomPlan: axiom.plan,
          engine: {
            scores: operatorScores,
            axiomScores: axiom.scores,
            roadmap: axiom.plan,
            scoringVersion: SCORING_VERSION,
          },
        };
      },
    });

    const { operatorOutput, axiom, profile, tier: tierResolved } = generated;

    const lastSnapshot = await prisma.axiomScoreSnapshot.findFirst({
      where: { leadId },
      orderBy: { createdAt: "desc" },
    });
    const drift = detectDrift(profile, (lastSnapshot?.raw as Record<string, unknown>) ?? null);
    let axiomFinal =
      drift.signals.length > 0
        ? { ...axiom, driftSignals: drift }
        : axiom;

    const playbooks = generatePlaybooks(axiom.plan);
    const qualityIssues: string[] = [];
    const launch = (generated.operatorOutput as { launch?: Record<string, unknown> })?.launch;
    const secure = (generated.operatorOutput as { secure?: Record<string, unknown> })?.secure;
    const ciCdYaml = launch?.ciCdYaml as string | undefined;
    const dockerfile = launch?.dockerfile as string | undefined;
    const terraformTemplates = launch?.terraformTemplates as string[] | undefined;
    const hardeningChecklist = secure?.hardeningChecklist as string[] | undefined;
    const checklistText = Array.isArray(hardeningChecklist)
      ? hardeningChecklist.map((c) => `- ${c}`).join("\n")
      : "";

    const v1 = validateGithubActionsYaml(ciCdYaml);
    if (!v1.valid) qualityIssues.push(...v1.issues.map((i) => `CI/CD: ${i}`));
    const v2 = validateDockerfile(dockerfile);
    if (!v2.valid) qualityIssues.push(...v2.issues.map((i) => `Dockerfile: ${i}`));
    const terraformContent = Array.isArray(terraformTemplates)
      ? terraformTemplates.join("\n")
      : "";
    const v3 = validateTerraform(terraformContent);
    if (!v3.valid) qualityIssues.push(...v3.issues.map((i) => `Terraform: ${i}`));
    const v4 = validateSecurityChecklist(checklistText);
    if (!v4.valid) qualityIssues.push(...v4.issues.map((i) => `Checklist: ${i}`));

    const explainability = generateScoreExplanation(
      { projectType: profile.projectType, hostingProvider: profile.hostingProvider, monthlySpend: profile.monthlySpend, trafficLevel: profile.trafficLevel, hasCiCd: profile.hasCiCd, publicExposure: profile.publicExposure, complianceNeeds: profile.complianceNeeds, gitProvider: profile.gitProvider, primaryGoal: profile.primaryGoal },
      generated.operatorScores
    );

    axiomFinal = {
      ...axiomFinal,
      playbooks,
      quality: { pass: qualityIssues.length === 0, issues: qualityIssues },
      explainability,
    };

    if (hasEnterpriseEngagement(tierResolved)) {
      axiomFinal = { ...axiomFinal, policyPack: generatePolicyPacks() };
    }

    const dealSignals = generateDealSignals({
      axiomScores: axiomFinal.scores,
      strategicReadinessScore: axiomFinal.scores.strategicReadinessScore,
      driftSignals: axiomFinal.driftSignals && typeof axiomFinal.driftSignals === "object" && "hasDrift" in axiomFinal.driftSignals
        ? { hasDrift: axiomFinal.driftSignals.hasDrift, driftLevel: axiomFinal.driftSignals.driftLevel }
        : undefined,
      tier: tierResolved,
      organizationSize: undefined,
      monthlySpend: profile.monthlySpend,
    });
    axiomFinal = { ...axiomFinal, dealSignals };

    const tags = deriveTagsFromDealSignals(dealSignals, axiomFinal.scores);

    const complianceMaturity = axiom.scores.complexityTier === "Enterprise" ? 70 : axiom.scores.complexityTier === "Growth" ? 60 : 50;
    const multiRegion = generated.operatorScores.architectureComplexityTier === "Enterprise" ? 80 : generated.operatorScores.architectureComplexityTier === "Growth" ? 50 : 30;
    let spendProxy = 0;
    const ms = String(profile.monthlySpend ?? "").replace(/[,$kKmM]/g, "");
    const n = parseFloat(ms);
    if (!isNaN(n)) {
      spendProxy = /k/i.test(String(profile.monthlySpend)) ? n * 1000 * 12 : /m/i.test(String(profile.monthlySpend)) ? n * 1_000_000 * 12 : n * 12;
    }
    const enterpriseReadinessIndex = computeEnterpriseReadinessIndex({
      complianceMaturity,
      multiRegionComplexity: multiRegion,
      automationReadiness: axiom.scores.automationReadinessScore,
      driftDetected: drift.signals.length > 0,
      trendVolatilityScore: 0,
      monthlySpendProxy: spendProxy,
    });
    axiomFinal = {
      ...axiomFinal,
      scores: { ...axiomFinal.scores, enterpriseReadinessIndex },
    };

    await logAudit({ leadId, action: "roadmap_generated", actor: "system" });
    if (drift.signals.length > 0) {
      await logAudit({ leadId, action: "drift_detected", actor: "system", metadata: { signalCount: drift.signals.length } });
      eventDriftDetected({ leadId, signalCount: drift.signals.length });
    }
    eventEngineCompleted({ leadId, engineName: "cloud-operator", tier: tierResolved, unifiedTier: tierResolved, scoringVersion: SCORING_VERSION });

    const latest = await prisma.lead.findUnique({ where: { id: leadId } });
    const currentPayload = (latest?.fullPayload as Record<string, unknown>) ?? {};
    const existingTags = (currentPayload.tags as string[]) ?? [];
    const mergedTags = [...new Set([...existingTags, ...tags])];
    await prisma.lead.update({
      where: { id: leadId },
      data: {
        fullPayload: {
          ...currentPayload,
          axiomResult: axiomFinal,
          tags: mergedTags,
        } as object,
      },
    });

    await insertAxiomSnapshot({
      leadId,
      tier: tierResolved,
      provider: profile.hostingProvider || null,
      infrastructureScore: axiom.scores.infrastructureScore,
      estimatedAnnualSavings: axiom.scores.estimatedAnnualSavings ?? null,
      riskExposureLevel: axiom.scores.riskExposureLevel,
      deploymentFrictionIndex: axiom.scores.deploymentFrictionIndex,
      complexityTier: axiom.scores.complexityTier,
      automationReadinessScore: axiom.scores.automationReadinessScore,
      raw: { operatorProfile: generated.rawProfile },
    });

    return NextResponse.json({
      success: true,
      status: "ready",
      operatorOutput,
      operatorScores: operatorOutput.scores || null,
      axiomScores: axiom.scores,
      axiomResult: axiomFinal,
    });
  } catch (e) {
    eventEngineFailed({ leadId, engineName: "cloud-operator", error: e instanceof Error ? e.message : String(e), unifiedTier: tierForRate });
    return NextResponse.json(
      { error: "Failed to generate output. Please try again." },
      { status: 500 }
    );
  }
}
