/**
 * GET /api/autonomous-ops/state
 *
 * One-shot endpoint backing the /dashboard/autonomous-ops page. Composes
 * the AGI brain summary, execution graph, top coverage gaps, deep
 * validation status, and memory feedback into a single typed payload.
 */

import { NextResponse } from "next/server";
import { reasonAboutOperations } from "@/lib/agent/agiOperationsBrain";
import { buildExecutionGraph } from "@/lib/agent/executionGraphBuilder";
import { analyzeCoverageGaps } from "@/lib/cloud/coverageGapAnalyzer";
import { runDeepValidation } from "@/lib/validation/deepValidationRunner";
import { summarizeFeedback } from "@/lib/memory/feedbackLoop";
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
    const [brain, graph, gaps, deep] = await Promise.all([
      reasonAboutOperations({ context: ctx }),
      buildExecutionGraph(),
      Promise.resolve(analyzeCoverageGaps()),
      runDeepValidation(),
    ]);
    const memory = summarizeFeedback();

    return NextResponse.json(apiSuccess({
      generatedAt: new Date().toISOString(),
      brain,
      graph,
      gaps,
      deep,
      memory,
    }), { status: 200 });
  } catch (err) {
    const axiomErr = toAxiomError(err);
    return NextResponse.json(apiFailure(axiomErr), { status: httpStatusFor(axiomErr.category) });
  }
}

export async function POST(): Promise<NextResponse> { return handle(); }
export async function GET():  Promise<NextResponse> { return handle(); }
