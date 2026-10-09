/**
 * Read-only deployment readiness check. It resolves the same tenant-scoped
 * GitHub token and runs the same live policy guard as the write route, but
 * never dispatches a workflow or creates a deployment record.
 */

import { NextResponse, type NextRequest } from "next/server";
import { resolveRequestDesktopSession } from "@/lib/desktop/resolveRequestDesktopSession";
import { prisma } from "@/lib/db";
import { parseRepositoryFullName, resolveTenantScopedToken } from "@/lib/connectors/github/resolveTenantScopedToken";
import { evaluateDeploymentPolicy, type DeploymentPolicyRepo } from "@/lib/releaseops/deploymentPolicyGuard";
import { resolveGitReference } from "@/lib/connectors/github/githubWriteClient";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest): Promise<Response> {
  const session = await resolveRequestDesktopSession(request, {
    requiredScope: "pipeline:read",
    route: "POST /api/desktop/environments/deploy/preflight",
    allowApiKey: false,
    requiredCapability: "deploy:execute",
  });
  if (!session) return NextResponse.json({ ok: false, error: "desktop_session_required" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as {
    repositoryFullName?: unknown;
    environmentId?: unknown;
    sourceRef?: unknown;
    sourceKind?: unknown;
    pullRequestNumber?: unknown;
    promotedFromExecutionId?: unknown;
    emergencyBypass?: unknown;
    bypassReason?: unknown;
  } | null;
  const repositoryFullName = typeof body?.repositoryFullName === "string" ? body.repositoryFullName.trim() : "";
  const environmentId = typeof body?.environmentId === "string" ? body.environmentId : "";
  const sourceRef = typeof body?.sourceRef === "string" ? body.sourceRef.trim() : "";
  const sourceKind = body?.sourceKind === "branch" || body?.sourceKind === "tag" ? body.sourceKind : null;
  const pullRequestNumber = typeof body?.pullRequestNumber === "number" ? body.pullRequestNumber : undefined;
  const promotedFromExecutionId = typeof body?.promotedFromExecutionId === "string" ? body.promotedFromExecutionId.trim() || undefined : undefined;
  const emergencyBypass = body?.emergencyBypass === true;
  const bypassReason = typeof body?.bypassReason === "string" ? body.bypassReason.trim() : "";
  if (!repositoryFullName || !environmentId || !sourceRef || !sourceKind
    || (body?.pullRequestNumber !== undefined && (!Number.isInteger(pullRequestNumber) || (pullRequestNumber ?? 0) <= 0))) {
    return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
  }

  const parsed = parseRepositoryFullName(repositoryFullName);
  if (!parsed) return NextResponse.json({ ok: false, error: "invalid_repository_full_name" }, { status: 400 });
  const organizationId = String(session.organizationId);
  const [environment, target] = await Promise.all([
    prisma.environment.findUnique({ where: { id: environmentId } }),
    prisma.deploymentTarget.findUnique({ where: { environmentId } }),
  ]);
  if (!environment || environment.organizationId !== organizationId) {
    return NextResponse.json({ ok: false, error: "environment_not_found" }, { status: 404 });
  }
  if (!target || target.organizationId !== organizationId) {
    return NextResponse.json({ ok: false, error: "deployment_target_not_configured" }, { status: 409 });
  }
  if (emergencyBypass) {
    if (environment.tier !== "prod") {
      return NextResponse.json({ ok: false, error: "production_bypass_only" }, { status: 400 });
    }
    if (!session.capabilities.includes("deploy:production_bypass")) {
      return NextResponse.json({ ok: false, error: "production_bypass_forbidden" }, { status: 403 });
    }
    if (bypassReason.length < 20) {
      return NextResponse.json({ ok: false, error: "production_bypass_reason_required" }, { status: 400 });
    }
  }

  const token = await resolveTenantScopedToken(organizationId, parsed);
  if (!token.ok) return NextResponse.json({ ok: false, error: token.error }, { status: 409 });
  const decision = emergencyBypass
    ? await resolveGitReference({
        owner: parsed.owner,
        repo: parsed.repo,
        ref: sourceRef,
        kind: sourceKind,
        installationToken: token.token,
      }).then((reference) => reference.ok
        ? { ok: true as const, policyId: null, sourceCommitSha: reference.data.commitSha, pullRequestUrl: null }
        : { ok: false as const, error: reference.error })
    : await evaluateDeploymentPolicy(prisma as unknown as DeploymentPolicyRepo, {
        organizationId,
        environmentId,
        owner: parsed.owner,
        repo: parsed.repo,
        sourceRef,
        sourceKind,
        ...(pullRequestNumber !== undefined ? { pullRequestNumber } : {}),
        ...(promotedFromExecutionId ? { promotedFromExecutionId } : {}),
        ...(environment.tier === "prod" ? { requiredControlSet: "production" as const } : {}),
        installationToken: token.token,
      });
  if (!decision.ok) {
    return NextResponse.json({ ok: false, error: decision.error, policyId: decision.policyId ?? null }, { status: 409 });
  }

  return NextResponse.json({
    ok: true,
    data: {
      ready: true,
      policyId: decision.policyId,
      sourceCommitSha: decision.sourceCommitSha,
      pullRequestUrl: decision.pullRequestUrl,
      governanceMode: emergencyBypass ? "emergency_bypass" : "policy_enforced",
    },
  });
}
