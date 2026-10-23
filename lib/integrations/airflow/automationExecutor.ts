import { deploymentEvidence } from "@/lib/releaseops/deploymentEvidence";
import "server-only";

import { loadAirflowClient } from "./connection";
import { latestDependenciesReady } from "./dependencyReadiness";
import { prisma } from "@/lib/db";
import { parseRepositoryFullName, resolveTenantScopedToken } from "@/lib/connectors/github/resolveTenantScopedToken";
import { createPullRequest, dispatchWorkflow } from "@/lib/connectors/github/githubWriteClient";
import { evaluateDeploymentPolicy, type DeploymentPolicyRepo } from "@/lib/releaseops/deploymentPolicyGuard";
import { AWS_ECS_DEPLOY_WORKFLOW_FILENAME } from "@/lib/releaseops/awsEcsDeployWorkflowTemplate";
import { appendAuditEvent, type AuditEventRepo } from "@/lib/releaseops/auditEventResponder";
import { dispatchWebhookEvent } from "@/lib/webhooks/dispatchWebhookEvent";
import { hasDesktopCapability } from "@/lib/desktop/desktopAuthorization";
import { reserveDeploymentDispatch, releaseDeploymentDispatch, settleDeploymentDispatch, type DeploymentReservationRepo } from "@/lib/billing/deploymentDispatchReservation";
import { requireCurrentRestartReview, fenceRestartDispatch } from "./restartReviewIO";
import type { RestartReviewRecord } from "./restartReview";

