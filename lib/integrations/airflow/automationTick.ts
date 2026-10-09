import "server-only";

import { prisma } from "@/lib/db";
import { loadAirflowClient } from "./connection";
import { nextCronOccurrence } from "./schedule";
import { executeAirflowAutomation } from "./automationExecutor";
import { dispatchWebhookEvent } from "@/lib/webhooks/dispatchWebhookEvent";
import { parseRepositoryFullName, resolveTenantScopedToken } from "@/lib/connectors/github/resolveTenantScopedToken";
import { getWorkflowRun } from "@/lib/connectors/github/githubWriteClient";
import { appendAuditEvent, type AuditEventRepo } from "@/lib/releaseops/auditEventResponder";

const TERMINAL_STATES = new Set(["success", "failed"]);

export async function runAirflowAutomationTick(now = new Date()): Promise<{ organizations: number; rules: number; proposals: number; actions: number; errors: number }> {
  const organizations = await prisma.airflowAutomation.groupBy({ by: ["organizationId"], where: { enabled: true } });
  const totals = { organizations: organizations.length, rules: 0, proposals: 0, actions: 0, errors: 0 };
  for (const group of organizations) {
    try {
      const { client, connectionId } = await loadAirflowClient(group.organizationId);
      const rules = await prisma.airflowAutomation.findMany({ where: { organizationId: group.organizationId, enabled: true }, orderBy: { createdAt: "asc" } });
      totals.rules += rules.length;
      for (const rule of rules) {
        try {
          if (rule.triggerMode === "schedule" && rule.scheduleCron && (!rule.nextScheduledAt || rule.nextScheduledAt <= now)) {
            const triggered = await client.triggerDag(rule.dagId, { axiom_automation_id: rule.id });
            await persistRun(group.organizationId, connectionId, triggered);
            await prisma.airflowAutomation.update({ where: { id: rule.id }, data: { nextScheduledAt: nextCronOccurrence(rule.scheduleCron, now), lastEvaluatedAt: now } });
          }
          const runs = await client.listDagRuns(rule.dagId, 50);
          for (const run of runs) await persistRun(group.organizationId, connectionId, run);
          const candidates = runs.filter((run) => TERMINAL_STATES.has(run.state) && (!run.logicalDate || new Date(run.logicalDate) >= rule.createdAt) && (rule.requiredDagState === "any" || rule.requiredDagState === run.state));
          for (const run of candidates) {
            const dependenciesReady = await dependencyCheck(client, rule.dependencyDagIds, run.logicalDate);
            if (!dependenciesReady) continue;
            const existing = await prisma.airflowAutomationExecution.findUnique({ where: { automationId_sourceDagRunId: { automationId: rule.id, sourceDagRunId: run.dagRunId } }, select: { id: true } });
            if (existing) continue;
            const status = rule.actionType === "none" ? "queued" : rule.approvalRequired ? "pending_approval" : "queued";
            const execution = await prisma.airflowAutomationExecution.create({ data: { organizationId: group.organizationId, automationId: rule.id, sourceDagId: run.dagId, sourceDagRunId: run.dagRunId, sourceDagState: run.state, status } });
            totals.proposals += 1;
            await appendAuditEvent(prisma as unknown as AuditEventRepo, { organizationId: group.organizationId, kind: "airflow.action.proposed", subjectKind: "automation", subjectId: execution.id, summary: `Airflow automation ${rule.name} proposed ${rule.actionType.replaceAll("_", " ")} after ${run.dagId}`, actorUserId: null, detailJson: { dagId: run.dagId, dagRunId: run.dagRunId, actionType: rule.actionType, approvalRequired: rule.approvalRequired } });
            await dispatchWebhookEvent({ organizationId: group.organizationId, eventKind: "airflow.action_proposed", data: { automationId: rule.id, automationName: rule.name, executionId: execution.id, dagId: run.dagId, dagRunId: run.dagRunId, actionType: rule.actionType, approvalRequired: rule.approvalRequired }, fireImmediately: true }).catch(() => undefined);
            if (!rule.approvalRequired || rule.actionType === "none") { await executeAirflowAutomation(execution.id); totals.actions += 1; }
          }
          await prisma.airflowAutomation.update({ where: { id: rule.id }, data: { lastEvaluatedAt: now } });
        } catch { totals.errors += 1; }
      }
      const retries = await prisma.airflowAutomationExecution.findMany({ where: { organizationId: group.organizationId, status: "failed", nextRetryAt: { lte: now } }, select: { id: true, decidedByUserId: true } });
      for (const retry of retries) { await executeAirflowAutomation(retry.id, retry.decidedByUserId ?? undefined); totals.actions += 1; }
      await reconcileDeployments(group.organizationId);
    } catch { totals.errors += 1; }
  }
  return totals;
}

