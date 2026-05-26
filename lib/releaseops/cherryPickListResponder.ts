/**
 * Phase 461 — cherry-pick exception list responder.
 *
 * Aggregates every CherryPickException row for an org, joins the
 * release tag + repository display, and buckets by status so the UI
 * can render a single-page operator inbox of in-flight exceptions.
 *
 * Read-only. Create / approve / deny flows land in a follow-on phase
 * with their own responder + routes.
 */

import { isMissingTable } from "./releaseListResponder";
import {
  ALL_CHERRY_PICK_STATUSES,
  type CherryPickStatus,
} from "./cherryPickWorkflow";

/* ──────────────────────────────────────────────────────────────────
   Row + repo contract.
   ────────────────────────────────────────────────────────────── */

export interface CherryPickRow {
  id: string;
  organizationId: string;
  releaseId: string;
  repositoryId: string;
  status: string;
  rationale: string;
  approvedPrIds: string[];
  excludedPrIds: string[];
  hasFinalCommitValidation: boolean;
  requestedByUserId: string;
  requestedAt: Date;
  decidedByUserId: string | null;
  decidedAt: Date | null;
  decisionReason: string | null;
}

export interface CherryPickReleaseRow {
  id: string;
  releaseTag: string | null;
  applicationId: string;
}

export interface CherryPickRepositoryRow {
  id: string;
  remoteOwner: string;
  remoteName: string;
}

export interface CherryPickListRepo {
  cherryPickException: {
    findMany(args: {
      where: { organizationId: string };
      orderBy: { requestedAt: "desc" };
    }): Promise<CherryPickRow[]>;
  };
  release: {
    findMany(args: {
      where: { id: { in: string[] } };
    }): Promise<CherryPickReleaseRow[]>;
  };
  repository: {
    findMany(args: {
      where: { id: { in: string[] } };
    }): Promise<CherryPickRepositoryRow[]>;
  };
}

/* ──────────────────────────────────────────────────────────────────
   Output.
   ────────────────────────────────────────────────────────────── */

export interface CherryPickListRow {
  id: string;
  releaseId: string;
  releaseTag: string | null;
  applicationId: string | null;
  repositoryId: string;
  repositoryDisplayName: string | null;
  status: CherryPickStatus | "unknown";
  rationale: string;
  approvedCount: number;
  excludedCount: number;
  hasFinalCommitValidation: boolean;
  requestedByUserId: string;
  requestedAtIso: string;
  decidedByUserId: string | null;
  decidedAtIso: string | null;
  decisionReason: string | null;
}

export type CherryPickListBody =
  | {
      ok: true;
      data: {
        generatedAt: string;
        exceptions: CherryPickListRow[];
        summary: { total: number; byStatus: Record<CherryPickStatus | "unknown", number> };
      };
    }
  | { ok: false; error: string; hint?: string; correlationId?: string };

export interface ResponderResult { status: number; body: CherryPickListBody }

/* ──────────────────────────────────────────────────────────────────
   Public surface.
   ────────────────────────────────────────────────────────────── */

export async function buildCherryPickListResponse(
  repo: CherryPickListRepo,
  organizationId: string,
  opts: { now?: Date; correlationId?: string } = {},
): Promise<ResponderResult> {
  try {
    const now = opts.now ?? new Date();
    const rows = await repo.cherryPickException.findMany({
      where: { organizationId },
      orderBy: { requestedAt: "desc" },
    });

    const releaseIds = Array.from(new Set(rows.map((r) => r.releaseId)));
    const repositoryIds = Array.from(new Set(rows.map((r) => r.repositoryId)));
    const [releases, repositories] = await Promise.all([
      releaseIds.length > 0 ? repo.release.findMany({ where: { id: { in: releaseIds } } }) : Promise.resolve([]),
      repositoryIds.length > 0 ? repo.repository.findMany({ where: { id: { in: repositoryIds } } }) : Promise.resolve([]),
    ]);
    const releaseById = new Map(releases.map((r) => [r.id, r]));
    const repositoryById = new Map(repositories.map((r) => [r.id, r]));

    const exceptions: CherryPickListRow[] = rows.map((r) => {
      const rel = releaseById.get(r.releaseId) ?? null;
      const repoRow = repositoryById.get(r.repositoryId) ?? null;
      return {
        id: r.id,
        releaseId: r.releaseId,
        releaseTag: rel?.releaseTag ?? null,
        applicationId: rel?.applicationId ?? null,
        repositoryId: r.repositoryId,
        repositoryDisplayName: repoRow ? `${repoRow.remoteOwner}/${repoRow.remoteName}` : null,
        status: narrowStatus(r.status),
        rationale: r.rationale,
        approvedCount: r.approvedPrIds.length,
        excludedCount: r.excludedPrIds.length,
        hasFinalCommitValidation: r.hasFinalCommitValidation,
        requestedByUserId: r.requestedByUserId,
        requestedAtIso: r.requestedAt.toISOString(),
        decidedByUserId: r.decidedByUserId,
        decidedAtIso: r.decidedAt ? r.decidedAt.toISOString() : null,
        decisionReason: r.decisionReason,
      };
    });

    const byStatus: Record<CherryPickStatus | "unknown", number> = {
      requested: 0, approved: 0, denied: 0, superseded: 0, unknown: 0,
    };
    for (const e of exceptions) byStatus[e.status] += 1;

    return {
      status: 200,
      body: {
        ok: true,
        data: {
          generatedAt: now.toISOString(),
          exceptions,
          summary: { total: exceptions.length, byStatus },
        },
      },
    };
  } catch (err) {
    if (isMissingTable(err)) {
      return {
        status: 503,
        body: {
          ok: false,
          error: "migration_pending",
          hint: "CherryPickException table not yet migrated. Run the Phase 457 migration to populate this list.",
        },
      };
    }
    return {
      status: 500,
      body: { ok: false, error: "internal_error", ...(opts.correlationId ? { correlationId: opts.correlationId } : {}) },
    };
  }
}

function narrowStatus(s: string): CherryPickStatus | "unknown" {
  return (ALL_CHERRY_PICK_STATUSES as readonly string[]).includes(s)
    ? (s as CherryPickStatus)
    : "unknown";
}
