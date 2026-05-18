/**
 * GET /api/intelligence/executive-summary
 *
 * Returns the canonical Executive Operational Summary via the
 * canonical API envelope. Pure read-only composition over
 * PriorityReport + AxiomOSState + IntegrationHealthReport.
 */

import type { NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { buildExecutiveSummary } from "@/lib/intelligence/executiveSummaryBuilder";
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
    const summary = await buildExecutiveSummary({
      tenantId: ctx.organizationId,
      actorUserId: ctx.userId,
    });
    return apiOk(summary, {
      correlationId,
      safetyContract: "executive_summary_read_only",
    });
  } catch (err) {
    return apiErr(err, { correlationId, safetyContract: "executive_summary_read_only" });
  }
}

export async function POST(req: NextRequest) { return GET(req); }
