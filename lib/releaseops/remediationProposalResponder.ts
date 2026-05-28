/**
 * Phase 512 — RemediationProposal persistence responder.
 */

import { isMissingTable } from "./releaseListResponder";
import {
  generateRemediationProposals,
  REMEDIATION_ENGINE_VERSION,
  REMEDIATION_KINDS,
  REMEDIATION_SEVERITIES,
  type RemediationInputs,
  type RemediationKind,
  type RemediationSeverity,
} from "./remediationProposalEngine";

/* ──────────────────────────────────────────────────────────────────
   Closed-unions.
   ────────────────────────────────────────────────────────────── */

export const REMEDIATION_DECISIONS = ["pending", "accepted", "rejected", "implemented", "dismissed"] as const;
export type RemediationDecision = (typeof REMEDIATION_DECISIONS)[number];

export const REMEDIATION_TRANSITIONS = ["accept", "reject", "implement", "dismiss"] as const;
export type RemediationTransition = (typeof REMEDIATION_TRANSITIONS)[number];

function isDecision(s: string): s is RemediationDecision {
  return (REMEDIATION_DECISIONS as readonly string[]).includes(s);
}
function isKind(s: string): s is RemediationKind {
  return (REMEDIATION_KINDS as readonly string[]).includes(s);
}
function isSeverity(s: string): s is RemediationSeverity {
  return (REMEDIATION_SEVERITIES as readonly string[]).includes(s);
}

/* ──────────────────────────────────────────────────────────────────
   Pure transition.
   ────────────────────────────────────────────────────────────── */

export interface DecisionPlan { ok: true; next: RemediationDecision }
export interface DecisionReject { ok: false; reason: "illegal_transition"; from: RemediationDecision; action: RemediationTransition }

export function planRemediationDecision(
  current: RemediationDecision,
  action: RemediationTransition,
): DecisionPlan | DecisionReject {
  if (current !== "pending") return { ok: false, reason: "illegal_transition", from: current, action };
  if (action === "accept") return { ok: true, next: "accepted" };
  if (action === "reject") return { ok: true, next: "rejected" };
  if (action === "implement") return { ok: true, next: "implemented" };
  if (action === "dismiss") return { ok: true, next: "dismissed" };
  return { ok: false, reason: "illegal_transition", from: current, action };
}

/* ──────────────────────────────────────────────────────────────────
   Repo contract.
   ────────────────────────────────────────────────────────────── */

export interface RemediationRow {
  id: string;
  organizationId: string;
  incidentId: string;
  triageId: string | null;
  kind: string;
  title: string;
  description: string;
  confidence: number;
  severity: string;
  prerequisitesJson: unknown;
  expectedImpact: string;
  rollbackPlan: string;
  estimatedMinutes: number;
  reversible: boolean;
  rationale: string;
  inputsJson: unknown;
  operatorDecision: string;
  decidedByUserId: string | null;
  decidedAt: Date | null;
  decisionNote: string | null;
  linkedManualFixId: string | null;
  engineVersion: string;
  generatedAt: Date;
  updatedAt: Date;
}

export interface IncidentLookupRow {
  id: string;
  organizationId: string;
  status: string;
}

export interface RemediationRepo {
  deploymentIncident: {
    findUnique(args: { where: { id: string } }): Promise<IncidentLookupRow | null>;
  };
  remediationProposal: {
    findUnique(args: { where: { id: string } }): Promise<RemediationRow | null>;
    findMany(args: {
      where: { organizationId: string; incidentId?: string; operatorDecision?: string };
      orderBy: { generatedAt: "desc" };
      take?: number;
    }): Promise<RemediationRow[]>;
    updateMany(args: {
      where: { organizationId: string; incidentId: string; operatorDecision: "pending" };
      data: { operatorDecision: "dismissed" };
    }): Promise<{ count: number }>;
    createMany(args: {
      data: Array<{
        organizationId: string;
        incidentId: string;
        triageId: string | null;
        kind: RemediationKind;
        title: string;
        description: string;
        confidence: number;
        severity: RemediationSeverity;
        prerequisitesJson: unknown;
        expectedImpact: string;
        rollbackPlan: string;
        estimatedMinutes: number;
        reversible: boolean;
        rationale: string;
        inputsJson: unknown;
        operatorDecision: "pending";
        engineVersion: string;
      }>;
    }): Promise<{ count: number }>;
    update(args: {
      where: { id: string };
      data: {
        operatorDecision: RemediationDecision;
        decidedByUserId: string;
        decidedAt: Date;
        decisionNote?: string | null;
        linkedManualFixId?: string | null;
      };
    }): Promise<RemediationRow>;
  };
}

/* ──────────────────────────────────────────────────────────────────
   Projection.
   ────────────────────────────────────────────────────────────── */

