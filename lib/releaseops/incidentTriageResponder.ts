/**
 * Phase 509 — IncidentTriage persistence responder.
 *
 * Bridges the pure triage engine to the DB. Three surfaces:
 *   • buildTriageGenerateResponse  — runs engine for a single
 *     incident, supersedes prior pending triage (dismissed), inserts new.
 *   • buildTriageListResponse      — inbox.
 *   • buildTriageDecisionResponse  — operator transitions pending
 *     → accepted | overridden | dismissed.
 */

import { isMissingTable } from "./releaseListResponder";
import {
  triageDeploymentIncident,
  INCIDENT_TRIAGE_ENGINE_VERSION,
  TRIAGE_PRIORITIES,
  type IncidentTriageInputs,
  type TriagePriority,
} from "./incidentTriageEngine";

/* ──────────────────────────────────────────────────────────────────
   Closed-unions.
   ────────────────────────────────────────────────────────────── */

export const TRIAGE_DECISIONS = ["pending", "accepted", "overridden", "dismissed"] as const;
export type TriageDecision = (typeof TRIAGE_DECISIONS)[number];

export const TRIAGE_TRANSITIONS = ["accept", "override", "dismiss"] as const;
export type TriageTransition = (typeof TRIAGE_TRANSITIONS)[number];

function isDecision(s: string): s is TriageDecision {
  return (TRIAGE_DECISIONS as readonly string[]).includes(s);
}
function isPriority(s: string): s is TriagePriority {
  return (TRIAGE_PRIORITIES as readonly string[]).includes(s);
}

/* ──────────────────────────────────────────────────────────────────
   Pure transition.
   ────────────────────────────────────────────────────────────── */

export interface TransitionPlan {
  ok: true;
  next: TriageDecision;
}
export interface TransitionReject {
  ok: false;
  reason: "illegal_transition";
  from: TriageDecision;
  action: TriageTransition;
}

export function planTriageDecision(
  current: TriageDecision,
  action: TriageTransition,
): TransitionPlan | TransitionReject {
  if (current !== "pending") return { ok: false, reason: "illegal_transition", from: current, action };
  if (action === "accept") return { ok: true, next: "accepted" };
  if (action === "override") return { ok: true, next: "overridden" };
  if (action === "dismiss") return { ok: true, next: "dismissed" };
  return { ok: false, reason: "illegal_transition", from: current, action };
}

/* ──────────────────────────────────────────────────────────────────
   Repo contract.
   ────────────────────────────────────────────────────────────── */

export interface TriageRow {
  id: string;
  organizationId: string;
  incidentId: string;
  priority: string;
  suggestedOwnerTeam: string;
  estimatedTimeToMitigateMinutes: number;
  recommendedRunbook: string | null;
  autoEscalate: boolean;
  confidence: number;
  rationale: string;
  inputsJson: unknown;
  operatorDecision: string;
  decidedByUserId: string | null;
  decidedAt: Date | null;
  decisionNote: string | null;
  overridePriority: string | null;
  engineVersion: string;
  generatedAt: Date;
  updatedAt: Date;
}

export interface IncidentLookupRow {
  id: string;
  organizationId: string;
  severity: string;
  status: string;
}

export interface IncidentTriageRepo {
  deploymentIncident: {
    findUnique(args: { where: { id: string } }): Promise<IncidentLookupRow | null>;
  };
  incidentTriage: {
    findUnique(args: { where: { id: string } }): Promise<TriageRow | null>;
    findMany(args: {
      where: { organizationId: string; incidentId?: string; operatorDecision?: string };
      orderBy: { generatedAt: "desc" };
      take?: number;
    }): Promise<TriageRow[]>;
    updateMany(args: {
      where: { organizationId: string; incidentId: string; operatorDecision: "pending" };
      data: { operatorDecision: "dismissed" };
    }): Promise<{ count: number }>;
    create(args: {
      data: {
        organizationId: string;
        incidentId: string;
        priority: TriagePriority;
        suggestedOwnerTeam: string;
        estimatedTimeToMitigateMinutes: number;
        recommendedRunbook: string | null;
        autoEscalate: boolean;
        confidence: number;
        rationale: string;
        inputsJson: unknown;
        operatorDecision: "pending";
        engineVersion: string;
      };
    }): Promise<TriageRow>;
    update(args: {
      where: { id: string };
      data: {
        operatorDecision: TriageDecision;
        decidedByUserId: string;
        decidedAt: Date;
        decisionNote?: string | null;
        overridePriority?: string | null;
      };
    }): Promise<TriageRow>;
  };
}

/* ──────────────────────────────────────────────────────────────────
   Projection.
   ────────────────────────────────────────────────────────────── */

