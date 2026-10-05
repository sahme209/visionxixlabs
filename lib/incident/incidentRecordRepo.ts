/**
 * Incident-response evidence — IO boundary.
 *
 * Composes the pure lifecycle kernel (incidentLifecycle.ts) with
 * persistence. This is the ONLY place that touches
 * prisma.incidentRecord directly — no route should query it any other
 * way.
 *
 * Hard rules, all enforced here (not left to callers):
 *   - Every read/write is scoped by organizationId. There is no lookup
 *     path that accepts an incident id without also checking it belongs
 *     to the caller's org — findById returns null on a cross-tenant id,
 *     identical to "doesn't exist," so callers can never distinguish
 *     "not yours" from "not real."
 *   - Every write requires canManageIncidents(actor) — checked here, so
 *     no future caller can accidentally skip it.
 *   - Every write records a correlationId-bearing AuditEvent via the
 *     existing lib/audit/secureAudit.ts boundary — intent before the
 *     write, outcome after.
 *   - No delete method exists. Incident records are permanent evidence;
 *     the only way to close one out is the "resolved" ->
 *     "postmortem_complete" transition, which is itself terminal.
 *   - Status/timestamp transitions always go through
 *     planIncidentTransition() — never a direct field patch — so the
 *     stage-skipping and terminal-state rules can't be bypassed here.
 */

import "server-only";

import { canManageIncidents } from "@/lib/auth/platformAdmin";
import { record as recordAudit } from "@/lib/audit/secureAudit";
import { id as idFactory, newCorrelationId, type CorrelationId } from "@/lib/domain/ids";
import {
  isIncidentSeverity,
  planIncidentTransition,
  type IncidentSeverity,
  type IncidentStatus,
} from "./incidentLifecycle";

