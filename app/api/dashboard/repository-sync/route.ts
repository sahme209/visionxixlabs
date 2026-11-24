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
import { readBoundedRequestJson } from "@/lib/api/readBoundedRequestJson";
import { isSameOriginRequest } from "@/lib/auth/requestOrigin";
import { hasDesktopCapability } from "@/lib/desktop/desktopAuthorization";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import {
  buildRepositorySyncResponse,
  ALL_SYNC_KINDS,
  type RepositorySyncRepo,
  type SyncKind,
  type ProviderFetchers,
  type ResponderResult,
} from "@/lib/releaseops/repositorySyncResponder";
import { createStoredGitLabEvidenceSync, GitLabEvidencePersistenceUnconfirmed } from "@/lib/releaseops/gitlabScopedEvidence";
import { createGitHubFetcher } from "@/lib/releaseops/githubFetcher";
import { resolveGithubInstallationToken } from "@/lib/connectors/github/githubAppAuth";
import { appendAuditEvent, type AuditEventRepo } from "@/lib/releaseops/auditEventResponder";

export const dynamic = "force-dynamic";

interface RepositoryForTokenScope {
  organizationId: string;
  provider: string;
  remoteName: string;
  remoteOwner: string;
}

interface GitHubInstallationForTokenScope {
  githubInstallationId: string;
  lastSeenAt: Date | null;
}

interface RepositorySyncTokenRepo {
  repository: {
    findUnique(args: {
      where: { id: string };
      select: { organizationId: true; provider: true; remoteName: true; remoteOwner: true };
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

  const signal = AbortSignal.any([req.signal, AbortSignal.timeout(15_000)]);
  const requestBody = await readBoundedRequestJson(req, signal, 8_192).catch(() => null);
  const body = requestBody && typeof requestBody === "object" ? requestBody as {repositoryId?: unknown; kind?: unknown} : null;
  const repositoryId = typeof body?.repositoryId === "string" ? body.repositoryId : null;
  const kindRaw = typeof body?.kind === "string" ? body.kind : null;
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
      select: { organizationId: true, provider: true, remoteName: true, remoteOwner: true },
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
  const gitLabRepository = scopedRepository?.organizationId === ctx.organizationId && scopedRepository.provider === "gitlab"
    ? scopedRepository : null;
  let r: ResponderResult;
  if (gitLabRepository) {
    const {organizationId, sessionUserId} = ctx;
    if (process.env.GITLAB_WORKSPACE_SETUP_ENABLED !== "true") {
      return NextResponse.json({ok: false, error: "fetcher_not_configured", hint: "GitLab evidence sync is not configured for this workspace."}, {status: 501});
    }
    if (!isSameOriginRequest(req)) return NextResponse.json({ok: false, error: "invalid_request_origin"}, {status: 403});
    if (!sessionUserId) return NextResponse.json({ok: false, error: "auth_required"}, {status: 401});
    if (!ctx.roles.some(role => role === "owner" || role === "admin")) {
      return NextResponse.json({ok: false, error: "connection_manager_required"}, {status: 403});
    }
    r = await syncGitLab({organizationId, userId: sessionUserId, repositoryId, kind, signal}, gitLabRepository);
  } else {
    r = await buildRepositorySyncResponse(
      prisma as unknown as RepositorySyncRepo, fetchers, {organizationId: ctx.organizationId, repositoryId, kind},
    );
  }
  if (r.body.ok) {
    await appendAuditEvent(prisma as unknown as AuditEventRepo, {
      organizationId: ctx.organizationId,
      kind: "repository.sync",
      subjectKind: "repository",
      subjectId: repositoryId,
      summary: `Repository ${kind} sync completed`,
      actorUserId: (gitLabRepository ? ctx.sessionUserId : ctx.userId) ?? null,
      correlationId: req.headers.get("x-correlation-id"),
      detailJson: {
        fetched: r.body.data.fetched,
        upserted: r.body.data.upserted,
        skipped: r.body.data.skipped,
      },
    });
  }
  return NextResponse.json(r.body, {status: r.status, ...(gitLabRepository ? {headers: {"Cache-Control": "no-store"}} : {})});
}

async function syncGitLab(
  {organizationId, userId, repositoryId, kind, signal}: {
    organizationId: string; userId: string; repositoryId: string; kind: SyncKind; signal: AbortSignal;
  },
  {remoteOwner, remoteName}: RepositoryForTokenScope,
): Promise<ResponderResult> {
  try {
    signal.throwIfAborted();
    const connection = await prisma.tenantIntegrationConnection.findUnique({
      where: {organizationId_provider: {organizationId, provider: "gitlab"}},
      select: {id: true, status: true, revokedAt: true},
    });
    if (!connection || connection.status !== "active" || connection.revokedAt !== null) {
      return {status: 409, body: {ok: false, error: "gitlab_read_connection_required"}};
    }
    const sync = createStoredGitLabEvidenceSync(prisma, {organizationId, userId, repositoryId, connectionId: connection.id}, {
      signal, canReadRepository: role => hasDesktopCapability(role, "connections:manage"),
    });
    const counts = await sync(kind, {owner: remoteOwner, name: remoteName});
    return {status: 200, body: {ok: true, data: {
      repositoryId, kind, ...counts, skipped: 0, errors: [], completedAtIso: new Date().toISOString(),
    }}};
  } catch (error) {
    if (error instanceof GitLabEvidencePersistenceUnconfirmed) {
      return {status: 409, body: {ok: false, error: "gitlab_evidence_persistence_unconfirmed"}};
    }
    return {status: 503, body: {ok: false, error: "gitlab_evidence_unavailable"}};
  }
}
