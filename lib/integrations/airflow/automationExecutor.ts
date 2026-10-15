import "server-only";

import { prisma } from "@/lib/db";
import { parseRepositoryFullName, resolveTenantScopedToken } from "@/lib/connectors/github/resolveTenantScopedToken";
import { createPullRequest, dispatchWorkflow } from "@/lib/connectors/github/githubWriteClient";
import { evaluateDeploymentPolicy, type DeploymentPolicyRepo } from "@/lib/releaseops/deploymentPolicyGuard";
import { AWS_ECS_DEPLOY_WORKFLOW_FILENAME } from "@/lib/releaseops/awsEcsDeployWorkflowTemplate";
import { appendAuditEvent, type AuditEventRepo } from "@/lib/releaseops/auditEventResponder";
import { dispatchWebhookEvent } from "@/lib/webhooks/dispatchWebhookEvent";
import { hasDesktopCapability } from "@/lib/desktop/desktopAuthorization";

export async function executeAirflowAutomation(executionId: string, actorUserId?: string): Promise<{ ok: true; result: Record<string, unknown> } | { ok: false; error: string }> {
  const execution = await prisma.airflowAutomationExecution.findUnique({ where: { id: executionId }, include: { automation: true } });
  if (!execution || !["pending_approval", "queued", "failed"].includes(execution.status)) return { ok: false, error: "airflow_execution_not_actionable" };
  if (execution.status === "pending_approval" && !actorUserId) return { ok: false, error: "airflow_human_approval_required" };
  const automation = execution.automation;
  if (!automation.enabled) return { ok: false, error: "airflow_automation_disabled" };
  const approvalActorId = actorUserId ?? execution.decidedByUserId;
  if (automation.approvalRequired && !approvalActorId) return { ok: false, error: "airflow_human_approval_required" };
  if (approvalActorId) {
    try {
      // A stored approval is not perpetual authority for scheduled retries.
      // Use the same accepted-membership/capability model as desktop approval.
      const membership = await prisma.orgMembership.findUnique({
        where: { userId_organizationId: { userId: approvalActorId, organizationId: automation.organizationId } },
        select: { acceptedAt: true, role: true },
      });
      if (!membership?.acceptedAt || !hasDesktopCapability(membership.role, "agent:approve")) {
        return { ok: false, error: "airflow_approval_authority_required" };
      }
    } catch {
      return { ok: false, error: "airflow_approval_authority_unavailable" };
    }
  }
  // Competing approvals/ticks must claim the exact observed attempt before
  // any provider action. Status alone is insufficient if a concurrent retry
  // has already run and failed again. Rejection wins if it changed the row.
  const claimed = await prisma.airflowAutomationExecution.updateMany({
    where: { id: execution.id, organizationId: execution.organizationId, status: execution.status, attempt: execution.attempt, automation: { enabled: true } },
    data: { status: "running", attempt: { increment: 1 }, errorCode: null, nextRetryAt: null, ...(actorUserId ? { decidedByUserId: actorUserId, decidedAt: new Date() } : {}) },
  });
  if (claimed.count !== 1) return { ok: false, error: "airflow_execution_not_actionable" };
  let providerActionStarted = false;
  let providerReceipt: Record<string, unknown> | null = null;
  const dispatchIntent = { action: automation.actionType, repositoryFullName: automation.repositoryFullName, sourceRef: automation.sourceRef };
  const markDispatchIntent = async () => {
    // Persist uncertainty before the non-idempotent request. A process crash
    // leaves the claimed row running, outside the scheduler's retry selection.
    await prisma.airflowAutomationExecution.update({ where: { id: execution.id }, data: { resultJson: { ...dispatchIntent, phase: "dispatching" } } });
    providerActionStarted = true;
  };
  try {
    if (automation.actionType === "none") return await succeed(execution.id, { action: "none" });
    const repository = automation.repositoryFullName ? parseRepositoryFullName(automation.repositoryFullName) : null;
    if (!repository) throw new Error("automation_repository_required");
    const token = await resolveTenantScopedToken(automation.organizationId, repository);
    if (!token.ok) throw new Error(token.error);

    if (automation.actionType === "open_pull_request") {
      if (!automation.sourceRef || !automation.pullRequestBase || !automation.pullRequestTitle) throw new Error("pull_request_configuration_incomplete");
      await markDispatchIntent();
      const opened = await createPullRequest({ owner: repository.owner, repo: repository.repo, head: automation.sourceRef, base: automation.pullRequestBase, title: automation.pullRequestTitle, body: `Automatically proposed by Axiom after Airflow DAG ${execution.sourceDagId} run ${execution.sourceDagRunId} completed.`, installationToken: token.token });
      if (!opened.ok) throw new Error(opened.error);
      providerReceipt = { action: "open_pull_request", pullRequestNumber: opened.data.number, pullRequestUrl: opened.data.htmlUrl };
      return await succeed(execution.id, providerReceipt);
    }

    if (automation.actionType === "deploy") {
      if (!automation.environmentId || !automation.sourceRef) throw new Error("deployment_configuration_incomplete");
      const environment = await prisma.environment.findFirst({ where: { id: automation.environmentId, organizationId: automation.organizationId } });
      if (!environment) throw new Error("environment_not_found");
      if (environment.tier === "prod" && !(actorUserId || execution.decidedByUserId)) throw new Error("production_human_approval_required");
      const target = await prisma.deploymentTarget.findFirst({ where: { environmentId: environment.id, organizationId: automation.organizationId } });
      if (!target) throw new Error("deployment_target_not_configured");
      const policy = await evaluateDeploymentPolicy(prisma as unknown as DeploymentPolicyRepo, { organizationId: automation.organizationId, environmentId: environment.id, owner: repository.owner, repo: repository.repo, sourceRef: automation.sourceRef, sourceKind: automation.sourceKind === "tag" ? "tag" : "branch", ...(automation.promotedFromExecutionId ? { promotedFromExecutionId: automation.promotedFromExecutionId } : {}), ...(environment.tier === "prod" ? { requiredControlSet: "production" as const } : {}), installationToken: token.token });
      if (!policy.ok) throw new Error(policy.error);
      await markDispatchIntent();
      const dispatched = await dispatchWorkflow({ owner: repository.owner, repo: repository.repo, workflowFile: AWS_ECS_DEPLOY_WORKFLOW_FILENAME, ref: automation.sourceRef, inputs: { role_arn: target.roleArn, region: target.region, cluster: target.ecsCluster, service: target.ecsService }, installationToken: token.token });
      if (!dispatched.ok) throw new Error(dispatched.error);
      providerReceipt = { action: "deploy", workflowRunId: dispatched.data.workflowRunId, workflowUrl: dispatched.data.htmlUrl };
      const deployment = await prisma.deploymentExecution.create({ data: { organizationId: automation.organizationId, environmentId: environment.id, repositoryFullName: automation.repositoryFullName!, sourceRef: automation.sourceRef, sourceKind: automation.sourceKind ?? "branch", sourceCommitSha: policy.sourceCommitSha, branchPolicyId: policy.policyId, promotedFromExecutionId: automation.promotedFromExecutionId, pullRequestUrl: policy.pullRequestUrl, workflowRunId: dispatched.data.workflowRunId, workflowUrl: dispatched.data.htmlUrl, source: "agent", triggeredByUserId: actorUserId ?? automation.createdByUserId, status: dispatched.data.workflowRunId ? "queued" : "tracking_unavailable" } });
      providerReceipt.deploymentExecutionId = deployment.id;
      await prisma.airflowAutomationExecution.update({ where: { id: execution.id }, data: { deploymentExecutionId: deployment.id } });
      return await succeed(execution.id, { action: "deploy", deploymentExecutionId: deployment.id, workflowUrl: dispatched.data.htmlUrl, rollback: "AWS ECS workflow automatically restores the prior task definition if steady-state validation fails" });
    }
    throw new Error("unsupported_automation_action");
  } catch (error) {
    const message = providerActionStarted ? "airflow_provider_outcome_unknown" : error instanceof Error ? error.message.split(":")[0] : "automation_execution_failed";
    const attempt = execution.attempt + 1;
    const retry = !providerActionStarted && attempt < automation.maxRetries;
    await prisma.airflowAutomationExecution.update({ where: { id: execution.id }, data: { status: providerActionStarted ? "needs_reconciliation" : "failed", errorCode: message, nextRetryAt: retry ? new Date(Date.now() + automation.retryDelaySeconds * 1000) : null, completedAt: providerActionStarted || retry ? null : new Date(), ...(providerActionStarted ? { resultJson: { ...dispatchIntent, ...(providerReceipt ?? {}), phase: "outcome_unconfirmed" } } : {}) } });
    await appendAuditEvent(prisma as unknown as AuditEventRepo, { organizationId: automation.organizationId, kind: "airflow.automation.failed", subjectKind: "automation", subjectId: execution.id, outcome: "error", summary: providerActionStarted ? `Airflow automation ${automation.name} outcome is unconfirmed; automatic retry paused` : `Airflow automation ${automation.name} failed: ${message}`, actorUserId: actorUserId ?? null });
    if (automation.notifyOnFailure) await dispatchWebhookEvent({ organizationId: automation.organizationId, eventKind: "airflow.automation_failed", data: { automationId: automation.id, automationName: automation.name, executionId: execution.id, error: message, retryScheduled: retry } }).catch(() => undefined);
    return { ok: false, error: message };
  }
}

async function succeed(executionId: string, result: Record<string, unknown>): Promise<{ ok: true; result: Record<string, unknown> }> {
  const current = await prisma.airflowAutomationExecution.findUniqueOrThrow({ where: { id: executionId }, include: { automation: true } });
  const row = await prisma.airflowAutomationExecution.update({ where: { id: executionId }, data: { status: "succeeded", resultJson: JSON.parse(JSON.stringify(result)), completedAt: new Date(), nextRetryAt: null } });
  await appendAuditEvent(prisma as unknown as AuditEventRepo, { organizationId: row.organizationId, kind: "airflow.automation.succeeded", subjectKind: "automation", subjectId: row.id, summary: `Airflow automation ${current.automation.name} completed its governed action`, actorUserId: row.decidedByUserId });
  if (current.automation.notifyOnSuccess) await dispatchWebhookEvent({ organizationId: row.organizationId, eventKind: "airflow.automation_succeeded", data: { automationId: current.automation.id, automationName: current.automation.name, executionId: row.id, result } }).catch(() => undefined);
  return { ok: true, result };
}
