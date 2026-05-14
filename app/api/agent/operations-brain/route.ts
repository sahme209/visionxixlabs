/**
 * POST /api/agent/operations-brain
 *
 * Runs the AGI Operations Brain over the current platform state and
 * returns the typed result the dashboard / copilot can render. Auth
 * required — the brain reads tenant-scoped signals.
 */

import { NextResponse } from "next/server";
import { reasonAboutOperations } from "@/lib/agent/agiOperationsBrain";
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
    const result = await reasonAboutOperations({ context: ctx });
    return NextResponse.json(apiSuccess(result), { status: 200 });
  } catch (err) {
    const axiomErr = toAxiomError(err);
    return NextResponse.json(apiFailure(axiomErr), { status: httpStatusFor(axiomErr.category) });
  }
}

export async function POST(): Promise<NextResponse> { return handle(); }
export async function GET():  Promise<NextResponse> { return handle(); }
