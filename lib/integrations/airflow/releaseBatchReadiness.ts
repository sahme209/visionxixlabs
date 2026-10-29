import { sha256ContentHash } from "@/lib/tauri/contentHash";
import { loadAirflowClient } from "./connection";
import { exactReleaseDependenciesReady } from "./dependencyReadiness";
import { releaseAirflowDependencySchema } from "./releaseDependencySchema";

interface ReleaseRow { id: string; organizationId: string; version: number; status: string; intakeJson: unknown }
export interface ReleaseBatchReadinessRepo {
  tauriDeploymentRequest: { findFirst(args: { where: { id: string; organizationId: string } }): Promise<ReleaseRow | null> };
  tenantIntegrationConnection: { findFirst(args: { where: { id: string; organizationId: string; provider: "airflow"; status: "active"; updatedAt: Date }; select: { id: true } }): Promise<{ id: string } | null> };
}
type Result = { ready: true; requestVersion: number } | { ready: false; reason: "unavailable" | "changed" | "waiting" };
/** Read-only readiness snapshot. Never consumes approval, schedules, merges or dispatches.
 * Execution must re-evaluate its own version, connection and independent approval fences.
 */
export async function readReleaseBatchReadiness(repo: ReleaseBatchReadinessRepo, input: { organizationId: string; requestId: string; expectedVersion: number; signal?: AbortSignal }): Promise<Result> {
  const signal = input.signal;
  try {
    if (signal?.aborted || !input.organizationId || !input.requestId || !Number.isSafeInteger(input.expectedVersion) || input.expectedVersion < 1) return { ready: false, reason: "unavailable" };
    const where = { id: input.requestId, organizationId: input.organizationId };
    const row = await repo.tauriDeploymentRequest.findFirst({ where });
    if (signal?.aborted || !row || row.id !== input.requestId || row.organizationId !== input.organizationId || row.version !== input.expectedVersion
      || row.status !== "submitted") return { ready: false, reason: "unavailable" };
    const intake = row.intakeJson;
    if (!intake || typeof intake !== "object" || Array.isArray(intake)) return { ready: false, reason: "unavailable" };
    const parsed = releaseAirflowDependencySchema.safeParse((intake as Record<string, unknown>).airflowDependency);
    if (!parsed.success) return { ready: false, reason: "unavailable" };
    const selected = parsed.data, hash = sha256ContentHash(intake), status = row.status;
    const loaded = await loadAirflowClient(input.organizationId);
    if (signal?.aborted || loaded.connectionId !== selected.connectionId || loaded.connectionUpdatedAt.toISOString() !== selected.connectionUpdatedAt) return { ready: false, reason: "changed" };
    if (!await exactReleaseDependenciesReady(loaded.client, selected.runs, signal)) return { ready: false, reason: "waiting" };
    const [current, connection] = await Promise.all([
      repo.tauriDeploymentRequest.findFirst({ where }),
      repo.tenantIntegrationConnection.findFirst({ where: { id: selected.connectionId, organizationId: input.organizationId, provider: "airflow", status: "active", updatedAt: loaded.connectionUpdatedAt }, select: { id: true } }),
    ]);
    if (signal?.aborted || !connection || !current || current.id !== input.requestId || current.organizationId !== input.organizationId
      || current.version !== input.expectedVersion || current.status !== status || sha256ContentHash(current.intakeJson) !== hash) return { ready: false, reason: "changed" };
    return { ready: true, requestVersion: input.expectedVersion };
  } catch { return { ready: false, reason: "unavailable" }; }
}
