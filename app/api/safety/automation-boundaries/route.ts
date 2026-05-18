/**
 * GET /api/safety/automation-boundaries
 *
 * Returns the canonical Automation Boundary Report via the canonical
 * API envelope. Pure read-only — boundaries are platform-wide.
 */

import type { NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { buildAutomationBoundaryReport } from "@/lib/safety/automationBoundaryDetector";
import { apiOk, apiErr, resolveCorrelationId } from "@/lib/api";
import { AxiomErrors } from "@/lib/errors/axiomErrors";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const correlationId = resolveCorrelationId(req.headers);
  try {
    const ctx = await currentContext();
    if (!ctx.isAuthenticated) {
      throw AxiomErrors.validation("auth.required", "Sign in required.");
    }
    const report = await buildAutomationBoundaryReport();
    return apiOk(report, {
      correlationId,
      safetyContract: "boundaries_declared_no_action_taken",
    });
  } catch (err) {
    return apiErr(err, { correlationId, safetyContract: "boundaries_declared_no_action_taken" });
  }
}

export async function POST(req: NextRequest) { return GET(req); }
