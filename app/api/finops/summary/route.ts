/**
 * GET /api/finops/summary
 *
 * Returns the canonical FinOps Summary — honest cost foundation state.
 * Zero fabricated dollar savings. Until AWS Cost Explorer / Azure /
 * GCP billing connectors are wired, signals are labeled honestly.
 */

import { NextResponse } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { buildFinOpsReport } from "@/lib/finops/finOpsSummaryBuilder";
import { apiFailure, apiSuccess } from "@/lib/api/dtoMappers";
import { AxiomErrors, httpStatusFor, toAxiomError } from "@/lib/errors/axiomErrors";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  try {
    const ctx = await currentContext();
    if (!ctx.isAuthenticated || !ctx.organizationId) {
      throw AxiomErrors.validation("auth.required", "Sign in required.");
    }
    const report = await buildFinOpsReport({
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
