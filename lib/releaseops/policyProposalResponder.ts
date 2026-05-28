/**
 * Phase 507 — PolicyProposal persistence responder.
 *
 * Bridges the pure engine to the database:
 *   • buildProposalGenerateResponse — runs the engine + inserts new
 *     proposals. Caller-provided aggregator handles the read-side.
 *   • buildProposalListResponse     — operator inbox.
 *   • buildProposalDecisionResponse — pending → accepted / rejected /
 *     dismissed. On accept, upserts into PolicyRule and stores the
 *     rule id on the proposal row.
 */

import { isMissingTable } from "./releaseListResponder";
import {
  generatePolicyProposals,
  POLICY_PROPOSAL_ENGINE_VERSION,
  PROPOSAL_KINDS,
  PROPOSAL_SEVERITIES,
  type PolicyProposalInputs,
  type ProposalKind,
  type ProposalSeverity,
} from "./policyProposalEngine";

/* ──────────────────────────────────────────────────────────────────
   Closed-unions.
   ────────────────────────────────────────────────────────────── */

export const PROPOSAL_DECISIONS = ["pending", "accepted", "rejected", "dismissed", "superseded"] as const;
export type ProposalDecision = (typeof PROPOSAL_DECISIONS)[number];

export const PROPOSAL_TRANSITIONS = ["accept", "reject", "dismiss"] as const;
export type ProposalTransition = (typeof PROPOSAL_TRANSITIONS)[number];

function isDecision(s: string): s is ProposalDecision {
  return (PROPOSAL_DECISIONS as readonly string[]).includes(s);
}
function isKind(s: string): s is ProposalKind {
  return (PROPOSAL_KINDS as readonly string[]).includes(s);
}
function isSeverity(s: string): s is ProposalSeverity {
  return (PROPOSAL_SEVERITIES as readonly string[]).includes(s);
}

/* ──────────────────────────────────────────────────────────────────
   Pure transition.
   ────────────────────────────────────────────────────────────── */

export interface DecisionPlan {
  ok: true;
  next: ProposalDecision;
}
export interface DecisionReject {
  ok: false;
  reason: "illegal_transition";
  from: ProposalDecision;
  action: ProposalTransition;
}

export function planProposalDecision(
  current: ProposalDecision,
  action: ProposalTransition,
): DecisionPlan | DecisionReject {
  if (current !== "pending") return { ok: false, reason: "illegal_transition", from: current, action };
  if (action === "accept") return { ok: true, next: "accepted" };
  if (action === "reject") return { ok: true, next: "rejected" };
  if (action === "dismiss") return { ok: true, next: "dismissed" };
  return { ok: false, reason: "illegal_transition", from: current, action };
}

/* ──────────────────────────────────────────────────────────────────
   Repo contract.
   ────────────────────────────────────────────────────────────── */

export interface ProposalRow {
  id: string;
  organizationId: string;
  kind: string;
  suggestedRuleKey: string;
  title: string;
  rationale: string;
  confidence: number;
  severity: string;
  evidenceJson: unknown;
  suggestedRuleBodyJson: unknown;
  operatorDecision: string;
  decidedByUserId: string | null;
  decidedAt: Date | null;
  decisionNote: string | null;
  acceptedRuleId: string | null;
  engineVersion: string;
  generatedAt: Date;
  updatedAt: Date;
}

export interface PolicyRuleRow {
  id: string;
  organizationId: string;
  /** Existing PolicyRule schema uses `key` (not `ruleKey`). */
  key: string;
}

