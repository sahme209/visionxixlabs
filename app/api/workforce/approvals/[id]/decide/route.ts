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
import { prisma } from "@/lib/db";
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

  const orgId = String(session.organizationId);

  // Look up durable snapshot first — it survives deploys; the engine's
  // in-memory state may have cleared.
  const snapshot = await prisma.engineerApprovalSnapshot.findUnique({
    where: { approvalRequestId: id },
  }).catch(() => null);

  if (!snapshot) {
    return NextResponse.json({ ok: false, reason: "approval_not_found" }, { status: 404 });
  }
  if (snapshot.organizationId !== orgId) {
    return NextResponse.json({ ok: false, reason: "cross_tenant_attempt" }, { status: 403 });
  }
  if (snapshot.status !== "pending") {
    return NextResponse.json({
      ok: false,
      reason: "already_decided",
      detail: `Approval already ${snapshot.status} at ${snapshot.decidedAt?.toISOString() ?? "unknown time"}.`,
    }, { status: 409 });
  }

  // Try to route the decision into the live engine. The engine MAY no
  // longer have the request (post-restart). When that happens we
  // accept the decision against the snapshot only.
  const engineRow = getApproval(id);
  let engineAccepted = false;
  if (engineRow) {
    if (!engineRow.sourceId.startsWith("engineer:")) {
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
    engineAccepted = true;
  }

  // Update durable snapshot. This is the source of truth for the
  // workforce approvals queue going forward.
  const decidedAt = new Date();
  try {
    await prisma.engineerApprovalSnapshot.update({
      where: { approvalRequestId: id },
      data: {
        status: decision,
        decidedByUserId: session.userId ?? session.email ?? "unknown",
        decidedAt,
        decisionReason: reason,
      },
    });
  } catch {
    // Snapshot update failure — surface a 500 since persistence is
    // load-bearing here.
    return NextResponse.json({
      ok: false,
      reason: "snapshot_persist_failed",
      detail: "Approval decision recorded in engine but snapshot did not update.",
    }, { status: 500 });
  }

  // Audit row tying the decision back to the engineer.
  try {
    await recordAudit({
      organizationId: idFactory.organization(orgId),
      actorUserId: session.userId ?? idFactory.user(session.email ?? "unknown"),
      actorKind: "user",
      action: decision === "approved" ? "approval.grant" : "approval.deny",
      outcome: "success",
      entityRef: `approval:${id}`,
      correlationId: idFactory.correlation(snapshot.correlationId),
      source: "live",
      detail: {
        approvalId: id,
        decision,
        engineerSourceId: `engineer:${snapshot.engineerId}:${snapshot.action}`,
        engineAccepted,
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
    status: decision,
    decidedAt: decidedAt.toISOString(),
    engineAccepted,
  });
}
