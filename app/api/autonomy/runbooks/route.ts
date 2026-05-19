/**
 * GET /api/autonomy/runbooks
 *
 * Returns the RemediationRunbookReport — typed remediation proposals
 * derived from the live CloudTrail event tail. Read-only planning,
 * never executes anything.
 *
 * Query params:
 *   - lookbackMinutes (default 60, clamped to [5, 1440] by the
 *     underlying CloudTrail extractor)
 */

import type { NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { generateRemediationRunbooks } from "@/lib/autonomy/remediationRunbookGenerator";
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
    const report = await generateRemediationRunbooks({
      lookbackMinutes: Number.isFinite(lookbackMinutes) ? lookbackMinutes : undefined,
    });
    return apiOk(report, {
      correlationId,
      safetyContract: "approval_only_no_execution",
      sourceMode: asApiSourceMode(report.totalEventsInspected > 0 ? "live" : "preview"),
    });
  } catch (err) {
    return apiErr(err, { correlationId, safetyContract: "approval_only_no_execution" });
  }
}

export async function POST(req: NextRequest) { return GET(req); }
