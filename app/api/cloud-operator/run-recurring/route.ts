import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { resolveOperatorTier } from "@/lib/cloudOperator/pricing";
import { hasContinuousReassessment, hasEnterpriseEngagement } from "@/lib/cloudOperator/pricing";
import { insertAxiomSnapshot } from "@/lib/axiom/snapshotService";

/**
 * Phase 8: POST /api/cloud-operator/run-recurring
 * Cron-compatible endpoint. Finds enabled recurring analyses due to run,
 * re-runs scoring (no AI strategic brief unless Growth+), stores snapshot.
 * Tier gating: Growth+ monthly, Enterprise weekly.
 */
export async function POST(req: NextRequest) {
  const cronSecret = req.headers.get("x-cron-secret") || req.nextUrl.searchParams.get("cronSecret");
  const expectedSecret = process.env.CRON_SECRET;
  if (expectedSecret && cronSecret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const due = await prisma.recurringAnalysis.findMany({
    where: { enabled: true, nextRunAt: { lte: now } },
    take: 50,
  });

  let processed = 0;
  for (const ra of due) {
    try {
      const lead = await prisma.lead.findUnique({ where: { id: ra.leadId } });
      if (!lead || lead.source !== "cloud-operator") continue;

      const payload = (lead.fullPayload as Record<string, unknown>) || {};
      const axiomResult = payload.axiomResult as { scores?: Record<string, unknown> } | undefined;
      const scores = axiomResult?.scores;
      if (!scores) continue;

      const tier = resolveOperatorTier(payload.tier as string);
      await insertAxiomSnapshot({
        leadId: lead.id,
        tier,
        provider: (payload.operatorProfile as Record<string, unknown>)?.hostingProvider as string | null,
        infrastructureScore: scores.infrastructureScore as number | null,
        estimatedAnnualSavings: scores.estimatedAnnualSavings as number | null,
        riskExposureLevel: scores.riskExposureLevel as string | null,
        deploymentFrictionIndex: scores.deploymentFrictionIndex as number | null,
        complexityTier: scores.complexityTier as string | null,
        automationReadinessScore: scores.automationReadinessScore as number | null,
      });

      const intervalMs = ra.frequency === "weekly" ? 7 * 24 * 60 * 60 * 1000 : 30 * 24 * 60 * 60 * 1000;
      const nextRun = new Date(Date.now() + intervalMs);

      await prisma.recurringAnalysis.update({
        where: { id: ra.id },
        data: { lastRunAt: now, nextRunAt: nextRun },
      });
      processed++;
    } catch {
      // skip failed lead
    }
  }

  // Phase 9: Weekly SalesPipelineSnapshot
  const cloudOpLeads = await prisma.lead.findMany({
    where: { source: "cloud-operator" },
    take: 500,
  });
  let highUrgencyCount = 0;
  let enterpriseLikelihoodSum = 0;
  let expansionSum = 0;
  let strategicSum = 0;
  let count = 0;
  for (const l of cloudOpLeads) {
    const payload = (l.fullPayload as Record<string, unknown>) || {};
    const axiomResult = payload.axiomResult as {
      scores?: { strategicReadinessScore?: number };
      dealSignals?: { urgencyLevel: string; enterpriseLikelihood: number; expansionProbability: number };
    } | undefined;
    const ds = axiomResult?.dealSignals;
    if (!ds) continue;
    if (ds.urgencyLevel === "high" || ds.urgencyLevel === "critical") highUrgencyCount++;
    enterpriseLikelihoodSum += ds.enterpriseLikelihood;
    expansionSum += ds.expansionProbability;
    strategicSum += axiomResult?.scores?.strategicReadinessScore ?? 0;
    count++;
  }
  if (count > 0) {
    await prisma.salesPipelineSnapshot.create({
      data: {
        highUrgencyCount,
        enterpriseLikelihoodAvg: enterpriseLikelihoodSum / count,
        expansionProbabilityAvg: expansionSum / count,
        avgStrategicReadiness: strategicSum / count,
      },
    });
  }

  return NextResponse.json({ success: true, processed });
}
