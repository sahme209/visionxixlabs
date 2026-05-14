/**
 * Orchestration Approval Model.
 *
 * Typed approval surface used by the orchestration state machine. Distinct
 * from `lib/axiom/approvalCenter.ts`, which is the Prisma-backed
 * per-plan-item approval store. This module focuses on the *typed*
 * orchestration approval — the shape the approval engine + policy + UI
 * read, regardless of where it eventually persists.
 */

import type { CloudProvider } from "@/lib/domain/provider";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export type ApprovalStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "expired"
  | "cancelled"
  | "superseded";

export type ApprovalSourceType =
  | "remediation_candidate"
  | "release_blocker"
  | "security_finding"
  | "execution_plan"
  | "desktop_handoff";

export type ApproverRole =
  | "operator"
  | "approver"
  | "security_reviewer"
  | "finance_reviewer"
  | "production_owner"
  | "two_approver_quorum";

export type ApprovalRisk = "low" | "medium" | "high" | "critical";

// ---------------------------------------------------------------------------
// Approval record
// ---------------------------------------------------------------------------

export interface ApprovalEvidence {
  label: string;
  ref: string;
}

export interface ApprovalRequest {
  id: string;
  tenantId?: string;
  requesterUserId?: string;

  approverRole: ApproverRole;
  /** Set once approval is granted/rejected. */
  approverUserId?: string;

  sourceType: ApprovalSourceType;
  sourceId: string;
  provider: CloudProvider | "github" | "desktop" | "platform";

  riskLevel: ApprovalRisk;
  changeSummary: string;
  affectedResources: string[];
  simulationSummary?: string;
  blastRadius?: "none" | "low" | "medium" | "high" | "critical" | "unknown";
  rollbackSummary?: string;
  verificationSummary?: string;
  policyDecisionId?: string;

  status: ApprovalStatus;
  expiresAt: string;
  createdAt: string;
  decidedAt?: string;
  decisionReason?: string;

  evidenceRefs: ApprovalEvidence[];
  auditEventIds: string[];
}

// ---------------------------------------------------------------------------
// State transitions
// ---------------------------------------------------------------------------

const TRANSITIONS: Record<ApprovalStatus, ApprovalStatus[]> = {
  pending:    ["approved", "rejected", "expired", "cancelled", "superseded"],
  approved:   ["superseded"],
  rejected:   ["superseded"],
  expired:    ["superseded"],
  cancelled:  [],
  superseded: [],
};

export function canTransitionApproval(from: ApprovalStatus, to: ApprovalStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

// ---------------------------------------------------------------------------
// Defaults + helpers
// ---------------------------------------------------------------------------

export const APPROVAL_TTL_HOURS: Record<ApprovalRisk, number> = {
  low: 72, medium: 48, high: 24, critical: 12,
};

export const APPROVAL_STATUS_LABEL: Record<ApprovalStatus, string> = {
  pending:    "Pending",
  approved:   "Approved",
  rejected:   "Rejected",
  expired:    "Expired",
  cancelled:  "Cancelled",
  superseded: "Superseded",
};

export const APPROVER_ROLE_LABEL: Record<ApproverRole, string> = {
  operator:            "Operator",
  approver:            "Approver",
  security_reviewer:   "Security reviewer",
  finance_reviewer:    "Finance reviewer",
  production_owner:    "Production owner",
  two_approver_quorum: "Two approvers (quorum)",
};

export function defaultExpiry(risk: ApprovalRisk, from: Date = new Date()): string {
  const hours = APPROVAL_TTL_HOURS[risk];
  const exp = new Date(from.getTime() + hours * 60 * 60 * 1000);
  return exp.toISOString();
}

export function isExpired(req: ApprovalRequest, at: Date = new Date()): boolean {
  return new Date(req.expiresAt).getTime() <= at.getTime();
}

export function newApprovalId(scope: string): string {
  return `appr.${scope}.${Date.now().toString(36)}.${Math.random().toString(36).slice(2, 6)}`;
}
