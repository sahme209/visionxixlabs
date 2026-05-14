/**
 * POST /api/agent/plan-next-actions
 *
 * Runs the autonomous planning loop over current platform state and
 * returns ordered candidate actions. Pure observe → plan, no destructive
 * dispatch — the loop intentionally pauses at the dispatch phase until an
 * operator acts.
 */

import { NextResponse } from "next/server";
import { runAutonomousPlanningLoop } from "@/lib/agent/autonomousPlanningLoop";
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
    const result = await runAutonomousPlanningLoop();
    return NextResponse.json(apiSuccess(result), { status: 200 });
  } catch (err) {
    const axiomErr = toAxiomError(err);
    return NextResponse.json(apiFailure(axiomErr), { status: httpStatusFor(axiomErr.category) });
  }
}

export async function POST(): Promise<NextResponse> { return handle(); }
export async function GET():  Promise<NextResponse> { return handle(); }
