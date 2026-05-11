// ─────────────────────────────────────────────────────────────────────────────
// Autonomous Coordination Framework
// Multi-workflow orchestration with safety, isolation, and auditability
// ─────────────────────────────────────────────────────────────────────────────

// ═══════════════════════════════════════════════════════════════════════════════
// §1 — Coordination Architecture
// ═══════════════════════════════════════════════════════════════════════════════

export type CoordinatedOperationType =
  | "scan"
  | "monitoring"
  | "reasoning"
  | "approval_routing"
  | "terraform_generation"
  | "apply"
  | "verification"
  | "rollback"
  | "scheduled_maintenance"
  | "predictive_alert"
  | "governance_check"
  | "intelligence_refresh"
  | "simulation"
  | "org_learning";

export type OperationPriority = "critical" | "high" | "standard" | "low" | "background";

export type OperationIsolationLevel = "full" | "shared_read" | "shared_state" | "none";

export interface CoordinatedOperation {
  id: string;
  orgId: string;
  operationType: CoordinatedOperationType;
  priority: OperationPriority;
  isolationLevel: OperationIsolationLevel;
  state: OperationStateMachineState;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  parentOperationId: string | null;
  childOperationIds: string[];
  resourceClaims: ResourceClaim[];
  approvalDependencies: ApprovalDependency[];
  conflictGroup: string;
  interruptible: boolean;
  resumable: boolean;
  checkpointId: string | null;
  ttlMs: number;
  metadata: Record<string, unknown>;
}

export interface ResourceClaim {
  resourceId: string;
  claimType: "exclusive" | "shared_read" | "shared_write";
  acquiredAt: string | null;
  releasedAt: string | null;
  waitingForOperationId: string | null;
}

