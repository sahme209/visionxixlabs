/**
 * Phase 487 — drift finding decide responder.
 *
 * Operator-driven transitions on DriftFinding rows:
 *   - acknowledge: open → acknowledged (we see it, scheduling work).
 *   - suppress:    open|acknowledged → suppressed (intentional drift).
 *   - resolve:     any non-resolved → resolved (state has been
 *                  reconciled).
 *
 * Suppress requires a reason >=10 chars; the other actions don't.
 */

import { isMissingTable } from "./releaseListResponder";

/* ──────────────────────────────────────────────────────────────────
   Repo contract.
   ────────────────────────────────────────────────────────────── */

export interface DriftDecideRow {
  id: string;
  organizationId: string;
  status: string;
}

export interface DriftDecideRepo {
  driftFinding: {
    findUnique(args: { where: { id: string } }): Promise<DriftDecideRow | null>;
    update(args: {
      where: { id: string };
      data: {
        status: "acknowledged" | "suppressed" | "resolved";
        decidedByUserId: string;
        decidedAt: Date;
        decisionReason: string | null;
      };
    }): Promise<{ id: string; status: string }>;
  };
}

/* ──────────────────────────────────────────────────────────────────
   Input + output.
   ────────────────────────────────────────────────────────────── */

export type DriftAction = "acknowledge" | "suppress" | "resolve";

export interface BuildDriftDecideInput {
  organizationId: string;
  actorUserId: string;
  findingId: string;
  action: DriftAction;
  reason?: string;
}

export type DriftDecideError =
  | "finding_not_found"
  | "cross_org_finding"
  | "already_terminal"
  | "suppress_reason_too_short"
  | "illegal_transition";

export type DriftDecideBody =
  | {
      ok: true;
      data: {
        id: string;
        status: "acknowledged" | "suppressed" | "resolved";
        action: DriftAction;
      };
    }
  | { ok: false; error: DriftDecideError | "migration_pending" | "internal_error"; hint?: string; correlationId?: string };

export interface ResponderResult { status: number; body: DriftDecideBody }

/* ──────────────────────────────────────────────────────────────────
   Public surface.
   ────────────────────────────────────────────────────────────── */

export async function buildDriftDecideResponse(
  repo: DriftDecideRepo,
  input: BuildDriftDecideInput,
  opts: { now?: Date; correlationId?: string } = {},
): Promise<ResponderResult> {
  // Pre-flight validation.
  if (input.action === "suppress") {
    const trimmed = (input.reason ?? "").trim();
    if (trimmed.length < 10) {
      return {
        status: 422,
        body: { ok: false, error: "suppress_reason_too_short", hint: "Suppressing drift requires at least 10 chars of justification." },
      };
    }
  }

  try {
    const finding = await repo.driftFinding.findUnique({ where: { id: input.findingId } });
    if (!finding) {
      return { status: 404, body: { ok: false, error: "finding_not_found" } };
    }
    if (finding.organizationId !== input.organizationId) {
      return { status: 403, body: { ok: false, error: "cross_org_finding" } };
    }
    if (finding.status === "resolved") {
      return { status: 409, body: { ok: false, error: "already_terminal", hint: "Finding is already resolved." } };
    }
    if (input.action === "acknowledge" && finding.status !== "open") {
      return {
        status: 409,
        body: { ok: false, error: "illegal_transition", hint: `Cannot acknowledge from status "${finding.status}".` },
      };
    }

    const now = opts.now ?? new Date();
    const reasonTrimmed = input.reason?.trim() ?? null;
    const next: "acknowledged" | "suppressed" | "resolved" =
      input.action === "acknowledge" ? "acknowledged" :
      input.action === "suppress"    ? "suppressed"  : "resolved";

    const updated = await repo.driftFinding.update({
      where: { id: input.findingId },
      data: {
        status: next,
        decidedByUserId: input.actorUserId,
        decidedAt: now,
        decisionReason: reasonTrimmed && reasonTrimmed.length > 0 ? reasonTrimmed : null,
      },
    });

    return {
      status: 200,
      body: { ok: true, data: { id: updated.id, status: next, action: input.action } },
    };
  } catch (err) {
    if (isMissingTable(err)) {
      return {
        status: 503,
        body: { ok: false, error: "migration_pending", hint: "DriftFinding table not migrated yet." },
      };
    }
    return {
      status: 500,
      body: { ok: false, error: "internal_error", ...(opts.correlationId ? { correlationId: opts.correlationId } : {}) },
    };
  }
}
