import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyStarterToken } from "@/lib/starterToken";
import { checkRateLimit } from "@/lib/rateLimit";
import { generateCloudStudioOutput } from "@/lib/cloudStudio/generate";
import { computeCloudIntelligence } from "@/lib/cloudStudio/scoring";
import type { CloudStudioForm, CloudStudioTier } from "@/lib/cloudStudio/types";

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

    const payload = (lead.fullPayload as Record<string, unknown>) || {};
    if (payload.outputStatus === "ready") {
      return NextResponse.json({
        success: true,
        status: "ready",
        output: payload.output,
      });
    }

    const serviceType = payload.serviceType as string;
    const form = (payload.form as Record<string, unknown>) || {};
    const tier = (payload.tier as CloudStudioTier) || "free";

    await prisma.lead.update({
      where: { id: leadId },
      data: { status: "package_generating" },
    });

    const request: CloudStudioForm = {
      serviceType: serviceType as CloudStudioForm["serviceType"],
      form,
    } as CloudStudioForm;

    const output = await generateCloudStudioOutput(request, tier);

    const cloudIntelligence = computeCloudIntelligence(serviceType, form, output as Record<string, unknown>);

    const updatedPayload = {
      ...payload,
      output,
      outputStatus: "ready",
      cloudIntelligence,
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
      output,
    });
  } catch (e) {
    console.error("[cloud-studio trigger]", e);
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
