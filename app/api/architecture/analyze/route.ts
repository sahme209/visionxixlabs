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
    if (msg.includes("No cloud providers connected")) {
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    console.error("[architecture/analyze]", msg);
    return NextResponse.json({ error: "Analysis failed. Please try again." }, { status: 500 });
  }
}
