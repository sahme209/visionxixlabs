/**
 * POST /api/autonomy/runbooks/stage
 *
 * Stages a runbook for human approval. Body shape:
 *   { runbook: RemediationRunbook }
 *
 * Writes a row to the StagedRemediationRunbook Prisma table.
 * NEVER triggers a mutation — pure audit / queue.
 */

import type { NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { stageRunbook } from "@/lib/autonomy/runbookQueueStore";
import { apiOk, apiErr, asApiSourceMode, resolveCorrelationId } from "@/lib/api";
import { AxiomErrors } from "@/lib/errors/axiomErrors";
import type { RemediationRunbook } from "@/lib/autonomy/remediationRunbookGenerator";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const correlationId = resolveCorrelationId(req.headers);
  try {
    const ctx = await currentContext();
    if (!ctx.isAuthenticated || !ctx.organizationId) {
      throw AxiomErrors.validation("auth.required", "Sign in required.");
    }
    const body = (await req.json()) as { runbook?: RemediationRunbook } | null;
    if (!body?.runbook?.id || !body.runbook.eventName) {
      throw AxiomErrors.validation("runbook.required", "Body must include a runbook with id + eventName.");
    }
    const row = await stageRunbook({
      organizationId: String(ctx.organizationId),
      runbook: body.runbook,
      stagedBy: ctx.userId ? String(ctx.userId) : undefined,
    });
    return apiOk({ row }, {
      correlationId,
      safetyContract: "approval_only_no_execution",
      sourceMode: asApiSourceMode("live"),
    });
  } catch (err) {
    return apiErr(err, { correlationId, safetyContract: "approval_only_no_execution" });
  }
}
