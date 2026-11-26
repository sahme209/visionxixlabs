/**
 * Phase 469 — cherry-pick approve/deny responder.
 *
 * Approver clicks Approve or Deny on a "requested" row. The responder:
 *   1. Loads the row, checks org isolation
 *   2. Enforces the 2-person rule: approver != requester
 *   3. Runs the Phase 457 transitionCherryPick state machine
 *   4. Writes back status + decidedByUserId + decidedAt +
 *      decisionReason
 *
 * Deny requires a non-empty reason (>=10 chars after trim); approve
 * does not — operators can wave through cleanly-scoped exceptions
 * without writing prose.
 */

import { isMissingTable } from "./releaseListResponder";
import {
  transitionCherryPick,
  ALL_CHERRY_PICK_STATUSES,
  type CherryPickStatus,
} from "./cherryPickWorkflow";

/* ──────────────────────────────────────────────────────────────────
   Repo contract.
   ────────────────────────────────────────────────────────────── */

export interface CherryPickDecideRow {
  id: string;
  organizationId: string;
  status: string;
  requestedByUserId: string;
}

export interface CherryPickDecideUpdated {
  id: string;
  status: string;
  decidedByUserId: string | null;
  decidedAt: Date | null;
  decisionReason: string | null;
}

export interface CherryPickDecideRepo {
  cherryPickException: {
    findUnique(args: { where: { id: string } }): Promise<CherryPickDecideRow | null>;
    update(args: {
      where: { id: string };
      data: {
        status: "approved" | "denied";
        decidedByUserId: string;
        decidedAt: Date;
        decisionReason: string | null;
      };
    }): Promise<CherryPickDecideUpdated>;
    /** Conditional decision: only a row still in the status that was read is decided. */
    updateMany(args: {
      where: { id: string; organizationId: string; status: CherryPickStatus };
      data: {
        status: "approved" | "denied";
        decidedByUserId: string;
        decidedAt: Date;
        decisionReason: string | null;
      };
    }): Promise<{ count: number }>;
  };
}

/* ──────────────────────────────────────────────────────────────────
   Input + output.
   ────────────────────────────────────────────────────────────── */

export type Decision = "approve" | "deny";

export interface BuildCherryPickDecideInput {
  organizationId: string;
  approverUserId: string;
  exceptionId: string;
  decision: Decision;
  reason?: string;
}

export type DecideError =
  | "exception_not_found"
  | "cross_org_exception"
  | "two_person_rule_violation"
  | "deny_reason_too_short"
  | "illegal_transition"
  | "unknown_current_status";

export type CherryPickDecideBody =
  | {
      ok: true;
      data: {
        id: string;
        status: CherryPickStatus;
        decidedByUserId: string;
        decidedAtIso: string;
        decisionReason: string | null;
      };
    }
  | { ok: false; error: DecideError | "migration_pending" | "internal_error"; hint?: string; correlationId?: string };

export interface ResponderResult { status: number; body: CherryPickDecideBody }

/* ──────────────────────────────────────────────────────────────────
   Public surface.
   ────────────────────────────────────────────────────────────── */

export async function buildCherryPickDecideResponse(
  repo: CherryPickDecideRepo,
  input: BuildCherryPickDecideInput,
  opts: { now?: Date; correlationId?: string } = {},
): Promise<ResponderResult> {
  // Local validation first.
  if (input.decision === "deny") {
    const trimmed = (input.reason ?? "").trim();
    if (trimmed.length < 10) {
      return { status: 422, body: { ok: false, error: "deny_reason_too_short", hint: "Deny requires at least 10 chars of reason." } };
    }
  }

  try {
    const row = await repo.cherryPickException.findUnique({ where: { id: input.exceptionId } });
    if (!row) {
      return { status: 404, body: { ok: false, error: "exception_not_found" } };
    }
    if (row.organizationId !== input.organizationId) {
      return { status: 403, body: { ok: false, error: "cross_org_exception" } };
    }
    if (row.requestedByUserId === input.approverUserId) {
      return {
        status: 403,
        body: {
          ok: false,
          error: "two_person_rule_violation",
          hint: "Approver must differ from requester — find another operator to decide this exception.",
        },
      };
    }

    if (!(ALL_CHERRY_PICK_STATUSES as readonly string[]).includes(row.status)) {
      return { status: 409, body: { ok: false, error: "unknown_current_status", hint: `Row carries status="${row.status}" outside the closed-union; cannot transition.` } };
    }
    const current = row.status as CherryPickStatus;

    const event = input.decision === "approve"
      ? { kind: "approver_granted" as const, approverUserId: input.approverUserId }
      : { kind: "approver_denied" as const, approverUserId: input.approverUserId, reason: (input.reason ?? "").trim() };
    const transition = transitionCherryPick(current, event);
    if (!transition.ok) {
      return {
        status: 409,
        body: {
          ok: false,
          error: "illegal_transition",
          hint: `Cannot ${input.decision} from status "${current}" — only "requested" rows are decidable.`,
        },
      };
    }

    const now = opts.now ?? new Date();
    const reasonTrimmed = input.reason?.trim() ?? null;
    // Two approvers deciding at once must not both win; claim the row in its current status.
    const claimed = await repo.cherryPickException.updateMany({
      where: { id: input.exceptionId, organizationId: input.organizationId, status: current },
      data: {
        status: transition.next as "approved" | "denied",
        decidedByUserId: input.approverUserId,
        decidedAt: now,
        decisionReason: reasonTrimmed && reasonTrimmed.length > 0 ? reasonTrimmed : null,
      },
    });
    if (claimed.count !== 1) {
      return { status: 409, body: { ok: false, error: "illegal_transition", hint: "Another approver decided this exception first. Reload to see the decision." } };
    }
    const updated: CherryPickDecideUpdated = {
      id: input.exceptionId,
      status: transition.next,
      decidedByUserId: input.approverUserId,
      decidedAt: now,
      decisionReason: reasonTrimmed && reasonTrimmed.length > 0 ? reasonTrimmed : null,
    };

    return {
      status: 200,
      body: {
        ok: true,
        data: {
          id: updated.id,
          status: updated.status as CherryPickStatus,
          decidedByUserId: updated.decidedByUserId ?? input.approverUserId,
          decidedAtIso: (updated.decidedAt ?? now).toISOString(),
          decisionReason: updated.decisionReason,
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
