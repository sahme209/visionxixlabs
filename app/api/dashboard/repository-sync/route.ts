/**
 * POST /api/dashboard/repository-sync — Phase 467.
 *
 * Body: { repositoryId: string, kind: "pull_requests" | "releases" | "workflow_runs" }
 *
 * Session-auth. Fetches a slice of GitHub data for the given
 * repository and upserts the rows so the dashboard surfaces stop
 * showing empty states.
 */

import { NextResponse, type NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import {
  buildRepositorySyncResponse,
  ALL_SYNC_KINDS,
  type RepositorySyncRepo,
  type SyncKind,
  type ProviderFetchers,
} from "@/lib/releaseops/repositorySyncResponder";
import { createGitHubFetcher } from "@/lib/releaseops/githubFetcher";
import { createGitLabFetcher } from "@/lib/releaseops/gitlabFetcher";
import { createAzureDevOpsFetcher } from "@/lib/releaseops/azureDevOpsFetcher";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId) {
    return NextResponse.json({ ok: false, error: "auth_required" }, { status: 401 });
  }

  let body: { repositoryId?: unknown; kind?: unknown } = {};
  try { body = await req.json(); } catch { /* empty body is fine — we'll 400 below */ }

  const repositoryId = typeof body.repositoryId === "string" ? body.repositoryId : null;
  const kindRaw = typeof body.kind === "string" ? body.kind : null;
  if (!repositoryId || !kindRaw) {
    return NextResponse.json(
      { ok: false, error: "invalid_payload", hint: "Body must contain { repositoryId, kind }." },
      { status: 400 },
    );
  }
  if (!(ALL_SYNC_KINDS as readonly string[]).includes(kindRaw)) {
    return NextResponse.json(
      { ok: false, error: "invalid_kind", hint: `kind must be one of: ${ALL_SYNC_KINDS.join(", ")}.` },
      { status: 400 },
    );
  }
  const kind = kindRaw as SyncKind;

  const fetchers: ProviderFetchers = {};
  if (process.env.GITHUB_PAT) fetchers.github = createGitHubFetcher();
  if (process.env.GITLAB_TOKEN) fetchers.gitlab = createGitLabFetcher();
  if (process.env.AZURE_DEVOPS_PAT) fetchers.azuredevops = createAzureDevOpsFetcher();

  const r = await buildRepositorySyncResponse(
    prisma as unknown as RepositorySyncRepo,
    fetchers,
    { organizationId: ctx.organizationId, repositoryId, kind },
  );
  return NextResponse.json(r.body, { status: r.status });
}
