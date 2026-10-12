import {
  PUBLIC_PLAN_CATALOG,
  type PublicPlanId,
} from "./publicPlanCatalog";

export interface DeploymentQuotaRepo {
  tenantBillingPlan: {
    findUnique(args: { where: { organizationId: string } }): Promise<{
      tier: string;
      status: string;
    } | null>;
  };
  deploymentExecution: {
    count(args: {
      where: {
        organizationId: string;
        createdAt: { gte: Date; lt: Date };
      };
    }): Promise<number>;
  };
}

export type DeploymentQuotaDecision =
  | { allowed: true; planId: PublicPlanId; used: number; limit: number | null; remaining: number | null }
  | { allowed: false; planId: PublicPlanId | null; used: number | null; limit: number | null; remaining: 0; reason: "deployment_quota_exhausted" | "deployment_quota_unavailable" };

export function billingTierToPublicPlan(tier: string | undefined, status: string | undefined): PublicPlanId {
  if (status !== "active") return "free";
  if (tier === "growth") return "pro";
  if (tier === "enterprise") return "enterprise";
  return "free";
}

function currentMonthUtc(now: Date): { gte: Date; lt: Date } {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  return {
    gte: new Date(Date.UTC(year, month, 1)),
    lt: new Date(Date.UTC(year, month + 1, 1)),
  };
}

/**
 * Authoritative pre-dispatch gate. A deployment is counted from its durable
 * DeploymentExecution row, which is only created after GitHub accepts the
 * workflow dispatch. Polling, retries inside that run, and rollback do not
 * create another row and therefore never consume another allowance.
 */
export async function checkDeploymentQuota(
  repo: DeploymentQuotaRepo,
  organizationId: string,
  now = new Date(),
): Promise<DeploymentQuotaDecision> {
  try {
    const billing = await repo.tenantBillingPlan.findUnique({ where: { organizationId } });
    const planId = billingTierToPublicPlan(billing?.tier, billing?.status);
    const plan = PUBLIC_PLAN_CATALOG.find((candidate) => candidate.id === planId);
    if (!plan) {
      return { allowed: false, planId: null, used: null, limit: null, remaining: 0, reason: "deployment_quota_unavailable" };
    }

    const used = await repo.deploymentExecution.count({
      where: { organizationId, createdAt: currentMonthUtc(now) },
    });
    const limit = plan.monthlyDeployments;
    if (limit !== null && used >= limit) {
      return { allowed: false, planId, used, limit, remaining: 0, reason: "deployment_quota_exhausted" };
    }

    return {
      allowed: true,
      planId,
      used,
      limit,
      remaining: limit === null ? null : Math.max(0, limit - used),
    };
  } catch {
    return { allowed: false, planId: null, used: null, limit: null, remaining: 0, reason: "deployment_quota_unavailable" };
  }
}
