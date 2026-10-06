/**
 * POST /api/dashboard/release-deploy
 * Body: { releaseId }
 *
 * The real deploy trigger: dispatches the tenant's own
 * axiom-deploy-aws-ecs.yml GitHub Actions workflow (see
 * lib/releaseops/awsEcsDeployWorkflowTemplate.ts — the tenant adds this
 * file to their repo once) via workflow_dispatch, using a token scoped
 * to exactly the release's bound repository. On a successful dispatch,
 * transitions the release to "deploying" by reusing the existing
 * release-lifecycle state machine — this route never re-implements that
 * transition logic.
 *
 * Requires, in order: the release has a bound evidence repository
 * (release-create's repositoryId) and a bound target environment
 * (release-create's environmentId), that environment has a configured
 * DeploymentTarget (see /api/dashboard/deployment-target), and the
 * tenant has an active GitHub App installation covering that repo.
 * Admin-only — triggering a real deploy is a high-stakes action.
 */

import { NextResponse, type NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { isAdminOrOwner } from "@/lib/auth/platformAdmin";
import { prisma } from "@/lib/db";
import { resolveTenantScopedToken } from "@/lib/connectors/github/resolveTenantScopedToken";
import { dispatchWorkflow } from "@/lib/connectors/github/githubWriteClient";
import { AWS_ECS_DEPLOY_WORKFLOW_FILENAME } from "@/lib/releaseops/awsEcsDeployWorkflowTemplate";
import { buildReleaseLifecycleResponse, type ReleaseLifecycleRepo } from "@/lib/releaseops/releaseLifecycleResponder";
import { appendAuditEvent, type AuditEventRepo } from "@/lib/releaseops/auditEventResponder";

export const dynamic = "force-dynamic";

interface ReleaseForDeploy {
  id: string;
  organizationId: string;
  status: string;
  releaseTag: string | null;
  commitSha: string | null;
  evidenceRepositoryId: string | null;
  targetEnvironmentId: string | null;
}

export async function POST(req: NextRequest) {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId || !ctx.userId) {
    return NextResponse.json({ ok: false, error: "auth_required" }, { status: 401 });
  }
  if (!isAdminOrOwner({ email: ctx.email, roles: ctx.roles })) {
    return NextResponse.json({ ok: false, error: "forbidden_role" }, { status: 403 });
  }

  let body: { releaseId?: unknown } = {};
  try { body = await req.json(); } catch { /* fall through */ }
  const releaseId = typeof body.releaseId === "string" ? body.releaseId : null;
  if (!releaseId) {
    return NextResponse.json({ ok: false, error: "invalid_payload", hint: "Body must contain { releaseId }." }, { status: 400 });
  }

  const release = (await prisma.release.findUnique({ where: { id: releaseId } })) as ReleaseForDeploy | null;
  if (!release || release.organizationId !== ctx.organizationId) {
    return NextResponse.json({ ok: false, error: "release_not_found" }, { status: 404 });
  }
  if (!release.evidenceRepositoryId) {
    return NextResponse.json({ ok: false, error: "release_missing_repository", hint: "Bind an evidence repository on this release first." }, { status: 409 });
  }
  if (!release.targetEnvironmentId) {
    return NextResponse.json({ ok: false, error: "release_missing_environment", hint: "Bind a target environment on this release first." }, { status: 409 });
  }

  const repository = await prisma.repository.findUnique({ where: { id: release.evidenceRepositoryId } });
  if (!repository || repository.organizationId !== ctx.organizationId) {
    return NextResponse.json({ ok: false, error: "repository_not_found" }, { status: 404 });
  }
  if (repository.provider !== "github") {
    return NextResponse.json({ ok: false, error: "repository_not_github", hint: "Deploy dispatch supports GitHub repositories only today." }, { status: 422 });
  }

  const target = await prisma.deploymentTarget.findUnique({ where: { environmentId: release.targetEnvironmentId } });
  if (!target || target.organizationId !== ctx.organizationId) {
    return NextResponse.json({ ok: false, error: "deployment_target_not_configured", hint: "Configure an AWS deploy target for this environment first." }, { status: 409 });
  }

  const tokenResult = await resolveTenantScopedToken(ctx.organizationId, { owner: repository.remoteOwner, repo: repository.remoteName });
  if (!tokenResult.ok) {
    return NextResponse.json({ ok: false, error: tokenResult.error }, { status: 409 });
  }

  const dispatchResult = await dispatchWorkflow({
    owner: repository.remoteOwner,
    repo: repository.remoteName,
    workflowFile: AWS_ECS_DEPLOY_WORKFLOW_FILENAME,
    ref: release.commitSha ?? repository.defaultBranch,
    inputs: {
      role_arn: target.roleArn,
      region: target.region,
      cluster: target.ecsCluster,
      service: target.ecsService,
    },
    installationToken: tokenResult.token,
  });
  if (!dispatchResult.ok) {
    return NextResponse.json(
      { ok: false, error: "dispatch_failed", hint: dispatchResult.error },
      { status: 502 },
    );
  }

  const lifecycle = await buildReleaseLifecycleResponse(prisma as unknown as ReleaseLifecycleRepo, {
    organizationId: ctx.organizationId,
    actorUserId: ctx.userId,
    releaseId: release.id,
    action: "start_deploy",
  });

  try {
    await appendAuditEvent(prisma as unknown as AuditEventRepo, {
      organizationId: ctx.organizationId,
      kind: "release.deploy_triggered",
      subjectKind: "release",
      subjectId: release.id,
      summary: `Dispatched AWS ECS deploy for ${release.releaseTag ?? release.id} → ${target.ecsCluster}/${target.ecsService} (${target.region})`,
      actorUserId: ctx.userId,
    });
  } catch { /* best-effort */ }

  if (!lifecycle.body.ok) {
    // The real deploy was already dispatched on GitHub's side — surface this
    // distinctly so the operator knows the DB status didn't flip to
    // "deploying" even though the workflow run is live. Not a dispatch
    // failure; the release just wasn't in the "ready" state.
    return NextResponse.json(
      { ok: false, error: "dispatched_but_lifecycle_transition_failed", hint: `Workflow dispatched, but release status could not move to "deploying": ${lifecycle.body.error}.` },
      { status: 207 },
    );
  }

  return NextResponse.json({ ok: true, data: { releaseId: release.id, status: lifecycle.body.data.status } });
}