export interface RemediationView {
  id: string;
  incidentId: string;
  triageId: string | null;
  kind: RemediationKind | "unknown";
  title: string;
  description: string;
  confidence: number;
  severity: RemediationSeverity | "unknown";
  prerequisites: string[];
  expectedImpact: string;
  rollbackPlan: string;
  estimatedMinutes: number;
  reversible: boolean;
  rationale: string;
  operatorDecision: RemediationDecision | "unknown";
  decidedByUserId: string | null;
  decidedAtIso: string | null;
  decisionNote: string | null;
  linkedManualFixId: string | null;
  engineVersion: string;
  generatedAtIso: string;
}

function projectRow(r: RemediationRow): RemediationView {
  return {
    id: r.id,
    incidentId: r.incidentId,
    triageId: r.triageId,
    kind: isKind(r.kind) ? r.kind : "unknown",
    title: r.title,
    description: r.description,
    confidence: r.confidence,
    severity: isSeverity(r.severity) ? r.severity : "unknown",
    prerequisites: Array.isArray(r.prerequisitesJson)
      ? r.prerequisitesJson.filter((p): p is string => typeof p === "string")
      : [],
    expectedImpact: r.expectedImpact,
    rollbackPlan: r.rollbackPlan,
    estimatedMinutes: r.estimatedMinutes,
    reversible: r.reversible,
    rationale: r.rationale,
    operatorDecision: isDecision(r.operatorDecision) ? r.operatorDecision : "unknown",
    decidedByUserId: r.decidedByUserId,
    decidedAtIso: r.decidedAt ? r.decidedAt.toISOString() : null,
    decisionNote: r.decisionNote,
    linkedManualFixId: r.linkedManualFixId,
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
  triageId?: string;
  engineInputs: RemediationInputs;
}

export type GenerateError = "incident_not_found" | "cross_org_incident";

export type GenerateBody =
  | {
      ok: true;
      data: {
        generatedAt: string;
        engineVersion: string;
        proposalCount: number;
        primary: RemediationView | null;
        proposals: RemediationView[];
        supersededCount: number;
      };
    }
  | { ok: false; error: GenerateError | "migration_pending" | "internal_error"; hint?: string; correlationId?: string };

export interface GenerateResult { status: number; body: GenerateBody }

export async function buildRemediationGenerateResponse(
  repo: RemediationRepo,
  input: GenerateInput,
  opts: { correlationId?: string } = {},
): Promise<GenerateResult> {
  try {
    const incident = await repo.deploymentIncident.findUnique({ where: { id: input.incidentId } });
    if (!incident) return { status: 404, body: { ok: false, error: "incident_not_found" } };
    if (incident.organizationId !== input.organizationId) {
      return { status: 403, body: { ok: false, error: "cross_org_incident" } };
    }

    const output = generateRemediationProposals(input.engineInputs);

    // Supersede prior pending for the same incident.
    const superseded = await repo.remediationProposal.updateMany({
      where: { organizationId: input.organizationId, incidentId: input.incidentId, operatorDecision: "pending" },
      data: { operatorDecision: "dismissed" },
    });

    // Sanitize inputs for JSON storage.
    const safeInputs = { ...input.engineInputs, now: input.engineInputs.now.toISOString() };

    const toInsert = output.proposals.map((p) => ({
      organizationId: input.organizationId,
      incidentId: input.incidentId,
      triageId: input.triageId ?? null,
      kind: p.kind,
      title: p.title,
      description: p.description,
      confidence: p.confidence,
      severity: p.severity,
      prerequisitesJson: p.prerequisites as unknown,
      expectedImpact: p.expectedImpact,
      rollbackPlan: p.rollbackPlan,
      estimatedMinutes: p.estimatedMinutes,
      reversible: p.reversible,
      rationale: p.rationale,
      inputsJson: safeInputs as unknown,
      operatorDecision: "pending" as const,
      engineVersion: REMEDIATION_ENGINE_VERSION,
    }));

    if (toInsert.length > 0) {
      await repo.remediationProposal.createMany({ data: toInsert });
    }

    const persisted = await repo.remediationProposal.findMany({
      where: { organizationId: input.organizationId, incidentId: input.incidentId, operatorDecision: "pending" },
      orderBy: { generatedAt: "desc" },
      take: 20,
    });
    const proposals = persisted.map(projectRow);
    const primary = proposals.find((p) => p.kind !== "no_action_recommended") ?? null;

    return {
      status: 200,
      body: {
        ok: true,
        data: {
          generatedAt: output.generatedAtIso,
          engineVersion: output.engineVersion,
          proposalCount: proposals.length,
          primary,
          proposals,
          supersededCount: superseded.count,
        },
      },
    };
  } catch (err) {
    if (isMissingTable(err)) {
      return {
        status: 503,
        body: { ok: false, error: "migration_pending", hint: "RemediationProposal table needs Phase 512 migration." },
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
        proposals: RemediationView[];
        summary: {
          total: number;
          pending: number;
          accepted: number;
          rejected: number;
          implemented: number;
          dismissed: number;
        };
      };
    }
  | { ok: false; error: string; hint?: string; correlationId?: string };

export interface ListResult { status: number; body: ListBody }

export async function buildRemediationListResponse(
  repo: RemediationRepo,
  input: { organizationId: string; incidentId?: string; operatorDecision?: string },
  opts: { now?: Date; correlationId?: string } = {},
): Promise<ListResult> {
  try {
    const now = opts.now ?? new Date();
    const where: { organizationId: string; incidentId?: string; operatorDecision?: string } = { organizationId: input.organizationId };
    if (input.incidentId) where.incidentId = input.incidentId;
    if (input.operatorDecision) where.operatorDecision = input.operatorDecision;

    const rows = await repo.remediationProposal.findMany({
      where,
      orderBy: { generatedAt: "desc" },
      take: 200,
    });
    const proposals = rows.map(projectRow);
    let pending = 0, accepted = 0, rejected = 0, implemented = 0, dismissed = 0;
    for (const p of proposals) {
      if (p.operatorDecision === "pending") pending += 1;
      else if (p.operatorDecision === "accepted") accepted += 1;
      else if (p.operatorDecision === "rejected") rejected += 1;
      else if (p.operatorDecision === "implemented") implemented += 1;
      else if (p.operatorDecision === "dismissed") dismissed += 1;
    }
    return {
      status: 200,
      body: {
        ok: true,
        data: {
          generatedAt: now.toISOString(),
          proposals,
          summary: { total: proposals.length, pending, accepted, rejected, implemented, dismissed },
        },
      },
    };
  } catch (err) {
    if (isMissingTable(err)) {
      return {
        status: 503,
        body: { ok: false, error: "migration_pending", hint: "RemediationProposal table needs Phase 512 migration." },
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
  proposalId: string;
  action: RemediationTransition;
  note?: string;
  linkedManualFixId?: string;
}

export type DecisionError =
  | "proposal_not_found"
  | "cross_org_proposal"
  | "unknown_current_decision"
  | "illegal_transition";

export type DecisionBody =
  | {
      ok: true;
      data: {
        id: string;
        previousDecision: RemediationDecision;
        decision: RemediationDecision;
        action: RemediationTransition;
      };
    }
  | { ok: false; error: DecisionError | "migration_pending" | "internal_error"; hint?: string; correlationId?: string };

export interface DecisionResult { status: number; body: DecisionBody }

export async function buildRemediationDecisionResponse(
  repo: RemediationRepo,
  input: DecisionInput,
  opts: { now?: Date; correlationId?: string } = {},
): Promise<DecisionResult> {
  if (!(REMEDIATION_TRANSITIONS as readonly string[]).includes(input.action)) {
    return { status: 422, body: { ok: false, error: "illegal_transition", hint: `Unknown action "${input.action}".` } };
  }
  try {
    const existing = await repo.remediationProposal.findUnique({ where: { id: input.proposalId } });
    if (!existing) return { status: 404, body: { ok: false, error: "proposal_not_found" } };
    if (existing.organizationId !== input.organizationId) {
      return { status: 403, body: { ok: false, error: "cross_org_proposal" } };
    }
    if (!isDecision(existing.operatorDecision)) {
      return {
        status: 409,
        body: { ok: false, error: "unknown_current_decision", hint: `RemediationProposal.operatorDecision="${existing.operatorDecision}" not in closed-union.` },
      };
    }
    const plan = planRemediationDecision(existing.operatorDecision as RemediationDecision, input.action);
    if (!plan.ok) {
      return {
        status: 409,
        body: { ok: false, error: "illegal_transition", hint: `Cannot ${input.action} from "${existing.operatorDecision}".` },
      };
    }
    const now = opts.now ?? new Date();
    await repo.remediationProposal.update({
      where: { id: existing.id },
      data: {
        operatorDecision: plan.next,
        decidedByUserId: input.actorUserId,
        decidedAt: now,
        decisionNote: input.note?.trim() || null,
        linkedManualFixId: input.action === "implement" ? (input.linkedManualFixId ?? null) : null,
      },
    });
    return {
      status: 200,
      body: {
        ok: true,
        data: {
          id: existing.id,
          previousDecision: existing.operatorDecision as RemediationDecision,
          decision: plan.next,
          action: input.action,
        },
      },
    };
  } catch (err) {
    if (isMissingTable(err)) {
      return {
        status: 503,
        body: { ok: false, error: "migration_pending", hint: "RemediationProposal table needs Phase 512 migration." },
      };
    }
    return {
      status: 500,
      body: { ok: false, error: "internal_error", ...(opts.correlationId ? { correlationId: opts.correlationId } : {}) },
    };
  }
}
