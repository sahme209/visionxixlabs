/**
 * POST /api/desktop/github/branch
 *
 * Creates a new branch in a tenant-connected GitHub repository, pointing
 * at the current tip of an existing base branch. Requires a real paired
 * desktop session held by a workspace owner/admin — not an automation
 * API key — same gate as every other shared-integration-state change in
 * this codebase.
 */

import { NextResponse, type NextRequest } from "next/server";
import { resolveRequestDesktopSession } from "@/lib/desktop/resolveRequestDesktopSession";
import { resolveTenantScopedToken, parseRepositoryFullName } from "@/lib/connectors/github/resolveTenantScopedToken";
import { createBranch } from "@/lib/connectors/github/githubWriteClient";
import { record as recordAudit } from "@/lib/audit/secureAudit";
import { id as idFactory } from "@/lib/domain/ids";

import { prisma } from "@/lib/db";
import { assertNoGovernanceEnrollmentForMutation } from "@/lib/governance/intelligence/enrollmentMetadata";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest): Promise<Response> {
  const session = await resolveRequestDesktopSession(request, {
    requiredScope: "pipeline:read",
    route: "POST /api/desktop/github/branch",
    allowApiKey: false,
    requiredCapability: "github:write",
  });
  if (!session) {
    return NextResponse.json({ ok: false, error: "desktop_session_required" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    repositoryFullName?: unknown;
    baseBranch?: unknown;
    newBranchName?: unknown;
  } | null;
  const repositoryFullName = typeof body?.repositoryFullName === "string" ? body.repositoryFullName.trim() : "";
  const baseBranch = typeof body?.baseBranch === "string" ? body.baseBranch.trim() : "";
  const newBranchName = typeof body?.newBranchName === "string" ? body.newBranchName.trim() : "";
  if (!repositoryFullName || !baseBranch || !newBranchName) {
    return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
  }
  const repo = parseRepositoryFullName(repositoryFullName);
  if (!repo) return NextResponse.json({ ok: false, error: "invalid_repository_full_name" }, { status: 400 });

  // Enrollment is not an execution grant. These legacy endpoints have no
  // baseline admission yet, so enrolled or unavailable authority must refuse.
  const beforeWrite = () => assertNoGovernanceEnrollmentForMutation(
    prisma, String(session.organizationId), request.signal,
  );
  try { await beforeWrite(); }
  catch {
    return NextResponse.json({ ok: false, error: "governance_execution_coverage_unavailable" }, { status: 409 });
  }

  const tokenResult = await resolveTenantScopedToken(String(session.organizationId), repo);
  if (!tokenResult.ok) return NextResponse.json({ ok: false, error: tokenResult.error }, { status: 409 });

  const result = await createBranch({
    owner: repo.owner,
    repo: repo.repo,
    baseBranch,
    newBranchName,
    installationToken: tokenResult.token,
    beforeWrite,
  });
  if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: 502 });

  try {
    await recordAudit({
      organizationId: idFactory.organization(String(session.organizationId)),
      actorUserId: idFactory.user(String(session.userId)),
      actorKind: "user",
      action: "github.branch_created",
      outcome: "success",
      entityRef: `github_repo:${repositoryFullName}`,
      correlationId: idFactory.correlation(`github_branch_${Date.now().toString(36)}`),
      source: "live",
      detail: { repositoryFullName, baseBranch, newBranchName },
    });
  } catch {
    // best-effort
  }

  return NextResponse.json({ ok: true, data: result.data });
}
