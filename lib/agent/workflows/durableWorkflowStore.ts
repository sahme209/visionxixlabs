import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";

export const DURABLE_WORKFLOW_STATUSES = [
  "queued",
  "running",
  "paused_for_approval",
  "paused_for_input",
  "retrying",
  "completed",
  "failed",
  "cancelled",
] as const;

export type DurableWorkflowStatus = (typeof DURABLE_WORKFLOW_STATUSES)[number];
export type DurableWorkflowActorKind = "user" | "agent" | "worker" | "system";

const CLAIMABLE_STATUSES: DurableWorkflowStatus[] = ["queued", "running", "retrying"];
const TERMINAL_STATUSES: DurableWorkflowStatus[] = ["completed", "failed", "cancelled"];

type JsonObject = Record<string, Prisma.InputJsonValue>;

interface CreateWorkflowInput {
  organizationId: string;
  workflowKind: string;
  objective: string;
  autonomyLevel: string;
  input: JsonObject;
  requestedByUserId: string;
  maxAttempts?: number;
}

interface ClaimWorkflowInput {
  organizationId: string;
  workflowRunId: string;
  expectedVersion: number;
  workerId: string;
  leaseDurationMs?: number;
  now?: Date;
}

interface CheckpointInput {
  organizationId: string;
  workflowRunId: string;
  expectedVersion: number;
  workerId: string;
  currentStep?: string | null;
  state: JsonObject;
  status: Exclude<DurableWorkflowStatus, "queued" | "running" | "cancelled">;
  approvalProposalId?: string;
  pauseReason?: string;
  failureCode?: string;
  nextAttemptAt?: Date;
  now?: Date;
}

export class DurableWorkflowConflictError extends Error {
  constructor(message = "The workflow changed before this operation could be committed.") {
    super(message);
    this.name = "DurableWorkflowConflictError";
  }
}

function positiveInteger(value: number | undefined, fallback: number, maximum: number): number {
  if (value === undefined) return fallback;
  if (!Number.isSafeInteger(value) || value < 1 || value > maximum) {
    throw new Error(`Expected an integer between 1 and ${maximum}.`);
  }
  return value;
}

function cleanRequired(value: string, field: string): string {
  const cleaned = value.trim();
  if (!cleaned) throw new Error(`${field} is required.`);
  return cleaned;
}

export async function createDurableWorkflow(input: CreateWorkflowInput) {
  const maxAttempts = positiveInteger(input.maxAttempts, 3, 20);
  return prisma.$transaction(async (tx) => {
    const run = await tx.durableAgentWorkflow.create({
      data: {
        organizationId: cleanRequired(input.organizationId, "organizationId"),
        workflowKind: cleanRequired(input.workflowKind, "workflowKind"),
        objective: cleanRequired(input.objective, "objective"),
        autonomyLevel: cleanRequired(input.autonomyLevel, "autonomyLevel"),
        inputJson: input.input,
        stateJson: {},
        requestedByUserId: cleanRequired(input.requestedByUserId, "requestedByUserId"),
        maxAttempts,
      },
    });
    await tx.durableAgentWorkflowEvent.create({
      data: {
        workflowRunId: run.id,
        organizationId: run.organizationId,
        sequence: 0,
        eventType: "workflow.created",
        actorKind: "user",
        actorId: run.requestedByUserId,
        detailJson: { workflowKind: run.workflowKind, autonomyLevel: run.autonomyLevel },
      },
    });
    return run;
  });
}

/**
 * Acquire a bounded worker lease. The version predicate is the replay and
 * concurrency boundary: only one worker can win for a particular checkpoint.
 */
