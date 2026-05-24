/**
 * POST /api/architecture/analyze
 * Runs cloud scans, computes resilience score, generates multi-cloud recommendation.
 * Requires starter token (cloud-operator session).
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyStarterToken } from "@/lib/starterToken";
import { checkRateLimit } from "@/lib/rateLimit";
import { analyzeArchitecture } from "@/lib/multicloud/architectureAnalyzer";

export async function POST(req: NextRequest) {
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

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anon";
  if (!checkRateLimit(`architecture-analyze:${ip}`)) {
    return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
  }

  try {
    const lead = await prisma.lead.findUnique({
      where: { id: result.leadId },
      select: { id: true, userId: true, source: true },
    });

    if (!lead) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (lead.source !== "cloud-operator") {
      return NextResponse.json({ error: "Invalid session type" }, { status: 400 });
    }

    const analysis = await analyzeArchitecture(lead.id, lead.userId);

    return NextResponse.json({
      success: true,
      reportId: analysis.reportId,
      resilienceScore: analysis.resilienceScore,
      currentState: analysis.currentStateSummary,
      risks: analysis.risks,
      recommendedArchitecture: analysis.recommendedArchitecture,
      estimatedCostImpact: analysis.estimatedCostImpact,
      rto: analysis.rto,
      rpo: analysis.rpo,
      nextSteps: analysis.nextSteps,
      aiAnalysis: analysis.aiAnalysis,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Analysis failed";
    console.error("[architecture/analyze]", msg);

    // Surface diagnosable failure modes rather than the generic "Please
    // try again." so operators can actually fix their config. Each
    // branch is matched against well-known error strings emitted by the
    // analyzer's AWS / Azure / GCP paths.
    if (msg.includes("No cloud providers connected")) {
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    if (msg.includes("AccessDenied") || msg.includes("access_denied")) {
      return NextResponse.json({
        error:
          "AWS denied the AssumeRole call. Your trust policy doesn't include the platform's broker as a Principal. " +
          "Set Principal to `arn:aws:iam::590183704419:root` with the externalId you were given.",
      }, { status: 403 });
    }
    if (msg.includes("InvalidClientTokenId") || msg.includes("SignatureDoesNotMatch")) {
      return NextResponse.json({
        error:
          "Platform broker credentials aren't configured on this deployment. " +
          "Set AWS_CONNECTOR_BROKER_ACCESS_KEY_ID + AWS_CONNECTOR_BROKER_SECRET_ACCESS_KEY on Vercel.",
      }, { status: 503 });
    }
    if (msg.includes("ExternalId") || msg.includes("InvalidParameterValue")) {
      return NextResponse.json({
        error:
          "AWS rejected the ExternalId condition. Confirm the trust policy's sts:ExternalId matches the externalId on this onboarding session exactly.",
      }, { status: 403 });
    }
    if (msg.includes("UnauthorizedOperation") || msg.includes("not authorized to perform")) {
      return NextResponse.json({
        error:
          "AssumeRole succeeded but the role's permission policy is missing required read-only actions. " +
          "Attach the IAM permissions policy shown on the onboarding page (ec2:Describe*, s3:List*, etc).",
      }, { status: 403 });
    }
    return NextResponse.json({
      error: "Analysis failed: " + msg.slice(0, 200) +
        ". Trust policy Principal must be `arn:aws:iam::590183704419:root`; full troubleshooting at /docs/aws-setup.",
    }, { status: 500 });
  }
}
