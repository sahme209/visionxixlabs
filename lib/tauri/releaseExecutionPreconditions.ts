import { readReleaseBatchReadiness, type ReleaseBatchReadinessRepo } from "@/lib/integrations/airflow/releaseBatchReadiness";
import { sha256ContentHash } from "./contentHash";
import { parseDeploymentIntake } from "./deploymentIntakeSchema";
import { validateIntake } from "./deploymentOperations";
import { verifyIntakeWorkflowSource } from "./intakeWorkflowSource";
import type { ConsequentialOperationKind } from "./operationReliability";

type Result = { ready: true; requestVersion: number; digest: string }
  | { ready: false; reason: "unavailable" | "changed" | "waiting" };
/** Server preflight only. A digest binds facts; it never replaces current independent approval,
 * actor permissions, deployment-window checks, an atomic claim, or provider reconciliation.
 */
export async function verifyReleaseExecutionPreconditions(repo: ReleaseBatchReadinessRepo, input: {
  organizationId: string; requestId: string; expectedVersion: number; expectedDigest: string;
  kind: ConsequentialOperationKind; signal: AbortSignal;
}): Promise<Result> {
  const { organizationId, requestId, expectedVersion, expectedDigest, kind, signal } = input;
  try {
    if (!organizationId || !requestId || !Number.isSafeInteger(expectedVersion) || expectedVersion < 1
      || !/^[a-f0-9]{64}$/.test(expectedDigest) || !["dispatch_workflow", "merge_pull_request"].includes(kind) || signal.aborted) return { ready: false, reason: "unavailable" };
    const where = { organizationId, id: requestId };
    const row = await repo.tauriDeploymentRequest.findFirst({ where });
    if (!row || row.id !== requestId || row.organizationId !== organizationId || row.version !== expectedVersion || row.status !== "submitted") return { ready: false, reason: "changed" };
    const digest = sha256ContentHash({ requestVersion: expectedVersion, intake: row.intakeJson });
    if (digest !== expectedDigest) return { ready: false, reason: "changed" };
    const parsed = parseDeploymentIntake(row.intakeJson);
    if (!parsed.ok || parsed.intake.tenantId !== organizationId || parsed.intake.id !== requestId || validateIntake(parsed.intake).length
      || !parsed.intake.workflowSource) return { ready: false, reason: "unavailable" };
    if (parsed.intake.airflowDependency) {
      const batches = await readReleaseBatchReadiness(repo, { organizationId, requestId, expectedVersion, signal });
      if (!batches.ready) return { ready: false, reason: batches.reason };
      if (batches.requestVersion !== expectedVersion) return { ready: false, reason: "changed" };
    }
    if (signal.aborted || !await verifyIntakeWorkflowSource(organizationId, parsed.intake, signal)) return { ready: false, reason: "unavailable" };
    const selectedBatch = parsed.intake.airflowDependency;
    const [current, connection] = await Promise.all([
      repo.tauriDeploymentRequest.findFirst({ where }),
      selectedBatch ? repo.tenantIntegrationConnection.findFirst({ where: { id: selectedBatch.connectionId, organizationId, provider: "airflow", status: "active", updatedAt: new Date(selectedBatch.connectionUpdatedAt) }, select: { id: true } }) : Promise.resolve(null),
    ]);
    if (selectedBatch && !connection) return { ready: false, reason: "changed" };
    if (signal.aborted || !current || current.id !== requestId || current.organizationId !== organizationId || current.status !== "submitted"
      || current.version !== expectedVersion || sha256ContentHash({ requestVersion: current.version, intake: current.intakeJson }) !== digest) return { ready: false, reason: "changed" };
    return { ready: true, requestVersion: expectedVersion, digest };
  } catch { return { ready: false, reason: "unavailable" }; }
}
