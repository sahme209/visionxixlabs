/**
 * POST /api/autonomy/runbooks/queue/[id]/decide
 *
 * Records a human decision on a staged runbook. Body:
 *   { decision: "approve" | "reject" }
 *
 * NEVER triggers a mutation — pure audit. The IaC pipeline (or a
 * future apply lane) is what actually applies an approved runbook.
 */

import type { NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { canDecideApprovals } from "@/lib/auth/platformAdmin";
import { decideRunbook } from "@/lib/autonomy/runbookQueueStore";
import { apiOk, apiErr, asApiSourceMode, resolveCorrelationId } from "@/lib/api";
import { AxiomErrors } from "@/lib/errors/axiomErrors";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const correlationId = resolveCorrelationId(req.headers);
  try {
    const ctx = await currentContext();
    if (!ctx.isAuthenticated || !ctx.organizationId) {
      throw AxiomErrors.validation("auth.required", "Sign in required.");
    }
    if (!canDecideApprovals({ email: ctx.email, roles: ctx.roles })) {
      throw AxiomErrors.policy("authz.role_required", "Your role cannot decide runbooks.");
    }
    const { id } = await params;
    const body = (await req.json()) as { decision?: string } | null;
    if (body?.decision !== "approve" && body?.decision !== "reject") {
      throw AxiomErrors.validation("decision.required", "decision must be 'approve' or 'reject'.");
    }
    const row = await decideRunbook({
      organizationId: String(ctx.organizationId),
      rowId: id,
      decision: body.decision,
      decidedBy: ctx.userId ? String(ctx.userId) : undefined,
    });
    if (!row) {
      throw AxiomErrors.validation("runbook.not_found", "Staged runbook not found.");
    }
    return apiOk({ row }, {
      correlationId,
      safetyContract: "approval_only_no_execution",
      sourceMode: asApiSourceMode("live"),
    });
  } catch (err) {
    return apiErr(err, { correlationId, safetyContract: "approval_only_no_execution" });
  }
}
