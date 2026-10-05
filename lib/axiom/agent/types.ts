import type { CloudProvider, CloudSnapshot } from "../cloudSnapshot";
import type { ConfidenceScore } from "../costSignals";
import type { ExecutionPlan, ExecutionPlanItem, ActionType, RiskLevel } from "../executionPlan";
import type { DryRunResult } from "../dryRunSimulator";
import type { PrecheckResult } from "../precheckSystem";
import type { RollbackPlan } from "../rollbackPlanner";
import type { SavingsEstimate } from "../enums";

// ---------------------------------------------------------------------------
// Orchestrator input / output
// ---------------------------------------------------------------------------

export type RunAgentInput = {
  organizationId: string;
  userId: string;
  connectedAccountId: string;
  provider: "aws" | "azure" | "gcp";
  trigger?: AgentTrigger;
  onMessage?: (msg: AgentMessage) => void;
};

export type ApprovalInput = {
  runId: string;
  userId: string;
  decision: "approve_all" | "approve_partial" | "reject_all";
  approvedItemIds: string[];
  rejectedItemIds?: string[];
  note?: string;
  onMessage?: (msg: AgentMessage) => void;
};

export type AgentRunResult = {
  runId: string;
  status: AgentRunStatus;
  provider: string;
  findingCount: number;
  driftCount: number;
  recommendationCount: number;
  autoFixCount: number;
  approvalRequiredCount: number;
  reportOnlyCount: number;
  savingsIdentified: SavingsEstimate;
  nextAction: string | null;
  summary: string;
  error: string | null;
};

// ---------------------------------------------------------------------------
// Agent run lifecycle
// ---------------------------------------------------------------------------

export type AgentTrigger = "scheduled" | "manual" | "drift" | "onboarding" | "webhook";

export type AgentRunStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "partially_completed";

// ---------------------------------------------------------------------------
// Findings — what the agent discovered
// ---------------------------------------------------------------------------

export type FindingCategory = "cost" | "resilience" | "security" | "performance" | "compliance";
export type FindingSeverity = "info" | "low" | "medium" | "high" | "critical";

export type AgentFinding = {
  id: string;
  category: FindingCategory;
  severity: FindingSeverity;
  title: string;
  description: string;
  affectedResources: string[];
  region: string;
  provider: CloudProvider;
  confidence: ConfidenceScore;
  estimatedSavings: { monthly: number; yearly: number } | null;
  data: Record<string, unknown>;
};

// ---------------------------------------------------------------------------
// Recommendations — what the agent suggests doing
// ---------------------------------------------------------------------------

export type ActionDisposition =
  | "auto_fix_candidate"
  | "approval_required"
  | "report_only"
  | "blocked";

export type AgentRecommendation = {
  id: string;
  findingId: string;
  title: string;
  rationale: string;
  estimatedSavings: { monthly: number; yearly: number } | null;
  actionType: ActionType | null;
  disposition: ActionDisposition;
  dispositionReason: string;
  riskLevel: RiskLevel | null;
  effort: "none" | "low" | "medium" | "high";
  actionable: boolean;
};

// ---------------------------------------------------------------------------
// Action plan — internal orchestrator state
// ---------------------------------------------------------------------------

export type AgentActionPlan = {
  executionPlan: ExecutionPlan;
  dryRun: DryRunResult;
  prechecks: PrecheckResult[];
  rollbackPlans: RollbackPlan[];
  autoFixCandidates: ExecutionPlanItem[];
  approvalRequired: ExecutionPlanItem[];
  reportOnly: ExecutionPlanItem[];
};

// ---------------------------------------------------------------------------
// Approval item — what the user sees in the approval UI
// ---------------------------------------------------------------------------

export type ApprovalItem = {
  itemId: string;
  actionType: ActionType;
  provider: CloudProvider;
  region: string;
  resourceCount: number;
  title: string;
  rationale: string;
  riskLevel: RiskLevel;
  disposition: ActionDisposition;
  estimatedSavings: { monthly: number; yearly: number };
  downtimeEstimate: string;
  rollbackAvailable: boolean;
};

// ---------------------------------------------------------------------------
// Apply results
// ---------------------------------------------------------------------------

export type AgentApplyResult = {
  itemId: string;
  /** "simulated" means the handler never called a real cloud SDK — see
   *  StepResult["simulated"] in lib/axiom/applyEngine.ts. Never counted
   *  as realized savings or a completed mutation. */
  status: "verified" | "applied" | "simulated" | "failed" | "skipped";
  message: string;
  auditEventId: string | null;
};

// ---------------------------------------------------------------------------
// Agent messages — real-time updates
// ---------------------------------------------------------------------------

export type AgentMessageType =
  | "scan_started"
  | "scan_complete"
  | "drift_detected"
  | "findings_summary"
  | "approval_request"
  | "applying"
  | "apply_complete"
  | "no_action_needed"
  | "error";

export type AgentMessage = {
  type: AgentMessageType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
};
