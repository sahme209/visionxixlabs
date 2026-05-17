/**
 * GET /api/readiness/launch
 *
 * Launch readiness report — composes from existing canonical builders
 * (AxiomOS state, production readiness runner, validation matrix,
 * control registry, env). Honest scoring: preview categories cap at
 * "partial", never claim "launch_ready".
 *
 * Inspect-only. Tenant-scoped.
 */

import { NextResponse } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { runLaunchReadiness } from "@/lib/readiness/launchReadinessRunner";
import { apiFailure, apiSuccess } from "@/lib/api/dtoMappers";
import { AxiomErrors, httpStatusFor, toAxiomError } from "@/lib/errors/axiomErrors";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  try {
    const ctx = await currentContext();
    if (!ctx.isAuthenticated || !ctx.organizationId) {
      throw AxiomErrors.validation("auth.required", "Sign in required.");
    }
    const report = await runLaunchReadiness({
      organizationId: ctx.organizationId,
      actorUserId: ctx.userId,
    });
    return NextResponse.json(apiSuccess(report), { status: 200 });
  } catch (err) {
    const axiomErr = toAxiomError(err);
    return NextResponse.json(apiFailure(axiomErr), { status: httpStatusFor(axiomErr.category) });
  }
}

export async function POST(): Promise<NextResponse> { return GET(); }
