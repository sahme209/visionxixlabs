/**
 * GET /api/desktop/releases
 *
 * Returns the canonical DesktopReleaseReport. Pure read-only over the
 * release manifest + distribution registry. Tenant-scoped. Never
 * publishes — the safety contract is `release_review_only_no_publish`.
 */

import { NextResponse } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { buildDesktopReleaseReport } from "@/lib/desktop/desktopReleaseBuilder";
import { apiFailure, apiSuccess } from "@/lib/api/dtoMappers";
import { AxiomErrors, httpStatusFor, toAxiomError } from "@/lib/errors/axiomErrors";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  try {
    const ctx = await currentContext();
    if (!ctx.isAuthenticated || !ctx.organizationId) {
      throw AxiomErrors.validation("auth.required", "Sign in required.");
    }
    const report = await buildDesktopReleaseReport({
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
