/**
 * POST /api/axiom-os/refresh
 *
 * Forces a rebuild of the AxiomOSState and writes an audit event. Same
 * payload as GET /api/axiom-os/state but audited as an explicit operator
 * action.
 */

import { NextResponse } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { buildAxiomOSState } from "@/lib/axiomOS/axiomOSStateBuilder";
import { apiFailure, apiSuccess } from "@/lib/api/dtoMappers";
import { AxiomErrors, httpStatusFor, toAxiomError } from "@/lib/errors/axiomErrors";
import { record as auditRecord } from "@/lib/audit/secureAudit";
import type { CorrelationId } from "@/lib/domain/ids";

export const dynamic = "force-dynamic";

export async function POST(): Promise<NextResponse> {
  const correlationId = `axiomos_refresh_${Date.now().toString(36)}` as CorrelationId;
  try {
    const ctx = await currentContext();
    if (!ctx.isAuthenticated || !ctx.organizationId) {
      throw AxiomErrors.validation("auth.required", "Sign in required.");
    }
    const state = await buildAxiomOSState({
      tenantId: ctx.organizationId,
      actorUserId: ctx.userId,
    });
    await auditRecord({
      organizationId: ctx.organizationId,
      actorUserId: ctx.userId,
      action: "scan.start",
      outcome: "success",
      entityRef: "axiom_os",
      correlationId,
      detail: {
        overallStatus: state.overallStatus,
        sourceMode: state.sourceMode,
        readinessScore: state.readinessScore,
        trustScore: state.trustScore,
        nextActions: state.nextBestActions.length,
        criticalBlockers: state.criticalBlockers.length,
      },
    });
    return NextResponse.json(apiSuccess(state), { status: 200 });
  } catch (err) {
    const axiomErr = toAxiomError(err);
    return NextResponse.json(apiFailure(axiomErr), { status: httpStatusFor(axiomErr.category) });
  }
}
