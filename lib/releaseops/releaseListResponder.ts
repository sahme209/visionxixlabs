/**
 * Phase 447 — release-list responder.
 *
 * Pure response builder shared by the public v1 route + the dashboard
 * session-auth route + the desktop fetch. Mirrors the responder
 * pattern from Phase 422 (setupDigestResponder) and Phase 432
 * (alertDigestResponder).
 *
 * Returns the recent releases for an org with a derived summary —
 * latest readiness score per release, latest evaluation source,
 * evidence-pack signed state. No I/O beyond the repo round-trip.
 */

import {
  listRecentReadinessSnapshots,
  readEvidencePack,
  type ReleaseRepo,
  type ReleaseRow,
  type ReleaseStatus,
} from "./releaseRepo";

/* ──────────────────────────────────────────────────────────────────
   Extended repo contract — adds findMany on Release.
   ────────────────────────────────────────────────────────────── */

export interface ReleaseListRepo extends ReleaseRepo {
  release: ReleaseRepo["release"] & {
    findMany(args: {
      where: { organizationId: string; applicationId?: string; status?: ReleaseStatus };
      orderBy: { createdAt: "desc" };
      take?: number;
    }): Promise<ReleaseRow[]>;
  };
}

/* ──────────────────────────────────────────────────────────────────
   Output shape.
   ────────────────────────────────────────────────────────────── */

export type RiskBadge = "low" | "medium" | "high" | "critical" | "unscored";
export type ReleaseSidebarTone = "emerald" | "amber" | "rose" | "blue" | "zinc";

export interface ReleaseListRow {
  id: string;
  applicationId: string;
  releaseTag: string | null;
  commitSha: string | null;
  status: ReleaseStatus;
  statusLabel: string;
  sidebarTone: ReleaseSidebarTone;
  targetEnvironmentId: string | null;
  createdAt: string; // ISO
  scopeFinalizedAt: string | null;
  /** Latest readiness summary if any snapshot has been persisted. */
  latestReadiness: {
    overallScore: number;
    riskLevel: RiskBadge;
    blockerCount: number;
    evaluatedAtIso: string;
    evaluationSource: string;
  } | null;
  evidencePack: {
    generatedAtIso: string;
    signed: boolean;
  } | null;
}

export type ReleaseListResponseBody =
  | { ok: true; data: { generatedAt: string; releases: ReleaseListRow[]; summary: ReleaseListSummary } }
  | { ok: false; error: string; hint?: string; correlationId?: string };

export interface ReleaseListSummary {
  total: number;
  byStatus: Record<ReleaseStatus, number>;
  draft: number;
  ready: number;
  deploying: number;
  deployed: number;
  rolled_back: number;
  failed: number;
  withEvidence: number;
  signedEvidence: number;
}

export interface ResponderResult {
  status: number;
  body: ReleaseListResponseBody;
}

export interface BuildReleaseListOptions {
  /** Limit how many releases to surface. Defaults to 25. */
  take?: number;
  /** Optional applicationId filter. */
  applicationId?: string;
  /** Override clock. */
  now?: Date;
  correlationId?: string;
}

/* ──────────────────────────────────────────────────────────────────
   Public surface.
   ────────────────────────────────────────────────────────────── */

