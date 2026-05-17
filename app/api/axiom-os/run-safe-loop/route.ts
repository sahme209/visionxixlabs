/**
 * POST /api/axiom-os/run-safe-loop
 *
 * Delegates to the operating-loop runner which already enforces the
 * safe-task contract (refuses approval / preflight / verification /
 * desktop_review stages). Returns the per-provider runner reports
 * alongside the freshly-rebuilt AxiomOSState.
 *
 * Audited. No destructive execution paths anywhere in this flow.
 */

import { NextResponse } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { runAllOperatingLoops } from "@/lib/operatingLoop/operatingLoopRunner";
import { buildAxiomOSState } from "@/lib/axiomOS/axiomOSStateBuilder";
import { apiFailure, apiSuccess } from "@/lib/api/dtoMappers";
import { AxiomErrors, httpStatusFor, toAxiomError } from "@/lib/errors/axiomErrors";

export const dynamic = "force-dynamic";

export async function POST(): Promise<NextResponse> {
  try {
    const ctx = await currentContext();
    if (!ctx.isAuthenticated || !ctx.organizationId) {
      throw AxiomErrors.validation("auth.required", "Sign in required.");
    }
    const reports = await runAllOperatingLoops({
      organizationId: ctx.organizationId,
      actorUserId: ctx.userId,
    });
    const state = await buildAxiomOSState({
      tenantId: ctx.organizationId,
      actorUserId: ctx.userId,
    });
    return NextResponse.json(
      apiSuccess({
        state,
        reports,
        summary: {
          providersAdvanced: reports.filter((r) => r.run.status === "completed" || r.run.status === "in_progress").length,
          providersBlocked: reports.filter((r) => r.run.status === "blocked" || r.run.status === "failed").length,
          providersPausedForApproval: reports.filter((r) => r.run.status === "paused_for_approval").length,
          providersPausedForInput: reports.filter((r) => r.run.status === "paused_for_user_input").length,
        },
      }),
      { status: 200 },
    );
  } catch (err) {
    const axiomErr = toAxiomError(err);
    return NextResponse.json(apiFailure(axiomErr), { status: httpStatusFor(axiomErr.category) });
  }
}
