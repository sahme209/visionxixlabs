import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import { RELEASE_BATCH_OBSERVATION_KIND } from "./releaseBatchObservationKind";
import { runReleaseBatchObservation } from "./releaseBatchObservationWorker";
import { releaseBatchObservationsEnabled } from "./releaseBatchObservationConfig";
/** Explicit server opt-in only. Three sequential read-only observations at most;
 * workers still acquire their own version CAS leases and current actor checks.
 * This never resumes preflight/approval phases or invokes release operations.
 */
export async function runReleaseBatchObservationTick() {
  if (!releaseBatchObservationsEnabled()) return { enabled: false, inspected: 0, observed: 0, errors: 0 };
  const due = await findDueReleaseBatchObservations(new Date());
  const selected = due.slice(0, 3); let observed = 0, errors = 0;
  const workerId = `batch-observer-${randomUUID()}`;
  for (const row of selected) {
    // A runtime switch-off cannot initiate another provider observation.
    if (!releaseBatchObservationsEnabled()) break;
    try { const result = await runReleaseBatchObservation({ organizationId: row.organizationId,
      workflowRunId: row.id, expectedVersion: row.version, workerId }); if (result.observed) observed += 1;
    } catch { errors += 1; }
  }
  return { enabled: true, inspected: selected.length, observed, errors };
}

/** All eligible states share last-progress ordering, including legacy null due times. */
export async function findDueReleaseBatchObservations(now: Date) {
  return prisma.durableAgentWorkflow.findMany({
    where: { workflowKind: RELEASE_BATCH_OBSERVATION_KIND, currentStep: "observe_batches",
      status: { in: ["queued", "retrying", "running"] }, cancelRequestedAt: null,
      AND: [ { OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }] },
        { OR: [{ leaseExpiresAt: null }, { leaseExpiresAt: { lte: now } }] } ],
    },
    orderBy: [{ updatedAt: "asc" }, { id: "asc" }],
    take: 3, select: { id: true, organizationId: true, version: true },
  });
}
