/**
 * Approval expiry sweeper — Phase 370.
 *
 * Runs from a Vercel cron job (every 15 minutes). Finds pending
 * engineer-sourced approvals older than the TTL and transitions them
 * to "expired". Emits an audit row per expired snapshot so the trail
 * shows *why* the snapshot is no longer actionable.
 *
 * Idempotent: re-running after a sweep yields zero rows (the status
 * filter already excludes expired ones).
 */

import "server-only";

import { prisma } from "@/lib/db";
import { record as recordAudit } from "@/lib/audit/secureAudit";
import { id as idFactory } from "@/lib/domain/ids";
import { isApprovalExpired, DEFAULT_APPROVAL_TTL_MS } from "./approvalExpiry";

export interface SweepResult {
  scanned: number;
  expired: number;
  ttlMs: number;
  expiredIds: string[];
}

export async function sweepExpiredApprovals(opts?: {
  now?: Date;
  ttlMs?: number;
}): Promise<SweepResult> {
  const now = opts?.now ?? new Date();
  const ttlMs = opts?.ttlMs ?? DEFAULT_APPROVAL_TTL_MS;
  const cutoff = new Date(now.getTime() - ttlMs);

  // Narrow query: pending + createdAt < cutoff. The pure helper still
  // gates the in-memory transition so the DB filter and the rule never
  // diverge.
  const candidates = await prisma.engineerApprovalSnapshot.findMany({
    where: {
      status: "pending",
      createdAt: { lt: cutoff },
    },
    select: {
      id: true,
      organizationId: true,
      approvalRequestId: true,
      engineerId: true,
      action: true,
      correlationId: true,
      createdAt: true,
      status: true,
    },
  });

  const expiredIds: string[] = [];
  for (const c of candidates) {
    if (!isApprovalExpired({ status: c.status, createdAt: c.createdAt }, now, ttlMs)) {
      continue;
    }

    try {
      await prisma.engineerApprovalSnapshot.update({
        where: { id: c.id },
        data: {
          status: "expired",
          decidedAt: now,
          decidedByUserId: "system:expiry_sweeper",
          decisionReason: `auto_expired_after_${Math.round(ttlMs / 60000)}_minutes`,
        },
      });
      expiredIds.push(c.approvalRequestId);

      // Best-effort audit row. A failed audit must not abort the sweep
      // — the durable status change is the load-bearing side effect.
      try {
        await recordAudit({
          organizationId: idFactory.organization(c.organizationId),
          actorKind: "system",
          action: "engineer.approval_expired",
          outcome: "success",
          entityRef: `approval:${c.approvalRequestId}`,
          correlationId: idFactory.correlation(c.correlationId),
          source: "live",
          detail: {
            approvalId: c.approvalRequestId,
            engineerSourceId: `engineer:${c.engineerId}:${c.action}`,
            ageMs: now.getTime() - c.createdAt.getTime(),
            ttlMs,
          },
        });
      } catch {
        // Best-effort.
      }
    } catch {
      // Skip this row; the next sweep will retry. Don't fail the batch.
    }
  }

  return {
    scanned: candidates.length,
    expired: expiredIds.length,
    ttlMs,
    expiredIds,
  };
}
