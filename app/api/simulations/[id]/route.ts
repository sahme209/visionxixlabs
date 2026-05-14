/**
 * GET /api/simulations/[id]
 *
 * Returns the simulation for the named remediation candidate id. Until
 * simulations are persisted, the id is the candidate id and the endpoint
 * re-derives the result deterministically.
 */

import { NextRequest, NextResponse } from "next/server";
import { runRemediationPipeline } from "@/lib/remediation/remediationPipeline";
import { buildDigitalTwin } from "@/lib/digitalTwin/digitalTwinBuilder";
import { changeSetFromCandidate } from "@/lib/simulation/changeSetModel";
import { runSimulation } from "@/lib/simulation/executionSimulator";
import { currentContext } from "@/lib/auth/currentContext";
import { apiFailure, apiSuccess } from "@/lib/api/dtoMappers";
import { AxiomErrors, httpStatusFor, toAxiomError } from "@/lib/errors/axiomErrors";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const ctx = await currentContext();
    if (!ctx.isAuthenticated) throw AxiomErrors.validation("auth.required", "Sign in required.");

    const { id } = await params;
    const [pipeline, twin] = await Promise.all([runRemediationPipeline(), buildDigitalTwin()]);
    const bundle = pipeline.bundles.find((b) => b.candidate.id === id);
    if (!bundle) throw AxiomErrors.notFound("simulation.candidate_missing", "Remediation candidate not found in current pipeline run.");

    const target = twin.resources.find((r) => bundle.candidate.resourceIds.includes(r.id));
    const changeSet = changeSetFromCandidate(bundle.candidate, target);
    const result = runSimulation({ twin, changeSet, operatorRoles: ctx.roles });

    return NextResponse.json(apiSuccess({ result, changeSet }), { status: 200 });
  } catch (err) {
    const axiomErr = toAxiomError(err);
    return NextResponse.json(apiFailure(axiomErr), { status: httpStatusFor(axiomErr.category) });
  }
}
