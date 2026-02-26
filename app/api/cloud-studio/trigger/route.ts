import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyStarterToken } from "@/lib/starterToken";
import { checkRateLimit } from "@/lib/rateLimit";
import { generateCloudStudioOutput } from "@/lib/cloudStudio/generate";
import type { CloudStudioForm, CloudStudioTier } from "@/lib/cloudStudio/types";
import { computeBaseCloudIntelligence, computeInfrastructureAdvantageScore } from "@/lib/axiom/scoringRegistry";
import { runAsyncLeadEngine } from "@/lib/async/engineRunner";
import type { AxiomProfile, AxiomResult } from "@/lib/axiom/infrastructureAdvantage";

function buildAxiomProfileFromCloudStudio(
  serviceType: string,
  form: Record<string, unknown>
): AxiomProfile {
  const cloudProvider = String(
    (form as any).cloudProvider ??
      (form as any).deploymentTarget ??
      ""
  ).trim();

  const trafficEstimate = String(
    (form as any).trafficEstimate ??
      (form as any).publicServices ??
      ""
  ).trim();

  const projectType = (() => {
    switch (serviceType) {
      case "cicd":
        return "CI/CD pipeline";
      case "cost":
        return "Cost optimization";
      case "security":
        return "Security posture";
      case "architecture":
        return "Application architecture";
      case "networking":
        return "Networking topology";
      default:
        return serviceType || "cloud-studio";
    }
  })();

  const primaryGoal = (() => {
    switch (serviceType) {
      case "cicd":
        return "Launch faster";
      case "cost":
        return "Reduce costs";
      case "security":
        return "Improve security";
      case "architecture":
      case "networking":
      default:
        return "Scale architecture";
    }
  })();

  const monthlySpend =
    typeof (form as any).estimatedMonthlySpend === "string"
      ? (form as any).estimatedMonthlySpend
      : "";

  const gitProviderRaw =
    (form as any).gitProvider && typeof (form as any).gitProvider === "string"
      ? (form as any).gitProvider
      : "None";

  const gitProvider: AxiomProfile["gitProvider"] =
    gitProviderRaw === "GitHub" ||
    gitProviderRaw === "GitLab" ||
    gitProviderRaw === "Bitbucket" ||
    gitProviderRaw === "None" ||
    gitProviderRaw === "Other"
      ? (gitProviderRaw as AxiomProfile["gitProvider"])
      : "Other";

  const trafficLevel: AxiomProfile["trafficLevel"] = (() => {
    const v = trafficEstimate.toLowerCase();
    if (v.includes("high") || v.includes("heavy")) return "High";
    if (v.includes("medium") || v.includes("mid")) return "Medium";
    if (v.includes("low")) return "Low";
    return "Medium";
  })();

  const hasCiCd: AxiomProfile["hasCiCd"] =
    serviceType === "cicd" ? "yes" : "no";

  const publicExposure: AxiomProfile["publicExposure"] = (() => {
    const publicServices = String((form as any).publicServices ?? "").toLowerCase();
    if (publicServices.includes("api")) return "API";
    if (publicServices.includes("web") || publicServices.includes("site")) return "Public Web";
    return "Internal Only";
  })();

  const complianceNeeds = String(
    (form as any).complianceGoal ??
      (form as any).billingExportNote ??
      ""
  ).trim();

  return {
    projectType,
    hostingProvider: cloudProvider || "Unknown",
    monthlySpend,
    trafficLevel,
    hasCiCd,
    publicExposure,
    complianceNeeds,
    gitProvider,
    primaryGoal,
    contextType: "cloud-studio",
  };
}

/**
 * POST /api/cloud-studio/trigger?token=XXX
 * Generates AI output for the cloud studio request. Stores result in fullPayload.output.
 */
export async function POST(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.json({ error: "Token required" }, { status: 400 });
  }

  if (!checkRateLimit(`cloud-studio-trigger:${token.slice(0, 32)}`)) {
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
    if (lead.source !== "cloud-studio") {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const existingPayload = (lead.fullPayload as Record<string, unknown>) || {};
    if (existingPayload.outputStatus === "ready") {
      return NextResponse.json({
        success: true,
        status: "ready",
        output: existingPayload.output,
      });
    }

    const { generated } = await runAsyncLeadEngine<{
      output: Awaited<ReturnType<typeof generateCloudStudioOutput>>;
      cloudIntelligence: ReturnType<typeof computeBaseCloudIntelligence>;
      axiomProfile: AxiomProfile;
      axiomResult: AxiomResult;
    }>({
      leadId,
      engineName: "cloud-studio-trigger",
      expectedSource: "cloud-studio",
      async generateFunction({ payload }) {
        const serviceType = payload.serviceType as string;
        const form = (payload.form as Record<string, unknown>) || {};
        const tier = (payload.tier as CloudStudioTier) || "free";

        const request: CloudStudioForm = {
          serviceType: serviceType as CloudStudioForm["serviceType"],
          form,
        } as CloudStudioForm;

        const output = await generateCloudStudioOutput(request, tier);
        const cloudIntelligence = computeBaseCloudIntelligence(
          serviceType,
          form,
          output as Record<string, unknown>
        );

        const axiomProfile = buildAxiomProfileFromCloudStudio(serviceType, form);
        const axiomResult = computeInfrastructureAdvantageScore(axiomProfile);

        return { output, cloudIntelligence, axiomProfile, axiomResult };
      },
      updatePayloadFunction({ payload, generated }) {
        const { output, cloudIntelligence, axiomProfile, axiomResult } = generated;
        return {
          ...payload,
          output,
          cloudIntelligence,
          axiomProfile,
          axiomScores: axiomResult.scores,
          axiomResult,
          axiomPlan: axiomResult.plan,
          engine: {
            ...(payload.engine as Record<string, unknown> | undefined),
            outputStatus: "ready",
            rawOutput: output,
            scores: cloudIntelligence,
            axiomScores: axiomResult.scores,
            roadmap: axiomResult.plan,
          },
        };
      },
      initialStatus: "package_generating",
      readyStatus: "package_ready",
      failureStatus: "created",
    });

    const { output } = generated;

    return NextResponse.json({
      success: true,
      status: "ready",
      output,
    });
  } catch (e) {
    console.error("[cloud-studio trigger]", e);
    return NextResponse.json(
      { error: "Failed to generate output. Please try again." },
      { status: 500 }
    );
  }
}
