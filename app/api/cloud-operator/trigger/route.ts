import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyStarterToken } from "@/lib/starterToken";
import { checkRateLimit } from "@/lib/rateLimit";
import { generateOperatorEngineOutput } from "@/lib/cloudOperator/generate";
import { resolveOperatorTier } from "@/lib/cloudOperator/pricing";
import type { OperatorProfile, OperatorTier } from "@/lib/cloudOperator/types";
import { runAsyncLeadEngine } from "@/lib/async/engineRunner";
import {
  computeInfrastructureAdvantageScore,
  computeOperatorScores,
} from "@/lib/axiom/scoringRegistry";
import type { OperatorProfileInput } from "@/lib/cloudStudio/scoring";
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

  try {
    const lead = await prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (lead.source !== "cloud-operator") {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const existingPayload = (lead.fullPayload as Record<string, unknown>) || {};
    if (existingPayload.outputStatus === "ready") {
      return NextResponse.json({
        success: true,
        status: "ready",
        operatorOutput: existingPayload.operatorOutput,
        operatorScores: existingPayload.operatorScores,
      });
    }

    const { generated } = await runAsyncLeadEngine<{
      operatorOutput: Awaited<ReturnType<typeof generateOperatorEngineOutput>>;
      operatorScores: ReturnType<typeof computeOperatorScores>;
      axiom: ReturnType<typeof computeInfrastructureAdvantageScore>;
      rawProfile: Record<string, unknown>;
      profile: OperatorProfile;
      tier: OperatorTier;
    }>({
      leadId,
      engineName: "cloud-operator-trigger",
      expectedSource: "cloud-operator",
      async generateFunction({ payload }) {
        const rawProfile = (payload.operatorProfile as Record<string, unknown>) || {};
        const tier = resolveOperatorTier((payload.tier as string) || "free") as OperatorTier;

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

        const tierResolved = resolveOperatorTier((payload.tier as string) || "free") as OperatorTier;
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

        const axiomProfile = {
          ...profile,
          contextType: "operator" as const,
        };
        const axiom = computeInfrastructureAdvantageScore(axiomProfile, operatorScores);

        return { operatorOutput, operatorScores, axiom, rawProfile, profile, tier: tierResolved };
      },
      updatePayloadFunction({ payload, generated }) {
        const { operatorOutput, operatorScores, axiom, rawProfile, profile } = generated;
        const axiomProfile = {
          ...profile,
          contextType: "operator" as const,
        };

        return {
          ...payload,
          operatorProfile: rawProfile,
          operatorOutput,
          operatorScores,
          axiomProfile,
          axiomScores: axiom.scores,
          // Store full AxiomResult object for future use
          axiomResult: axiom,
          // Backwards-compatible plan field for older readers
          axiomPlan: axiom.plan,
        };
      },
      initialStatus: "package_generating",
      readyStatus: "package_ready",
      failureStatus: "created",
    });

    const { operatorOutput, axiom } = generated;

    return NextResponse.json({
      success: true,
      status: "ready",
      operatorOutput,
      operatorScores: operatorOutput.scores || null,
      axiomScores: axiom.scores,
      axiomResult: axiom,
    });
  } catch (e) {
    console.error("[cloud-operator trigger]", e);
    return NextResponse.json(
      { error: "Failed to generate output. Please try again." },
      { status: 500 }
    );
  }
}

