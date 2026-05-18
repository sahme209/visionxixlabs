/**
 * GET /api/intelligence/priorities
 *
 * Returns the canonical Operational Priority Report. Ranked top-down
 * by composite score with explainable score breakdowns. Pure read-only
 * over AxiomOSState + Operating Graph. Tenant-scoped.
 *
 * No SDK calls. No mutation. No fake certainty — confidence reflects
 * evidence quality + sourceMode.
 */

import { NextResponse } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { buildPriorityReport } from "@/lib/intelligence/priorityEngine";
import { apiFailure, apiSuccess } from "@/lib/api/dtoMappers";
import { AxiomErrors, httpStatusFor, toAxiomError } from "@/lib/errors/axiomErrors";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  try {
    const ctx = await currentContext();
    if (!ctx.isAuthenticated || !ctx.organizationId) {
      throw AxiomErrors.validation("auth.required", "Sign in required.");
    }
    const report = await buildPriorityReport({
      tenantId: ctx.organizationId,
      actorUserId: ctx.userId,
    });
    return NextResponse.json(apiSuccess(report), { status: 200 });
  } catch (err) {
    const axiomErr = toAxiomError(err);
    return NextResponse.json(apiFailure(axiomErr), { status: httpStatusFor(axiomErr.category) });
  }
}

export async function POST(): Promise<NextResponse> { return GET(); }
