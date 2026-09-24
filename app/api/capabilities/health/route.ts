/** GET /api/capabilities/health — Phase 664.
 *
 * Single endpoint that returns the platform's "what can we do, how
 * much of it is proven" health snapshot. Composes:
 *
 *   · action registry counts (Phase 650 — typed metadata)
 *   · validation matrix score (Phase 651 — file evidence)
 *   · 24h dispatch count if workspace context is available
 *     (Phase 660 — real workspace activity)
 *
 * No auth gate — counts are derived from public typed metadata.
 * Dispatch count requires a session; falls back to null without one.
 *
 * Designed for external monitoring (Grafana / Pingdom / health
 * dashboards) and Copilot platform-state introspection.
 */

import { NextResponse } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import { computeHonestyCounts, computeCompositeHealthScore } from "@/lib/actions/actionRegistry";
import { summarizeValidation } from "@/lib/validation/platformValidationMatrix";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const actionCounts = computeHonestyCounts();
  const matrixSummary = summarizeValidation();

  let dispatch24h: number | null = null;
  let lastDispatchAt: string | null = null;
  try {
    const ctx = await currentContext();
    if (ctx.isAuthenticated && ctx.organizationId) {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const [count, latest] = await Promise.all([
        prisma.aiRationaleEnrichment.count({
          where: {
            organizationId: String(ctx.organizationId),
            targetKind: "workforce_action_execution",
            updatedAt: { gte: since },
          },
        }),
        prisma.aiRationaleEnrichment.findFirst({
          where: {
            organizationId: String(ctx.organizationId),
            targetKind: "workforce_action_execution",
          },
          orderBy: { updatedAt: "desc" },
          select: { updatedAt: true },
        }),
      ]);
      dispatch24h = count;
      lastDispatchAt = latest?.updatedAt?.toISOString() ?? null;
    }
  } catch { /* unauthenticated or table missing — leave null */ }

  // Composite "is the platform healthy enough to recommend" score.
  // See computeCompositeHealthScore docs for the weighting rationale.
  // Operators can debug each component via the dashboard links below.
  const liveRatio = actionCounts.total > 0 ? actionCounts.live / actionCounts.total : 0;
  const matrixScore = matrixSummary.score; // 0..1
  const compositeScore = computeCompositeHealthScore(liveRatio, matrixScore);

  return NextResponse.json({
    compositeScore,
    actionRegistry: {
      total: actionCounts.total,
      live: actionCounts.live,
      preview: actionCounts.preview,
      governed: actionCounts.governed,
      needsSetup: actionCounts.needs_setup,
      blocked: actionCounts.blocked,
      planned: actionCounts.planned,
      unsafeBlockedByDesign: actionCounts.unsafe,
    },
    validationMatrix: {
      score: matrixScore,
      passing: matrixSummary.passing,
      partial: matrixSummary.partial,
      failing: matrixSummary.failing,
      preview: matrixSummary.preview,
      blocked: matrixSummary.blocked,
      total: matrixSummary.total,
    },
    workspace: {
      dispatch24h,
      lastDispatchAt,
    },
    generatedAt: new Date().toISOString(),
    docs: {
      capabilities: "/dashboard/capabilities",
      validation: "/dashboard/validation",
      commandCenter: "/dashboard/command-center",
      registryApi: "/api/actions/registry",
    },
  });
}
