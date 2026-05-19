/**
 * GET /api/telemetry/new-relic
 *
 * Returns the NewRelicPullExtraction — active issues from the
 * configured New Relic account (NerdGraph aiIssues.issues query).
 */

import type { NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { extractNewRelicIssues } from "@/lib/telemetry/newRelicPullExtractor";
import { apiOk, apiErr, asApiSourceMode, resolveCorrelationId } from "@/lib/api";
import { AxiomErrors } from "@/lib/errors/axiomErrors";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const correlationId = resolveCorrelationId(req.headers);
  try {
    const ctx = await currentContext();
    if (!ctx.isAuthenticated) throw AxiomErrors.validation("auth.required", "Sign in required.");
    const result = await extractNewRelicIssues();
    return apiOk(result, {
      correlationId,
      safetyContract: "telemetry_ingest_read_only",
      sourceMode: asApiSourceMode(result.mode === "live" ? "live" : "preview"),
    });
  } catch (err) {
    return apiErr(err, { correlationId, safetyContract: "telemetry_ingest_read_only" });
  }
}

export async function POST(req: NextRequest) { return GET(req); }
