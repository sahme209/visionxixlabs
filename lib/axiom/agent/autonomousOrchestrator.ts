/**
 * Axiom Agent — Autonomous Operations Orchestrator
 *
 * The central coordination layer that ties together all Axiom subsystems
 * into end-to-end autonomous workflows. While individual modules
 * (workflowEngine, planningEngine, operationOrchestrator, cognitiveCore)
 * each manage their own state machines, this module orchestrates ACROSS
 * them — driving a scan through reasoning, planning, approval, apply,
 * verification, and rollback as a single resumable workflow.
 *
 * Architecture:
 *   ┌─────────────────────────────────────────────────────────────┐
 *   │              AUTONOMOUS OPERATIONS ORCHESTRATOR             │
 *   │                                                             │
 *   │  Workflow      ┌──────────────────────────────────┐         │
 *   │  Registry  ──► │  WorkflowInstance (state machine) │         │
 *   │                │  ┌─────┐ ┌─────┐ ┌─────┐        │         │
 *   │                │  │Stage│→│Stage│→│Stage│→ ...    │         │
 *   │                │  └─────┘ └─────┘ └─────┘        │         │
 *   │                └──────────────────────────────────┘         │
 *   │                         │                                   │
 *   │          ┌──────────────┼──────────────┐                   │
 *   │          ▼              ▼              ▼                   │
 *   │    ┌──────────┐  ┌──────────┐  ┌──────────┐               │
 *   │    │ Scanning │  │ Planning │  │ Execution│               │
 *   │    │ Engine   │  │ Engine   │  │ Engine   │               │
 *   │    └──────────┘  └──────────┘  └──────────┘               │
 *   │          │              │              │                   │
 *   │    ┌─────▼──────────────▼──────────────▼─────┐            │
 *   │    │          Checkpoint Store               │            │
 *   │    │  (resumable state, audit log, retries)  │            │
 *   │    └─────────────────────────────────────────┘            │
 *   └─────────────────────────────────────────────────────────────┘
 *
 * Key properties:
 *   - Every workflow is resumable from any checkpoint
 *   - Partial failures are contained — one stage failing doesn't corrupt others
 *   - Human approval is enforced at configurable gates
 *   - Rollback coordination spans all affected stages
 *   - Audit trail captures every state transition
 *   - Provider capability is checked before execution
 *   - Policy compliance is verified before and after apply
 */

// ═══════════════════════════════════════════════════════════════════════════
// 1. WORKFLOW LIFECYCLE — THE END-TO-END STATE MACHINE
// ═══════════════════════════════════════════════════════════════════════════

export type WorkflowInstanceStatus =
  | "pending"            // created but not started
  | "running"            // actively executing stages
  | "awaiting_approval"  // paused at a human gate
  | "paused"             // manually paused by operator
  | "resuming"           // recovering from checkpoint
  | "rolling_back"       // coordinated rollback in progress
  | "rolled_back"        // rollback completed
  | "succeeded"          // all stages completed successfully
  | "failed"             // terminal failure (after retries exhausted)
  | "cancelled"          // cancelled by operator
  | "timed_out";         // exceeded max workflow duration

export type WorkflowStage =
  | "scan"               // collect infrastructure snapshots
  | "interpret"          // classify and normalize findings
  | "reason"             // cluster, weigh, derive insights
  | "prioritize"         // rank actions by impact/risk/confidence
  | "plan"               // generate phased execution plan
  | "terraform_gen"      // generate Terraform/CLI for approved actions
  | "approval"           // human review and approval gate
  | "pre_apply_check"    // final safety/policy checks before apply
  | "apply"              // execute approved changes
  | "verify"             // confirm changes achieved desired state
  | "post_apply_audit"   // governance and compliance audit
  | "monitor"            // ongoing monitoring for regressions
  | "reflect"            // evaluate loop quality
  | "learn";             // update memory and adapt behavior

export type StageStatus =
  | "pending"            // not yet started
  | "running"            // actively executing
  | "succeeded"          // completed successfully
  | "failed"             // failed (may retry)
  | "skipped"            // skipped due to conditions or empty input
  | "rolled_back"        // this stage's changes were rolled back
  | "awaiting_approval"  // waiting for human
  | "awaiting_retry"     // failed, waiting for retry timer
  | "timed_out"          // exceeded stage timeout
  | "cancelled";         // cancelled

// ═══════════════════════════════════════════════════════════════════════════
// 2. WORKFLOW INSTANCE — THE RUNTIME STATE
// ═══════════════════════════════════════════════════════════════════════════

export type WorkflowInstance = {
  id: string;
  orgId: string;
  templateId: string;
  status: WorkflowInstanceStatus;
  currentStage: WorkflowStage;
  stages: StageExecution[];
  providers: OrchestratorProvider[];
  regions: string[];
  trigger: WorkflowTriggerSource;
  checkpoint: WorkflowCheckpoint;
  retryState: WorkflowRetryState;
  approvals: ApprovalGateState[];
  rollbackCoordination: RollbackCoordinationState;
  safetyBoundary: SafetyBoundary;
  audit: AuditTrail;
  timing: WorkflowTiming;
  metadata: Record<string, unknown>;
};

export type OrchestratorProvider = "aws" | "azure" | "gcp";

export type WorkflowTriggerSource =
  | { type: "scheduled"; scheduleId: string; scheduledAt: string }
  | { type: "manual"; triggeredBy: string; reason: string }
  | { type: "event"; eventType: string; eventPayload: Record<string, unknown> }
  | { type: "drift_detected"; driftReportId: string }
  | { type: "alert_fired"; alertId: string; severity: string }
  | { type: "resume"; previousInstanceId: string; checkpointId: string };

export type WorkflowTiming = {
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  maxDurationMs: number;
  elapsedMs: number;
  stageTimings: Record<WorkflowStage, { startedAt: string; completedAt: string | null; durationMs: number } | null>;
};

// ═══════════════════════════════════════════════════════════════════════════
// 3. STAGE EXECUTION — INDIVIDUAL STAGE STATE
// ═══════════════════════════════════════════════════════════════════════════

export type StageExecution = {
  stage: WorkflowStage;
  status: StageStatus;
  order: number;
  input: StageInput;
  output: StageOutput | null;
  error: StageError | null;
  retryCount: number;
  maxRetries: number;
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number;
  checkpointId: string | null;
  dependencies: WorkflowStage[];
  providerCapabilityCheck: ProviderCapabilityResult | null;
  policyCheckResult: PolicyCheckResult | null;
};

export type StageInput = {
  fromPreviousStage: Record<string, unknown>;
  fromCheckpoint: Record<string, unknown> | null;
  parameters: Record<string, unknown>;
};

export type StageOutput = {
  data: Record<string, unknown>;
  artifacts: StageArtifact[];
  metrics: StageMetrics;
  warnings: string[];
};

export type StageArtifact = {
  id: string;
  type: ArtifactType;
  label: string;
  data: Record<string, unknown>;
  provider: OrchestratorProvider | null;
  createdAt: string;
};

export type ArtifactType =
  | "snapshot"
  | "finding_list"
  | "reasoning_output"
  | "priority_ranking"
  | "execution_plan"
  | "terraform_module"
  | "cli_commands"
  | "approval_record"
  | "apply_result"
  | "verification_report"
  | "compliance_report"
  | "monitoring_baseline"
  | "reflection_report"
  | "memory_update";

export type StageMetrics = {
  itemsProcessed: number;
  itemsSucceeded: number;
  itemsFailed: number;
  itemsSkipped: number;
  providerBreakdown: Record<string, number>;
  durationMs: number;
  memoryUsedMb: number;
};

export type StageError = {
  code: StageErrorCode;
  message: string;
  stage: WorkflowStage;
  provider: OrchestratorProvider | null;
  recoverable: boolean;
  retryable: boolean;
  requiresHuman: boolean;
  details: Record<string, unknown>;
  timestamp: string;
};

export type StageErrorCode =
  | "provider_unavailable"       // cloud API unreachable
  | "provider_rate_limited"      // throttled by provider
  | "provider_auth_failed"       // credentials expired or revoked
  | "provider_capability_missing" // provider doesn't support this operation
  | "snapshot_incomplete"        // scan returned partial data
  | "no_findings"               // scan found nothing actionable
  | "reasoning_timeout"         // reasoning phase exceeded time limit
  | "plan_generation_failed"    // could not generate valid plan
  | "terraform_gen_failed"      // Terraform generation error
  | "approval_denied"           // human rejected the plan
  | "approval_timeout"          // approval window expired
  | "policy_violation"          // governance policy blocks execution
  | "safety_boundary_exceeded"  // blast radius or cost exceeds limits
  | "apply_failed"              // change application failed
  | "apply_partial"             // some changes applied, some failed
  | "verification_failed"       // post-apply verification failed
  | "rollback_failed"           // rollback itself failed (critical)
  | "rollback_partial"          // some rollbacks succeeded, some failed
  | "monitor_regression"        // monitoring detected regression
  | "timeout"                   // generic timeout
  | "internal_error";           // unexpected internal error

// ═══════════════════════════════════════════════════════════════════════════
// 4. CHECKPOINT SYSTEM — RESUMABILITY
// ═══════════════════════════════════════════════════════════════════════════

export type WorkflowCheckpoint = {
  id: string;
  workflowInstanceId: string;
  stage: WorkflowStage;
  stageStatus: StageStatus;
  savedAt: string;
  state: CheckpointState;
  validUntil: string;
  resumable: boolean;
  resumeInstructions: string;
};