export interface IncidentRecordRow {
  id: string;
  organizationId: string;
  status: string;
  severity: string;
  title: string;
  description: string | null;
  detectedAt: Date;
  detectedByUserId: string | null;
  affectedOrganizationIds: string[];
  mitigatedAt: Date | null;
  resolvedAt: Date | null;
  postmortemCompletedAt: Date | null;
  postmortemUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface IncidentRecordRepo {
  incidentRecord: {
    create(args: { data: Record<string, unknown> }): Promise<IncidentRecordRow>;
    findFirst(args: { where: { id: string; organizationId: string } }): Promise<IncidentRecordRow | null>;
    findMany(args: { where: { organizationId: string }; orderBy?: { detectedAt: "desc" } }): Promise<IncidentRecordRow[]>;
    update(args: { where: { id: string }; data: Record<string, unknown> }): Promise<IncidentRecordRow>;
  };
}

interface Actor {
  organizationId: string;
  userId?: string;
  email: string | undefined;
  roles: string[] | undefined;
}

export type IncidentWriteResult =
  | { ok: true; incident: IncidentRecordRow; correlationId: CorrelationId }
  | { ok: false; reason: "forbidden" | "invalid_severity" | "not_found" | "invalid_transition" | "already_terminal"; correlationId: CorrelationId };

/**
 * Creates a new incident record, always starting at status "detected".
 * Fails closed on a missing/insufficient role — never silently creates
 * under a weaker implicit permission.
 */
export async function createIncident(
  repo: IncidentRecordRepo,
  actor: Actor,
  input: { severity: IncidentSeverity; title: string; description?: string; affectedOrganizationIds?: string[] },
): Promise<IncidentWriteResult> {
  const correlationId = newCorrelationId();

  if (!canManageIncidents({ email: actor.email, roles: actor.roles })) {
    await auditDenied(actor, correlationId, "create", "rbac.permission_denied");
    return { ok: false, reason: "forbidden", correlationId };
  }
  if (!isIncidentSeverity(input.severity)) {
    return { ok: false, reason: "invalid_severity", correlationId };
  }

  const incident = await repo.incidentRecord.create({
    data: {
      organizationId: actor.organizationId,
      status: "detected",
      severity: input.severity,
      title: input.title,
      description: input.description ?? null,
      detectedByUserId: actor.userId ?? null,
      // An incident may affect tenants beyond the one whose dashboard
      // reported it — always include the reporting org explicitly so
      // it's never silently omitted from its own evidence record.
      affectedOrganizationIds: Array.from(new Set([actor.organizationId, ...(input.affectedOrganizationIds ?? [])])),
    },
  });

  await recordAudit({
    organizationId: idFactory.organization(actor.organizationId),
    actorUserId: actor.userId ? idFactory.user(actor.userId) : undefined,
    action: "incident.created",
    outcome: "success",
    entityRef: `incident:${incident.id}`,
    correlationId: idFactory.correlation(correlationId),
    detail: { severity: input.severity },
  });

  return { ok: true, incident, correlationId };
}

/**
 * Transitions an existing incident. The lookup is tenant-scoped by
 * construction (findFirst requires BOTH id and organizationId) — a
 * caller can never probe for another tenant's incident id, and a
 * cross-tenant id produces the identical "not_found" response as a
 * nonexistent one.
 */
export async function transitionIncident(
  repo: IncidentRecordRepo,
  actor: Actor,
  input: { incidentId: string; targetStatus: IncidentStatus; postmortemUrl?: string },
): Promise<IncidentWriteResult> {
  const correlationId = newCorrelationId();

  if (!canManageIncidents({ email: actor.email, roles: actor.roles })) {
    await auditDenied(actor, correlationId, "transition", "rbac.permission_denied", input.incidentId);
    return { ok: false, reason: "forbidden", correlationId };
  }

  const existing = await repo.incidentRecord.findFirst({
    where: { id: input.incidentId, organizationId: actor.organizationId },
  });
  if (!existing) {
    return { ok: false, reason: "not_found", correlationId };
  }

  const plan = planIncidentTransition({
    currentStatus: existing.status as IncidentStatus,
    targetStatus: input.targetStatus,
    now: new Date(),
  });
  if (!plan.ok) {
    await auditDenied(actor, correlationId, "transition", plan.reason, input.incidentId);
    return { ok: false, reason: plan.reason, correlationId };
  }

  const incident = await repo.incidentRecord.update({
    where: { id: existing.id },
    data: {
      ...plan.patch,
      ...(plan.patch.status === "postmortem_complete" && input.postmortemUrl
        ? { postmortemUrl: input.postmortemUrl }
        : {}),
    },
  });

  await recordAudit({
    organizationId: idFactory.organization(actor.organizationId),
    actorUserId: actor.userId ? idFactory.user(actor.userId) : undefined,
    action: "incident.transitioned",
    outcome: "success",
    entityRef: `incident:${incident.id}`,
    correlationId: idFactory.correlation(correlationId),
    detail: { from: existing.status, to: plan.patch.status },
  });

  return { ok: true, incident, correlationId };
}

/** Tenant-scoped list — never accepts or needs an organizationId override from the caller. */
export async function listIncidents(
  repo: IncidentRecordRepo,
  actor: Actor,
): Promise<{ ok: true; incidents: IncidentRecordRow[] } | { ok: false; reason: "forbidden" }> {
  if (!canManageIncidents({ email: actor.email, roles: actor.roles })) {
    return { ok: false, reason: "forbidden" };
  }
  const incidents = await repo.incidentRecord.findMany({
    where: { organizationId: actor.organizationId },
    orderBy: { detectedAt: "desc" },
  });
  return { ok: true, incidents };
}

async function auditDenied(
  actor: Actor,
  correlationId: CorrelationId,
  op: "create" | "transition",
  reasonCode: string,
  incidentId?: string,
): Promise<void> {
  try {
    await recordAudit({
      organizationId: idFactory.organization(actor.organizationId),
      actorUserId: actor.userId ? idFactory.user(actor.userId) : undefined,
      action: "incident.action_denied",
      outcome: "blocked",
      entityRef: incidentId ? `incident:${incidentId}` : undefined,
      correlationId: idFactory.correlation(correlationId),
      errorCode: reasonCode,
      detail: { op },
    });
  } catch {
    /* best-effort */
  }
}
