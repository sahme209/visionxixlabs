/**
 * Phase 496 — audit event log responder.
 *
 * Two surfaces here:
 *   • appendAuditEvent — best-effort write helper other responders can
 *     call after a successful state-change. Never throws; on failure
 *     logs and returns false (audit must not block business writes).
 *   • buildAuditEventListResponse — chronological inbox for the
 *     dashboard + desktop. Supports optional subject filter
 *     (subjectKind+subjectId) and kind filter.
 *
 * Closed-unions on kind/subjectKind/outcome are application-layer.
 * The schema stays free-form text so new event types can land without
 * a migration.
 */

import { isMissingTable } from "./releaseListResponder";

/* ──────────────────────────────────────────────────────────────────
   Closed-unions (advisory — schema is free-string).
   ────────────────────────────────────────────────────────────── */

export const AUDIT_SUBJECT_KINDS = [
  "release",
  "cherry_pick",
  "manual_fix",
  "repository",
  "application",
  "policy",
  "drift_finding",
  "change_ticket",
  "release_freeze",
  "branch_validation",
  "environment",
  "deployment_execution",
  "identity_provider",
] as const;
export type AuditSubjectKind = (typeof AUDIT_SUBJECT_KINDS)[number];

export const AUDIT_OUTCOMES = ["ok", "rejected", "error", "skipped"] as const;
export type AuditOutcome = (typeof AUDIT_OUTCOMES)[number];

function isSubjectKind(s: string): s is AuditSubjectKind {
  return (AUDIT_SUBJECT_KINDS as readonly string[]).includes(s);
}
function isOutcome(s: string): s is AuditOutcome {
  return (AUDIT_OUTCOMES as readonly string[]).includes(s);
}

/* ──────────────────────────────────────────────────────────────────
   Repo contract.
   ────────────────────────────────────────────────────────────── */

export interface AuditEventRow {
  id: string;
  organizationId: string;
  kind: string;
  subjectKind: string;
  subjectId: string;
  outcome: string;
  summary: string;
  detailJson: unknown;
  actorUserId: string | null;
  correlationId: string | null;
  createdAt: Date;
}

export interface AuditEventRepo {
  auditEvent: {
    create(args: {
      data: {
        organizationId: string;
        kind: string;
        subjectKind: string;
        subjectId: string;
        outcome: string;
        summary: string;
        detailJson?: unknown;
        actorUserId: string | null;
        correlationId: string | null;
      };
    }): Promise<AuditEventRow>;
    findMany(args: {
      where: {
        organizationId: string;
        kind?: string;
        subjectKind?: string;
        subjectId?: string;
      };
      orderBy: { createdAt: "desc" };
      take?: number;
    }): Promise<AuditEventRow[]>;
  };
}

/* ──────────────────────────────────────────────────────────────────
   Append helper — best-effort, never throws.
   ────────────────────────────────────────────────────────────── */

export interface AppendAuditEventInput {
  organizationId: string;
  kind: string;
  subjectKind: string;
  subjectId: string;
  outcome?: string;
  summary: string;
  actorUserId?: string | null;
  correlationId?: string | null;
  detailJson?: unknown;
}

/**
 * Insert a new audit row. Returns true on success. Swallows every
 * failure (including missing table during migration drag) so the
 * caller can keep going — the audit log is observability, not a
 * blocking write.
 */
export async function appendAuditEvent(
  repo: AuditEventRepo,
  input: AppendAuditEventInput,
): Promise<boolean> {
  try {
    await repo.auditEvent.create({
      data: {
        organizationId: input.organizationId,
        kind: input.kind,
        subjectKind: input.subjectKind,
        subjectId: input.subjectId,
        outcome: input.outcome ?? "ok",
        summary: input.summary,
        actorUserId: input.actorUserId ?? null,
        correlationId: input.correlationId ?? null,
        ...(input.detailJson !== undefined ? { detailJson: input.detailJson } : {}),
      },
    });
    return true;
  } catch {
    return false;
  }
}

/* ──────────────────────────────────────────────────────────────────
   List responder.
   ────────────────────────────────────────────────────────────── */

export interface AuditEventView {
  id: string;
  kind: string;
  subjectKind: AuditSubjectKind | "unknown";
  subjectId: string;
  outcome: AuditOutcome | "unknown";
  summary: string;
  actorUserId: string | null;
  correlationId: string | null;
  createdAtIso: string;
}

function projectRow(r: AuditEventRow): AuditEventView {
  return {
    id: r.id,
    kind: r.kind,
    subjectKind: isSubjectKind(r.subjectKind) ? r.subjectKind : "unknown",
    subjectId: r.subjectId,
    outcome: isOutcome(r.outcome) ? r.outcome : "unknown",
    summary: r.summary,
    actorUserId: r.actorUserId,
    correlationId: r.correlationId,
    createdAtIso: r.createdAt.toISOString(),
  };
}

export interface AuditEventListInput {
  organizationId: string;
  kind?: string;
  subjectKind?: string;
  subjectId?: string;
  limit?: number;
}

export type AuditEventListBody =
  | {
      ok: true;
      data: {
        generatedAt: string;
        events: AuditEventView[];
        summary: {
          total: number;
          byOutcome: Record<string, number>;
          byKind: Record<string, number>;
        };
      };
    }
  | { ok: false; error: string; hint?: string; correlationId?: string };

export interface ListResult { status: number; body: AuditEventListBody }

export async function buildAuditEventListResponse(
  repo: AuditEventRepo,
  input: AuditEventListInput,
  opts: { now?: Date; correlationId?: string } = {},
): Promise<ListResult> {
  try {
    const now = opts.now ?? new Date();
    const where: { organizationId: string; kind?: string; subjectKind?: string; subjectId?: string } = {
      organizationId: input.organizationId,
    };
    if (input.kind) where.kind = input.kind;
    if (input.subjectKind) where.subjectKind = input.subjectKind;
    if (input.subjectId) where.subjectId = input.subjectId;

    const rows = await repo.auditEvent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: Math.min(input.limit ?? 200, 500),
    });

    const events = rows.map(projectRow);
    const byOutcome: Record<string, number> = {};
    const byKind: Record<string, number> = {};
    for (const e of events) {
      byOutcome[e.outcome] = (byOutcome[e.outcome] ?? 0) + 1;
      byKind[e.kind] = (byKind[e.kind] ?? 0) + 1;
    }

    return {
      status: 200,
      body: {
        ok: true,
        data: {
          generatedAt: now.toISOString(),
          events,
          summary: { total: events.length, byOutcome, byKind },
        },
      },
    };
  } catch (err) {
    if (isMissingTable(err)) {
      return {
        status: 503,
        body: { ok: false, error: "migration_pending", hint: "AuditEvent table needs Phase 496 migration." },
      };
    }
    return {
      status: 500,
      body: { ok: false, error: "internal_error", ...(opts.correlationId ? { correlationId: opts.correlationId } : {}) },
    };
  }
}