export async function executeAirflowAutomation(executionId: string, actorUserId?: string, expectedReviewDigest?: string): Promise<{ ok: true; result: Record<string, unknown> } | { ok: false; error: string }> {
  const execution = await prisma.airflowAutomationExecution.findUnique({ where: { id: executionId }, include: { automation: true } });
  if (!execution || !["pending_approval", "queued", "failed"].includes(execution.status)) return { ok: false, error: "airflow_execution_not_actionable" };
  if (execution.status === "pending_approval" && !actorUserId) return { ok: false, error: "airflow_human_approval_required" };
  const automation = execution.automation;
  if (!automation.enabled) return { ok: false, error: "airflow_automation_disabled" };
  const approvalActorId = actorUserId ?? execution.decidedByUserId;
  if (automation.approvalRequired && !approvalActorId) return { ok: false, error: "airflow_human_approval_required" };
  const initialAuthorityError = await currentApprovalAuthorityError(approvalActorId, automation.organizationId);
  if (initialAuthorityError) return { ok: false, error: initialAuthorityError };
  if (automation.organizationId !== execution.organizationId || execution.sourceDagId !== automation.dagId) {
    return { ok: false, error: "airflow_source_not_ready" };
  }
  let reviewedRestart: RestartReviewRecord | null = null;
  if (automation.actionType === "deploy") {
    if (!approvalActorId) return { ok: false, error: "airflow_human_approval_required" };
    if (execution.status === "pending_approval" && !/^[a-f0-9]{64}$/.test(expectedReviewDigest ?? "")) return { ok: false, error: "airflow_review_required" };
    try { reviewedRestart = await requireCurrentRestartReview(prisma, execution, automation, expectedReviewDigest); }
    catch (error) { return { ok: false, error: safeReviewError(error) }; }
  }
  if (automation.actionType !== "none") {
    try {
      const current = await loadAirflowClient(execution.organizationId);
      if (current.connectionId !== automation.connectionId) return { ok: false, error: "airflow_connection_changed" };
      const source = await current.client.getDagRun(execution.sourceDagId, execution.sourceDagRunId);
      const observedStart = source.logicalDate ?? source.startedAt;
      const sourceTime = observedStart ? Date.parse(observedStart) : NaN;
      if (source.dagId !== execution.sourceDagId || source.dagRunId !== execution.sourceDagRunId ||
          !["success", "failed"].includes(source.state) || source.state !== execution.sourceDagState ||
          (automation.requiredDagState !== "any" && source.state !== automation.requiredDagState) ||
          !Number.isFinite(sourceTime) || sourceTime < automation.createdAt.getTime()) {
        return { ok: false, error: "airflow_source_not_ready" };
      }
      if (!await latestDependenciesReady(current.client, automation.dependencyDagIds, source.logicalDate)) {
        return { ok: false, error: "airflow_dependencies_not_ready" };
      }
      // Re-read the same credential/endpoint binding after remote reads. A
      // concurrent reconnect or revocation must not authorize stale evidence.
      const binding = await prisma.tenantIntegrationConnection.findFirst({ where: {
        id: current.connectionId, organizationId: execution.organizationId, provider: "airflow", status: "active", updatedAt: current.connectionUpdatedAt,
      }, select: { id: true } });
      if (!binding) return { ok: false, error: "airflow_connection_changed" };
    } catch { return { ok: false, error: "airflow_preconditions_unavailable" }; }
  }
  const restartReview = reviewedRestart;
  // Remote reads may take long enough for an approver to be removed or lose
  // capability. Recheck immediately before consuming the execution claim.
  const currentAuthorityError = await currentApprovalAuthorityError(approvalActorId, automation.organizationId);
  if (currentAuthorityError) return { ok: false, error: currentAuthorityError };
  // Competing approvals/ticks must claim the exact observed attempt before
  // any provider action. Status alone is insufficient if a concurrent retry
  // has already run and failed again. Rejection wins if it changed the row.
  const claim = {
    where: { id: execution.id, organizationId: execution.organizationId, status: execution.status, attempt: execution.attempt, automation: { enabled: true, updatedAt: automation.updatedAt, connectionId: automation.connectionId } },
    data: { status: "running", attempt: { increment: 1 }, errorCode: null, nextRetryAt: null, ...(actorUserId ? { decidedByUserId: actorUserId, decidedAt: new Date() } : {}) },
  };
  let claimed: { count: number };
  try {
    claimed = restartReview ? await prisma.$transaction(async tx => {
      await requireCurrentRestartReview(tx, execution, automation, restartReview.digest);
      return tx.airflowAutomationExecution.updateMany(claim);
    }, { isolationLevel: "Serializable" }) : await prisma.airflowAutomationExecution.updateMany(claim);
  } catch (error) { return { ok: false, error: safeReviewError(error) }; }
  if (claimed.count !== 1) return { ok: false, error: "airflow_execution_not_actionable" };
  let providerActionStarted = false;
  let providerReceipt: Record<string, unknown> | null = null;
  let reservedDeploymentId: string | null = null;
  let finalReviewFenceStarted = false;
  const reservationRepo = prisma as unknown as DeploymentReservationRepo;
  const dispatchIntent = { action: automation.actionType, repositoryFullName: automation.repositoryFullName, sourceRef: automation.sourceRef, ...(restartReview ? { reviewDigest: restartReview.digest } : {}) };
  const markDispatchIntent = async () => {
    // Persist uncertainty before the non-idempotent request. A process crash
    // leaves the claimed row running, outside the scheduler's retry selection.
    await prisma.airflowAutomationExecution.update({ where: { id: execution.id }, data: { resultJson: { ...dispatchIntent, ...(providerReceipt ?? {}), phase: "dispatching" } } });
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
      if (!restartReview) throw new Error("airflow_review_required");
      const target = restartReview.payload.target;
      const environment = { id: target.environmentId, tier: target.environmentTier };
      const policy = await evaluateDeploymentPolicy(prisma as unknown as DeploymentPolicyRepo, {
      requestedCapability: "legacy_ecs_restart", organizationId: automation.organizationId, environmentId: environment.id, owner: repository.owner, repo: repository.repo, sourceRef: automation.sourceRef, sourceKind: automation.sourceKind === "tag" ? "tag" : "branch", ...(automation.promotedFromExecutionId ? { promotedFromExecutionId: automation.promotedFromExecutionId } : {}), ...(environment.tier === "prod" ? { requiredControlSet: "production" as const } : {}), installationToken: token.token });
      if (!policy.ok) throw new Error(policy.error);
      const reservation = await reserveDeploymentDispatch(reservationRepo, {
        organizationId: automation.organizationId,
        idempotencyKey: `airflow-execution:${execution.id}`,
        environmentId: environment.id,
        repositoryFullName: automation.repositoryFullName!,
        sourceRef: automation.sourceRef,
        sourceKind: automation.sourceKind === "tag" ? "tag" : "branch",
        sourceCommitSha: policy.sourceCommitSha,
        branchPolicyId: policy.policyId,
        promotedFromExecutionId: automation.promotedFromExecutionId ?? null,
        pullRequestUrl: policy.pullRequestUrl ?? null,
        source: "agent",
        triggeredByUserId: approvalActorId ?? automation.createdByUserId,
      });
      if (!reservation.ok) throw new Error(reservation.error);
      if (reservation.reused) {
        await prisma.airflowAutomationExecution.update({ where: { id: execution.id }, data: { deploymentExecutionId: reservation.reservation.id } });
        return await succeed(execution.id, { action: "deploy", evidence: deploymentEvidence("service_restart"), deploymentExecutionId: reservation.reservation.id, workflowUrl: reservation.reservation.workflowUrl, replayed: true });
      }
      reservedDeploymentId = reservation.reservation.id;
      providerReceipt = { action: "deploy", evidence: deploymentEvidence("service_restart"), deploymentExecutionId: reservedDeploymentId };
      finalReviewFenceStarted = true;
      await prisma.$transaction(tx => fenceRestartDispatch(tx, restartReview, execution.attempt + 1, approvalActorId!, { ...dispatchIntent, ...providerReceipt }), { isolationLevel: "Serializable" });
      providerActionStarted = true;
      const dispatched = await dispatchWorkflow({ owner: repository.owner, repo: repository.repo, workflowFile: AWS_ECS_DEPLOY_WORKFLOW_FILENAME, ref: automation.sourceRef, inputs: { role_arn: target.roleArn, region: target.region, cluster: target.ecsCluster, service: target.ecsService }, installationToken: token.token });
      if (!dispatched.ok) throw new Error(dispatched.error);
      providerReceipt = { action: "deploy", evidence: deploymentEvidence("service_restart"), deploymentExecutionId: reservedDeploymentId, workflowRunId: dispatched.data.workflowRunId, workflowUrl: dispatched.data.htmlUrl };
      if (!await settleDeploymentDispatch(reservationRepo, automation.organizationId, reservedDeploymentId, { workflowRunId: dispatched.data.workflowRunId, workflowUrl: dispatched.data.htmlUrl })) throw new Error("deployment_tracking_unavailable");
      await prisma.airflowAutomationExecution.update({ where: { id: execution.id }, data: { deploymentExecutionId: reservedDeploymentId } });
      return await succeed(execution.id, { action: "deploy", evidence: deploymentEvidence("service_restart"), deploymentExecutionId: reservedDeploymentId, workflowUrl: dispatched.data.htmlUrl, rollback: "The bundled restart workflow attempts prior task-definition restoration on stabilization failure; installed workflow contents, image recovery and application health are unverified" });
    }
    throw new Error("unsupported_automation_action");
  } catch (error) {
    // This variable is assigned only for a newly acquired reservation. Never
    // release a reused receipt/unknown hold from an earlier provider attempt.
    let releaseUnconfirmed = false;
    if (reservedDeploymentId && !providerActionStarted) {
      try { releaseUnconfirmed = !await releaseDeploymentDispatch(reservationRepo, automation.organizationId, reservedDeploymentId); }
      catch { releaseUnconfirmed = true; }
    }
    const reviewRefused = finalReviewFenceStarted && !providerActionStarted;
    const message = releaseUnconfirmed ? "airflow_reservation_release_unconfirmed" : providerActionStarted ? "airflow_provider_outcome_unknown" : reviewRefused ? safeReviewError(error) : error instanceof Error ? error.message.split(":")[0] : "automation_execution_failed";
    const attempt = execution.attempt + 1;
    const retry = !providerActionStarted && !releaseUnconfirmed && !reviewRefused && attempt < automation.maxRetries;
    if (reviewRefused && !releaseUnconfirmed) {
      try {
        const restored = await prisma.airflowAutomationExecution.updateMany({ where: { id: execution.id, organizationId: execution.organizationId, status: "running", attempt }, data: { status: "pending_approval", errorCode: message, nextRetryAt: null, completedAt: null } });
        if (restored.count !== 1) return { ok: false, error: "airflow_execution_state_unconfirmed" };
      } catch {
        // No provider request was sent. Do not claim that the rejectable state
        // was saved when storage failed; the durable running claim blocks replay.
        return { ok: false, error: "airflow_execution_state_unconfirmed" };
      }
    } else await prisma.airflowAutomationExecution.update({ where: { id: execution.id }, data: { status: providerActionStarted || releaseUnconfirmed ? "needs_reconciliation" : "failed", errorCode: message, nextRetryAt: retry ? new Date(Date.now() + automation.retryDelaySeconds * 1000) : null, completedAt: providerActionStarted || releaseUnconfirmed || retry ? null : new Date(), ...(providerActionStarted || releaseUnconfirmed ? { resultJson: { ...dispatchIntent, ...(providerReceipt ?? {}), phase: releaseUnconfirmed ? "reservation_release_unconfirmed" : "outcome_unconfirmed" } } : {}) } });
    await appendAuditEvent(prisma as unknown as AuditEventRepo, { organizationId: automation.organizationId, kind: "airflow.automation.failed", subjectKind: "automation", subjectId: execution.id, outcome: "error", summary: providerActionStarted ? `Airflow automation ${automation.name} outcome is unconfirmed; automatic retry paused` : `Airflow automation ${automation.name} failed: ${message}`, actorUserId: actorUserId ?? null });
    if (automation.notifyOnFailure) await dispatchWebhookEvent({ organizationId: automation.organizationId, eventKind: "airflow.automation_failed", data: { automationId: automation.id, automationName: automation.name, executionId: execution.id, error: message, retryScheduled: retry } }).catch(() => undefined);
    return { ok: false, error: message };
  }
}

