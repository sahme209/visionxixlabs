/**
 * POST /api/demo/cleanup
 *
 * Removes every row created by the demo populator (id prefix
 * "demo:") for the caller's tenant. Real data is untouched.
 */

import type { NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { cleanupDemoData } from "@/lib/demo/sampleDataPopulator";
import { apiOk, apiErr, asApiSourceMode, resolveCorrelationId } from "@/lib/api";
import { AxiomErrors } from "@/lib/errors/axiomErrors";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const correlationId = resolveCorrelationId(req.headers);
  try {
    const ctx = await currentContext();
    if (!ctx.isAuthenticated || !ctx.organizationId) {
      throw AxiomErrors.validation("auth.required", "Sign in required.");
    }
    const out = await cleanupDemoData({ organizationId: String(ctx.organizationId) });
    return apiOk(out, {
      correlationId,
      safetyContract: "setup_review_only_no_execution",
      sourceMode: asApiSourceMode("preview"),
    });
  } catch (err) {
    return apiErr(err, { correlationId, safetyContract: "setup_review_only_no_execution" });
  }
}

export async function GET(req: NextRequest) { return POST(req); }
