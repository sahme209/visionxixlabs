import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyStarterToken } from "@/lib/starterToken";
import { canViewFullOutput, canDownload } from "@/lib/cloudStudio/pricing";
import type { CloudStudioTier } from "@/lib/cloudStudio/types";

/**
 * GET /api/cloud-studio/status?token=XXX
 * Returns status and output for the cloud studio request. Tier gates full output and download.
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

    if (!lead || lead.source !== "cloud-studio") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const payload = (lead.fullPayload as Record<string, unknown>) || {};
    const tier = (payload.tier as CloudStudioTier) || "free";
    const output = payload.output as Record<string, unknown> | null;
    const outputStatus = (payload.outputStatus as string) || "pending";

    const cloudIntelligence = payload.cloudIntelligence as Record<string, unknown> | null | undefined;

    const response: Record<string, unknown> = {
      leadId: lead.id,
      status: lead.status,
      outputStatus,
      serviceType: payload.serviceType,
      tier,
      canViewFullOutput: canViewFullOutput(tier),
      canDownload: canDownload(tier),
      cloudIntelligence: cloudIntelligence || null,
    };

    if (output) {
      response.summary = output.summary;
      if (canViewFullOutput(tier)) {
        response.fullOutput = output.fullOutput;
        response.artifacts = output.artifacts;
      }
      response.generatedAt = output.generatedAt;
    }

    return NextResponse.json(response);
  } catch (e) {
    console.error("[cloud-studio status]", e);
    return NextResponse.json({ error: "Failed to fetch status" }, { status: 500 });
  }
}
