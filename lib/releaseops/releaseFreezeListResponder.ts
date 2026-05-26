/**
 * Phase 462 — release-freeze list responder.
 *
 * Aggregates every Release that has progressed past `draft` and
 * classifies its scope-freeze state per Phase 458's FreezeStatus
 * closed-union. The list surface is intentionally PR-detail-free —
 * the per-release detail page (Phase 460) renders late-merged PRs.
 *
 * Status mapping at the list level (no PR fetch):
 *   - scopeFinalizedAt == null                       → not_yet_finalized
 *   - actualDeployStart set                          → deploy_window_started
 *   - scopeFinalizedAt set, no actualDeployStart     → frozen
 *
 * frozen_with_late_change is reserved for the detail surface that
 * already has the PR list loaded.
 */

import { isMissingTable } from "./releaseListResponder";

/* ──────────────────────────────────────────────────────────────────
   Closed-union list-level status.
   ────────────────────────────────────────────────────────────── */

export type ListFreezeStatus =
  | "not_yet_finalized"
  | "frozen"
  | "deploy_window_started";

export const ALL_LIST_FREEZE_STATUSES: ReadonlyArray<ListFreezeStatus> = [
  "not_yet_finalized", "frozen", "deploy_window_started",
];

/* ──────────────────────────────────────────────────────────────────
   Row + repo contract.
   ────────────────────────────────────────────────────────────── */

export interface FreezeReleaseRow {
  id: string;
  organizationId: string;
  applicationId: string;
  releaseTag: string | null;
  status: string;
  scopeFinalizedAt: Date | null;
  scopeFinalizedByUserId: string | null;
  plannedWindowStart: Date | null;
  plannedWindowEnd: Date | null;
  actualDeployStart: Date | null;
  actualDeployEnd: Date | null;
}

export interface ReleaseFreezeListRepo {
  release: {
    findMany(args: {
      where: { organizationId: string };
      orderBy: { createdAt: "desc" };
    }): Promise<FreezeReleaseRow[]>;
  };
}

/* ──────────────────────────────────────────────────────────────────
   Output.
   ────────────────────────────────────────────────────────────── */

export interface FreezeListRow {
  releaseId: string;
  applicationId: string;
  releaseTag: string | null;
  status: ListFreezeStatus;
  hoursSinceScopeFinalized: number | null;
  scopeFinalizedAtIso: string | null;
  scopeFinalizedByUserId: string | null;
  plannedWindowStartIso: string | null;
  plannedWindowEndIso: string | null;
  actualDeployStartIso: string | null;
  actualDeployEndIso: string | null;
  summary: string;
}

export type FreezeListBody =
  | {
      ok: true;
      data: {
        generatedAt: string;
        releases: FreezeListRow[];
        summary: { total: number; byStatus: Record<ListFreezeStatus, number> };
      };
    }
  | { ok: false; error: string; hint?: string; correlationId?: string };

export interface ResponderResult { status: number; body: FreezeListBody }

/* ──────────────────────────────────────────────────────────────────
   Public surface.
   ────────────────────────────────────────────────────────────── */

export async function buildReleaseFreezeListResponse(
  repo: ReleaseFreezeListRepo,
  organizationId: string,
  opts: { now?: Date; correlationId?: string } = {},
): Promise<ResponderResult> {
  try {
    const now = opts.now ?? new Date();
    const rows = await repo.release.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
    });
    const releases: FreezeListRow[] = rows.map((r) => classify(r, now));
    const byStatus: Record<ListFreezeStatus, number> = {
      not_yet_finalized: 0, frozen: 0, deploy_window_started: 0,
    };
    for (const rel of releases) byStatus[rel.status] += 1;

    return {
      status: 200,
      body: {
        ok: true,
        data: {
          generatedAt: now.toISOString(),
          releases,
          summary: { total: releases.length, byStatus },
        },
      },
    };
  } catch (err) {
    if (isMissingTable(err)) {
      return {
        status: 503,
        body: { ok: false, error: "migration_pending", hint: "Release table not yet migrated." },
      };
    }
    return {
      status: 500,
      body: { ok: false, error: "internal_error", ...(opts.correlationId ? { correlationId: opts.correlationId } : {}) },
    };
  }
}

/* ──────────────────────────────────────────────────────────────────
   Pure classifier — exported for direct unit testing.
   ────────────────────────────────────────────────────────────── */

export function classify(r: FreezeReleaseRow, now: Date): FreezeListRow {
  const base = {
    releaseId: r.id,
    applicationId: r.applicationId,
    releaseTag: r.releaseTag,
    scopeFinalizedAtIso: r.scopeFinalizedAt ? r.scopeFinalizedAt.toISOString() : null,
    scopeFinalizedByUserId: r.scopeFinalizedByUserId,
    plannedWindowStartIso: r.plannedWindowStart ? r.plannedWindowStart.toISOString() : null,
    plannedWindowEndIso: r.plannedWindowEnd ? r.plannedWindowEnd.toISOString() : null,
    actualDeployStartIso: r.actualDeployStart ? r.actualDeployStart.toISOString() : null,
    actualDeployEndIso: r.actualDeployEnd ? r.actualDeployEnd.toISOString() : null,
  };

  if (!r.scopeFinalizedAt) {
    return {
      ...base,
      status: "not_yet_finalized",
      hoursSinceScopeFinalized: null,
      summary: "Scope not yet finalized — operator may add or remove PRs.",
    };
  }

  if (r.actualDeployStart) {
    return {
      ...base,
      status: "deploy_window_started",
      hoursSinceScopeFinalized: hoursBetween(r.scopeFinalizedAt, r.actualDeployStart),
      summary: `Deploy started ${r.actualDeployStart.toISOString()} — scope locked.`,
    };
  }

  return {
    ...base,
    status: "frozen",
    hoursSinceScopeFinalized: hoursBetween(r.scopeFinalizedAt, now),
    summary: `Frozen ${r.scopeFinalizedAt.toISOString()} — awaiting deploy window.`,
  };
}

function hoursBetween(a: Date, b: Date): number {
  return Math.round(((b.getTime() - a.getTime()) / 36e5) * 100) / 100;
}
