/**
 * GET /api/intelligence/next-actions
 *
 * Returns the canonical Next-Best-Action Report — a ranked list of
 * safe operator actions derived from the Priority Engine. Every
 * action is mapped to a literal safetyLevel; mutation actions are
 * never produced.
 *
 * Pure read-only over PriorityReport + AxiomOSState. Tenant-scoped.
 */

import { NextResponse } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { buildNextActions } from "@/lib/intelligence/nextActionEngine";
import { apiFailure, apiSuccess } from "@/lib/api/dtoMappers";
import { AxiomErrors, httpStatusFor, toAxiomError } from "@/lib/errors/axiomErrors";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  try {
    const ctx = await currentContext();
    if (!ctx.isAuthenticated || !ctx.organizationId) {
      throw AxiomErrors.validation("auth.required", "Sign in required.");
    }
    const report = await buildNextActions({
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
