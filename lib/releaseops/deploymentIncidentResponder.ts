/**
 * Phase 501 — deployment incident responder.
 *
 * State machine: open → mitigated → resolved | wont_fix. Mitigated
 * may transition back to open (regression) or forward to resolved.
 * Resolved + wont_fix are terminal.
 */

import { isMissingTable } from "./releaseListResponder";
import {INCIDENT_STATUSES, INCIDENT_TRANSITIONS, planTransition, type IncidentStatus, type IncidentTransition} from "./deploymentIncidentLifecycle";
export {INCIDENT_STATUSES, INCIDENT_TRANSITIONS, planTransition} from "./deploymentIncidentLifecycle";
export type {IncidentStatus, IncidentTransition, TransitionPlan, TransitionReject} from "./deploymentIncidentLifecycle";

/* ──────────────────────────────────────────────────────────────────
   Closed-unions.
   ────────────────────────────────────────────────────────────── */

export const INCIDENT_SEVERITIES = ["low", "medium", "high", "critical"] as const;
export type IncidentSeverity = (typeof INCIDENT_SEVERITIES)[number];

function isSeverity(s: string): s is IncidentSeverity {
  return (INCIDENT_SEVERITIES as readonly string[]).includes(s);
}
function isStatus(s: string): s is IncidentStatus {
  return (INCIDENT_STATUSES as readonly string[]).includes(s);
}

/* ──────────────────────────────────────────────────────────────────
   Pure state machine.
   ────────────────────────────────────────────────────────────── */

/* ──────────────────────────────────────────────────────────────────
   Repo contract.
   ────────────────────────────────────────────────────────────── */

export interface ReleaseLookupRow { id: string; organizationId: string }

