/**
 * POST /api/workforce/approvals/[id]/decide
 *
 * Quorum-aware. Phase 373 refactor: the integrity rules (guard order
 * + quorum projection) live in `planDecideApproval()` so they can be
 * exhaustively unit-tested. The route is now a thin Prisma adapter.
 *
 * Body: { decision: "approved" | "rejected", reason?: string }
 * Auth: requires an authenticated workspace member.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { currentContext } from "@/lib/auth/currentContext";
import { decideApproval, getApproval } from "@/lib/approvals/approvalEngine";
import { record as recordAudit } from "@/lib/audit/secureAudit";
import { id as idFactory } from "@/lib/domain/ids";
import { planDecideApproval, type DecideRejectReason } from "@/lib/workforce/decideApprovalPlanner";

export const dynamic = "force-dynamic";

const REJECT_STATUS_MAP: Record<DecideRejectReason, number> = {
  invalid_decision: 400,
  approval_not_found: 404,
  cross_tenant: 403,
  already_decided: 409,
  not_engineer_sourced: 422,
};

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  const session = await currentContext();
  if (!session.isAuthenticated || !session.organizationId) {
    return NextResponse.json({ ok: false, reason: "auth_required" }, { status: 401 });
  }

  let body: { decision?: unknown; reason?: unknown } = {};
  try { body = await req.json() as typeof body; } catch { /* empty body */ }
  const rawDecision = body.decision;
  const reason = typeof body.reason === "string" ? body.reason : undefined;

  const orgId = String(session.organizationId);
  const approverUserId = session.userId ?? session.email ?? "unknown";

  // Load durable snapshot, existing votes, and engine row (if any).
  const snapshot = await prisma.engineerApprovalSnapshot.findUnique({
    where: { approvalRequestId: id },
    include: {
      decisions: { select: { approverUserId: true, decision: true } },
    },
  }).catch(() => null);

  const engineRow = getApproval(id);

  // Pure planner — all guards + projected quorum in one call.
  const plan = planDecideApproval({
    rawDecision,
    viewerOrganizationId: orgId,
    snapshot: snapshot
      ? {
          organizationId: snapshot.organizationId,
          status: snapshot.status,
          requiredApprovers: snapshot.requiredApprovers,
        }
      : null,
    engineSourceId: engineRow?.sourceId ?? null,
    existingDecisions: snapshot
      ? snapshot.decisions.map((d) => ({
          approverUserId: d.approverUserId,
          decision: d.decision as "approved" | "rejected",
        }))
      : [],
    newApproverUserId: approverUserId,
  });

  if (plan.kind === "reject") {
    return NextResponse.json(
      { ok: false, reason: plan.reason, detail: plan.detail },
      { status: REJECT_STATUS_MAP[plan.reason] },
    );
  }

  // Planner says accept. Now do the durable side effects.
  // Snapshot is guaranteed non-null here (planner would have rejected otherwise).
  const snap = snapshot!;
  const decision = plan.decision;
  const quorum = plan.quorum;

  // Insert the durable vote row. The DB unique constraint is the
  // authoritative double-vote lock — surfaces as already_voted.
  try {
    await prisma.engineerApprovalDecision.create({
      data: {
        snapshotId: snap.id,
        organizationId: orgId,
        approverUserId,
        decision,
        reason,
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json({
        ok: false,
        reason: "already_voted",
        detail: "You have already voted on this approval.",
      }, { status: 409 });
    }
    return NextResponse.json({
      ok: false,
      reason: "decision_persist_failed",
      detail: "Vote was not recorded — please retry.",
    }, { status: 500 });
  }

  // Terminal transition — only when quorum says so.
  const decidedAt = new Date();
  let engineAccepted = false;
  if (quorum.isTerminal) {
    try {
      await prisma.engineerApprovalSnapshot.update({
        where: { id: snap.id },
        data: {
          status: quorum.status,
          decidedAt,
          decidedByUserId: approverUserId,
          decisionReason: reason,
        },
      });
    } catch {
      return NextResponse.json({
        ok: false,
        reason: "snapshot_persist_failed",
        detail: "Vote recorded but snapshot terminal update failed.",
      }, { status: 500 });
    }

    // Sync the engine when present. Best-effort — snapshot is authoritative.
    if (engineRow) {
      const outcome = decideApproval({
        approvalId: id,
        decision: quorum.status === "approved" ? "approved" : "rejected",
        approverUserId: session.userId,
        approverRole: "approver",
        reason,
      });
      engineAccepted = outcome.allowed;
    }
  }

  // Audit: always record the vote.
  try {
    await recordAudit({
      organizationId: idFactory.organization(orgId),
      actorUserId: session.userId ?? idFactory.user(session.email ?? "unknown"),
      actorKind: "user",
      action: "engineer.approval_voted",
      outcome: "success",
      entityRef: `approval:${id}`,
      correlationId: idFactory.correlation(snap.correlationId),
      source: "live",
      detail: {
        approvalId: id,
        vote: decision,
        approvedCount: quorum.approvedCount,
        rejectedCount: quorum.rejectedCount,
        requiredApprovers: snap.requiredApprovers,
        snapshotStatus: quorum.status,
        ...(reason ? { reason } : {}),
      },
    });
  } catch {
    // Best-effort.
  }

  // Audit: terminal grant/deny when quorum tipped over.
  if (quorum.isTerminal) {
    try {
      await recordAudit({
        organizationId: idFactory.organization(orgId),
        actorUserId: session.userId ?? idFactory.user(session.email ?? "unknown"),
        actorKind: "user",
        action: quorum.status === "approved" ? "approval.grant" : "approval.deny",
        outcome: "success",
        entityRef: `approval:${id}`,
        correlationId: idFactory.correlation(snap.correlationId),
        source: "live",
        detail: {
          approvalId: id,
          decision: quorum.status,
          engineerSourceId: `engineer:${snap.engineerId}:${snap.action}`,
          engineAccepted,
          approvedCount: quorum.approvedCount,
          rejectedCount: quorum.rejectedCount,
          requiredApprovers: snap.requiredApprovers,
          ...(reason ? { reason } : {}),
        },
      });
    } catch {
      // Best-effort.
    }
  }

  return NextResponse.json({
    ok: true,
    approvalId: id,
    vote: decision,
    snapshotStatus: quorum.status,
    approvedCount: quorum.approvedCount,
    rejectedCount: quorum.rejectedCount,
    requiredApprovers: snap.requiredApprovers,
    isTerminal: quorum.isTerminal,
    decidedAt: quorum.isTerminal ? decidedAt.toISOString() : null,
    engineAccepted,
  });
}
