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
import { prisma } from "@/lib/db";
import { isSameOriginRequest } from "@/lib/auth/requestOrigin";
import { canDecideApprovals } from "@/lib/auth/platformAdmin";
import { currentContext } from "@/lib/auth/currentContext";
import { decideApproval, getApproval } from "@/lib/approvals/approvalEngine";
import { record as recordAudit } from "@/lib/audit/secureAudit";
import { id as idFactory } from "@/lib/domain/ids";
import type { DecideRejectReason } from "@/lib/workforce/decideApprovalPlanner";
import { persistApprovalVote, withBoundApprovalWrite } from "@/lib/workforce/persistApprovalVote";
import { resumePipelineStageFromApproval, type ApprovalTerminalStatus } from "@/lib/workforce/pipelines/resumeFromApproval";
import { advancePipelineRun } from "@/lib/workforce/pipelines/pipelineRunner";

export const dynamic = "force-dynamic";

const REJECT_STATUS_MAP: Record<DecideRejectReason | "already_voted" | "approval_actor_provenance_required" | "coding_review_required", number> = {
  already_voted: 409,
  approval_actor_provenance_required: 409,
  coding_review_required: 409,
  invalid_decision: 400,
  approval_not_found: 404,
  cross_tenant: 403,
  already_decided: 409,
  not_engineer_sourced: 422,
};

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!isSameOriginRequest(req)) return NextResponse.json({ ok: false, reason: "invalid_request_origin" }, { status: 403 });
  const { id } = await ctx.params;

  const session = await currentContext();
  if (!session.isAuthenticated || !session.organizationId || !session.userId) {
    return NextResponse.json({ ok: false, reason: "auth_required" }, { status: 401 });
  }

  if (!canDecideApprovals({ email: session.email, roles: session.roles })) return NextResponse.json({ ok: false, reason: "forbidden_role" }, { status: 403 });

  let body: { reviewDigest?: unknown; decision?: unknown; reason?: unknown } = {};
  try { body = await req.json() as typeof body; } catch { /* empty body */ }
  const rawDecision = body.decision;
  const reason = typeof body.reason === "string" ? body.reason : undefined;

  const orgId = String(session.organizationId);
  const approverUserId = session.userId;

  const engineRow = getApproval(id);
  let persisted: Awaited<ReturnType<typeof persistApprovalVote>>;
  try {
    persisted = await persistApprovalVote({ approvalRequestId: id, organizationId: orgId,
      principal: { kind: "user", id: approverUserId }, rawDecision, reason, reviewDigest: body.reviewDigest,
      engineSourceId: engineRow?.sourceId ?? null });
  } catch {
    return NextResponse.json({ ok: false, reason: "decision_persist_failed", detail: "Vote was not recorded — please retry." }, { status: 500 });
  }
  if (persisted.kind === "reject") return NextResponse.json({ ok: false, reason: persisted.reason,
    detail: persisted.detail }, { status: REJECT_STATUS_MAP[persisted.reason] });
  const { snapshot: snap, decision, quorum, decidedAt } = persisted;
  let engineAccepted = false;
  if (quorum.isTerminal) {
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

    // Pipeline-source resume — when this snapshot was minted from a
    // pipeline approval gate, propagate the terminal status to the
    // stage row and advance the pipeline run. Best-effort: if the
    // resume fails the snapshot is still terminal; operator can
    // re-trigger via the pipeline detail page.
    if (snap.sourceKind === "pipeline_stage" && snap.pipelineStageRunId) {
      const stageRunId = snap.pipelineStageRunId;
      try {
        const plan = resumePipelineStageFromApproval(quorum.status as ApprovalTerminalStatus);
        if (plan.stageStatus !== "no_change") {
          const stageUpdate = await withBoundApprovalWrite(tx => tx.pipelineStageRun.updateMany({
            where: { id: stageRunId, status: "awaiting_approval" },
            data: {
              status: plan.stageStatus,
              completedAt: new Date(),
              errorMessage: plan.errorMessage ?? null,
            },
          }));
          if (plan.shouldAdvanceRun && stageUpdate.count > 0) {
            const stageRow = await prisma.pipelineStageRun.findUnique({
              where: { id: stageRunId },
              select: { runId: true },
            });
            if (stageRow) await advancePipelineRun(stageRow.runId);
          }
        }
      } catch {
        // Best-effort. Pipeline run can be advanced manually.
      }
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
