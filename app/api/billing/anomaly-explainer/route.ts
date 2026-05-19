/**
 * GET /api/billing/anomaly-explainer
 *
 * Returns the CostAnomalyExplainerReport — every billing anomaly
 * correlated against the live CloudTrail event tail. Read-only.
 *
 * Query params:
 *   - lookbackMinutes (default 1440 = 24h)
 */

import type { NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { buildCostAnomalyExplainer } from "@/lib/billing/costAnomalyExplainer";
import { apiOk, apiErr, asApiSourceMode, resolveCorrelationId } from "@/lib/api";
import { AxiomErrors } from "@/lib/errors/axiomErrors";

export const dynamic = "force-dynamic";
export const maxDuration = 45;

export async function GET(req: NextRequest) {
  const correlationId = resolveCorrelationId(req.headers);
  try {
    const ctx = await currentContext();
    if (!ctx.isAuthenticated || !ctx.organizationId) {
      throw AxiomErrors.validation("auth.required", "Sign in required.");
    }
    const raw = req.nextUrl.searchParams.get("lookbackMinutes");
    const lookbackMinutes = raw ? Number.parseInt(raw, 10) : undefined;
    const report = await buildCostAnomalyExplainer({
      tenantId: ctx.organizationId,
      actorUserId: ctx.userId,
      lookbackMinutes: Number.isFinite(lookbackMinutes) ? lookbackMinutes : undefined,
    });
    return apiOk(report, {
      correlationId,
      safetyContract: "billing_summary_read_only",
      sourceMode: asApiSourceMode(report.anomaliesInspected > 0 ? "live" : "preview"),
    });
  } catch (err) {
    return apiErr(err, { correlationId, safetyContract: "billing_summary_read_only" });
  }
}

export async function POST(req: NextRequest) { return GET(req); }
