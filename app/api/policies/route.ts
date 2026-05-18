/**
 * GET /api/policies
 *
 * Returns the canonical PolicyReport — the declarative catalog of
 * every policy Axiom enforces. Pure read-only. No tenant scope —
 * policies are platform-wide.
 */

import { NextResponse } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { buildPolicyReport } from "@/lib/policy/policyEvaluator";
import { apiFailure, apiSuccess } from "@/lib/api/dtoMappers";
import { AxiomErrors, httpStatusFor, toAxiomError } from "@/lib/errors/axiomErrors";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  try {
    const ctx = await currentContext();
    if (!ctx.isAuthenticated) {
      throw AxiomErrors.validation("auth.required", "Sign in required.");
    }
    const report = await buildPolicyReport();
    return NextResponse.json(apiSuccess(report), { status: 200 });
  } catch (err) {
    const axiomErr = toAxiomError(err);
    return NextResponse.json(apiFailure(axiomErr), { status: httpStatusFor(axiomErr.category) });
  }
}

export async function POST(): Promise<NextResponse> { return GET(); }
