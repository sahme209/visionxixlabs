/**
 * POST /api/orchestration/preflight
 *
 * Runs the preflight engine against the typed inputs supplied by the
 * caller (the UI composes these from the orchestration record). No real
 * execution.
 */

import { NextResponse } from "next/server";
import { runPreflight, type PreflightInput } from "@/lib/execution/preflightEngine";
import { currentContext } from "@/lib/auth/currentContext";
import { apiFailure, apiSuccess } from "@/lib/api/dtoMappers";
import { AxiomErrors, httpStatusFor, toAxiomError } from "@/lib/errors/axiomErrors";

export const dynamic = "force-dynamic";

function isValidBody(value: unknown): value is PreflightInput {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.sourceMode === "string"
    && typeof v.providerConnected === "boolean"
    && typeof v.resourceExists === "boolean"
    && typeof v.simulationPresent === "boolean"
    && typeof v.policyPresent === "boolean"
    && typeof v.approvalPresent === "boolean"
    && typeof v.approvalStatus === "string"
    && typeof v.rollbackPresent === "boolean"
    && typeof v.verificationPresent === "boolean"
    && typeof v.auditWired === "boolean"
    && typeof v.hasRequiredPermissions === "boolean"
    && typeof v.featureModeAllows === "boolean"
    && typeof v.unknownDestructive === "boolean"
    && typeof v.stalePlan === "boolean"
    && typeof v.conflictingWorkflowRunning === "boolean";
}

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const ctx = await currentContext();
    if (!ctx.isAuthenticated) throw AxiomErrors.validation("auth.required", "Sign in required.");

    const body = await req.json().catch(() => null);
    if (!isValidBody(body)) throw AxiomErrors.validation("preflight.bad_input", "Missing or invalid preflight signals.");

    const outcome = runPreflight(body);
    return NextResponse.json(apiSuccess(outcome), { status: 200 });
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