async function reconcileDeployments(organizationId: string): Promise<void> {
  const linked = await prisma.airflowAutomationExecution.findMany({ where: { organizationId, deploymentExecutionId: { not: null }, status: "succeeded" }, select: { id: true, deploymentExecutionId: true } });
  for (const item of linked) {
    const deployment = await prisma.deploymentExecution.findFirst({ where: { id: item.deploymentExecutionId!, organizationId } });
    if (!deployment?.workflowRunId || deployment.status === "completed") {
      if (deployment?.status === "completed") await prisma.airflowAutomationExecution.update({ where: { id: item.id }, data: { rollbackStatus: deployment.rollbackStatus, status: deployment.rollbackStatus === "succeeded" ? "rolled_back" : deployment.conclusion === "success" ? "succeeded" : "failed" } });
      continue;
    }
    const repository = parseRepositoryFullName(deployment.repositoryFullName);
    if (!repository) continue;
    const token = await resolveTenantScopedToken(organizationId, repository);
    if (!token.ok) continue;
    const observed = await getWorkflowRun({ owner: repository.owner, repo: repository.repo, workflowRunId: deployment.workflowRunId, installationToken: token.token });
    if (!observed.ok) continue;
    await prisma.deploymentExecution.update({ where: { id: deployment.id }, data: { status: observed.data.status, conclusion: observed.data.conclusion, rollbackStatus: observed.data.rollback, workflowUrl: observed.data.htmlUrl, lastObservedAt: new Date(), completedAt: observed.data.status === "completed" ? new Date(observed.data.updatedAt) : null } });
    if (observed.data.status === "completed") await prisma.airflowAutomationExecution.update({ where: { id: item.id }, data: { rollbackStatus: observed.data.rollback, status: observed.data.rollback === "succeeded" ? "rolled_back" : observed.data.conclusion === "success" ? "succeeded" : "failed", completedAt: new Date(observed.data.updatedAt) } });
  }
}

async function dependencyCheck(client: Awaited<ReturnType<typeof loadAirflowClient>>["client"], dependencyDagIds: string[], sourceLogicalDate: string | null): Promise<boolean> {
  for (const dagId of dependencyDagIds) {
    const [latest] = await client.listDagRuns(dagId, 1);
    if (!latest || latest.state !== "success" || (sourceLogicalDate && (!latest.logicalDate || new Date(latest.logicalDate) < new Date(sourceLogicalDate)))) return false;
  }
  return true;
}

async function persistRun(organizationId: string, connectionId: string, run: { dagId: string; dagRunId: string; state: string; logicalDate: string | null; startedAt: string | null; endedAt: string | null }): Promise<void> {
  const date = (value: string | null) => value ? new Date(value) : null;
  await prisma.airflowDagRunSnapshot.upsert({ where: { connectionId_dagId_dagRunId: { connectionId, dagId: run.dagId, dagRunId: run.dagRunId } }, create: { organizationId, connectionId, dagId: run.dagId, dagRunId: run.dagRunId, state: run.state, logicalDate: date(run.logicalDate), startedAt: date(run.startedAt), endedAt: date(run.endedAt) }, update: { state: run.state, logicalDate: date(run.logicalDate), startedAt: date(run.startedAt), endedAt: date(run.endedAt), lastSeenAt: new Date() } });
}
