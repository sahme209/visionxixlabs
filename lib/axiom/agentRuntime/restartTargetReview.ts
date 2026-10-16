/** Proposal-time target evidence. This is configuration identity, not cloud health
 * or immutable release evidence. Only the server may populate the review. */
export interface RestartTargetRepo {
  environment: { findUnique(args: { where: { id: string } }): Promise<{ id: string; organizationId: string; tier: string } | null> };
  deploymentTarget: { findUnique(args: { where: { environmentId: string } }): Promise<{
    id?: string; organizationId: string; provider?: string; updatedAt?: Date;
    roleArn: string; region: string; ecsCluster: string; ecsService: string;
  } | null> };
}
export interface RestartTargetReview {
  kind: "ecs_restart_target";
  organizationId: string;
  environmentId: string;
  environmentTier: string;
  targetId: string;
  provider: "aws";
  targetUpdatedAt: string;
  roleArn: string;
  region: string;
  ecsCluster: string;
  ecsService: string;
}
export async function captureRestartTarget(repo: RestartTargetRepo, organizationId: string, environmentId: string): Promise<RestartTargetReview | null> {
  const environment = await repo.environment.findUnique({ where: { id: environmentId } });
  if (!environment || environment.organizationId !== organizationId) return null;
  const target = await repo.deploymentTarget.findUnique({ where: { environmentId } });
  if (!target || target.organizationId !== organizationId || target.provider !== "aws" || !target.id
    || !(target.updatedAt instanceof Date) || !Number.isFinite(target.updatedAt.getTime())
    || !target.roleArn || !target.region || !target.ecsCluster || !target.ecsService) return null;
  return { kind: "ecs_restart_target", organizationId, environmentId, environmentTier: environment.tier,
    targetId: target.id, provider: "aws", targetUpdatedAt: target.updatedAt.toISOString(),
    roleArn: target.roleArn, region: target.region, ecsCluster: target.ecsCluster, ecsService: target.ecsService };
}
export function matchesRestartTarget(review: unknown, current: RestartTargetReview): review is RestartTargetReview {
  if (!review || typeof review !== "object" || Array.isArray(review)) return false;
  const value = review as Record<string, unknown>;
  return Object.keys(value).length === Object.keys(current).length
    && Object.entries(current).every(([key, expected]) => value[key] === expected);
}
