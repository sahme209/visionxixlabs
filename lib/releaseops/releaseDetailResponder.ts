/**
 * Phase 482 — per-release overview responder.
 *
 * Single round-trip for the /dashboard/releases/[id] page. Pulls
 * release metadata + latest readiness snapshot + cherry-picks +
 * violations + linked tickets + evidence pack status so the
 * operator's release-overview page renders without N+1 fetches.
 */

import { isMissingTable } from "./releaseListResponder";

/* ──────────────────────────────────────────────────────────────────
   Row shapes.
   ────────────────────────────────────────────────────────────── */

export interface DetailReleaseRow {
  id: string;
  organizationId: string;
  applicationId: string;
  releaseTag: string | null;
  commitSha: string | null;
  status: string;
  scopeFinalizedAt: Date | null;
  scopeFinalizedByUserId: string | null;
  plannedWindowStart: Date | null;
  plannedWindowEnd: Date | null;
  actualDeployStart: Date | null;
  actualDeployEnd: Date | null;
  rollbackReferenceReleaseId: string | null;
  summary: string | null;
  createdAt: Date;
}

export interface DetailRepositoryRow {
  id: string;
  provider: string;
  remoteOwner: string;
  remoteName: string;
}

export interface DetailReadinessRow {
  overallScore: number;
  riskLevel: string;
  evaluatedAt: Date;
  blockersJson: unknown;
}

export interface DetailCherryPickRow {
  id: string;
  status: string;
  rationale: string;
  approvedPrIds: string[];
  requestedAt: Date;
}

export interface DetailViolationRow {
  id: string;
  status: string;
  message: string;
  rule: { key: string; label: string; severity: string; blocking: boolean };
}

export interface DetailTicketRow {
  id: string;
  provider: string;
  externalKey: string;
  title: string;
  status: string;
}

export interface DetailEvidencePackRow {
  id: string;
  generatedAt: Date;
  signedAt: Date | null;
  contentHash: string | null;
}

export interface ReleaseDetailRepo {
  release: {
    findUnique(args: { where: { id: string } }): Promise<DetailReleaseRow | null>;
  };
  repository: {
    findFirst(args: {
      where: { organizationId: string; id?: string };
    }): Promise<DetailRepositoryRow | null>;
  };
  releaseReadinessSnapshot: {
    findFirst(args: { where: { releaseId: string }; orderBy: { evaluatedAt: "desc" } }): Promise<DetailReadinessRow | null>;
  };
  cherryPickException: {
    findMany(args: {
      where: { organizationId: string; releaseId: string };
      orderBy: { requestedAt: "desc" };
    }): Promise<DetailCherryPickRow[]>;
  };
  policyViolation: {
    findMany(args: {
      where: { organizationId: string; releaseId: string };
      include: { rule: true };
      orderBy: { detectedAt: "desc" };
    }): Promise<DetailViolationRow[]>;
  };
  changeTicket: {
    findMany(args: {
      where: { organizationId: string; linkedReleaseIds: { has: string } };
    }): Promise<DetailTicketRow[]>;
  };
  releaseEvidencePack: {
    findUnique(args: { where: { releaseId: string } }): Promise<DetailEvidencePackRow | null>;
  };
}

/* ──────────────────────────────────────────────────────────────────
   Output.
   ────────────────────────────────────────────────────────────── */

export interface ReleaseDetailBody {
  ok: true;
  data: {
    release: {
      id: string;
      releaseTag: string | null;
      commitSha: string | null;
      status: string;
      scopeFinalizedAtIso: string | null;
      scopeFinalizedByUserId: string | null;
      plannedWindowStartIso: string | null;
      plannedWindowEndIso: string | null;
      actualDeployStartIso: string | null;
      actualDeployEndIso: string | null;
      rollbackReferenceReleaseId: string | null;
      summary: string | null;
      createdAtIso: string;
      applicationId: string;
    };
    repository: { id: string; displayName: string; provider: string } | null;
    readiness: { overallScore: number; riskLevel: string; evaluatedAtIso: string; blockerCount: number; topBlocker: string | null } | null;
    cherryPicks: {
      total: number;
      byStatus: Record<string, number>;
      recent: Array<{ id: string; status: string; rationaleSnippet: string; approvedCount: number; requestedAtIso: string }>;
    };
    policyViolations: {
      total: number;
      blockingOpen: number;
      byStatus: Record<string, number>;
      recent: Array<{ id: string; ruleLabel: string; severity: string; status: string; blocking: boolean; message: string }>;
    };
    changeTickets: {
      total: number;
      byProvider: Record<string, number>;
      items: Array<{ id: string; provider: string; externalKey: string; title: string; status: string }>;
    };
    evidencePack: { id: string; generatedAtIso: string; signedAtIso: string | null; contentHash: string | null } | null;
  };
}

export type ReleaseDetailResponseBody =
  | ReleaseDetailBody
  | { ok: false; error: string; hint?: string; correlationId?: string };

export interface ResponderResult { status: number; body: ReleaseDetailResponseBody }

export interface BuildReleaseDetailInput {
  organizationId: string;
  releaseId: string;
  repositoryId?: string;
}

/* ──────────────────────────────────────────────────────────────────
   Public surface.
   ────────────────────────────────────────────────────────────── */

