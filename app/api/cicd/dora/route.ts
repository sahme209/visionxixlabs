/**
 * GET /api/cicd/dora
 *
 * Returns the canonical DORA metrics report — Deployment Frequency,
 * Lead Time for Changes, Change Failure Rate, MTTR. Pure read-only
 * composition over CicdOpsReport + IncidentResponseReport.
 *
 * Query: ?windowDays=30 (default 30, max 90)
 */

import type { NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { buildDoraReport } from "@/lib/cicd/doraMetricsBuilder";
import { apiOk, apiErr, resolveCorrelationId } from "@/lib/api";
import { AxiomErrors } from "@/lib/errors/axiomErrors";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const correlationId = resolveCorrelationId(req.headers);
  try {
    const ctx = await currentContext();
    if (!ctx.isAuthenticated || !ctx.organizationId) {
      throw AxiomErrors.validation("auth.required", "Sign in required.");
    }
    const url = new URL(req.url);
    const raw = Number(url.searchParams.get("windowDays") ?? "30");
    const windowDays = Number.isFinite(raw) ? Math.max(1, Math.min(90, raw)) : 30;
    const report = await buildDoraReport({
      tenantId: ctx.organizationId,
      actorUserId: ctx.userId,
      windowDays,
    });
    return apiOk(report, {
      correlationId,
      safetyContract: "cicd_ops_gated_no_unsafe_execution",
    });
  } catch (err) {
    return apiErr(err, { correlationId, safetyContract: "cicd_ops_gated_no_unsafe_execution" });
  }
}

export async function POST(req: NextRequest) { return GET(req); }
