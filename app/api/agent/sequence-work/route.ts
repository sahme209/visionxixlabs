/**
 * POST /api/agent/sequence-work
 *
 * Decomposes the goal then sequences the resulting task list according
 * to the canonical safety ordering rules. Single round-trip for the
 * autonomous-ops UI.
 */

import { NextResponse } from "next/server";
import { decomposeGoal } from "@/lib/agent/taskDecomposer";
import { sequenceWork } from "@/lib/agent/workSequencer";
import { currentContext } from "@/lib/auth/currentContext";
import { apiFailure, apiSuccess } from "@/lib/api/dtoMappers";
import { AxiomErrors, httpStatusFor, toAxiomError } from "@/lib/errors/axiomErrors";

export const dynamic = "force-dynamic";

function isValidBody(value: unknown): value is { goal: string } {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.goal === "string" && v.goal.trim().length > 0;
}

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const ctx = await currentContext();
    if (!ctx.isAuthenticated) {
      throw AxiomErrors.validation("auth.required", "Sign in required.");
    }
    const body = await req.json().catch(() => null);
    if (!isValidBody(body)) {
      throw AxiomErrors.validation("sequence.bad_input", "Missing 'goal'.");
    }
    const decomposed = decomposeGoal({ goal: body.goal.slice(0, 500), operatorRoles: ctx.roles });
    const sequenced  = sequenceWork(decomposed.tasks);
    return NextResponse.json(apiSuccess({ decomposed, sequenced }), { status: 200 });
  } catch (err) {
    const axiomErr = toAxiomError(err);
    return NextResponse.json(apiFailure(axiomErr), { status: httpStatusFor(axiomErr.category) });
  }
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    apiFailure(AxiomErrors.validation("method.not_allowed", "Use POST.")),
    { status: 405 },
  );
}
