/**
 * GET  /api/desktop/branch-policies
 * POST /api/desktop/branch-policies
 * Body (POST): { repositoryId, environmentId, branchPattern, requireReleaseTag?, requireCodeowners?, requirePrLink?, requireChangeTicket?, requirePromotionFromEnvironmentId?, requireTestsPassing?, priority? }
 *
 * Admin-gated tenant-wide configuration. Both deployment entry points
 * enforce these rows through lib/releaseops/deploymentPolicyGuard.ts.
 */

import { NextResponse, type NextRequest } from "next/server";
import { resolveRequestDesktopSession } from "@/lib/desktop/resolveRequestDesktopSession";
import { prisma } from "@/lib/db";
import {
  buildBranchEnvironmentPolicyListResponse,
  buildBranchEnvironmentPolicyCreateResponse,
  type BranchEnvironmentPolicyRepo,
} from "@/lib/releaseops/branchEnvironmentPolicyResponder";
import { appendAuditEvent, type AuditEventRepo } from "@/lib/releaseops/auditEventResponder";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest): Promise<Response> {
  const session = await resolveRequestDesktopSession(request, {
    requiredScope: "pipeline:read",
    route: "GET /api/desktop/branch-policies",
    allowApiKey: false,
  });
  if (!session) {
    return NextResponse.json({ ok: false, error: "desktop_session_required" }, { status: 401 });
  }
  const r = await buildBranchEnvironmentPolicyListResponse(prisma as unknown as BranchEnvironmentPolicyRepo, String(session.organizationId));
  return NextResponse.json(r.body, { status: r.status });
}

export async function POST(request: NextRequest): Promise<Response> {
  const session = await resolveRequestDesktopSession(request, {
    requiredScope: "pipeline:read",
    route: "POST /api/desktop/branch-policies",
    allowApiKey: false,
    requiredCapability: "policy:manage",
  });
  if (!session) {
    return NextResponse.json({ ok: false, error: "desktop_session_required" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    repositoryId?: unknown; environmentId?: unknown; branchPattern?: unknown;
    requireReleaseTag?: unknown; requireCodeowners?: unknown; requirePrLink?: unknown; requireChangeTicket?: unknown;
    requirePromotionFromEnvironmentId?: unknown; requireTestsPassing?: unknown; priority?: unknown;
  } | null;
  const repositoryId = typeof body?.repositoryId === "string" ? body.repositoryId : null;
  const environmentId = typeof body?.environmentId === "string" ? body.environmentId : null;
  const branchPattern = typeof body?.branchPattern === "string" ? body.branchPattern : null;
  if (!repositoryId || !environmentId || !branchPattern) {
    return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
  }
  const environment = await prisma.environment.findUnique({
    where: { id: environmentId },
    select: { tier: true, organizationId: true },
  });
  if (!environment || environment.organizationId !== String(session.organizationId)) {
    return NextResponse.json({ ok: false, error: "environment_not_found" }, { status: 404 });
  }
  if (environment.tier === "prod" && (
    body?.requirePrLink !== true
    || body?.requireTestsPassing !== true
    || typeof body?.requirePromotionFromEnvironmentId !== "string"
    || !body.requirePromotionFromEnvironmentId
  )) {
    return NextResponse.json({ ok: false, error: "production_policy_controls_required" }, { status: 409 });
  }

  const r = await buildBranchEnvironmentPolicyCreateResponse(prisma as unknown as BranchEnvironmentPolicyRepo, {
    organizationId: String(session.organizationId),
    repositoryId, environmentId, branchPattern,
    requireReleaseTag: body?.requireReleaseTag === true,
    requireCodeowners: body?.requireCodeowners === true,
    requirePrLink: body?.requirePrLink === true,
    requireChangeTicket: body?.requireChangeTicket === true,
    requireTestsPassing: body?.requireTestsPassing === true,
    ...(typeof body?.requirePromotionFromEnvironmentId === "string" ? { requirePromotionFromEnvironmentId: body.requirePromotionFromEnvironmentId } : {}),
    ...(typeof body?.priority === "number" ? { priority: body.priority } : {}),
  });

  if (r.body.ok) {
    try {
      await appendAuditEvent(prisma as unknown as AuditEventRepo, {
        organizationId: String(session.organizationId),
        kind: "branch_validation.policy_created",
        subjectKind: "branch_validation",
        subjectId: r.body.data.id,
        summary: `Created branch policy "${branchPattern}" from desktop`,
        actorUserId: String(session.userId),
      });
    } catch { /* best-effort */ }
  }
  return NextResponse.json(r.body, { status: r.status });
}
