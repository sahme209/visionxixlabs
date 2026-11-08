import { publicBillingPolicyEnabled, configuredPublicBillingIdentity } from "./publicBillingConfig";
import { publicDatabaseNow } from "./publicCreditAuthority";
import { readPublicEntitlementSnapshot } from "./publicBillingEntitlements";
import { lockPublicOrganization, type PublicSql } from "./publicBillingStore";
import type { PublicPlanId } from "./publicPlanCatalog";
import { monthlyDeploymentLimitFor, DESIGN_PARTNER_DEPLOYMENT_OVERRIDES, type DeploymentQuotaOverrides } from "./deploymentAllowance";
import { billingTierToPublicPlan } from "./deploymentQuota";
import type { DeploymentExecutionRow } from "@/lib/releaseops/deploymentExecutionResponder";

export interface DeploymentReservationInput {
  organizationId: string;
  idempotencyKey: string;
  environmentId: string;
  repositoryFullName: string;
  sourceRef: string;
  sourceKind: "branch" | "tag";
  sourceCommitSha: string;
  branchPolicyId: string | null;
  promotedFromExecutionId: string | null;
  pullRequestUrl: string | null;
  source: "desktop" | "agent" | "dashboard";
  triggeredByUserId: string;
}

type ReservationRow = DeploymentExecutionRow;

interface DeploymentReservationTransaction {
  tenantBillingPlan: {
    findUnique(args: { where: { organizationId: string } }): Promise<{ tier: string; status: string } | null>;
  };
  deploymentExecution: {
    findUnique(args: { where: { organizationId_idempotencyKey: { organizationId: string; idempotencyKey: string } } }): Promise<ReservationRow | null>;
    deleteMany(args: { where: { organizationId: string; status: string; createdAt: { lt: Date } } }): Promise<{ count: number }>;
    count(args: { where: { organizationId: string; createdAt: { gte: Date; lt: Date } } }): Promise<number>;
    create(args: { data: DeploymentReservationInput & { status: "reserved" } }): Promise<ReservationRow>;
  };
}

export interface DeploymentReservationRepo extends DeploymentReservationTransaction {
  $transaction<T>(
    fn: (tx: DeploymentReservationTransaction) => Promise<T>,
    options: { isolationLevel: "Serializable" },
  ): Promise<T>;
  deploymentExecution: DeploymentReservationTransaction["deploymentExecution"] & {
    deleteMany(args: { where: { id: string; organizationId: string; status: string } }): Promise<{ count: number }>;
    updateMany(args: {
      where: { id: string; organizationId: string; status: string };
      data: { workflowRunId: string | null; workflowUrl: string | null; status: string };
    }): Promise<{ count: number }>;
  };
}

export type DeploymentReservationResult =
  | { ok: true; reservation: ReservationRow; reused: boolean; planId: PublicPlanId | null; used: number | null; limit: number | null }
  | { ok: false; error: "deployment_quota_exhausted" | "deployment_quota_unavailable" | "deployment_already_in_progress" | "idempotency_key_conflict"; limit?: number | null; used?: number };

function monthRange(now: Date) {
  return {
    gte: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
    lt: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)),
  };
}

/**
 * Atomically claims an external deployment and one monthly allowance slot.
 * Serializable isolation prevents two concurrent requests from both seeing
 * the final available slot. A stable key makes client and agent retries safe.
 */
