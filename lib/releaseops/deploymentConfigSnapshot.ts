/**
 * Records which configuration an environment resolved to when a deployment
 * was dispatched. Best-effort evidence: a failure leaves the fields null
 * ("not recorded") and never blocks or changes the deployment.
 */
import { MAX_VARIABLES_PER_WORKSPACE, resolvedDigest, type StoredVariable } from "./scopedVariables";
import { MAX_VARIABLE_SETS, resolveWithSets, type VariableSetDef } from "./variableSets";

export interface ConfigSnapshotRepo {
  configVariable: { findMany(args: { where: { organizationId: string }; take: number; select: { key: true; value: true; scopeKey: true } }): Promise<StoredVariable[]> };
  environment: { findFirst(args: { where: { id: string; organizationId: string }; select: { tags: true } }): Promise<{ tags: string[] } | null> };
  variableSet: { findMany(args: { where: { organizationId: string }; take: number; select: { slug: true; name: true; selector: true } }): Promise<VariableSetDef[]> };
  deploymentExecution: { updateMany(args: { where: { id: string; organizationId: string; configDigest: null }; data: { configDigest: string; configSnapshot: Array<[string, string]> } }): Promise<{ count: number }> };
}

export type ConfigSnapshotOutcome = { recorded: true; digest: string; count: number } | { recorded: false; reason: "already_recorded" | "unavailable" };

export async function recordDeploymentConfigSnapshot(repo: ConfigSnapshotRepo, input: { organizationId: string; environmentId: string; executionId: string }): Promise<ConfigSnapshotOutcome> {
  try {
    const [variables, environment, sets] = await Promise.all([
      repo.configVariable.findMany({ where: { organizationId: input.organizationId }, take: MAX_VARIABLES_PER_WORKSPACE, select: { key: true, value: true, scopeKey: true } }),
      repo.environment.findFirst({ where: { id: input.environmentId, organizationId: input.organizationId }, select: { tags: true } }),
      repo.variableSet.findMany({ where: { organizationId: input.organizationId }, take: MAX_VARIABLE_SETS, select: { slug: true, name: true, selector: true } }),
    ]);
    const { resolved } = resolveWithSets(variables, { id: input.environmentId, tags: environment?.tags ?? [] }, sets);
    const digest = resolvedDigest(resolved);
    const result = await repo.deploymentExecution.updateMany({
      where: { id: input.executionId, organizationId: input.organizationId, configDigest: null },
      data: { configDigest: digest, configSnapshot: resolved.map((v) => [v.key, v.value]) },
    });
    return result.count === 1 ? { recorded: true, digest, count: resolved.length } : { recorded: false, reason: "already_recorded" };
  } catch {
    return { recorded: false, reason: "unavailable" };
  }
}
