/**
 * POST /api/simulations/create
 *
 * Runs the remediation pipeline and simulates every candidate at once.
 * Returns the SimulationResult list — the simulations page reads from
 * here.
 */

import { NextResponse } from "next/server";
import { runRemediationPipeline } from "@/lib/remediation/remediationPipeline";
import { buildDigitalTwin } from "@/lib/digitalTwin/digitalTwinBuilder";
import { changeSetFromCandidate } from "@/lib/simulation/changeSetModel";
import { runSimulation, type SimulationResult } from "@/lib/simulation/executionSimulator";
import { currentContext } from "@/lib/auth/currentContext";
import { apiFailure, apiSuccess } from "@/lib/api/dtoMappers";
import { AxiomErrors, httpStatusFor, toAxiomError } from "@/lib/errors/axiomErrors";

export const dynamic = "force-dynamic";

async function handle(): Promise<NextResponse> {
  try {
    const ctx = await currentContext();
    if (!ctx.isAuthenticated) throw AxiomErrors.validation("auth.required", "Sign in required.");

    const [pipeline, twin] = await Promise.all([runRemediationPipeline(), buildDigitalTwin()]);
    const results: SimulationResult[] = [];
    for (const bundle of pipeline.bundles) {
      const target = twin.resources.find((r) => bundle.candidate.resourceIds.includes(r.id));
      const changeSet = changeSetFromCandidate(bundle.candidate, target);
      const result = runSimulation({ twin, changeSet, operatorRoles: ctx.roles });
      results.push(result);
    }

    return NextResponse.json(apiSuccess({
      generatedAt: new Date().toISOString(),
      twinId: twin.id,
      results,
      summary: {
        total: results.length,
        simulated:    results.filter((r) => r.status === "simulated").length,
        preview_only: results.filter((r) => r.status === "preview_only").length,
        blocked:      results.filter((r) => r.status === "blocked").length,
        unsafe:       results.filter((r) => r.status === "unsafe").length,
        incomplete:   results.filter((r) => r.status === "incomplete").length,
      },
    }), { status: 200 });
  } catch (err) {
    const axiomErr = toAxiomError(err);
    return NextResponse.json(apiFailure(axiomErr), { status: httpStatusFor(axiomErr.category) });
  }
}

export async function POST(): Promise<NextResponse> { return handle(); }
export async function GET():  Promise<NextResponse> { return handle(); }
