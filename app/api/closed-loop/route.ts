/**
 * GET /api/closed-loop
 *
 * Returns the canonical Closed-Loop Remediation Report via the
 * canonical API envelope. Verifies after-state with independent
 * telemetry — never the same agent that proposed the change.
 */

import type { NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { buildClosedLoop } from "@/lib/closedLoop/closedLoopBuilder";
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
    const report = await buildClosedLoop({
      tenantId: ctx.organizationId,
      actorUserId: ctx.userId,
    });
    return apiOk(report, {
      correlationId,
      safetyContract: "closed_loop_remediation_gated",
      sourceMode: asApiSourceMode(report.overallSourceMode),
    });
  } catch (err) {
    return apiErr(err, { correlationId, safetyContract: "closed_loop_remediation_gated" });
  }
}

export async function POST(req: NextRequest) { return GET(req); }
