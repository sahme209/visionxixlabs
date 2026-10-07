/**
 * GET  /api/desktop/branch-policies
 * POST /api/desktop/branch-policies
 * Body (POST): { repositoryId, environmentId, branchPattern, requireReleaseTag?, requireCodeowners?, requirePrLink?, requireChangeTicket?, priority? }
 *
 * Config management only — see lib/releaseops/branchEnvironmentPolicyResponder.ts's
 * header comment. Nothing in the deploy-trigger path enforces these yet.
 * Admin-gated — tenant-wide configuration.
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
    requireWorkspaceAdmin: true,
  });
  if (!session) {
    return NextResponse.json({ ok: false, error: "desktop_session_required" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    repositoryId?: unknown; environmentId?: unknown; branchPattern?: unknown;
    requireReleaseTag?: unknown; requireCodeowners?: unknown; requirePrLink?: unknown; requireChangeTicket?: unknown; priority?: unknown;
  } | null;
  const repositoryId = typeof body?.repositoryId === "string" ? body.repositoryId : null;
  const environmentId = typeof body?.environmentId === "string" ? body.environmentId : null;
  const branchPattern = typeof body?.branchPattern === "string" ? body.branchPattern : null;
  if (!repositoryId || !environmentId || !branchPattern) {
    return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
  }

  const r = await buildBranchEnvironmentPolicyCreateResponse(prisma as unknown as BranchEnvironmentPolicyRepo, {
    organizationId: String(session.organizationId),
    repositoryId, environmentId, branchPattern,
    requireReleaseTag: body?.requireReleaseTag === true,
    requireCodeowners: body?.requireCodeowners === true,
    requirePrLink: body?.requirePrLink === true,
    requireChangeTicket: body?.requireChangeTicket === true,
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
