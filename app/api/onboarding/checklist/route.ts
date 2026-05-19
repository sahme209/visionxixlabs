/**
 * GET /api/onboarding/checklist
 *
 * Returns the first-run OnboardingChecklist — pure local snapshot
 * of env-driven readiness, no DB / network call. Tenant-scoped at
 * the auth boundary so signed-out callers can't read env posture.
 */

import type { NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { buildOnboardingChecklist } from "@/lib/onboarding/onboardingChecklist";
import { apiOk, apiErr, asApiSourceMode, resolveCorrelationId } from "@/lib/api";
import { AxiomErrors } from "@/lib/errors/axiomErrors";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const correlationId = resolveCorrelationId(req.headers);
  try {
    const ctx = await currentContext();
    if (!ctx.isAuthenticated) throw AxiomErrors.validation("auth.required", "Sign in required.");
    const checklist = buildOnboardingChecklist();
    return apiOk(checklist, {
      correlationId,
      safetyContract: "setup_review_only_no_execution",
      sourceMode: asApiSourceMode("live"),
    });
  } catch (err) {
    return apiErr(err, { correlationId, safetyContract: "setup_review_only_no_execution" });
  }
}

export async function POST(req: NextRequest) { return GET(req); }
