import "server-only";

import { prisma } from "@/lib/db";
import { parseRepositoryFullName, resolveTenantScopedToken } from "@/lib/connectors/github/resolveTenantScopedToken";
import { createPullRequest, dispatchWorkflow } from "@/lib/connectors/github/githubWriteClient";
import { evaluateDeploymentPolicy, type DeploymentPolicyRepo } from "@/lib/releaseops/deploymentPolicyGuard";
import { AWS_ECS_DEPLOY_WORKFLOW_FILENAME } from "@/lib/releaseops/awsEcsDeployWorkflowTemplate";
import { appendAuditEvent, type AuditEventRepo } from "@/lib/releaseops/auditEventResponder";
import { dispatchWebhookEvent } from "@/lib/webhooks/dispatchWebhookEvent";

export async function executeAirflowAutomation(executionId: string, actorUserId?: string): Promise<{ ok: true; result: Record<string, unknown> } | { ok: false; error: string }> {
  const execution = await prisma.airflowAutomationExecution.findUnique({ where: { id: executionId }, include: { automation: true } });
  if (!execution || !["pending_approval", "queued", "failed"].includes(execution.status)) return { ok: false, error: "airflow_execution_not_actionable" };
  const automation = execution.automation;
  await prisma.airflowAutomationExecution.update({ where: { id: execution.id }, data: { status: "running", attempt: { increment: 1 }, errorCode: null, nextRetryAt: null, ...(actorUserId ? { decidedByUserId: actorUserId, decidedAt: new Date() } : {}) } });
  try {
    if (automation.actionType === "none") return await succeed(execution.id, { action: "none" });
    const repository = automation.repositoryFullName ? parseRepositoryFullName(automation.repositoryFullName) : null;
    if (!repository) throw new Error("automation_repository_required");
    const token = await resolveTenantScopedToken(automation.organizationId, repository);
    if (!token.ok) throw new Error(token.error);

    if (automation.actionType === "open_pull_request") {
      if (!automation.sourceRef || !automation.pullRequestBase || !automation.pullRequestTitle) throw new Error("pull_request_configuration_incomplete");
      const opened = await createPullRequest({ owner: repository.owner, repo: repository.repo, head: automation.sourceRef, base: automation.pullRequestBase, title: automation.pullRequestTitle, body: `Automatically proposed by Axiom after Airflow DAG ${execution.sourceDagId} run ${execution.sourceDagRunId} completed.`, installationToken: token.token });
      if (!opened.ok) throw new Error(opened.error);
      return await succeed(execution.id, { action: "open_pull_request", pullRequestNumber: opened.data.number, pullRequestUrl: opened.data.htmlUrl });
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
      const dispatched = await dispatchWorkflow({ owner: repository.owner, repo: repository.repo, workflowFile: AWS_ECS_DEPLOY_WORKFLOW_FILENAME, ref: automation.sourceRef, inputs: { role_arn: target.roleArn, region: target.region, cluster: target.ecsCluster, service: target.ecsService }, installationToken: token.token });
      if (!dispatched.ok) throw new Error(dispatched.error);
      const deployment = await prisma.deploymentExecution.create({ data: { organizationId: automation.organizationId, environmentId: environment.id, repositoryFullName: automation.repositoryFullName!, sourceRef: automation.sourceRef, sourceKind: automation.sourceKind ?? "branch", sourceCommitSha: policy.sourceCommitSha, branchPolicyId: policy.policyId, promotedFromExecutionId: automation.promotedFromExecutionId, pullRequestUrl: policy.pullRequestUrl, workflowRunId: dispatched.data.workflowRunId, workflowUrl: dispatched.data.htmlUrl, source: "agent", triggeredByUserId: actorUserId ?? automation.createdByUserId, status: dispatched.data.workflowRunId ? "queued" : "tracking_unavailable" } });
      await prisma.airflowAutomationExecution.update({ where: { id: execution.id }, data: { deploymentExecutionId: deployment.id } });
      return await succeed(execution.id, { action: "deploy", deploymentExecutionId: deployment.id, workflowUrl: dispatched.data.htmlUrl, rollback: "AWS ECS workflow automatically restores the prior task definition if steady-state validation fails" });
    }
    throw new Error("unsupported_automation_action");
  } catch (error) {
    const message = error instanceof Error ? error.message.split(":")[0] : "automation_execution_failed";
    const attempt = execution.attempt + 1;
    const retry = attempt < automation.maxRetries;
    await prisma.airflowAutomationExecution.update({ where: { id: execution.id }, data: { status: "failed", errorCode: message, nextRetryAt: retry ? new Date(Date.now() + automation.retryDelaySeconds * 1000) : null, completedAt: retry ? null : new Date() } });
    await appendAuditEvent(prisma as unknown as AuditEventRepo, { organizationId: automation.organizationId, kind: "airflow.automation.failed", subjectKind: "automation", subjectId: execution.id, outcome: "error", summary: `Airflow automation ${automation.name} failed: ${message}`, actorUserId: actorUserId ?? null });
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