export interface PolicyProposalRepo {
  policyProposal: {
    findUnique(args: { where: { id: string } }): Promise<ProposalRow | null>;
    findMany(args: {
      where: { organizationId: string; operatorDecision?: string };
      orderBy: { generatedAt: "desc" };
      take?: number;
    }): Promise<ProposalRow[]>;
    createMany(args: {
      data: Array<{
        organizationId: string;
        kind: ProposalKind;
        suggestedRuleKey: string;
        title: string;
        rationale: string;
        confidence: number;
        severity: ProposalSeverity;
        evidenceJson: unknown;
        suggestedRuleBodyJson: unknown;
        operatorDecision: "pending";
        engineVersion: string;
      }>;
      skipDuplicates: true;
    }): Promise<{ count: number }>;
    update(args: {
      where: { id: string };
      data: {
        operatorDecision: ProposalDecision;
        decidedByUserId: string;
        decidedAt: Date;
        decisionNote?: string | null;
        acceptedRuleId?: string | null;
      };
    }): Promise<ProposalRow>;
  };
  /**
   * The existing PolicyRule schema (Phase 443) uses these field names:
   *   key (string, not ruleKey), label, severity, blocking,
   *   exceptionAllowed, approverRole, evidenceRequired,
   *   autoRemediationKey, description, enabled, source.
   * We upsert on the (organizationId, key) compound unique.
   */
  policyRule: {
    upsert(args: {
      where: { organizationId_key: { organizationId: string; key: string } };
      create: {
        organizationId: string;
        key: string;
        label: string;
        severity: ProposalSeverity;
        blocking: boolean;
        description: string;
        source: "operator";
      };
      update: {
        label: string;
        severity: ProposalSeverity;
        blocking: boolean;
        description: string;
      };
    }): Promise<PolicyRuleRow>;
  };
}

/* ──────────────────────────────────────────────────────────────────
   Projection.
   ────────────────────────────────────────────────────────────── */

export interface ProposalView {
  id: string;
  kind: ProposalKind | "unknown";
  suggestedRuleKey: string;
  title: string;
  rationale: string;
  confidence: number;
  severity: ProposalSeverity | "unknown";
  evidence: unknown;
  suggestedRuleBody: unknown;
  operatorDecision: ProposalDecision | "unknown";
  decidedByUserId: string | null;
  decidedAtIso: string | null;
  decisionNote: string | null;
  acceptedRuleId: string | null;
  engineVersion: string;
  generatedAtIso: string;
}

function projectRow(r: ProposalRow): ProposalView {
  return {
    id: r.id,
    kind: isKind(r.kind) ? r.kind : "unknown",
    suggestedRuleKey: r.suggestedRuleKey,
    title: r.title,
    rationale: r.rationale,
    confidence: r.confidence,
    severity: isSeverity(r.severity) ? r.severity : "unknown",
    evidence: r.evidenceJson,
    suggestedRuleBody: r.suggestedRuleBodyJson,
    operatorDecision: isDecision(r.operatorDecision) ? r.operatorDecision : "unknown",
    decidedByUserId: r.decidedByUserId,
    decidedAtIso: r.decidedAt ? r.decidedAt.toISOString() : null,
    decisionNote: r.decisionNote,
    acceptedRuleId: r.acceptedRuleId,
    engineVersion: r.engineVersion,
    generatedAtIso: r.generatedAt.toISOString(),
  };
}

/* ──────────────────────────────────────────────────────────────────
   Generate.
   ────────────────────────────────────────────────────────────── */

export interface GenerateInput {
  organizationId: string;
  engineInputs: PolicyProposalInputs;
}

export type GenerateBody =
  | {
      ok: true;
      data: {
        generatedAt: string;
        engineVersion: string;
        newProposalCount: number;
        suppressedExisting: number;
        suppressedPending: number;
        proposals: ProposalView[];
      };
    }
  | { ok: false; error: "migration_pending" | "internal_error"; hint?: string; correlationId?: string };

export interface GenerateResult { status: number; body: GenerateBody }