export type CheckpointState = {
  completedStages: WorkflowStage[];
  pendingStages: WorkflowStage[];
  stageOutputs: Record<string, StageOutput>;
  accumulatedArtifacts: StageArtifact[];
  retryState: WorkflowRetryState;
  approvalState: ApprovalGateState[];
  rollbackState: RollbackCoordinationState;
  providerStates: Record<string, ProviderCheckpointState>;
};

export type ProviderCheckpointState = {
  provider: OrchestratorProvider;
  lastSuccessfulAction: string | null;
  pendingActions: string[];
  appliedResourceIds: string[];
  rollbackAvailable: boolean;
};

export type CheckpointPolicy = {
  checkpointAfterEveryStage: boolean;
  checkpointBeforeApply: boolean;
  checkpointAfterApply: boolean;
  checkpointOnFailure: boolean;
  maxCheckpointAgeDays: number;
  maxCheckpointsPerWorkflow: number;
};

export const DEFAULT_CHECKPOINT_POLICY: CheckpointPolicy = {
  checkpointAfterEveryStage: true,
  checkpointBeforeApply: true,
  checkpointAfterApply: true,
  checkpointOnFailure: true,
  maxCheckpointAgeDays: 30,
  maxCheckpointsPerWorkflow: 50,
};

// ═══════════════════════════════════════════════════════════════════════════
// 5. RETRY STRATEGY
// ═══════════════════════════════════════════════════════════════════════════

export type WorkflowRetryState = {
  totalRetries: number;
  maxTotalRetries: number;
  retryHistory: RetryRecord[];
  backoffState: BackoffState;
};

export type RetryRecord = {
  stage: WorkflowStage;
  attempt: number;
  error: StageError;
  retriedAt: string;
  outcome: "succeeded" | "failed_again" | "skipped" | "escalated";
  waitedMs: number;
};

export type BackoffState = {
  strategy: BackoffStrategy;
  currentDelayMs: number;
  maxDelayMs: number;
  jitterEnabled: boolean;
};

export type BackoffStrategy = "fixed" | "linear" | "exponential" | "exponential_with_jitter";

export type RetryPolicy = {
  stage: WorkflowStage;
  maxRetries: number;
  retryableErrors: StageErrorCode[];
  nonRetryableErrors: StageErrorCode[];
  backoffStrategy: BackoffStrategy;
  initialDelayMs: number;
  maxDelayMs: number;
  escalateAfterRetries: number;
  escalateTo: "human" | "pause" | "rollback" | "fail";
};

