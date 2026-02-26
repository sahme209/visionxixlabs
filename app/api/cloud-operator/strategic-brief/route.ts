import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyStarterToken } from "@/lib/starterToken";
import { resolveOperatorTier, canViewTechnicalOutputs, hasContinuousReassessment, hasEnterpriseEngagement } from "@/lib/cloudOperator/pricing";
import { generateStrategicBrief } from "@/lib/axiom/strategicBrief";

/**
 * Phase 8: GET /api/cloud-operator/strategic-brief?token=XXX
 * Generates C-level strategic brief. Tier-gated.
 * Caches result in fullPayload.axiomResult.strategicBrief.
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

  const lead = await prisma.lead.findUnique({ where: { id: result.leadId } });
  if (!lead || lead.source !== "cloud-operator") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const payload = (lead.fullPayload as Record<string, unknown>) || {};
  const tier = resolveOperatorTier(payload.tier as string);
  const axiomResult = payload.axiomResult as {
    scores?: Record<string, unknown>;
    driftSignals?: { hasDrift?: boolean; driftLevel?: string; signals?: string[] };
    strategicBrief?: Record<string, unknown>;
  } | undefined;

  const existing = axiomResult?.strategicBrief;
  if (existing && typeof existing === "object") {
    return NextResponse.json(existing);
  }

  const scores = axiomResult?.scores ?? {};
  const profile = (payload.operatorProfile as Record<string, unknown>) ?? {};
  const snapshots = await prisma.axiomScoreSnapshot.findMany({
    where: { leadId: lead.id },
    orderBy: { createdAt: "desc" },
    take: hasContinuousReassessment(tier) ? 5 : 0,
  });

  const trendHistory = snapshots.map((s) => ({
    infrastructureScore: s.infrastructureScore ?? undefined,
    estimatedAnnualSavings: s.estimatedAnnualSavings ?? undefined,
    riskExposureLevel: s.riskExposureLevel ?? undefined,
  }));

  const brief = await generateStrategicBrief({
    profile: { projectType: profile.projectType, hostingProvider: profile.hostingProvider, monthlySpend: profile.monthlySpend, complianceNeeds: profile.complianceNeeds },
    axiomScores: {
      infrastructureScore: scores.infrastructureScore as number,
      estimatedAnnualSavings: scores.estimatedAnnualSavings as number | null,
      riskExposureLevel: scores.riskExposureLevel as string,
      deploymentFrictionIndex: scores.deploymentFrictionIndex as number,
      automationReadinessScore: scores.automationReadinessScore as number,
      complexityTier: scores.complexityTier as string,
    },
    trendHistory,
    driftSignals: axiomResult?.driftSignals,
    tier: tier as "free" | "pro" | "growth" | "enterprise",
  });

  const updatedPayload = { ...payload, axiomResult: { ...axiomResult, strategicBrief: brief } };
  await prisma.lead.update({
    where: { id: lead.id },
    data: { fullPayload: updatedPayload as object },
  });

  return NextResponse.json(brief);
}
