/**
 * GET /api/cloud/cloudtrail
 *
 * Returns the CloudTrailExtraction — the last N minutes of CloudTrail
 * management-plane events with severity + category classification.
 *
 * Query params:
 *   - lookbackMinutes (default 60, clamped to [5, 1440])
 */

import type { NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { extractCloudTrailEvents } from "@/lib/cloud/aws/awsCloudTrailExtractor";
import { apiOk, apiErr, asApiSourceMode, resolveCorrelationId } from "@/lib/api";
import { AxiomErrors } from "@/lib/errors/axiomErrors";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(req: NextRequest) {
  const correlationId = resolveCorrelationId(req.headers);
  try {
    const ctx = await currentContext();
    if (!ctx.isAuthenticated) throw AxiomErrors.validation("auth.required", "Sign in required.");
    const raw = req.nextUrl.searchParams.get("lookbackMinutes");
    const lookbackMinutes = raw ? Number.parseInt(raw, 10) : undefined;
    const result = await extractCloudTrailEvents({ lookbackMinutes: Number.isFinite(lookbackMinutes) ? lookbackMinutes : undefined });
    return apiOk(result, {
      correlationId,
      safetyContract: "audit_read_only",
      sourceMode: asApiSourceMode(result.mode === "live" ? "live" : "preview"),
    });
  } catch (err) {
    return apiErr(err, { correlationId, safetyContract: "audit_read_only" });
  }
}

export async function POST(req: NextRequest) { return GET(req); }
