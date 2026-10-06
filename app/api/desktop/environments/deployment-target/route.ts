/**
 * GET  /api/desktop/environments/deployment-target?environmentId=...
 * POST /api/desktop/environments/deployment-target
 * Body (POST): { environmentId, roleArn, region, ecsCluster, ecsService }
 *
 * Desktop-session equivalent of /api/dashboard/deployment-target.
 * Admin-only — configures where real deploys land.
 */

import { NextResponse, type NextRequest } from "next/server";
import { resolveRequestDesktopSession } from "@/lib/desktop/resolveRequestDesktopSession";
import { prisma } from "@/lib/db";
import {
  buildDeploymentTargetGetResponse,
  buildDeploymentTargetUpsertResponse,
  type DeploymentTargetRepo,
} from "@/lib/releaseops/deploymentTargetResponder";
import { appendAuditEvent, type AuditEventRepo } from "@/lib/releaseops/auditEventResponder";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest): Promise<Response> {
  const session = await resolveRequestDesktopSession(request, {
    requiredScope: "pipeline:read",
    route: "GET /api/desktop/environments/deployment-target",
    allowApiKey: false,
  });
  if (!session) {
    return NextResponse.json({ ok: false, error: "desktop_session_required" }, { status: 401 });
  }
  const environmentId = request.nextUrl.searchParams.get("environmentId");
  if (!environmentId) {
    return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
  }
  const r = await buildDeploymentTargetGetResponse(prisma as unknown as DeploymentTargetRepo, String(session.organizationId), environmentId);
  return NextResponse.json(r.body, { status: r.status });
}

export async function POST(request: NextRequest): Promise<Response> {
  const session = await resolveRequestDesktopSession(request, {
    requiredScope: "pipeline:read",
    route: "POST /api/desktop/environments/deployment-target",
    allowApiKey: false,
    requireWorkspaceAdmin: true,
  });
  if (!session) {
    return NextResponse.json({ ok: false, error: "desktop_session_required" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    environmentId?: unknown; roleArn?: unknown; region?: unknown; ecsCluster?: unknown; ecsService?: unknown;
  } | null;
  const environmentId = typeof body?.environmentId === "string" ? body.environmentId : null;
  const roleArn = typeof body?.roleArn === "string" ? body.roleArn : null;
  const region = typeof body?.region === "string" ? body.region : null;
  const ecsCluster = typeof body?.ecsCluster === "string" ? body.ecsCluster : null;
  const ecsService = typeof body?.ecsService === "string" ? body.ecsService : null;
  if (!environmentId || !roleArn || !region || !ecsCluster || !ecsService) {
    return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
  }

  const r = await buildDeploymentTargetUpsertResponse(prisma as unknown as DeploymentTargetRepo, {
    organizationId: String(session.organizationId), environmentId, roleArn, region, ecsCluster, ecsService,
  });

  if (r.body.ok) {
    try {
      await appendAuditEvent(prisma as unknown as AuditEventRepo, {
        organizationId: String(session.organizationId),
        kind: "environment.deployment_target_set",
        subjectKind: "environment",
        subjectId: environmentId,
        summary: `Set AWS deploy target for environment ${environmentId} from desktop: ${ecsCluster}/${ecsService} (${region})`,
        actorUserId: String(session.userId),
      });
    } catch { /* best-effort */ }
  }
  return NextResponse.json(r.body, { status: r.status });
}
