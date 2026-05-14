/**
 * GET /api/control-plane/next-actions
 *
 * Returns the ordered list of next-best actions Axiom can take or
 * recommend. Auth-gated. Pure read.
 */

import { NextResponse } from "next/server";
import { buildControlPlaneState } from "@/lib/controlPlane/controlPlaneBuilder";
import { currentContext } from "@/lib/auth/currentContext";
import { apiFailure, apiSuccess } from "@/lib/api/dtoMappers";
import { AxiomErrors, httpStatusFor, toAxiomError } from "@/lib/errors/axiomErrors";

export const dynamic = "force-dynamic";

async function handle(): Promise<NextResponse> {
  try {
    const ctx = await currentContext();
    if (!ctx.isAuthenticated) throw AxiomErrors.validation("auth.required", "Sign in required.");
    const state = await buildControlPlaneState();
    return NextResponse.json(apiSuccess({
      generatedAt: state.generatedAt,
      nextBestActions: state.nextBestActions,
    }), { status: 200 });
  } catch (err) {
    const axiomErr = toAxiomError(err);
    return NextResponse.json(apiFailure(axiomErr), { status: httpStatusFor(axiomErr.category) });
  }
}

export async function GET():  Promise<NextResponse> { return handle(); }
export async function POST(): Promise<NextResponse> { return handle(); }
