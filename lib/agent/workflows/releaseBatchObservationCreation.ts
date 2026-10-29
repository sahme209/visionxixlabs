import { prisma } from "@/lib/db";
import { sha256ContentHash } from "@/lib/tauri/contentHash";
import { decideReleaseBatchWait } from "@/lib/tauri/releaseBatchWaitPolicy";
import { releaseAirflowDependencySchema } from "@/lib/integrations/airflow/releaseDependencySchema";
import { releaseBatchObservationBindingSchema } from "./releaseBatchObservationCheckpoint";
import { RELEASE_BATCH_OBSERVATION_KIND } from "./releaseBatchObservationKind";

/** Internal server storage primitive; callers must authenticate current workspace
 * permission. Creates read-only observation work, never a release approval/action.
 */
export async function ensureReleaseBatchObservation(input: {
  organizationId: string; requestId: string; expectedVersion: number; expectedDigest: string;
  requestedByUserId: string; deadlineAt: number; now?: Date;
}) {
  const { organizationId, requestId, expectedVersion, expectedDigest, requestedByUserId, deadlineAt } = input;
  const startedAt = (input.now ?? new Date()).getTime();
  if ([organizationId, requestId, requestedByUserId].some(v => !v || v !== v.trim() || /[\0\r\n]/.test(v))
    || !Number.isSafeInteger(expectedVersion) || expectedVersion < 1 || !/^[a-f0-9]{64}$/.test(expectedDigest)
    || !Number.isSafeInteger(startedAt)) throw new Error("Invalid release observation request.");
  const id = "release_batch_" + sha256ContentHash({ organizationId, requestId, expectedVersion, expectedDigest });
  function validateExisting(row: { organizationId: string; workflowKind: string; inputJson: unknown }) {
    const bound = releaseBatchObservationBindingSchema.parse(row.inputJson);
    if (row.organizationId !== organizationId || row.workflowKind !== RELEASE_BATCH_OBSERVATION_KIND
      || bound.requestId !== requestId || bound.requestVersion !== expectedVersion || bound.intakeDigest !== expectedDigest) throw new Error("Observation identity conflict.");
    return row;
  }
  const transaction = () => prisma.$transaction(async tx => {
    const release = await tx.tauriDeploymentRequest.findFirst({ where: { id: requestId, organizationId } });
    if (!release || release.id !== requestId || release.organizationId !== organizationId || release.status !== "submitted"
      || release.version !== expectedVersion || sha256ContentHash({ requestVersion: release.version, intake: release.intakeJson }) !== expectedDigest) throw new Error("Release snapshot changed.");
    const intake = release.intakeJson;
    if (!intake || typeof intake !== "object" || Array.isArray(intake)
      || intake.id !== requestId || intake.tenantId !== organizationId
      || !releaseAirflowDependencySchema.safeParse(intake.airflowDependency).success) throw new Error("Exact batch selection required.");
    const existing = await tx.durableAgentWorkflow.findUnique({ where: { id } });
    if (existing) { validateExisting(existing); return existing; }
    decideReleaseBatchWait({ startedAt, deadlineAt, now: startedAt, observation: "waiting" });
    const binding = releaseBatchObservationBindingSchema.parse({ requestId, requestVersion: expectedVersion, intakeDigest: expectedDigest, startedAt, deadlineAt });
    const row = await tx.durableAgentWorkflow.upsert({ where: { id }, update: {}, create: {
      id, organizationId, workflowKind: RELEASE_BATCH_OBSERVATION_KIND,
      objective: "Observe selected release batches", autonomyLevel: "observe", currentStep: "observe_batches",
      requestedByUserId, nextAttemptAt: new Date(startedAt), inputJson: binding, stateJson: { observationCount: 0 }, attemptCount: 0, maxAttempts: 1,
    } });
    validateExisting(row);
    await tx.durableAgentWorkflowEvent.upsert({ where: { workflowRunId_sequence: { workflowRunId: id, sequence: 0 } }, update: {}, create: {
      workflowRunId: id, organizationId, sequence: 0, eventType: "release_batch.created", actorKind: "user",
      actorId: row.requestedByUserId, detailJson: { requestId, requestVersion: expectedVersion, intakeDigest: expectedDigest },
    } });
    return row;
  });
  // Prisma may implement an empty-update upsert as read/create. Retry the entire
  // deterministic transaction after a competing winner commits; never reset time.
  for (let retry = 0; ; retry += 1) {
    try { return await transaction(); }
    catch (error) {
      const code = error && typeof error === "object" && "code" in error ? error.code : null;
      if (retry >= 2 || (code !== "P2002" && code !== "P2034")) throw error;
    }
  }

}