export async function claimDurableWorkflow(input: ClaimWorkflowInput) {
  const now = input.now ?? new Date();
  const leaseDurationMs = positiveInteger(input.leaseDurationMs, 60_000, 15 * 60_000);
  const leaseExpiresAt = new Date(now.getTime() + leaseDurationMs);
  const workerId = cleanRequired(input.workerId, "workerId");

  return prisma.$transaction(async (tx) => {
    const candidate = await tx.durableAgentWorkflow.findFirst({
      where: {
        id: input.workflowRunId,
        organizationId: input.organizationId,
        version: input.expectedVersion,
      },
      select: { attemptCount: true, maxAttempts: true },
    });
    if (!candidate || candidate.attemptCount >= candidate.maxAttempts) return null;

    const claimed = await tx.durableAgentWorkflow.updateMany({
      where: {
        id: input.workflowRunId,
        organizationId: input.organizationId,
        version: input.expectedVersion,
        status: { in: CLAIMABLE_STATUSES },
        attemptCount: candidate.attemptCount,
        cancelRequestedAt: null,
        AND: [
          { OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }] },
          { OR: [{ leaseExpiresAt: null }, { leaseExpiresAt: { lte: now } }] },
        ],
      },
      data: {
        status: "running",
        leaseOwner: workerId,
        leaseExpiresAt,
        attemptCount: { increment: 1 },
        version: { increment: 1 },
      },
    });
    if (claimed.count !== 1) return null;

    const sequence = input.expectedVersion + 1;
    await tx.durableAgentWorkflowEvent.create({
      data: {
        workflowRunId: input.workflowRunId,
        organizationId: input.organizationId,
        sequence,
        eventType: "workflow.lease_acquired",
        actorKind: "worker",
        actorId: workerId,
        detailJson: { leaseExpiresAt: leaseExpiresAt.toISOString() },
      },
    });
    return tx.durableAgentWorkflow.findUniqueOrThrow({ where: { id: input.workflowRunId } });
  });
}

/** Persist a worker checkpoint and release its lease atomically. */
export async function checkpointDurableWorkflow(input: CheckpointInput) {
  const now = input.now ?? new Date();
  if (input.status === "paused_for_approval" && !input.approvalProposalId) {
    throw new Error("approvalProposalId is required when pausing for approval.");
  }
  if (input.status === "retrying" && !input.nextAttemptAt) {
    throw new Error("nextAttemptAt is required when scheduling a retry.");
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.durableAgentWorkflow.updateMany({
      where: {
        id: input.workflowRunId,
        organizationId: input.organizationId,
        status: "running",
        version: input.expectedVersion,
        leaseOwner: input.workerId,
        leaseExpiresAt: { gt: now },
        cancelRequestedAt: null,
      },
      data: {
        status: input.status,
        currentStep: input.currentStep,
        stateJson: input.state,
        approvalProposalId: input.approvalProposalId ?? null,
        pauseReason: input.pauseReason ?? null,
        failureCode: input.failureCode ?? null,
        nextAttemptAt: input.nextAttemptAt ?? null,
        leaseOwner: null,
        leaseExpiresAt: null,
        completedAt: input.status === "completed" || input.status === "failed" ? now : null,
        version: { increment: 1 },
      },
    });
    if (updated.count !== 1) throw new DurableWorkflowConflictError();

    const sequence = input.expectedVersion + 1;
    await tx.durableAgentWorkflowEvent.create({
      data: {
        workflowRunId: input.workflowRunId,
        organizationId: input.organizationId,
        sequence,
        eventType: `workflow.${input.status}`,
        actorKind: "worker",
        actorId: input.workerId,
        detailJson: {
          currentStep: input.currentStep ?? null,
          pauseReason: input.pauseReason ?? null,
          failureCode: input.failureCode ?? null,
        },
      },
    });
    return tx.durableAgentWorkflow.findUniqueOrThrow({ where: { id: input.workflowRunId } });
  });
}

