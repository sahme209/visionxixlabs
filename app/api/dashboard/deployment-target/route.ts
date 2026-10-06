/**
 * GET  /api/dashboard/deployment-target?environmentId=...
 * POST /api/dashboard/deployment-target
 * Body: { environmentId, roleArn, region, ecsCluster, ecsService }
 *
 * Admin-only — this configures where real deploys land.
 */

import { NextResponse, type NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { isAdminOrOwner } from "@/lib/auth/platformAdmin";
import { prisma } from "@/lib/db";
import {
  buildDeploymentTargetGetResponse,
  buildDeploymentTargetUpsertResponse,
  type DeploymentTargetRepo,
} from "@/lib/releaseops/deploymentTargetResponder";
import { appendAuditEvent, type AuditEventRepo } from "@/lib/releaseops/auditEventResponder";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId) {
    return NextResponse.json({ ok: false, error: "auth_required" }, { status: 401 });
  }
  const environmentId = req.nextUrl.searchParams.get("environmentId");
  if (!environmentId) {
    return NextResponse.json({ ok: false, error: "invalid_payload", hint: "Query must contain environmentId." }, { status: 400 });
  }
  const r = await buildDeploymentTargetGetResponse(prisma as unknown as DeploymentTargetRepo, ctx.organizationId, environmentId);
  return NextResponse.json(r.body, { status: r.status });
}

export async function POST(req: NextRequest) {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId) {
    return NextResponse.json({ ok: false, error: "auth_required" }, { status: 401 });
  }
  if (!isAdminOrOwner({ email: ctx.email, roles: ctx.roles })) {
    return NextResponse.json({ ok: false, error: "forbidden_role" }, { status: 403 });
  }

  let body: { environmentId?: unknown; roleArn?: unknown; region?: unknown; ecsCluster?: unknown; ecsService?: unknown } = {};
  try { body = await req.json(); } catch { /* fall through */ }

  const environmentId = typeof body.environmentId === "string" ? body.environmentId : null;
  const roleArn = typeof body.roleArn === "string" ? body.roleArn : null;
  const region = typeof body.region === "string" ? body.region : null;
  const ecsCluster = typeof body.ecsCluster === "string" ? body.ecsCluster : null;
  const ecsService = typeof body.ecsService === "string" ? body.ecsService : null;
  if (!environmentId || !roleArn || !region || !ecsCluster || !ecsService) {
    return NextResponse.json(
      { ok: false, error: "invalid_payload", hint: "Body must contain { environmentId, roleArn, region, ecsCluster, ecsService }." },
      { status: 400 },
    );
  }

  const r = await buildDeploymentTargetUpsertResponse(prisma as unknown as DeploymentTargetRepo, {
    organizationId: ctx.organizationId, environmentId, roleArn, region, ecsCluster, ecsService,
  });

  if (r.body.ok) {
    await appendAuditEvent(prisma as unknown as AuditEventRepo, {
      organizationId: ctx.organizationId,
      kind: "environment.deployment_target_set",
      subjectKind: "environment",
      subjectId: environmentId,
      // Role ARN is not a secret (it identifies a role, not a credential) but
      // keep the audit trail to identifiers only, consistent with every
      // other audit entry in this codebase.
      summary: `Set AWS deploy target for environment ${environmentId}: ${ecsCluster}/${ecsService} (${region})`,
      actorUserId: ctx.userId ?? null,
    });
  }
  return NextResponse.json(r.body, { status: r.status });
}
