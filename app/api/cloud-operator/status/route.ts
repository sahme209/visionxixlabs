import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyStarterToken } from "@/lib/starterToken";
import { resolveOperatorTier } from "@/lib/cloudOperator/pricing";
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
    const tier = resolveOperatorTier(payload.tier as string | undefined) as OperatorTier;

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

    const response: Record<string, unknown> = {
      leadId: lead.id,
      status: lead.status,
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

    return NextResponse.json(response);
  } catch (e) {
    console.error("[cloud-operator status]", e);
    return NextResponse.json({ error: "Failed to fetch status" }, { status: 500 });
  }
}

