/**
 * Phase 468 — cherry-pick exception submit responder.
 *
 * Operator submits an exception request via the dashboard. The
 * responder:
 *   1. Validates the release + repository exist and belong to the org
 *   2. Runs the Phase 457 validators (rationale length, approved list
 *      non-empty, no approved/excluded overlap)
 *   3. Inserts a new CherryPickException row with status="requested"
 *
 * Two-person rule (requester ≠ approver) is enforced at the
 * approve/deny endpoint, not here — anyone in the org can request.
 */

import { isMissingTable } from "./releaseListResponder";

/* ──────────────────────────────────────────────────────────────────
   Repo contract.
   ────────────────────────────────────────────────────────────── */

export interface CherryPickReleaseLookup {
  id: string;
  organizationId: string;
}

export interface CherryPickRepositoryLookup {
  id: string;
  organizationId: string;
}

export interface CherryPickInserted {
  id: string;
  status: string;
  rationale: string;
  approvedPrIds: string[];
  excludedPrIds: string[];
  requestedByUserId: string;
  requestedAt: Date;
}

export interface CherryPickSubmitRepo {
  release: {
    findUnique(args: { where: { id: string } }): Promise<CherryPickReleaseLookup | null>;
  };
  repository: {
    findUnique(args: { where: { id: string } }): Promise<CherryPickRepositoryLookup | null>;
  };
  cherryPickException: {
    create(args: {
      data: {
        organizationId: string;
        releaseId: string;
        repositoryId: string;
        status: "requested";
        rationale: string;
        approvedPrIds: string[];
        excludedPrIds: string[];
        hasFinalCommitValidation: false;
        requestedByUserId: string;
      };
    }): Promise<CherryPickInserted>;
  };
}

/* ──────────────────────────────────────────────────────────────────
   Input + output.
   ────────────────────────────────────────────────────────────── */

export interface BuildCherryPickSubmitInput {
  organizationId: string;
  requestedByUserId: string;
  releaseId: string;
  repositoryId: string;
  rationale: string;
  approvedPrIds: ReadonlyArray<string>;
  excludedPrIds: ReadonlyArray<string>;
}

export type SubmitError =
  | "release_not_found"
  | "cross_org_release"
  | "repository_not_found"
  | "cross_org_repository"
  | "rationale_too_short"
  | "approved_list_empty"
  | "approved_and_excluded_overlap";

export type CherryPickSubmitBody =
  | {
      ok: true;
      data: {
        id: string;
        status: string;
        rationale: string;
        approvedCount: number;
        excludedCount: number;
        requestedByUserId: string;
        requestedAtIso: string;
      };
    }
  | { ok: false; error: SubmitError | "migration_pending" | "internal_error"; hint?: string; correlationId?: string };

export interface ResponderResult { status: number; body: CherryPickSubmitBody }

/* ──────────────────────────────────────────────────────────────────
   Public surface.
   ────────────────────────────────────────────────────────────── */

export async function buildCherryPickSubmitResponse(
  repo: CherryPickSubmitRepo,
  input: BuildCherryPickSubmitInput,
  opts: { correlationId?: string } = {},
): Promise<ResponderResult> {
  // Local validation first — no DB hit needed.
  const validation = validateInputLocally(input);
  if (validation) {
    return { status: 422, body: { ok: false, error: validation } };
  }

  try {
    const release = await repo.release.findUnique({ where: { id: input.releaseId } });
    if (!release) {
      return { status: 404, body: { ok: false, error: "release_not_found" } };
    }
    if (release.organizationId !== input.organizationId) {
      return { status: 403, body: { ok: false, error: "cross_org_release" } };
    }
    const repository = await repo.repository.findUnique({ where: { id: input.repositoryId } });
    if (!repository) {
      return { status: 404, body: { ok: false, error: "repository_not_found" } };
    }
    if (repository.organizationId !== input.organizationId) {
      return { status: 403, body: { ok: false, error: "cross_org_repository" } };
    }

    const row = await repo.cherryPickException.create({
      data: {
        organizationId: input.organizationId,
        releaseId: input.releaseId,
        repositoryId: input.repositoryId,
        status: "requested",
        rationale: input.rationale.trim(),
        approvedPrIds: Array.from(input.approvedPrIds),
        excludedPrIds: Array.from(input.excludedPrIds),
        hasFinalCommitValidation: false,
        requestedByUserId: input.requestedByUserId,
      },
    });

    return {
      status: 201,
      body: {
        ok: true,
        data: {
          id: row.id,
          status: row.status,
          rationale: row.rationale,
          approvedCount: row.approvedPrIds.length,
          excludedCount: row.excludedPrIds.length,
          requestedByUserId: row.requestedByUserId,
          requestedAtIso: row.requestedAt.toISOString(),
        },
      },
    };
  } catch (err) {
    if (isMissingTable(err)) {
      return {
        status: 503,
        body: { ok: false, error: "migration_pending", hint: "Phase 466 migration not yet applied." },
      };
    }
    return {
      status: 500,
      body: { ok: false, error: "internal_error", ...(opts.correlationId ? { correlationId: opts.correlationId } : {}) },
    };
  }
}

/* ──────────────────────────────────────────────────────────────────
   Pure local validation — mirrors Phase 457's validateCherryPickRequest
   but doesn't need the diff (we'll layer that on if/when the form
   pulls it).
   ────────────────────────────────────────────────────────────── */

export function validateInputLocally(input: BuildCherryPickSubmitInput): SubmitError | null {
  if (input.rationale.trim().length < 20) return "rationale_too_short";
  if (input.approvedPrIds.length === 0) return "approved_list_empty";
  const approved = new Set(input.approvedPrIds);
  for (const id of input.excludedPrIds) {
    if (approved.has(id)) return "approved_and_excluded_overlap";
  }
  return null;
}
