import { prisma } from "@/lib/db";
import { RELEASE_BATCH_OBSERVATION_KIND } from "./releaseBatchObservationKind";

/** Read-only observation lease only. No attempt-count increment, authority grant,
 * provider write or completion. A worker still needs stored binding validation,
 * a fenced checkpoint and a separate current execution preflight/approval.
 */
export async function claimReleaseBatchObservation(input: {
  organizationId: string; workflowRunId: string; expectedVersion: number;
  workerId: string; now?: Date;
}) {
  const { organizationId, workflowRunId, expectedVersion, workerId } = input;
  const now = new Date((input.now ?? new Date()).getTime());
  if ([organizationId, workflowRunId, workerId].some(value => !value || value !== value.trim() || /[\0\r\n]/.test(value))
    || !Number.isSafeInteger(expectedVersion) || expectedVersion < 0
    || !Number.isFinite(now.getTime())) throw new Error("Invalid observation lease identity.");
  const leaseExpiresAt = new Date(now.getTime() + 60_000);
  return prisma.$transaction(async tx => {
    const claim = await tx.durableAgentWorkflow.updateMany({
      where: {
        organizationId, id: workflowRunId, version: expectedVersion,
        workflowKind: RELEASE_BATCH_OBSERVATION_KIND, currentStep: "observe_batches",
        status: { in: ["queued", "running", "retrying"] }, cancelRequestedAt: null,
        AND: [
          { OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }] },
          { OR: [{ leaseExpiresAt: null }, { leaseExpiresAt: { lte: now } }] },
        ],
      },
      data: { status: "running", leaseOwner: workerId, leaseExpiresAt, version: { increment: 1 } },
    });
    if (claim.count !== 1) return null;
    await tx.durableAgentWorkflowEvent.create({ data: {
      workflowRunId, organizationId, sequence: expectedVersion + 1,
      eventType: "release_batch.observation_lease_acquired", actorKind: "worker", actorId: workerId,
      detailJson: { leaseExpiresAt: leaseExpiresAt.toISOString() },
    } });
    return tx.durableAgentWorkflow.findUniqueOrThrow({ where: { id: workflowRunId } });
  });
}
