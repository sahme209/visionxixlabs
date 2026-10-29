import type { AirflowClient } from "./airflowClient";

export interface ExactReleaseBatch { dagId: string; dagRunId: string; logicalDate: string }
/** Exact-run evidence for a release. Never substitutes a newer/latest run or authorizes dispatch.
 * The caller must fence the tenant connection and release version around these reads.
 */
export async function exactReleaseDependenciesReady(client: Pick<AirflowClient, "getDagRun">, bindings: ExactReleaseBatch[], signal?: AbortSignal): Promise<boolean> {
  if (!Array.isArray(bindings) || bindings.length === 0 || bindings.length > 25) return false;
  const identities = new Set<string>();
  const selected: ExactReleaseBatch[] = [];
  for (const binding of bindings) {
    if (!binding || typeof binding.dagId !== "string" || typeof binding.dagRunId !== "string" || typeof binding.logicalDate !== "string"
      || !binding.dagId.trim() || !binding.dagRunId.trim() || binding.dagId.length > 250 || binding.dagRunId.length > 1000
      || /[\0\r\n]/.test(binding.dagId + binding.dagRunId)
      || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/.test(binding.logicalDate)
      || !Number.isFinite(Date.parse(binding.logicalDate))) return false;
    const key = JSON.stringify([binding.dagId, binding.dagRunId]);
    if (identities.has(key)) return false;
    identities.add(key);
    selected.push({ dagId: binding.dagId, dagRunId: binding.dagRunId, logicalDate: binding.logicalDate });
  }
  try {
    for (const binding of selected) {
      if (signal?.aborted) return false;
      const run = signal ? await client.getDagRun(binding.dagId, binding.dagRunId, signal) : await client.getDagRun(binding.dagId, binding.dagRunId);
      if (signal?.aborted || run.dagId !== binding.dagId || run.dagRunId !== binding.dagRunId || run.state !== "success"
        // Preserve the exact provider timestamp, including sub-millisecond precision.
        // A changed serialization fails closed and requires rebinding the observation.
        || run.logicalDate !== binding.logicalDate) return false;
    }
    return true;
  } catch { return false; }
}

/** Existing latest-run freshness policy, shared by proposal and dispatch. */
export async function latestDependenciesReady(client: Pick<AirflowClient, "listDagRuns">, dependencyDagIds: string[], sourceLogicalDate: string | null): Promise<boolean> {
  if (dependencyDagIds.length === 0) return true;
  const sourceTime = sourceLogicalDate ? Date.parse(sourceLogicalDate) : NaN;
  if (!Number.isFinite(sourceTime)) return false;
  for (const dagId of dependencyDagIds) {
    const [latest] = await client.listDagRuns(dagId, 1);
    const dependencyTime = latest?.logicalDate ? Date.parse(latest.logicalDate) : NaN;
    if (!latest || latest.dagId !== dagId || latest.state !== "success" || !Number.isFinite(dependencyTime) || dependencyTime < sourceTime) return false;
  }
  return true;
}
