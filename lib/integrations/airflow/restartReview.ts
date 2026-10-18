import "server-only";
import { sha256ContentHash } from "@/lib/tauri/contentHash";
import { matchesRestartTarget, type RestartTargetReview } from "@/lib/axiom/agentRuntime/restartTargetReview";

export interface RestartRule {
  id?: string; organizationId: string; connectionId: string; dagId: string; actionType: string;
  environmentId?: string | null; repositoryFullName?: string | null; sourceRef?: string | null; sourceKind?: string | null;
  requiredDagState: string; dependencyDagIds: string[]; approvalRequired: boolean; maxRetries: number; retryDelaySeconds: number;
  promotedFromExecutionId?: string | null; createdAt?: Date;
}
export interface RestartSource { id: string; organizationId: string; automationId: string; sourceDagId: string; sourceDagRunId: string; sourceDagState: string }
export interface RestartConnection { id: string; baseUrl: string; updatedAt: string }
export interface RestartReviewPayload {
  schema: "axiom.airflow.restart-review.v1"; organizationId: string; executionId: string; automationId: string;
  requestedOperation: "service_restart"; source: { dagId: string; runId: string; state: string };
  ruleDigest: string; connection: RestartConnection; target: RestartTargetReview; createdAt: string;
}
export interface RestartReviewRecord {
  executionId: string; organizationId: string; automationId: string; payload: RestartReviewPayload; digest: string; createdAt: Date;
}
/** Configuration only; scheduler cursors and updatedAt are not policy edits. */
export function restartRuleDigest<T extends RestartRule>(rule: T): string {
  return sha256ContentHash({ organizationId: rule.organizationId, connectionId: rule.connectionId, dagId: rule.dagId, actionType: rule.actionType,
    environmentId: rule.environmentId ?? null, repositoryFullName: rule.repositoryFullName ?? null, sourceRef: rule.sourceRef ?? null, sourceKind: rule.sourceKind ?? "branch",
    requiredDagState: rule.requiredDagState, dependencyDagIds: rule.dependencyDagIds, approvalRequired: rule.approvalRequired,
    maxRetries: rule.maxRetries, retryDelaySeconds: rule.retryDelaySeconds, promotedFromExecutionId: rule.promotedFromExecutionId ?? null, createdAt: rule.createdAt?.toISOString() ?? null });
}
export function buildRestartReview(source: RestartSource, rule: RestartRule, connection: RestartConnection, target: RestartTargetReview, createdAt = new Date()): RestartReviewRecord {
  if (!source.id || !rule.id || source.automationId !== rule.id || source.organizationId !== rule.organizationId || target.organizationId !== source.organizationId
    || rule.environmentId !== target.environmentId || rule.actionType !== "deploy" || source.sourceDagId !== rule.dagId
    || !["success", "failed"].includes(source.sourceDagState) || !source.sourceDagRunId || connection.id !== rule.connectionId
    || !Number.isFinite(Date.parse(connection.updatedAt)) || !Number.isFinite(createdAt.getTime()) || new URL(connection.baseUrl).protocol !== "https:") throw new Error("airflow_restart_review_unavailable");
  const payload: RestartReviewPayload = { schema: "axiom.airflow.restart-review.v1", organizationId: source.organizationId, executionId: source.id, automationId: rule.id,
    requestedOperation: "service_restart", source: { dagId: source.sourceDagId, runId: source.sourceDagRunId, state: source.sourceDagState }, ruleDigest: restartRuleDigest(rule),
    connection: { ...connection }, target: { ...target }, createdAt: createdAt.toISOString() };
  return { executionId: source.id, organizationId: source.organizationId, automationId: rule.id, payload, digest: sha256ContentHash(payload), createdAt };
}
export function checkRestartReview(row: RestartReviewRecord | null, source: RestartSource, rule: RestartRule, connection: RestartConnection, target: RestartTargetReview): boolean {
  try {
    if (!row || Buffer.byteLength(JSON.stringify(row.payload)) > 16_384 || row.executionId !== source.id || row.organizationId !== source.organizationId || row.automationId !== source.automationId
      || row.payload.schema !== "axiom.airflow.restart-review.v1" || sha256ContentHash(row.payload) !== row.digest || !matchesRestartTarget(row.payload.target, target)) return false;
    return buildRestartReview(source, rule, connection, target, new Date(row.payload.createdAt)).digest === row.digest && row.createdAt.getTime() === Date.parse(row.payload.createdAt);
  } catch { return false; }
}
