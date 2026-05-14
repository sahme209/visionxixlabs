/**
 * GET /api/orchestration/locks
 *
 * Lists active execution locks (tenant-scoped). Useful for the UI to
 * surface why an action is blocked and for ops to debug stale locks.
 */

import { NextResponse } from "next/server";
import { listActiveLocks } from "@/lib/execution/executionLocks";
import { currentContext } from "@/lib/auth/currentContext";
import { apiFailure, apiSuccess } from "@/lib/api/dtoMappers";
import { AxiomErrors, httpStatusFor, toAxiomError } from "@/lib/errors/axiomErrors";

export const dynamic = "force-dynamic";

async function handle(): Promise<NextResponse> {
  try {
    const ctx = await currentContext();
    if (!ctx.isAuthenticated) throw AxiomErrors.validation("auth.required", "Sign in required.");
    const tenantId = ctx.organizationId ? String(ctx.organizationId) : undefined;
    const locks = listActiveLocks({ tenantId });
    return NextResponse.json(apiSuccess({ locks }), { status: 200 });
  } catch (err) {
    const axiomErr = toAxiomError(err);
    return NextResponse.json(apiFailure(axiomErr), { status: httpStatusFor(axiomErr.category) });
  }
}

export async function GET():  Promise<NextResponse> { return handle(); }
export async function POST(): Promise<NextResponse> { return handle(); }
