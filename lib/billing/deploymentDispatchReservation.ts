import { PUBLIC_PLAN_CATALOG, type PublicPlanId } from "./publicPlanCatalog";
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
  source: "desktop" | "agent";
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

      // A stale reservation can represent an accepted provider request whose
      // receipt could not be stored. Never free its quota or idempotency key
      // merely because time elapsed; reconcile the external outcome first.
      const billing = await tx.tenantBillingPlan.findUnique({ where: { organizationId: input.organizationId } });
      const planId = billingTierToPublicPlan(billing?.tier, billing?.status);
      const plan = PUBLIC_PLAN_CATALOG.find((candidate) => candidate.id === planId);
      if (!plan) return { ok: false as const, error: "deployment_quota_unavailable" as const };
      const used = await tx.deploymentExecution.count({ where: { organizationId: input.organizationId, createdAt: monthRange(now) } });
      if (plan.monthlyDeployments !== null && used >= plan.monthlyDeployments) {
        return { ok: false as const, error: "deployment_quota_exhausted" as const, used, limit: plan.monthlyDeployments };
      }
      const reservation = await tx.deploymentExecution.create({ data: { ...input, status: "reserved" } });
      return { ok: true as const, reservation, reused: false, planId, used, limit: plan.monthlyDeployments };
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
