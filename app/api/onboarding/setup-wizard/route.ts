/**
 * GET /api/onboarding/setup-wizard
 *
 * Returns the canonical SetupWizardReport via the canonical API
 * envelope. Pure read-only over AxiomOSState + Risk Queue.
 */

import type { NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { buildSetupWizard } from "@/lib/onboarding/setupWizardBuilder";
import { apiOk, apiErr, resolveCorrelationId } from "@/lib/api";
import { AxiomErrors } from "@/lib/errors/axiomErrors";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const correlationId = resolveCorrelationId(req.headers);
  try {
    const ctx = await currentContext();
    if (!ctx.isAuthenticated || !ctx.organizationId) {
      throw AxiomErrors.validation("auth.required", "Sign in required.");
    }
    const report = await buildSetupWizard({
      tenantId: ctx.organizationId,
      actorUserId: ctx.userId,
    });
    return apiOk(report, {
      correlationId,
      safetyContract: "setup_review_only_no_execution",
    });
  } catch (err) {
    return apiErr(err, { correlationId, safetyContract: "setup_review_only_no_execution" });
  }
}

export async function POST(req: NextRequest) { return GET(req); }
