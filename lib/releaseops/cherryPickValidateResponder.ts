/**
 * Phase 492 — cherry-pick final-commit validation toggle.
 *
 * Operator confirms (or un-confirms) that the final release tag
 * contains only the approved commits — the missing write path that
 * Phase 457's `hasFinalCommitValidation` column was modeled for.
 *
 * Only legal on "approved" exceptions; the Phase 457 state machine's
 * `operator_validated_final_commits` event mirrors this transition.
 */

import { isMissingTable } from "./releaseListResponder";
import { transitionCherryPick, type CherryPickStatus, ALL_CHERRY_PICK_STATUSES } from "./cherryPickWorkflow";

/* ──────────────────────────────────────────────────────────────────
   Repo contract.
   ────────────────────────────────────────────────────────────── */

export interface ValidateRow {
  id: string;
  organizationId: string;
  status: string;
  hasFinalCommitValidation: boolean;
}

export interface CherryPickValidateRepo {
  cherryPickException: {
    findUnique(args: { where: { id: string } }): Promise<ValidateRow | null>;
    update(args: {
      where: { id: string };
      data: { hasFinalCommitValidation: boolean };
    }): Promise<{ id: string; hasFinalCommitValidation: boolean }>;
  };
}

/* ──────────────────────────────────────────────────────────────────
   Input + output.
   ────────────────────────────────────────────────────────────── */

export interface BuildValidateInput {
  organizationId: string;
  actorUserId: string;
  exceptionId: string;
  /** true = mark validated; false = unmark (operator changed mind). */
  validated: boolean;
}

export type ValidateError =
  | "exception_not_found"
  | "cross_org_exception"
  | "unknown_current_status"
  | "not_approved"        // can't validate a denied / requested / superseded row
  | "no_change";

export type CherryPickValidateBody =
  | {
      ok: true;
      data: {
        id: string;
        hasFinalCommitValidation: boolean;
      };
    }
  | { ok: false; error: ValidateError | "migration_pending" | "internal_error"; hint?: string; correlationId?: string };

export interface ResponderResult { status: number; body: CherryPickValidateBody }

/* ──────────────────────────────────────────────────────────────────
   Public surface.
   ────────────────────────────────────────────────────────────── */

export async function buildCherryPickValidateResponse(
  repo: CherryPickValidateRepo,
  input: BuildValidateInput,
  opts: { correlationId?: string } = {},
): Promise<ResponderResult> {
  try {
    const row = await repo.cherryPickException.findUnique({ where: { id: input.exceptionId } });
    if (!row) {
      return { status: 404, body: { ok: false, error: "exception_not_found" } };
    }
    if (row.organizationId !== input.organizationId) {
      return { status: 403, body: { ok: false, error: "cross_org_exception" } };
    }
    if (!(ALL_CHERRY_PICK_STATUSES as readonly string[]).includes(row.status)) {
      return { status: 409, body: { ok: false, error: "unknown_current_status" } };
    }
    const current = row.status as CherryPickStatus;
    if (current !== "approved") {
      // Honor the state machine — operator_validated_final_commits
      // only fires while the exception is approved (Phase 457
      // transitionCherryPick allows requested too, but we tighten
      // the API to require explicit approval first).
      return {
        status: 409,
        body: { ok: false, error: "not_approved", hint: `Exception must be approved before validating final commits — currently "${current}".` },
      };
    }
    // Run the Phase 457 state machine — confirms the transition is legal.
    // Only fire the kernel when actually marking validated=true.
    if (input.validated) {
      const transition = transitionCherryPick(current, {
        kind: "operator_validated_final_commits",
        operatorUserId: input.actorUserId,
      });
      if (!transition.ok) {
        return { status: 409, body: { ok: false, error: "not_approved" } };
      }
    }

    if (row.hasFinalCommitValidation === input.validated) {
      return { status: 200, body: { ok: false, error: "no_change", hint: "Already in the requested state." } };
    }

    const updated = await repo.cherryPickException.update({
      where: { id: row.id },
      data: { hasFinalCommitValidation: input.validated },
    });

    return {
      status: 200,
      body: { ok: true, data: { id: updated.id, hasFinalCommitValidation: updated.hasFinalCommitValidation } },
    };
  } catch (err) {
    if (isMissingTable(err)) {
      return { status: 503, body: { ok: false, error: "migration_pending", hint: "Phase 466 migration not yet applied." } };
    }
    return {
      status: 500,
      body: { ok: false, error: "internal_error", ...(opts.correlationId ? { correlationId: opts.correlationId } : {}) },
    };
  }
}