export async function buildReleaseListResponse(
  repo: ReleaseListRepo,
  organizationId: string,
  opts: BuildReleaseListOptions = {},
): Promise<ResponderResult> {
  try {
    const now = opts.now ?? new Date();
    const releases = await repo.release.findMany({
      where: {
        organizationId,
        ...(opts.applicationId ? { applicationId: opts.applicationId } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: opts.take ?? 25,
    });

    const rows: ReleaseListRow[] = await Promise.all(
      releases.map(async (r) => {
        const [snaps, pack] = await Promise.all([
          listRecentReadinessSnapshots(repo, { releaseId: r.id, take: 1 }),
          readEvidencePack(repo, { releaseId: r.id }),
        ]);
        const latestReadiness = snaps[0]
          ? {
              overallScore: snaps[0].overallScore,
              riskLevel: snaps[0].riskLevel as RiskBadge,
              blockerCount: snaps[0].blockersJson.length,
              evaluatedAtIso: snaps[0].evaluatedAt.toISOString(),
              evaluationSource: snaps[0].evaluationSource,
            }
          : null;
        return {
          id: r.id,
          applicationId: r.applicationId,
          releaseTag: r.releaseTag,
          commitSha: r.commitSha,
          status: r.status,
          statusLabel: releaseStatusLabel(r.status),
          sidebarTone: sidebarToneFor(r.status),
          targetEnvironmentId: r.targetEnvironmentId,
          createdAt: r.createdAt.toISOString(),
          scopeFinalizedAt: r.scopeFinalizedAt ? r.scopeFinalizedAt.toISOString() : null,
          latestReadiness,
          evidencePack: pack
            ? { generatedAtIso: pack.generatedAt.toISOString(), signed: pack.signedAt !== null }
            : null,
        };
      }),
    );

    return {
      status: 200,
      body: {
        ok: true,
        data: {
          generatedAt: now.toISOString(),
          releases: rows,
          summary: summarize(rows),
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
          hint: "Release / ReleaseReadinessSnapshot / ReleaseEvidencePack tables aren't migrated yet.",
        },
      };
    }
    return {
      status: 500,
      body: {
        ok: false,
        error: "internal_error",
        ...(opts.correlationId ? { correlationId: opts.correlationId } : {}),
      },
    };
  }
}

/* ──────────────────────────────────────────────────────────────────
   Pure helpers — exported so the dashboard + desktop reuse the same
   sidebar tone + label mapping.
   ────────────────────────────────────────────────────────────── */

export function releaseStatusLabel(s: ReleaseStatus): string {
  switch (s) {
    case "draft":        return "Draft";
    case "ready":        return "Ready";
    case "deploying":    return "Deploying";
    case "deployed":     return "Deployed";
    case "rolled_back":  return "Rolled back";
    case "failed":       return "Failed";
  }
}

export function sidebarToneFor(s: ReleaseStatus): ReleaseSidebarTone {
  if (s === "deployed") return "emerald";
  if (s === "deploying") return "blue";
  if (s === "ready") return "amber";
  if (s === "rolled_back") return "blue";
  if (s === "failed") return "rose";
  return "zinc"; // draft
}

/**
 * Detects the Postgres "relation does not exist" condition under any
 * shape Prisma might surface it. Copied from Phase 422's responder so
 * this module doesn't need to import a Prisma type.
 */
export function isMissingTable(err: unknown): boolean {
  if (!err) return false;
  if (typeof err === "object" && err !== null) {
    const code = (err as { code?: unknown }).code;
    if (code === "P2021") return true;
  }
  if (err instanceof Error) {
    return /relation .+ does not exist|undefined_table|42P01/i.test(err.message);
  }
  return false;
}

function summarize(rows: ReadonlyArray<ReleaseListRow>): ReleaseListSummary {
  const byStatus: Record<ReleaseStatus, number> = {
    draft: 0, ready: 0, deploying: 0, deployed: 0, rolled_back: 0, failed: 0,
  };
  let withEvidence = 0;
  let signedEvidence = 0;
  for (const r of rows) {
    byStatus[r.status] += 1;
    if (r.evidencePack) {
      withEvidence += 1;
      if (r.evidencePack.signed) signedEvidence += 1;
    }
  }
  return {
    total: rows.length,
    byStatus,
    draft: byStatus.draft,
    ready: byStatus.ready,
    deploying: byStatus.deploying,
    deployed: byStatus.deployed,
    rolled_back: byStatus.rolled_back,
    failed: byStatus.failed,
    withEvidence,
    signedEvidence,
  };
}
