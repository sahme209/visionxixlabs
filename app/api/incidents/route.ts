/**
 * GET /api/incidents
 *
 * Returns the canonical Incident Response Report via the canonical
 * API envelope. Pure read-only.
 */

import type { NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { buildIncidentResponse } from "@/lib/incidents/incidentResponseBuilder";
import { apiOk, apiErr, asApiSourceMode, resolveCorrelationId } from "@/lib/api";
import { AxiomErrors } from "@/lib/errors/axiomErrors";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const correlationId = resolveCorrelationId(req.headers);
  try {
    const ctx = await currentContext();
    if (!ctx.isAuthenticated || !ctx.organizationId) {
      throw AxiomErrors.validation("auth.required", "Sign in required.");
    }
    const report = await buildIncidentResponse({
      tenantId: ctx.organizationId,
      actorUserId: ctx.userId,
    });
    return apiOk(report, {
      correlationId,
      safetyContract: "incident_response_read_only",
      sourceMode: asApiSourceMode(report.overallSourceMode),
    });
  } catch (err) {
    return apiErr(err, { correlationId, safetyContract: "incident_response_read_only" });
  }
}

export async function POST(req: NextRequest) { return GET(req); }
