/**
 * POST /api/simulations/from-remediation
 *
 * Body: { candidateId: string }
 *
 * Runs the remediation pipeline, finds the named candidate, composes a
 * ChangeSet, and simulates it against the current digital twin. Returns
 * the typed SimulationResult.
 */

import { NextResponse } from "next/server";
import { runRemediationPipeline } from "@/lib/remediation/remediationPipeline";
import { buildDigitalTwin } from "@/lib/digitalTwin/digitalTwinBuilder";
import { changeSetFromCandidate } from "@/lib/simulation/changeSetModel";
import { runSimulation } from "@/lib/simulation/executionSimulator";
import { currentContext } from "@/lib/auth/currentContext";
import { apiFailure, apiSuccess } from "@/lib/api/dtoMappers";
import { AxiomErrors, httpStatusFor, toAxiomError } from "@/lib/errors/axiomErrors";

export const dynamic = "force-dynamic";

function isValidBody(value: unknown): value is { candidateId: string } {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.candidateId === "string" && v.candidateId.length > 0;
}

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const ctx = await currentContext();
    if (!ctx.isAuthenticated) throw AxiomErrors.validation("auth.required", "Sign in required.");

    const body = await req.json().catch(() => null);
    if (!isValidBody(body)) throw AxiomErrors.validation("simulation.bad_input", "Missing 'candidateId'.");

    const [pipeline, twin] = await Promise.all([runRemediationPipeline(), buildDigitalTwin()]);
    const bundle = pipeline.bundles.find((b) => b.candidate.id === body.candidateId);
    if (!bundle) throw AxiomErrors.notFound("simulation.candidate_missing", "Remediation candidate not found in current pipeline run.");

    const targetResource = twin.resources.find((r) => bundle.candidate.resourceIds.includes(r.id));
    const changeSet = changeSetFromCandidate(bundle.candidate, targetResource);
    const result = runSimulation({ twin, changeSet, operatorRoles: ctx.roles });

    return NextResponse.json(apiSuccess({ result, changeSet }), { status: 200 });
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
