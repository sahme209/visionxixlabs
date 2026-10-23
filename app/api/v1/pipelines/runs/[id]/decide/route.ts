/**
 * POST /api/v1/pipelines/runs/[id]/decide — Phase 406-decide.
 *
 * Public, machine-to-machine pipeline-approval decision endpoint. The
 * SDK + desktop client posts here to vote on a pipeline run that is
 * currently paused at an `awaiting_approval` stage.
 *
 * Required scope: pipeline:trigger.
 *
 * Body:
 *   {
 *     decision:        "approved" | "rejected",
 *     reason?:         string,
 *     approverUserId?: string,   // legacy input accepted but ignored;
 *                                // actor is always `api_key:<keyId>`
 *   }
 *
 * Behavior:
 *   1. Look up the PipelineRun, scoped to auth.organizationId. Cross-
 *      tenant lookups collapse to 404 `run_not_found` (no enumeration).
 *   2. Find the run's current `awaiting_approval` stage with a non-null
 *      approvalRequestId. 409 `no_pending_approval` if none.
 *   3. Load the EngineerApprovalSnapshot for that approvalRequestId.
 *   4. Run the existing `planDecideApproval` pure planner with the
 *      api-key-derived approverUserId.
 *   5. Persist the EngineerApprovalDecision (DB-unique guards
 *      double-voting → already_voted 409).
 *   6. If the projected quorum is terminal, update the snapshot to
 *      approved/rejected, transition the stage via the existing
 *      `resumePipelineStageFromApproval` mapping, advance the pipeline
 *      run, and emit `approval.grant` / `approval.deny` audit.
 *   7. Always emit `engineer.approval_voted` audit.
 *
 * Why this exists (vs. /api/workforce/approvals/[id]/decide):
 *   The workforce route is session-cookie auth and the path param is
 *   the snapshot's approvalRequestId — an internal id the SDK doesn't
 *   know. The v1 route takes the public runId, derives the pending
 *   approval, and uses API-key auth so machine clients (CI, desktop)
 *   can decide gates without a browser session.
 *
 * Single-vote safety:
 *   Pipeline gates default to requiredApprovers=2. One authenticated key
 *   can occupy only one vote slot, regardless of client-supplied labels.
 *   Distinct keys are distinct machine principals, not proof of two humans.
 */

import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { authenticateApiKey } from "@/lib/security/authenticateApiKey";
import { record as recordAudit } from "@/lib/audit/secureAudit";
import { id as idFactory } from "@/lib/domain/ids";
import type { DecideRejectReason } from "@/lib/workforce/decideApprovalPlanner";
import { persistApprovalVote, withBoundApprovalWrite } from "@/lib/workforce/persistApprovalVote";
import {
  resumePipelineStageFromApproval,
  type ApprovalTerminalStatus,
} from "@/lib/workforce/pipelines/resumeFromApproval";
import { advancePipelineRun } from "@/lib/workforce/pipelines/pipelineRunner";
import { dispatchWebhookEvent } from "@/lib/webhooks/dispatchWebhookEvent";

export const dynamic = "force-dynamic";

const REJECT_STATUS_MAP: Record<DecideRejectReason | "already_voted" | "approval_actor_provenance_required", number> = {
  already_voted: 409,
  approval_actor_provenance_required: 409,
  invalid_decision: 400,
  approval_not_found: 404,
  cross_tenant: 403,
  already_decided: 409,
  not_engineer_sourced: 422,
};

