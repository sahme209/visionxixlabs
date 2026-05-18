/**
 * GET /api/integrations/health
 *
 * Returns the IntegrationHealthReport — one row per major source
 * Axiom reads from (AWS / Azure / GCP / GitHub / Desktop / Trust
 * evidence / Audit persistence / Memory persistence) with status +
 * sourceMode + missingConfig + safeNextAction.
 *
 * Tenant-scoped. Pure read-only composition over AxiomOSState. No
 * SDK calls. No secrets. Honest preview when sources aren't wired.
 */

import { NextResponse } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { buildIntegrationHealthReport } from "@/lib/integrations/integrationHealthChecker";
import { apiFailure, apiSuccess } from "@/lib/api/dtoMappers";
import { AxiomErrors, httpStatusFor, toAxiomError } from "@/lib/errors/axiomErrors";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  try {
    const ctx = await currentContext();
    if (!ctx.isAuthenticated || !ctx.organizationId) {
      throw AxiomErrors.validation("auth.required", "Sign in required.");
    }
    const report = await buildIntegrationHealthReport({
      tenantId: ctx.organizationId,
      actorUserId: ctx.userId,
    });
    return NextResponse.json(apiSuccess(report), { status: 200 });
  } catch (err) {
    const axiomErr = toAxiomError(err);
    return NextResponse.json(apiFailure(axiomErr), { status: httpStatusFor(axiomErr.category) });
  }
}

export async function POST(): Promise<NextResponse> { return GET(); }
