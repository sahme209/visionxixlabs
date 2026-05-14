/**
 * POST /api/validation/run
 *
 * Runs the autonomous validation loop and returns the typed readiness
 * report. Safe to call from the validation page, the brain, and
 * scheduled jobs — every probe is bounded and non-destructive.
 */

import { NextResponse } from "next/server";
import { runAutonomousValidationLoop } from "@/lib/validation/autonomousValidationLoop";
import { currentContext } from "@/lib/auth/currentContext";
import { apiFailure, apiSuccess } from "@/lib/api/dtoMappers";
import { AxiomErrors, httpStatusFor, toAxiomError } from "@/lib/errors/axiomErrors";

export const dynamic = "force-dynamic";

async function handle(): Promise<NextResponse> {
  try {
    const ctx = await currentContext();
    if (!ctx.isAuthenticated) {
      throw AxiomErrors.validation("auth.required", "Sign in required.");
    }
    const result = await runAutonomousValidationLoop();
    return NextResponse.json(apiSuccess(result), { status: 200 });
  } catch (err) {
    const axiomErr = toAxiomError(err);
    return NextResponse.json(apiFailure(axiomErr), { status: httpStatusFor(axiomErr.category) });
  }
}

export async function POST(): Promise<NextResponse> { return handle(); }
export async function GET():  Promise<NextResponse> { return handle(); }
