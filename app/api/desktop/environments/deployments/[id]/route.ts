import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { resolveRequestDesktopSession } from "@/lib/desktop/resolveRequestDesktopSession";
import { parseRepositoryFullName, resolveTenantScopedToken } from "@/lib/connectors/github/resolveTenantScopedToken";
import { getWorkflowRun } from "@/lib/connectors/github/githubWriteClient";
import { serializeDeploymentExecution, type DeploymentExecutionRepo } from "@/lib/releaseops/deploymentExecutionResponder";
import { appendAuditEvent, type AuditEventRepo } from "@/lib/releaseops/auditEventResponder";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const session = await resolveRequestDesktopSession(request, {
    requiredScope: "pipeline:read",
    route: "GET /api/desktop/environments/deployments/:id",
    allowApiKey: false,
  });
  if (!session) return NextResponse.json({ ok: false, error: "desktop_session_required" }, { status: 401 });

  const { id } = await params;
  const organizationId = String(session.organizationId);
  const repo = prisma as unknown as DeploymentExecutionRepo;
  const execution = await repo.deploymentExecution.findFirst({ where: { id, organizationId } });
  if (!execution) return NextResponse.json({ ok: false, error: "deployment_execution_not_found" }, { status: 404 });
  if (!execution.workflowRunId) {
    return NextResponse.json({ ok: true, data: serializeDeploymentExecution(execution) });
  }

  const repository = parseRepositoryFullName(execution.repositoryFullName);
  if (!repository) return NextResponse.json({ ok: false, error: "deployment_repository_invalid" }, { status: 422 });
  const token = await resolveTenantScopedToken(organizationId, repository);
  if (!token.ok) return NextResponse.json({ ok: false, error: token.error }, { status: 409 });
  const observed = await getWorkflowRun({
    owner: repository.owner,
    repo: repository.repo,
    workflowRunId: execution.workflowRunId,
    installationToken: token.token,
  });
  if (!observed.ok) return NextResponse.json({ ok: false, error: "deployment_observation_failed" }, { status: 502 });

  const completedAt = observed.data.status === "completed" ? new Date(observed.data.updatedAt) : null;
  await repo.deploymentExecution.updateMany({
    where: { id, organizationId },
    data: {
      status: observed.data.status,
      conclusion: observed.data.conclusion,
      rollbackStatus: observed.data.rollback,
      workflowUrl: observed.data.htmlUrl,
      lastObservedAt: new Date(),
      completedAt,
    },
  });
  if (
    execution.status !== observed.data.status
    || execution.conclusion !== observed.data.conclusion
    || execution.rollbackStatus !== observed.data.rollback
  ) {
    try {
      await appendAuditEvent(prisma as unknown as AuditEventRepo, {
        organizationId,
        kind: observed.data.status === "completed" ? "release.deploy_completed" : "release.deploy_observed",
        subjectKind: "deployment_execution",
        subjectId: execution.id,
        outcome: observed.data.conclusion === "success" ? "ok" : observed.data.conclusion ? "error" : "ok",
        summary: observed.data.status === "completed"
          ? `Deployment ${observed.data.conclusion ?? "completed"}; rollback ${observed.data.rollback}.`
          : `Deployment is ${observed.data.status}; rollback ${observed.data.rollback}.`,
        actorUserId: String(session.userId),
        correlationId: request.headers.get("x-correlation-id"),
        detailJson: {
          repositoryFullName: execution.repositoryFullName,
          environmentId: execution.environmentId,
          workflowRunId: execution.workflowRunId,
          workflowUrl: observed.data.htmlUrl,
        },
      });
    } catch { /* observation remains available even if secondary audit storage is unavailable */ }
  }
  const refreshed: typeof execution = {
    ...execution,
    status: observed.data.status,
    conclusion: observed.data.conclusion,
    rollbackStatus: observed.data.rollback,
    workflowUrl: observed.data.htmlUrl,
    lastObservedAt: new Date(),
    completedAt,
  };
  return NextResponse.json({ ok: true, data: serializeDeploymentExecution(refreshed) });
}