export interface TriageView {
  id: string;
  incidentId: string;
  priority: TriagePriority | "unknown";
  suggestedOwnerTeam: string;
  estimatedTimeToMitigateMinutes: number;
  recommendedRunbook: string | null;
  autoEscalate: boolean;
  confidence: number;
  rationale: string;
  operatorDecision: TriageDecision | "unknown";
  decidedByUserId: string | null;
  decidedAtIso: string | null;
  decisionNote: string | null;
  overridePriority: string | null;
  engineVersion: string;
  generatedAtIso: string;
}

function projectRow(r: TriageRow): TriageView {
  return {
    id: r.id,
    incidentId: r.incidentId,
    priority: isPriority(r.priority) ? r.priority : "unknown",
    suggestedOwnerTeam: r.suggestedOwnerTeam,
    estimatedTimeToMitigateMinutes: r.estimatedTimeToMitigateMinutes,
    recommendedRunbook: r.recommendedRunbook,
    autoEscalate: r.autoEscalate,
    confidence: r.confidence,
    rationale: r.rationale,
    operatorDecision: isDecision(r.operatorDecision) ? r.operatorDecision : "unknown",
    decidedByUserId: r.decidedByUserId,
    decidedAtIso: r.decidedAt ? r.decidedAt.toISOString() : null,
    decisionNote: r.decisionNote,
    overridePriority: r.overridePriority,
    engineVersion: r.engineVersion,
    generatedAtIso: r.generatedAt.toISOString(),
  };
}

/* ──────────────────────────────────────────────────────────────────
   Generate.
   ────────────────────────────────────────────────────────────── */

export interface GenerateInput {
  organizationId: string;
  incidentId: string;
  engineInputs: IncidentTriageInputs;
}

export type GenerateError = "incident_not_found" | "cross_org_incident";

export type GenerateBody =
  | {
      ok: true;
      data: {
        generatedAt: string;
        triage: TriageView;
        supersededCount: number;
      };
    }
  | { ok: false; error: GenerateError | "migration_pending" | "internal_error"; hint?: string; correlationId?: string };

export interface GenerateResult { status: number; body: GenerateBody }

