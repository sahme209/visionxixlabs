/**
 * Change / ticketing models — typed contracts for future ServiceNow / Jira /
 * Linear connectors. No live integration today; types here let other systems
 * (approval center, ReleaseOps, audit) reference change requests now.
 */

export type ChangeSystem = "servicenow" | "jira" | "linear";

export type ChangeStatus =
  | "draft"
  | "submitted"
  | "in_review"
  | "approved"
  | "rejected"
  | "scheduled"
  | "in_progress"
  | "implemented"
  | "verified"
  | "closed"
  | "cancelled"
  | "rolled_back";

export type RiskAcceptance = "none" | "low" | "medium" | "high" | "exception";

export interface ChangeRequest {
  id: string;
  system: ChangeSystem;
  externalId: string;
  title: string;
  description: string;
  status: ChangeStatus;
  riskAcceptance: RiskAcceptance;
  /** Approver chain in order. */
  approvers: { id: string; name: string; status: "pending" | "approved" | "rejected" | "delegated" }[];
  /** Tickets / incidents linked to this change. */
  linkedTickets: { system: ChangeSystem; id: string; url: string }[];
  /** Affected entities. */
  affectedServices: string[];
  affectedEnvironments: ("production" | "staging" | "development" | "qa")[];
  /** Change window — when the change can apply. */
  changeWindow?: { startISO: string; endISO: string };
  /** Owner of the change. */
  owner: { id: string; name: string };
  /** Audit link back into Axiom — execution plan ID. */
  axiomExecutionPlanId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApprovalTicket {
  id: string;
  system: ChangeSystem;
  externalId: string;
  title: string;
  status: "pending" | "approved" | "rejected" | "expired";
  changeRequestId?: string;
  approver: { id: string; name: string };
  decidedAt?: string;
  note?: string;
}

export interface Incident {
  id: string;
  system: ChangeSystem;
  externalId: string;
  title: string;
  severity: "sev1" | "sev2" | "sev3" | "sev4";
  status: "open" | "mitigated" | "resolved" | "post_mortem";
  affectedServices: string[];
  relatedChangeRequestId?: string;
  startedAt: string;
  resolvedAt?: string;
}

export interface ChangeWindow {
  id: string;
  name: string;
  startISO: string;
  endISO: string;
  environments: ("production" | "staging" | "development" | "qa")[];
  freezeReason?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function isChangeApproved(cr: ChangeRequest): boolean {
  return cr.status === "approved" || cr.status === "scheduled";
}

export function isInChangeWindow(cr: ChangeRequest, at: Date = new Date()): boolean {
  if (!cr.changeWindow) return true; // No window restriction
  return at.getTime() >= new Date(cr.changeWindow.startISO).getTime() && at.getTime() <= new Date(cr.changeWindow.endISO).getTime();
}
