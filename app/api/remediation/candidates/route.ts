/**
 * GET/POST /api/remediation/candidates
 *
 * Runs the remediation pipeline and returns the typed candidate bundles.
 * Auth-gated. No apply.
 */

import { NextResponse } from "next/server";
import { runRemediationPipeline } from "@/lib/remediation/remediationPipeline";
import { currentContext } from "@/lib/auth/currentContext";
import { apiFailure, apiSuccess } from "@/lib/api/dtoMappers";
import { AxiomErrors, httpStatusFor, toAxiomError } from "@/lib/errors/axiomErrors";

export const dynamic = "force-dynamic";

async function handle(): Promise<NextResponse> {
  try {
    const ctx = await currentContext();
    if (!ctx.isAuthenticated) throw AxiomErrors.validation("auth.required", "Sign in required.");
    const outcome = await runRemediationPipeline();
    return NextResponse.json(apiSuccess({
      generatedAt: outcome.generatedAt,
      tenantId:    outcome.tenantId,
      candidates:  outcome.bundles.map((b) => b.candidate),
      summary:     outcome.summary,
    }), { status: 200 });
  } catch (err) {
    const axiomErr = toAxiomError(err);
    return NextResponse.json(apiFailure(axiomErr), { status: httpStatusFor(axiomErr.category) });
  }
}

export async function POST(): Promise<NextResponse> { return handle(); }
export async function GET():  Promise<NextResponse> { return handle(); }
