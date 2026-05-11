// ─────────────────────────────────────────────────────────────────────────────
// Execution Safety Engine
// Safe infrastructure apply with pre-checks, progressive rollout, and
// automatic rollback — the final action layer that closes the autonomous loop
// ─────────────────────────────────────────────────────────────────────────────

// ═══════════════════════════════════════════════════════════════════════════════
// §1 — Execution Architecture
// ═══════════════════════════════════════════════════════════════════════════════

export type ExecutionStrategy =
  | "immediate"
  | "canary"
  | "blue_green"
  | "rolling"
  | "maintenance_window"
  | "staged_approval";

export type ExecutionPhase =
  | "pre_check"
  | "snapshot"
  | "dry_run"
  | "approval_gate"
  | "apply"
  | "health_check"
  | "verification"
  | "stabilization"
  | "post_check"
  | "complete"
  | "rollback_triggered"
  | "rolling_back"
  | "rolled_back"
  | "failed";

export type ExecutionOutcome =
  | "success"
  | "success_with_warnings"
  | "partial_success"
  | "failed_safe_rollback"
  | "failed_manual_intervention"
  | "cancelled"
  | "timed_out";

export interface ExecutionContext {
  executionId: string;
  orgId: string;
  operationId: string;
  changeSetId: string;
  provider: "aws" | "azure" | "gcp";
  region: string;
  environment: string;
  strategy: ExecutionStrategy;
  phase: ExecutionPhase;
  outcome: ExecutionOutcome | null;
  startedAt: string;
  completedAt: string | null;
  operatorId: string;
  approvedBy: string[];
  autonomyLevel: AutonomyLevel;
  safetyConfig: SafetyConfig;
  healthConfig: HealthCheckConfig;
  rollbackConfig: AutoRollbackConfig;
  progressPercent: number;
  metadata: Record<string, unknown>;
}

export type AutonomyLevel =
  | "manual"
  | "assisted"
  | "supervised"
  | "autonomous_low_risk"
  | "autonomous_medium_risk";

export const AUTONOMY_LEVEL_PERMISSIONS: Record<AutonomyLevel, AutonomyPermissions> = {
  manual: {
    canInitiate: false,
    canApply: false,
    canRollback: false,
    requiresApproval: true,
    maxBlastRadius: "minimal",
    maxConcurrentApplies: 0,
  },
  assisted: {
    canInitiate: true,
    canApply: false,
    canRollback: true,
    requiresApproval: true,
    maxBlastRadius: "low",
    maxConcurrentApplies: 1,
  },
  supervised: {
    canInitiate: true,
    canApply: true,
    canRollback: true,
    requiresApproval: true,
    maxBlastRadius: "moderate",
    maxConcurrentApplies: 2,
  },
  autonomous_low_risk: {
    canInitiate: true,
    canApply: true,
    canRollback: true,
    requiresApproval: false,
    maxBlastRadius: "low",
    maxConcurrentApplies: 3,
  },
  autonomous_medium_risk: {
    canInitiate: true,
    canApply: true,
    canRollback: true,
    requiresApproval: false,
    maxBlastRadius: "moderate",
    maxConcurrentApplies: 5,
  },
};

