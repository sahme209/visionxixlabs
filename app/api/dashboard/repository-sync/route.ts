/**
 * POST /api/dashboard/repository-sync — Phase 467.
 *
 * Body: { repositoryId: string, kind: "pull_requests" | "releases" | "workflow_runs" }
 *
 * Session-auth. GitHub reads use a short-lived token minted for the active
 * tenant installation and the one requested repository; this route never
 * falls back to a process-wide personal token. It upserts the resulting
 * read-only evidence so dashboard surfaces stop showing empty states.
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
import { resolveGithubInstallationToken } from "@/lib/connectors/github/githubAppAuth";
import { appendAuditEvent, type AuditEventRepo } from "@/lib/releaseops/auditEventResponder";
import { createGitLabFetcher } from "@/lib/releaseops/gitlabFetcher";
import { createAzureDevOpsFetcher } from "@/lib/releaseops/azureDevOpsFetcher";

export const dynamic = "force-dynamic";

interface RepositoryForTokenScope {
  organizationId: string;
  provider: string;
  remoteName: string;
}

interface GitHubInstallationForTokenScope {
  githubInstallationId: string;
  lastSeenAt: Date | null;
}

interface RepositorySyncTokenRepo {
  repository: {
    findUnique(args: {
      where: { id: string };
      select: { organizationId: true; provider: true; remoteName: true };
    }): Promise<RepositoryForTokenScope | null>;
  };
  gitHubInstallation: {
    findFirst(args: {
      where: { organizationId: string; status: "active" };
      orderBy: { installedAt: "desc" };
      select: { githubInstallationId: true; lastSeenAt: true };
    }): Promise<GitHubInstallationForTokenScope | null>;
  };
}

const GITHUB_VALIDATION_FRESH_FOR_MS = 24 * 60 * 60 * 1000;

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
  let scopedRepository: RepositoryForTokenScope | null = null;
  try {
    scopedRepository = await (prisma as unknown as RepositorySyncTokenRepo).repository.findUnique({
      where: { id: repositoryId },
      select: { organizationId: true, provider: true, remoteName: true },
    });
  } catch {
    return NextResponse.json({ ok: false, error: "repository_sync_unavailable" }, { status: 503 });
  }

  if (scopedRepository?.organizationId === ctx.organizationId && scopedRepository.provider === "github") {
    const installation = await (prisma as unknown as RepositorySyncTokenRepo).gitHubInstallation.findFirst({
      where: { organizationId: ctx.organizationId, status: "active" },
      orderBy: { installedAt: "desc" },
      select: { githubInstallationId: true, lastSeenAt: true },
    }).catch(() => null);
    if (!installation) {
      return NextResponse.json({ ok: false, error: "github_app_connection_required" }, { status: 409 });
    }
    if (!installation.lastSeenAt || Date.now() - installation.lastSeenAt.getTime() > GITHUB_VALIDATION_FRESH_FOR_MS) {
      return NextResponse.json({ ok: false, error: "github_read_validation_required" }, { status: 409 });
    }
    const installationId = Number(installation.githubInstallationId);
    const token = await resolveGithubInstallationToken({ installationId, repositories: [scopedRepository.remoteName] });
    if (!token.ok) {
      return NextResponse.json({ ok: false, error: "github_read_validation_unavailable" }, { status: 503 });
    }
    fetchers.github = createGitHubFetcher({ token: token.token });
  }
  if (process.env.GITLAB_TOKEN) fetchers.gitlab = createGitLabFetcher();
  if (process.env.AZURE_DEVOPS_PAT) fetchers.azuredevops = createAzureDevOpsFetcher();

  const r = await buildRepositorySyncResponse(
    prisma as unknown as RepositorySyncRepo,
    fetchers,
    { organizationId: ctx.organizationId, repositoryId, kind },
  );
  if (r.body.ok) {
    await appendAuditEvent(prisma as unknown as AuditEventRepo, {
      organizationId: ctx.organizationId,
      kind: "repository.sync",
      subjectKind: "repository",
      subjectId: repositoryId,
      summary: `Repository ${kind} sync completed`,
      actorUserId: ctx.userId ?? null,
      correlationId: req.headers.get("x-correlation-id"),
      detailJson: {
        fetched: r.body.data.fetched,
        upserted: r.body.data.upserted,
        skipped: r.body.data.skipped,
      },
    });
  }
  return NextResponse.json(r.body, { status: r.status });
}