function safeReviewError(error: unknown): string {
  const allowed = ["airflow_review_storage_unavailable", "airflow_review_required", "airflow_review_changed", "airflow_restart_review_stale"];
  return error instanceof Error && allowed.includes(error.message) ? error.message : "airflow_review_storage_unavailable";
}

async function succeed(executionId: string, result: Record<string, unknown>): Promise<{ ok: true; result: Record<string, unknown> }> {
  const current = await prisma.airflowAutomationExecution.findUniqueOrThrow({ where: { id: executionId }, include: { automation: true } });
  const row = await prisma.airflowAutomationExecution.update({ where: { id: executionId }, data: { status: "succeeded", resultJson: JSON.parse(JSON.stringify(result)), completedAt: new Date(), nextRetryAt: null } });
  await appendAuditEvent(prisma as unknown as AuditEventRepo, { organizationId: row.organizationId, kind: "airflow.automation.succeeded", subjectKind: "automation", subjectId: row.id, summary: `Airflow automation ${current.automation.name} completed its governed action`, actorUserId: row.decidedByUserId });
  if (current.automation.notifyOnSuccess) await dispatchWebhookEvent({ organizationId: row.organizationId, eventKind: "airflow.automation_succeeded", data: { automationId: current.automation.id, automationName: current.automation.name, executionId: row.id, result } }).catch(() => undefined);
  return { ok: true, result };
}

async function currentApprovalAuthorityError(actorUserId: string | null | undefined, organizationId: string): Promise<"airflow_approval_authority_required" | "airflow_approval_authority_unavailable" | null> {
  if (!actorUserId) return null;
  try {
    const membership = await prisma.orgMembership.findUnique({
      where: { userId_organizationId: { userId: actorUserId, organizationId } },
      select: { acceptedAt: true, role: true },
    });
    return membership?.acceptedAt && hasDesktopCapability(membership.role, "agent:approve") ? null : "airflow_approval_authority_required";
  } catch { return "airflow_approval_authority_unavailable"; }
}
