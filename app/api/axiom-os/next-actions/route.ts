/**
 * GET /api/axiom-os/next-actions
 *
 * Subset endpoint — returns just the operator-action surfaces from the
 * unified AxiomOSState (next-best-actions, safe autonomous tasks,
 * user-required actions, critical blockers).
 */

import { NextResponse } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { buildAxiomOSState } from "@/lib/axiomOS/axiomOSStateBuilder";
import { apiFailure, apiSuccess } from "@/lib/api/dtoMappers";
import { AxiomErrors, httpStatusFor, toAxiomError } from "@/lib/errors/axiomErrors";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  try {
    const ctx = await currentContext();
    if (!ctx.isAuthenticated || !ctx.organizationId) {
      throw AxiomErrors.validation("auth.required", "Sign in required.");
    }
    const state = await buildAxiomOSState({
      tenantId: ctx.organizationId,
      actorUserId: ctx.userId,
    });
    return NextResponse.json(
      apiSuccess({
        generatedAt: state.generatedAt,
        sourceMode: state.sourceMode,
        nextBestActions: state.nextBestActions,
        safeAutonomousTasks: state.safeAutonomousTasks,
        userRequiredActions: state.userRequiredActions,
        criticalBlockers: state.criticalBlockers,
      }),
      { status: 200 },
    );
  } catch (err) {
    const axiomErr = toAxiomError(err);
    return NextResponse.json(apiFailure(axiomErr), { status: httpStatusFor(axiomErr.category) });
  }
}

export async function POST(): Promise<NextResponse> { return GET(); }
