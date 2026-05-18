/**
 * GET /api/cicd
 *
 * Returns the canonical CI/CD Operations Report via the canonical
 * API envelope. Pure read-only: catalog operations are declared,
 * not executed.
 */

import type { NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { buildCicdOps } from "@/lib/cicd/cicdOpsBuilder";
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
    const report = await buildCicdOps({
      tenantId: ctx.organizationId,
      actorUserId: ctx.userId,
    });
    return apiOk(report, {
      correlationId,
      safetyContract: "cicd_ops_gated_no_unsafe_execution",
      sourceMode: asApiSourceMode(report.overallSourceMode),
    });
  } catch (err) {
    return apiErr(err, { correlationId, safetyContract: "cicd_ops_gated_no_unsafe_execution" });
  }
}

export async function POST(req: NextRequest) { return GET(req); }
