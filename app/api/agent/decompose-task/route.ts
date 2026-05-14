/**
 * POST /api/agent/decompose-task
 *
 * Breaks a user goal into a typed task list. Pure function over goal text
 * + optional preferred targets — no side effects.
 */

import { NextResponse } from "next/server";
import { decomposeGoal, listCanonicalGoals } from "@/lib/agent/taskDecomposer";
import { currentContext } from "@/lib/auth/currentContext";
import { apiFailure, apiSuccess } from "@/lib/api/dtoMappers";
import { AxiomErrors, httpStatusFor, toAxiomError } from "@/lib/errors/axiomErrors";

export const dynamic = "force-dynamic";

function isValidBody(value: unknown): value is { goal: string; preferredTargets?: string[]; operatorRoles?: string[] } {
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
      throw AxiomErrors.validation("decompose.bad_input", "Missing 'goal' (non-empty string).");
    }
    const outcome = decomposeGoal({
      goal: body.goal.slice(0, 500),
      preferredTargets: Array.isArray(body.preferredTargets)
        ? (body.preferredTargets.filter((t) => typeof t === "string") as ("aws" | "azure" | "gcp" | "github" | "desktop" | "security_scanner" | "all_clouds" | "platform")[])
        : undefined,
      operatorRoles: Array.isArray(body.operatorRoles)
        ? (body.operatorRoles.filter((r) => typeof r === "string") as string[])
        : ctx.roles,
    });
    return NextResponse.json(apiSuccess(outcome), { status: 200 });
  } catch (err) {
    const axiomErr = toAxiomError(err);
    return NextResponse.json(apiFailure(axiomErr), { status: httpStatusFor(axiomErr.category) });
  }
}

export async function GET(): Promise<NextResponse> {
  // Helpful idempotent fallback — list the canonical goals.
  return NextResponse.json(apiSuccess({ canonicalGoals: listCanonicalGoals() }), { status: 200 });
}
