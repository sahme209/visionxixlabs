/**
 * Phase 495 — manual-fix tracking responder.
 *
 * One responder file that powers three operations on the ManualFix
 * table:
 *   • buildManualFixListResponse      — recent fixes for an org with
 *     pending vs reconciled split, optional releaseId filter.
 *   • buildManualFixLogResponse       — log a new out-of-band fix.
 *   • buildManualFixReconcileResponse — transition pending → reconciled
 *     (or wont_fix), reject illegal transitions.
 *
 * The readiness evaluator's `hasManualProdFixes` signal will count
 * rows where status="pending" AND environmentTier="prod" in a follow-on
 * wire-up phase. The responder itself is pure.
 */

import { isMissingTable } from "./releaseListResponder";

/* ──────────────────────────────────────────────────────────────────
   Closed-unions.
   ────────────────────────────────────────────────────────────── */

export const MANUAL_FIX_STATUSES = ["pending", "reconciled", "wont_fix"] as const;
export type ManualFixStatus = (typeof MANUAL_FIX_STATUSES)[number];

export const MANUAL_FIX_TIERS = ["prod", "staging", "dev", "other"] as const;
export type ManualFixTier = (typeof MANUAL_FIX_TIERS)[number];

function isStatus(s: string): s is ManualFixStatus {
  return (MANUAL_FIX_STATUSES as readonly string[]).includes(s);
}
function isTier(t: string): t is ManualFixTier {
  return (MANUAL_FIX_TIERS as readonly string[]).includes(t);
}

/* ──────────────────────────────────────────────────────────────────
   Repo contract.
   ────────────────────────────────────────────────────────────── */