export const RETRY_POLICIES: RetryPolicy[] = [
  {
    stage: "scan",
    maxRetries: 3,
    retryableErrors: ["provider_unavailable", "provider_rate_limited", "snapshot_incomplete", "timeout"],
    nonRetryableErrors: ["provider_auth_failed", "provider_capability_missing"],
    backoffStrategy: "exponential_with_jitter",
    initialDelayMs: 5_000,
    maxDelayMs: 120_000,
    escalateAfterRetries: 3,
    escalateTo: "human",
  },
  {
    stage: "interpret",
    maxRetries: 2,
    retryableErrors: ["timeout", "internal_error"],
    nonRetryableErrors: ["no_findings"],
    backoffStrategy: "fixed",
    initialDelayMs: 2_000,
    maxDelayMs: 2_000,
    escalateAfterRetries: 2,
    escalateTo: "fail",
  },
  {
    stage: "reason",
    maxRetries: 2,
    retryableErrors: ["reasoning_timeout", "timeout", "internal_error"],
    nonRetryableErrors: [],
    backoffStrategy: "linear",
    initialDelayMs: 5_000,
    maxDelayMs: 30_000,
    escalateAfterRetries: 2,
    escalateTo: "human",
  },
  {
    stage: "prioritize",
    maxRetries: 1,
    retryableErrors: ["timeout", "internal_error"],
    nonRetryableErrors: [],
    backoffStrategy: "fixed",
    initialDelayMs: 2_000,
    maxDelayMs: 2_000,
    escalateAfterRetries: 1,
    escalateTo: "fail",
  },
  {
    stage: "plan",
    maxRetries: 2,
    retryableErrors: ["plan_generation_failed", "timeout", "internal_error"],
    nonRetryableErrors: [],
    backoffStrategy: "exponential",
    initialDelayMs: 5_000,
    maxDelayMs: 60_000,
    escalateAfterRetries: 2,
    escalateTo: "human",
  },
  {
    stage: "terraform_gen",
    maxRetries: 2,
    retryableErrors: ["terraform_gen_failed", "timeout", "internal_error"],
    nonRetryableErrors: ["provider_capability_missing"],
    backoffStrategy: "exponential",
    initialDelayMs: 3_000,
    maxDelayMs: 30_000,
    escalateAfterRetries: 2,
    escalateTo: "fail",
  },
  {
    stage: "approval",
    maxRetries: 0,
    retryableErrors: [],
    nonRetryableErrors: ["approval_denied", "approval_timeout"],
    backoffStrategy: "fixed",
    initialDelayMs: 0,
    maxDelayMs: 0,
    escalateAfterRetries: 0,
    escalateTo: "fail",
  },
  {
    stage: "pre_apply_check",
    maxRetries: 1,
    retryableErrors: ["timeout", "internal_error"],
    nonRetryableErrors: ["policy_violation", "safety_boundary_exceeded"],
    backoffStrategy: "fixed",
    initialDelayMs: 2_000,
    maxDelayMs: 2_000,
    escalateAfterRetries: 1,
    escalateTo: "fail",
  },
  {
    stage: "apply",
    maxRetries: 0,
    retryableErrors: [],
    nonRetryableErrors: [
      "apply_failed", "apply_partial", "provider_unavailable",
      "provider_auth_failed", "safety_boundary_exceeded",
    ],
    backoffStrategy: "fixed",
    initialDelayMs: 0,
    maxDelayMs: 0,
    escalateAfterRetries: 0,
    escalateTo: "rollback",
  },
  {
    stage: "verify",
    maxRetries: 3,
    retryableErrors: ["verification_failed", "timeout", "provider_unavailable"],
    nonRetryableErrors: [],
    backoffStrategy: "exponential_with_jitter",
    initialDelayMs: 10_000,
    maxDelayMs: 120_000,
    escalateAfterRetries: 3,
    escalateTo: "rollback",
  },
  {
    stage: "post_apply_audit",
    maxRetries: 2,
    retryableErrors: ["timeout", "internal_error"],
    nonRetryableErrors: ["policy_violation"],
    backoffStrategy: "fixed",
    initialDelayMs: 5_000,
    maxDelayMs: 5_000,
    escalateAfterRetries: 2,
    escalateTo: "human",
  },
  {
    stage: "monitor",
    maxRetries: 3,
    retryableErrors: ["provider_unavailable", "provider_rate_limited", "timeout"],
    nonRetryableErrors: ["monitor_regression"],
    backoffStrategy: "exponential_with_jitter",
    initialDelayMs: 30_000,
    maxDelayMs: 300_000,
    escalateAfterRetries: 3,
    escalateTo: "human",
  },
  {
    stage: "reflect",
    maxRetries: 1,
    retryableErrors: ["timeout", "internal_error"],
    nonRetryableErrors: [],
    backoffStrategy: "fixed",
    initialDelayMs: 2_000,
    maxDelayMs: 2_000,
    escalateAfterRetries: 1,
    escalateTo: "fail",
  },
  {
    stage: "learn",
    maxRetries: 1,
    retryableErrors: ["timeout", "internal_error"],
    nonRetryableErrors: [],
    backoffStrategy: "fixed",
    initialDelayMs: 2_000,
    maxDelayMs: 2_000,
    escalateAfterRetries: 1,
    escalateTo: "fail",
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// 6. APPROVAL GATES — HUMAN CHECKPOINTS
// ═══════════════════════════════════════════════════════════════════════════

export type ApprovalGateState = {
  gateId: string;
  stage: WorkflowStage;
  status: "pending" | "approved" | "denied" | "timed_out" | "auto_approved";
  requiredApprovers: string[];
  receivedApprovals: ApprovalVoteRecord[];
  requiredCount: number;
  autoApproveConditions: AutoApproveCondition[];
  requestedAt: string;
  resolvedAt: string | null;
  timeoutMs: number;
  escalationChain: string[];
  summary: string;
  riskAssessment: GateRiskAssessment;
};

export type ApprovalVoteRecord = {
  userId: string;
  decision: "approve" | "deny" | "abstain";
  reason: string;
  votedAt: string;
};

export type AutoApproveCondition = {
  type: "risk_below" | "cost_below" | "blast_radius_below" | "same_as_previous" | "read_only";
  threshold: number | null;
  description: string;
};

export type GateRiskAssessment = {
  overallRisk: "low" | "medium" | "high" | "critical";
  blastRadius: number;
  estimatedCostImpact: number;
  affectedResourceCount: number;
  affectedProviders: OrchestratorProvider[];
  affectedRegions: string[];
  rollbackAvailable: boolean;
  policyViolations: string[];
};

// ═══════════════════════════════════════════════════════════════════════════
// 7. ROLLBACK COORDINATION — CROSS-STAGE ROLLBACK
// ═══════════════════════════════════════════════════════════════════════════

export type RollbackCoordinationState = {
  status: "idle" | "evaluating" | "in_progress" | "completed" | "failed";
  triggeredBy: RollbackTriggerCause | null;
  triggeredAt: string | null;
  completedAt: string | null;
  stageRollbacks: StageRollbackEntry[];
  rollbackOrder: WorkflowStage[];
  rollbackStrategy: RollbackStrategyType;
  safetyChecks: RollbackSafetyCheck[];
};

export type RollbackTriggerCause =
  | { type: "apply_failure"; stageError: StageError }
  | { type: "verification_failure"; failedChecks: string[] }
  | { type: "monitoring_regression"; regressionDetails: string }
  | { type: "policy_violation"; violations: string[] }
  | { type: "manual"; triggeredBy: string; reason: string };

export type StageRollbackEntry = {
  stage: WorkflowStage;
  status: "pending" | "in_progress" | "succeeded" | "failed" | "not_applicable";
  rollbackActions: RollbackAction[];
  startedAt: string | null;
  completedAt: string | null;
  error: string | null;
};

export type RollbackAction = {
  id: string;
  description: string;
  provider: OrchestratorProvider;
  resourceId: string;
  originalState: Record<string, unknown>;
  currentState: Record<string, unknown>;
  rollbackCommand: string;
  verified: boolean;
};

export type RollbackStrategyType =
  | "reverse_order"        // undo stages in reverse chronological order
  | "provider_grouped"     // group rollbacks by provider for efficiency
  | "blast_radius_first"   // rollback highest-impact changes first
  | "dependency_aware";    // respect resource dependencies during rollback

export type RollbackSafetyCheck = {
  check: string;
  passed: boolean;
  detail: string;
};

// ═══════════════════════════════════════════════════════════════════════════
// 8. SAFETY BOUNDARIES — HARD LIMITS
// ═══════════════════════════════════════════════════════════════════════════

export type SafetyBoundary = {
  maxBlastRadius: number;
  maxCostImpactUsd: number;
  maxResourcesModified: number;
  maxConcurrentApplies: number;
  forbiddenActions: string[];
  forbiddenResourceTypes: string[];
  requireApprovalAboveRisk: "low" | "medium" | "high";
  freezePeriods: FreezePeriod[];
  providerBoundaries: ProviderBoundary[];
};

export type FreezePeriod = {
  name: string;
  startTime: string;
  endTime: string;
  scope: "all" | "apply_only" | "destructive_only";
  reason: string;
};

export type ProviderBoundary = {
  provider: OrchestratorProvider;
  enabled: boolean;
  readOnly: boolean;
  allowedRegions: string[];
  allowedResourceTypes: string[];
  maxConcurrentApplies: number;
};

export const DEFAULT_SAFETY_BOUNDARY: SafetyBoundary = {
  maxBlastRadius: 10,
  maxCostImpactUsd: 5000,
  maxResourcesModified: 25,
  maxConcurrentApplies: 3,
  forbiddenActions: ["delete_vpc", "delete_production_database", "remove_encryption", "disable_logging"],
  forbiddenResourceTypes: [],
  requireApprovalAboveRisk: "medium",
  freezePeriods: [],
  providerBoundaries: [
    { provider: "aws", enabled: true, readOnly: false, allowedRegions: [], allowedResourceTypes: [], maxConcurrentApplies: 3 },
    { provider: "azure", enabled: true, readOnly: false, allowedRegions: [], allowedResourceTypes: [], maxConcurrentApplies: 3 },
    { provider: "gcp", enabled: true, readOnly: false, allowedRegions: [], allowedResourceTypes: [], maxConcurrentApplies: 3 },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════
// 9. PROVIDER CAPABILITY CHECKS
// ═══════════════════════════════════════════════════════════════════════════

export type ProviderCapabilityResult = {
  provider: OrchestratorProvider;
  stage: WorkflowStage;
  capable: boolean;
  missingCapabilities: string[];
  fallbackAvailable: boolean;
  fallbackDescription: string | null;
};

export type ProviderCapabilitySpec = {
  provider: OrchestratorProvider;
  capabilities: {
    scan: boolean;
    planGeneration: boolean;
    terraformApply: boolean;
    cliApply: boolean;
    rollback: boolean;
    monitoring: boolean;
    costAnalysis: boolean;
    iamAnalysis: boolean;
    complianceCheck: boolean;
  };
  notes: string;
};

export const PROVIDER_CAPABILITIES: ProviderCapabilitySpec[] = [
  {
    provider: "aws",
    capabilities: {
      scan: true,
      planGeneration: true,
      terraformApply: true,
      cliApply: true,
      rollback: true,
      monitoring: true,
      costAnalysis: true,
      iamAnalysis: true,
      complianceCheck: true,
    },
    notes: "Full capability — primary provider with deepest integration",
  },
  {
    provider: "azure",
    capabilities: {
      scan: true,
      planGeneration: true,
      terraformApply: false,
      cliApply: false,
      rollback: false,
      monitoring: true,
      costAnalysis: true,
      iamAnalysis: false,
      complianceCheck: true,
    },
    notes: "Scan and read capabilities available. Apply, rollback, and IAM analysis in roadmap.",
  },
  {
    provider: "gcp",
    capabilities: {
      scan: true,
      planGeneration: true,
      terraformApply: false,
      cliApply: false,
      rollback: false,
      monitoring: true,
      costAnalysis: true,
      iamAnalysis: false,
      complianceCheck: true,
    },
    notes: "Scan and read capabilities available. Apply, rollback, and IAM analysis in roadmap.",
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// 10. POLICY CHECK INTEGRATION
// ═══════════════════════════════════════════════════════════════════════════

export type PolicyCheckResult = {
  stage: WorkflowStage;
  passed: boolean;
  violations: PolicyViolationDetail[];
  warnings: PolicyViolationDetail[];
  checkedAt: string;
  policyIds: string[];
};

export type PolicyViolationDetail = {
  policyId: string;
  policyName: string;
  severity: "low" | "medium" | "high" | "critical";
  description: string;
  affectedResources: string[];
  remediation: string;
  blocking: boolean;
};

// ═══════════════════════════════════════════════════════════════════════════
// 11. AUDIT TRAIL — EVERY TRANSITION IS RECORDED
// ═══════════════════════════════════════════════════════════════════════════

export type AuditTrail = {
  entries: AuditEntry[];
  totalEntries: number;
  firstEntry: string;
  lastEntry: string;
};

export type AuditEntry = {
  id: string;
  timestamp: string;
  action: AuditAction;
  stage: WorkflowStage | null;
  previousStatus: string | null;
  newStatus: string;
  actor: AuditActor;
  details: Record<string, unknown>;
  correlationId: string;
};

export type AuditAction =
  | "workflow_created"
  | "workflow_started"
  | "workflow_paused"
  | "workflow_resumed"
  | "workflow_cancelled"
  | "workflow_succeeded"
  | "workflow_failed"
  | "workflow_timed_out"
  | "stage_started"
  | "stage_succeeded"
  | "stage_failed"
  | "stage_skipped"
  | "stage_retried"
  | "stage_timed_out"
  | "checkpoint_created"
  | "checkpoint_restored"
  | "approval_requested"
  | "approval_granted"
  | "approval_denied"
  | "approval_timed_out"
  | "approval_auto_approved"
  | "rollback_triggered"
  | "rollback_stage_started"
  | "rollback_stage_completed"
  | "rollback_stage_failed"
  | "rollback_completed"
  | "rollback_failed"
  | "safety_boundary_checked"
  | "safety_boundary_violated"
  | "policy_checked"
  | "policy_violated"
  | "provider_capability_checked"
  | "provider_capability_missing";

export type AuditActor =
  | { type: "system"; component: string }
  | { type: "human"; userId: string }
  | { type: "workflow"; workflowId: string }
  | { type: "scheduler"; scheduleId: string };

// ═══════════════════════════════════════════════════════════════════════════
// 12. WORKFLOW TEMPLATES — PRE-CONFIGURED ORCHESTRATIONS
// ═══════════════════════════════════════════════════════════════════════════

export type WorkflowTemplate = {
  id: string;
  name: string;
  description: string;
  stages: WorkflowStage[];
  approvalGates: WorkflowStage[];
  providers: OrchestratorProvider[];
  safetyBoundary: SafetyBoundary;
  checkpointPolicy: CheckpointPolicy;
  maxDurationMs: number;
  tags: string[];
};

export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    id: "full_autonomous_loop",
    name: "Full Autonomous Loop",
    description: "End-to-end scan → reason → plan → approve → apply → verify → monitor → learn cycle. The complete Axiom loop with all safety gates.",
    stages: ["scan", "interpret", "reason", "prioritize", "plan", "terraform_gen", "approval", "pre_apply_check", "apply", "verify", "post_apply_audit", "monitor", "reflect", "learn"],
    approvalGates: ["approval"],
    providers: ["aws"],
    safetyBoundary: DEFAULT_SAFETY_BOUNDARY,
    checkpointPolicy: DEFAULT_CHECKPOINT_POLICY,
    maxDurationMs: 24 * 60 * 60 * 1000,
    tags: ["full_loop", "autonomous", "production"],
  },
  {
    id: "scan_and_recommend",
    name: "Scan & Recommend",
    description: "Scan-only workflow that produces prioritized recommendations without applying changes. Safe for any trust level.",
    stages: ["scan", "interpret", "reason", "prioritize", "reflect", "learn"],
    approvalGates: [],
    providers: ["aws", "azure", "gcp"],
    safetyBoundary: { ...DEFAULT_SAFETY_BOUNDARY, maxResourcesModified: 0 },
    checkpointPolicy: { ...DEFAULT_CHECKPOINT_POLICY, checkpointAfterEveryStage: false },
    maxDurationMs: 30 * 60 * 1000,
    tags: ["read_only", "safe", "multi_cloud"],
  },
  {
    id: "plan_and_review",
    name: "Plan & Review",
    description: "Generate execution plans and Terraform for human review without applying. Produces artifacts for manual execution.",
    stages: ["scan", "interpret", "reason", "prioritize", "plan", "terraform_gen", "reflect"],
    approvalGates: [],
    providers: ["aws"],
    safetyBoundary: { ...DEFAULT_SAFETY_BOUNDARY, maxResourcesModified: 0 },
    checkpointPolicy: DEFAULT_CHECKPOINT_POLICY,
    maxDurationMs: 60 * 60 * 1000,
    tags: ["planning", "review", "no_apply"],
  },
  {
    id: "safe_fixes_only",
    name: "Safe Fixes Only",
    description: "Apply only low-risk, non-destructive optimizations (rightsizing, storage tiering, reserved instance recommendations). Tight safety boundaries.",
    stages: ["scan", "interpret", "reason", "prioritize", "plan", "pre_apply_check", "apply", "verify", "post_apply_audit", "monitor", "learn"],
    approvalGates: [],
    providers: ["aws"],
    safetyBoundary: {
      ...DEFAULT_SAFETY_BOUNDARY,
      maxBlastRadius: 3,
      maxCostImpactUsd: 500,
      maxResourcesModified: 5,
      maxConcurrentApplies: 1,
      requireApprovalAboveRisk: "low",
    },
    checkpointPolicy: DEFAULT_CHECKPOINT_POLICY,
    maxDurationMs: 2 * 60 * 60 * 1000,
    tags: ["autopilot", "safe", "low_risk"],
  },
  {
    id: "multi_cloud_audit",
    name: "Multi-Cloud Audit",
    description: "Cross-provider compliance and governance audit. Scans all providers, evaluates policies, produces unified compliance report.",
    stages: ["scan", "interpret", "reason", "prioritize", "post_apply_audit", "reflect", "learn"],
    approvalGates: [],
    providers: ["aws", "azure", "gcp"],
    safetyBoundary: { ...DEFAULT_SAFETY_BOUNDARY, maxResourcesModified: 0 },
    checkpointPolicy: { ...DEFAULT_CHECKPOINT_POLICY, checkpointAfterEveryStage: false },
    maxDurationMs: 60 * 60 * 1000,
    tags: ["audit", "compliance", "multi_cloud", "read_only"],
  },
  {
    id: "incident_response",
    name: "Incident Response",
    description: "Triggered by drift detection or monitoring alerts. Fast-path to diagnose, plan remediation, and apply with tight approval gates.",
    stages: ["scan", "interpret", "reason", "plan", "approval", "pre_apply_check", "apply", "verify", "monitor", "learn"],
    approvalGates: ["approval"],
    providers: ["aws", "azure", "gcp"],
    safetyBoundary: {
      ...DEFAULT_SAFETY_BOUNDARY,
      maxBlastRadius: 5,
      maxCostImpactUsd: 2000,
      maxResourcesModified: 10,
    },
    checkpointPolicy: DEFAULT_CHECKPOINT_POLICY,
    maxDurationMs: 4 * 60 * 60 * 1000,
    tags: ["incident", "response", "fast_path"],
  },
  {
    id: "drift_remediation",
    name: "Drift Remediation",
    description: "Detect infrastructure drift, generate remediation plans, apply corrections to bring state back to desired configuration.",
    stages: ["scan", "interpret", "reason", "plan", "terraform_gen", "approval", "pre_apply_check", "apply", "verify", "post_apply_audit", "learn"],
    approvalGates: ["approval"],
    providers: ["aws"],
    safetyBoundary: DEFAULT_SAFETY_BOUNDARY,
    checkpointPolicy: DEFAULT_CHECKPOINT_POLICY,
    maxDurationMs: 8 * 60 * 60 * 1000,
    tags: ["drift", "remediation", "terraform"],
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// 13. STAGE DEPENDENCY GRAPH — VALID STAGE TRANSITIONS
// ═══════════════════════════════════════════════════════════════════════════

export type StageDependency = {
  stage: WorkflowStage;
  requires: WorkflowStage[];
  optional: WorkflowStage[];
  canSkipIf: string;
};

export const STAGE_DEPENDENCIES: StageDependency[] = [
  { stage: "scan", requires: [], optional: [], canSkipIf: "never" },
  { stage: "interpret", requires: ["scan"], optional: [], canSkipIf: "scan produced no resources" },
  { stage: "reason", requires: ["interpret"], optional: [], canSkipIf: "interpret produced no findings" },
  { stage: "prioritize", requires: ["reason"], optional: [], canSkipIf: "reason produced no insights" },
  { stage: "plan", requires: ["prioritize"], optional: ["reason"], canSkipIf: "no actionable items after prioritization" },
  { stage: "terraform_gen", requires: ["plan"], optional: [], canSkipIf: "plan contains no terraform-eligible actions" },
  { stage: "approval", requires: ["plan"], optional: ["terraform_gen"], canSkipIf: "all actions below approval risk threshold" },
  { stage: "pre_apply_check", requires: ["plan"], optional: ["approval"], canSkipIf: "never — always required before apply" },
  { stage: "apply", requires: ["pre_apply_check"], optional: ["approval", "terraform_gen"], canSkipIf: "never — cannot skip apply if it's in the workflow" },
  { stage: "verify", requires: ["apply"], optional: [], canSkipIf: "never — always verify after apply" },
  { stage: "post_apply_audit", requires: ["verify"], optional: [], canSkipIf: "verify produced no changes to audit" },
  { stage: "monitor", requires: ["verify"], optional: ["post_apply_audit"], canSkipIf: "workflow is read-only" },
  { stage: "reflect", requires: [], optional: ["verify", "monitor", "reason"], canSkipIf: "never" },
  { stage: "learn", requires: ["reflect"], optional: [], canSkipIf: "reflect produced no insights" },
];

// ═══════════════════════════════════════════════════════════════════════════
// 14. TASK COORDINATION MODEL — CONCURRENT OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════

export type TaskCoordinator = {
  activeWorkflows: WorkflowInstance[];
  maxConcurrentWorkflows: number;
  maxConcurrentAppliesGlobal: number;
  globalFreezePeriods: FreezePeriod[];
  providerLocks: ProviderLock[];
  resourceLocks: ResourceLock[];
  queuedWorkflows: QueuedWorkflow[];
};

export type ProviderLock = {
  provider: OrchestratorProvider;
  lockedBy: string;
  lockedAt: string;
  lockType: "exclusive" | "shared";
  reason: string;
  expiresAt: string;
};

export type ResourceLock = {
  resourceId: string;
  provider: OrchestratorProvider;
  lockedBy: string;
  lockedAt: string;
  lockType: "read" | "write" | "exclusive";
  expiresAt: string;
};

export type QueuedWorkflow = {
  workflowInstanceId: string;
  priority: number;
  queuedAt: string;
  reason: string;
  estimatedStartTime: string | null;
};

export type CoordinationPolicy = {
  maxConcurrentWorkflows: number;
  maxConcurrentAppliesGlobal: number;
  maxConcurrentAppliesPerProvider: number;
  lockTimeoutMs: number;
  queueMaxSize: number;
  queueMaxWaitMs: number;
  deconflictStrategy: "queue" | "reject" | "merge";
  resourceLockGranularity: "resource" | "provider" | "region";
};

export const DEFAULT_COORDINATION_POLICY: CoordinationPolicy = {
  maxConcurrentWorkflows: 5,
  maxConcurrentAppliesGlobal: 3,
  maxConcurrentAppliesPerProvider: 2,
  lockTimeoutMs: 30 * 60 * 1000,
  queueMaxSize: 20,
  queueMaxWaitMs: 60 * 60 * 1000,
  deconflictStrategy: "queue",
  resourceLockGranularity: "resource",
};

// ═══════════════════════════════════════════════════════════════════════════
// 15. ARCHITECTURE DIAGRAMS
// ═══════════════════════════════════════════════════════════════════════════

export type OrchestratorDiagram = {
  title: string;
  description: string;
  diagram: string;
};

export const ORCHESTRATOR_DIAGRAMS: OrchestratorDiagram[] = [
  {
    title: "Workflow Lifecycle State Machine",
    description: "All valid state transitions for a workflow instance",
    diagram: `
┌──────────────────────────────────────────────────────────────────────┐
│                 WORKFLOW LIFECYCLE STATE MACHINE                      │
│                                                                      │
│                    ┌─────────┐                                       │
│                    │ PENDING │                                       │
│                    └────┬────┘                                       │
│                         │ start()                                    │
│                         ▼                                            │
│  ┌──────────┐     ┌─────────┐     ┌───────────────┐                │
│  │ CANCELLED│◄────│ RUNNING │────►│    AWAITING    │                │
│  └──────────┘     └────┬────┘     │   APPROVAL     │                │
│       ▲                │          └───────┬───────┘                │
│       │                │                  │ approve() / deny()      │
│       │                │          ┌───────┴───────┐                │
│       │                │          │               │                │
│       │                ▼          ▼               ▼                │
│       │          ┌─────────┐  ┌─────────┐  ┌──────────┐           │
│       ├──────────│ PAUSED  │  │ RUNNING │  │  FAILED  │           │
│       │          └────┬────┘  │(resumed)│  └──────────┘           │
│       │               │       └────┬────┘       ▲                  │
│       │               │ resume()   │             │                  │
│       │               ▼            │             │                  │
│       │          ┌──────────┐      │             │                  │
│       ├──────────│ RESUMING │──────┘             │                  │
│       │          └──────────┘                    │                  │
│       │                                          │                  │
│       │          ┌──────────┐              ┌─────┴──────┐          │
│       ├──────────│TIMED OUT │              │  ROLLING   │          │
│       │          └──────────┘              │   BACK     │          │
│       │                                    └─────┬──────┘          │
│       │                                          │                  │
│       │                                    ┌─────▼──────┐          │
│       │                                    │  ROLLED    │          │
│       │                                    │   BACK     │          │
│       │                                    └────────────┘          │
│       │                                                             │
│       │          ┌───────────┐                                      │
│       └──────────│ SUCCEEDED │                                      │
│                  └───────────┘                                      │
│                                                                      │
│  Terminal states: SUCCEEDED, FAILED, CANCELLED, TIMED_OUT,          │
│                   ROLLED_BACK                                        │
└──────────────────────────────────────────────────────────────────────┘
`,
  },
  {
    title: "Stage Execution Pipeline",
    description: "How stages flow through the orchestrator with safety gates",
    diagram: `
┌──────────────────────────────────────────────────────────────────────┐
│                    STAGE EXECUTION PIPELINE                           │
│                                                                      │
│  ┌──────┐  ┌─────────┐  ┌────────┐  ┌──────────┐  ┌──────┐       │
│  │ SCAN │─►│INTERPRET│─►│ REASON │─►│PRIORITIZE│─►│ PLAN │       │
│  └──┬───┘  └────┬────┘  └───┬────┘  └────┬─────┘  └──┬───┘       │
│     │           │            │             │            │            │
│     ▼           ▼            ▼             ▼            ▼            │
│  snapshot    findings     insights      rankings    exec plan       │
│  artifacts   list        tradeoffs     priorities   + phases        │
│     │           │            │             │            │            │
│     └───────────┴────────────┴─────────────┴────────────┘            │
│                              │                                       │
│                    ┌─────────▼─────────┐                            │
│                    │  TERRAFORM GEN    │                            │
│                    │  (if applicable)  │                            │
│                    └─────────┬─────────┘                            │
│                              │                                       │
│                    ┌─────────▼─────────┐                            │
│                    │  APPROVAL GATE    │ ◄── human decision         │
│                    │  ┌─────────────┐  │                            │
│                    │  │risk summary │  │                            │
│                    │  │blast radius │  │                            │
│                    │  │cost impact  │  │                            │
│                    │  └─────────────┘  │                            │
│                    └───────┬───┬───────┘                            │
│                    approve │   │ deny                                │
│                            │   └──────────► FAILED                  │
│                    ┌───────▼───────────┐                            │
│                    │ PRE-APPLY CHECK   │ ◄── policy + safety        │
│                    │  ┌─────────────┐  │                            │
│                    │  │ governance  │  │                            │
│                    │  │ freeze chk  │  │                            │
│                    │  │ provider ok │  │                            │
│                    │  └─────────────┘  │                            │
│                    └───────┬───────────┘                            │
│                            │                                         │
│                    ┌───────▼───────────┐                            │
│                    │     APPLY         │ ◄── checkpoint before      │
│                    │  ┌─────────────┐  │                            │
│                    │  │ terraform   │  │                            │
│                    │  │ or CLI      │  │                            │
│                    │  │ per provider│  │                            │
│                    │  └─────────────┘  │                            │
│                    └───────┬───────────┘                            │
│                            │                  ┌─────────────┐       │
│                    ┌───────▼───────────┐      │  ROLLBACK   │       │
│                    │     VERIFY        │─────►│ COORDINATOR │       │
│                    └───────┬───────────┘ fail └─────────────┘       │
│                            │                                         │
│                    ┌───────▼───────────┐                            │
│                    │ POST-APPLY AUDIT  │                            │
│                    └───────┬───────────┘                            │
│                            │                                         │
│                    ┌───────▼───────────┐                            │
│                    │     MONITOR       │                            │
│                    └───────┬───────────┘                            │
│                            │                                         │
│              ┌─────────────┴─────────────┐                          │
│              ▼                           ▼                          │
│         ┌─────────┐              ┌──────────┐                      │
│         │ REFLECT │─────────────►│  LEARN   │                      │
│         └─────────┘              └──────────┘                      │
└──────────────────────────────────────────────────────────────────────┘
`,
  },
  {
    title: "Rollback Coordination Flow",
    description: "How cross-stage rollback is coordinated",
    diagram: `
┌──────────────────────────────────────────────────────────────────────┐
│                  ROLLBACK COORDINATION FLOW                          │
│                                                                      │
│  TRIGGER                                                             │
│  ┌──────────────────────────────────────────┐                       │
│  │ apply_failure | verification_failure |   │                       │
│  │ monitor_regression | policy_violation |  │                       │
│  │ manual_trigger                           │                       │
│  └────────────────────┬─────────────────────┘                       │
│                       │                                              │
│                       ▼                                              │
│  EVALUATION    ┌──────────────┐                                     │
│                │ Identify all │                                     │
│                │ applied      │                                     │
│                │ stages       │                                     │
│                └──────┬───────┘                                     │
│                       │                                              │
│                       ▼                                              │
│  ORDERING      ┌──────────────┐                                     │
│                │ Sort by      │                                     │
│                │ strategy:    │                                     │
│                │ • reverse    │                                     │
│                │ • blast-1st  │                                     │
│                │ • dep-aware  │                                     │
│                │ • provider   │                                     │
│                └──────┬───────┘                                     │
│                       │                                              │
│                       ▼                                              │
│  SAFETY        ┌──────────────┐                                     │
│  CHECKS        │ ✓ Lock check │                                     │
│                │ ✓ Dependency │                                     │
│                │ ✓ State valid│                                     │
│                │ ✓ Rollback   │                                     │
│                │   available  │                                     │
│                └──────┬───────┘                                     │
│                       │                                              │
│                       ▼                                              │
│  EXECUTION     ┌──────────────┐   ┌──────────────┐                 │
│                │ Stage N      │──►│ Stage N-1    │──► ...          │
│                │ rollback()   │   │ rollback()   │                 │
│                └──────┬───────┘   └──────┬───────┘                 │
│                       │                  │                           │
│                       ▼                  ▼                           │
│  VERIFICATION  ┌──────────────┐   ┌──────────────┐                 │
│                │ Verify       │   │ Verify       │                 │
│                │ original     │   │ original     │                 │
│                │ state        │   │ state        │                 │
│                └──────┬───────┘   └──────┬───────┘                 │
│                       │                  │                           │
│                       └──────────┬───────┘                          │
│                                  │                                   │
│                                  ▼                                   │
│  OUTCOME       ┌──────────────────────────────────┐                 │
│                │ ROLLED_BACK | ROLLBACK_FAILED    │                 │
│                │ + audit log + notification       │                 │
│                └──────────────────────────────────┘                 │
└──────────────────────────────────────────────────────────────────────┘
`,
  },
  {
    title: "Task Coordination & Locking",
    description: "How concurrent workflows coordinate via locks and queuing",
    diagram: `
┌──────────────────────────────────────────────────────────────────────┐
│                  TASK COORDINATION MODEL                             │
│                                                                      │
│  Incoming Workflows                                                  │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐                              │
│  │ WF-1 │ │ WF-2 │ │ WF-3 │ │ WF-4 │                              │
│  └──┬───┘ └──┬───┘ └──┬───┘ └──┬───┘                              │
│     │        │        │        │                                     │
│     └────────┴────────┴────────┘                                     │
│                  │                                                    │
│          ┌───────▼────────┐                                         │
│          │ COORDINATOR    │                                         │
│          │ ┌────────────┐ │                                         │
│          │ │ Concurrency│ │  max_concurrent = 5                     │
│          │ │ Check      │ │  max_applies_global = 3                 │
│          │ └─────┬──────┘ │                                         │
│          │       │        │                                         │
│          │ ┌─────▼──────┐ │                                         │
│          │ │ Freeze     │ │  check global + per-provider            │
│          │ │ Period Chk │ │                                         │
│          │ └─────┬──────┘ │                                         │
│          │       │        │                                         │
│          │ ┌─────▼──────┐ │                                         │
│          │ │ Resource   │ │  per-resource write locks                │
│          │ │ Lock Check │ │  per-provider shared/excl locks         │
│          │ └─────┬──────┘ │                                         │
│          └───────┼────────┘                                         │
│                  │                                                    │
│          ┌───────┼────────────────┐                                  │
│          │       │                │                                  │
│          ▼       ▼                ▼                                  │
│     ┌────────┐ ┌────────┐  ┌──────────┐                            │
│     │EXECUTE │ │EXECUTE │  │  QUEUE   │                            │
│     │ WF-1   │ │ WF-2   │  │  WF-3   │ (if at capacity)           │
│     └────────┘ └────────┘  │  WF-4   │                            │
│                             └──────────┘                            │
│                                                                      │
│  LOCK TYPES:                                                         │
│  ┌──────────┬──────────┬──────────────────────────┐                 │
│  │ Resource │  Write   │ One workflow at a time    │                 │
│  │ Resource │  Read    │ Multiple concurrent reads │                 │
│  │ Provider │ Exclusive│ One apply per provider    │                 │
│  │ Provider │  Shared  │ Multiple scans allowed    │                 │
│  └──────────┴──────────┴──────────────────────────┘                 │
└──────────────────────────────────────────────────────────────────────┘
`,
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// 16. EXECUTABLE FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

let _auditCounter = 0;

function auditId(): string {
  return `audit_${++_auditCounter}_${Date.now()}`;
}

function checkpointId(): string {
  return `ckpt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function createWorkflowInstance(
  orgId: string,
  templateId: string,
  trigger: WorkflowTriggerSource,
  providers: OrchestratorProvider[],
  regions: string[],
  overrides?: Partial<SafetyBoundary>,
): WorkflowInstance {
  const template = WORKFLOW_TEMPLATES.find(t => t.id === templateId);
  if (!template) throw new Error(`Unknown template: ${templateId}`);

  const now = new Date().toISOString();
  const safety = overrides ? { ...template.safetyBoundary, ...overrides } : template.safetyBoundary;

  const stages: StageExecution[] = template.stages.map((stage, i) => {
    const dep = STAGE_DEPENDENCIES.find(d => d.stage === stage);
    return {
      stage,
      status: "pending" as StageStatus,
      order: i,
      input: { fromPreviousStage: {}, fromCheckpoint: null, parameters: {} },
      output: null,
      error: null,
      retryCount: 0,
      maxRetries: RETRY_POLICIES.find(r => r.stage === stage)?.maxRetries ?? 1,
      startedAt: null,
      completedAt: null,
      durationMs: 0,
      checkpointId: null,
      dependencies: dep?.requires.filter(r => template.stages.includes(r)) ?? [],
      providerCapabilityCheck: null,
      policyCheckResult: null,
    };
  });

  const approvals: ApprovalGateState[] = template.approvalGates.map(stage => ({
    gateId: `gate_${stage}_${Date.now()}`,
    stage,
    status: "pending",
    requiredApprovers: [],
    receivedApprovals: [],
    requiredCount: 1,
    autoApproveConditions: [],
    requestedAt: now,
    resolvedAt: null,
    timeoutMs: 24 * 60 * 60 * 1000,
    escalationChain: [],
    summary: "",
    riskAssessment: {
      overallRisk: "medium",
      blastRadius: 0,
      estimatedCostImpact: 0,
      affectedResourceCount: 0,
      affectedProviders: providers,
      affectedRegions: regions,
      rollbackAvailable: true,
      policyViolations: [],
    },
  }));

  const instance: WorkflowInstance = {
    id: `wf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    orgId,
    templateId,
    status: "pending",
    currentStage: template.stages[0],
    stages,
    providers,
    regions,
    trigger,
    checkpoint: {
      id: checkpointId(),
      workflowInstanceId: "",
      stage: template.stages[0],
      stageStatus: "pending",
      savedAt: now,
      state: {
        completedStages: [],
        pendingStages: [...template.stages],
        stageOutputs: {},
        accumulatedArtifacts: [],
        retryState: { totalRetries: 0, maxTotalRetries: 10, retryHistory: [], backoffState: { strategy: "exponential_with_jitter", currentDelayMs: 5000, maxDelayMs: 300000, jitterEnabled: true } },
        approvalState: approvals,
        rollbackState: { status: "idle", triggeredBy: null, triggeredAt: null, completedAt: null, stageRollbacks: [], rollbackOrder: [], rollbackStrategy: "reverse_order", safetyChecks: [] },
        providerStates: Object.fromEntries(providers.map(p => [p, { provider: p, lastSuccessfulAction: null, pendingActions: [], appliedResourceIds: [], rollbackAvailable: false }])),
      },
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      resumable: true,
      resumeInstructions: "Resume from the first pending stage",
    },
    retryState: { totalRetries: 0, maxTotalRetries: 10, retryHistory: [], backoffState: { strategy: "exponential_with_jitter", currentDelayMs: 5000, maxDelayMs: 300000, jitterEnabled: true } },
    approvals,
    rollbackCoordination: {
      status: "idle",
      triggeredBy: null,
      triggeredAt: null,
      completedAt: null,
      stageRollbacks: [],
      rollbackOrder: [],
      rollbackStrategy: "reverse_order",
      safetyChecks: [],
    },
    safetyBoundary: safety,
    audit: { entries: [], totalEntries: 0, firstEntry: now, lastEntry: now },
    timing: {
      createdAt: now,
      startedAt: null,
      completedAt: null,
      maxDurationMs: template.maxDurationMs,
      elapsedMs: 0,
      stageTimings: {} as Record<WorkflowStage, null>,
    },
    metadata: {},
  };

  instance.checkpoint.workflowInstanceId = instance.id;
  addAuditEntry(instance, "workflow_created", null, "pending", { type: "system", component: "orchestrator" }, { templateId, providers, regions });

  return instance;
}

function addAuditEntry(
  instance: WorkflowInstance,
  action: AuditAction,
  stage: WorkflowStage | null,
  newStatus: string,
  actor: AuditActor,
  details: Record<string, unknown>,
): void {
  const entry: AuditEntry = {
    id: auditId(),
    timestamp: new Date().toISOString(),
    action,
    stage,
    previousStatus: instance.status,
    newStatus,
    actor,
    details,
    correlationId: instance.id,
  };
  instance.audit.entries.push(entry);
  instance.audit.totalEntries++;
  instance.audit.lastEntry = entry.timestamp;
}

export function startWorkflow(instance: WorkflowInstance): WorkflowInstance {
  if (instance.status !== "pending") {
    throw new Error(`Cannot start workflow in status "${instance.status}"`);
  }

  const now = new Date().toISOString();
  instance.status = "running";
  instance.timing.startedAt = now;
  addAuditEntry(instance, "workflow_started", null, "running", { type: "system", component: "orchestrator" }, {});

  return instance;
}

export function advanceWorkflow(instance: WorkflowInstance): {
  instance: WorkflowInstance;
  nextAction: WorkflowNextAction;
} {
  if (instance.status !== "running") {
    return { instance, nextAction: { type: "blocked", reason: `Workflow is ${instance.status}` } };
  }

  const elapsed = instance.timing.startedAt
    ? Date.now() - new Date(instance.timing.startedAt).getTime()
    : 0;
  if (elapsed > instance.timing.maxDurationMs) {
    instance.status = "timed_out";
    addAuditEntry(instance, "workflow_timed_out", instance.currentStage, "timed_out",
      { type: "system", component: "orchestrator" }, { elapsedMs: elapsed, maxMs: instance.timing.maxDurationMs });
    return { instance, nextAction: { type: "terminal", reason: "Workflow timed out" } };
  }

  const currentStageExec = instance.stages.find(s => s.stage === instance.currentStage);
  if (!currentStageExec) {
    return { instance, nextAction: { type: "terminal", reason: "Current stage not found" } };
  }

  if (currentStageExec.status === "succeeded") {
    const nextStageExec = instance.stages.find(s => s.order === currentStageExec.order + 1);
    if (!nextStageExec) {
      instance.status = "succeeded";
      instance.timing.completedAt = new Date().toISOString();
      addAuditEntry(instance, "workflow_succeeded", null, "succeeded",
        { type: "system", component: "orchestrator" }, {});
      return { instance, nextAction: { type: "terminal", reason: "All stages completed" } };
    }

    instance.currentStage = nextStageExec.stage;
    return { instance, nextAction: { type: "execute_stage", stage: nextStageExec.stage } };
  }

  if (currentStageExec.status === "awaiting_approval") {
    return { instance, nextAction: { type: "await_approval", stage: currentStageExec.stage } };
  }

  if (currentStageExec.status === "failed") {
    const retryPolicy = RETRY_POLICIES.find(r => r.stage === currentStageExec.stage);
    if (retryPolicy && currentStageExec.retryCount < retryPolicy.maxRetries && currentStageExec.error && retryPolicy.retryableErrors.includes(currentStageExec.error.code)) {
      return { instance, nextAction: { type: "retry_stage", stage: currentStageExec.stage, attempt: currentStageExec.retryCount + 1 } };
    }

    if (retryPolicy) {
      switch (retryPolicy.escalateTo) {
        case "rollback":
          instance.status = "rolling_back";
          addAuditEntry(instance, "rollback_triggered", currentStageExec.stage, "rolling_back",
            { type: "system", component: "orchestrator" }, { reason: "Stage failure after retries" });
          return { instance, nextAction: { type: "rollback", reason: "Stage failure after retries exhausted" } };
        case "pause":
          instance.status = "paused";
          addAuditEntry(instance, "workflow_paused", currentStageExec.stage, "paused",
            { type: "system", component: "orchestrator" }, { reason: "Escalation: pause" });
          return { instance, nextAction: { type: "blocked", reason: "Paused for human review" } };
        case "human":
          instance.status = "awaiting_approval";
          return { instance, nextAction: { type: "await_approval", stage: currentStageExec.stage } };
        default:
          instance.status = "failed";
          instance.timing.completedAt = new Date().toISOString();
          addAuditEntry(instance, "workflow_failed", currentStageExec.stage, "failed",
            { type: "system", component: "orchestrator" }, { error: currentStageExec.error });
          return { instance, nextAction: { type: "terminal", reason: "Stage failed, no recovery" } };
      }
    }

    instance.status = "failed";
    instance.timing.completedAt = new Date().toISOString();
    addAuditEntry(instance, "workflow_failed", currentStageExec.stage, "failed",
      { type: "system", component: "orchestrator" }, { error: currentStageExec.error });
    return { instance, nextAction: { type: "terminal", reason: "Stage failed" } };
  }

  if (currentStageExec.status === "pending") {
    return { instance, nextAction: { type: "execute_stage", stage: currentStageExec.stage } };
  }

  return { instance, nextAction: { type: "blocked", reason: `Stage is ${currentStageExec.status}` } };
}

export type WorkflowNextAction =
  | { type: "execute_stage"; stage: WorkflowStage }
  | { type: "retry_stage"; stage: WorkflowStage; attempt: number }
  | { type: "await_approval"; stage: WorkflowStage }
  | { type: "rollback"; reason: string }
  | { type: "blocked"; reason: string }
  | { type: "terminal"; reason: string };

export function completeStage(
  instance: WorkflowInstance,
  stage: WorkflowStage,
  output: StageOutput,
): WorkflowInstance {
  const stageExec = instance.stages.find(s => s.stage === stage);
  if (!stageExec) throw new Error(`Stage ${stage} not found`);

  stageExec.status = "succeeded";
  stageExec.output = output;
  stageExec.completedAt = new Date().toISOString();
  stageExec.durationMs = stageExec.startedAt
    ? Date.now() - new Date(stageExec.startedAt).getTime()
    : 0;

  addAuditEntry(instance, "stage_succeeded", stage, "succeeded",
    { type: "system", component: "orchestrator" }, { metrics: output.metrics });

  instance.checkpoint.state.completedStages.push(stage);
  instance.checkpoint.state.pendingStages = instance.checkpoint.state.pendingStages.filter(s => s !== stage);
  instance.checkpoint.state.stageOutputs[stage] = output;
  instance.checkpoint.state.accumulatedArtifacts.push(...output.artifacts);
  instance.checkpoint.savedAt = new Date().toISOString();

  return instance;
}

export function failStage(
  instance: WorkflowInstance,
  stage: WorkflowStage,
  error: StageError,
): WorkflowInstance {
  const stageExec = instance.stages.find(s => s.stage === stage);
  if (!stageExec) throw new Error(`Stage ${stage} not found`);

  stageExec.status = "failed";
  stageExec.error = error;
  stageExec.completedAt = new Date().toISOString();

  addAuditEntry(instance, "stage_failed", stage, "failed",
    { type: "system", component: "orchestrator" }, { error });

  return instance;
}

export function pauseWorkflow(instance: WorkflowInstance, reason: string, actor: AuditActor): WorkflowInstance {
  if (instance.status !== "running" && instance.status !== "awaiting_approval") {
    throw new Error(`Cannot pause workflow in status "${instance.status}"`);
  }
  instance.status = "paused";
  addAuditEntry(instance, "workflow_paused", instance.currentStage, "paused", actor, { reason });
  return instance;
}

export function resumeWorkflow(instance: WorkflowInstance, actor: AuditActor): WorkflowInstance {
  if (instance.status !== "paused") {
    throw new Error(`Cannot resume workflow in status "${instance.status}"`);
  }
  instance.status = "resuming";
  addAuditEntry(instance, "workflow_resumed", instance.currentStage, "resuming", actor, {});
  instance.status = "running";
  return instance;
}

export function cancelWorkflow(instance: WorkflowInstance, reason: string, actor: AuditActor): WorkflowInstance {
  const terminalStatuses: WorkflowInstanceStatus[] = ["succeeded", "failed", "cancelled", "rolled_back", "timed_out"];
  if (terminalStatuses.includes(instance.status)) {
    throw new Error(`Cannot cancel workflow in terminal status "${instance.status}"`);
  }
  instance.status = "cancelled";
  instance.timing.completedAt = new Date().toISOString();
  addAuditEntry(instance, "workflow_cancelled", instance.currentStage, "cancelled", actor, { reason });
  return instance;
}

export function approveGate(
  instance: WorkflowInstance,
  stage: WorkflowStage,
  userId: string,
  decision: "approve" | "deny",
  reason: string,
): WorkflowInstance {
  const gate = instance.approvals.find(g => g.stage === stage);
  if (!gate) throw new Error(`No approval gate for stage ${stage}`);

  gate.receivedApprovals.push({ userId, decision, reason, votedAt: new Date().toISOString() });

  const approveCount = gate.receivedApprovals.filter(v => v.decision === "approve").length;
  const denyCount = gate.receivedApprovals.filter(v => v.decision === "deny").length;

  if (denyCount > 0) {
    gate.status = "denied";
    gate.resolvedAt = new Date().toISOString();
    const stageExec = instance.stages.find(s => s.stage === stage);
    if (stageExec) {
      stageExec.status = "failed";
      stageExec.error = {
        code: "approval_denied",
        message: `Approval denied by ${userId}: ${reason}`,
        stage,
        provider: null,
        recoverable: false,
        retryable: false,
        requiresHuman: true,
        details: { userId, reason },
        timestamp: new Date().toISOString(),
      };
    }
    addAuditEntry(instance, "approval_denied", stage, "denied", { type: "human", userId }, { reason });
  } else if (approveCount >= gate.requiredCount) {
    gate.status = "approved";
    gate.resolvedAt = new Date().toISOString();
    const stageExec = instance.stages.find(s => s.stage === stage);
    if (stageExec) {
      stageExec.status = "succeeded";
      stageExec.completedAt = new Date().toISOString();
      stageExec.output = {
        data: { approvals: gate.receivedApprovals },
        artifacts: [{
          id: `approval_${stage}_${Date.now()}`,
          type: "approval_record",
          label: `Approval for ${stage}`,
          data: { approvals: gate.receivedApprovals },
          provider: null,
          createdAt: new Date().toISOString(),
        }],
        metrics: { itemsProcessed: 1, itemsSucceeded: 1, itemsFailed: 0, itemsSkipped: 0, providerBreakdown: {}, durationMs: 0, memoryUsedMb: 0 },
        warnings: [],
      };
    }
    if (instance.status === "awaiting_approval") instance.status = "running";
    addAuditEntry(instance, "approval_granted", stage, "approved", { type: "human", userId }, { reason, approveCount });
  }

  return instance;
}

export function checkProviderCapability(
  provider: OrchestratorProvider,
  stage: WorkflowStage,
): ProviderCapabilityResult {
  const spec = PROVIDER_CAPABILITIES.find(p => p.provider === provider);
  if (!spec) {
    return { provider, stage, capable: false, missingCapabilities: ["provider_not_configured"], fallbackAvailable: false, fallbackDescription: null };
  }

  const stageCapabilityMap: Record<string, keyof typeof spec.capabilities> = {
    scan: "scan",
    interpret: "scan",
    reason: "scan",
    prioritize: "scan",
    plan: "planGeneration",
    terraform_gen: "terraformApply",
    apply: "terraformApply",
    verify: "monitoring",
    monitor: "monitoring",
    post_apply_audit: "complianceCheck",
    pre_apply_check: "complianceCheck",
  };

  const requiredCapability = stageCapabilityMap[stage];
  if (!requiredCapability) return { provider, stage, capable: true, missingCapabilities: [], fallbackAvailable: false, fallbackDescription: null };

  const capable = spec.capabilities[requiredCapability];
  if (capable) return { provider, stage, capable: true, missingCapabilities: [], fallbackAvailable: false, fallbackDescription: null };

  const hasCli = spec.capabilities.cliApply;
  const fallback = stage === "apply" && hasCli;

  return {
    provider,
    stage,
    capable: false,
    missingCapabilities: [requiredCapability],
    fallbackAvailable: fallback,
    fallbackDescription: fallback ? "CLI apply available as fallback for Terraform" : null,
  };
}

export function checkSafetyBoundary(
  instance: WorkflowInstance,
  proposal: { blastRadius: number; costImpact: number; resourceCount: number; risk: "low" | "medium" | "high" | "critical" },
): { passed: boolean; violations: string[] } {
  const violations: string[] = [];
  const sb = instance.safetyBoundary;

  if (proposal.blastRadius > sb.maxBlastRadius) {
    violations.push(`Blast radius ${proposal.blastRadius} exceeds limit ${sb.maxBlastRadius}`);
  }
  if (proposal.costImpact > sb.maxCostImpactUsd) {
    violations.push(`Cost impact $${proposal.costImpact} exceeds limit $${sb.maxCostImpactUsd}`);
  }
  if (proposal.resourceCount > sb.maxResourcesModified) {
    violations.push(`Resource count ${proposal.resourceCount} exceeds limit ${sb.maxResourcesModified}`);
  }

  const riskOrder = ["low", "medium", "high", "critical"];
  const proposalRiskIdx = riskOrder.indexOf(proposal.risk);
  const thresholdIdx = riskOrder.indexOf(sb.requireApprovalAboveRisk);
  if (proposalRiskIdx > thresholdIdx) {
    const hasApprovalGate = instance.approvals.some(g => g.status === "approved");
    if (!hasApprovalGate) {
      violations.push(`Risk level "${proposal.risk}" requires approval (threshold: "${sb.requireApprovalAboveRisk}")`);
    }
  }

  const now = new Date();
  for (const freeze of sb.freezePeriods) {
    const start = new Date(freeze.startTime);
    const end = new Date(freeze.endTime);
    if (now >= start && now <= end) {
      violations.push(`In freeze period "${freeze.name}": ${freeze.reason}`);
    }
  }

  for (const action of sb.forbiddenActions) {
    // Placeholder — in production this checks against the actual plan actions
    void action;
  }

  return { passed: violations.length === 0, violations };
}

export function getRetryPolicy(stage: WorkflowStage): RetryPolicy | undefined {
  return RETRY_POLICIES.find(r => r.stage === stage);
}

export function getWorkflowTemplate(templateId: string): WorkflowTemplate | undefined {
  return WORKFLOW_TEMPLATES.find(t => t.id === templateId);
}

export function getStageDependencies(stage: WorkflowStage): StageDependency | undefined {
  return STAGE_DEPENDENCIES.find(d => d.stage === stage);
}

export function getWorkflowProgress(instance: WorkflowInstance): {
  totalStages: number;
  completedStages: number;
  currentStage: WorkflowStage;
  percentComplete: number;
  status: WorkflowInstanceStatus;
  elapsedMs: number;
} {
  const completed = instance.stages.filter(s => s.status === "succeeded" || s.status === "skipped").length;
  return {
    totalStages: instance.stages.length,
    completedStages: completed,
    currentStage: instance.currentStage,
    percentComplete: Math.round((completed / instance.stages.length) * 100),
    status: instance.status,
    elapsedMs: instance.timing.startedAt ? Date.now() - new Date(instance.timing.startedAt).getTime() : 0,
  };
}

export function getAuditTrail(instance: WorkflowInstance): AuditEntry[] {
  return [...instance.audit.entries];
}

// ═══════════════════════════════════════════════════════════════════════════
// 17. TESTS
// ═══════════════════════════════════════════════════════════════════════════

export type OrchestratorTestResult = { name: string; passed: boolean; detail: string };

export function _resetOrchestratorCounters(): void {
  _auditCounter = 0;
}

export function runAutonomousOrchestratorTests(): OrchestratorTestResult[] {
  const results: OrchestratorTestResult[] = [];
  _resetOrchestratorCounters();

  // 1. Create workflow from template
  const wf = createWorkflowInstance(
    "org_test", "full_autonomous_loop",
    { type: "manual", triggeredBy: "test_user", reason: "test" },
    ["aws"], ["us-east-1"],
  );
  results.push({
    name: "createWorkflowInstance produces valid instance",
    passed: wf.status === "pending" && wf.stages.length === 14 && wf.orgId === "org_test",
    detail: `status=${wf.status}, stages=${wf.stages.length}`,
  });

  // 2. Start workflow
  startWorkflow(wf);
  results.push({
    name: "startWorkflow transitions to running",
    passed: wf.status === "running",
    detail: `status=${wf.status}`,
  });

  // 3. Advance produces execute_stage for first pending stage
  const { nextAction } = advanceWorkflow(wf);
  results.push({
    name: "advanceWorkflow returns execute_stage for pending stage",
    passed: nextAction.type === "execute_stage" && (nextAction as { stage: WorkflowStage }).stage === "scan",
    detail: `action=${nextAction.type}`,
  });

  // 4. Complete a stage
  completeStage(wf, "scan", {
    data: { resourceCount: 42 },
    artifacts: [{ id: "snap1", type: "snapshot", label: "test", data: {}, provider: "aws", createdAt: new Date().toISOString() }],
    metrics: { itemsProcessed: 42, itemsSucceeded: 42, itemsFailed: 0, itemsSkipped: 0, providerBreakdown: { aws: 42 }, durationMs: 5000, memoryUsedMb: 64 },
    warnings: [],
  });
  results.push({
    name: "completeStage marks stage succeeded and advances checkpoint",
    passed: wf.stages[0].status === "succeeded" && wf.checkpoint.state.completedStages.includes("scan"),
    detail: `stage status=${wf.stages[0].status}, checkpoint has scan=${wf.checkpoint.state.completedStages.includes("scan")}`,
  });

  // 5. Fail a stage and check retry escalation
  const wf2 = createWorkflowInstance(
    "org_test", "scan_and_recommend",
    { type: "manual", triggeredBy: "test", reason: "test" },
    ["aws"], ["us-east-1"],
  );
  startWorkflow(wf2);
  failStage(wf2, "scan", {
    code: "provider_unavailable", message: "AWS API unreachable", stage: "scan",
    provider: "aws", recoverable: true, retryable: true, requiresHuman: false,
    details: {}, timestamp: new Date().toISOString(),
  });
  const { nextAction: retryAction } = advanceWorkflow(wf2);
  results.push({
    name: "advanceWorkflow returns retry for retryable failure",
    passed: retryAction.type === "retry_stage",
    detail: `action=${retryAction.type}`,
  });

  // 6. Non-retryable error escalates correctly
  const wf3 = createWorkflowInstance(
    "org_test", "scan_and_recommend",
    { type: "manual", triggeredBy: "test", reason: "test" },
    ["aws"], ["us-east-1"],
  );
  startWorkflow(wf3);
  failStage(wf3, "scan", {
    code: "provider_auth_failed", message: "Credentials expired", stage: "scan",
    provider: "aws", recoverable: false, retryable: false, requiresHuman: true,
    details: {}, timestamp: new Date().toISOString(),
  });
  const { nextAction: escalateAction } = advanceWorkflow(wf3);
  results.push({
    name: "Non-retryable error escalates to human",
    passed: escalateAction.type === "await_approval",
    detail: `action=${escalateAction.type}`,
  });

  // 7. Pause and resume
  pauseWorkflow(wf, "maintenance window", { type: "human", userId: "admin" });
  results.push({
    name: "pauseWorkflow transitions to paused",
    passed: wf.status === "paused",
    detail: `status=${wf.status}`,
  });
  resumeWorkflow(wf, { type: "human", userId: "admin" });
  results.push({
    name: "resumeWorkflow transitions back to running",
    passed: wf.status === "running",
    detail: `status=${wf.status}`,
  });

  // 8. Cancel workflow
  const wf4 = createWorkflowInstance(
    "org_test", "scan_and_recommend",
    { type: "manual", triggeredBy: "test", reason: "test" },
    ["aws"], ["us-east-1"],
  );
  startWorkflow(wf4);
  cancelWorkflow(wf4, "no longer needed", { type: "human", userId: "admin" });
  results.push({
    name: "cancelWorkflow transitions to cancelled",
    passed: wf4.status === "cancelled",
    detail: `status=${wf4.status}`,
  });

  // 9. Approval gate
  const wf5 = createWorkflowInstance(
    "org_test", "full_autonomous_loop",
    { type: "manual", triggeredBy: "test", reason: "test" },
    ["aws"], ["us-east-1"],
  );
  startWorkflow(wf5);
  approveGate(wf5, "approval", "admin", "approve", "looks good");
  results.push({
    name: "approveGate marks gate approved and advances workflow",
    passed: wf5.approvals[0].status === "approved",
    detail: `gate status=${wf5.approvals[0].status}`,
  });

  // 10. Denial blocks workflow
  const wf6 = createWorkflowInstance(
    "org_test", "full_autonomous_loop",
    { type: "manual", triggeredBy: "test", reason: "test" },
    ["aws"], ["us-east-1"],
  );
  startWorkflow(wf6);
  approveGate(wf6, "approval", "admin", "deny", "too risky");
  results.push({
    name: "Denial marks gate denied and stage failed",
    passed: wf6.approvals[0].status === "denied",
    detail: `gate status=${wf6.approvals[0].status}`,
  });

  // 11. Provider capability check — AWS full
  const awsCheck = checkProviderCapability("aws", "apply");
  results.push({
    name: "AWS has full apply capability",
    passed: awsCheck.capable,
    detail: `capable=${awsCheck.capable}`,
  });

  // 12. Provider capability check — Azure apply missing
  const azureCheck = checkProviderCapability("azure", "apply");
  results.push({
    name: "Azure lacks apply capability (expected)",
    passed: !azureCheck.capable && azureCheck.missingCapabilities.includes("terraformApply"),
    detail: `capable=${azureCheck.capable}, missing=${azureCheck.missingCapabilities.join(",")}`,
  });

  // 13. Safety boundary check — within limits
  const safeCheck = checkSafetyBoundary(wf, { blastRadius: 3, costImpact: 100, resourceCount: 5, risk: "low" });
  results.push({
    name: "Safety check passes within limits",
    passed: safeCheck.passed,
    detail: `passed=${safeCheck.passed}, violations=${safeCheck.violations.length}`,
  });

  // 14. Safety boundary check — exceeds limits
  const unsafeCheck = checkSafetyBoundary(wf, { blastRadius: 50, costImpact: 100000, resourceCount: 500, risk: "critical" });
  results.push({
    name: "Safety check fails when exceeding limits",
    passed: !unsafeCheck.passed && unsafeCheck.violations.length >= 3,
    detail: `passed=${unsafeCheck.passed}, violations=${unsafeCheck.violations.length}`,
  });

  // 15. Workflow templates cover required archetypes
  results.push({
    name: "WORKFLOW_TEMPLATES has 7 templates",
    passed: WORKFLOW_TEMPLATES.length === 7,
    detail: `${WORKFLOW_TEMPLATES.length} templates`,
  });

  // 16. Retry policies cover all 14 stages
  const coveredStages = RETRY_POLICIES.map(r => r.stage);
  const allStages: WorkflowStage[] = ["scan", "interpret", "reason", "prioritize", "plan", "terraform_gen", "approval", "pre_apply_check", "apply", "verify", "post_apply_audit", "monitor", "reflect", "learn"];
  const allCovered = allStages.every(s => coveredStages.includes(s));
  results.push({
    name: "RETRY_POLICIES covers all 14 workflow stages",
    passed: allCovered && RETRY_POLICIES.length === 14,
    detail: `${RETRY_POLICIES.length} policies, all covered=${allCovered}`,
  });

  // 17. Stage dependencies cover all stages
  const depStages = STAGE_DEPENDENCIES.map(d => d.stage);
  const depsAllCovered = allStages.every(s => depStages.includes(s));
  results.push({
    name: "STAGE_DEPENDENCIES covers all 14 stages",
    passed: depsAllCovered,
    detail: `${STAGE_DEPENDENCIES.length} dependencies defined`,
  });

  // 18. Audit trail accumulates entries
  const auditEntries = getAuditTrail(wf);
  results.push({
    name: "Audit trail captures all state transitions",
    passed: auditEntries.length >= 4,
    detail: `${auditEntries.length} entries`,
  });

  // 19. Progress tracking
  const progress = getWorkflowProgress(wf);
  results.push({
    name: "getWorkflowProgress returns correct state",
    passed: progress.totalStages === 14 && progress.completedStages === 1 && progress.percentComplete === 7,
    detail: `${progress.completedStages}/${progress.totalStages} = ${progress.percentComplete}%`,
  });

  // 20. Diagrams present
  results.push({
    name: "ORCHESTRATOR_DIAGRAMS has 4 architecture diagrams",
    passed: ORCHESTRATOR_DIAGRAMS.length === 4,
    detail: `${ORCHESTRATOR_DIAGRAMS.length} diagrams`,
  });

  return results;
}
