/**
 * POST /api/operating-loop/run
 *
 * Runs the operating loop across every provider — walks each loop through
 * its safe stages and reports outcomes. Refuses all destructive paths.
 * Audited.
 */

import { NextResponse } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { runAllOperatingLoops } from "@/lib/operatingLoop/operatingLoopRunner";
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
    return NextResponse.json(
      apiSuccess({
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
