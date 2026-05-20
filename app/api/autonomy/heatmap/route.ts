/**
 * GET /api/autonomy/heatmap
 *
 * Returns the DecisionHeatmap — last 7 days (default) of stage ×
 * outcome counts so operators can see where halts cluster.
 *
 * Query params:
 *   - windowDays (1..90, default 7)
 */

import type { NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { buildDecisionHeatmap } from "@/lib/autonomy/decisionHeatmapBuilder";
import { apiOk, apiErr, asApiSourceMode, resolveCorrelationId } from "@/lib/api";
import { AxiomErrors } from "@/lib/errors/axiomErrors";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const correlationId = resolveCorrelationId(req.headers);
  try {
    const ctx = await currentContext();
    if (!ctx.isAuthenticated || !ctx.organizationId) {
      throw AxiomErrors.validation("auth.required", "Sign in required.");
    }
    const raw = req.nextUrl.searchParams.get("windowDays");
    const days = raw ? Number.parseInt(raw, 10) : 7;
    const clamped = Math.max(1, Math.min(Number.isFinite(days) ? days : 7, 90));
    const heatmap = await buildDecisionHeatmap({
      organizationId: String(ctx.organizationId),
      windowMs: clamped * 24 * 60 * 60 * 1000,
    });
    return apiOk(heatmap, {
      correlationId,
      safetyContract: "audit_read_only",
      sourceMode: asApiSourceMode("live"),
    });
  } catch (err) {
    return apiErr(err, { correlationId, safetyContract: "audit_read_only" });
  }
}

export async function POST(req: NextRequest) { return GET(req); }
