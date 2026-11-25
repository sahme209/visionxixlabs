import type { ReleaseBatchReadiness, ReleaseBatchDeclarations } from "@/lib/desktop/releaseBatchReadinessContract";
import type { AirflowClient } from "./airflowClient";
import { sha256ContentHash } from "@/lib/tauri/contentHash";
import { loadAirflowClient } from "./connection";
import { observeExactReleaseDependencies, observeExactReleaseRunStates } from "./dependencyReadiness";
import { releaseAirflowDependencySchema, type ReleaseAirflowDependency } from "./releaseDependencySchema";

interface ReleaseRow { id: string; organizationId: string; version: number; status: string; intakeJson: unknown }
export interface ReleaseBatchReadinessRepo {
  tauriDeploymentRequest: { findFirst(args: { where: { id: string; organizationId: string } }): Promise<ReleaseRow | null> };
  tenantIntegrationConnection: { findFirst(args: { where: { id: string; organizationId: string; provider: "airflow"; status: "active"; updatedAt: Date }; select: { id: true } }): Promise<{ id: string } | null> };
}
interface ExactReleaseRead {
  organizationId: string;
  requestId: string;
  expectedVersion: number;
  signal?: AbortSignal;
}

async function readExactRelease<T>(repo: ReleaseBatchReadinessRepo, input: ExactReleaseRead, read: (client: AirflowClient, selected: ReleaseAirflowDependency) => Promise<T>): Promise<
  { ok: true; data: T } | { ok: false; reason: "unavailable" | "changed"; closed?: true }
> {
  const signal = input.signal;
  try {
    if (signal?.aborted || !input.organizationId || !input.requestId || !Number.isSafeInteger(input.expectedVersion) || input.expectedVersion < 1) return { ok: false, reason: "unavailable" };
    const where = { id: input.requestId, organizationId: input.organizationId };
    const row = await repo.tauriDeploymentRequest.findFirst({ where });
    if (signal?.aborted || !row || row.id !== input.requestId || row.organizationId !== input.organizationId) {
      return { ok: false, reason: "unavailable" };
    }
    if (row.version !== input.expectedVersion) return { ok: false, reason: "changed" };
    if (row.status === "closed") return { ok: false, reason: "unavailable", closed: true };
    if (row.status !== "submitted") return { ok: false, reason: "unavailable" };
    const intake = row.intakeJson;
    if (!intake || typeof intake !== "object" || Array.isArray(intake)) return { ok: false, reason: "unavailable" };
    const parsed = releaseAirflowDependencySchema.safeParse((intake as Record<string, unknown>).airflowDependency);
    if (!parsed.success) return { ok: false, reason: "unavailable" };
    const selected = parsed.data, hash = sha256ContentHash(intake), status = row.status;
    const loaded = await loadAirflowClient(input.organizationId);
    if (signal?.aborted || loaded.connectionId !== selected.connectionId || loaded.connectionUpdatedAt.toISOString() !== selected.connectionUpdatedAt) return { ok: false, reason: "changed" };
    const data = await read(loaded.client, selected);
    if (signal?.aborted) return { ok: false, reason: "unavailable" };
    const [current, connection] = await Promise.all([
      repo.tauriDeploymentRequest.findFirst({ where }),
      repo.tenantIntegrationConnection.findFirst({ where: { id: selected.connectionId, organizationId: input.organizationId, provider: "airflow", status: "active", updatedAt: loaded.connectionUpdatedAt }, select: { id: true } }),
    ]);
    if (signal?.aborted || !current || current.id !== input.requestId || current.organizationId !== input.organizationId
      || current.version !== input.expectedVersion) return { ok: false, reason: "changed" };
    if (current.status === "closed") return { ok: false, reason: "changed", closed: true };
    if (!connection || current.status !== status || sha256ContentHash(current.intakeJson) !== hash) return { ok: false, reason: "changed" };
    return { ok: true, data };
  } catch { return { ok: false, reason: "unavailable" }; }
}

/** Read saved identities only. Connection metadata and provider state stay out of this projection. */
export async function readReleaseBatchDeclarations(repo: ReleaseBatchReadinessRepo, input: ExactReleaseRead): Promise<ReleaseBatchDeclarations | undefined> {
  if (input.signal?.aborted) return undefined;
  const { organizationId, requestId, expectedVersion } = input;
  const row = await repo.tauriDeploymentRequest.findFirst({where: {id: requestId, organizationId}});
  if (input.signal?.aborted || !row || row.id !== requestId || row.organizationId !== organizationId
    || row.version !== expectedVersion || row.status !== "submitted") return undefined;
  const parsed = releaseAirflowDependencySchema.safeParse((row.intakeJson as {airflowDependency?: unknown} | null)?.airflowDependency);
  if (!parsed.success) return undefined;
  return {requestId, version: expectedVersion, runs: parsed.data.runs.map(({dagId, dagRunId}) => ({dagId, dagRunId}))};
}

/** Read-only readiness snapshot. Never grants execution authority. */
export async function readReleaseBatchReadiness(repo: ReleaseBatchReadinessRepo, input: ExactReleaseRead & { includeRuns?: boolean; includeTiming?: boolean }): Promise<ReleaseBatchReadiness> {
  const result = await readExactRelease(repo, input, async (client, selected) => input.includeRuns
    ? observeExactReleaseRunStates(client, selected.runs, input.signal, input.includeTiming)
    : { outcome: await observeExactReleaseDependencies(client, selected.runs, input.signal), runs: undefined });
  if (!result.ok) {
    if (result.closed && input.includeRuns) {
      return { ready: false, reason: "changed", closedRelease: {requestId: input.requestId, version: input.expectedVersion} };
    }
    return { ready: false, reason: result.reason };
  }
  const observation = result.data;
  const aggregate = observation.outcome === "ready"
    ? { ready: true as const, requestVersion: input.expectedVersion }
    : { ready: false as const, reason: observation.outcome };
  return observation.runs ? { ...aggregate, observations: { requestId: input.requestId, version: input.expectedVersion, runs: observation.runs } } : aggregate;
}

export async function readReleaseBatchTasks(repo: ReleaseBatchReadinessRepo, input: ExactReleaseRead & { dagId: string; dagRunId: string; offset: number }) {
  const result = await readExactRelease(repo, input, async (client, selected) => {
    const run = selected.runs.find(({dagId, dagRunId}) => dagId === input.dagId && dagRunId === input.dagRunId);
    if (!run) return undefined;
    const before = (await observeExactReleaseRunStates(client, [run], input.signal, true)).runs?.[0];
    if (!before || input.signal?.aborted) return undefined;
    const page = await client.listTaskInstances(run.dagId, run.dagRunId, input.offset, input.signal);
    const after = (await observeExactReleaseRunStates(client, [run], input.signal, true)).runs?.[0];
    // A provider transition can leave this page describing a previous attempt of the same run.
    if (!after || after.state !== before.state ||
      after.timing?.startedAt !== before.timing?.startedAt ||
      after.timing?.endedAt !== before.timing?.endedAt) return undefined;
    return { requestId: input.requestId, version: input.expectedVersion, dagId: run.dagId, dagRunId: run.dagRunId, ...page };
  });
  return result.ok ? result.data : undefined;
}
