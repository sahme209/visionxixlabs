/**
 * GET /api/notifications/weekly-digest
 *
 * On-demand preview of the weekly digest for the caller's tenant.
 * Doesn't send — just returns the typed digest so the operator can
 * inspect what the cron would post.
 */

import type { NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { buildWeeklyDigest } from "@/lib/notifications/weeklyDigestBuilder";
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
    const digest = await buildWeeklyDigest(String(ctx.organizationId));
    return apiOk(digest, {
      correlationId,
      safetyContract: "notification_read_only",
      sourceMode: asApiSourceMode("live"),
    });
  } catch (err) {
    return apiErr(err, { correlationId, safetyContract: "notification_read_only" });
  }
}

export async function POST(req: NextRequest) { return GET(req); }