export interface ManualFixRow {
  id: string;
  organizationId: string;
  releaseId: string | null;
  summary: string;
  status: string;
  environmentTier: string;
  fixedAtIso: Date;
  loggedByUserId: string;
  reconciledByUserId: string | null;
  reconciledAt: Date | null;
  reconciliationRef: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ManualFixRepo {
  manualFix: {
    findMany(args: {
      where: { organizationId: string; releaseId?: string | null };
      orderBy: { fixedAtIso: "desc" };
      take?: number;
    }): Promise<ManualFixRow[]>;
    findUnique(args: { where: { id: string } }): Promise<ManualFixRow | null>;
    create(args: {
      data: {
        organizationId: string;
        releaseId: string | null;
        summary: string;
        status: ManualFixStatus;
        environmentTier: ManualFixTier;
        fixedAtIso: Date;
        loggedByUserId: string;
      };
    }): Promise<ManualFixRow>;
    update(args: {
      where: { id: string };
      data: {
        status: ManualFixStatus;
        reconciledByUserId: string | null;
        reconciledAt: Date | null;
        reconciliationRef: string | null;
      };
    }): Promise<ManualFixRow>;
  };
}

/* ──────────────────────────────────────────────────────────────────
   Projection.
   ────────────────────────────────────────────────────────────── */

export interface ManualFixView {
  id: string;
  releaseId: string | null;
  summary: string;
  status: ManualFixStatus | "unknown";
  environmentTier: ManualFixTier | "unknown";
  fixedAtIso: string;
  loggedByUserId: string;
  reconciledByUserId: string | null;
  reconciledAtIso: string | null;
  reconciliationRef: string | null;
}

function projectRow(r: ManualFixRow): ManualFixView {
  return {
    id: r.id,
    releaseId: r.releaseId,
    summary: r.summary,
    status: isStatus(r.status) ? r.status : "unknown",
    environmentTier: isTier(r.environmentTier) ? r.environmentTier : "unknown",
    fixedAtIso: r.fixedAtIso.toISOString(),
    loggedByUserId: r.loggedByUserId,
    reconciledByUserId: r.reconciledByUserId,
    reconciledAtIso: r.reconciledAt ? r.reconciledAt.toISOString() : null,
    reconciliationRef: r.reconciliationRef,
  };
}

/* ──────────────────────────────────────────────────────────────────
   List.
   ────────────────────────────────────────────────────────────── */

export type ManualFixListBody =
  | {
      ok: true;
      data: {
        generatedAt: string;
        fixes: ManualFixView[];
        summary: {
          total: number;
          pending: number;
          reconciled: number;
          wontFix: number;
          pendingProd: number;
        };
      };
    }
  | { ok: false; error: string; hint?: string; correlationId?: string };

export interface ListResult { status: number; body: ManualFixListBody }

export async function buildManualFixListResponse(
  repo: ManualFixRepo,
  input: { organizationId: string; releaseId?: string | null },
  opts: { now?: Date; correlationId?: string } = {},
): Promise<ListResult> {
  try {
    const now = opts.now ?? new Date();
    const where: { organizationId: string; releaseId?: string | null } = {
      organizationId: input.organizationId,
    };
    if (input.releaseId !== undefined) where.releaseId = input.releaseId;

    const rows = await repo.manualFix.findMany({
      where,
      orderBy: { fixedAtIso: "desc" },
      take: 200,
    });
    const fixes = rows.map(projectRow);
    let pending = 0, reconciled = 0, wontFix = 0, pendingProd = 0;
    for (const f of fixes) {
      if (f.status === "pending") {
        pending += 1;
        if (f.environmentTier === "prod") pendingProd += 1;
      } else if (f.status === "reconciled") reconciled += 1;
      else if (f.status === "wont_fix") wontFix += 1;
    }
    return {
      status: 200,
      body: {
        ok: true,
        data: {
          generatedAt: now.toISOString(),
          fixes,
          summary: { total: fixes.length, pending, reconciled, wontFix, pendingProd },
        },
      },
    };
  } catch (err) {
    if (isMissingTable(err)) {
      return {
        status: 503,
        body: { ok: false, error: "migration_pending", hint: "ManualFix table needs Phase 495 migration." },
      };
    }
    return {
      status: 500,
      body: { ok: false, error: "internal_error", ...(opts.correlationId ? { correlationId: opts.correlationId } : {}) },
    };
  }
}

/* ──────────────────────────────────────────────────────────────────
   Log (create).
   ────────────────────────────────────────────────────────────── */

export interface LogInput {
  organizationId: string;
  loggedByUserId: string;
  summary: string;
  fixedAtIso: string;
  environmentTier: string;
  releaseId?: string | null;
}

export type LogError =
  | "summary_required"
  | "fixed_at_invalid"
  | "tier_invalid";

export type ManualFixLogBody =
  | { ok: true; data: { fix: ManualFixView } }
  | { ok: false; error: LogError | "migration_pending" | "internal_error"; hint?: string; correlationId?: string };

export interface LogResult { status: number; body: ManualFixLogBody }

export async function buildManualFixLogResponse(
  repo: ManualFixRepo,
  input: LogInput,
  opts: { correlationId?: string } = {},
): Promise<LogResult> {
  const summary = input.summary?.trim() ?? "";
  if (summary.length === 0) {
    return { status: 422, body: { ok: false, error: "summary_required" } };
  }
  if (summary.length > 500) {
    return { status: 422, body: { ok: false, error: "summary_required", hint: "summary must be ≤ 500 chars" } };
  }
  const fixedAt = new Date(input.fixedAtIso);
  if (Number.isNaN(fixedAt.getTime())) {
    return { status: 422, body: { ok: false, error: "fixed_at_invalid" } };
  }
  if (!isTier(input.environmentTier)) {
    return {
      status: 422,
      body: { ok: false, error: "tier_invalid", hint: "environmentTier must be one of: prod, staging, dev, other" },
    };
  }

  try {
    const row = await repo.manualFix.create({
      data: {
        organizationId: input.organizationId,
        releaseId: input.releaseId ?? null,
        summary,
        status: "pending",
        environmentTier: input.environmentTier,
        fixedAtIso: fixedAt,
        loggedByUserId: input.loggedByUserId,
      },
    });
    return { status: 201, body: { ok: true, data: { fix: projectRow(row) } } };
  } catch (err) {
    if (isMissingTable(err)) {
      return {
        status: 503,
        body: { ok: false, error: "migration_pending", hint: "ManualFix table needs Phase 495 migration." },
      };
    }
    return {
      status: 500,
      body: { ok: false, error: "internal_error", ...(opts.correlationId ? { correlationId: opts.correlationId } : {}) },
    };
  }
}

/* ──────────────────────────────────────────────────────────────────
   Reconcile (pending → reconciled | wont_fix).
   ────────────────────────────────────────────────────────────── */

export interface ReconcileInput {
  organizationId: string;
  actorUserId: string;
  fixId: string;
  outcome: "reconciled" | "wont_fix";
  reconciliationRef?: string;
}

export type ReconcileError =
  | "fix_not_found"
  | "wrong_org"
  | "outcome_invalid"
  | "not_pending";

export type ManualFixReconcileBody =
  | { ok: true; data: { fix: ManualFixView } }
  | { ok: false; error: ReconcileError | "migration_pending" | "internal_error"; hint?: string; correlationId?: string };

export interface ReconcileResult { status: number; body: ManualFixReconcileBody }

export async function buildManualFixReconcileResponse(
  repo: ManualFixRepo,
  input: ReconcileInput,
  opts: { now?: Date; correlationId?: string } = {},
): Promise<ReconcileResult> {
  if (input.outcome !== "reconciled" && input.outcome !== "wont_fix") {
    return { status: 422, body: { ok: false, error: "outcome_invalid" } };
  }
  try {
    const existing = await repo.manualFix.findUnique({ where: { id: input.fixId } });
    if (!existing) {
      return { status: 404, body: { ok: false, error: "fix_not_found" } };
    }
    if (existing.organizationId !== input.organizationId) {
      return { status: 403, body: { ok: false, error: "wrong_org" } };
    }
    if (existing.status !== "pending") {
      return { status: 409, body: { ok: false, error: "not_pending", hint: `fix is already ${existing.status}` } };
    }
    const updated = await repo.manualFix.update({
      where: { id: input.fixId },
      data: {
        status: input.outcome,
        reconciledByUserId: input.actorUserId,
        reconciledAt: opts.now ?? new Date(),
        reconciliationRef: input.reconciliationRef?.trim() || null,
      },
    });
    return { status: 200, body: { ok: true, data: { fix: projectRow(updated) } } };
  } catch (err) {
    if (isMissingTable(err)) {
      return {
        status: 503,
        body: { ok: false, error: "migration_pending", hint: "ManualFix table needs Phase 495 migration." },
      };
    }
    return {
      status: 500,
      body: { ok: false, error: "internal_error", ...(opts.correlationId ? { correlationId: opts.correlationId } : {}) },
    };
  }
}
