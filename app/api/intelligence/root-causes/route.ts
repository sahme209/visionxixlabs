/**
 * GET /api/intelligence/root-causes
 *
 * Returns the canonical Root Cause grouping report. Pure projection
 * over the Risk Queue. Tenant-scoped. No SDK calls.
 */

import { NextResponse } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { buildRootCauses } from "@/lib/intelligence/rootCauseGrouper";
import { apiFailure, apiSuccess } from "@/lib/api/dtoMappers";
import { AxiomErrors, httpStatusFor, toAxiomError } from "@/lib/errors/axiomErrors";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  try {
    const ctx = await currentContext();
    if (!ctx.isAuthenticated || !ctx.organizationId) {
      throw AxiomErrors.validation("auth.required", "Sign in required.");
    }
    const report = await buildRootCauses({
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
