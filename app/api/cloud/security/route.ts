/**
 * GET /api/cloud/security
 *
 * Returns the canonical MultiCloudSecurityReport — AWS GuardDuty +
 * Azure Defender for Cloud + GCP Security Command Center in one
 * envelope. Pure read-only. Per-cloud failures isolated.
 */

import type { NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { buildMultiCloudSecurity } from "@/lib/cloud/multiCloudSecurityBuilder";
import { apiOk, apiErr, asApiSourceMode, resolveCorrelationId } from "@/lib/api";
import { AxiomErrors } from "@/lib/errors/axiomErrors";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(req: NextRequest) {
  const correlationId = resolveCorrelationId(req.headers);
  try {
    const ctx = await currentContext();
    if (!ctx.isAuthenticated || !ctx.organizationId) {
      throw AxiomErrors.validation("auth.required", "Sign in required.");
    }
    const report = await buildMultiCloudSecurity({
      tenantId: ctx.organizationId,
      actorUserId: ctx.userId,
    });
    return apiOk(report, {
      correlationId,
      safetyContract: "multi_cloud_security_read_only",
      sourceMode: asApiSourceMode(report.overallSourceMode),
    });
  } catch (err) {
    return apiErr(err, { correlationId, safetyContract: "multi_cloud_security_read_only" });
  }
}

export async function POST(req: NextRequest) { return GET(req); }
