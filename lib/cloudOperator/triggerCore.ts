/**
 * Cloud Operator analysis — core logic reusable by API route and agent tools.
 */

import { prisma } from "@/lib/db";
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
 * Run full Cloud Operator analysis for a lead.
 * Idempotent when output already ready.
 */
export async function runCloudOperatorAnalysis(leadId: string) {
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead || lead.source !== "cloud-operator") {
    throw new Error("Lead not found or invalid source");
  }

  const payload = lead.fullPayload as Record<string, unknown>;
  const tierForRate = resolveOperatorTier((payload.tier as string) || "free");

  eventEngineTriggered({
    leadId,
    engineName: "cloud-operator",
    tier: tierForRate,
    unifiedTier: tierForRate,
    scoringVersion: SCORING_VERSION,
  });

  const { generated } = await runAsyncLeadEngine<Generated>({
    leadId,
    engineName: "cloud-operator",
    expectedSource: "cloud-operator",
    getTier: (_, p) => String(resolveOperatorTier((p.tier as string) || "free")),
    isReady: (p) => !!p.operatorOutput,
    getExistingResult: (p) => {
      const o = p.operatorOutput;
      const a = p.axiomResult;
      if (!o || !a) return null;
      return {
        operatorOutput: o as Generated["operatorOutput"],
        operatorScores: (p.operatorScores as Generated["operatorScores"]) || (o as { scores?: unknown }).scores,
        axiom: a as Generated["axiom"],
        rawProfile: (p.operatorProfile as Record<string, unknown>) || {},
        profile: {} as OperatorProfile,
        tier: resolveOperatorTier((p.tier as string) || "free") as OperatorTier,
      };
    },
    async generate({ tier, payload: p }) {
      const rawProfile = (p.operatorProfile as Record<string, unknown>) || {};
      const tierResolved = resolveOperatorTier((p.tier as string) || "free") as OperatorTier;

      const profile: OperatorProfile = {
        projectType: String(rawProfile.projectType ?? "").trim(),
        hostingProvider: String(rawProfile.hostingProvider ?? "").trim(),
        monthlySpend: String(rawProfile.monthlySpend ?? "").trim(),
        trafficLevel: (String(rawProfile.trafficLevel ?? "Low").trim() || "Low") as "Low" | "Medium" | "High",
        hasCiCd: (String(rawProfile.hasCiCd ?? "no").trim().toLowerCase() === "yes" ? "yes" : "no") as "yes" | "no",
        publicExposure: (String(rawProfile.publicExposure ?? "Internal Only").trim() || "Internal Only") as "API" | "Public Web" | "Internal Only" | "Other",
        complianceNeeds: String(rawProfile.complianceNeeds ?? "").trim(),
        gitProvider: (String(rawProfile.gitProvider ?? "None").trim() || "None") as "GitHub" | "GitLab" | "Bitbucket" | "None" | "Other",
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
      const customPlan = (operatorOutput as { thirtyDayPlan?: unknown })?.thirtyDayPlan;
      const axiom = computeInfrastructureAdvantageScore(axiomProfile, operatorScores, customPlan ?? null);

      return { operatorOutput, operatorScores, axiom, rawProfile, profile, tier: tierResolved };
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
  let axiomFinal = drift.signals.length > 0 ? { ...axiom, driftSignals: drift } : axiom;

  const playbooks = generatePlaybooks(axiom.plan);
  const qualityIssues: string[] = [];
  const launch = (operatorOutput as { launch?: Record<string, unknown> })?.launch;
  const secure = (operatorOutput as { secure?: Record<string, unknown> })?.secure;
  const ciCdYaml = launch?.ciCdYaml as string | undefined;
  const dockerfile = launch?.dockerfile as string | undefined;
  const terraformTemplates = launch?.terraformTemplates as string[] | undefined;
  const hardeningChecklist = secure?.hardeningChecklist as string[] | undefined;
  const checklistText = Array.isArray(hardeningChecklist) ? hardeningChecklist.map((c) => `- ${c}`).join("\n") : "";

  const v1 = validateGithubActionsYaml(ciCdYaml);
  if (!v1.valid) qualityIssues.push(...v1.issues.map((i) => `CI/CD: ${i}`));
  const v2 = validateDockerfile(dockerfile);
  if (!v2.valid) qualityIssues.push(...v2.issues.map((i) => `Dockerfile: ${i}`));
  const terraformContent = Array.isArray(terraformTemplates) ? terraformTemplates.join("\n") : "";
  const v3 = validateTerraform(terraformContent);
  if (!v3.valid) qualityIssues.push(...v3.issues.map((i) => `Terraform: ${i}`));
  const v4 = validateSecurityChecklist(checklistText);
  if (!v4.valid) qualityIssues.push(...v4.issues.map((i) => `Checklist: ${i}`));

  const explainability = generateScoreExplanation(
    {
      projectType: profile.projectType,
      hostingProvider: profile.hostingProvider,
      monthlySpend: profile.monthlySpend,
      trafficLevel: profile.trafficLevel,
      hasCiCd: profile.hasCiCd,
      publicExposure: profile.publicExposure,
      complianceNeeds: profile.complianceNeeds,
      gitProvider: profile.gitProvider,
      primaryGoal: profile.primaryGoal,
    },
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
    driftSignals:
      axiomFinal.driftSignals && typeof axiomFinal.driftSignals === "object" && "hasDrift" in axiomFinal.driftSignals
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

  return {
    success: true,
    status: "ready",
    axiomScores: axiom.scores,
  };
}
