import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyStarterToken } from "@/lib/starterToken";
import { checkRateLimit } from "@/lib/rateLimit";
import { generateOperatorEngineOutput } from "@/lib/cloudOperator/generate";
import { resolveOperatorTier } from "@/lib/cloudOperator/pricing";
import type { OperatorProfile, OperatorTier } from "@/lib/cloudOperator/types";

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

    const payload = (lead.fullPayload as Record<string, unknown>) || {};
    if (payload.outputStatus === "ready") {
      return NextResponse.json({
        success: true,
        status: "ready",
        operatorOutput: payload.operatorOutput,
        operatorScores: payload.operatorScores,
      });
    }

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

    await prisma.lead.update({
      where: { id: leadId },
      data: { status: "package_generating" },
    });

    const operatorOutput = await generateOperatorEngineOutput(profile, tier);

    const updatedPayload = {
      ...payload,
      operatorProfile: rawProfile,
      operatorOutput,
      operatorScores: operatorOutput.scores || null,
      outputStatus: "ready",
    };

    await prisma.lead.update({
      where: { id: leadId },
      data: {
        status: "package_ready",
        fullPayload: updatedPayload,
      },
    });

    return NextResponse.json({
      success: true,
      status: "ready",
      operatorOutput,
      operatorScores: operatorOutput.scores || null,
    });
  } catch (e) {
    console.error("[cloud-operator trigger]", e);
    try {
      const lead = await prisma.lead.findUnique({ where: { id: leadId } });
      if (lead) {
        const p = (lead.fullPayload as Record<string, unknown>) || {};
        await prisma.lead.update({
          where: { id: leadId },
          data: { fullPayload: { ...p, outputStatus: "failed" }, status: "created" },
        });
      }
    } catch {
      // ignore
    }
    return NextResponse.json(
      { error: "Failed to generate output. Please try again." },
      { status: 500 }
    );
  }
}