export async function buildReleaseDetailResponse(
  repo: ReleaseDetailRepo,
  input: BuildReleaseDetailInput,
  opts: { correlationId?: string } = {},
): Promise<ResponderResult> {
  try {
    const release = await repo.release.findUnique({ where: { id: input.releaseId } });
    if (!release) {
      return { status: 404, body: { ok: false, error: "release_not_found" } };
    }
    if (release.organizationId !== input.organizationId) {
      return { status: 403, body: { ok: false, error: "cross_org_release" } };
    }

    const [repository, readiness, cherryPicks, violations, tickets, evidencePack] = await Promise.all([
      input.repositoryId
        ? repo.repository.findFirst({ where: { organizationId: input.organizationId, id: input.repositoryId } })
        : Promise.resolve(null),
      repo.releaseReadinessSnapshot.findFirst({ where: { releaseId: release.id }, orderBy: { evaluatedAt: "desc" } }),
      repo.cherryPickException.findMany({ where: { organizationId: input.organizationId, releaseId: release.id }, orderBy: { requestedAt: "desc" } }),
      repo.policyViolation.findMany({
        where: { organizationId: input.organizationId, releaseId: release.id },
        include: { rule: true },
        orderBy: { detectedAt: "desc" },
      }),
      repo.changeTicket.findMany({ where: { organizationId: input.organizationId, linkedReleaseIds: { has: release.id } } }),
      repo.releaseEvidencePack.findUnique({ where: { releaseId: release.id } }),
    ]);

    // Bucket cherry-picks by status.
    const cpByStatus: Record<string, number> = {};
    for (const c of cherryPicks) cpByStatus[c.status] = (cpByStatus[c.status] ?? 0) + 1;

    // Bucket violations.
    const vlByStatus: Record<string, number> = {};
    let blockingOpen = 0;
    for (const v of violations) {
      vlByStatus[v.status] = (vlByStatus[v.status] ?? 0) + 1;
      if (v.rule.blocking && v.status === "open") blockingOpen += 1;
    }

    // Bucket tickets.
    const tkByProvider: Record<string, number> = {};
    for (const t of tickets) tkByProvider[t.provider] = (tkByProvider[t.provider] ?? 0) + 1;

    const blockers = Array.isArray(readiness?.blockersJson) ? readiness!.blockersJson : [];
    const top = blockers[0] as { message?: string } | undefined;

    return {
      status: 200,
      body: {
        ok: true,
        data: {
          release: {
            id: release.id,
            releaseTag: release.releaseTag,
            commitSha: release.commitSha,
            status: release.status,
            scopeFinalizedAtIso: isoOrNull(release.scopeFinalizedAt),
            scopeFinalizedByUserId: release.scopeFinalizedByUserId,
            plannedWindowStartIso: isoOrNull(release.plannedWindowStart),
            plannedWindowEndIso: isoOrNull(release.plannedWindowEnd),
            actualDeployStartIso: isoOrNull(release.actualDeployStart),
            actualDeployEndIso: isoOrNull(release.actualDeployEnd),
            rollbackReferenceReleaseId: release.rollbackReferenceReleaseId,
            summary: release.summary,
            createdAtIso: release.createdAt.toISOString(),
            applicationId: release.applicationId,
          },
          repository: repository
            ? { id: repository.id, displayName: `${repository.remoteOwner}/${repository.remoteName}`, provider: repository.provider }
            : null,
          readiness: readiness
            ? {
                overallScore: readiness.overallScore,
                riskLevel: readiness.riskLevel,
                evaluatedAtIso: readiness.evaluatedAt.toISOString(),
                blockerCount: blockers.length,
                topBlocker: top?.message ?? null,
              }
            : null,
          cherryPicks: {
            total: cherryPicks.length,
            byStatus: cpByStatus,
            recent: cherryPicks.slice(0, 3).map((c) => ({
              id: c.id,
              status: c.status,
              rationaleSnippet: c.rationale.length > 80 ? c.rationale.slice(0, 77) + "…" : c.rationale,
              approvedCount: c.approvedPrIds.length,
              requestedAtIso: c.requestedAt.toISOString(),
            })),
          },
          policyViolations: {
            total: violations.length,
            blockingOpen,
            byStatus: vlByStatus,
            recent: violations.slice(0, 3).map((v) => ({
              id: v.id,
              ruleLabel: v.rule.label,
              severity: v.rule.severity,
              status: v.status,
              blocking: v.rule.blocking,
              message: v.message,
            })),
          },
          changeTickets: {
            total: tickets.length,
            byProvider: tkByProvider,
            items: tickets.slice(0, 6).map((t) => ({
              id: t.id, provider: t.provider, externalKey: t.externalKey, title: t.title, status: t.status,
            })),
          },
          evidencePack: evidencePack
            ? {
                id: evidencePack.id,
                generatedAtIso: evidencePack.generatedAt.toISOString(),
                signedAtIso: isoOrNull(evidencePack.signedAt),
                contentHash: evidencePack.contentHash,
              }
            : null,
        },
      },
    };
  } catch (err) {
    if (isMissingTable(err)) {
      return {
        status: 503,
        body: { ok: false, error: "migration_pending", hint: "Phase 442 / 466 migrations required for the release overview." },
      };
    }
    return {
      status: 500,
      body: { ok: false, error: "internal_error", ...(opts.correlationId ? { correlationId: opts.correlationId } : {}) },
    };
  }
}

function isoOrNull(d: Date | null): string | null {
  return d ? d.toISOString() : null;
}
