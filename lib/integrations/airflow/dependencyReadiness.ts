import type { AirflowClient } from "./airflowClient";

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
