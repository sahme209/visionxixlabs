/**
 * POST /api/dashboard/github-installation-transition — Phase 502.
 * Body: { installationRowId, action: "suspend" | "revoke" | "reactivate" }
 */

import { NextResponse, type NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { isAdminOrOwner } from "@/lib/auth/platformAdmin";
import { prisma } from "@/lib/db";
import {
  buildInstallationTransitionResponse,
  type GitHubInstallationRepo,
  INSTALL_TRANSITIONS,
  type InstallTransition,
} from "@/lib/releaseops/githubInstallationResponder";
import { appendAuditEvent, type AuditEventRepo } from "@/lib/releaseops/auditEventResponder";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId || !ctx.userId) {
    return NextResponse.json({ ok: false, error: "auth_required" }, { status: 401 });
  }
  if (!isAdminOrOwner({ email: ctx.email, roles: ctx.roles })) {
    return NextResponse.json({ ok: false, error: "workspace_owner_required" }, { status: 403 });
  }
  let body: { installationRowId?: unknown; action?: unknown } = {};
  try { body = await req.json(); } catch { /* fall through */ }

  const installationRowId = typeof body.installationRowId === "string" ? body.installationRowId : null;
  const action = typeof body.action === "string" ? body.action : null;
  const validAction = action && (INSTALL_TRANSITIONS as readonly string[]).includes(action);
  if (!installationRowId || !validAction) {
    return NextResponse.json(
      { ok: false, error: "invalid_payload", hint: "Body must contain { installationRowId, action: 'suspend'|'revoke'|'reactivate' }." },
      { status: 400 },
    );
  }
  const r = await buildInstallationTransitionResponse(
    prisma as unknown as GitHubInstallationRepo,
    {
      organizationId: ctx.organizationId,
      installationRowId,
      action: action as InstallTransition,
    },
  );

  if (r.body.ok) {
    await appendAuditEvent(prisma as unknown as AuditEventRepo, {
      organizationId: ctx.organizationId,
      kind: `github_installation.${action}`,
      subjectKind: "repository",
      subjectId: r.body.data.id,
      summary: `GitHub installation ${r.body.data.previousStatus} → ${r.body.data.status}`,
      actorUserId: ctx.userId,
    });
  }
  return NextResponse.json(r.body, { status: r.status });
}
