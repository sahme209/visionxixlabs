import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { prisma } from "@/lib/db";
import { resolveOperatorTier } from "@/lib/cloudOperator/pricing";

/**
 * Phase 9: GET /api/admin/enterprise-dashboard — Sales intelligence panel (admin only).
 * Returns cloud-operator leads with deal signals, sorted by urgency.
 * Filters: highUrgency, tier, driftDetected, minSavings
 */
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;

  const { searchParams } = new URL(req.url);
  const highUrgency = searchParams.get("highUrgency") === "true";
  const tier = searchParams.get("tier") || undefined;
  const driftDetected = searchParams.get("driftDetected") === "true";
  const minSavings = searchParams.get("minSavings")
    ? Math.max(0, Number(searchParams.get("minSavings")))
    : undefined;

  try {
    const leads = await prisma.lead.findMany({
      where: { source: "cloud-operator" },
      orderBy: { updatedAt: "desc" },
      take: 200,
    });

    const items: Array<{
      id: string;
      email: string;
      name: string | null;
      tier: string;
      urgencyLevel: string;
      expansionProbability: number;
      enterpriseLikelihood: number;
      estimatedSavings: number | null;
      driftDetected: boolean;
      lastActivityAt: string;
      tags: string[];
      dealTimeline?: { recommendedFollowUpDays: number; idealEngagementModel: string };
    }> = [];

    for (const l of leads) {
      const payload = (l.fullPayload as Record<string, unknown>) || {};
      const axiomResult = payload.axiomResult as {
        scores?: { estimatedAnnualSavings?: number | null; strategicReadinessScore?: number };
        dealSignals?: {
          urgencyLevel: string;
          expansionProbability: number;
          enterpriseLikelihood: number;
        };
        driftSignals?: { hasDrift?: boolean };
      } | undefined;

      const dealSignals = axiomResult?.dealSignals;
      const scores = axiomResult?.scores;
      const hasDrift = axiomResult?.driftSignals?.hasDrift ?? false;
      const resolvedTier = resolveOperatorTier(payload.tier as string);
      const tags = (payload.tags as string[]) ?? [];

      if (!dealSignals) continue;

      if (highUrgency && dealSignals.urgencyLevel !== "high" && dealSignals.urgencyLevel !== "critical") continue;
      if (tier && resolvedTier !== tier) continue;
      if (driftDetected && !hasDrift) continue;
      const savings = scores?.estimatedAnnualSavings ?? 0;
      if (minSavings != null && (savings == null || savings < minSavings)) continue;

      let dealTimeline: { recommendedFollowUpDays: number; idealEngagementModel: string } | undefined;
      try {
        const { estimateDealTimeline } = await import("@/lib/axiom/dealTimeline");
        const t = estimateDealTimeline({
          urgencyLevel: dealSignals.urgencyLevel as "low" | "medium" | "high" | "critical",
          enterpriseLikelihood: dealSignals.enterpriseLikelihood,
          driftLevel: axiomResult?.driftSignals && typeof axiomResult.driftSignals === "object" && "driftLevel" in axiomResult.driftSignals
            ? (axiomResult.driftSignals as { driftLevel?: string }).driftLevel
            : undefined,
        });
        dealTimeline = { recommendedFollowUpDays: t.recommendedFollowUpDays, idealEngagementModel: t.idealEngagementModel };
      } catch {
        // skip
      }

      items.push({
        id: l.id,
        email: l.email,
        name: l.name,
        tier: resolvedTier,
        urgencyLevel: dealSignals.urgencyLevel,
        expansionProbability: dealSignals.expansionProbability,
        enterpriseLikelihood: dealSignals.enterpriseLikelihood,
        estimatedSavings: scores?.estimatedAnnualSavings ?? null,
        driftDetected: hasDrift,
        lastActivityAt: l.updatedAt.toISOString(),
        tags,
        dealTimeline,
      });
    }

    items.sort((a, b) => {
      const order = { critical: 0, high: 1, medium: 2, low: 3 };
      return (order[a.urgencyLevel as keyof typeof order] ?? 4) - (order[b.urgencyLevel as keyof typeof order] ?? 4);
    });

    return NextResponse.json({ leads: items });
  } catch (e) {
    console.error("[Enterprise Dashboard]", e);
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}
