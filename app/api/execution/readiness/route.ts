/**
 * POST /api/execution/readiness
 *
 * Evaluates execution readiness for a candidate plan. Caller supplies the
 * typed readiness signals (provider connection, snapshot freshness,
 * confidence, policy, approval, rollback, verification, desktop, audit,
 * permission, feature mode) and the endpoint returns a single decision
 * the UI + copilot read from. Never mutates cloud state.
 */

import { NextResponse } from "next/server";
import {
  evaluateExecutionReadiness,
  type ExecutionReadinessInput,
} from "@/lib/execution/executionReadiness";
import { currentContext } from "@/lib/auth/currentContext";
import { apiFailure, apiSuccess } from "@/lib/api/dtoMappers";
import { AxiomErrors, httpStatusFor, toAxiomError } from "@/lib/errors/axiomErrors";

export const dynamic = "force-dynamic";

function isExecutionReadinessInput(value: unknown): value is ExecutionReadinessInput {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.planId === "string"
    && (v.provider === "aws" || v.provider === "azure" || v.provider === "gcp" || v.provider === "github" || v.provider === "multi")
    && typeof v.providerConnected === "boolean"
    && typeof v.snapshotFresh === "boolean"
    && typeof v.findingConfidence === "number"
    && typeof v.recommendationConfidence === "number"
    && typeof v.policyAllows === "boolean"
    && typeof v.approvalGranted === "boolean"
    && typeof v.rollbackPresent === "boolean"
    && typeof v.verificationPresent === "boolean"
    && typeof v.desktopHandoffEligible === "boolean"
    && typeof v.auditWired === "boolean"
    && typeof v.userHasPermission === "boolean"
    && (v.featureMode === "preview" || v.featureMode === "expanding" || v.featureMode === "live" || v.featureMode === "blocked");
}

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const ctx = await currentContext();
    if (!ctx.isAuthenticated) {
      throw AxiomErrors.validation("auth.required", "Sign in required.");
    }
    const body = await req.json().catch(() => null);
    if (!isExecutionReadinessInput(body)) {
      throw AxiomErrors.validation("execution.readiness.bad_input", "Missing or invalid readiness signals.");
    }
    const outcome = evaluateExecutionReadiness(body);
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
