/**
 * Phase 479 — policy violation exception + resolve responder.
 *
 * Operator-driven transitions on PolicyViolation rows:
 *   - grant_exception: open → exception_granted, records approver +
 *     timestamp. Requires the rule to have exceptionAllowed=true and a
 *     reason >= 10 chars.
 *   - resolve: open|exception_granted → resolved. Reason optional.
 *
 * Denial of a request and the explicit "exception_pending" two-step
 * flow are reserved for a follow-on phase — this endpoint handles
 * the operator's "I've reviewed it, here's my decision" path directly.
 */

import { isMissingTable } from "./releaseListResponder";

/* ──────────────────────────────────────────────────────────────────
   Repo contract.
   ────────────────────────────────────────────────────────────── */

export interface ExceptionViolationRow {
  id: string;
  organizationId: string;
  status: string;
  rule: { key: string; exceptionAllowed: boolean };
}

export interface ExceptionUpdatedRow {
  id: string;
  status: string;
  exceptionGrantedByUserId: string | null;
  exceptionGrantedAt: Date | null;
}

export interface PolicyExceptionRepo {
  policyViolation: {
    findUnique(args: { where: { id: string }; include: { rule: true } }): Promise<ExceptionViolationRow | null>;
    update(args: {
      where: { id: string };
      data: {
        status: "exception_granted" | "resolved";
        exceptionGrantedByUserId?: string | null;
        exceptionGrantedAt?: Date | null;
        remediation?: string | null;
      };
    }): Promise<ExceptionUpdatedRow>;
  };
}

/* ──────────────────────────────────────────────────────────────────
   Input + output.
   ────────────────────────────────────────────────────────────── */

export type ExceptionAction = "grant_exception" | "resolve";

export interface BuildPolicyExceptionInput {
  organizationId: string;
  actorUserId: string;
  violationId: string;
  action: ExceptionAction;
  reason?: string;
}

export type ExceptionError =
  | "violation_not_found"
  | "cross_org_violation"
  | "exception_not_allowed"
  | "rule_not_exception_eligible"
  | "reason_too_short"
  | "already_terminal";

export type PolicyExceptionBody =
  | {
      ok: true;
      data: {
        id: string;
        status: "exception_granted" | "resolved";
        action: ExceptionAction;
        exceptionGrantedByUserId: string | null;
        exceptionGrantedAtIso: string | null;
      };
    }
  | { ok: false; error: ExceptionError | "migration_pending" | "internal_error"; hint?: string; correlationId?: string };

export interface ResponderResult { status: number; body: PolicyExceptionBody }

/* ──────────────────────────────────────────────────────────────────
   Public surface.
   ────────────────────────────────────────────────────────────── */

export async function buildPolicyExceptionResponse(
  repo: PolicyExceptionRepo,
  input: BuildPolicyExceptionInput,
  opts: { now?: Date; correlationId?: string } = {},
): Promise<ResponderResult> {
  // Pre-flight validations.
  if (input.action === "grant_exception") {
    const trimmed = (input.reason ?? "").trim();
    if (trimmed.length < 10) {
      return { status: 422, body: { ok: false, error: "reason_too_short", hint: "Granting an exception requires at least 10 chars of justification." } };
    }
  }

  try {
    const violation = await repo.policyViolation.findUnique({ where: { id: input.violationId }, include: { rule: true } });
    if (!violation) {
      return { status: 404, body: { ok: false, error: "violation_not_found" } };
    }
    if (violation.organizationId !== input.organizationId) {
      return { status: 403, body: { ok: false, error: "cross_org_violation" } };
    }
    if (violation.status === "exception_granted" || violation.status === "resolved") {
      return {
        status: 409,
        body: {
          ok: false,
          error: "already_terminal",
          hint: `Violation is already in terminal state "${violation.status}".`,
        },
      };
    }

    if (input.action === "grant_exception") {
      if (!violation.rule.exceptionAllowed) {
        return {
          status: 422,
          body: { ok: false, error: "rule_not_exception_eligible", hint: `Rule "${violation.rule.key}" was configured with exceptionAllowed=false.` },
        };
      }
      const now = opts.now ?? new Date();
      const updated = await repo.policyViolation.update({
        where: { id: input.violationId },
        data: {
          status: "exception_granted",
          exceptionGrantedByUserId: input.actorUserId,
          exceptionGrantedAt: now,
          // Append the operator reason to the remediation field so it
          // survives the next engine re-evaluation as evidence.
          remediation: `[exception ${now.toISOString()} by ${input.actorUserId}] ${(input.reason ?? "").trim()}`,
        },
      });
      return {
        status: 200,
        body: {
          ok: true,
          data: {
            id: updated.id,
            status: "exception_granted",
            action: "grant_exception",
            exceptionGrantedByUserId: updated.exceptionGrantedByUserId,
            exceptionGrantedAtIso: updated.exceptionGrantedAt ? updated.exceptionGrantedAt.toISOString() : null,
          },
        },
      };
    }

    // action === "resolve"
    const updated = await repo.policyViolation.update({
      where: { id: input.violationId },
      data: { status: "resolved" },
    });
    return {
      status: 200,
      body: {
        ok: true,
        data: {
          id: updated.id,
          status: "resolved",
          action: "resolve",
          exceptionGrantedByUserId: updated.exceptionGrantedByUserId,
          exceptionGrantedAtIso: updated.exceptionGrantedAt ? updated.exceptionGrantedAt.toISOString() : null,
        },
      },
    };
  } catch (err) {
    if (isMissingTable(err)) {
      return {
        status: 503,
        body: { ok: false, error: "migration_pending", hint: "PolicyViolation table not migrated yet." },
      };
    }
    return {
      status: 500,
      body: { ok: false, error: "internal_error", ...(opts.correlationId ? { correlationId: opts.correlationId } : {}) },
    };
  }
}
