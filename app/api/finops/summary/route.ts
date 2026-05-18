/**
 * GET /api/finops/summary
 *
 * Returns the canonical FinOps Summary via the canonical API envelope.
 * Zero fabricated dollar savings — until billing connectors wire,
 * signals are honestly labeled.
 */

import type { NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { buildFinOpsReport } from "@/lib/finops/finOpsSummaryBuilder";
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
    const report = await buildFinOpsReport({
      tenantId: ctx.organizationId,
      actorUserId: ctx.userId,
    });
    return apiOk(report, {
      correlationId,
      safetyContract: "finops_summary_read_only",
    });
  } catch (err) {
    return apiErr(err, { correlationId, safetyContract: "finops_summary_read_only" });
  }
}

export async function POST(req: NextRequest) { return GET(req); }
