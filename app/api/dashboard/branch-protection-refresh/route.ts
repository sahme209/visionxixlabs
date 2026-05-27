/**
 * POST /api/dashboard/branch-protection-refresh — Phase 499.
 * Body: { repositoryId, branchName, payload, source? }
 *
 * Accepts a GitHub branch-protection API payload (paste-in from
 * `gh api repos/:owner/:repo/branches/:branch/protection` while the
 * automated sync job is being built) and persists a normalized
 * snapshot via the pure projector.
 */

import { NextResponse, type NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import {
  buildBranchProtectionRefreshResponse,
  type BranchProtectionRepo,
} from "@/lib/releaseops/branchProtectionResponder";
import { appendAuditEvent, type AuditEventRepo } from "@/lib/releaseops/auditEventResponder";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId) {
    return NextResponse.json({ ok: false, error: "auth_required" }, { status: 401 });
  }
  let body: { repositoryId?: unknown; branchName?: unknown; payload?: unknown; source?: unknown } = {};
  try { body = await req.json(); } catch { /* fall through */ }

  const repositoryId = typeof body.repositoryId === "string" ? body.repositoryId : null;
  const branchName = typeof body.branchName === "string" ? body.branchName : null;
  if (!repositoryId || !branchName) {
    return NextResponse.json(
      { ok: false, error: "invalid_payload", hint: "Body must contain { repositoryId, branchName, payload }." },
      { status: 400 },
    );
  }
  const source = body.source === "github_api" || body.source === "manual" || body.source === "import"
    ? body.source
    : undefined;

  const r = await buildBranchProtectionRefreshResponse(
    prisma as unknown as BranchProtectionRepo,
    {
      organizationId: ctx.organizationId,
      repositoryId, branchName,
      payload: body.payload ?? {},
      ...(source ? { source } : {}),
    },
  );

  if (r.body.ok) {
    await appendAuditEvent(prisma as unknown as AuditEventRepo, {
      organizationId: ctx.organizationId,
      kind: "branch_protection.refresh",
      subjectKind: "repository",
      subjectId: repositoryId,
      summary: `Refreshed ${branchName} branch protection → ${r.body.data.strength}`,
      actorUserId: ctx.userId ?? null,
    });
  }
  return NextResponse.json(r.body, { status: r.status });
}