export interface IncidentRow {
  id: string;
  organizationId: string;
  releaseId: string;
  severity: string;
  status: string;
  title: string;
  summary: string | null;
  manualFixId: string | null;
  reportedByUserId: string;
  reportedAt: Date;
  mitigatedByUserId: string | null;
  mitigatedAt: Date | null;
  resolvedByUserId: string | null;
  resolvedAt: Date | null;
  externalUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DeploymentIncidentRepo {
  release: {
    findUnique(args: { where: { id: string } }): Promise<ReleaseLookupRow | null>;
  };
  deploymentIncident: {
    findUnique(args: { where: { id: string } }): Promise<IncidentRow | null>;
    findMany(args: {
      where: { organizationId: string; releaseId?: string; status?: string };
      orderBy: { reportedAt: "desc" };
      take?: number;
    }): Promise<IncidentRow[]>;
    create(args: {
      data: {
        organizationId: string;
        releaseId: string;
        severity: IncidentSeverity;
        status: "open";
        title: string;
        summary: string | null;
        reportedByUserId: string;
        externalUrl: string | null;
      };
    }): Promise<IncidentRow>;
    update(args: {
      where: { id: string; organizationId: string; releaseId: string; status: string; updatedAt: Date };
      data: {
        status: IncidentStatus;
        updatedAt: Date;
        mitigatedByUserId?: string | null;
        mitigatedAt?: Date | null;
        resolvedByUserId?: string | null;
        resolvedAt?: Date | null;
      };
    }): Promise<IncidentRow>;
  };
}

/* ──────────────────────────────────────────────────────────────────
   Projection.
   ────────────────────────────────────────────────────────────── */

export interface IncidentView {
  id: string;
  releaseId: string;
  severity: IncidentSeverity | "unknown";
  status: IncidentStatus | "unknown";
  title: string;
  summary: string | null;
  reportedByUserId: string;
  reportedAtIso: string;
  mitigatedByUserId: string | null;
  mitigatedAtIso: string | null;
  resolvedByUserId: string | null;
  resolvedAtIso: string | null;
  externalUrl: string | null;
  revision?: string;
}

function projectRow(r: IncidentRow): IncidentView {
  return {
    id: r.id,
    releaseId: r.releaseId,
    severity: isSeverity(r.severity) ? r.severity : "unknown",
    status: isStatus(r.status) ? r.status : "unknown",
    title: r.title,
    summary: r.summary,
    reportedByUserId: r.reportedByUserId,
    reportedAtIso: r.reportedAt.toISOString(),
    mitigatedByUserId: r.mitigatedByUserId,
    mitigatedAtIso: r.mitigatedAt ? r.mitigatedAt.toISOString() : null,
    resolvedByUserId: r.resolvedByUserId,
    resolvedAtIso: r.resolvedAt ? r.resolvedAt.toISOString() : null,
    externalUrl: r.externalUrl,
  };
}

/* ──────────────────────────────────────────────────────────────────
   Report (create).
   ────────────────────────────────────────────────────────────── */

export interface ReportInput {
  organizationId: string;
  reportedByUserId: string;
  releaseId: string;
  severity: string;
  title: string;
  summary?: string;
  externalUrl?: string;
}

export type ReportError =
  | "title_required"
  | "severity_invalid"
  | "release_not_found"
  | "cross_org_release";

export type ReportBody =
  | { ok: true; data: { incident: IncidentView } }
  | { ok: false; error: ReportError | "migration_pending" | "internal_error"; hint?: string; correlationId?: string };

export interface ReportResult { status: number; body: ReportBody }

export async function buildIncidentReportResponse(
  repo: DeploymentIncidentRepo,
  input: ReportInput,
  opts: { correlationId?: string } = {},
): Promise<ReportResult> {
  const title = input.title?.trim() ?? "";
  if (!title) return { status: 422, body: { ok: false, error: "title_required" } };
  if (title.length > 200) return { status: 422, body: { ok: false, error: "title_required", hint: "title must be ≤ 200 chars" } };
  if (!isSeverity(input.severity)) {
    return { status: 422, body: { ok: false, error: "severity_invalid", hint: "severity must be one of: low, medium, high, critical" } };
  }

  try {
    const release = await repo.release.findUnique({ where: { id: input.releaseId } });
    if (!release) return { status: 404, body: { ok: false, error: "release_not_found" } };
    if (release.organizationId !== input.organizationId) {
      return { status: 403, body: { ok: false, error: "cross_org_release" } };
    }
    const row = await repo.deploymentIncident.create({
      data: {
        organizationId: release.organizationId,
        releaseId: release.id,
        severity: input.severity,
        status: "open",
        title,
        summary: input.summary?.trim() || null,
        reportedByUserId: input.reportedByUserId,
        externalUrl: input.externalUrl?.trim() || null,
      },
    });
    return { status: 201, body: { ok: true, data: { incident: projectRow(row) } } };
  } catch (err) {
    if (isMissingTable(err)) {
      return {
        status: 503,
        body: { ok: false, error: "migration_pending", hint: "DeploymentIncident table needs Phase 501 migration." },
      };
    }
    return {
      status: 500,
      body: { ok: false, error: "internal_error", ...(opts.correlationId ? { correlationId: opts.correlationId } : {}) },
    };
  }
}

/* ──────────────────────────────────────────────────────────────────
   Transition.
   ────────────────────────────────────────────────────────────── */

export interface TransitionInput {
  organizationId: string;
  actorUserId: string;
  incidentId: string;
  action: IncidentTransition;
}

export type TransitionError =
  | "incident_not_found"
  | "cross_org_incident"
  | "incident_changed"
  | "unknown_current_status"
  | "illegal_transition";

export type TransitionBody =
  | {
      ok: true;
      data: {
        id: string;
        previousStatus: IncidentStatus;
        status: IncidentStatus;
        action: IncidentTransition;
      };
    }
  | { ok: false; error: TransitionError | "migration_pending" | "internal_error"; hint?: string; correlationId?: string };

export interface TransitionResult { status: number; body: TransitionBody }

export async function buildIncidentTransitionResponse(
  repo: DeploymentIncidentRepo,
  input: TransitionInput,
  opts: { now?: Date; correlationId?: string } = {},
): Promise<TransitionResult> {
  if (!(INCIDENT_TRANSITIONS as readonly string[]).includes(input.action)) {
    return { status: 422, body: { ok: false, error: "illegal_transition", hint: `Unknown action "${input.action}".` } };
  }
  try {
    const existing = await repo.deploymentIncident.findUnique({ where: { id: input.incidentId } });
    if (!existing) return { status: 404, body: { ok: false, error: "incident_not_found" } };
    if (existing.organizationId !== input.organizationId) {
      return { status: 403, body: { ok: false, error: "cross_org_incident" } };
    }
    if (!isStatus(existing.status)) {
      return {
        status: 409,
        body: { ok: false, error: "unknown_current_status", hint: `Incident.status="${existing.status}" not in closed-union.` },
      };
    }
    const now = opts.now ?? new Date();
    const plan = planTransition(existing.status as IncidentStatus, input.action, { actorUserId: input.actorUserId, now });
    if (!plan.ok) {
      return {
        status: 409,
        body: { ok: false, error: "illegal_transition", hint: `Cannot ${input.action} from "${existing.status}".` },
      };
    }

    const update: {
      status: IncidentStatus;
      updatedAt: Date;
      mitigatedByUserId?: string | null;
      mitigatedAt?: Date | null;
      resolvedByUserId?: string | null;
      resolvedAt?: Date | null;
    } = { status: plan.next, updatedAt: new Date(Math.max(now.getTime(), existing.updatedAt.getTime() + 1)) };
    if (plan.fields.mitigatedByUserId !== undefined) update.mitigatedByUserId = plan.fields.mitigatedByUserId;
    if (plan.fields.mitigatedAt !== undefined) update.mitigatedAt = plan.fields.mitigatedAt;
    if (plan.fields.resolvedByUserId !== undefined) update.resolvedByUserId = plan.fields.resolvedByUserId;
    if (plan.fields.resolvedAt !== undefined) update.resolvedAt = plan.fields.resolvedAt;

    const {id, organizationId, releaseId, status, updatedAt} = existing;
    await repo.deploymentIncident.update({where: {id, organizationId, releaseId, status, updatedAt}, data: update});
    return {
      status: 200,
      body: {
        ok: true,
        data: {
          id: existing.id,
          previousStatus: existing.status as IncidentStatus,
          status: plan.next,
          action: input.action,
        },
      },
    };
  } catch (err) {
    if (err && typeof err === "object" && "code" in err && err.code === "P2025") {
      return {status: 409, body: {ok: false, error: "incident_changed"}};
    }
    if (isMissingTable(err)) {
      return {
        status: 503,
        body: { ok: false, error: "migration_pending", hint: "DeploymentIncident table needs Phase 501 migration." },
      };
    }
    return {
      status: 500,
      body: { ok: false, error: "internal_error", ...(opts.correlationId ? { correlationId: opts.correlationId } : {}) },
    };
  }
}

/* ──────────────────────────────────────────────────────────────────
   List.
   ────────────────────────────────────────────────────────────── */

export type ListBody =
  | {
      ok: true;
      data: {
        generatedAt: string;
        incidents: IncidentView[];
        summary: {
          total: number;
          open: number;
          mitigated: number;
          resolved: number;
          wontFix: number;
          openCritical: number;
        };
      };
    }
  | { ok: false; error: string; hint?: string; correlationId?: string };

export interface ListResult { status: number; body: ListBody }

export type DeploymentIncidentListRepo = {deploymentIncident: Pick<DeploymentIncidentRepo["deploymentIncident"], "findMany">};

export async function buildIncidentListResponse(
  repo: DeploymentIncidentListRepo,
  input: { organizationId: string; releaseId?: string; status?: string },
  opts: {now?: Date; correlationId?: string; includeRevision?: boolean} = {},
): Promise<ListResult> {
  try {
    const now = opts.now ?? new Date();
    const where: { organizationId: string; releaseId?: string; status?: string } = {
      organizationId: input.organizationId,
    };
    if (input.releaseId) where.releaseId = input.releaseId;
    if (input.status) where.status = input.status;

    const rows = await repo.deploymentIncident.findMany({
      where,
      orderBy: { reportedAt: "desc" },
      take: 200,
    });
    const incidents = rows.map(row => ({
      ...projectRow(row),
      ...(opts.includeRevision && row.updatedAt instanceof Date && {revision: row.updatedAt.toISOString()}),
    }));
    let open = 0, mitigated = 0, resolved = 0, wontFix = 0, openCritical = 0;
    for (const i of incidents) {
      if (i.status === "open") {
        open += 1;
        if (i.severity === "critical") openCritical += 1;
      }
      else if (i.status === "mitigated") mitigated += 1;
      else if (i.status === "resolved") resolved += 1;
      else if (i.status === "wont_fix") wontFix += 1;
    }
    return {
      status: 200,
      body: {
        ok: true,
        data: {
          generatedAt: now.toISOString(),
          incidents,
          summary: { total: incidents.length, open, mitigated, resolved, wontFix, openCritical },
        },
      },
    };
  } catch (err) {
    if (isMissingTable(err)) {
      return {
        status: 503,
        body: { ok: false, error: "migration_pending", hint: "DeploymentIncident table needs Phase 501 migration." },
      };
    }
    return {
      status: 500,
      body: { ok: false, error: "internal_error", ...(opts.correlationId ? { correlationId: opts.correlationId } : {}) },
    };
  }
}
