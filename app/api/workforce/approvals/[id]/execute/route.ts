/**
 * POST /api/workforce/approvals/[id]/execute
 *
 * Runs the engineer's executor for an approved snapshot. Uses an
 * atomic compare-and-swap on executionStatus to defend against
 * concurrent /execute calls minting two execution runs.
 *
 * Phase 376 flow:
 *   1. Auth + cross-tenant guards.
 *   2. Pure planExecution() checks snapshot status + execution status
 *      + executor availability.
 *   3. CAS executionStatus from "not_started" → "running". A second
 *      caller racing this update gets P2025 (record not found) and
 *      receives 409 "execution_in_flight".
 *   4. Run the registered executor (dry-run by default).
 *   5. CAS-update to "executed" or "failed" with the result fields.
 *   6. Audit row: engineer.action_executed or .action_execution_failed.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { currentContext } from "@/lib/auth/currentContext";
import { record as recordAudit } from "@/lib/audit/secureAudit";
import { id as idFactory } from "@/lib/domain/ids";
import { planExecution, type ExecutionRejectReason } from "@/lib/workforce/planExecution";
import {
  bootstrapExecutorRegistry,
  getExecutor,
  hasExecutor,
} from "@/lib/workforce/executors/executorRegistry";

export const dynamic = "force-dynamic";

const REJECT_STATUS_MAP: Record<ExecutionRejectReason, number> = {
  not_approved: 422,
  already_executed: 409,
  previously_failed: 409,
  execution_in_flight: 409,
  no_executor_registered: 422,
};

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  const session = await currentContext();
  if (!session.isAuthenticated || !session.organizationId) {
    return NextResponse.json({ ok: false, reason: "auth_required" }, { status: 401 });
  }
  const orgId = String(session.organizationId);
  const executedByUserId = session.userId ?? session.email ?? "unknown";

  bootstrapExecutorRegistry();

  const snapshot = await prisma.engineerApprovalSnapshot.findUnique({
    where: { approvalRequestId: id },
  }).catch(() => null);

  if (!snapshot) {
    return NextResponse.json({ ok: false, reason: "approval_not_found" }, { status: 404 });
  }
  if (snapshot.organizationId !== orgId) {
    return NextResponse.json({ ok: false, reason: "cross_tenant_attempt" }, { status: 403 });
  }

  const plan = planExecution({
    snapshotStatus: snapshot.status,
    executionStatus: snapshot.executionStatus,
    hasExecutor: hasExecutor(snapshot.engineerId),
  });
  if (plan.kind === "reject") {
    return NextResponse.json(
      { ok: false, reason: plan.reason, detail: plan.detail },
      { status: REJECT_STATUS_MAP[plan.reason] },
    );
  }

  // Atomic compare-and-swap: claim the execution by updating only
  // when executionStatus is still "not_started". A second caller racing
  // this update will see count === 0 and get 409 "execution_in_flight".
  let claimedCount = 0;
  try {
    const claim = await prisma.engineerApprovalSnapshot.updateMany({
      where: { id: snapshot.id, executionStatus: "not_started" },
      data: { executionStatus: "running" },
    });
    claimedCount = claim.count;
  } catch {
    return NextResponse.json({
      ok: false,
      reason: "execution_claim_failed",
      detail: "Could not claim execution lock.",
    }, { status: 500 });
  }
  if (claimedCount === 0) {
    return NextResponse.json({
      ok: false,
      reason: "execution_in_flight",
      detail: "Another caller claimed this execution.",
    }, { status: 409 });
  }

  const executor = getExecutor(snapshot.engineerId);
  // Re-check just in case; planExecution already validated above but the
  // registry could theoretically have changed between the planner read
  // and the claim. Cheap defensive guard.
  if (!executor) {
    await prisma.engineerApprovalSnapshot.update({
      where: { id: snapshot.id },
      data: {
        executionStatus: "failed",
        executionError: "Executor for engineer was unregistered between planner and run.",
      },
    }).catch(() => {});
    return NextResponse.json({
      ok: false,
      reason: "no_executor_registered",
    }, { status: 500 });
  }

  let result: Awaited<ReturnType<typeof executor>>;
  try {
    result = await executor({
      organizationId: orgId,
      approvalRequestId: snapshot.approvalRequestId,
      engineerId: snapshot.engineerId,
      action: snapshot.action,
      attemptId: snapshot.attemptId,
      correlationId: snapshot.correlationId,
      executedByUserId,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown executor error";
    result = { ok: false, error: message };
  }

  const executedAt = new Date();
  const detailJson = (result.detail ?? {}) as Prisma.InputJsonValue;

  if (result.ok) {
    await prisma.engineerApprovalSnapshot.update({
      where: { id: snapshot.id },
      data: {
        executionStatus: "executed",
        executedAt,
        executedByUserId,
        executionResultSummary: result.summary,
        executionResultDetail: detailJson,
        executionError: null,
      },
    });

    try {
      await recordAudit({
        organizationId: idFactory.organization(orgId),
        actorUserId: session.userId ?? idFactory.user(session.email ?? "unknown"),
        actorKind: "user",
        action: "engineer.action_executed",
        outcome: "success",
        entityRef: `approval:${id}`,
        correlationId: idFactory.correlation(snapshot.correlationId),
        source: "live",
        detail: {
          approvalId: id,
          engineerId: snapshot.engineerId,
          actionLabel: snapshot.action,
          summary: result.summary,
          isDryRun: Boolean(result.detail?.dryRun),
        },
      });
    } catch { /* best-effort */ }

    return NextResponse.json({
      ok: true,
      approvalId: id,
      executionStatus: "executed",
      executedAt: executedAt.toISOString(),
      summary: result.summary,
      detail: result.detail ?? {},
    });
  }

  // Failure path.
  await prisma.engineerApprovalSnapshot.update({
    where: { id: snapshot.id },
    data: {
      executionStatus: "failed",
      executedAt,
      executedByUserId,
      executionResultSummary: null,
      executionResultDetail: detailJson,
      executionError: result.error,
    },
  });

  try {
    await recordAudit({
      organizationId: idFactory.organization(orgId),
      actorUserId: session.userId ?? idFactory.user(session.email ?? "unknown"),
      actorKind: "user",
      action: "engineer.action_execution_failed",
      outcome: "failure",
      entityRef: `approval:${id}`,
      correlationId: idFactory.correlation(snapshot.correlationId),
      source: "live",
      detail: {
        approvalId: id,
        engineerId: snapshot.engineerId,
        actionLabel: snapshot.action,
        error: result.error,
      },
    });
  } catch { /* best-effort */ }

  return NextResponse.json({
    ok: false,
    reason: "execution_failed",
    approvalId: id,
    executionStatus: "failed",
    executedAt: executedAt.toISOString(),
    error: result.error,
  }, { status: 500 });
}
