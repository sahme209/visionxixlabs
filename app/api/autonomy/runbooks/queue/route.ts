/**
 * GET /api/autonomy/runbooks/queue
 *
 * Returns the staged-runbook queue for this tenant.
 */

import type { NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { readStagedQueue } from "@/lib/autonomy/runbookQueueStore";
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
    const raw = req.nextUrl.searchParams.get("limit");
    const limit = raw ? Number.parseInt(raw, 10) : undefined;
    const report = await readStagedQueue({
      organizationId: String(ctx.organizationId),
      limit: Number.isFinite(limit) ? limit : undefined,
    });
    return apiOk(report, {
      correlationId,
      safetyContract: "approval_only_no_execution",
      sourceMode: asApiSourceMode("live"),
    });
  } catch (err) {
    return apiErr(err, { correlationId, safetyContract: "approval_only_no_execution" });
  }
}

export async function POST(req: NextRequest) { return GET(req); }