export async function reserveDeploymentDispatch(
  repo: DeploymentReservationRepo,
  input: DeploymentReservationInput,
  now = new Date(),
  overrides: DeploymentQuotaOverrides = DESIGN_PARTNER_DEPLOYMENT_OVERRIDES,
): Promise<DeploymentReservationResult> {
  if (!input.idempotencyKey || input.idempotencyKey.length > 200) {
    return { ok: false, error: "deployment_quota_unavailable" };
  }
  try {
    return await repo.$transaction(async (tx) => {
      const existing = await tx.deploymentExecution.findUnique({
        where: { organizationId_idempotencyKey: { organizationId: input.organizationId, idempotencyKey: input.idempotencyKey } },
      });
      if (existing) {
        const sameOperation = existing.environmentId === input.environmentId
          && existing.repositoryFullName === input.repositoryFullName
          && existing.sourceRef === input.sourceRef
          && existing.sourceKind === input.sourceKind
          && existing.sourceCommitSha === input.sourceCommitSha
          && existing.source === input.source;
        if (!sameOperation) return { ok: false as const, error: "idempotency_key_conflict" as const };
        if (existing.status === "reserved") return { ok: false as const, error: "deployment_already_in_progress" as const };
        return { ok: true as const, reservation: existing, reused: true, planId: null, used: null, limit: null };
      }

      if(publicBillingPolicyEnabled()){
        const sql=tx as unknown as PublicSql;
        await lockPublicOrganization(sql,input.organizationId);
        const decisionNow=await publicDatabaseNow(sql);
        const publicPlan=await readPublicEntitlementSnapshot(sql,input.organizationId,configuredPublicBillingIdentity(),decisionNow);
        if(publicPlan){
          if(!publicPlan.usable)return {ok:false as const,error:"deployment_quota_unavailable" as const};
          const used=await tx.deploymentExecution.count({where:{organizationId:input.organizationId,createdAt:monthRange(decisionNow)}});
          if(!Number.isSafeInteger(used)||used<0)throw Error("deployment_count_unavailable");
          const limit=monthlyDeploymentLimitFor(input.organizationId, overrides);
          if(used>=limit)return {ok:false as const,error:"deployment_quota_exhausted" as const,used,limit};
          const reservation=await tx.deploymentExecution.create({data:{...input,status:"reserved"}});
          return {ok:true as const,reservation,reused:false,planId:publicPlan.planId,used,limit};
        }
      }
      // A stale reservation can represent an accepted provider request whose
      // receipt could not be stored. Never free its quota or idempotency key
      // merely because time elapsed; reconcile the external outcome first.
      const billing = await tx.tenantBillingPlan.findUnique({ where: { organizationId: input.organizationId } });
      const planId = billingTierToPublicPlan(billing?.tier, billing?.status);
      // Every organization: 10 counted deployments per month or its
      // design-partner override; plans no longer change the number.
      const limit = monthlyDeploymentLimitFor(input.organizationId, overrides);
      const used = await tx.deploymentExecution.count({ where: { organizationId: input.organizationId, createdAt: monthRange(now) } });
      if (!Number.isSafeInteger(used) || used < 0) throw Error("deployment_count_unavailable");
      if (used >= limit) {
        return { ok: false as const, error: "deployment_quota_exhausted" as const, used, limit };
      }
      const reservation = await tx.deploymentExecution.create({ data: { ...input, status: "reserved" } });
      return { ok: true as const, reservation, reused: false, planId, used, limit };
    }, { isolationLevel: "Serializable" });
  } catch {
    return { ok: false, error: "deployment_quota_unavailable" };
  }
}

export async function releaseDeploymentDispatch(repo: DeploymentReservationRepo, organizationId: string, reservationId: string): Promise<boolean> {
  try {
    const result = await repo.deploymentExecution.deleteMany({ where: { id: reservationId, organizationId, status: "reserved" } });
    return result.count === 1;
  } catch {
    return false;
  }
}

export async function settleDeploymentDispatch(
  repo: DeploymentReservationRepo,
  organizationId: string,
  reservationId: string,
  dispatch: { workflowRunId: string | null; workflowUrl: string | null },
): Promise<boolean> {
  try {
    const result = await repo.deploymentExecution.updateMany({
      where: { id: reservationId, organizationId, status: "reserved" },
      data: {
        workflowRunId: dispatch.workflowRunId,
        workflowUrl: dispatch.workflowUrl,
        status: dispatch.workflowRunId ? "queued" : "tracking_unavailable",
      },
    });
    return result.count === 1;
  } catch {
    return false;
  }
}