export async function buildTriageGenerateResponse(
  repo: IncidentTriageRepo,
  input: GenerateInput,
  opts: { correlationId?: string } = {},
): Promise<GenerateResult> {
  try {
    const incident = await repo.deploymentIncident.findUnique({ where: { id: input.incidentId } });
    if (!incident) return { status: 404, body: { ok: false, error: "incident_not_found" } };
    if (incident.organizationId !== input.organizationId) {
      return { status: 403, body: { ok: false, error: "cross_org_incident" } };
    }

    const output = triageDeploymentIncident(input.engineInputs);

    // Supersede prior pending triage rows for this incident.
    const superseded = await repo.incidentTriage.updateMany({
      where: { organizationId: input.organizationId, incidentId: input.incidentId, operatorDecision: "pending" },
      data: { operatorDecision: "dismissed" },
    });

    // Sanitize inputs for JSON storage (Date → ISO).
    const safeInputs = {
      ...input.engineInputs,
      now: input.engineInputs.now.toISOString(),
    };

    const row = await repo.incidentTriage.create({
      data: {
        organizationId: input.organizationId,
        incidentId: input.incidentId,
        priority: output.priority,
        suggestedOwnerTeam: output.suggestedOwnerTeam,
        estimatedTimeToMitigateMinutes: output.estimatedTimeToMitigateMinutes,
        recommendedRunbook: output.recommendedRunbook,
        autoEscalate: output.autoEscalate,
        confidence: output.confidence,
        rationale: output.rationale,
        inputsJson: safeInputs as unknown,
        operatorDecision: "pending",
        engineVersion: INCIDENT_TRIAGE_ENGINE_VERSION,
      },
    });

    return {
      status: 200,
      body: {
        ok: true,
        data: {
          generatedAt: output.generatedAtIso,
          triage: projectRow(row),
          supersededCount: superseded.count,
        },
      },
    };
  } catch (err) {
    if (isMissingTable(err)) {
      return {
        status: 503,
        body: { ok: false, error: "migration_pending", hint: "IncidentTriage table needs Phase 509 migration." },
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
        triages: TriageView[];
        summary: {
          total: number;
          pending: number;
          accepted: number;
          overridden: number;
          dismissed: number;
          p0: number; p1: number; p2: number; p3: number;
        };
      };
    }
  | { ok: false; error: string; hint?: string; correlationId?: string };

export interface ListResult { status: number; body: ListBody }

export async function buildTriageListResponse(
  repo: IncidentTriageRepo,
  input: { organizationId: string; incidentId?: string; operatorDecision?: string },
  opts: { now?: Date; correlationId?: string } = {},
): Promise<ListResult> {
  try {
    const now = opts.now ?? new Date();
    const where: { organizationId: string; incidentId?: string; operatorDecision?: string } = { organizationId: input.organizationId };
    if (input.incidentId) where.incidentId = input.incidentId;
    if (input.operatorDecision) where.operatorDecision = input.operatorDecision;
    const rows = await repo.incidentTriage.findMany({
      where,
      orderBy: { generatedAt: "desc" },
      take: 200,
    });
    const triages = rows.map(projectRow);
    let pending = 0, accepted = 0, overridden = 0, dismissed = 0;
    let p0 = 0, p1 = 0, p2 = 0, p3 = 0;
    for (const t of triages) {
      if (t.operatorDecision === "pending") pending += 1;
      else if (t.operatorDecision === "accepted") accepted += 1;
      else if (t.operatorDecision === "overridden") overridden += 1;
      else if (t.operatorDecision === "dismissed") dismissed += 1;
      if (t.priority === "P0") p0 += 1;
      else if (t.priority === "P1") p1 += 1;
      else if (t.priority === "P2") p2 += 1;
      else if (t.priority === "P3") p3 += 1;
    }
    return {
      status: 200,
      body: {
        ok: true,
        data: {
          generatedAt: now.toISOString(),
          triages,
          summary: { total: triages.length, pending, accepted, overridden, dismissed, p0, p1, p2, p3 },
        },
      },
    };
  } catch (err) {
    if (isMissingTable(err)) {
      return {
        status: 503,
        body: { ok: false, error: "migration_pending", hint: "IncidentTriage table needs Phase 509 migration." },
      };
    }
    return {
      status: 500,
      body: { ok: false, error: "internal_error", ...(opts.correlationId ? { correlationId: opts.correlationId } : {}) },
    };
  }
}

/* ──────────────────────────────────────────────────────────────────
   Decision.
   ────────────────────────────────────────────────────────────── */

export interface DecisionInput {
  organizationId: string;
  actorUserId: string;
  triageId: string;
  action: TriageTransition;
  note?: string;
  overridePriority?: string;
}

export type DecisionError =
  | "triage_not_found"
  | "cross_org_triage"
  | "unknown_current_decision"
  | "illegal_transition"
  | "override_priority_invalid";

export type DecisionBody =
  | {
      ok: true;
      data: {
        id: string;
        previousDecision: TriageDecision;
        decision: TriageDecision;
        action: TriageTransition;
        overridePriority: string | null;
      };
    }
  | { ok: false; error: DecisionError | "migration_pending" | "internal_error"; hint?: string; correlationId?: string };

export interface DecisionResult { status: number; body: DecisionBody }

export async function buildTriageDecisionResponse(
  repo: IncidentTriageRepo,
  input: DecisionInput,
  opts: { now?: Date; correlationId?: string } = {},
): Promise<DecisionResult> {
  if (!(TRIAGE_TRANSITIONS as readonly string[]).includes(input.action)) {
    return { status: 422, body: { ok: false, error: "illegal_transition", hint: `Unknown action "${input.action}".` } };
  }
  if (input.action === "override") {
    if (!input.overridePriority || !isPriority(input.overridePriority)) {
      return { status: 422, body: { ok: false, error: "override_priority_invalid", hint: "overridePriority must be P0|P1|P2|P3" } };
    }
  }
  try {
    const existing = await repo.incidentTriage.findUnique({ where: { id: input.triageId } });
    if (!existing) return { status: 404, body: { ok: false, error: "triage_not_found" } };
    if (existing.organizationId !== input.organizationId) {
      return { status: 403, body: { ok: false, error: "cross_org_triage" } };
    }
    if (!isDecision(existing.operatorDecision)) {
      return {
        status: 409,
        body: { ok: false, error: "unknown_current_decision", hint: `IncidentTriage.operatorDecision="${existing.operatorDecision}" not in closed-union.` },
      };
    }
    const plan = planTriageDecision(existing.operatorDecision as TriageDecision, input.action);
    if (!plan.ok) {
      return {
        status: 409,
        body: { ok: false, error: "illegal_transition", hint: `Cannot ${input.action} from "${existing.operatorDecision}".` },
      };
    }
    const now = opts.now ?? new Date();
    await repo.incidentTriage.update({
      where: { id: existing.id },
      data: {
        operatorDecision: plan.next,
        decidedByUserId: input.actorUserId,
        decidedAt: now,
        decisionNote: input.note?.trim() || null,
        overridePriority: input.action === "override" ? (input.overridePriority ?? null) : null,
      },
    });
    return {
      status: 200,
      body: {
        ok: true,
        data: {
          id: existing.id,
          previousDecision: existing.operatorDecision as TriageDecision,
          decision: plan.next,
          action: input.action,
          overridePriority: input.action === "override" ? (input.overridePriority ?? null) : null,
        },
      },
    };
  } catch (err) {
    if (isMissingTable(err)) {
      return {
        status: 503,
        body: { ok: false, error: "migration_pending", hint: "IncidentTriage table needs Phase 509 migration." },
      };
    }
    return {
      status: 500,
      body: { ok: false, error: "internal_error", ...(opts.correlationId ? { correlationId: opts.correlationId } : {}) },
    };
  }
}
