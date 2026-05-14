/**
 * POST /api/remediation/readiness
 *
 * Returns the readiness outcome for every remediation bundle produced by
 * the current pipeline run. The client can also call /api/execution/readiness
 * with raw signals — this endpoint is the convenience wrapper that runs
 * the planner first.
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
      readiness: outcome.bundles.map((b) => ({
        candidateId: b.candidate.id,
        title:       b.candidate.title,
        provider:    b.candidate.provider,
        riskLevel:   b.candidate.riskLevel,
        decision:    b.readiness.decision,
        reason:      b.readiness.reason,
        safeNextAction: b.readiness.safeNextAction,
        finalStatus: b.finalStatus,
      })),
    }), { status: 200 });
  } catch (err) {
    const axiomErr = toAxiomError(err);
    return NextResponse.json(apiFailure(axiomErr), { status: httpStatusFor(axiomErr.category) });
  }
}

export async function POST(): Promise<NextResponse> { return handle(); }
export async function GET():  Promise<NextResponse> { return handle(); }
