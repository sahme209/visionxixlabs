import "server-only";
import type { Prisma } from "@/lib/prismaClient";
import { captureRestartTarget } from "@/lib/axiom/agentRuntime/restartTargetReview";
import { hasDesktopCapability } from "@/lib/desktop/desktopAuthorization";
import { checkRestartReview, type RestartSource, type RestartRule, type RestartReviewRecord } from "./restartReview";
import { readRestartReview, restartReviewReadiness } from "./restartReviewStore";

export type ReviewDatabase = Pick<Prisma.TransactionClient, "$queryRawUnsafe" | "airflowAutomationExecution" | "airflowAutomation" | "environment" | "deploymentTarget" | "tenantIntegrationConnection" | "orgMembership">;

export async function requireCurrentRestartReview(db: ReviewDatabase, source: RestartSource, rule: RestartRule, expectedDigest?: string): Promise<RestartReviewRecord> {
  if (await restartReviewReadiness(db) !== "ready") throw new Error("airflow_review_storage_unavailable");
  const row = await readRestartReview(db, source.organizationId, source.id);
  if (!row) throw new Error("airflow_review_required");
  if (expectedDigest !== undefined && expectedDigest !== row.digest) throw new Error("airflow_review_changed");
  const connection = await db.tenantIntegrationConnection.findFirst({ where: { id: rule.connectionId, organizationId: source.organizationId, provider: "airflow", status: "active" } });
  const metadata = connection?.scopesJson as { baseUrl?: unknown } | null;
  const target = rule.environmentId ? await captureRestartTarget(db, source.organizationId, rule.environmentId) : null;
  if (!connection || typeof metadata?.baseUrl !== "string" || !target || !checkRestartReview(row, source, rule, { id: connection.id, baseUrl: metadata.baseUrl, updatedAt: connection.updatedAt.toISOString() }, target)) throw new Error("airflow_restart_review_stale");
  return row;
}

/** Short transaction only: lock the exact current authority/configuration rows
 * through durable intent. No network call and no provider-wide lock is claimed. */
export async function fenceRestartDispatch(db: ReviewDatabase, review: RestartReviewRecord, attempt: number, actorUserId: string, intent: Record<string, unknown>): Promise<void> {
  const locks = await db.$queryRawUnsafe<Array<{ role: string }>>(`SELECT m.role FROM public."AirflowAutomationExecution" e
    JOIN public."AirflowAutomation" a ON a.id=e."automationId" AND a."organizationId"=e."organizationId"
    JOIN public."Environment" n ON n.id=a."environmentId" AND n."organizationId"=e."organizationId"
    JOIN public."DeploymentTarget" t ON t."environmentId"=n.id AND t."organizationId"=e."organizationId"
    JOIN public."TenantIntegrationConnection" c ON c.id=a."connectionId" AND c."organizationId"=e."organizationId"
    JOIN public."OrgMembership" m ON m."organizationId"=e."organizationId" AND m."userId"=$4
    WHERE e.id=$1 AND e."organizationId"=$2 AND e.status='running' AND e.attempt=$3 AND a.enabled=true
      AND c.status='active' AND c.provider='airflow' AND m."acceptedAt" IS NOT NULL
    FOR UPDATE OF e FOR SHARE OF a,n,t,c,m`, review.executionId, review.organizationId, attempt, actorUserId);
  if (locks.length !== 1 || !hasDesktopCapability(locks[0].role as Parameters<typeof hasDesktopCapability>[0], "agent:approve")) throw new Error("airflow_restart_review_stale");
  const execution = await db.airflowAutomationExecution.findFirst({ where: { id: review.executionId, organizationId: review.organizationId }, include: { automation: true } });
  if (!execution || execution.status !== "running" || execution.attempt !== attempt || !execution.automation.enabled) throw new Error("airflow_restart_review_stale");
  await requireCurrentRestartReview(db, execution, execution.automation, review.digest);
  const saved = await db.airflowAutomationExecution.updateMany({ where: { id: execution.id, organizationId: execution.organizationId, status: "running", attempt, automation: { enabled: true } }, data: { resultJson: JSON.parse(JSON.stringify({ ...intent, reviewDigest: review.digest, phase: "dispatching" })) } });
  if (saved.count !== 1) throw new Error("airflow_restart_review_stale");
}
