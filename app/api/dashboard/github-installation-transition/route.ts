/**
 * POST /api/dashboard/github-installation-transition — Phase 502.
 * Body: { installationRowId, action: "suspend" | "revoke" | "reactivate" }
 */

import { NextResponse, type NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { isAdminOrOwner } from "@/lib/auth/platformAdmin";
import { isSameOriginRequest } from "@/lib/auth/requestOrigin";
import { prisma } from "@/lib/db";
import {
  buildInstallationTransitionResponse,
  type GitHubInstallationRepo,
  INSTALL_TRANSITIONS,
  type InstallTransition,
} from "@/lib/releaseops/githubInstallationResponder";
import { appendAuditEvent, type AuditEventRepo } from "@/lib/releaseops/auditEventResponder";
import { purgeInstallationTokenCache } from "@/lib/connectors/github/githubAppAuth";
import { record as recordAudit } from "@/lib/audit/secureAudit";
import { newCorrelationId } from "@/lib/domain/ids";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!isSameOriginRequest(req)) {
    return NextResponse.json({ ok: false, error: "invalid_request_origin" }, { status: 403 });
  }
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

    if (action === "revoke" || action === "suspend") {
      // A cached installation token stays usable for up to ~1h past a
      // status change otherwise — purge immediately so "revoked"/
      // "suspended" takes effect on the next API call, not after the
      // cache's own refresh window.
      try {
        const row = await prisma.gitHubInstallation.findUnique({
          where: { id: r.body.data.id },
          select: { githubInstallationId: true },
        });
        const numericId = row ? Number(row.githubInstallationId) : NaN;
        if (Number.isSafeInteger(numericId)) purgeInstallationTokenCache(numericId);
      } catch (err) {
        console.error("[github-installation-transition] token cache purge failed:", err);
      }
    }

    if (action === "revoke") {
      // Dual-write into the canonical secureAudit taxonomy (the GitHub
      // lifecycle otherwise only writes to the parallel AuditEvent table
      // above, invisible to auditIntelligence.ts and the rest of the
      // platform's security-audit tooling).
      try {
        await recordAudit({
          organizationId: ctx.organizationId,
          actorUserId: ctx.userId,
          actorKind: "user",
          action: "connector.disconnect",
          outcome: "success",
          entityRef: `github_installation:${r.body.data.id}`,
          correlationId: newCorrelationId(),
          source: "live",
          detail: { provider: "github" },
        });
      } catch (err) {
        console.error("[github-installation-transition] canonical audit record failed (best-effort):", err);
      }
    }
  }
  return NextResponse.json(r.body, { status: r.status });
}
