/**
 * GET /api/desktop/intelligence
 *
 * Returns the canonical DesktopIntelligenceReport. Pure read-only over
 * canonical state. Tenant-scoped. Never executes locally — that
 * boundary is enforced at the type level by the
 * `desktop_review_only_no_local_execution` safety contract.
 */

import { NextResponse } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { buildDesktopIntelligence } from "@/lib/desktop/desktopIntelligenceBuilder";
import { apiFailure, apiSuccess } from "@/lib/api/dtoMappers";
import { AxiomErrors, httpStatusFor, toAxiomError } from "@/lib/errors/axiomErrors";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  try {
    const ctx = await currentContext();
    if (!ctx.isAuthenticated || !ctx.organizationId) {
      throw AxiomErrors.validation("auth.required", "Sign in required.");
    }
    const report = await buildDesktopIntelligence({
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