export interface ApprovalDependency {
  dependencyId: string;
  dependencyType: "requires_approval" | "requires_completion" | "requires_verification";
  targetOperationId: string | null;
  targetGateId: string | null;
  satisfied: boolean;
  satisfiedAt: string | null;
  timeoutMs: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// §2 — Operation State Machine
// ═══════════════════════════════════════════════════════════════════════════════

export type OperationStateMachineState =
  | "queued"
  | "waiting_for_resources"
  | "waiting_for_approval"
  | "waiting_for_dependency"
  | "initializing"
  | "running"
  | "paused"
  | "interrupted"
  | "checkpointing"
  | "resuming"
  | "completing"
  | "succeeded"
  | "failed"
  | "rolled_back"
  | "cancelled"
  | "timed_out"
  | "deadlocked";

export interface OperationStateTransition {
  from: OperationStateMachineState;
  to: OperationStateMachineState;
  trigger: TransitionTrigger;
  guard: string;
  sideEffects: string[];
}

export type TransitionTrigger =
  | "resources_acquired"
  | "approval_granted"
  | "dependency_satisfied"
  | "initialization_complete"
  | "step_completed"
  | "pause_requested"
  | "interrupt_requested"
  | "checkpoint_saved"
  | "resume_requested"
  | "all_steps_done"
  | "error_occurred"
  | "rollback_triggered"
  | "rollback_complete"
  | "cancel_requested"
  | "timeout_reached"
  | "deadlock_detected"
  | "recovery_attempted"
  | "recovery_succeeded"
  | "approval_denied"
  | "conflict_detected";

export const OPERATION_STATE_TRANSITIONS: OperationStateTransition[] = [
  // Startup flow
  { from: "queued", to: "waiting_for_resources", trigger: "resources_acquired", guard: "Resources not yet acquired — waiting for claims to be fulfilled", sideEffects: ["log_transition"] },
  { from: "queued", to: "waiting_for_approval", trigger: "approval_granted", guard: "Operation requires pre-approval", sideEffects: ["log_transition", "notify_approvers"] },
  { from: "queued", to: "waiting_for_dependency", trigger: "dependency_satisfied", guard: "Dependencies not yet satisfied", sideEffects: ["log_transition"] },
  { from: "waiting_for_resources", to: "initializing", trigger: "resources_acquired", guard: "All resource claims fulfilled", sideEffects: ["log_transition", "mark_claims_acquired"] },
  { from: "waiting_for_approval", to: "waiting_for_resources", trigger: "approval_granted", guard: "Approval received, proceed to resource acquisition", sideEffects: ["log_transition", "record_approval"] },
  { from: "waiting_for_approval", to: "cancelled", trigger: "approval_denied", guard: "Approval denied", sideEffects: ["log_transition", "release_all_claims", "notify_requester"] },
  { from: "waiting_for_dependency", to: "waiting_for_resources", trigger: "dependency_satisfied", guard: "All dependencies satisfied", sideEffects: ["log_transition"] },
  { from: "initializing", to: "running", trigger: "initialization_complete", guard: "Initialization checks passed", sideEffects: ["log_transition", "start_timer"] },

  // Running flow
  { from: "running", to: "paused", trigger: "pause_requested", guard: "Operation supports pausing at current step", sideEffects: ["log_transition", "save_checkpoint"] },
  { from: "running", to: "interrupted", trigger: "interrupt_requested", guard: "Higher-priority operation needs resources", sideEffects: ["log_transition", "save_checkpoint", "release_non_essential_claims"] },
  { from: "running", to: "checkpointing", trigger: "checkpoint_saved", guard: "Periodic checkpoint interval reached", sideEffects: ["save_checkpoint"] },
  { from: "running", to: "completing", trigger: "all_steps_done", guard: "All operation steps completed successfully", sideEffects: ["log_transition"] },
  { from: "running", to: "failed", trigger: "error_occurred", guard: "Unrecoverable error during execution", sideEffects: ["log_transition", "save_checkpoint", "release_all_claims", "trigger_rollback_if_applicable"] },
  { from: "running", to: "rolled_back", trigger: "rollback_triggered", guard: "Rollback initiated by safety check or human", sideEffects: ["log_transition", "execute_rollback", "release_all_claims"] },
  { from: "running", to: "timed_out", trigger: "timeout_reached", guard: "Operation TTL exceeded", sideEffects: ["log_transition", "save_checkpoint", "release_all_claims", "notify_timeout"] },
  { from: "checkpointing", to: "running", trigger: "checkpoint_saved", guard: "Checkpoint persisted", sideEffects: [] },

  // Resume flow
  { from: "paused", to: "resuming", trigger: "resume_requested", guard: "Resume approved and resources available", sideEffects: ["log_transition", "reacquire_claims"] },
  { from: "interrupted", to: "resuming", trigger: "resume_requested", guard: "Interrupting operation completed, resources freed", sideEffects: ["log_transition", "reacquire_claims"] },
  { from: "resuming", to: "running", trigger: "initialization_complete", guard: "Checkpoint restored and validation passed", sideEffects: ["log_transition", "restore_checkpoint"] },

  // Terminal states
  { from: "completing", to: "succeeded", trigger: "all_steps_done", guard: "Post-completion verification passed", sideEffects: ["log_transition", "release_all_claims", "update_audit_trail", "notify_completion"] },
  { from: "failed", to: "resuming", trigger: "recovery_attempted", guard: "Recovery strategy available and retry budget not exhausted", sideEffects: ["log_transition"] },
  { from: "rolled_back", to: "queued", trigger: "recovery_succeeded", guard: "Rollback succeeded and re-execution approved", sideEffects: ["log_transition", "reset_state"] },

  // Cancellation from any active state
  { from: "running", to: "cancelled", trigger: "cancel_requested", guard: "Human or system requested cancellation", sideEffects: ["log_transition", "save_checkpoint", "release_all_claims"] },
  { from: "paused", to: "cancelled", trigger: "cancel_requested", guard: "Cancelled while paused", sideEffects: ["log_transition", "release_all_claims"] },
  { from: "waiting_for_approval", to: "cancelled", trigger: "cancel_requested", guard: "Cancelled while waiting for approval", sideEffects: ["log_transition"] },
  { from: "waiting_for_resources", to: "cancelled", trigger: "cancel_requested", guard: "Cancelled while waiting for resources", sideEffects: ["log_transition", "release_all_claims"] },
  { from: "waiting_for_dependency", to: "cancelled", trigger: "cancel_requested", guard: "Cancelled while waiting for dependency", sideEffects: ["log_transition"] },
  { from: "waiting_for_resources", to: "deadlocked", trigger: "deadlock_detected", guard: "Circular resource dependency detected", sideEffects: ["log_transition", "release_all_claims", "notify_deadlock"] },

  // Conflict handling
  { from: "running", to: "paused", trigger: "conflict_detected", guard: "Conflicting operation detected — pause and wait", sideEffects: ["log_transition", "save_checkpoint"] },
];

// ═══════════════════════════════════════════════════════════════════════════════
// §3 — Concurrency Strategy
// ═══════════════════════════════════════════════════════════════════════════════

export interface ConcurrencyPolicy {
  maxConcurrentOperations: number;
  maxConcurrentApplies: number;
  maxConcurrentScans: number;
  maxConcurrentRollbacks: number;
  maxOperationsPerProvider: Record<string, number>;
  maxOperationsPerRegion: number;
  priorityPreemption: boolean;
  deadlockDetectionIntervalMs: number;
  starvationTimeoutMs: number;
  fairnessPolicy: FairnessPolicy;
}

export type FairnessPolicy = "strict_priority" | "weighted_fair" | "round_robin" | "aging_priority";

export const DEFAULT_CONCURRENCY_POLICY: ConcurrencyPolicy = {
  maxConcurrentOperations: 20,
  maxConcurrentApplies: 3,
  maxConcurrentScans: 5,
  maxConcurrentRollbacks: 2,
  maxOperationsPerProvider: { aws: 10, azure: 5, gcp: 5 },
  maxOperationsPerRegion: 3,
  priorityPreemption: true,
  deadlockDetectionIntervalMs: 30000,
  starvationTimeoutMs: 600000,
  fairnessPolicy: "aging_priority",
};

export interface OperationSlot {
  slotId: string;
  operationType: CoordinatedOperationType;
  provider: "aws" | "azure" | "gcp" | null;
  region: string | null;
  operationId: string | null;
  reserved: boolean;
  reservedAt: string | null;
  reservedUntil: string | null;
}

export interface ConcurrencySnapshot {
  timestamp: string;
  totalSlots: number;
  usedSlots: number;
  availableSlots: number;
  byType: Record<string, { running: number; max: number }>;
  byProvider: Record<string, { running: number; max: number }>;
  queueDepth: number;
  oldestQueuedMs: number;
  deadlocksDetected: number;
  preemptionsThisPeriod: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// §4 — Conflict Detection & Resolution
// ═══════════════════════════════════════════════════════════════════════════════

export type ConflictCategory =
  | "resource_contention"
  | "state_mutation_overlap"
  | "provider_rate_limit"
  | "region_capacity"
  | "approval_gate_collision"
  | "rollback_in_progress"
  | "freeze_period_active"
  | "safety_boundary_exceeded"
  | "terraform_state_lock"
  | "circular_dependency";

export interface OperationConflict {
  id: string;
  detectedAt: string;
  category: ConflictCategory;
  severity: "low" | "medium" | "high" | "blocking";
  operationA: string;
  operationB: string;
  conflictingResources: string[];
  description: string;
  resolution: ConflictResolutionStrategy;
  autoResolvable: boolean;
  resolvedAt: string | null;
}

export interface ConflictResolutionStrategy {
  method: ConflictResolutionMethod;
  description: string;
  affectedOperationId: string;
  action: string;
  estimatedDelayMs: number;
}

export type ConflictResolutionMethod =
  | "priority_preemption"
  | "delay_lower_priority"
  | "serialize"
  | "merge_operations"
  | "cancel_conflicting"
  | "human_decision"
  | "deadlock_break";

export interface ConflictDetectionRule {
  id: string;
  name: string;
  category: ConflictCategory;
  description: string;
  detectionMethod: string;
  resolution: ConflictResolutionMethod;
  autoResolve: boolean;
}

export const CONFLICT_DETECTION_RULES: ConflictDetectionRule[] = [
  {
    id: "cdr-01",
    name: "Exclusive resource contention",
    category: "resource_contention",
    description: "Two operations claim exclusive access to the same resource. Only one can proceed.",
    detectionMethod: "Check resource claim overlap where either claim is exclusive.",
    resolution: "priority_preemption",
    autoResolve: true,
  },
  {
    id: "cdr-02",
    name: "Terraform state lock",
    category: "terraform_state_lock",
    description: "Two Terraform operations target the same state file. Terraform requires exclusive state access.",
    detectionMethod: "Check if any two apply or terraform_generation operations share the same Terraform workspace.",
    resolution: "serialize",
    autoResolve: true,
  },
  {
    id: "cdr-03",
    name: "Rollback in progress",
    category: "rollback_in_progress",
    description: "A new operation targets resources that are currently being rolled back. Must wait for rollback to complete.",
    detectionMethod: "Check if any resource in new operation's claims is also claimed by a running rollback.",
    resolution: "delay_lower_priority",
    autoResolve: true,
  },
  {
    id: "cdr-04",
    name: "Freeze period enforcement",
    category: "freeze_period_active",
    description: "An apply operation is requested during a freeze period. Only scan and monitoring operations are permitted.",
    detectionMethod: "Check current time against configured freeze periods for the target provider/region.",
    resolution: "cancel_conflicting",
    autoResolve: true,
  },
  {
    id: "cdr-05",
    name: "Provider rate limit risk",
    category: "provider_rate_limit",
    description: "Too many concurrent API calls to a single provider service may trigger rate limiting.",
    detectionMethod: "Check concurrent operation count per provider against rate limit thresholds.",
    resolution: "delay_lower_priority",
    autoResolve: true,
  },
  {
    id: "cdr-06",
    name: "Region capacity saturation",
    category: "region_capacity",
    description: "Too many concurrent operations in a single region increases coordination risk.",
    detectionMethod: "Check concurrent operation count per region against max threshold.",
    resolution: "delay_lower_priority",
    autoResolve: true,
  },
  {
    id: "cdr-07",
    name: "State mutation overlap",
    category: "state_mutation_overlap",
    description: "Two operations modify overlapping infrastructure state (e.g., both modify the same security group).",
    detectionMethod: "Check proposed state changes for overlapping resource/field pairs.",
    resolution: "serialize",
    autoResolve: true,
  },
  {
    id: "cdr-08",
    name: "Approval gate collision",
    category: "approval_gate_collision",
    description: "Multiple operations request approval simultaneously, risking approval fatigue or confusion.",
    detectionMethod: "Check pending approval queue depth exceeds threshold.",
    resolution: "serialize",
    autoResolve: true,
  },
  {
    id: "cdr-09",
    name: "Safety boundary breach",
    category: "safety_boundary_exceeded",
    description: "Combined blast radius of concurrent operations exceeds the organization's safety boundary.",
    detectionMethod: "Sum blast radius across all running apply operations and compare against max.",
    resolution: "delay_lower_priority",
    autoResolve: true,
  },
  {
    id: "cdr-10",
    name: "Circular dependency deadlock",
    category: "circular_dependency",
    description: "Two or more operations are waiting on each other's resource claims or approval dependencies.",
    detectionMethod: "Build wait-for graph from resource claims and check for cycles.",
    resolution: "deadlock_break",
    autoResolve: false,
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// §5 — Scheduling & Priority System
// ═══════════════════════════════════════════════════════════════════════════════

export interface OperationScheduler {
  orgId: string;
  scheduledOperations: ScheduledOperation[];
  recurringSchedules: RecurringSchedule[];
  maintenanceWindows: MaintenanceWindow[];
  blackoutPeriods: BlackoutPeriod[];
}

export interface ScheduledOperation {
  id: string;
  operationType: CoordinatedOperationType;
  scheduledAt: string;
  priority: OperationPriority;
  targets: ScheduleTarget[];
  preconditions: SchedulePrecondition[];
  status: "scheduled" | "dispatched" | "skipped" | "expired";
  createdBy: "agent" | "human" | "policy";
  reason: string;
}

export interface ScheduleTarget {
  provider: "aws" | "azure" | "gcp";
  regions: string[];
  resourceTypes: string[];
  resourceIds: string[];
}

export interface SchedulePrecondition {
  type: "no_active_incidents" | "within_maintenance_window" | "approval_pre_obtained" | "previous_scan_stale" | "budget_available" | "custom";
  description: string;
  checkFunction: string;
}

export interface RecurringSchedule {
  id: string;
  operationType: CoordinatedOperationType;
  cronExpression: string;
  timezone: string;
  priority: OperationPriority;
  targets: ScheduleTarget[];
  enabled: boolean;
  lastRun: string | null;
  nextRun: string;
  skipDuringBlackout: boolean;
  maxConsecutiveSkips: number;
}

export interface MaintenanceWindow {
  id: string;
  name: string;
  dayOfWeek: number;
  startHourUtc: number;
  durationHours: number;
  allowedOperations: CoordinatedOperationType[];
  preferredForApplies: boolean;
}

export interface BlackoutPeriod {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  scope: "all_operations" | "apply_only" | "destructive_only";
  reason: string;
  createdBy: string;
}

export interface PriorityCalculation {
  basePriority: OperationPriority;
  ageBoostMs: number;
  ageBoostThresholdMs: number;
  incidentBoost: boolean;
  governanceBoost: boolean;
  humanRequestBoost: boolean;
  effectivePriorityScore: number;
}

export const PRIORITY_SCORES: Record<OperationPriority, number> = {
  critical: 100,
  high: 75,
  standard: 50,
  low: 25,
  background: 10,
};

export const OPERATION_DEFAULT_PRIORITIES: Record<CoordinatedOperationType, OperationPriority> = {
  rollback: "critical",
  governance_check: "high",
  monitoring: "high",
  predictive_alert: "high",
  verification: "high",
  approval_routing: "standard",
  reasoning: "standard",
  apply: "standard",
  terraform_generation: "standard",
  scan: "standard",
  simulation: "low",
  scheduled_maintenance: "low",
  intelligence_refresh: "background",
  org_learning: "background",
};

export const OPERATION_ISOLATION_DEFAULTS: Record<CoordinatedOperationType, OperationIsolationLevel> = {
  scan: "shared_read",
  monitoring: "shared_read",
  reasoning: "shared_read",
  approval_routing: "none",
  terraform_generation: "shared_state",
  apply: "full",
  verification: "shared_read",
  rollback: "full",
  scheduled_maintenance: "full",
  predictive_alert: "none",
  governance_check: "shared_read",
  intelligence_refresh: "shared_read",
  simulation: "none",
  org_learning: "none",
};

// ═══════════════════════════════════════════════════════════════════════════════
// §6 — Interruption & Resumption
// ═══════════════════════════════════════════════════════════════════════════════

export interface InterruptionRequest {
  id: string;
  targetOperationId: string;
  reason: InterruptionReason;
  requestedBy: "system" | "human" | "higher_priority_operation";
  preemptingOperationId: string | null;
  gracePeriodMs: number;
  forceAfterGracePeriod: boolean;
}

export type InterruptionReason =
  | "higher_priority_preemption"
  | "resource_needed"
  | "safety_concern"
  | "freeze_period_started"
  | "incident_detected"
  | "human_request"
  | "deadlock_resolution"
  | "rate_limit_approaching"
  | "budget_exhausted";

export interface ResumptionRequest {
  id: string;
  targetOperationId: string;
  checkpointId: string;
  requestedBy: "system" | "human";
  validationRequired: boolean;
  reacquireResources: boolean;
}

export interface OperationCheckpointData {
  operationId: string;
  checkpointId: string;
  savedAt: string;
  state: OperationStateMachineState;
  completedSteps: string[];
  pendingSteps: string[];
  resourceClaimsSnapshot: ResourceClaim[];
  stateSnapshot: Record<string, unknown>;
  validUntil: string;
  resumeInstructions: string;
  integrityHash: string;
}

export interface ResumptionValidation {
  checkpointValid: boolean;
  checkpointExpired: boolean;
  resourcesAvailable: boolean;
  stateConsistent: boolean;
  conflictsDetected: boolean;
  validationErrors: string[];
  canResume: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// §7 — Rollback Coordination
// ═══════════════════════════════════════════════════════════════════════════════

export interface CoordinatedRollbackRequest {
  id: string;
  triggerOperationId: string;
  triggerReason: CoordinatedRollbackReason;
  affectedOperationIds: string[];
  rollbackStrategy: CoordinatedRollbackStrategy;
  cascadePolicy: CascadePolicy;
  safetyChecks: RollbackSafetyValidation[];
}

export type CoordinatedRollbackReason =
  | "apply_failure"
  | "verification_failure"
  | "monitoring_regression"
  | "safety_violation"
  | "human_initiated"
  | "cascade_from_dependency"
  | "governance_violation"
  | "simulation_mismatch";

export type CoordinatedRollbackStrategy =
  | "reverse_chronological"
  | "dependency_aware"
  | "blast_radius_first"
  | "provider_grouped"
  | "parallel_independent";

export interface CascadePolicy {
  cascadeToChildren: boolean;
  cascadeToDependents: boolean;
  maxCascadeDepth: number;
  requireConfirmationPerLevel: boolean;
  excludeOperationTypes: CoordinatedOperationType[];
}

export interface RollbackSafetyValidation {
  checkName: string;
  description: string;
  passed: boolean | null;
  result: string;
  blocksRollback: boolean;
}

export interface CoordinatedRollbackPlan {
  id: string;
  requestId: string;
  generatedAt: string;
  phases: RollbackPhase[];
  estimatedDurationMinutes: number;
  estimatedRiskScore: number;
  requiresApproval: boolean;
  approvalReason: string | null;
}

export interface RollbackPhase {
  order: number;
  operationId: string;
  action: string;
  resourceIds: string[];
  estimatedDurationSeconds: number;
  dependsOnPhase: number | null;
  verification: string;
  failureAction: "abort_all" | "skip_and_continue" | "escalate";
}

// ═══════════════════════════════════════════════════════════════════════════════
// §8 — Cross-Operation Dependency Graph
// ═══════════════════════════════════════════════════════════════════════════════

export interface OperationDependencyGraph {
  orgId: string;
  builtAt: string;
  nodes: OperationDependencyNode[];
  edges: OperationDependencyEdge[];
  topologicalOrder: string[];
  parallelGroups: string[][];
  criticalPath: string[];
  cycles: string[][];
}

export interface OperationDependencyNode {
  operationId: string;
  operationType: CoordinatedOperationType;
  state: OperationStateMachineState;
  priority: OperationPriority;
  effectivePriorityScore: number;
  estimatedDurationMs: number;
  resourceClaims: string[];
}

export interface OperationDependencyEdge {
  fromOperationId: string;
  toOperationId: string;
  dependencyType: OperationDependencyType;
  strength: "hard" | "soft";
  description: string;
}

export type OperationDependencyType =
  | "must_complete_before"
  | "must_start_after"
  | "shares_resource"
  | "shares_approval_gate"
  | "requires_output_of"
  | "rollback_dependency"
  | "verification_dependency"
  | "governance_dependency";

// ═══════════════════════════════════════════════════════════════════════════════
// §9 — Recovery Strategy
// ═══════════════════════════════════════════════════════════════════════════════

export type RecoveryScenario =
  | "operation_crash"
  | "checkpoint_corruption"
  | "resource_claim_orphan"
  | "deadlock"
  | "cascade_failure"
  | "provider_outage"
  | "coordinator_restart"
  | "partial_apply_failure"
  | "approval_timeout"
  | "state_inconsistency";

export interface RecoveryPlaybook {
  scenario: RecoveryScenario;
  severity: "low" | "medium" | "high" | "critical";
  automaticRecovery: boolean;
  steps: RecoveryStep[];
  escalationTrigger: string;
  maxRecoveryAttempts: number;
  humanNotification: boolean;
}

export interface RecoveryStep {
  order: number;
  action: string;
  description: string;
  idempotent: boolean;
  estimatedDurationMs: number;
  failureAction: "retry" | "skip" | "abort" | "escalate";
}

export const RECOVERY_PLAYBOOKS: RecoveryPlaybook[] = [
  {
    scenario: "operation_crash",
    severity: "medium",
    automaticRecovery: true,
    steps: [
      { order: 1, action: "locate_checkpoint", description: "Find the most recent valid checkpoint for the crashed operation.", idempotent: true, estimatedDurationMs: 1000, failureAction: "abort" },
      { order: 2, action: "validate_checkpoint", description: "Verify checkpoint integrity hash and expiry.", idempotent: true, estimatedDurationMs: 2000, failureAction: "abort" },
      { order: 3, action: "release_orphaned_claims", description: "Release any resource claims held by the crashed operation.", idempotent: true, estimatedDurationMs: 1000, failureAction: "skip" },
      { order: 4, action: "resume_from_checkpoint", description: "Resume the operation from the checkpoint state.", idempotent: false, estimatedDurationMs: 5000, failureAction: "escalate" },
    ],
    escalationTrigger: "Checkpoint invalid or resume fails after 2 attempts",
    maxRecoveryAttempts: 2,
    humanNotification: false,
  },
  {
    scenario: "checkpoint_corruption",
    severity: "high",
    automaticRecovery: false,
    steps: [
      { order: 1, action: "mark_operation_failed", description: "Mark the operation as failed with corruption reason.", idempotent: true, estimatedDurationMs: 500, failureAction: "skip" },
      { order: 2, action: "release_all_claims", description: "Release all resource claims held by the operation.", idempotent: true, estimatedDurationMs: 1000, failureAction: "retry" },
      { order: 3, action: "assess_partial_state", description: "Determine what steps completed before corruption.", idempotent: true, estimatedDurationMs: 5000, failureAction: "escalate" },
      { order: 4, action: "notify_human", description: "Notify human with corruption details and partial state assessment.", idempotent: true, estimatedDurationMs: 500, failureAction: "skip" },
    ],
    escalationTrigger: "Immediate — checkpoint corruption always escalates",
    maxRecoveryAttempts: 1,
    humanNotification: true,
  },
  {
    scenario: "resource_claim_orphan",
    severity: "low",
    automaticRecovery: true,
    steps: [
      { order: 1, action: "identify_orphans", description: "Scan for resource claims whose owning operation no longer exists or is in a terminal state.", idempotent: true, estimatedDurationMs: 5000, failureAction: "retry" },
      { order: 2, action: "verify_no_active_use", description: "Confirm the claimed resources are not being actively modified.", idempotent: true, estimatedDurationMs: 2000, failureAction: "abort" },
      { order: 3, action: "release_orphans", description: "Release orphaned claims.", idempotent: true, estimatedDurationMs: 1000, failureAction: "retry" },
    ],
    escalationTrigger: "Orphan claims persist after 3 cleanup attempts",
    maxRecoveryAttempts: 3,
    humanNotification: false,
  },
  {
    scenario: "deadlock",
    severity: "high",
    automaticRecovery: true,
    steps: [
      { order: 1, action: "detect_cycle", description: "Build wait-for graph and identify the cycle.", idempotent: true, estimatedDurationMs: 2000, failureAction: "abort" },
      { order: 2, action: "select_victim", description: "Choose the lowest-priority operation in the cycle as the deadlock victim.", idempotent: true, estimatedDurationMs: 500, failureAction: "escalate" },
      { order: 3, action: "interrupt_victim", description: "Interrupt the victim operation and checkpoint its state.", idempotent: false, estimatedDurationMs: 5000, failureAction: "escalate" },
      { order: 4, action: "release_victim_claims", description: "Release the victim's resource claims to break the cycle.", idempotent: true, estimatedDurationMs: 1000, failureAction: "retry" },
      { order: 5, action: "requeue_victim", description: "Requeue the victim operation with a delay.", idempotent: false, estimatedDurationMs: 1000, failureAction: "skip" },
    ],
    escalationTrigger: "Deadlock persists after victim selection, or victim is critical priority",
    maxRecoveryAttempts: 2,
    humanNotification: true,
  },
  {
    scenario: "cascade_failure",
    severity: "critical",
    automaticRecovery: false,
    steps: [
      { order: 1, action: "halt_new_operations", description: "Stop dispatching new operations until cascade is contained.", idempotent: true, estimatedDurationMs: 500, failureAction: "skip" },
      { order: 2, action: "identify_cascade_root", description: "Trace the dependency graph to find the root failure.", idempotent: true, estimatedDurationMs: 5000, failureAction: "escalate" },
      { order: 3, action: "checkpoint_all_running", description: "Save checkpoints for all running operations.", idempotent: false, estimatedDurationMs: 10000, failureAction: "skip" },
      { order: 4, action: "pause_all_non_critical", description: "Pause all non-critical operations.", idempotent: true, estimatedDurationMs: 5000, failureAction: "skip" },
      { order: 5, action: "notify_human_critical", description: "Escalate to human with full cascade analysis.", idempotent: true, estimatedDurationMs: 500, failureAction: "skip" },
    ],
    escalationTrigger: "Immediate — cascade failures always escalate",
    maxRecoveryAttempts: 1,
    humanNotification: true,
  },
  {
    scenario: "provider_outage",
    severity: "high",
    automaticRecovery: true,
    steps: [
      { order: 1, action: "detect_provider_failure", description: "Confirm provider API is unavailable, not just rate-limited.", idempotent: true, estimatedDurationMs: 10000, failureAction: "retry" },
      { order: 2, action: "pause_provider_operations", description: "Pause all operations targeting the affected provider.", idempotent: true, estimatedDurationMs: 2000, failureAction: "skip" },
      { order: 3, action: "checkpoint_affected", description: "Save checkpoints for all paused operations.", idempotent: false, estimatedDurationMs: 5000, failureAction: "skip" },
      { order: 4, action: "start_health_polling", description: "Poll provider health endpoint at increasing intervals.", idempotent: true, estimatedDurationMs: 0, failureAction: "retry" },
      { order: 5, action: "resume_when_healthy", description: "Resume paused operations when provider health is confirmed.", idempotent: false, estimatedDurationMs: 10000, failureAction: "escalate" },
    ],
    escalationTrigger: "Provider outage exceeds 30 minutes",
    maxRecoveryAttempts: 5,
    humanNotification: true,
  },
  {
    scenario: "coordinator_restart",
    severity: "medium",
    automaticRecovery: true,
    steps: [
      { order: 1, action: "rebuild_operation_state", description: "Reconstruct active operation list from persistent storage.", idempotent: true, estimatedDurationMs: 5000, failureAction: "abort" },
      { order: 2, action: "validate_checkpoints", description: "Verify integrity of all active operation checkpoints.", idempotent: true, estimatedDurationMs: 10000, failureAction: "skip" },
      { order: 3, action: "rebuild_claim_table", description: "Reconstruct resource claim table from operation states.", idempotent: true, estimatedDurationMs: 5000, failureAction: "retry" },
      { order: 4, action: "rebuild_dependency_graph", description: "Reconstruct the operation dependency graph.", idempotent: true, estimatedDurationMs: 5000, failureAction: "retry" },
      { order: 5, action: "resume_operations", description: "Resume operations that were running before restart.", idempotent: false, estimatedDurationMs: 10000, failureAction: "escalate" },
    ],
    escalationTrigger: "State reconstruction fails or more than 50% of checkpoints are invalid",
    maxRecoveryAttempts: 1,
    humanNotification: false,
  },
  {
    scenario: "partial_apply_failure",
    severity: "high",
    automaticRecovery: true,
    steps: [
      { order: 1, action: "assess_applied_changes", description: "Determine which resources were modified and which were not.", idempotent: true, estimatedDurationMs: 5000, failureAction: "escalate" },
      { order: 2, action: "verify_applied_state", description: "Verify that applied resources are in expected state.", idempotent: true, estimatedDurationMs: 10000, failureAction: "escalate" },
      { order: 3, action: "decide_rollback_scope", description: "Determine if partial rollback is needed or if applied changes are safe.", idempotent: true, estimatedDurationMs: 2000, failureAction: "escalate" },
      { order: 4, action: "execute_targeted_rollback", description: "Roll back only the resources that are in an inconsistent state.", idempotent: false, estimatedDurationMs: 30000, failureAction: "escalate" },
      { order: 5, action: "verify_post_rollback", description: "Verify all resources are in a consistent state after rollback.", idempotent: true, estimatedDurationMs: 10000, failureAction: "escalate" },
    ],
    escalationTrigger: "Applied state verification fails or targeted rollback fails",
    maxRecoveryAttempts: 1,
    humanNotification: true,
  },
  {
    scenario: "approval_timeout",
    severity: "low",
    automaticRecovery: true,
    steps: [
      { order: 1, action: "check_approval_age", description: "Determine how long the operation has been waiting for approval.", idempotent: true, estimatedDurationMs: 500, failureAction: "skip" },
      { order: 2, action: "send_reminder", description: "Send a reminder notification to pending approvers.", idempotent: true, estimatedDurationMs: 1000, failureAction: "skip" },
      { order: 3, action: "escalate_if_stale", description: "If waiting > escalation threshold, notify next approver in chain.", idempotent: true, estimatedDurationMs: 1000, failureAction: "skip" },
      { order: 4, action: "expire_if_exceeded", description: "If waiting > TTL, cancel the operation and release resources.", idempotent: true, estimatedDurationMs: 2000, failureAction: "retry" },
    ],
    escalationTrigger: "Approval wait exceeds 2x the organization's median approval time",
    maxRecoveryAttempts: 3,
    humanNotification: true,
  },
  {
    scenario: "state_inconsistency",
    severity: "critical",
    automaticRecovery: false,
    steps: [
      { order: 1, action: "halt_affected_operations", description: "Immediately pause all operations that touch the inconsistent resources.", idempotent: true, estimatedDurationMs: 2000, failureAction: "skip" },
      { order: 2, action: "snapshot_current_state", description: "Capture current live infrastructure state from provider APIs.", idempotent: true, estimatedDurationMs: 30000, failureAction: "retry" },
      { order: 3, action: "compare_expected_vs_actual", description: "Diff expected state (from Terraform/checkpoint) against actual provider state.", idempotent: true, estimatedDurationMs: 10000, failureAction: "escalate" },
      { order: 4, action: "generate_reconciliation_plan", description: "Create a plan to reconcile state, prioritizing safety over completeness.", idempotent: true, estimatedDurationMs: 5000, failureAction: "escalate" },
      { order: 5, action: "escalate_for_human_decision", description: "Present reconciliation plan to human for approval before execution.", idempotent: true, estimatedDurationMs: 500, failureAction: "skip" },
    ],
    escalationTrigger: "Immediate — state inconsistency always requires human decision",
    maxRecoveryAttempts: 1,
    humanNotification: true,
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// §10 — Provider Coordination Model
// ═══════════════════════════════════════════════════════════════════════════════

export interface ProviderCoordinationProfile {
  provider: "aws" | "azure" | "gcp";
  coordinationCapability: "full" | "scan_coordination" | "planned";
  maxConcurrentApiCalls: number;
  rateLimitBufferPct: number;
  stateManagement: "terraform" | "api_direct" | "read_only";
  lockMechanism: "terraform_state_lock" | "dynamodb_lock" | "advisory_lock" | "none";
  healthCheckEndpoint: string;
  healthCheckIntervalMs: number;
}

export const PROVIDER_COORDINATION_PROFILES: ProviderCoordinationProfile[] = [
  {
    provider: "aws",
    coordinationCapability: "full",
    maxConcurrentApiCalls: 50,
    rateLimitBufferPct: 20,
    stateManagement: "terraform",
    lockMechanism: "dynamodb_lock",
    healthCheckEndpoint: "sts:GetCallerIdentity",
    healthCheckIntervalMs: 60000,
  },
  {
    provider: "azure",
    coordinationCapability: "scan_coordination",
    maxConcurrentApiCalls: 30,
    rateLimitBufferPct: 25,
    stateManagement: "read_only",
    lockMechanism: "none",
    healthCheckEndpoint: "Microsoft.Resources/subscriptions/read",
    healthCheckIntervalMs: 60000,
  },
  {
    provider: "gcp",
    coordinationCapability: "scan_coordination",
    maxConcurrentApiCalls: 30,
    rateLimitBufferPct: 25,
    stateManagement: "read_only",
    lockMechanism: "none",
    healthCheckEndpoint: "cloudresourcemanager.projects.get",
    healthCheckIntervalMs: 60000,
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// §11 — Coordination Audit Trail
// ═══════════════════════════════════════════════════════════════════════════════

export type CoordinationAuditAction =
  | "operation_queued"
  | "operation_started"
  | "operation_completed"
  | "operation_failed"
  | "operation_cancelled"
  | "operation_interrupted"
  | "operation_resumed"
  | "operation_checkpointed"
  | "resource_claimed"
  | "resource_released"
  | "conflict_detected"
  | "conflict_resolved"
  | "deadlock_detected"
  | "deadlock_broken"
  | "priority_preemption"
  | "rollback_coordinated"
  | "recovery_attempted"
  | "recovery_succeeded"
  | "recovery_failed"
  | "schedule_dispatched"
  | "schedule_skipped"
  | "approval_routed"
  | "freeze_enforced";

export interface CoordinationAuditEntry {
  id: string;
  timestamp: string;
  action: CoordinationAuditAction;
  operationId: string | null;
  operationType: CoordinatedOperationType | null;
  actor: "coordinator" | "scheduler" | "recovery" | "human" | "conflict_resolver";
  detail: string;
  relatedOperationIds: string[];
  relatedResourceIds: string[];
  correlationId: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// §12 — Query Functions
// ═══════════════════════════════════════════════════════════════════════════════

export function getOperationDefaultPriority(type: CoordinatedOperationType): OperationPriority {
  return OPERATION_DEFAULT_PRIORITIES[type];
}

export function getOperationIsolationDefault(type: CoordinatedOperationType): OperationIsolationLevel {
  return OPERATION_ISOLATION_DEFAULTS[type];
}

export function getConflictDetectionRule(id: string): ConflictDetectionRule | undefined {
  return CONFLICT_DETECTION_RULES.find((r) => r.id === id);
}

export function getAutoResolvableConflicts(): ConflictDetectionRule[] {
  return CONFLICT_DETECTION_RULES.filter((r) => r.autoResolve);
}

export function getRecoveryPlaybook(scenario: RecoveryScenario): RecoveryPlaybook | undefined {
  return RECOVERY_PLAYBOOKS.find((p) => p.scenario === scenario);
}

export function getAutomaticRecoveryPlaybooks(): RecoveryPlaybook[] {
  return RECOVERY_PLAYBOOKS.filter((p) => p.automaticRecovery);
}

export function getCriticalRecoveryPlaybooks(): RecoveryPlaybook[] {
  return RECOVERY_PLAYBOOKS.filter((p) => p.severity === "critical");
}

export function getProviderCoordinationProfile(provider: "aws" | "azure" | "gcp"): ProviderCoordinationProfile | undefined {
  return PROVIDER_COORDINATION_PROFILES.find((p) => p.provider === provider);
}

export function computeEffectivePriority(
  basePriority: OperationPriority,
  ageMs: number,
  isIncidentRelated: boolean,
  isGovernanceRelated: boolean,
  isHumanRequested: boolean,
): number {
  let score = PRIORITY_SCORES[basePriority];

  const starvationThreshold = 600000;
  if (ageMs > starvationThreshold) {
    const ageBoost = Math.min(20, Math.floor((ageMs - starvationThreshold) / 60000) * 2);
    score += ageBoost;
  }

  if (isIncidentRelated) score += 15;
  if (isGovernanceRelated) score += 10;
  if (isHumanRequested) score += 5;

  return Math.min(100, score);
}

export function getValidTransitions(currentState: OperationStateMachineState): OperationStateTransition[] {
  return OPERATION_STATE_TRANSITIONS.filter((t) => t.from === currentState);
}

export function canTransition(from: OperationStateMachineState, to: OperationStateMachineState): boolean {
  return OPERATION_STATE_TRANSITIONS.some((t) => t.from === from && t.to === to);
}

export function isTerminalState(state: OperationStateMachineState): boolean {
  return ["succeeded", "failed", "rolled_back", "cancelled", "timed_out", "deadlocked"].includes(state);
}

export function isActiveState(state: OperationStateMachineState): boolean {
  return ["running", "checkpointing", "completing"].includes(state);
}

export function isWaitingState(state: OperationStateMachineState): boolean {
  return ["queued", "waiting_for_resources", "waiting_for_approval", "waiting_for_dependency"].includes(state);
}

// ═══════════════════════════════════════════════════════════════════════════════
// §13 — Tests
// ═══════════════════════════════════════════════════════════════════════════════

export interface CoordinationTestResult {
  name: string;
  passed: boolean;
  detail: string;
}

export function runAutonomousCoordinationTests(): CoordinationTestResult[] {
  const results: CoordinationTestResult[] = [];

  function assert(name: string, condition: boolean, detail: string) {
    results.push({ name, passed: condition, detail });
  }

  // State machine
  assert(
    "State machine has transitions from all non-terminal states",
    ["queued", "waiting_for_resources", "waiting_for_approval", "waiting_for_dependency",
      "initializing", "running", "paused", "interrupted", "checkpointing", "resuming", "completing", "failed"]
      .every((s) => OPERATION_STATE_TRANSITIONS.some((t) => t.from === s)),
    "All non-terminal states have at least one outgoing transition",
  );

  assert(
    "Terminal states have no outgoing transitions except recovery",
    !OPERATION_STATE_TRANSITIONS.some((t) =>
      ["succeeded", "cancelled", "timed_out", "deadlocked"].includes(t.from),
    ),
    "Succeeded, cancelled, timed_out, deadlocked have no transitions",
  );

  assert(
    "Failed state can recover",
    OPERATION_STATE_TRANSITIONS.some((t) => t.from === "failed" && t.to === "resuming"),
    "Failed → resuming transition exists for recovery",
  );

  assert(
    "Running can reach all critical transitions",
    canTransition("running", "paused") &&
    canTransition("running", "interrupted") &&
    canTransition("running", "completing") &&
    canTransition("running", "failed") &&
    canTransition("running", "rolled_back") &&
    canTransition("running", "cancelled"),
    "Running state has paths to pause, interrupt, complete, fail, rollback, and cancel",
  );

  assert(
    "Interrupted operations can resume",
    canTransition("interrupted", "resuming") && canTransition("resuming", "running"),
    "Interrupted → resuming → running path exists",
  );

  // State classification
  assert(
    "isTerminalState identifies correct states",
    isTerminalState("succeeded") && isTerminalState("failed") && isTerminalState("cancelled") &&
    !isTerminalState("running") && !isTerminalState("paused"),
    "Terminal state classification is correct",
  );

  assert(
    "isActiveState identifies correct states",
    isActiveState("running") && isActiveState("checkpointing") &&
    !isActiveState("paused") && !isActiveState("queued"),
    "Active state classification is correct",
  );

  assert(
    "isWaitingState identifies correct states",
    isWaitingState("queued") && isWaitingState("waiting_for_resources") &&
    !isWaitingState("running") && !isWaitingState("succeeded"),
    "Waiting state classification is correct",
  );

  // Concurrency policy
  assert(
    "Default concurrency policy limits applies",
    DEFAULT_CONCURRENCY_POLICY.maxConcurrentApplies <= DEFAULT_CONCURRENCY_POLICY.maxConcurrentOperations,
    `Applies: ${DEFAULT_CONCURRENCY_POLICY.maxConcurrentApplies}, Total: ${DEFAULT_CONCURRENCY_POLICY.maxConcurrentOperations}`,
  );

  assert(
    "Apply limit is more restrictive than scan limit",
    DEFAULT_CONCURRENCY_POLICY.maxConcurrentApplies < DEFAULT_CONCURRENCY_POLICY.maxConcurrentScans,
    `Applies: ${DEFAULT_CONCURRENCY_POLICY.maxConcurrentApplies}, Scans: ${DEFAULT_CONCURRENCY_POLICY.maxConcurrentScans}`,
  );

  // Conflict detection
  assert(
    "Conflict detection rules cover all categories",
    CONFLICT_DETECTION_RULES.length >= 10,
    `Rules: ${CONFLICT_DETECTION_RULES.length}`,
  );

  assert(
    "Most conflicts are auto-resolvable",
    CONFLICT_DETECTION_RULES.filter((r) => r.autoResolve).length >= 8,
    `Auto-resolvable: ${CONFLICT_DETECTION_RULES.filter((r) => r.autoResolve).length}`,
  );

  assert(
    "Circular dependency requires human resolution",
    CONFLICT_DETECTION_RULES.find((r) => r.category === "circular_dependency")?.autoResolve === false,
    "Circular dependency is not auto-resolvable",
  );

  // Priority system
  assert(
    "Rollback has critical default priority",
    OPERATION_DEFAULT_PRIORITIES.rollback === "critical",
    `Rollback priority: ${OPERATION_DEFAULT_PRIORITIES.rollback}`,
  );

  assert(
    "All operation types have default priorities",
    Object.keys(OPERATION_DEFAULT_PRIORITIES).length === 14,
    `Priority entries: ${Object.keys(OPERATION_DEFAULT_PRIORITIES).length}`,
  );

  assert(
    "All operation types have isolation defaults",
    Object.keys(OPERATION_ISOLATION_DEFAULTS).length === 14,
    `Isolation entries: ${Object.keys(OPERATION_ISOLATION_DEFAULTS).length}`,
  );

  assert(
    "Apply operations require full isolation",
    OPERATION_ISOLATION_DEFAULTS.apply === "full",
    `Apply isolation: ${OPERATION_ISOLATION_DEFAULTS.apply}`,
  );

  assert(
    "Scan operations use shared read",
    OPERATION_ISOLATION_DEFAULTS.scan === "shared_read",
    `Scan isolation: ${OPERATION_ISOLATION_DEFAULTS.scan}`,
  );

  // Priority computation
  assert(
    "Base priority scores are ordered",
    PRIORITY_SCORES.critical > PRIORITY_SCORES.high &&
    PRIORITY_SCORES.high > PRIORITY_SCORES.standard &&
    PRIORITY_SCORES.standard > PRIORITY_SCORES.low &&
    PRIORITY_SCORES.low > PRIORITY_SCORES.background,
    "Priority scores decrease: critical > high > standard > low > background",
  );

  const basePriority = computeEffectivePriority("standard", 0, false, false, false);
  const agedPriority = computeEffectivePriority("standard", 1200000, false, false, false);
  assert(
    "Aging boosts effective priority",
    agedPriority > basePriority,
    `Base: ${basePriority}, Aged 20min: ${agedPriority}`,
  );

  const incidentPriority = computeEffectivePriority("standard", 0, true, false, false);
  assert(
    "Incident relation boosts priority",
    incidentPriority > basePriority,
    `Base: ${basePriority}, Incident: ${incidentPriority}`,
  );

  assert(
    "Priority never exceeds 100",
    computeEffectivePriority("critical", 9999999, true, true, true) <= 100,
    "Max boosted priority capped at 100",
  );

  // Recovery playbooks
  assert(
    "Recovery playbooks cover all scenarios",
    RECOVERY_PLAYBOOKS.length >= 10,
    `Playbooks: ${RECOVERY_PLAYBOOKS.length}`,
  );

  assert(
    "Critical scenarios always notify humans",
    RECOVERY_PLAYBOOKS.filter((p) => p.severity === "critical").every((p) => p.humanNotification),
    "All critical recoveries notify humans",
  );

  assert(
    "All recovery steps are ordered",
    RECOVERY_PLAYBOOKS.every((p) => p.steps.every((s, i) => s.order === i + 1)),
    "All recovery playbook steps are sequentially ordered",
  );

  assert(
    "Cascade failure halts new operations first",
    RECOVERY_PLAYBOOKS.find((p) => p.scenario === "cascade_failure")?.steps[0].action === "halt_new_operations",
    "Cascade failure recovery starts by halting dispatch",
  );

  // Provider coordination
  assert(
    "AWS has full coordination capability",
    PROVIDER_COORDINATION_PROFILES.find((p) => p.provider === "aws")?.coordinationCapability === "full",
    "AWS coordination: full",
  );

  assert(
    "Azure and GCP are scan-coordination only",
    PROVIDER_COORDINATION_PROFILES.filter((p) => p.provider !== "aws").every((p) => p.coordinationCapability === "scan_coordination"),
    "Non-AWS providers: scan_coordination",
  );

  assert(
    "All providers have health check endpoints",
    PROVIDER_COORDINATION_PROFILES.every((p) => p.healthCheckEndpoint.length > 0),
    "All providers define health check endpoints",
  );

  return results;
}
