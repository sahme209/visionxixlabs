/**
 * GET /api/desktop/github/files?repositoryFullName=owner/repository&branch=main
 *
 * Lists branch files with an installation token scoped to exactly the selected
 * tenant repository. Tokens and GitHub account identifiers remain server-side.
 */

import { NextResponse, type NextRequest } from "next/server";
import { resolveRequestDesktopSession } from "@/lib/desktop/resolveRequestDesktopSession";
import { resolveTenantScopedToken, parseRepositoryFullName } from "@/lib/connectors/github/resolveTenantScopedToken";
import { listRepositoryFiles } from "@/lib/connectors/github/githubWriteClient";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest): Promise<Response> {
  const session = await resolveRequestDesktopSession(request, {
    requiredScope: "pipeline:read",
    route: "GET /api/desktop/github/files",
    allowApiKey: false,
  });
  if (!session) return NextResponse.json({ ok: false, error: "desktop_session_required" }, { status: 401 });

  const repositoryFullName = request.nextUrl.searchParams.get("repositoryFullName")?.trim() ?? "";
  const branch = request.nextUrl.searchParams.get("branch")?.trim() ?? "";
  const repo = parseRepositoryFullName(repositoryFullName);
  if (!repo) return NextResponse.json({ ok: false, error: "invalid_repository_full_name" }, { status: 400 });
  if (!branch || branch.length > 240 || /[\0\r\n]/.test(branch)) {
    return NextResponse.json({ ok: false, error: "invalid_branch_name" }, { status: 400 });
  }

  const tokenResult = await resolveTenantScopedToken(String(session.organizationId), repo);
  if (!tokenResult.ok) return NextResponse.json({ ok: false, error: tokenResult.error }, { status: 409 });
  const result = await listRepositoryFiles({
    owner: repo.owner,
    repo: repo.repo,
    branch,
    installationToken: tokenResult.token,
  });
  if (!result.ok) return NextResponse.json({ ok: false, error: "github_files_unavailable" }, { status: 502 });

  return NextResponse.json({ ok: true, data: result.data });
}