export async function buildProposalGenerateResponse(
  repo: PolicyProposalRepo,
  input: GenerateInput,
  opts: { correlationId?: string } = {},
): Promise<GenerateResult> {
  try {
    const output = generatePolicyProposals(input.engineInputs);

    const toInsert = output.proposals.map((p) => ({
      organizationId: input.organizationId,
      kind: p.kind,
      suggestedRuleKey: p.suggestedRuleKey,
      title: p.title,
      rationale: p.rationale,
      confidence: p.confidence,
      severity: p.severity,
      evidenceJson: p.evidence as unknown,
      suggestedRuleBodyJson: p.suggestedRuleBody as unknown,
      operatorDecision: "pending" as const,
      engineVersion: POLICY_PROPOSAL_ENGINE_VERSION,
    }));

    if (toInsert.length > 0) {
      await repo.policyProposal.createMany({ data: toInsert, skipDuplicates: true });
    }

    const persisted = await repo.policyProposal.findMany({
      where: { organizationId: input.organizationId, operatorDecision: "pending" },
      orderBy: { generatedAt: "desc" },
      take: 50,
    });
    const proposals = persisted.map(projectRow);

    return {
      status: 200,
      body: {
        ok: true,
        data: {
          generatedAt: output.generatedAtIso,
          engineVersion: output.engineVersion,
          newProposalCount: proposals.length,
          suppressedExisting: output.summary.suppressedExisting,
          suppressedPending: output.summary.suppressedPending,
          proposals,
        },
      },
    };
  } catch (err) {
    if (isMissingTable(err)) {
      return {
        status: 503,
        body: { ok: false, error: "migration_pending", hint: "PolicyProposal table needs Phase 507 migration." },
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
        proposals: ProposalView[];
        summary: { total: number; pending: number; accepted: number; rejected: number; dismissed: number };
      };
    }
  | { ok: false; error: string; hint?: string; correlationId?: string };

export interface ListResult { status: number; body: ListBody }

export async function buildProposalListResponse(
  repo: PolicyProposalRepo,
  input: { organizationId: string; operatorDecision?: string },
  opts: { now?: Date; correlationId?: string } = {},
): Promise<ListResult> {
  try {
    const now = opts.now ?? new Date();
    const where: { organizationId: string; operatorDecision?: string } = { organizationId: input.organizationId };
    if (input.operatorDecision) where.operatorDecision = input.operatorDecision;
    const rows = await repo.policyProposal.findMany({
      where,
      orderBy: { generatedAt: "desc" },
      take: 200,
    });
    const proposals = rows.map(projectRow);
    let pending = 0, accepted = 0, rejected = 0, dismissed = 0;
    for (const p of proposals) {
      if (p.operatorDecision === "pending") pending += 1;
      else if (p.operatorDecision === "accepted") accepted += 1;
      else if (p.operatorDecision === "rejected") rejected += 1;
      else if (p.operatorDecision === "dismissed") dismissed += 1;
    }
    return {
      status: 200,
      body: {
        ok: true,
        data: {
          generatedAt: now.toISOString(),
          proposals,
          summary: { total: proposals.length, pending, accepted, rejected, dismissed },
        },
      },
    };
  } catch (err) {
    if (isMissingTable(err)) {
      return {
        status: 503,
        body: { ok: false, error: "migration_pending", hint: "PolicyProposal table needs Phase 507 migration." },
      };
    }
    return {
      status: 500,
      body: { ok: false, error: "internal_error", ...(opts.correlationId ? { correlationId: opts.correlationId } : {}) },
    };
  }
}

/* ──────────────────────────────────────────────────────────────────
   Decision (accept upserts into PolicyRule).
   ────────────────────────────────────────────────────────────── */

export interface DecisionInput {
  organizationId: string;
  actorUserId: string;
  proposalId: string;
  action: ProposalTransition;
  note?: string;
  /**
   * Optional operator override of the engine's suggested rule key
   * (e.g. to rename to a project convention). Only honored on accept.
   */
  ruleKeyOverride?: string;
}

export type DecisionError =
  | "proposal_not_found"
  | "cross_org_proposal"
  | "unknown_current_decision"
  | "illegal_transition"
  | "invalid_rule_body";

export type DecisionBody =
  | {
      ok: true;
      data: {
        id: string;
        previousDecision: ProposalDecision;
        decision: ProposalDecision;
        action: ProposalTransition;
        acceptedRuleId: string | null;
      };
    }
  | { ok: false; error: DecisionError | "migration_pending" | "internal_error"; hint?: string; correlationId?: string };

export interface DecisionResult { status: number; body: DecisionBody }

export async function buildProposalDecisionResponse(
  repo: PolicyProposalRepo,
  input: DecisionInput,
  opts: { now?: Date; correlationId?: string } = {},
): Promise<DecisionResult> {
  if (!(PROPOSAL_TRANSITIONS as readonly string[]).includes(input.action)) {
    return { status: 422, body: { ok: false, error: "illegal_transition", hint: `Unknown action "${input.action}".` } };
  }
  try {
    const existing = await repo.policyProposal.findUnique({ where: { id: input.proposalId } });
    if (!existing) return { status: 404, body: { ok: false, error: "proposal_not_found" } };
    if (existing.organizationId !== input.organizationId) {
      return { status: 403, body: { ok: false, error: "cross_org_proposal" } };
    }
    if (!isDecision(existing.operatorDecision)) {
      return {
        status: 409,
        body: { ok: false, error: "unknown_current_decision", hint: `PolicyProposal.operatorDecision="${existing.operatorDecision}" not in closed-union.` },
      };
    }
    const plan = planProposalDecision(existing.operatorDecision as ProposalDecision, input.action);
    if (!plan.ok) {
      return {
        status: 409,
        body: { ok: false, error: "illegal_transition", hint: `Cannot ${input.action} from "${existing.operatorDecision}".` },
      };
    }
    const now = opts.now ?? new Date();

    let acceptedRuleId: string | null = null;
    if (input.action === "accept") {
      // Validate rule body has the minimum shape before upserting.
      const body = existing.suggestedRuleBodyJson as Record<string, unknown> | null;
      if (!body || typeof body !== "object" || typeof body.description !== "string" || typeof body.severity !== "string") {
        return { status: 422, body: { ok: false, error: "invalid_rule_body" } };
      }
      const key = (input.ruleKeyOverride?.trim() || existing.suggestedRuleKey);
      const severity = isSeverity(body.severity as string) ? (body.severity as ProposalSeverity) : "medium";
      const blocking = body.defaultBlocking === true;
      const description = body.description as string;
      const rule = await repo.policyRule.upsert({
        where: { organizationId_key: { organizationId: input.organizationId, key } },
        create: {
          organizationId: input.organizationId,
          key,
          label: existing.title,
          severity,
          blocking,
          description,
          source: "operator",
        },
        update: {
          label: existing.title,
          severity,
          blocking,
          description,
        },
      });
      acceptedRuleId = rule.id;
    }

    await repo.policyProposal.update({
      where: { id: existing.id },
      data: {
        operatorDecision: plan.next,
        decidedByUserId: input.actorUserId,
        decidedAt: now,
        decisionNote: input.note?.trim() || null,
        acceptedRuleId,
      },
    });

    return {
      status: 200,
      body: {
        ok: true,
        data: {
          id: existing.id,
          previousDecision: existing.operatorDecision as ProposalDecision,
          decision: plan.next,
          action: input.action,
          acceptedRuleId,
        },
      },
    };
  } catch (err) {
    if (isMissingTable(err)) {
      return {
        status: 503,
        body: { ok: false, error: "migration_pending", hint: "PolicyProposal table needs Phase 507 migration." },
      };
    }
    return {
      status: 500,
      body: { ok: false, error: "internal_error", ...(opts.correlationId ? { correlationId: opts.correlationId } : {}) },
    };
  }
}
