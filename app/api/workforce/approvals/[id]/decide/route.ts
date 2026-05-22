/**
 * POST /api/workforce/approvals/[id]/decide
 *
 * Routes an operator decision (approve | reject) into the approval
 * engine, then writes an audit row tying the decision back to the
 * engineer-sourced attempt.
 *
 * Body: { decision: "approved" | "rejected", reason?: string }
 * Auth: requires an authenticated workspace member.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { decideApproval, getApproval } from "@/lib/approvals/approvalEngine";
import { record as recordAudit } from "@/lib/audit/secureAudit";
import { id as idFactory } from "@/lib/domain/ids";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  const session = await currentContext();
  if (!session.isAuthenticated || !session.organizationId) {
    return NextResponse.json({ ok: false, reason: "auth_required" }, { status: 401 });
  }

  let body: { decision?: unknown; reason?: unknown } = {};
  try { body = await req.json() as typeof body; } catch { /* empty body */ }
  const decision = body.decision;
  const reason = typeof body.reason === "string" ? body.reason : undefined;

  if (decision !== "approved" && decision !== "rejected") {
    return NextResponse.json({
      ok: false,
      reason: "invalid_decision",
      detail: 'decision must be "approved" or "rejected"',
    }, { status: 400 });
  }

  // Sanity-check the approval exists and belongs to this workspace.
  const existing = getApproval(id);
  if (!existing) {
    return NextResponse.json({ ok: false, reason: "approval_not_found" }, { status: 404 });
  }
  if (existing.tenantId && existing.tenantId !== String(session.organizationId)) {
    return NextResponse.json({ ok: false, reason: "cross_tenant_attempt" }, { status: 403 });
  }
  if (!existing.sourceId.startsWith("engineer:")) {
    return NextResponse.json({
      ok: false,
      reason: "not_engineer_sourced",
      detail: "This endpoint only handles engineer-sourced approvals. Use /dashboard/approvals for other types.",
    }, { status: 422 });
  }

  const outcome = decideApproval({
    approvalId: id,
    decision,
    approverUserId: session.userId,
    approverRole: "approver",
    reason,
  });

  if (!outcome.allowed) {
    return NextResponse.json({ ok: false, reason: "decision_rejected", detail: outcome.reason }, { status: 422 });
  }

  // Audit row tying the decision back to the engineer.
  try {
    await recordAudit({
      organizationId: idFactory.organization(String(session.organizationId)),
      actorUserId: session.userId ?? idFactory.user(session.email ?? "unknown"),
      actorKind: "user",
      action: decision === "approved" ? "approval.grant" : "approval.deny",
      outcome: "success",
      entityRef: `approval:${id}`,
      correlationId: idFactory.correlation(`decide_${Date.now().toString(36)}`),
      source: "live",
      detail: {
        approvalId: id,
        decision,
        engineerSourceId: existing.sourceId,
        ...(reason ? { reason } : {}),
      },
    });
  } catch {
    // Best-effort.
  }

  return NextResponse.json({
    ok: true,
    approvalId: id,
    decision,
    status: outcome.request?.status ?? "unknown",
    decidedAt: outcome.request?.decidedAt ?? null,
  });
}
