/**
 * GET/POST /api/agent/execution-graph
 *
 * Builds the AGI operations graph from typed signals across the platform
 * (coverage, validation, command-center, releases, planning).
 */

import { NextResponse } from "next/server";
import { buildExecutionGraph } from "@/lib/agent/executionGraphBuilder";
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
    const graph = await buildExecutionGraph();
    return NextResponse.json(apiSuccess(graph), { status: 200 });
  } catch (err) {
    const axiomErr = toAxiomError(err);
    return NextResponse.json(apiFailure(axiomErr), { status: httpStatusFor(axiomErr.category) });
  }
}

export async function POST(): Promise<NextResponse> { return handle(); }
export async function GET():  Promise<NextResponse> { return handle(); }
