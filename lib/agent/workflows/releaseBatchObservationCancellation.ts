import { prisma } from "@/lib/db";
import { RELEASE_BATCH_OBSERVATION_KIND } from "./releaseBatchObservationKind";
import { releaseBatchObservationBindingSchema } from "./releaseBatchObservationCheckpoint";
/** Current authorized creator only. Immediately invalidates the read-only lease;
 * any in-flight read may finish but cannot commit a checkpoint or execute work.
 */
export async function cancelReleaseBatchObservation(input: {
  organizationId: string; requestId: string; workflowRunId: string; expectedVersion: number; actorUserId: string; now?: Date;
}) {
  const { organizationId, requestId, workflowRunId, expectedVersion, actorUserId } = input;
  const now = new Date((input.now ?? new Date()).getTime());
  if ([organizationId, requestId, workflowRunId, actorUserId].some(v => !v || v !== v.trim() || /[\0\r\n]/.test(v))
    || !Number.isSafeInteger(expectedVersion) || expectedVersion < 0 || !Number.isFinite(now.getTime())) throw new Error("Invalid cancellation identity.");
  return prisma.$transaction(async tx => {
    const where = { organizationId, id: workflowRunId, requestedByUserId: actorUserId, workflowKind: RELEASE_BATCH_OBSERVATION_KIND, version: expectedVersion };
    const row = await tx.durableAgentWorkflow.findFirst({ where });
    if (!row || row.id !== workflowRunId || row.organizationId !== organizationId || row.requestedByUserId !== actorUserId
      || row.workflowKind !== RELEASE_BATCH_OBSERVATION_KIND || row.version !== expectedVersion) throw new Error("Batch wait changed.");
    const binding = releaseBatchObservationBindingSchema.parse(row.inputJson);
    if (binding.requestId !== requestId) throw new Error("Batch wait changed.");
    if (["cancelled", "completed", "failed"].includes(row.status)) return row;
    const result = await tx.durableAgentWorkflow.updateMany({
      where: { ...where, status: { in: ["queued", "running", "retrying", "paused_for_input"] }, inputJson: { equals: binding } },
      data: { status: "cancelled", currentStep: "cancelled", cancelRequestedAt: now, cancelledAt: now, completedAt: now,
        leaseOwner: null, leaseExpiresAt: null, nextAttemptAt: null, pauseReason: null, failureCode: null,
        approvalProposalId: null, version: { increment: 1 } },
    });
    if (result.count !== 1) throw new Error("Batch wait changed.");
    await tx.durableAgentWorkflowEvent.create({ data: { workflowRunId, organizationId, sequence: expectedVersion + 1,
      eventType: "release_batch.cancelled", actorKind: "user", actorId: actorUserId, detailJson: { requestId } } });
    return tx.durableAgentWorkflow.findUniqueOrThrow({ where: { id: workflowRunId } });
  });
}
