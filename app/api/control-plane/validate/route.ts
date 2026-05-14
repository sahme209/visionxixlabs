/**
 * POST /api/control-plane/validate
 *
 * Runs the autonomous + deep validation passes and returns the combined
 * report. Drives the validation matrix surface + control plane builder.
 */

import { NextResponse } from "next/server";
import { runAutonomousValidationLoop } from "@/lib/validation/autonomousValidationLoop";
import { runDeepValidation } from "@/lib/validation/deepValidationRunner";
import { currentContext } from "@/lib/auth/currentContext";
import { apiFailure, apiSuccess } from "@/lib/api/dtoMappers";
import { AxiomErrors, httpStatusFor, toAxiomError } from "@/lib/errors/axiomErrors";

export const dynamic = "force-dynamic";

async function handle(): Promise<NextResponse> {
  try {
    const ctx = await currentContext();
    if (!ctx.isAuthenticated) throw AxiomErrors.validation("auth.required", "Sign in required.");
    const [autonomous, deep] = await Promise.all([runAutonomousValidationLoop(), runDeepValidation()]);
    return NextResponse.json(apiSuccess({ autonomous, deep }), { status: 200 });
  } catch (err) {
    const axiomErr = toAxiomError(err);
    return NextResponse.json(apiFailure(axiomErr), { status: httpStatusFor(axiomErr.category) });
  }
}

export async function POST(): Promise<NextResponse> { return handle(); }
export async function GET():  Promise<NextResponse> { return handle(); }
