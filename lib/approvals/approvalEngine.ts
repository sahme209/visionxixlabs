/**
 * Approval Engine.
 *
 * Composes the approval policy + approval model + in-memory store into
 * a typed API the orchestration uses to request, decide, expire, and
 * supersede approvals. Persistence can be swapped to Prisma later
 * without changing the public surface.
 *
 * Hard rules enforced here:
 *  - Rejected approvals cannot be reused.
 *  - Expired approvals cannot be decided.
 *  - Decisions emit audit-event placeholders for downstream wiring.
 */

import "server-only";

import {
  type ApprovalRequest,
  type ApprovalStatus,
  type ApprovalRisk,
  type ApprovalSourceType,
  type ApproverRole,
  canTransitionApproval,
  defaultExpiry,
  isExpired,
  newApprovalId,
} from "@/lib/approvals/approvalModel";

import { evaluateApprovalPolicy, type ApprovalPolicyDecision, type ApprovalPolicyInput } from "@/lib/approvals/approvalPolicy";
import type { CloudProvider } from "@/lib/domain/provider";

// ---------------------------------------------------------------------------
// In-memory store (swap to Prisma later)
// ---------------------------------------------------------------------------

const STORE = new Map<string, ApprovalRequest>();

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RequestApprovalInput {
  tenantId?: string;
  requesterUserId?: string;
  sourceType: ApprovalSourceType;
  sourceId: string;
  provider: CloudProvider | "github" | "desktop" | "platform";
  risk: ApprovalRisk;
  changeSummary: string;
  affectedResources?: string[];
  simulationSummary?: string;
  blastRadius?: ApprovalRequest["blastRadius"];
  rollbackSummary?: string;
  verificationSummary?: string;
  policyInput: ApprovalPolicyInput;
}

export interface RequestApprovalOutcome {
  request: ApprovalRequest;
  policy: ApprovalPolicyDecision;
  /** When false, no approval was required and no request was stored. */
  approvalRequired: boolean;
}

export interface DecisionInput {
  approvalId: string;
  decision: "approved" | "rejected";
  approverUserId?: string;
  approverRole?: ApproverRole;
  reason?: string;
}

export interface DecisionOutcome {
  allowed: boolean;
  reason: string;
  request?: ApprovalRequest;
  auditEventId?: string;
}

// ---------------------------------------------------------------------------
// Engine API
// ---------------------------------------------------------------------------

export function requestApproval(input: RequestApprovalInput): RequestApprovalOutcome {
  const policy = evaluateApprovalPolicy(input.policyInput);
  if (!policy.approvalRequired) {
    return {
      approvalRequired: false,
      policy,
      request: {
        // Synthetic non-stored placeholder so the caller has a typed view.
        id: "appr.not-required",
        tenantId: input.tenantId,
        requesterUserId: input.requesterUserId,
        approverRole: "operator",
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        provider: input.provider,
        riskLevel: input.risk,
        changeSummary: input.changeSummary,
        affectedResources: input.affectedResources ?? [],
        simulationSummary: input.simulationSummary,
        blastRadius: input.blastRadius,
        rollbackSummary: input.rollbackSummary,
        verificationSummary: input.verificationSummary,
        status: "approved",
        expiresAt: defaultExpiry(input.risk),
        createdAt: new Date().toISOString(),
        decidedAt: new Date().toISOString(),
        decisionReason: "Policy did not require approval.",
        evidenceRefs: [],
        auditEventIds: [],
      },
    };
  }

  const id = newApprovalId(input.sourceType);
  const req: ApprovalRequest = {
    id,
    tenantId: input.tenantId,
    requesterUserId: input.requesterUserId,
    approverRole: policy.primaryRole,
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    provider: input.provider,
    riskLevel: input.risk,
    changeSummary: input.changeSummary,
    affectedResources: input.affectedResources ?? [],
    simulationSummary: input.simulationSummary,
    blastRadius: input.blastRadius,
    rollbackSummary: input.rollbackSummary,
    verificationSummary: input.verificationSummary,
    policyDecisionId: policy.policyId,
    status: "pending",
    expiresAt: defaultExpiry(input.risk),
    createdAt: new Date().toISOString(),
    evidenceRefs: [
      { label: "policy_id", ref: policy.policyId },
      { label: "rules",     ref: policy.reasons.join("; ") || "no specific rule" },
    ],
    auditEventIds: [],
  };
  STORE.set(id, req);
  return { request: req, policy, approvalRequired: true };
}

export function getApproval(id: string): ApprovalRequest | undefined {
  return STORE.get(id);
}

export function listApprovals(filter: {
  tenantId?: string;
  status?: ApprovalStatus;
  sourceType?: ApprovalSourceType;
} = {}): ApprovalRequest[] {
  return [...STORE.values()].filter((r) => {
    if (filter.tenantId   && r.tenantId   !== filter.tenantId)   return false;
    if (filter.status     && r.status     !== filter.status)     return false;
    if (filter.sourceType && r.sourceType !== filter.sourceType) return false;
    return true;
  });
}

export function decideApproval(input: DecisionInput): DecisionOutcome {
  const req = STORE.get(input.approvalId);
  if (!req) return { allowed: false, reason: "Approval not found." };

  if (isExpired(req)) {
    if (req.status === "pending") {
      STORE.set(req.id, { ...req, status: "expired" });
    }
    return { allowed: false, reason: "Approval has expired.", request: STORE.get(req.id) };
  }

  if (req.status !== "pending") {
    return { allowed: false, reason: `Approval already ${req.status}.`, request: req };
  }

  const nextStatus: ApprovalStatus = input.decision;
  if (!canTransitionApproval(req.status, nextStatus)) {
    return { allowed: false, reason: `Cannot transition ${req.status} → ${nextStatus}.`, request: req };
  }

  const updated: ApprovalRequest = {
    ...req,
    status: nextStatus,
    approverUserId: input.approverUserId,
    approverRole: input.approverRole ?? req.approverRole,
    decidedAt: new Date().toISOString(),
    decisionReason: input.reason,
    auditEventIds: [...req.auditEventIds, `audit.approval.${nextStatus}.${req.id}`],
  };
  STORE.set(req.id, updated);

  return {
    allowed: true,
    reason: nextStatus === "approved" ? "Approval granted." : "Approval rejected.",
    request: updated,
    auditEventId: `audit.approval.${nextStatus}.${req.id}`,
  };
}

export function supersedeApproval(id: string, reason: string): ApprovalRequest | undefined {
  const req = STORE.get(id);
  if (!req) return undefined;
  if (!canTransitionApproval(req.status, "superseded")) return req;
  const updated = { ...req, status: "superseded" as ApprovalStatus, decisionReason: reason, decidedAt: new Date().toISOString() };
  STORE.set(id, updated);
  return updated;
}

/** Cancel all stored approvals (test/admin only). */
export function _resetForTests(): void {
  STORE.clear();
}
