/**
 * Method proposal — typed contract.
 *
 * Agents write these to suggest changes to the platform's own
 * methods (runbook recipes, policy templates, charter defaults,
 * help entries, tier caps). Closed unions everywhere so a typo
 * breaks the build instead of silently producing an orphan.
 */

import type { AgentRole } from "./agentBusModel";

export type ProposalTarget =
  | "runbook_recipe"
  | "policy_template"
  | "charter_default"
  | "help_entry"
  | "tier_cap";

export type ProposalStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "applied"
  | "superseded";

export interface MethodProposalRecord {
  id: string;
  organizationId: string;
  authorAgent: AgentRole;
  target: ProposalTarget;
  label: string;
  rationale: string;
  proposedDiff: unknown;
  confidence: number;
  status: ProposalStatus;
  decidedBy?: string;
  decidedAt?: string;
  decisionReason?: string;
  createdAt: string;
  updatedAt: string;
}

const TARGET_SET = new Set<string>([
  "runbook_recipe", "policy_template", "charter_default", "help_entry", "tier_cap",
]);
const STATUS_SET = new Set<string>([
  "pending", "approved", "rejected", "applied", "superseded",
]);

export function isProposalTarget(v: string): v is ProposalTarget { return TARGET_SET.has(v); }
export function isProposalStatus(v: string): v is ProposalStatus { return STATUS_SET.has(v); }