/** Request cancellation without trusting a worker to stop cooperatively. */
export async function requestDurableWorkflowCancellation(input: {
  organizationId: string;
  workflowRunId: string;
  expectedVersion: number;
  actorUserId: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  return prisma.$transaction(async (tx) => {
    const updated = await tx.durableAgentWorkflow.updateMany({
      where: {
        id: input.workflowRunId,
        organizationId: input.organizationId,
        version: input.expectedVersion,
        status: { notIn: TERMINAL_STATUSES },
        cancelRequestedAt: null,
      },
      data: { cancelRequestedAt: now, version: { increment: 1 } },
    });
    if (updated.count !== 1) throw new DurableWorkflowConflictError();
    await tx.durableAgentWorkflowEvent.create({
      data: {
        workflowRunId: input.workflowRunId,
        organizationId: input.organizationId,
        sequence: input.expectedVersion + 1,
        eventType: "workflow.cancellation_requested",
        actorKind: "user",
        actorId: input.actorUserId,
        detailJson: {},
      },
    });
    return tx.durableAgentWorkflow.findUniqueOrThrow({ where: { id: input.workflowRunId } });
  });
}

export async function acknowledgeDurableWorkflowCancellation(input: {
  organizationId: string;
  workflowRunId: string;
  expectedVersion: number;
  actorKind: "worker" | "system";
  actorId?: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  return prisma.$transaction(async (tx) => {
    const updated = await tx.durableAgentWorkflow.updateMany({
      where: {
        id: input.workflowRunId,
        organizationId: input.organizationId,
        version: input.expectedVersion,
        status: { notIn: TERMINAL_STATUSES },
        cancelRequestedAt: { not: null },
      },
      data: {
        status: "cancelled",
        cancelledAt: now,
        completedAt: now,
        leaseOwner: null,
        leaseExpiresAt: null,
        version: { increment: 1 },
      },
    });
    if (updated.count !== 1) throw new DurableWorkflowConflictError();
    await tx.durableAgentWorkflowEvent.create({
      data: {
        workflowRunId: input.workflowRunId,
        organizationId: input.organizationId,
        sequence: input.expectedVersion + 1,
        eventType: "workflow.cancelled",
        actorKind: input.actorKind,
        actorId: input.actorId,
        detailJson: {},
      },
    });
    return tx.durableAgentWorkflow.findUniqueOrThrow({ where: { id: input.workflowRunId } });
  });
}

/**
 * Resume only from a still-valid, integrity-bound approval belonging to the
 * same tenant. Replaying the approval loses the workflow version/status CAS.
 */
export async function resumeDurableWorkflowFromApproval(input: {
  organizationId: string;
  workflowRunId: string;
  expectedVersion: number;
  approvalProposalId: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  return prisma.$transaction(async (tx) => {
    const approval = await tx.agentActionProposal.findFirst({
      where: {
        id: input.approvalProposalId,
        organizationId: input.organizationId,
        status: "approved",
        decidedAt: { not: null },
        actionDigest: { not: null },
        OR: [{ approvalExpiresAt: null }, { approvalExpiresAt: { gt: now } }],
      },
      select: { id: true, decidedByUserId: true, actionDigest: true },
    });
    if (!approval) throw new Error("A valid, unexpired approval is required.");

    const updated = await tx.durableAgentWorkflow.updateMany({
      where: {
        id: input.workflowRunId,
        organizationId: input.organizationId,
        version: input.expectedVersion,
        status: "paused_for_approval",
        approvalProposalId: approval.id,
        cancelRequestedAt: null,
      },
      data: {
        status: "queued",
        approvalProposalId: null,
        pauseReason: null,
        nextAttemptAt: now,
        version: { increment: 1 },
      },
    });
    if (updated.count !== 1) throw new DurableWorkflowConflictError();
    await tx.durableAgentWorkflowEvent.create({
      data: {
        workflowRunId: input.workflowRunId,
        organizationId: input.organizationId,
        sequence: input.expectedVersion + 1,
        eventType: "workflow.approval_resumed",
        actorKind: "user",
        actorId: approval.decidedByUserId,
        detailJson: { approvalProposalId: approval.id, actionDigest: approval.actionDigest! },
      },
    });
    return tx.durableAgentWorkflow.findUniqueOrThrow({ where: { id: input.workflowRunId } });
  });
}

/** Recover abandoned leases without ever running the underlying operation. */
export async function recoverExpiredDurableWorkflowLeases(options: { now?: Date; limit?: number } = {}) {
  const now = options.now ?? new Date();
  const limit = positiveInteger(options.limit, 50, 200);
  const expired = await prisma.durableAgentWorkflow.findMany({
    where: { status: "running", leaseExpiresAt: { lte: now } },
    orderBy: { leaseExpiresAt: "asc" },
    take: limit,
    select: { id: true, organizationId: true, version: true, attemptCount: true, maxAttempts: true },
  });

  let recovered = 0;
  for (const candidate of expired) {
    const exhausted = candidate.attemptCount >= candidate.maxAttempts;
    const changed = await prisma.$transaction(async (tx) => {
      const update = await tx.durableAgentWorkflow.updateMany({
        where: {
          id: candidate.id,
          organizationId: candidate.organizationId,
          version: candidate.version,
          status: "running",
          leaseExpiresAt: { lte: now },
        },
        data: {
          status: exhausted ? "failed" : "retrying",
          failureCode: exhausted ? "attempts_exhausted" : null,
          nextAttemptAt: exhausted ? null : now,
          completedAt: exhausted ? now : null,
          leaseOwner: null,
          leaseExpiresAt: null,
          version: { increment: 1 },
        },
      });
      if (update.count !== 1) return false;
      await tx.durableAgentWorkflowEvent.create({
        data: {
          workflowRunId: candidate.id,
          organizationId: candidate.organizationId,
          sequence: candidate.version + 1,
          eventType: exhausted ? "workflow.recovery_failed" : "workflow.recovery_scheduled",
          actorKind: "system",
          detailJson: { reason: "lease_expired", attemptCount: candidate.attemptCount },
        },
      });
      return true;
    });
    if (changed) recovered += 1;
  }
  return { inspected: expired.length, recovered };
}
