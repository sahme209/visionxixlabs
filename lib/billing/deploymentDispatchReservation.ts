import { publicBillingPolicyEnabled, configuredPublicBillingIdentity } from "./publicBillingConfig";
import { publicDatabaseNow } from "./publicCreditAuthority";
import { readPublicEntitlementSnapshot } from "./publicBillingEntitlements";
import { lockPublicOrganization, type PublicSql } from "./publicBillingStore";
import type { PublicPlanId } from "./publicPlanCatalog";
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
  | { ok: false; error: "deployment_quota_unavailable" | "deployment_already_in_progress" | "idempotency_key_conflict" };

/** Claims one external dispatch under a stable key before invoking the provider. */
export async function reserveDeploymentDispatch(
  repo: DeploymentReservationRepo,
  input: DeploymentReservationInput,
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
          const reservation=await tx.deploymentExecution.create({data:{...input,status:"reserved"}});
          return {ok:true as const,reservation,reused:false,planId:publicPlan.planId,used:null,limit:null};
        }
      }
      // A stale reservation can represent an accepted provider request whose
      // receipt could not be stored. Never release its idempotency key
      // merely because time elapsed; reconcile the external outcome first.
      const billing = await tx.tenantBillingPlan.findUnique({ where: { organizationId: input.organizationId } });
      const planId = billingTierToPublicPlan(billing?.tier, billing?.status);
      const reservation = await tx.deploymentExecution.create({ data: { ...input, status: "reserved" } });
      return { ok: true as const, reservation, reused: false, planId, used: null, limit: null };
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