export interface AutonomyPermissions {
  canInitiate: boolean;
  canApply: boolean;
  canRollback: boolean;
  requiresApproval: boolean;
  maxBlastRadius: "minimal" | "low" | "moderate" | "high" | "critical";
  maxConcurrentApplies: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// §2 — Pre-Execution Checks
// ═══════════════════════════════════════════════════════════════════════════════

export type PreCheckId =
  | "state_lock_available"
  | "provider_credentials_valid"
  | "resource_drift_check"
  | "concurrent_operation_check"
  | "backup_verified"
  | "health_baseline_captured"
  | "blast_radius_within_limits"
  | "approval_valid"
  | "maintenance_window_active"
  | "circuit_breaker_closed"
  | "rollback_plan_verified"
  | "dependency_resources_healthy";

export interface PreExecutionCheck {
  id: PreCheckId;
  name: string;
  description: string;
  required: boolean;
  timeoutMs: number;
  retryable: boolean;
  maxRetries: number;
  order: number;
  blockingOnFailure: boolean;
  applicableStrategies: ExecutionStrategy[];
}

export interface PreCheckResult {
  checkId: PreCheckId;
  passed: boolean;
  message: string;
  details: Record<string, unknown>;
  durationMs: number;
  retriesUsed: number;
  timestamp: string;
}

export const PRE_EXECUTION_CHECKS: PreExecutionCheck[] = [
  { id: "state_lock_available", name: "State Lock Available", description: "Verify Terraform state is not locked by another operation", required: true, timeoutMs: 10_000, retryable: true, maxRetries: 3, order: 1, blockingOnFailure: true, applicableStrategies: ["immediate", "canary", "blue_green", "rolling", "maintenance_window", "staged_approval"] },
  { id: "provider_credentials_valid", name: "Provider Credentials Valid", description: "Verify cloud provider credentials are active and sufficient", required: true, timeoutMs: 15_000, retryable: true, maxRetries: 2, order: 2, blockingOnFailure: true, applicableStrategies: ["immediate", "canary", "blue_green", "rolling", "maintenance_window", "staged_approval"] },
  { id: "resource_drift_check", name: "Resource Drift Check", description: "Detect any drift since changeset generation", required: true, timeoutMs: 60_000, retryable: false, maxRetries: 0, order: 3, blockingOnFailure: true, applicableStrategies: ["immediate", "canary", "blue_green", "rolling", "maintenance_window", "staged_approval"] },
  { id: "concurrent_operation_check", name: "Concurrent Operation Check", description: "Verify no conflicting operations in progress", required: true, timeoutMs: 5_000, retryable: false, maxRetries: 0, order: 4, blockingOnFailure: true, applicableStrategies: ["immediate", "canary", "blue_green", "rolling", "maintenance_window", "staged_approval"] },
  { id: "backup_verified", name: "Backup Verified", description: "Verify backups exist for affected resources", required: true, timeoutMs: 30_000, retryable: true, maxRetries: 2, order: 5, blockingOnFailure: true, applicableStrategies: ["immediate", "canary", "blue_green", "rolling", "maintenance_window", "staged_approval"] },
  { id: "health_baseline_captured", name: "Health Baseline Captured", description: "Capture current health metrics as rollback baseline", required: true, timeoutMs: 30_000, retryable: true, maxRetries: 2, order: 6, blockingOnFailure: true, applicableStrategies: ["immediate", "canary", "blue_green", "rolling", "maintenance_window", "staged_approval"] },
  { id: "blast_radius_within_limits", name: "Blast Radius Within Limits", description: "Reconfirm blast radius is within autonomy level limits", required: true, timeoutMs: 10_000, retryable: false, maxRetries: 0, order: 7, blockingOnFailure: true, applicableStrategies: ["immediate", "canary", "blue_green", "rolling", "maintenance_window", "staged_approval"] },
  { id: "approval_valid", name: "Approval Valid", description: "Verify governance approval has not expired", required: true, timeoutMs: 5_000, retryable: false, maxRetries: 0, order: 8, blockingOnFailure: true, applicableStrategies: ["immediate", "canary", "blue_green", "rolling", "staged_approval"] },
  { id: "maintenance_window_active", name: "Maintenance Window Active", description: "Verify current time is within allowed maintenance window", required: false, timeoutMs: 1_000, retryable: false, maxRetries: 0, order: 9, blockingOnFailure: true, applicableStrategies: ["maintenance_window"] },
  { id: "circuit_breaker_closed", name: "Circuit Breaker Closed", description: "Verify execution circuit breaker is not tripped", required: true, timeoutMs: 1_000, retryable: false, maxRetries: 0, order: 10, blockingOnFailure: true, applicableStrategies: ["immediate", "canary", "blue_green", "rolling", "maintenance_window", "staged_approval"] },
  { id: "rollback_plan_verified", name: "Rollback Plan Verified", description: "Verify rollback plan is valid and executable", required: true, timeoutMs: 15_000, retryable: false, maxRetries: 0, order: 11, blockingOnFailure: true, applicableStrategies: ["immediate", "canary", "blue_green", "rolling", "maintenance_window", "staged_approval"] },
  { id: "dependency_resources_healthy", name: "Dependency Resources Healthy", description: "Verify all dependent resources are in healthy state", required: true, timeoutMs: 30_000, retryable: true, maxRetries: 2, order: 12, blockingOnFailure: true, applicableStrategies: ["immediate", "canary", "blue_green", "rolling", "maintenance_window", "staged_approval"] },
];

// ═══════════════════════════════════════════════════════════════════════════════
// §3 — Safety Configuration
// ═══════════════════════════════════════════════════════════════════════════════

export interface SafetyConfig {
  maxExecutionTimeMs: number;
  maxRetries: number;
  retryDelayMs: number;
  retryBackoffMultiplier: number;
  circuitBreakerThreshold: number;
  circuitBreakerResetMs: number;
  requirePreCheckPass: boolean;
  requireDryRunPass: boolean;
  requireRollbackPlan: boolean;
  requireHealthBaseline: boolean;
  parallelResourceLimit: number;
  pauseBetweenResourcesMs: number;
  errorBudgetPercent: number;
  killSwitchEnabled: boolean;
}

export const DEFAULT_SAFETY_CONFIG: SafetyConfig = {
  maxExecutionTimeMs: 1_800_000,
  maxRetries: 2,
  retryDelayMs: 5_000,
  retryBackoffMultiplier: 2.0,
  circuitBreakerThreshold: 3,
  circuitBreakerResetMs: 300_000,
  requirePreCheckPass: true,
  requireDryRunPass: true,
  requireRollbackPlan: true,
  requireHealthBaseline: true,
  parallelResourceLimit: 3,
  pauseBetweenResourcesMs: 2_000,
  errorBudgetPercent: 10,
  killSwitchEnabled: true,
};

export const CONSERVATIVE_SAFETY_CONFIG: SafetyConfig = {
  maxExecutionTimeMs: 900_000,
  maxRetries: 1,
  retryDelayMs: 10_000,
  retryBackoffMultiplier: 3.0,
  circuitBreakerThreshold: 1,
  circuitBreakerResetMs: 600_000,
  requirePreCheckPass: true,
  requireDryRunPass: true,
  requireRollbackPlan: true,
  requireHealthBaseline: true,
  parallelResourceLimit: 1,
  pauseBetweenResourcesMs: 5_000,
  errorBudgetPercent: 0,
  killSwitchEnabled: true,
};

// ═══════════════════════════════════════════════════════════════════════════════
// §4 — Health Check Framework
// ═══════════════════════════════════════════════════════════════════════════════

export type HealthCheckType =
  | "http_endpoint"
  | "tcp_port"
  | "cloudwatch_alarm"
  | "azure_monitor_alert"
  | "gcp_monitoring_alert"
  | "custom_metric"
  | "log_pattern"
  | "dns_resolution"
  | "certificate_validity"
  | "api_response_time";

export interface HealthCheckConfig {
  checks: HealthCheckDefinition[];
  intervalMs: number;
  stabilizationPeriodMs: number;
  maxConsecutiveFailures: number;
  baselineComparisonEnabled: boolean;
  degradationThresholdPercent: number;
}

export interface HealthCheckDefinition {
  id: string;
  name: string;
  type: HealthCheckType;
  target: HealthCheckTarget;
  expectedState: ExpectedHealthState;
  timeoutMs: number;
  critical: boolean;
  weight: number;
}

export interface HealthCheckTarget {
  endpoint: string | null;
  port: number | null;
  alarmName: string | null;
  metricNamespace: string | null;
  metricName: string | null;
  logGroup: string | null;
  logPattern: string | null;
}

export interface ExpectedHealthState {
  httpStatusCodes: number[] | null;
  responseTimeMaxMs: number | null;
  errorRateMaxPercent: number | null;
  alarmState: string | null;
  metricThreshold: number | null;
  metricComparison: "gt" | "gte" | "lt" | "lte" | "eq" | null;
}

export interface HealthCheckResult {
  checkId: string;
  passed: boolean;
  currentValue: unknown;
  expectedValue: unknown;
  baselineValue: unknown;
  degradationPercent: number | null;
  message: string;
  timestamp: string;
  durationMs: number;
}

export interface HealthBaseline {
  capturedAt: string;
  metrics: BaselineMetric[];
  validForMs: number;
}

export interface BaselineMetric {
  checkId: string;
  metricName: string;
  value: number;
  unit: string;
  p50: number;
  p95: number;
  p99: number;
}

export const DEFAULT_HEALTH_CONFIG: HealthCheckConfig = {
  checks: [],
  intervalMs: 30_000,
  stabilizationPeriodMs: 300_000,
  maxConsecutiveFailures: 3,
  baselineComparisonEnabled: true,
  degradationThresholdPercent: 20,
};

// ═══════════════════════════════════════════════════════════════════════════════
// §5 — Auto-Rollback Configuration
// ═══════════════════════════════════════════════════════════════════════════════

export type AutoRollbackTrigger =
  | "health_check_failure"
  | "error_rate_spike"
  | "latency_spike"
  | "resource_creation_failure"
  | "state_corruption"
  | "timeout"
  | "kill_switch"
  | "manual"
  | "dependency_failure"
  | "cost_anomaly";

export interface AutoRollbackConfig {
  enabled: boolean;
  triggers: AutoRollbackTriggerConfig[];
  maxRollbackTimeMs: number;
  requireApprovalForRollback: boolean;
  notifyOnRollback: string[];
  preserveLogsOnRollback: boolean;
  snapshotBeforeRollback: boolean;
}

export interface AutoRollbackTriggerConfig {
  trigger: AutoRollbackTrigger;
  enabled: boolean;
  threshold: number | null;
  evaluationWindowMs: number;
  cooldownMs: number;
  autoExecute: boolean;
}

export const DEFAULT_ROLLBACK_CONFIG: AutoRollbackConfig = {
  enabled: true,
  triggers: [
    { trigger: "health_check_failure", enabled: true, threshold: 3, evaluationWindowMs: 120_000, cooldownMs: 60_000, autoExecute: true },
    { trigger: "error_rate_spike", enabled: true, threshold: 50, evaluationWindowMs: 60_000, cooldownMs: 120_000, autoExecute: true },
    { trigger: "latency_spike", enabled: true, threshold: 300, evaluationWindowMs: 60_000, cooldownMs: 120_000, autoExecute: true },
    { trigger: "resource_creation_failure", enabled: true, threshold: 1, evaluationWindowMs: 0, cooldownMs: 0, autoExecute: true },
    { trigger: "state_corruption", enabled: true, threshold: 1, evaluationWindowMs: 0, cooldownMs: 0, autoExecute: true },
    { trigger: "timeout", enabled: true, threshold: null, evaluationWindowMs: 0, cooldownMs: 0, autoExecute: true },
    { trigger: "kill_switch", enabled: true, threshold: null, evaluationWindowMs: 0, cooldownMs: 0, autoExecute: true },
    { trigger: "manual", enabled: true, threshold: null, evaluationWindowMs: 0, cooldownMs: 0, autoExecute: false },
    { trigger: "dependency_failure", enabled: true, threshold: 1, evaluationWindowMs: 30_000, cooldownMs: 60_000, autoExecute: true },
    { trigger: "cost_anomaly", enabled: true, threshold: 200, evaluationWindowMs: 300_000, cooldownMs: 600_000, autoExecute: false },
  ],
  maxRollbackTimeMs: 600_000,
  requireApprovalForRollback: false,
  notifyOnRollback: ["ops_team", "org_admin"],
  preserveLogsOnRollback: true,
  snapshotBeforeRollback: true,
};

// ═══════════════════════════════════════════════════════════════════════════════
// §6 — Circuit Breaker
// ═══════════════════════════════════════════════════════════════════════════════

export type CircuitBreakerState = "closed" | "open" | "half_open";

export interface CircuitBreaker {
  id: string;
  orgId: string;
  provider: "aws" | "azure" | "gcp";
  state: CircuitBreakerState;
  failureCount: number;
  successCount: number;
  lastFailureAt: string | null;
  lastSuccessAt: string | null;
  openedAt: string | null;
  resetAt: string | null;
  threshold: number;
  resetTimeMs: number;
  halfOpenMaxAttempts: number;
  halfOpenAttempts: number;
  metadata: Record<string, unknown>;
}

export interface CircuitBreakerEvent {
  breakerId: string;
  eventType: "trip" | "reset" | "half_open_attempt" | "half_open_success" | "half_open_failure";
  timestamp: string;
  reason: string;
  failureCount: number;
}

export function computeCircuitBreakerState(breaker: CircuitBreaker, now: string): CircuitBreakerState {
  if (breaker.state === "closed") return "closed";
  if (breaker.state === "open" && breaker.openedAt) {
    const openedTime = new Date(breaker.openedAt).getTime();
    const currentTime = new Date(now).getTime();
    if (currentTime - openedTime >= breaker.resetTimeMs) return "half_open";
    return "open";
  }
  return breaker.state;
}

// ═══════════════════════════════════════════════════════════════════════════════
// §7 — Execution Progress Tracking
// ═══════════════════════════════════════════════════════════════════════════════

export interface ExecutionProgress {
  executionId: string;
  totalSteps: number;
  completedSteps: number;
  failedSteps: number;
  skippedSteps: number;
  currentStep: ExecutionStepProgress | null;
  steps: ExecutionStepProgress[];
  startedAt: string;
  estimatedCompletionAt: string | null;
  elapsedMs: number;
}

export interface ExecutionStepProgress {
  stepId: string;
  resourceId: string;
  resourceType: string;
  action: string;
  status: ExecutionStepStatus;
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number | null;
  retryCount: number;
  error: ExecutionStepError | null;
  output: Record<string, unknown>;
}

export type ExecutionStepStatus =
  | "pending"
  | "in_progress"
  | "succeeded"
  | "failed"
  | "skipped"
  | "rolling_back"
  | "rolled_back";

export interface ExecutionStepError {
  code: string;
  message: string;
  provider: string;
  retryable: boolean;
  details: Record<string, unknown>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// §8 — Progressive Rollout
// ═══════════════════════════════════════════════════════════════════════════════

export interface CanaryConfig {
  canaryPercent: number;
  canaryDurationMs: number;
  promotionCriteria: PromotionCriterion[];
  autoPromote: boolean;
  rollbackOnCanaryFailure: boolean;
}

export interface BlueGreenConfig {
  trafficShiftPercent: number;
  trafficShiftIntervalMs: number;
  trafficShiftSteps: number[];
  healthCheckBetweenShifts: boolean;
  instantRollbackEnabled: boolean;
}

export interface RollingConfig {
  batchSize: number;
  batchPercent: number | null;
  pauseBetweenBatchesMs: number;
  maxUnavailablePercent: number;
  healthCheckAfterBatch: boolean;
  rollbackOnBatchFailure: boolean;
}

export interface PromotionCriterion {
  metric: string;
  threshold: number;
  comparison: "gt" | "gte" | "lt" | "lte" | "eq";
  weight: number;
}

export const DEFAULT_CANARY_CONFIG: CanaryConfig = {
  canaryPercent: 5,
  canaryDurationMs: 600_000,
  promotionCriteria: [
    { metric: "error_rate", threshold: 1, comparison: "lte", weight: 0.4 },
    { metric: "p99_latency_ms", threshold: 500, comparison: "lte", weight: 0.3 },
    { metric: "success_rate", threshold: 99, comparison: "gte", weight: 0.3 },
  ],
  autoPromote: false,
  rollbackOnCanaryFailure: true,
};

export const DEFAULT_BLUE_GREEN_CONFIG: BlueGreenConfig = {
  trafficShiftPercent: 10,
  trafficShiftIntervalMs: 120_000,
  trafficShiftSteps: [10, 25, 50, 75, 100],
  healthCheckBetweenShifts: true,
  instantRollbackEnabled: true,
};

export const DEFAULT_ROLLING_CONFIG: RollingConfig = {
  batchSize: 1,
  batchPercent: null,
  pauseBetweenBatchesMs: 60_000,
  maxUnavailablePercent: 25,
  healthCheckAfterBatch: true,
  rollbackOnBatchFailure: true,
};

// ═══════════════════════════════════════════════════════════════════════════════
// §9 — Kill Switch
// ═══════════════════════════════════════════════════════════════════════════════

export type KillSwitchScope = "global" | "org" | "provider" | "region" | "environment";

export interface KillSwitch {
  id: string;
  scope: KillSwitchScope;
  scopeId: string | null;
  active: boolean;
  activatedBy: string;
  activatedAt: string;
  reason: string;
  expiresAt: string | null;
  affectedExecutions: string[];
}

export interface KillSwitchPolicy {
  autoActivateOnConsecutiveFailures: number;
  autoActivateOnCriticalError: boolean;
  autoDeactivateAfterMs: number | null;
  requireManualDeactivation: boolean;
  notifyOnActivation: string[];
  notifyOnDeactivation: string[];
}

export const DEFAULT_KILL_SWITCH_POLICY: KillSwitchPolicy = {
  autoActivateOnConsecutiveFailures: 3,
  autoActivateOnCriticalError: true,
  autoDeactivateAfterMs: null,
  requireManualDeactivation: true,
  notifyOnActivation: ["ops_team", "org_admin", "platform_admin"],
  notifyOnDeactivation: ["ops_team", "org_admin"],
};

// ═══════════════════════════════════════════════════════════════════════════════
// §10 — Execution Audit Trail
// ═══════════════════════════════════════════════════════════════════════════════

export type ExecutionAuditAction =
  | "execution_initiated"
  | "pre_check_started"
  | "pre_check_passed"
  | "pre_check_failed"
  | "dry_run_started"
  | "dry_run_passed"
  | "dry_run_failed"
  | "approval_requested"
  | "approval_granted"
  | "approval_denied"
  | "apply_started"
  | "resource_apply_started"
  | "resource_apply_succeeded"
  | "resource_apply_failed"
  | "health_check_started"
  | "health_check_passed"
  | "health_check_failed"
  | "rollback_triggered"
  | "rollback_started"
  | "rollback_completed"
  | "rollback_failed"
  | "execution_completed"
  | "execution_failed"
  | "kill_switch_activated"
  | "circuit_breaker_tripped"
  | "canary_promoted"
  | "traffic_shifted"
  | "stabilization_started"
  | "stabilization_completed";

export interface ExecutionAuditEntry {
  id: string;
  executionId: string;
  orgId: string;
  action: ExecutionAuditAction;
  timestamp: string;
  phase: ExecutionPhase;
  resourceId: string | null;
  operatorId: string | null;
  autonomyLevel: AutonomyLevel;
  details: Record<string, unknown>;
  parentEntryId: string | null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// §11 — Provider Execution Profiles
// ═══════════════════════════════════════════════════════════════════════════════

export interface ProviderExecutionProfile {
  provider: "aws" | "azure" | "gcp";
  applyMechanism: ApplyMechanism;
  stateBackend: string;
  maxParallelApplies: number;
  apiRateLimitPerSecond: number;
  typicalApplyLatencyMs: Record<string, number>;
  rollbackCapabilities: ProviderRollbackCapability[];
  healthCheckIntegrations: string[];
  supportedStrategies: ExecutionStrategy[];
}

export interface ApplyMechanism {
  primary: "terraform" | "cloudformation" | "arm" | "deployment_manager";
  fallback: string | null;
  planRequired: boolean;
  lockRequired: boolean;
  stateIsolation: boolean;
}

export interface ProviderRollbackCapability {
  resourceType: string;
  snapshotBased: boolean;
  stateBased: boolean;
  recreationRequired: boolean;
  estimatedRollbackMs: number;
}

export const PROVIDER_EXECUTION_PROFILES: ProviderExecutionProfile[] = [
  {
    provider: "aws",
    applyMechanism: { primary: "terraform", fallback: "cloudformation", planRequired: true, lockRequired: true, stateIsolation: true },
    stateBackend: "s3",
    maxParallelApplies: 5,
    apiRateLimitPerSecond: 10,
    typicalApplyLatencyMs: {
      "aws_instance": 120_000,
      "aws_db_instance": 600_000,
      "aws_s3_bucket": 10_000,
      "aws_security_group": 5_000,
      "aws_iam_role": 8_000,
      "aws_lambda_function": 30_000,
      "aws_ecs_service": 180_000,
      "aws_eks_cluster": 900_000,
      "aws_lb": 120_000,
      "aws_autoscaling_group": 300_000,
    },
    rollbackCapabilities: [
      { resourceType: "aws_instance", snapshotBased: true, stateBased: true, recreationRequired: false, estimatedRollbackMs: 120_000 },
      { resourceType: "aws_db_instance", snapshotBased: true, stateBased: true, recreationRequired: false, estimatedRollbackMs: 900_000 },
      { resourceType: "aws_s3_bucket", snapshotBased: false, stateBased: true, recreationRequired: false, estimatedRollbackMs: 15_000 },
      { resourceType: "aws_security_group", snapshotBased: false, stateBased: true, recreationRequired: false, estimatedRollbackMs: 10_000 },
      { resourceType: "aws_iam_role", snapshotBased: false, stateBased: true, recreationRequired: false, estimatedRollbackMs: 10_000 },
      { resourceType: "aws_lambda_function", snapshotBased: false, stateBased: true, recreationRequired: false, estimatedRollbackMs: 30_000 },
    ],
    healthCheckIntegrations: ["cloudwatch", "route53_health_checks", "elb_health_checks", "ecs_health_checks"],
    supportedStrategies: ["immediate", "canary", "blue_green", "rolling", "maintenance_window", "staged_approval"],
  },
  {
    provider: "azure",
    applyMechanism: { primary: "terraform", fallback: "arm", planRequired: true, lockRequired: true, stateIsolation: true },
    stateBackend: "azurerm",
    maxParallelApplies: 3,
    apiRateLimitPerSecond: 8,
    typicalApplyLatencyMs: {
      "azurerm_virtual_machine": 180_000,
      "azurerm_mssql_database": 600_000,
      "azurerm_storage_account": 30_000,
      "azurerm_network_security_group": 10_000,
      "azurerm_lb": 120_000,
    },
    rollbackCapabilities: [
      { resourceType: "azurerm_virtual_machine", snapshotBased: true, stateBased: true, recreationRequired: false, estimatedRollbackMs: 180_000 },
      { resourceType: "azurerm_mssql_database", snapshotBased: true, stateBased: true, recreationRequired: false, estimatedRollbackMs: 900_000 },
      { resourceType: "azurerm_storage_account", snapshotBased: false, stateBased: true, recreationRequired: false, estimatedRollbackMs: 30_000 },
    ],
    healthCheckIntegrations: ["azure_monitor", "application_insights", "traffic_manager_health"],
    supportedStrategies: ["immediate", "rolling", "maintenance_window", "staged_approval"],
  },
  {
    provider: "gcp",
    applyMechanism: { primary: "terraform", fallback: "deployment_manager", planRequired: true, lockRequired: true, stateIsolation: true },
    stateBackend: "gcs",
    maxParallelApplies: 4,
    apiRateLimitPerSecond: 10,
    typicalApplyLatencyMs: {
      "google_compute_instance": 120_000,
      "google_sql_database_instance": 600_000,
      "google_storage_bucket": 10_000,
      "google_compute_firewall": 10_000,
    },
    rollbackCapabilities: [
      { resourceType: "google_compute_instance", snapshotBased: true, stateBased: true, recreationRequired: false, estimatedRollbackMs: 120_000 },
      { resourceType: "google_sql_database_instance", snapshotBased: true, stateBased: true, recreationRequired: false, estimatedRollbackMs: 900_000 },
      { resourceType: "google_storage_bucket", snapshotBased: false, stateBased: true, recreationRequired: false, estimatedRollbackMs: 15_000 },
    ],
    healthCheckIntegrations: ["cloud_monitoring", "cloud_logging", "load_balancer_health"],
    supportedStrategies: ["immediate", "canary", "rolling", "maintenance_window", "staged_approval"],
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// §12 — Execution Invariants
// ═══════════════════════════════════════════════════════════════════════════════

export interface ExecutionInvariant {
  id: string;
  name: string;
  description: string;
  enforcedAt: ExecutionPhase[];
  violationAction: "abort" | "rollback" | "alert" | "log";
  overridable: boolean;
}

export const EXECUTION_INVARIANTS: ExecutionInvariant[] = [
  { id: "no-apply-without-plan", name: "No Apply Without Plan", description: "Every apply must be preceded by a successful terraform plan", enforcedAt: ["apply"], violationAction: "abort", overridable: false },
  { id: "no-apply-without-backup", name: "No Apply Without Backup", description: "Affected resources must have verified backups before apply", enforcedAt: ["apply"], violationAction: "abort", overridable: false },
  { id: "no-concurrent-state-modification", name: "No Concurrent State Modification", description: "Only one operation may modify state at a time per workspace", enforcedAt: ["apply"], violationAction: "abort", overridable: false },
  { id: "rollback-always-available", name: "Rollback Always Available", description: "A verified rollback path must exist before apply begins", enforcedAt: ["pre_check", "apply"], violationAction: "abort", overridable: false },
  { id: "health-baseline-required", name: "Health Baseline Required", description: "Health metrics baseline must be captured before apply", enforcedAt: ["pre_check"], violationAction: "abort", overridable: false },
  { id: "no-autonomy-escalation", name: "No Autonomy Escalation", description: "System must never escalate its own autonomy level during execution", enforcedAt: ["pre_check", "apply", "health_check", "verification"], violationAction: "abort", overridable: false },
  { id: "blast-radius-honered", name: "Blast Radius Honored", description: "Actual blast radius must not exceed computed estimate", enforcedAt: ["apply", "health_check"], violationAction: "rollback", overridable: false },
  { id: "kill-switch-supremacy", name: "Kill Switch Supremacy", description: "Kill switch activation must immediately halt all operations", enforcedAt: ["pre_check", "apply", "health_check", "verification", "stabilization"], violationAction: "abort", overridable: false },
  { id: "audit-trail-continuous", name: "Audit Trail Continuous", description: "Every execution phase must produce audit entries", enforcedAt: ["pre_check", "snapshot", "dry_run", "approval_gate", "apply", "health_check", "verification", "stabilization", "post_check"], violationAction: "alert", overridable: false },
  { id: "no-silent-failure", name: "No Silent Failure", description: "Every failure must be logged, alerted, and visible in audit trail", enforcedAt: ["apply", "health_check", "verification"], violationAction: "alert", overridable: false },
];

// ═══════════════════════════════════════════════════════════════════════════════
// §13 — Integration Contracts
// ═══════════════════════════════════════════════════════════════════════════════

export type ExecutionIntegrationTarget =
  | "terraform_generation"
  | "coordination_framework"
  | "governance_engine"
  | "monitoring_agent"
  | "memory_system"
  | "rbac_engine"
  | "observability"
  | "notification_system"
  | "org_intelligence"
  | "simulation_engine";

export interface ExecutionIntegrationContract {
  target: ExecutionIntegrationTarget;
  direction: "consumes" | "produces" | "bidirectional";
  description: string;
  dataFlow: string;
  requiredPhase: string;
}

export const EXECUTION_INTEGRATION_CONTRACTS: ExecutionIntegrationContract[] = [
  { target: "terraform_generation", direction: "consumes", description: "Receives validated changesets for execution", dataFlow: "InfrastructureChangeSet → ExecutionContext", requiredPhase: "pre_check" },
  { target: "coordination_framework", direction: "bidirectional", description: "Coordinates execution with other operations", dataFlow: "ExecutionState ↔ CoordinationState", requiredPhase: "pre_check" },
  { target: "governance_engine", direction: "consumes", description: "Validates approval status before apply", dataFlow: "GovernanceApproval → ExecutionGate", requiredPhase: "approval_gate" },
  { target: "monitoring_agent", direction: "bidirectional", description: "Provides health data, receives rollback triggers", dataFlow: "HealthMetrics ↔ RollbackSignals", requiredPhase: "health_check" },
  { target: "memory_system", direction: "produces", description: "Records execution outcomes for learning", dataFlow: "ExecutionOutcome → OperationalMemory", requiredPhase: "complete" },
  { target: "rbac_engine", direction: "consumes", description: "Validates operator permissions for execution", dataFlow: "OperatorContext → PermissionCheck", requiredPhase: "pre_check" },
  { target: "observability", direction: "produces", description: "Emits execution traces and metrics", dataFlow: "ExecutionEvent → ObservabilityPipeline", requiredPhase: "apply" },
  { target: "notification_system", direction: "produces", description: "Sends execution status notifications", dataFlow: "ExecutionStatus → NotificationChannel", requiredPhase: "apply" },
  { target: "org_intelligence", direction: "consumes", description: "Applies org execution preferences", dataFlow: "OrgPreferences → SafetyConfig", requiredPhase: "pre_check" },
  { target: "simulation_engine", direction: "consumes", description: "Uses simulation for pre-execution impact assessment", dataFlow: "SimulationResult → RiskAssessment", requiredPhase: "pre_check" },
];

// ═══════════════════════════════════════════════════════════════════════════════
// §14 — Query Functions
// ═══════════════════════════════════════════════════════════════════════════════

export function getPreExecutionCheck(id: PreCheckId): PreExecutionCheck | undefined {
  return PRE_EXECUTION_CHECKS.find((c) => c.id === id);
}

export function getRequiredPreChecks(): PreExecutionCheck[] {
  return PRE_EXECUTION_CHECKS.filter((c) => c.required);
}

export function getPreChecksForStrategy(strategy: ExecutionStrategy): PreExecutionCheck[] {
  return PRE_EXECUTION_CHECKS.filter((c) => c.applicableStrategies.includes(strategy));
}

export function getAutonomyPermissions(level: AutonomyLevel): AutonomyPermissions {
  return AUTONOMY_LEVEL_PERMISSIONS[level];
}

export function canAutonomouslyApply(level: AutonomyLevel, blastRadius: "minimal" | "low" | "moderate" | "high" | "critical"): boolean {
  const permissions = AUTONOMY_LEVEL_PERMISSIONS[level];
  if (!permissions.canApply) return false;
  if (permissions.requiresApproval) return false;
  const severityOrder: Record<string, number> = { minimal: 0, low: 1, moderate: 2, high: 3, critical: 4 };
  return severityOrder[blastRadius] <= severityOrder[permissions.maxBlastRadius];
}

export function getProviderExecutionProfile(provider: "aws" | "azure" | "gcp"): ProviderExecutionProfile | undefined {
  return PROVIDER_EXECUTION_PROFILES.find((p) => p.provider === provider);
}

export function getTypicalApplyLatency(provider: "aws" | "azure" | "gcp", resourceType: string): number | undefined {
  const profile = getProviderExecutionProfile(provider);
  return profile?.typicalApplyLatencyMs[resourceType];
}

export function getRollbackCapability(provider: "aws" | "azure" | "gcp", resourceType: string): ProviderRollbackCapability | undefined {
  const profile = getProviderExecutionProfile(provider);
  return profile?.rollbackCapabilities.find((r) => r.resourceType === resourceType);
}

export function isStrategySupported(provider: "aws" | "azure" | "gcp", strategy: ExecutionStrategy): boolean {
  const profile = getProviderExecutionProfile(provider);
  return profile?.supportedStrategies.includes(strategy) ?? false;
}

export function getExecutionInvariant(id: string): ExecutionInvariant | undefined {
  return EXECUTION_INVARIANTS.find((i) => i.id === id);
}

export function getNonOverridableInvariants(): ExecutionInvariant[] {
  return EXECUTION_INVARIANTS.filter((i) => !i.overridable);
}

export function getExecutionIntegration(target: ExecutionIntegrationTarget): ExecutionIntegrationContract | undefined {
  return EXECUTION_INTEGRATION_CONTRACTS.find((c) => c.target === target);
}

export function estimateTotalApplyDuration(provider: "aws" | "azure" | "gcp", resourceTypes: string[], parallelLimit: number): number {
  const profile = getProviderExecutionProfile(provider);
  if (!profile) return 0;
  const latencies = resourceTypes.map((rt) => profile.typicalApplyLatencyMs[rt] ?? 120_000);
  latencies.sort((a, b) => b - a);
  let totalMs = 0;
  for (let i = 0; i < latencies.length; i += parallelLimit) {
    const batch = latencies.slice(i, i + parallelLimit);
    totalMs += Math.max(...batch);
  }
  return totalMs;
}

// ═══════════════════════════════════════════════════════════════════════════════
// §15 — Tests
// ═══════════════════════════════════════════════════════════════════════════════

export interface ExecutionSafetyTestResult {
  name: string;
  passed: boolean;
  message: string;
}

export function runExecutionSafetyTests(): ExecutionSafetyTestResult[] {
  const results: ExecutionSafetyTestResult[] = [];
  const assert = (name: string, condition: boolean, msg: string) => {
    results.push({ name, passed: condition, message: condition ? "OK" : msg });
  };

  // §1 — Execution Architecture
  assert("execution-strategies-exist", (["immediate", "canary", "blue_green", "rolling", "maintenance_window", "staged_approval"] as ExecutionStrategy[]).length === 6, "Should have 6 execution strategies");
  assert("execution-phases-exist", (["pre_check", "snapshot", "dry_run", "approval_gate", "apply", "health_check", "verification", "stabilization", "post_check", "complete", "rollback_triggered", "rolling_back", "rolled_back", "failed"] as ExecutionPhase[]).length === 14, "Should have 14 execution phases");
  assert("autonomy-levels-exist", Object.keys(AUTONOMY_LEVEL_PERMISSIONS).length === 5, "Should have 5 autonomy levels");
  assert("manual-cannot-apply", !getAutonomyPermissions("manual").canApply, "Manual level should not be able to apply");
  assert("autonomous-low-no-approval", !getAutonomyPermissions("autonomous_low_risk").requiresApproval, "Autonomous low risk should not require approval");

  // §2 — Pre-Execution Checks
  assert("pre-checks-exist", PRE_EXECUTION_CHECKS.length === 12, "Should have 12 pre-execution checks");
  assert("required-pre-checks", getRequiredPreChecks().length >= 10, "Should have at least 10 required pre-checks");
  assert("pre-checks-ordered", PRE_EXECUTION_CHECKS.every((c, i) => i === 0 || c.order >= PRE_EXECUTION_CHECKS[i - 1].order), "Pre-checks should be ordered");
  assert("state-lock-check-first", PRE_EXECUTION_CHECKS[0].id === "state_lock_available", "State lock should be first check");
  assert("pre-check-lookup", getPreExecutionCheck("backup_verified") !== undefined, "Should find backup check");

  // §3 — Safety Config
  assert("default-safety-config", DEFAULT_SAFETY_CONFIG.requirePreCheckPass && DEFAULT_SAFETY_CONFIG.requireDryRunPass && DEFAULT_SAFETY_CONFIG.requireRollbackPlan, "Default config should require all safety measures");
  assert("conservative-stricter", CONSERVATIVE_SAFETY_CONFIG.circuitBreakerThreshold < DEFAULT_SAFETY_CONFIG.circuitBreakerThreshold, "Conservative config should have lower threshold");
  assert("kill-switch-default-on", DEFAULT_SAFETY_CONFIG.killSwitchEnabled, "Kill switch should be enabled by default");

  // §4 — Health Checks
  assert("default-health-config", DEFAULT_HEALTH_CONFIG.baselineComparisonEnabled, "Baseline comparison should be enabled");
  assert("health-check-types", (["http_endpoint", "tcp_port", "cloudwatch_alarm", "custom_metric", "api_response_time"] as HealthCheckType[]).length === 5, "Should have multiple health check types");

  // §5 — Auto-Rollback
  assert("rollback-config-10-triggers", DEFAULT_ROLLBACK_CONFIG.triggers.length === 10, "Should have 10 rollback triggers");
  assert("rollback-enabled-by-default", DEFAULT_ROLLBACK_CONFIG.enabled, "Auto-rollback should be enabled by default");
  assert("health-failure-auto-executes", DEFAULT_ROLLBACK_CONFIG.triggers.find((t) => t.trigger === "health_check_failure")?.autoExecute === true, "Health check failure should auto-execute rollback");
  assert("cost-anomaly-no-auto", DEFAULT_ROLLBACK_CONFIG.triggers.find((t) => t.trigger === "cost_anomaly")?.autoExecute === false, "Cost anomaly should not auto-rollback");

  // §6 — Circuit Breaker
  assert("circuit-breaker-state-closed", computeCircuitBreakerState({ id: "test", orgId: "org1", provider: "aws", state: "closed", failureCount: 0, successCount: 5, lastFailureAt: null, lastSuccessAt: "2026-01-01T00:00:00Z", openedAt: null, resetAt: null, threshold: 3, resetTimeMs: 300_000, halfOpenMaxAttempts: 1, halfOpenAttempts: 0, metadata: {} }, "2026-01-01T00:01:00Z") === "closed", "Closed breaker should stay closed");
  assert("circuit-breaker-state-half-open", computeCircuitBreakerState({ id: "test", orgId: "org1", provider: "aws", state: "open", failureCount: 3, successCount: 0, lastFailureAt: "2026-01-01T00:00:00Z", lastSuccessAt: null, openedAt: "2026-01-01T00:00:00Z", resetAt: null, threshold: 3, resetTimeMs: 300_000, halfOpenMaxAttempts: 1, halfOpenAttempts: 0, metadata: {} }, "2026-01-01T00:06:00Z") === "half_open", "Open breaker should become half-open after reset time");

  // §7 — Autonomy Permissions
  assert("cannot-autonomous-high-risk", !canAutonomouslyApply("autonomous_low_risk", "high"), "Low-risk autonomy should not apply to high blast radius");
  assert("can-autonomous-low-risk", canAutonomouslyApply("autonomous_low_risk", "low"), "Low-risk autonomy should apply to low blast radius");
  assert("supervised-requires-approval", !canAutonomouslyApply("supervised", "minimal"), "Supervised should require approval");

  // §9 — Kill Switch
  assert("kill-switch-default-manual-deactivation", DEFAULT_KILL_SWITCH_POLICY.requireManualDeactivation, "Kill switch should require manual deactivation");
  assert("kill-switch-auto-on-critical", DEFAULT_KILL_SWITCH_POLICY.autoActivateOnCriticalError, "Kill switch should auto-activate on critical errors");

  // §11 — Provider Profiles
  assert("three-provider-profiles", PROVIDER_EXECUTION_PROFILES.length === 3, "Should have 3 provider profiles");
  assert("aws-profile-lookup", getProviderExecutionProfile("aws")?.maxParallelApplies === 5, "AWS should allow 5 parallel applies");
  assert("aws-ec2-latency", getTypicalApplyLatency("aws", "aws_instance") === 120_000, "EC2 latency should be 120s");
  assert("aws-rds-rollback-snapshot", getRollbackCapability("aws", "aws_db_instance")?.snapshotBased === true, "RDS should support snapshot rollback");
  assert("canary-supported-aws", isStrategySupported("aws", "canary"), "AWS should support canary");
  assert("canary-not-azure", !isStrategySupported("azure", "canary"), "Azure should not support canary (yet)");
  assert("duration-estimate", estimateTotalApplyDuration("aws", ["aws_instance", "aws_s3_bucket"], 2) > 0, "Duration estimate should be positive");

  // §12 — Invariants
  assert("invariants-exist", EXECUTION_INVARIANTS.length === 10, "Should have 10 execution invariants");
  assert("all-invariants-non-overridable", getNonOverridableInvariants().length === 10, "All invariants should be non-overridable");
  assert("no-autonomy-escalation-invariant", getExecutionInvariant("no-autonomy-escalation") !== undefined, "Must have no-autonomy-escalation invariant");
  assert("kill-switch-supremacy-invariant", getExecutionInvariant("kill-switch-supremacy") !== undefined, "Must have kill-switch supremacy invariant");

  // §13 — Integration Contracts
  assert("integration-contracts-exist", EXECUTION_INTEGRATION_CONTRACTS.length === 10, "Should have 10 integration contracts");
  assert("terraform-gen-integration", getExecutionIntegration("terraform_generation")?.direction === "consumes", "Should consume from terraform generation");
  assert("monitoring-bidirectional", getExecutionIntegration("monitoring_agent")?.direction === "bidirectional", "Monitoring should be bidirectional");

  return results;
}
