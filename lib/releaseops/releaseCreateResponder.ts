/**
 * Phase 498 — Release creation responder.
 *
 * Creates a Release row pinned to (applicationId, releaseTag) — the
 * compound unique on (organizationId, applicationId, releaseTag) makes
 * the write idempotent. Repeat calls return the existing row with
 * created=false.
 *
 * Validates:
 *   • applicationId exists and belongs to the org
 *   • releaseTag matches TAG_RE (semver-ish, allowing optional "v" prefix
 *     and pre-release/build metadata)
 *   • optional commitSha is a 7-40 char hex string
 *   • optional plannedWindowStart/End are valid ISO timestamps with
 *     start ≤ end
 *
 * Starts every release in status="draft" — operators advance the
 * lifecycle via /api/dashboard/release-transition (Phase 491).
 */

import { isMissingTable } from "./releaseListResponder";

/* ──────────────────────────────────────────────────────────────────
   Validation regexes.
   ────────────────────────────────────────────────────────────── */

// v?  major.minor.patch  optional pre-release  optional build metadata.
//   "v1.2.3", "v1.2.3-rc.1", "1.2.3+build.99", "2025.05.26"
export const TAG_RE = /^v?(\d+)(?:\.(\d+))+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
export const COMMIT_SHA_RE = /^[0-9a-fA-F]{7,40}$/;

/* ──────────────────────────────────────────────────────────────────
   Repo contract.
   ────────────────────────────────────────────────────────────── */

export interface ApplicationRow {
  id: string;
  organizationId: string;
  name: string;
}

export interface ReleaseCreatedRow {
  id: string;
  applicationId: string;
  releaseTag: string;
  status: string;
  commitSha: string | null;
  plannedWindowStart: Date | null;
  plannedWindowEnd: Date | null;
  summary: string | null;
}

export interface ReleaseCreateRepo {
  application: {
    findUnique(args: { where: { id: string } }): Promise<ApplicationRow | null>;
  };
  release: {
    findUnique(args: {
      where: { organizationId_applicationId_releaseTag: { organizationId: string; applicationId: string; releaseTag: string } };
    }): Promise<ReleaseCreatedRow | null>;
    create(args: {
      data: {
        organizationId: string;
        applicationId: string;
        releaseTag: string;
        status: "draft";
        commitSha: string | null;
        plannedWindowStart: Date | null;
        plannedWindowEnd: Date | null;
        summary: string | null;
        createdByUserId: string;
      };
    }): Promise<ReleaseCreatedRow>;
  };
}

/* ──────────────────────────────────────────────────────────────────
   Input + output.
   ────────────────────────────────────────────────────────────── */

export interface BuildReleaseCreateInput {
  organizationId: string;
  actorUserId: string;
  applicationId: string;
  releaseTag: string;
  commitSha?: string;
  plannedWindowStartIso?: string;
  plannedWindowEndIso?: string;
  summary?: string;
}

export type CreateError =
  | "tag_invalid"
  | "commit_sha_invalid"
  | "planned_window_invalid"
  | "application_not_found"
  | "cross_org_application";

export type ReleaseCreateBody =
  | {
      ok: true;
      data: {
        id: string;
        applicationId: string;
        releaseTag: string;
        status: string;
        created: boolean;
      };
    }
  | { ok: false; error: CreateError | "migration_pending" | "internal_error"; hint?: string; correlationId?: string };

export interface ResponderResult { status: number; body: ReleaseCreateBody }

/* ──────────────────────────────────────────────────────────────────
   Public surface.
   ────────────────────────────────────────────────────────────── */

export async function buildReleaseCreateResponse(
  repo: ReleaseCreateRepo,
  input: BuildReleaseCreateInput,
  opts: { correlationId?: string } = {},
): Promise<ResponderResult> {
  const tag = input.releaseTag?.trim() ?? "";
  if (!tag || !TAG_RE.test(tag)) {
    return {
      status: 422,
      body: { ok: false, error: "tag_invalid", hint: "releaseTag must be a semver-ish string like v1.2.3 or 2026.05.26." },
    };
  }

  if (input.commitSha !== undefined && input.commitSha.length > 0) {
    if (!COMMIT_SHA_RE.test(input.commitSha)) {
      return { status: 422, body: { ok: false, error: "commit_sha_invalid", hint: "commitSha must be 7–40 hex characters." } };
    }
  }

  let plannedStart: Date | null = null;
  let plannedEnd: Date | null = null;
  if (input.plannedWindowStartIso) {
    const d = new Date(input.plannedWindowStartIso);
    if (Number.isNaN(d.getTime())) {
      return { status: 422, body: { ok: false, error: "planned_window_invalid", hint: "plannedWindowStartIso unparseable." } };
    }
    plannedStart = d;
  }
  if (input.plannedWindowEndIso) {
    const d = new Date(input.plannedWindowEndIso);
    if (Number.isNaN(d.getTime())) {
      return { status: 422, body: { ok: false, error: "planned_window_invalid", hint: "plannedWindowEndIso unparseable." } };
    }
    plannedEnd = d;
  }
  if (plannedStart && plannedEnd && plannedStart.getTime() > plannedEnd.getTime()) {
    return { status: 422, body: { ok: false, error: "planned_window_invalid", hint: "plannedWindowStart must be ≤ plannedWindowEnd." } };
  }

  try {
    const app = await repo.application.findUnique({ where: { id: input.applicationId } });
    if (!app) {
      return { status: 404, body: { ok: false, error: "application_not_found" } };
    }
    if (app.organizationId !== input.organizationId) {
      return { status: 403, body: { ok: false, error: "cross_org_application" } };
    }

    const existing = await repo.release.findUnique({
      where: {
        organizationId_applicationId_releaseTag: {
          organizationId: input.organizationId,
          applicationId: input.applicationId,
          releaseTag: tag,
        },
      },
    });
    if (existing) {
      return {
        status: 200,
        body: {
          ok: true,
          data: {
            id: existing.id,
            applicationId: existing.applicationId,
            releaseTag: existing.releaseTag,
            status: existing.status,
            created: false,
          },
        },
      };
    }

    const row = await repo.release.create({
      data: {
        organizationId: input.organizationId,
        applicationId: input.applicationId,
        releaseTag: tag,
        status: "draft",
        commitSha: input.commitSha?.toLowerCase() || null,
        plannedWindowStart: plannedStart,
        plannedWindowEnd: plannedEnd,
        summary: input.summary?.trim() || null,
        createdByUserId: input.actorUserId,
      },
    });
    return {
      status: 201,
      body: {
        ok: true,
        data: {
          id: row.id,
          applicationId: row.applicationId,
          releaseTag: row.releaseTag,
          status: row.status,
          created: true,
        },
      },
    };
  } catch (err) {
    if (isMissingTable(err)) {
      return {
        status: 503,
        body: { ok: false, error: "migration_pending", hint: "Release table needs Phase 442 migration." },
      };
    }
    return {
      status: 500,
      body: { ok: false, error: "internal_error", ...(opts.correlationId ? { correlationId: opts.correlationId } : {}) },
    };
  }
}
