/**
 * POST /api/desktop/environments/deploy
 * Body: { repositoryFullName, environmentId, sourceRef?, sourceKind?, pullRequestNumber? }
 *
 * The real deploy trigger, desktop-native: dispatches the tenant's own
 * axiom-deploy-aws-ecs.yml GitHub Actions workflow (see
 * lib/releaseops/awsEcsDeployWorkflowTemplate.ts) via workflow_dispatch,
 * using a token scoped to exactly the given repository. Unlike the
 * dashboard's /api/dashboard/release-deploy, this does not depend on the
 * web-only ReleaseOps Release lifecycle — the desktop app has no concept
 * of that model, so this triggers directly off a repo + environment
 * pair. Admin-only.
 */

import { NextResponse, type NextRequest } from "next/server";
import { resolveRequestDesktopSession } from "@/lib/desktop/resolveRequestDesktopSession";
import { prisma } from "@/lib/db";
import { resolveTenantScopedToken, parseRepositoryFullName } from "@/lib/connectors/github/resolveTenantScopedToken";
import { dispatchWorkflow } from "@/lib/connectors/github/githubWriteClient";
import { AWS_ECS_DEPLOY_WORKFLOW_FILENAME } from "@/lib/releaseops/awsEcsDeployWorkflowTemplate";
import { appendAuditEvent, type AuditEventRepo } from "@/lib/releaseops/auditEventResponder";
import { serializeDeploymentExecution, type DeploymentExecutionRepo } from "@/lib/releaseops/deploymentExecutionResponder";
import { evaluateDeploymentPolicy, type DeploymentPolicyRepo } from "@/lib/releaseops/deploymentPolicyGuard";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest): Promise<Response> {
  const session = await resolveRequestDesktopSession(request, {
    requiredScope: "pipeline:read",
    route: "POST /api/desktop/environments/deploy",
    allowApiKey: false,
    requireWorkspaceAdmin: true,
  });
  if (!session) {
    return NextResponse.json({ ok: false, error: "desktop_session_required" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    repositoryFullName?: unknown;
    environmentId?: unknown;
    sourceRef?: unknown;
    sourceKind?: unknown;
    pullRequestNumber?: unknown;
  } | null;
  const repositoryFullName = typeof body?.repositoryFullName === "string" ? body.repositoryFullName.trim() : "";
  const environmentId = typeof body?.environmentId === "string" ? body.environmentId : "";
  const sourceRef = typeof body?.sourceRef === "string" ? body.sourceRef.trim() : "main";
  const sourceKind = body?.sourceKind === undefined || body.sourceKind === "branch"
    ? "branch"
    : body.sourceKind === "tag" ? "tag" : null;
  const pullRequestNumber = typeof body?.pullRequestNumber === "number" ? body.pullRequestNumber : undefined;
  if (!repositoryFullName || !environmentId || !sourceKind
    || (body?.pullRequestNumber !== undefined && (!Number.isInteger(pullRequestNumber) || (pullRequestNumber ?? 0) <= 0))) {
    return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
  }
  const repo = parseRepositoryFullName(repositoryFullName);
  if (!repo) return NextResponse.json({ ok: false, error: "invalid_repository_full_name" }, { status: 400 });

  const organizationId = String(session.organizationId);

  const environment = await prisma.environment.findUnique({ where: { id: environmentId } });
  if (!environment || environment.organizationId !== organizationId) {
    return NextResponse.json({ ok: false, error: "environment_not_found" }, { status: 404 });
  }

  const target = await prisma.deploymentTarget.findUnique({ where: { environmentId } });
  if (!target || target.organizationId !== organizationId) {
    return NextResponse.json({ ok: false, error: "deployment_target_not_configured" }, { status: 409 });
  }

  const tokenResult = await resolveTenantScopedToken(organizationId, repo);
  if (!tokenResult.ok) {
    return NextResponse.json({ ok: false, error: tokenResult.error }, { status: 409 });
  }

  const policy = await evaluateDeploymentPolicy(prisma as unknown as DeploymentPolicyRepo, {
    organizationId,
    environmentId,
    owner: repo.owner,
    repo: repo.repo,
    sourceRef,
    sourceKind,
    ...(pullRequestNumber !== undefined ? { pullRequestNumber } : {}),
    installationToken: tokenResult.token,
  });
  if (!policy.ok) {
    return NextResponse.json({ ok: false, error: policy.error, policyId: policy.policyId ?? null }, { status: 409 });
  }

  const dispatchResult = await dispatchWorkflow({
    owner: repo.owner,
    repo: repo.repo,
    workflowFile: AWS_ECS_DEPLOY_WORKFLOW_FILENAME,
    ref: sourceRef,
    inputs: {
      role_arn: target.roleArn,
      region: target.region,
      cluster: target.ecsCluster,
      service: target.ecsService,
    },
    installationToken: tokenResult.token,
  });
  if (!dispatchResult.ok) {
    return NextResponse.json({ ok: false, error: "dispatch_failed", hint: dispatchResult.error }, { status: 502 });
  }

  let execution = null;
  try {
    const executionRepo = prisma as unknown as DeploymentExecutionRepo;
    const created = await executionRepo.deploymentExecution.create({
      data: {
        organizationId,
        environmentId,
        repositoryFullName,
        workflowRunId: dispatchResult.data.workflowRunId,
        workflowUrl: dispatchResult.data.htmlUrl,
        source: "desktop",
        triggeredByUserId: String(session.userId),
        status: dispatchResult.data.workflowRunId ? "queued" : "tracking_unavailable",
      },
    });
    execution = serializeDeploymentExecution(created);
  } catch { /* the external dispatch happened; report tracking loss honestly */ }

  try {
    await appendAuditEvent(prisma as unknown as AuditEventRepo, {
      organizationId,
      kind: "release.deploy_triggered",
      subjectKind: "environment",
      subjectId: environmentId,
      summary: `Dispatched AWS ECS deploy from desktop for ${repositoryFullName}@${sourceRef} → ${target.ecsCluster}/${target.ecsService} (${target.region})${policy.policyId ? ` under branch policy ${policy.policyId}` : ""}${execution ? " with live observation" : " without durable observation"}`,
      actorUserId: String(session.userId),
    });
  } catch { /* best-effort */ }

  return NextResponse.json({
    ok: true,
    data: {
      dispatched: true,
      execution,
      trackingAvailable: Boolean(execution && dispatchResult.data.workflowRunId),
      policyId: policy.policyId,
      sourceRef,
      sourceKind,
    },
  });
}
