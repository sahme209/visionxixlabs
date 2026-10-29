import { z } from "zod";
import { prisma } from "@/lib/db";
import { decideReleaseBatchWait } from "@/lib/tauri/releaseBatchWaitPolicy";
import { RELEASE_BATCH_OBSERVATION_KIND } from "./releaseBatchObservationKind";

export const releaseBatchObservationBindingSchema = z.object({
  requestId: z.string().trim().min(1).max(160),
  requestVersion: z.number().int().positive().safe(),
  intakeDigest: z.string().regex(/^[a-f0-9]{64}$/),
  startedAt: z.number().int().nonnegative().safe(),
  deadlineAt: z.number().int().positive().safe(),
}).strict();
const stateSchema = z.object({ observationCount: z.number().int().nonnegative().max(1_000_000), phase: z.literal("waiting").optional() }).strict();

/** Internal read-only worker checkpoint, not an authorization or provider action.
 * The worker must derive observation from a stored-release fenced read, never client input.
 */
export async function checkpointReleaseBatchObservation(input: {
  organizationId: string; workflowRunId: string; expectedVersion: number; workerId: string;
  observation: "waiting" | "ready" | "changed" | "unavailable"; now?: Date;
}) {
  const { organizationId, workflowRunId, expectedVersion, workerId, observation } = input;
  const now = new Date((input.now ?? new Date()).getTime());
  if ([organizationId, workflowRunId, workerId].some(v => !v || v !== v.trim() || /[\0\r\n]/.test(v))
    || !Number.isSafeInteger(expectedVersion) || expectedVersion < 0 || !Number.isFinite(now.getTime())) throw new Error("Invalid observation checkpoint.");
  return prisma.$transaction(async tx => {
    const where = { organizationId, id: workflowRunId, version: expectedVersion,
      workflowKind: RELEASE_BATCH_OBSERVATION_KIND, currentStep: "observe_batches", status: "running",
      leaseOwner: workerId, leaseExpiresAt: { gt: now }, cancelRequestedAt: null };
    const row = await tx.durableAgentWorkflow.findFirst({ where });
    if (!row) throw new Error("Observation lease changed.");
    const binding = releaseBatchObservationBindingSchema.parse(row.inputJson);
    const state = stateSchema.parse(row.stateJson);
    const decision = decideReleaseBatchWait({ ...binding, now: now.getTime(), observation });
    const waiting = decision.phase === "waiting", ready = decision.phase === "preflight_required";
    const changed = await tx.durableAgentWorkflow.updateMany({
      where: { ...where, inputJson: { equals: binding } },
      data: {
        status: waiting ? "retrying" : ready ? "paused_for_input" : "failed",
        currentStep: waiting ? "observe_batches" : decision.phase,
        stateJson: { observationCount: state.observationCount + 1, phase: decision.phase },
        nextAttemptAt: waiting ? new Date(decision.nextObservationAt) : null,
        pauseReason: ready ? "Fresh release preflight and separate authorization required." : null,
        failureCode: waiting || ready ? null : `batch_${decision.phase}`,
        completedAt: waiting || ready ? null : now,
        approvalProposalId: null, leaseOwner: null, leaseExpiresAt: null, version: { increment: 1 },
      },
    });
    if (changed.count !== 1) throw new Error("Observation lease changed.");
    await tx.durableAgentWorkflowEvent.create({ data: { workflowRunId, organizationId,
      sequence: expectedVersion + 1, eventType: `release_batch.${decision.phase}`,
      actorKind: "worker", actorId: workerId,
      detailJson: { observationCount: state.observationCount + 1, phase: decision.phase },
    } });
    return tx.durableAgentWorkflow.findUniqueOrThrow({ where: { id: workflowRunId } });
  });
}
