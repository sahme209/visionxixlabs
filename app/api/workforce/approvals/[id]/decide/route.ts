/**
 * POST /api/workforce/approvals/[id]/decide
 *
 * Phase 369 — quorum-aware. Each call inserts a vote row; the snapshot
 * status is recomputed from the full set of vote rows via the pure
 * `computeQuorumStatus()` reducer. A second distinct approver is
 * required for two-step (requiredApprovers >= 2) snapshots before the
 * terminal "approved" transition. A single rejection short-circuits.
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
import { computeQuorumStatus } from "@/lib/workforce/approvalQuorum";

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
  const approverUserId = session.userId ?? session.email ?? "unknown";

  // Snapshot is the source of truth for engineer-sourced approvals.
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

  // If the engine still has the request in memory, verify it's
  // engineer-sourced. Post-restart the engine may not have the row;
  // we accept that and trust the durable snapshot.
  const engineRow = getApproval(id);
  if (engineRow && !engineRow.sourceId.startsWith("engineer:")) {
    return NextResponse.json({
      ok: false,
      reason: "not_engineer_sourced",
      detail: "This endpoint only handles engineer-sourced approvals. Use /dashboard/approvals for other types.",
    }, { status: 422 });
  }

  // Record this approver's vote. Unique (snapshotId, approverUserId)
  // prevents the same user from voting twice.
  try {
    await prisma.engineerApprovalDecision.create({
      data: {
        snapshotId: snapshot.id,
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

  // Recompute quorum from durable votes.
  const decisions = await prisma.engineerApprovalDecision.findMany({
    where: { snapshotId: snapshot.id },
    select: { approverUserId: true, decision: true },
  });
  const quorum = computeQuorumStatus({
    decisions: decisions.map((d) => ({
      approverUserId: d.approverUserId,
      decision: d.decision as "approved" | "rejected",
    })),
    requiredApprovers: snapshot.requiredApprovers,
  });

  // Terminal transition — only when quorum says so.
  const decidedAt = new Date();
  let engineAccepted = false;
  if (quorum.isTerminal) {
    try {
      await prisma.engineerApprovalSnapshot.update({
        where: { id: snapshot.id },
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
      correlationId: idFactory.correlation(snapshot.correlationId),
      source: "live",
      detail: {
        approvalId: id,
        vote: decision,
        approvedCount: quorum.approvedCount,
        rejectedCount: quorum.rejectedCount,
        requiredApprovers: snapshot.requiredApprovers,
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
        correlationId: idFactory.correlation(snapshot.correlationId),
        source: "live",
        detail: {
          approvalId: id,
          decision: quorum.status,
          engineerSourceId: `engineer:${snapshot.engineerId}:${snapshot.action}`,
          engineAccepted,
          approvedCount: quorum.approvedCount,
          rejectedCount: quorum.rejectedCount,
          requiredApprovers: snapshot.requiredApprovers,
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
    requiredApprovers: snapshot.requiredApprovers,
    isTerminal: quorum.isTerminal,
    decidedAt: quorum.isTerminal ? decidedAt.toISOString() : null,
    engineAccepted,
  });
}
