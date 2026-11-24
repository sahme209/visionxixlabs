import { publicBillingPolicyEnabled, configuredPublicBillingIdentity } from "./publicBillingConfig";
import { publicDatabaseNow } from "./publicCreditAuthority";
import { readPublicEntitlementSnapshot } from "./publicBillingEntitlements";
import type { PublicSqlRepository } from "./publicBillingStore";
import type { PublicPlanId } from "./publicPlanCatalog";

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
  | { allowed: false; planId: PublicPlanId | null; used: number | null; limit: number | null; remaining: 0; reason: "deployment_quota_unavailable" };

export function billingTierToPublicPlan(tier: string | undefined, status: string | undefined): PublicPlanId {
  if (status !== "active") return "free";
  // Both legacy paid self-service tiers become Pro. This compatibility
  // mapping preserves paid access while Stripe subscriptions are reconciled;
  // it does not mutate or activate any subscription.
  if (tier === "starter" || tier === "growth") return "pro";
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

/** Reports monthly deployment activity and workspace entitlement for Usage & Billing. */
export async function checkDeploymentQuota(
  repo: DeploymentQuotaRepo,
  organizationId: string,
  now = new Date(),
): Promise<DeploymentQuotaDecision> {
  try {
    if (publicBillingPolicyEnabled()) {
      const publicPlan = await (repo as unknown as PublicSqlRepository).$transaction(async tx=>readPublicEntitlementSnapshot(tx,organizationId,configuredPublicBillingIdentity(),await publicDatabaseNow(tx)),{isolationLevel:"RepeatableRead"});
      if(publicPlan){
        if(!publicPlan.usable)return {allowed:false,reason:"deployment_quota_unavailable",planId:publicPlan.planId,used:null,limit:null,remaining:0};
        const used=await repo.deploymentExecution.count({where:{organizationId,createdAt:currentMonthUtc(now)}});
        if(!Number.isSafeInteger(used)||used<0)throw Error("deployment_count_unavailable");
        return {allowed:true,planId:publicPlan.planId,used,limit:null,remaining:null};
      }
    }
    const billing = await repo.tenantBillingPlan.findUnique({ where: { organizationId } });
    const planId = billingTierToPublicPlan(billing?.tier, billing?.status);

    const used = await repo.deploymentExecution.count({
      where: { organizationId, createdAt: currentMonthUtc(now) },
    });
    if (!Number.isSafeInteger(used) || used < 0) throw Error("deployment_count_unavailable");
    return { allowed: true, planId, used, limit: null, remaining: null };
  } catch {
    return { allowed: false, planId: null, used: null, limit: null, remaining: 0, reason: "deployment_quota_unavailable" };
  }
}