function getSourceIp(req: NextRequest): string | null {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? req.headers.get("x-real-ip")
    ?? null;
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const correlationId = `v1_pipeline_decide_${Date.now().toString(36)}`;

  const auth = await authenticateApiKey({
    authorizationHeader: req.headers.get("authorization"),
    sourceIp: getSourceIp(req),
    requiredScope: "pipeline:trigger",
    correlationId,
    route: "POST /api/v1/pipelines/runs/[id]/decide",
  });
  if (!auth.ok) {
    const headers: Record<string, string> = {};
    if (typeof auth.retryAfterSeconds === "number") {
      headers["Retry-After"] = String(auth.retryAfterSeconds);
    }
    return NextResponse.json(
      {
        ok: false,
        error: auth.reason,
        ...(auth.requiredScope ? { requiredScope: auth.requiredScope } : {}),
        ...(typeof auth.retryAfterSeconds === "number" ? { retryAfterSeconds: auth.retryAfterSeconds } : {}),
      },
      { status: auth.httpStatus, headers },
    );
  }

  const { id: runId } = await context.params;

  let body: { decision?: unknown; reason?: unknown; approverUserId?: unknown } = {};
  try { body = (await req.json()) as typeof body; } catch { /* empty body */ }
  const rawDecision = body.decision;
  const reason = typeof body.reason === "string" ? body.reason : undefined;
  // A caller label is not an authenticated identity. Keep accepting the
  // legacy field for old SDKs, but never let one key mint new quorum actors.
  const approverUserId = `api_key:${auth.apiKeyId}`;

  // 1. Cross-tenant-safe run lookup.
  const run = await prisma.pipelineRun.findFirst({
    where: { id: runId, organizationId: auth.organizationId },
    select: { id: true, organizationId: true, pipelineId: true, status: true, correlationId: true },
  });
  if (!run) {
    return NextResponse.json({ ok: false, error: "run_not_found" }, { status: 404 });
  }

  // 2. Find the current awaiting-approval stage (single one per run by
  //    construction — planNextStage pauses one at a time).
  const stage = await prisma.pipelineStageRun.findFirst({
    where: {
      runId: run.id,
      status: "awaiting_approval",
      approvalRequestId: { not: null },
    },
    select: { id: true, approvalRequestId: true, stageId: true, ordering: true },
    orderBy: { ordering: "asc" },
  });
  if (!stage || !stage.approvalRequestId) {
    return NextResponse.json(
      { ok: false, error: "no_pending_approval", message: "Run has no awaiting_approval stage." },
      { status: 409 },
    );
  }

  let persisted: Awaited<ReturnType<typeof persistApprovalVote>>;
  try {
    persisted = await persistApprovalVote({ approvalRequestId: stage.approvalRequestId,
      organizationId: auth.organizationId, principal: { kind: "api_key", id: auth.apiKeyId },
      rawDecision, reason, engineSourceId: null });
  } catch {
    return NextResponse.json({ ok: false, error: "decision_persist_failed", message: "Vote was not recorded — please retry." }, { status: 500 });
  }
  if (persisted.kind === "reject") return NextResponse.json({ ok: false, error: persisted.reason,
    ...(persisted.detail ? { message: persisted.detail } : {}) }, { status: REJECT_STATUS_MAP[persisted.reason] });
  const { snapshot: snap, decision, quorum, decidedAt } = persisted;
  let stageTransitioned = false;
  if (quorum.isTerminal) {
    // Resume the pipeline run by mapping the terminal snapshot status
    // onto the stage row + advancing the runner. Best-effort: a failure
    // here leaves the snapshot terminal — operator can advance manually.
    try {
      const resumePlan = resumePipelineStageFromApproval(quorum.status as ApprovalTerminalStatus);
      if (resumePlan.stageStatus !== "no_change") {
        const stageUpdate = await withBoundApprovalWrite(tx => tx.pipelineStageRun.updateMany({
          where: { id: stage.id, status: "awaiting_approval" },
          data: {
            status: resumePlan.stageStatus,
            completedAt: new Date(),
            errorMessage: resumePlan.errorMessage ?? null,
          },
        }));
        stageTransitioned = stageUpdate.count > 0;
        if (resumePlan.shouldAdvanceRun && stageTransitioned) {
          await advancePipelineRun(run.id);
        }
      }
    } catch { /* best-effort */ }
  }

  // 7a. Always-on vote audit.
  try {
    await recordAudit({
      organizationId: idFactory.organization(auth.organizationId),
      actorUserId: idFactory.user(approverUserId),
      actorKind: "user",
      action: "engineer.approval_voted",
      outcome: "success",
      entityRef: `approval:${stage.approvalRequestId}`,
      correlationId: idFactory.correlation(run.correlationId),
      source: "live",
      detail: {
        approvalId: stage.approvalRequestId,
        runId: run.id,
        pipelineId: run.pipelineId,
        stageId: stage.stageId,
        vote: decision,
        approvedCount: quorum.approvedCount,
        rejectedCount: quorum.rejectedCount,
        requiredApprovers: snap.requiredApprovers,
        snapshotStatus: quorum.status,
        via: "api_v1",
        apiKeyId: auth.apiKeyId,
        ...(reason ? { reason } : {}),
      },
    });
  } catch { /* best-effort */ }

  // 7b. Outbound webhook — fires on every vote (terminal or partial)
  // so integrators see the quorum progression. Best-effort: a webhook
  // outage never blocks the API response.
  try {
    await dispatchWebhookEvent({
      organizationId: auth.organizationId,
      eventKind: "pipeline.stage_decision_recorded",
      data: {
        runId: run.id,
        pipelineId: run.pipelineId,
        approvalId: stage.approvalRequestId,
        stageId: stage.stageId,
        vote: decision,
        approverUserId,
        approvedCount: quorum.approvedCount,
        rejectedCount: quorum.rejectedCount,
        requiredApprovers: snap.requiredApprovers,
        isTerminal: quorum.isTerminal,
        snapshotStatus: quorum.status,
        stageTransitioned,
        decidedAt: quorum.isTerminal ? decidedAt.toISOString() : null,
      },
      correlationId: run.correlationId,
    });
  } catch { /* best-effort */ }

  // 7c. Terminal grant/deny audit only when quorum tipped over.
  if (quorum.isTerminal) {
    try {
      await recordAudit({
        organizationId: idFactory.organization(auth.organizationId),
        actorUserId: idFactory.user(approverUserId),
        actorKind: "user",
        action: quorum.status === "approved" ? "approval.grant" : "approval.deny",
        outcome: "success",
        entityRef: `approval:${stage.approvalRequestId}`,
        correlationId: idFactory.correlation(run.correlationId),
        source: "live",
        detail: {
          approvalId: stage.approvalRequestId,
          runId: run.id,
          pipelineId: run.pipelineId,
          stageId: stage.stageId,
          decision: quorum.status,
          approvedCount: quorum.approvedCount,
          rejectedCount: quorum.rejectedCount,
          requiredApprovers: snap.requiredApprovers,
          stageTransitioned,
          via: "api_v1",
          ...(reason ? { reason } : {}),
        },
      });
    } catch { /* best-effort */ }
  }

  return NextResponse.json({
    ok: true,
    runId: run.id,
    approvalId: stage.approvalRequestId,
    vote: decision,
    snapshotStatus: quorum.status,
    approvedCount: quorum.approvedCount,
    rejectedCount: quorum.rejectedCount,
    requiredApprovers: snap.requiredApprovers,
    isTerminal: quorum.isTerminal,
    decidedAt: quorum.isTerminal ? decidedAt.toISOString() : null,
    stageTransitioned,
  });
}
