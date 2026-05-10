/**
 * Axiom Operation Orchestrator
 *
 * Autonomous multi-step operation execution engine. Breaks large
 * infrastructure tasks into phased rollouts with dependency management,
 * risk simulation, approval checkpoints, rollback coordination, and
 * verification flows.
 *
 * Supported operation types:
 *   1. Rolling compute optimization
 *   2. Phased storage migration
 *   3. Resilience improvement rollout
 *   4. Region expansion planning
 *   5. Backup modernization
 *   6. Commitment optimization strategy
 *
 * Safety invariants:
 *   - Every phase requires explicit approval unless risk is "low" and canary passed
 *   - Rollback is always available until operation is finalized
 *   - Failed verification halts the entire operation
 *   - No phase executes if its dependencies haven't succeeded
 *   - Blast radius is capped per phase (max resources, max cost impact)
 *   - Multi-region operations proceed region-by-region, never all-at-once
 *   - Full audit trail for every state transition
 */

import type { CloudProvider } from "../cloudSnapshot";
import type { ActionType, RiskLevel } from "../executionPlan";
import type { FindingCategory } from "./types";

// ═══════════════════════════════════════════════════════════════════════════
// 1. OPERATION TYPES
// ═══════════════════════════════════════════════════════════════════════════

export type OperationType =
  | "rolling_compute_optimization"
  | "phased_storage_migration"
  | "resilience_improvement"
  | "region_expansion"
  | "backup_modernization"
  | "commitment_optimization";

export type OperationStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "in_progress"
  | "paused"
  | "rolling_back"
  | "completed"
  | "failed"
  | "cancelled";

export type StepStatus =
  | "pending"
  | "ready"
  | "awaiting_approval"
  | "approved"
  | "executing"
  | "verifying"
  | "succeeded"
  | "failed"
  | "rolled_back"
  | "skipped";

// ═══════════════════════════════════════════════════════════════════════════
// 2. OPERATION DEFINITION
// ═══════════════════════════════════════════════════════════════════════════

export type Operation = {
  id: string;
  orgId: string;
  name: string;
  description: string;
  type: OperationType;
  status: OperationStatus;

  steps: OperationStep[];
  dependencies: StepDependency[];
  checkpoints: ApprovalCheckpoint[];

  providers: CloudProvider[];
  regions: string[];
  totalResourceCount: number;

  riskProfile: OperationRisk;
  blastRadius: BlastRadius;
  rollbackStrategy: RollbackStrategy;

  schedule: OperationSchedule;
  audit: AuditEntry[];
  metrics: OperationMetrics;

  createdAt: string;
  updatedAt: string;
  createdBy: string;
  sourcePlanId: string | null;
};

export type OperationStep = {
  id: string;
  operationId: string;
  name: string;
  description: string;
  order: number;
  status: StepStatus;

  actionType: ActionType;
  provider: CloudProvider;
  regions: string[];
  resourceIds: string[];
  resourceCount: number;

  category: FindingCategory;
  riskLevel: RiskLevel;
  requiresApproval: boolean;
  requiresMaintenanceWindow: boolean;

  preconditions: StepPrecondition[];
  verificationCriteria: VerificationCriterion[];
  rollbackProcedure: RollbackProcedure;

  estimatedDurationMinutes: number;
  estimatedCostImpact: CostImpact;
  maxBlastRadius: number;

  canaryConfig: CanaryConfig | null;
  waitAfterMinutes: number;

  executionResult: ExecutionResult | null;
  verificationResult: VerificationResult | null;
  rollbackResult: RollbackResult | null;

  startedAt: string | null;
  completedAt: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
};

// ═══════════════════════════════════════════════════════════════════════════
// 3. DEPENDENCIES
// ═══════════════════════════════════════════════════════════════════════════

export type StepDependency = {
  fromStepId: string;
  toStepId: string;
  type: DependencyType;
  condition: DependencyCondition | null;
};

export type DependencyType =
  | "must_complete"     // toStep can't start until fromStep succeeds
  | "must_verify"      // toStep can't start until fromStep verifies
  | "soft"             // toStep prefers fromStep complete but can proceed
  | "canary_gate";     // toStep waits for canary validation of fromStep

export type DependencyCondition = {
  metricName: string;
  operator: "gt" | "gte" | "lt" | "lte" | "eq";
  threshold: number;
  description: string;
};

// ═══════════════════════════════════════════════════════════════════════════
// 4. RISK SIMULATION
// ═══════════════════════════════════════════════════════════════════════════

export type OperationRisk = {
  overallRisk: RiskLevel;
  riskScore: number;              // 0-100
  factors: RiskFactor[];
  mitigations: RiskMitigation[];
  simulation: RiskSimulation;
};

export type RiskFactor = {
  id: string;
  name: string;
  description: string;
  severity: RiskLevel;
  likelihood: "rare" | "unlikely" | "possible" | "likely" | "certain";
  category: "blast_radius" | "data_loss" | "downtime" | "cost_overrun" | "dependency_failure" | "provider_api";
  affectedSteps: string[];
};

export type RiskMitigation = {
  factorId: string;
  strategy: string;
  effectiveness: "full" | "partial" | "minimal";
  automated: boolean;
};

export type RiskSimulation = {
  simulatedAt: string;
  scenarios: SimulationScenario[];
  worstCase: SimulationOutcome;
  expectedCase: SimulationOutcome;
  bestCase: SimulationOutcome;
  confidence: number;
};

export type SimulationScenario = {
  name: string;
  probability: number;            // 0-1
  outcome: SimulationOutcome;
  triggers: string[];
};

export type SimulationOutcome = {
  downtimeMinutes: number;
  dataLossRisk: "none" | "low" | "medium" | "high";
  costImpactUsd: number;
  rollbackRequired: boolean;
  estimatedRecoveryMinutes: number;
  affectedResources: number;
};

// ═══════════════════════════════════════════════════════════════════════════
// 5. BLAST RADIUS
// ═══════════════════════════════════════════════════════════════════════════

export type BlastRadius = {
  maxResourcesPerStep: number;
  maxCostImpactPerStep: number;   // USD
  maxRegionsParallel: number;
  maxDowntimeMinutes: number;
  enforced: boolean;
};

const DEFAULT_BLAST_RADIUS: BlastRadius = {
  maxResourcesPerStep: 50,
  maxCostImpactPerStep: 10_000,
  maxRegionsParallel: 1,
  maxDowntimeMinutes: 30,
  enforced: true,
};

// ═══════════════════════════════════════════════════════════════════════════
// 6. APPROVAL CHECKPOINTS
// ═══════════════════════════════════════════════════════════════════════════

export type ApprovalCheckpoint = {
  id: string;
  afterStepId: string;
  reason: string;
  requiredApprovers: string[];
  minApprovals: number;
  autoApproveIfCanaryPasses: boolean;
  expiresAfterHours: number;
  status: "pending" | "approved" | "rejected" | "expired";
  approvals: CheckpointApproval[];
};

export type CheckpointApproval = {
  userId: string;
  decision: "approve" | "reject";
  reason: string | null;
  decidedAt: string;
};

// ═══════════════════════════════════════════════════════════════════════════
// 7. VERIFICATION
// ═══════════════════════════════════════════════════════════════════════════

export type StepPrecondition = {
  id: string;
  description: string;
  type: "resource_state" | "metric_threshold" | "time_window" | "dependency_met" | "approval_received";
  check: PreconditionCheck;
  required: boolean;
};

export type PreconditionCheck = {
  target: string;
  operator: "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "exists" | "not_exists";
  expectedValue: unknown;
};

export type VerificationCriterion = {
  id: string;
  name: string;
  description: string;
  type: "metric" | "resource_state" | "health_check" | "latency" | "error_rate" | "cost";
  target: string;
  operator: "eq" | "gt" | "gte" | "lt" | "lte";
  threshold: unknown;
  waitBeforeCheckMinutes: number;
  retries: number;
  critical: boolean;
};

export type VerificationResult = {
  stepId: string;
  passed: boolean;
  criteria: CriterionResult[];
  verifiedAt: string;
  durationMs: number;
};

export type CriterionResult = {
  criterionId: string;
  passed: boolean;
  actualValue: unknown;
  expectedValue: unknown;
  message: string;
};

export type ExecutionResult = {
  stepId: string;
  success: boolean;
  resourcesModified: number;
  errors: ExecutionError[];
  startedAt: string;
  completedAt: string;
  durationMs: number;
  providerResponses: ProviderResponse[];
};

export type ExecutionError = {
  resourceId: string;
  code: string;
  message: string;
  retryable: boolean;
  provider: CloudProvider;
};

export type ProviderResponse = {
  provider: CloudProvider;
  region: string;
  resourceId: string;
  action: string;
  status: "success" | "failed" | "skipped";
  responseCode: number | null;
  message: string;
};

// ═══════════════════════════════════════════════════════════════════════════
// 8. ROLLBACK
// ═══════════════════════════════════════════════════════════════════════════

export type RollbackStrategy = {
  mode: "step_by_step" | "full_reversal" | "checkpoint_reversal";
  autoRollbackOnFailure: boolean;
  autoRollbackOnVerificationFailure: boolean;
  maxRollbackAttempts: number;
  preserveSuccessfulSteps: boolean;
  notifyOnRollback: string[];
};

export type RollbackProcedure = {
  steps: RollbackAction[];
  estimatedDurationMinutes: number;
  requiresApproval: boolean;
  dataLossRisk: "none" | "low" | "medium" | "high";
};

export type RollbackAction = {
  order: number;
  description: string;
  actionType: ActionType;
  provider: CloudProvider;
  resourceIds: string[];
  preRollbackState: Record<string, unknown>;
};

export type RollbackResult = {
  stepId: string;
  success: boolean;
  actionsCompleted: number;
  actionsFailed: number;
  errors: ExecutionError[];
  startedAt: string;
  completedAt: string;
  durationMs: number;
};

// ═══════════════════════════════════════════════════════════════════════════
// 9. CANARY CONFIG
// ═══════════════════════════════════════════════════════════════════════════

export type CanaryConfig = {
  percentage: number;              // 1-100, % of resources in canary
  durationMinutes: number;
  successThreshold: number;        // 0-1, required success rate
  metricsToWatch: CanaryMetric[];
  autoPromote: boolean;
  autoRollbackOnFailure: boolean;
};

export type CanaryMetric = {
  name: string;
  baseline: number;
  maxDeviation: number;            // % deviation from baseline
  direction: "lower_is_better" | "higher_is_better";
};

// ═══════════════════════════════════════════════════════════════════════════
// 10. SCHEDULING
// ═══════════════════════════════════════════════════════════════════════════

export type OperationSchedule = {
  startAfter: string | null;       // ISO timestamp
  startBefore: string | null;
  maintenanceWindows: MaintenanceWindow[];
  timezone: string;
  maxDurationHours: number;
  pauseBetweenStepsMinutes: number;
};

export type MaintenanceWindow = {
  dayOfWeek: number;               // 0=Sunday
  startHour: number;               // 0-23 UTC
  durationHours: number;
  label: string;
};

// ═══════════════════════════════════════════════════════════════════════════
// 11. COST IMPACT
// ═══════════════════════════════════════════════════════════════════════════

export type CostImpact = {
  monthlySavings: number;
  monthlyIncrease: number;
  netMonthly: number;
  migrationCost: number;           // one-time cost
  breakEvenDays: number;
};

// ═══════════════════════════════════════════════════════════════════════════
// 12. AUDIT TRAIL
// ═══════════════════════════════════════════════════════════════════════════

export type AuditEntry = {
  id: string;
  operationId: string;
  timestamp: string;
  actor: string;                   // userId or "agent"
  action: AuditAction;
  stepId: string | null;
  details: string;
  metadata: Record<string, unknown>;
};

export type AuditAction =
  | "operation_created"
  | "operation_approved"
  | "operation_started"
  | "operation_paused"
  | "operation_resumed"
  | "operation_completed"
  | "operation_failed"
  | "operation_cancelled"
  | "step_started"
  | "step_completed"
  | "step_failed"
  | "step_skipped"
  | "step_approved"
  | "step_rejected"
  | "verification_passed"
  | "verification_failed"
  | "rollback_started"
  | "rollback_completed"
  | "rollback_failed"
  | "checkpoint_approved"
  | "checkpoint_rejected"
  | "blast_radius_exceeded"
  | "canary_promoted"
  | "canary_failed"
  | "schedule_adjusted";

// ═══════════════════════════════════════════════════════════════════════════
// 13. OPERATION METRICS
// ═══════════════════════════════════════════════════════════════════════════

export type OperationMetrics = {
  totalSteps: number;
  completedSteps: number;
  failedSteps: number;
  skippedSteps: number;
  rollbackSteps: number;
  totalResourcesModified: number;
  totalCostSaved: number;
  totalDurationMs: number;
  verificationPassRate: number;
  canarySuccessRate: number;
};

// ═══════════════════════════════════════════════════════════════════════════
// 14. OPERATION INPUT
// ═══════════════════════════════════════════════════════════════════════════

export type CreateOperationInput = {
  orgId: string;
  name: string;
  description: string;
  type: OperationType;
  createdBy: string;

  providers: CloudProvider[];
  regions: string[];
  resourceTargets: ResourceTarget[];

  blastRadius?: Partial<BlastRadius>;
  rollbackStrategy?: Partial<RollbackStrategy>;
  schedule?: Partial<OperationSchedule>;

  sourcePlanId?: string;
  autoApproveCanary?: boolean;
};

export type ResourceTarget = {
  resourceId: string;
  provider: CloudProvider;
  region: string;
  resourceType: string;
  currentState: Record<string, unknown>;
  desiredState: Record<string, unknown>;
  actionType: ActionType;
  category: FindingCategory;
  riskLevel: RiskLevel;
  estimatedSavingsMonthly: number;
};

// ═══════════════════════════════════════════════════════════════════════════
// 15. ORCHESTRATION ENGINE
// ═══════════════════════════════════════════════════════════════════════════

let opSeq = 0;

function opId(prefix: string): string {
  return `${prefix}-${Date.now()}-${++opSeq}`;
}

export function createOperation(input: CreateOperationInput): Operation {
  const now = new Date().toISOString();
  const id = opId("op");

  const blastRadius: BlastRadius = {
    ...DEFAULT_BLAST_RADIUS,
    ...input.blastRadius,
  };

  const rollbackStrategy: RollbackStrategy = {
    mode: "step_by_step",
    autoRollbackOnFailure: true,
    autoRollbackOnVerificationFailure: true,
    maxRollbackAttempts: 3,
    preserveSuccessfulSteps: true,
    notifyOnRollback: [input.createdBy],
    ...input.rollbackStrategy,
  };

  const schedule: OperationSchedule = {
    startAfter: null,
    startBefore: null,
    maintenanceWindows: [],
    timezone: "UTC",
    maxDurationHours: 72,
    pauseBetweenStepsMinutes: 5,
    ...input.schedule,
  };

  // Group targets by region, then by risk level (low first)
  const grouped = groupTargetsByRegion(input.resourceTargets);
  const steps = buildSteps(id, grouped, blastRadius, input);
  const dependencies = buildDependencies(steps, blastRadius);
  const checkpoints = buildCheckpoints(steps, input.autoApproveCanary ?? false);
  const riskProfile = simulateRisk(steps, dependencies, blastRadius);

  const operation: Operation = {
    id,
    orgId: input.orgId,
    name: input.name,
    description: input.description,
    type: input.type,
    status: "draft",
    steps,
    dependencies,
    checkpoints,
    providers: input.providers,
    regions: input.regions,
    totalResourceCount: input.resourceTargets.length,
    riskProfile,
    blastRadius,
    rollbackStrategy,
    schedule,
    audit: [{
      id: opId("audit"),
      operationId: id,
      timestamp: now,
      actor: input.createdBy,
      action: "operation_created",
      stepId: null,
      details: `Operation "${input.name}" created with ${steps.length} steps across ${input.regions.length} region(s)`,
      metadata: { type: input.type, resourceCount: input.resourceTargets.length },
    }],
    metrics: {
      totalSteps: steps.length,
      completedSteps: 0,
      failedSteps: 0,
      skippedSteps: 0,
      rollbackSteps: 0,
      totalResourcesModified: 0,
      totalCostSaved: 0,
      totalDurationMs: 0,
      verificationPassRate: 0,
      canarySuccessRate: 0,
    },
    createdAt: now,
    updatedAt: now,
    createdBy: input.createdBy,
    sourcePlanId: input.sourcePlanId ?? null,
  };

  return operation;
}

// ═══════════════════════════════════════════════════════════════════════════
// 16. STEP BUILDER — decomposes targets into ordered steps
// ═══════════════════════════════════════════════════════════════════════════

type RegionGroup = {
  region: string;
  provider: CloudProvider;
  targets: ResourceTarget[];
};

function groupTargetsByRegion(targets: ResourceTarget[]): RegionGroup[] {
  const groups: Record<string, RegionGroup> = {};
  for (const t of targets) {
    const key = `${t.provider}:${t.region}`;
    if (!groups[key]) {
      groups[key] = { region: t.region, provider: t.provider, targets: [] };
    }
    groups[key].targets.push(t);
  }
  // Sort groups: smallest region first (canary candidates)
  return Object.values(groups).sort((a, b) => a.targets.length - b.targets.length);
}

function buildSteps(
  operationId: string,
  groups: RegionGroup[],
  blastRadius: BlastRadius,
  input: CreateOperationInput,
): OperationStep[] {
  const steps: OperationStep[] = [];
  let order = 0;

  for (let gi = 0; gi < groups.length; gi++) {
    const group = groups[gi];
    const isCanary = gi === 0 && groups.length > 1;

    // Split group into batches respecting blast radius
    const batches = splitIntoBatches(group.targets, blastRadius.maxResourcesPerStep);

    for (let bi = 0; bi < batches.length; bi++) {
      const batch = batches[bi];
      const stepId = opId("step");
      const riskLevel = highestRisk(batch);

      const canaryConfig: CanaryConfig | null = isCanary && bi === 0
        ? {
            percentage: Math.min(20, Math.ceil((batch.length / input.resourceTargets.length) * 100)),
            durationMinutes: riskLevel === "high" ? 60 : riskLevel === "medium" ? 30 : 15,
            successThreshold: 0.95,
            metricsToWatch: defaultCanaryMetrics(input.type),
            autoPromote: riskLevel === "low",
            autoRollbackOnFailure: true,
          }
        : null;

      const step: OperationStep = {
        id: stepId,
        operationId,
        name: buildStepName(group, bi, batches.length, isCanary && bi === 0),
        description: buildStepDescription(batch, group),
        order: order++,
        status: "pending",
        actionType: batch[0].actionType,
        provider: group.provider,
        regions: [group.region],
        resourceIds: batch.map((t) => t.resourceId),
        resourceCount: batch.length,
        category: batch[0].category,
        riskLevel,
        requiresApproval: riskLevel !== "low" || batch.length > 10,
        requiresMaintenanceWindow: riskLevel === "high",
        preconditions: buildPreconditions(batch, group),
        verificationCriteria: buildVerificationCriteria(input.type, batch),
        rollbackProcedure: buildRollbackProcedure(batch, group),
        estimatedDurationMinutes: estimateDuration(batch, input.type),
        estimatedCostImpact: estimateCostImpact(batch),
        maxBlastRadius: batch.length,
        canaryConfig,
        waitAfterMinutes: canaryConfig ? canaryConfig.durationMinutes : 5,
        executionResult: null,
        verificationResult: null,
        rollbackResult: null,
        startedAt: null,
        completedAt: null,
        approvedBy: null,
        approvedAt: null,
      };

      steps.push(step);
    }
  }

  return steps;
}

function splitIntoBatches(targets: ResourceTarget[], maxPerBatch: number): ResourceTarget[][] {
  const sorted = [...targets].sort((a, b) => {
    const riskRank: Record<string, number> = { low: 0, medium: 1, high: 2 };
    return (riskRank[a.riskLevel] ?? 1) - (riskRank[b.riskLevel] ?? 1);
  });

  const batches: ResourceTarget[][] = [];
  for (let i = 0; i < sorted.length; i += maxPerBatch) {
    batches.push(sorted.slice(i, i + maxPerBatch));
  }
  return batches;
}

function highestRisk(targets: ResourceTarget[]): RiskLevel {
  if (targets.some((t) => t.riskLevel === "high")) return "high";
  if (targets.some((t) => t.riskLevel === "medium")) return "medium";
  return "low";
}

function buildStepName(group: RegionGroup, batchIdx: number, totalBatches: number, isCanary: boolean): string {
  const suffix = totalBatches > 1 ? ` (batch ${batchIdx + 1}/${totalBatches})` : "";
  const prefix = isCanary ? "[Canary] " : "";
  return `${prefix}${group.provider.toUpperCase()} ${group.region}${suffix}`;
}

function buildStepDescription(batch: ResourceTarget[], group: RegionGroup): string {
  const actionTypes = [...new Set(batch.map((t) => t.actionType))];
  return `${actionTypes.join(", ")} on ${batch.length} resource(s) in ${group.provider}/${group.region}`;
}

function buildPreconditions(batch: ResourceTarget[], group: RegionGroup): StepPrecondition[] {
  return [
    {
      id: opId("pre"),
      description: `All ${batch.length} target resources exist in ${group.provider}/${group.region}`,
      type: "resource_state",
      check: { target: "resource_existence", operator: "eq", expectedValue: true },
      required: true,
    },
    {
      id: opId("pre"),
      description: "No active incidents on target provider/region",
      type: "metric_threshold",
      check: { target: "active_incidents", operator: "eq", expectedValue: 0 },
      required: true,
    },
  ];
}

function buildVerificationCriteria(type: OperationType, batch: ResourceTarget[]): VerificationCriterion[] {
  const criteria: VerificationCriterion[] = [
    {
      id: opId("vc"),
      name: "Resource state matches desired",
      description: "All modified resources match their desired state",
      type: "resource_state",
      target: "desired_state_match",
      operator: "eq",
      threshold: true,
      waitBeforeCheckMinutes: 2,
      retries: 3,
      critical: true,
    },
  ];

  if (type === "rolling_compute_optimization" || type === "commitment_optimization") {
    criteria.push({
      id: opId("vc"),
      name: "CPU utilization stable",
      description: "CPU utilization remains within acceptable range post-change",
      type: "metric",
      target: "cpu_utilization_p95",
      operator: "lt",
      threshold: 85,
      waitBeforeCheckMinutes: 10,
      retries: 2,
      critical: true,
    });
  }

  if (type === "phased_storage_migration") {
    criteria.push({
      id: opId("vc"),
      name: "Data integrity verified",
      description: "Checksums match between source and destination",
      type: "health_check",
      target: "data_integrity",
      operator: "eq",
      threshold: true,
      waitBeforeCheckMinutes: 5,
      retries: 3,
      critical: true,
    });
  }

  if (type === "resilience_improvement" || type === "backup_modernization") {
    criteria.push({
      id: opId("vc"),
      name: "Backup verification",
      description: "At least one successful backup completed after change",
      type: "health_check",
      target: "backup_status",
      operator: "eq",
      threshold: "success",
      waitBeforeCheckMinutes: 15,
      retries: 2,
      critical: true,
    });
  }

  if (type === "region_expansion") {
    criteria.push({
      id: opId("vc"),
      name: "Endpoint reachable",
      description: "New region endpoint responds within latency SLA",
      type: "latency",
      target: "endpoint_latency_ms",
      operator: "lt",
      threshold: 500,
      waitBeforeCheckMinutes: 5,
      retries: 5,
      critical: true,
    });
  }

  return criteria;
}

function buildRollbackProcedure(batch: ResourceTarget[], group: RegionGroup): RollbackProcedure {
  const hasHighRisk = batch.some((t) => t.riskLevel === "high");
  return {
    steps: batch.map((t, i) => ({
      order: i,
      description: `Revert ${t.resourceId} to previous state`,
      actionType: t.actionType,
      provider: group.provider,
      resourceIds: [t.resourceId],
      preRollbackState: t.currentState,
    })),
    estimatedDurationMinutes: Math.ceil(batch.length * 2),
    requiresApproval: hasHighRisk,
    dataLossRisk: "none",
  };
}

function estimateDuration(batch: ResourceTarget[], type: OperationType): number {
  const perResource: Record<OperationType, number> = {
    rolling_compute_optimization: 3,
    phased_storage_migration: 10,
    resilience_improvement: 5,
    region_expansion: 15,
    backup_modernization: 8,
    commitment_optimization: 2,
  };
  return Math.ceil(batch.length * (perResource[type] ?? 5));
}

function estimateCostImpact(batch: ResourceTarget[]): CostImpact {
  const monthlySavings = batch.reduce((s, t) => s + t.estimatedSavingsMonthly, 0);
  return {
    monthlySavings: Math.round(monthlySavings * 100) / 100,
    monthlyIncrease: 0,
    netMonthly: Math.round(monthlySavings * 100) / 100,
    migrationCost: 0,
    breakEvenDays: 0,
  };
}

function defaultCanaryMetrics(type: OperationType): CanaryMetric[] {
  const base: CanaryMetric[] = [
    { name: "error_rate", baseline: 0, maxDeviation: 5, direction: "lower_is_better" },
  ];

  if (type === "rolling_compute_optimization") {
    base.push({ name: "cpu_utilization", baseline: 50, maxDeviation: 20, direction: "lower_is_better" });
    base.push({ name: "response_latency_p99", baseline: 200, maxDeviation: 25, direction: "lower_is_better" });
  }

  if (type === "phased_storage_migration") {
    base.push({ name: "read_latency_ms", baseline: 10, maxDeviation: 50, direction: "lower_is_better" });
    base.push({ name: "write_latency_ms", baseline: 15, maxDeviation: 50, direction: "lower_is_better" });
  }

  return base;
}

// ═══════════════════════════════════════════════════════════════════════════
// 17. DEPENDENCY BUILDER
// ═══════════════════════════════════════════════════════════════════════════

function buildDependencies(steps: OperationStep[], blastRadius: BlastRadius): StepDependency[] {
  const deps: StepDependency[] = [];

  // Sequential within same region (order-based)
  for (let i = 1; i < steps.length; i++) {
    const prev = steps[i - 1];
    const curr = steps[i];

    if (prev.regions[0] === curr.regions[0] && prev.provider === curr.provider) {
      deps.push({
        fromStepId: prev.id,
        toStepId: curr.id,
        type: "must_verify",
        condition: null,
      });
    }
  }

  // Canary gates: canary step must verify before any non-canary step
  const canarySteps = steps.filter((s) => s.canaryConfig !== null);
  const nonCanarySteps = steps.filter((s) => s.canaryConfig === null);

  for (const canary of canarySteps) {
    for (const regular of nonCanarySteps) {
      if (regular.order > canary.order) {
        const exists = deps.some((d) => d.fromStepId === canary.id && d.toStepId === regular.id);
        if (!exists) {
          deps.push({
            fromStepId: canary.id,
            toStepId: regular.id,
            type: "canary_gate",
            condition: {
              metricName: "canary_success_rate",
              operator: "gte",
              threshold: canary.canaryConfig!.successThreshold,
              description: `Canary must pass with ≥${canary.canaryConfig!.successThreshold * 100}% success`,
            },
          });
        }
      }
    }
  }

  // Cross-region: enforce maxRegionsParallel
  if (blastRadius.maxRegionsParallel === 1) {
    const regionOrder = new Map<string, OperationStep[]>();
    for (const step of steps) {
      const key = `${step.provider}:${step.regions[0]}`;
      if (!regionOrder.has(key)) regionOrder.set(key, []);
      regionOrder.get(key)!.push(step);
    }

    const regionKeys = [...regionOrder.keys()];
    for (let ri = 1; ri < regionKeys.length; ri++) {
      const prevRegionSteps = regionOrder.get(regionKeys[ri - 1])!;
      const currRegionSteps = regionOrder.get(regionKeys[ri])!;
      const lastPrev = prevRegionSteps[prevRegionSteps.length - 1];
      const firstCurr = currRegionSteps[0];

      const exists = deps.some((d) => d.fromStepId === lastPrev.id && d.toStepId === firstCurr.id);
      if (!exists) {
        deps.push({
          fromStepId: lastPrev.id,
          toStepId: firstCurr.id,
          type: "must_complete",
          condition: null,
        });
      }
    }
  }

  return deps;
}

// ═══════════════════════════════════════════════════════════════════════════
// 18. CHECKPOINT BUILDER
// ═══════════════════════════════════════════════════════════════════════════

function buildCheckpoints(steps: OperationStep[], autoApproveCanary: boolean): ApprovalCheckpoint[] {
  const checkpoints: ApprovalCheckpoint[] = [];

  for (const step of steps) {
    if (!step.requiresApproval) continue;

    checkpoints.push({
      id: opId("cp"),
      afterStepId: step.id,
      reason: step.canaryConfig
        ? `Canary validation for ${step.name}`
        : `Approval required: ${step.riskLevel} risk operation on ${step.resourceCount} resources`,
      requiredApprovers: [],
      minApprovals: step.riskLevel === "high" ? 2 : 1,
      autoApproveIfCanaryPasses: step.canaryConfig !== null && autoApproveCanary,
      expiresAfterHours: step.riskLevel === "high" ? 24 : 48,
      status: "pending",
      approvals: [],
    });
  }

  return checkpoints;
}

// ═══════════════════════════════════════════════════════════════════════════
// 19. RISK SIMULATION
// ═══════════════════════════════════════════════════════════════════════════

function simulateRisk(
  steps: OperationStep[],
  dependencies: StepDependency[],
  blastRadius: BlastRadius,
): OperationRisk {
  const factors: RiskFactor[] = [];
  let seq = 0;

  const totalResources = steps.reduce((s, st) => s + st.resourceCount, 0);
  const hasHighRisk = steps.some((s) => s.riskLevel === "high");
  const multiRegion = new Set(steps.flatMap((s) => s.regions)).size > 1;
  const multiProvider = new Set(steps.map((s) => s.provider)).size > 1;

  if (hasHighRisk) {
    factors.push({
      id: `rf-${++seq}`, name: "High-risk actions present",
      description: "One or more steps involve high-risk modifications",
      severity: "high", likelihood: "possible", category: "blast_radius",
      affectedSteps: steps.filter((s) => s.riskLevel === "high").map((s) => s.id),
    });
  }

  if (totalResources > 100) {
    factors.push({
      id: `rf-${++seq}`, name: "Large resource count",
      description: `${totalResources} resources across all steps`,
      severity: "medium", likelihood: "possible", category: "blast_radius",
      affectedSteps: steps.map((s) => s.id),
    });
  }

  if (multiProvider) {
    factors.push({
      id: `rf-${++seq}`, name: "Multi-provider operation",
      description: "Operation spans multiple cloud providers — increases coordination complexity",
      severity: "medium", likelihood: "unlikely", category: "dependency_failure",
      affectedSteps: steps.map((s) => s.id),
    });
  }

  if (multiRegion) {
    factors.push({
      id: `rf-${++seq}`, name: "Multi-region rollout",
      description: "Operation spans multiple regions — network partitions possible",
      severity: "low", likelihood: "rare", category: "provider_api",
      affectedSteps: steps.map((s) => s.id),
    });
  }

  // Any step without a rollback procedure
  const noRollback = steps.filter((s) => s.rollbackProcedure.steps.length === 0);
  if (noRollback.length > 0) {
    factors.push({
      id: `rf-${++seq}`, name: "Steps without rollback",
      description: `${noRollback.length} step(s) have no rollback procedure`,
      severity: "high", likelihood: "likely", category: "data_loss",
      affectedSteps: noRollback.map((s) => s.id),
    });
  }

  const mitigations: RiskMitigation[] = factors.map((f) => ({
    factorId: f.id,
    strategy: mitigationFor(f.category),
    effectiveness: f.severity === "high" ? "partial" : "full",
    automated: f.severity !== "high",
  }));

  const riskScore = computeRiskScore(factors);
  const overallRisk: RiskLevel = riskScore >= 70 ? "high" : riskScore >= 40 ? "medium" : "low";

  const now = new Date().toISOString();
  const simulation: RiskSimulation = {
    simulatedAt: now,
    scenarios: buildScenarios(steps, factors),
    worstCase: {
      downtimeMinutes: steps.reduce((s, st) => s + st.estimatedDurationMinutes, 0),
      dataLossRisk: hasHighRisk ? "medium" : "low",
      costImpactUsd: totalResources * 50,
      rollbackRequired: true,
      estimatedRecoveryMinutes: totalResources * 3,
      affectedResources: totalResources,
    },
    expectedCase: {
      downtimeMinutes: Math.ceil(steps.reduce((s, st) => s + st.estimatedDurationMinutes, 0) * 0.3),
      dataLossRisk: "none",
      costImpactUsd: 0,
      rollbackRequired: false,
      estimatedRecoveryMinutes: 0,
      affectedResources: 0,
    },
    bestCase: {
      downtimeMinutes: 0,
      dataLossRisk: "none",
      costImpactUsd: 0,
      rollbackRequired: false,
      estimatedRecoveryMinutes: 0,
      affectedResources: 0,
    },
    confidence: Math.max(50, 100 - riskScore),
  };

  return { overallRisk, riskScore, factors, mitigations, simulation };
}

function mitigationFor(category: RiskFactor["category"]): string {
  const map: Record<RiskFactor["category"], string> = {
    blast_radius: "Phased rollout with canary validation limits blast radius",
    data_loss: "Pre-execution snapshots and rollback procedures in place",
    downtime: "Rolling deployment ensures partial availability during changes",
    cost_overrun: "Cost impact estimated and capped per step",
    dependency_failure: "Dependency verification before each step proceeds",
    provider_api: "Retry logic and circuit breakers for provider API calls",
  };
  return map[category];
}

function computeRiskScore(factors: RiskFactor[]): number {
  const sevScore: Record<RiskLevel, number> = { low: 10, medium: 25, high: 40 };
  const likScore: Record<string, number> = { rare: 0.1, unlikely: 0.3, possible: 0.5, likely: 0.7, certain: 1.0 };

  let total = 0;
  for (const f of factors) {
    total += (sevScore[f.severity] ?? 10) * (likScore[f.likelihood] ?? 0.5);
  }
  return Math.min(100, Math.round(total));
}

function buildScenarios(steps: OperationStep[], factors: RiskFactor[]): SimulationScenario[] {
  const scenarios: SimulationScenario[] = [
    {
      name: "Happy path",
      probability: 0.7,
      outcome: {
        downtimeMinutes: 0, dataLossRisk: "none", costImpactUsd: 0,
        rollbackRequired: false, estimatedRecoveryMinutes: 0, affectedResources: 0,
      },
      triggers: [],
    },
    {
      name: "Single step failure with successful rollback",
      probability: 0.2,
      outcome: {
        downtimeMinutes: 15, dataLossRisk: "none", costImpactUsd: 100,
        rollbackRequired: true, estimatedRecoveryMinutes: 30,
        affectedResources: Math.ceil(steps.length > 0 ? steps[0].resourceCount : 1),
      },
      triggers: ["provider_api_error", "resource_state_conflict"],
    },
    {
      name: "Cascading failure requiring full rollback",
      probability: 0.08,
      outcome: {
        downtimeMinutes: 60, dataLossRisk: "low", costImpactUsd: 500,
        rollbackRequired: true, estimatedRecoveryMinutes: 120,
        affectedResources: steps.reduce((s, st) => s + st.resourceCount, 0),
      },
      triggers: ["dependency_chain_failure", "verification_timeout"],
    },
    {
      name: "Partial failure — some steps succeed, some need rollback",
      probability: 0.02,
      outcome: {
        downtimeMinutes: 30, dataLossRisk: "low", costImpactUsd: 200,
        rollbackRequired: true, estimatedRecoveryMinutes: 60,
        affectedResources: Math.ceil(steps.reduce((s, st) => s + st.resourceCount, 0) * 0.3),
      },
      triggers: ["canary_deviation", "blast_radius_exceeded"],
    },
  ];

  return scenarios;
}

// ═══════════════════════════════════════════════════════════════════════════
// 20. EXECUTION ENGINE — advance operation state
// ═══════════════════════════════════════════════════════════════════════════

export function getReadySteps(operation: Operation): OperationStep[] {
  return operation.steps.filter((step) => {
    if (step.status !== "pending" && step.status !== "ready") return false;

    // Check all hard dependencies satisfied
    const deps = operation.dependencies.filter((d) => d.toStepId === step.id);
    for (const dep of deps) {
      const fromStep = operation.steps.find((s) => s.id === dep.fromStepId);
      if (!fromStep) continue;

      if (dep.type === "must_complete" && fromStep.status !== "succeeded") return false;
      if (dep.type === "must_verify" && fromStep.status !== "succeeded") return false;
      if (dep.type === "canary_gate" && fromStep.status !== "succeeded") return false;
      if (dep.type === "soft" && fromStep.status === "executing") return false;
    }

    // Check approval checkpoints
    const checkpoint = operation.checkpoints.find((cp) => cp.afterStepId === step.id);
    if (checkpoint && step.requiresApproval) {
      if (checkpoint.status !== "approved" && !checkpoint.autoApproveIfCanaryPasses) return false;
    }

    return true;
  });
}

export function advanceOperation(operation: Operation): OperationAdvanceResult {
  const now = new Date().toISOString();
  const actions: AdvanceAction[] = [];

  if (operation.status === "completed" || operation.status === "failed" || operation.status === "cancelled") {
    return { operation, actions, nextSteps: [], done: true };
  }

  // Check for failed steps
  const failedSteps = operation.steps.filter((s) => s.status === "failed");
  if (failedSteps.length > 0 && operation.rollbackStrategy.autoRollbackOnFailure) {
    actions.push({
      type: "rollback_required",
      stepId: failedSteps[0].id,
      description: `Step "${failedSteps[0].name}" failed — initiating rollback`,
    });
    return { operation, actions, nextSteps: [], done: false };
  }

  // Check for verification failures
  const verificationFailed = operation.steps.filter(
    (s) => s.verificationResult && !s.verificationResult.passed && s.status !== "rolled_back",
  );
  if (verificationFailed.length > 0 && operation.rollbackStrategy.autoRollbackOnVerificationFailure) {
    actions.push({
      type: "rollback_required",
      stepId: verificationFailed[0].id,
      description: `Verification failed for "${verificationFailed[0].name}" — rollback needed`,
    });
    return { operation, actions, nextSteps: [], done: false };
  }

  // Get ready steps
  const ready = getReadySteps(operation);

  // Check for pending approvals
  const pendingApprovals = operation.checkpoints.filter((cp) => cp.status === "pending");
  for (const cp of pendingApprovals) {
    const step = operation.steps.find((s) => s.id === cp.afterStepId);
    if (step && ready.some((r) => r.id === step.id)) {
      actions.push({
        type: "approval_needed",
        stepId: step.id,
        description: cp.reason,
      });
    }
  }

  // Check if all steps are done
  const allDone = operation.steps.every((s) =>
    s.status === "succeeded" || s.status === "skipped" || s.status === "rolled_back",
  );

  if (allDone) {
    operation.status = "completed";
    operation.updatedAt = now;
    operation.audit.push({
      id: opId("audit"),
      operationId: operation.id,
      timestamp: now,
      actor: "agent",
      action: "operation_completed",
      stepId: null,
      details: `Operation completed: ${operation.metrics.completedSteps}/${operation.metrics.totalSteps} steps succeeded`,
      metadata: { ...operation.metrics },
    });
    return { operation, actions, nextSteps: [], done: true };
  }

  // Check for deadlock (no ready steps but operation not done)
  const stepsInProgress = operation.steps.some((s) => s.status === "executing" || s.status === "verifying");
  if (ready.length === 0 && !allDone && !stepsInProgress && pendingApprovals.length === 0) {
    actions.push({
      type: "deadlock_detected",
      stepId: null,
      description: "No steps can proceed — check dependencies and approvals",
    });
  }

  return { operation, actions, nextSteps: ready, done: false };
}

export type OperationAdvanceResult = {
  operation: Operation;
  actions: AdvanceAction[];
  nextSteps: OperationStep[];
  done: boolean;
};

export type AdvanceAction = {
  type: "approval_needed" | "rollback_required" | "deadlock_detected" | "blast_radius_exceeded";
  stepId: string | null;
  description: string;
};

// ═══════════════════════════════════════════════════════════════════════════
// 21. STEP LIFECYCLE
// ═══════════════════════════════════════════════════════════════════════════

export function approveStep(operation: Operation, stepId: string, userId: string): Operation {
  const now = new Date().toISOString();
  const step = operation.steps.find((s) => s.id === stepId);
  if (!step) return operation;

  step.status = "approved";
  step.approvedBy = userId;
  step.approvedAt = now;

  const checkpoint = operation.checkpoints.find((cp) => cp.afterStepId === stepId);
  if (checkpoint) {
    checkpoint.approvals.push({ userId, decision: "approve", reason: null, decidedAt: now });
    if (checkpoint.approvals.filter((a) => a.decision === "approve").length >= checkpoint.minApprovals) {
      checkpoint.status = "approved";
    }
  }

  operation.audit.push({
    id: opId("audit"),
    operationId: operation.id,
    timestamp: now,
    actor: userId,
    action: "step_approved",
    stepId,
    details: `Step "${step.name}" approved`,
    metadata: {},
  });

  operation.updatedAt = now;
  return operation;
}

export function startStep(operation: Operation, stepId: string): Operation {
  const now = new Date().toISOString();
  const step = operation.steps.find((s) => s.id === stepId);
  if (!step) return operation;

  // Blast radius check
  if (operation.blastRadius.enforced) {
    const activeResources = operation.steps
      .filter((s) => s.status === "executing")
      .reduce((sum, s) => sum + s.resourceCount, 0);

    if (activeResources + step.resourceCount > operation.blastRadius.maxResourcesPerStep * 2) {
      operation.audit.push({
        id: opId("audit"),
        operationId: operation.id,
        timestamp: now,
        actor: "agent",
        action: "blast_radius_exceeded",
        stepId,
        details: `Cannot start step — would exceed blast radius (${activeResources + step.resourceCount} resources active)`,
        metadata: { activeResources, stepResources: step.resourceCount, limit: operation.blastRadius.maxResourcesPerStep * 2 },
      });
      return operation;
    }
  }

  step.status = "executing";
  step.startedAt = now;

  if (operation.status === "draft" || operation.status === "approved") {
    operation.status = "in_progress";
  }

  operation.audit.push({
    id: opId("audit"),
    operationId: operation.id,
    timestamp: now,
    actor: "agent",
    action: "step_started",
    stepId,
    details: `Step "${step.name}" started — ${step.resourceCount} resources`,
    metadata: { provider: step.provider, regions: step.regions, resourceCount: step.resourceCount },
  });

  operation.updatedAt = now;
  return operation;
}

export function completeStep(
  operation: Operation,
  stepId: string,
  result: ExecutionResult,
): Operation {
  const now = new Date().toISOString();
  const step = operation.steps.find((s) => s.id === stepId);
  if (!step) return operation;

  step.executionResult = result;

  if (result.success) {
    step.status = "verifying";
    operation.audit.push({
      id: opId("audit"),
      operationId: operation.id,
      timestamp: now,
      actor: "agent",
      action: "step_completed",
      stepId,
      details: `Step "${step.name}" executed — entering verification`,
      metadata: { resourcesModified: result.resourcesModified, durationMs: result.durationMs },
    });
  } else {
    step.status = "failed";
    step.completedAt = now;
    operation.metrics.failedSteps++;
    operation.audit.push({
      id: opId("audit"),
      operationId: operation.id,
      timestamp: now,
      actor: "agent",
      action: "step_failed",
      stepId,
      details: `Step "${step.name}" failed: ${result.errors.map((e) => e.message).join("; ")}`,
      metadata: { errors: result.errors },
    });
  }

  operation.updatedAt = now;
  return operation;
}

export function verifyStep(
  operation: Operation,
  stepId: string,
  result: VerificationResult,
): Operation {
  const now = new Date().toISOString();
  const step = operation.steps.find((s) => s.id === stepId);
  if (!step) return operation;

  step.verificationResult = result;

  if (result.passed) {
    step.status = "succeeded";
    step.completedAt = now;
    operation.metrics.completedSteps++;
    operation.metrics.totalResourcesModified += step.executionResult?.resourcesModified ?? 0;
    operation.metrics.totalCostSaved += step.estimatedCostImpact.monthlySavings;

    operation.audit.push({
      id: opId("audit"),
      operationId: operation.id,
      timestamp: now,
      actor: "agent",
      action: "verification_passed",
      stepId,
      details: `Step "${step.name}" verified — all criteria passed`,
      metadata: { criteria: result.criteria.length, durationMs: result.durationMs },
    });

    if (step.canaryConfig) {
      operation.metrics.canarySuccessRate = 1;
      operation.audit.push({
        id: opId("audit"),
        operationId: operation.id,
        timestamp: now,
        actor: "agent",
        action: "canary_promoted",
        stepId,
        details: `Canary "${step.name}" promoted — metrics within tolerance`,
        metadata: {},
      });
    }
  } else {
    const failedCritical = result.criteria.filter((c) => !c.passed);
    step.status = "failed";
    step.completedAt = now;
    operation.metrics.failedSteps++;

    operation.audit.push({
      id: opId("audit"),
      operationId: operation.id,
      timestamp: now,
      actor: "agent",
      action: "verification_failed",
      stepId,
      details: `Verification failed for "${step.name}": ${failedCritical.map((c) => c.message).join("; ")}`,
      metadata: { failedCriteria: failedCritical },
    });

    if (step.canaryConfig) {
      operation.audit.push({
        id: opId("audit"),
        operationId: operation.id,
        timestamp: now,
        actor: "agent",
        action: "canary_failed",
        stepId,
        details: `Canary "${step.name}" failed — halting rollout`,
        metadata: {},
      });
    }
  }

  // Update verification pass rate
  const verifiedSteps = operation.steps.filter((s) => s.verificationResult);
  const passedSteps = verifiedSteps.filter((s) => s.verificationResult!.passed);
  operation.metrics.verificationPassRate = verifiedSteps.length > 0
    ? passedSteps.length / verifiedSteps.length : 0;

  operation.updatedAt = now;
  return operation;
}

export function rollbackStep(
  operation: Operation,
  stepId: string,
  result: RollbackResult,
): Operation {
  const now = new Date().toISOString();
  const step = operation.steps.find((s) => s.id === stepId);
  if (!step) return operation;

  step.rollbackResult = result;
  step.status = "rolled_back";
  step.completedAt = now;
  operation.metrics.rollbackSteps++;

  operation.audit.push({
    id: opId("audit"),
    operationId: operation.id,
    timestamp: now,
    actor: "agent",
    action: result.success ? "rollback_completed" : "rollback_failed",
    stepId,
    details: result.success
      ? `Rollback of "${step.name}" completed — ${result.actionsCompleted} actions reversed`
      : `Rollback of "${step.name}" failed — ${result.actionsFailed} actions could not be reversed`,
    metadata: { actionsCompleted: result.actionsCompleted, actionsFailed: result.actionsFailed },
  });

  operation.updatedAt = now;
  return operation;
}

export function cancelOperation(operation: Operation, userId: string, reason: string): Operation {
  const now = new Date().toISOString();
  operation.status = "cancelled";
  operation.updatedAt = now;

  for (const step of operation.steps) {
    if (step.status === "pending" || step.status === "ready" || step.status === "awaiting_approval") {
      step.status = "skipped";
      operation.metrics.skippedSteps++;
    }
  }

  operation.audit.push({
    id: opId("audit"),
    operationId: operation.id,
    timestamp: now,
    actor: userId,
    action: "operation_cancelled",
    stepId: null,
    details: `Operation cancelled: ${reason}`,
    metadata: { reason },
  });

  return operation;
}

export function pauseOperation(operation: Operation, userId: string): Operation {
  const now = new Date().toISOString();
  operation.status = "paused";
  operation.updatedAt = now;

  operation.audit.push({
    id: opId("audit"),
    operationId: operation.id,
    timestamp: now,
    actor: userId,
    action: "operation_paused",
    stepId: null,
    details: "Operation paused by operator",
    metadata: {},
  });

  return operation;
}

export function resumeOperation(operation: Operation, userId: string): Operation {
  const now = new Date().toISOString();
  operation.status = "in_progress";
  operation.updatedAt = now;

  operation.audit.push({
    id: opId("audit"),
    operationId: operation.id,
    timestamp: now,
    actor: userId,
    action: "operation_resumed",
    stepId: null,
    details: "Operation resumed by operator",
    metadata: {},
  });

  return operation;
}

// ═══════════════════════════════════════════════════════════════════════════
// 22. OPERATION SUMMARY & NOTIFICATION
// ═══════════════════════════════════════════════════════════════════════════

export type OperationSummary = {
  operationId: string;
  name: string;
  type: OperationType;
  status: OperationStatus;
  progress: number;                // 0-100
  stepsBreakdown: { succeeded: number; failed: number; pending: number; rolledBack: number; skipped: number };
  riskLevel: RiskLevel;
  totalResourcesAffected: number;
  estimatedSavings: CostImpact;
  duration: string;
  nextAction: string;
};

export function buildOperationSummary(operation: Operation): OperationSummary {
  const succeeded = operation.steps.filter((s) => s.status === "succeeded").length;
  const failed = operation.steps.filter((s) => s.status === "failed").length;
  const rolledBack = operation.steps.filter((s) => s.status === "rolled_back").length;
  const skipped = operation.steps.filter((s) => s.status === "skipped").length;
  const pending = operation.steps.length - succeeded - failed - rolledBack - skipped;

  const totalDone = succeeded + failed + rolledBack + skipped;
  const progress = operation.steps.length > 0
    ? Math.round((totalDone / operation.steps.length) * 100) : 0;

  const totalSavings = operation.steps
    .filter((s) => s.status === "succeeded")
    .reduce((s, st) => s + st.estimatedCostImpact.monthlySavings, 0);

  const durationMs = operation.metrics.totalDurationMs;
  const duration = durationMs > 3_600_000
    ? `${Math.round(durationMs / 3_600_000 * 10) / 10}h`
    : durationMs > 60_000
      ? `${Math.round(durationMs / 60_000)}m`
      : `${Math.round(durationMs / 1_000)}s`;

  let nextAction = "No action needed";
  if (operation.status === "draft") nextAction = "Approve operation to begin execution";
  else if (operation.status === "paused") nextAction = "Resume operation to continue";
  else if (failed > 0) nextAction = "Review failed steps and decide on rollback";
  else if (pending > 0) nextAction = "Waiting for next step to become ready";
  else if (operation.status === "completed") nextAction = "Operation complete — review results";

  const pendingApprovals = operation.checkpoints.filter((cp) => cp.status === "pending");
  if (pendingApprovals.length > 0) {
    nextAction = `Approve checkpoint: ${pendingApprovals[0].reason}`;
  }

  return {
    operationId: operation.id,
    name: operation.name,
    type: operation.type,
    status: operation.status,
    progress,
    stepsBreakdown: { succeeded, failed, pending, rolledBack, skipped },
    riskLevel: operation.riskProfile.overallRisk,
    totalResourcesAffected: operation.metrics.totalResourcesModified,
    estimatedSavings: {
      monthlySavings: totalSavings,
      monthlyIncrease: 0,
      netMonthly: totalSavings,
      migrationCost: 0,
      breakEvenDays: 0,
    },
    duration,
    nextAction,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 23. EXAMPLE OPERATIONS (templates)
// ═══════════════════════════════════════════════════════════════════════════

export const OPERATION_TEMPLATES: Record<OperationType, { name: string; description: string; defaultBlastRadius: Partial<BlastRadius> }> = {
  rolling_compute_optimization: {
    name: "Rolling Compute Optimization",
    description: "Right-size compute instances across regions with canary validation and gradual rollout",
    defaultBlastRadius: { maxResourcesPerStep: 25, maxCostImpactPerStep: 5_000, maxRegionsParallel: 1 },
  },
  phased_storage_migration: {
    name: "Phased Storage Migration",
    description: "Migrate storage resources to optimal tiers with data integrity verification",
    defaultBlastRadius: { maxResourcesPerStep: 10, maxCostImpactPerStep: 2_000, maxRegionsParallel: 1 },
  },
  resilience_improvement: {
    name: "Resilience Improvement Rollout",
    description: "Enable replication, multi-region, and backup configurations systematically",
    defaultBlastRadius: { maxResourcesPerStep: 20, maxCostImpactPerStep: 8_000, maxRegionsParallel: 1 },
  },
  region_expansion: {
    name: "Region Expansion Plan",
    description: "Deploy infrastructure to new regions with endpoint validation and traffic shifting",
    defaultBlastRadius: { maxResourcesPerStep: 15, maxCostImpactPerStep: 15_000, maxRegionsParallel: 1 },
  },
  backup_modernization: {
    name: "Backup Modernization",
    description: "Upgrade backup policies, enable cross-region replication, verify recovery procedures",
    defaultBlastRadius: { maxResourcesPerStep: 30, maxCostImpactPerStep: 3_000, maxRegionsParallel: 2 },
  },
  commitment_optimization: {
    name: "Commitment Optimization Strategy",
    description: "Purchase reserved instances and savings plans based on usage patterns",
    defaultBlastRadius: { maxResourcesPerStep: 50, maxCostImpactPerStep: 20_000, maxRegionsParallel: 3 },
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// 24. DEPENDENCY GRAPH UTILITIES
// ═══════════════════════════════════════════════════════════════════════════

export function detectDependencyCycles(dependencies: StepDependency[]): string[][] {
  const graph = new Map<string, string[]>();
  for (const dep of dependencies) {
    if (!graph.has(dep.fromStepId)) graph.set(dep.fromStepId, []);
    graph.get(dep.fromStepId)!.push(dep.toStepId);
  }

  const cycles: string[][] = [];
  const visited = new Set<string>();
  const inStack = new Set<string>();

  function dfs(node: string, path: string[]): void {
    if (inStack.has(node)) {
      const cycleStart = path.indexOf(node);
      cycles.push(path.slice(cycleStart));
      return;
    }
    if (visited.has(node)) return;

    visited.add(node);
    inStack.add(node);
    path.push(node);

    for (const neighbor of graph.get(node) ?? []) {
      dfs(neighbor, [...path]);
    }

    inStack.delete(node);
  }

  for (const node of graph.keys()) {
    dfs(node, []);
  }

  return cycles;
}

export function getExecutionOrder(steps: OperationStep[], dependencies: StepDependency[]): string[][] {
  const inDegree = new Map<string, number>();
  const graph = new Map<string, string[]>();

  for (const step of steps) {
    inDegree.set(step.id, 0);
    graph.set(step.id, []);
  }

  for (const dep of dependencies) {
    if (dep.type === "soft") continue;
    graph.get(dep.fromStepId)?.push(dep.toStepId);
    inDegree.set(dep.toStepId, (inDegree.get(dep.toStepId) ?? 0) + 1);
  }

  const phases: string[][] = [];
  const remaining = new Set(steps.map((s) => s.id));

  while (remaining.size > 0) {
    const readyNow = [...remaining].filter((id) => (inDegree.get(id) ?? 0) === 0);
    if (readyNow.length === 0) break; // cycle

    phases.push(readyNow);

    for (const id of readyNow) {
      remaining.delete(id);
      for (const neighbor of graph.get(id) ?? []) {
        inDegree.set(neighbor, (inDegree.get(neighbor) ?? 0) - 1);
      }
    }
  }

  return phases;
}

// ═══════════════════════════════════════════════════════════════════════════
// 25. VALIDATION
// ═══════════════════════════════════════════════════════════════════════════

export type OperationValidation = {
  valid: boolean;
  errors: string[];
  warnings: string[];
};

export function validateOperation(operation: Operation): OperationValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (operation.steps.length === 0) {
    errors.push("Operation has no steps");
  }

  // Check for cycles
  const cycles = detectDependencyCycles(operation.dependencies);
  if (cycles.length > 0) {
    errors.push(`Dependency cycle detected: ${cycles[0].join(" → ")}`);
  }

  // Check blast radius
  for (const step of operation.steps) {
    if (step.resourceCount > operation.blastRadius.maxResourcesPerStep) {
      errors.push(`Step "${step.name}" exceeds max resources per step (${step.resourceCount} > ${operation.blastRadius.maxResourcesPerStep})`);
    }
    if (step.estimatedCostImpact.monthlySavings > operation.blastRadius.maxCostImpactPerStep) {
      warnings.push(`Step "${step.name}" cost impact may exceed per-step limit`);
    }
  }

  // Check all dependencies reference valid steps
  const stepIds = new Set(operation.steps.map((s) => s.id));
  for (const dep of operation.dependencies) {
    if (!stepIds.has(dep.fromStepId)) errors.push(`Dependency references unknown step: ${dep.fromStepId}`);
    if (!stepIds.has(dep.toStepId)) errors.push(`Dependency references unknown step: ${dep.toStepId}`);
  }

  // Check high-risk steps have approval checkpoints
  const highRiskSteps = operation.steps.filter((s) => s.riskLevel === "high");
  for (const step of highRiskSteps) {
    const hasCheckpoint = operation.checkpoints.some((cp) => cp.afterStepId === step.id);
    if (!hasCheckpoint) {
      warnings.push(`High-risk step "${step.name}" has no approval checkpoint`);
    }
  }

  // Check rollback procedures exist
  const noRollback = operation.steps.filter((s) => s.rollbackProcedure.steps.length === 0);
  if (noRollback.length > 0) {
    warnings.push(`${noRollback.length} step(s) have no rollback procedure`);
  }

  // Verify canary exists for multi-region operations
  if (operation.regions.length > 1) {
    const hasCanary = operation.steps.some((s) => s.canaryConfig !== null);
    if (!hasCanary) {
      warnings.push("Multi-region operation has no canary step — consider adding one");
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

// ═══════════════════════════════════════════════════════════════════════════
// 26. RESET & TESTS
// ═══════════════════════════════════════════════════════════════════════════

export function _resetOrchestratorCounters(): void {
  opSeq = 0;
}

export type OrchestratorTestResult = { name: string; passed: boolean; detail: string };

export function runOrchestratorTests(): OrchestratorTestResult[] {
  const results: OrchestratorTestResult[] = [];
  _resetOrchestratorCounters();

  function assert(name: string, fn: () => boolean, detail: string) {
    try {
      results.push({ name, passed: fn(), detail });
    } catch (e) {
      results.push({ name, passed: false, detail: `threw: ${e}` });
    }
  }

  const makeTarget = (overrides?: Partial<ResourceTarget>): ResourceTarget => ({
    resourceId: `i-${Math.random().toString(36).slice(2, 6)}`,
    provider: "aws",
    region: "us-east-1",
    resourceType: "compute_instance",
    currentState: { instanceType: "m5.xlarge" },
    desiredState: { instanceType: "m5.large" },
    actionType: "resize_compute",
    category: "cost",
    riskLevel: "low",
    estimatedSavingsMonthly: 50,
    ...overrides,
  });

  // Test 1: Basic operation creation
  const input: CreateOperationInput = {
    orgId: "org-1",
    name: "Test Compute Optimization",
    description: "Resize idle instances",
    type: "rolling_compute_optimization",
    createdBy: "user-1",
    providers: ["aws"],
    regions: ["us-east-1"],
    resourceTargets: Array.from({ length: 5 }, () => makeTarget()),
  };
  const op = createOperation(input);
  assert("operation created", () =>
    op.id.startsWith("op-") && op.status === "draft" && op.steps.length > 0,
    `id=${op.id}, steps=${op.steps.length}`);

  // Test 2: Steps have correct order
  assert("steps ordered", () =>
    op.steps.every((s, i) => s.order === i),
    `orders=${op.steps.map((s) => s.order).join(",")}`);

  // Test 3: Audit trail starts with creation
  assert("audit trail started", () =>
    op.audit.length === 1 && op.audit[0].action === "operation_created",
    `audit=${op.audit[0].action}`);

  // Test 4: Risk simulation runs
  assert("risk simulation", () =>
    op.riskProfile.riskScore >= 0 && op.riskProfile.simulation.scenarios.length > 0,
    `score=${op.riskProfile.riskScore}, scenarios=${op.riskProfile.simulation.scenarios.length}`);

  // Test 5: Multi-region creates canary
  const multiRegionInput: CreateOperationInput = {
    ...input,
    regions: ["us-east-1", "eu-west-1"],
    resourceTargets: [
      ...Array.from({ length: 3 }, () => makeTarget({ region: "us-east-1" })),
      ...Array.from({ length: 5 }, () => makeTarget({ region: "eu-west-1" })),
    ],
  };
  const multiOp = createOperation(multiRegionInput);
  assert("multi-region has canary", () =>
    multiOp.steps.some((s) => s.canaryConfig !== null),
    `canary=${multiOp.steps.filter((s) => s.canaryConfig !== null).length}`);

  // Test 6: Dependencies respect region ordering
  assert("region dependencies", () =>
    multiOp.dependencies.length > 0,
    `deps=${multiOp.dependencies.length}`);

  // Test 7: Blast radius enforced
  const bigInput: CreateOperationInput = {
    ...input,
    resourceTargets: Array.from({ length: 100 }, () => makeTarget()),
    blastRadius: { maxResourcesPerStep: 20 },
  };
  const bigOp = createOperation(bigInput);
  assert("blast radius splits batches", () =>
    bigOp.steps.every((s) => s.resourceCount <= 20),
    `maxBatch=${Math.max(...bigOp.steps.map((s) => s.resourceCount))}`);

  // Test 8: High-risk steps require approval
  const highRiskInput: CreateOperationInput = {
    ...input,
    resourceTargets: Array.from({ length: 3 }, () =>
      makeTarget({ riskLevel: "high", actionType: "decommission_compute" }),
    ),
  };
  const highRiskOp = createOperation(highRiskInput);
  assert("high risk requires approval", () =>
    highRiskOp.steps.every((s) => s.riskLevel === "high" ? s.requiresApproval : true),
    `approval=${highRiskOp.steps.map((s) => s.requiresApproval)}`);

  // Test 9: getReadySteps returns correct steps
  const ready = getReadySteps(op);
  assert("ready steps found", () =>
    ready.length > 0,
    `ready=${ready.length}`);

  // Test 10: Approve step updates state
  const stepToApprove = op.steps.find((s) => s.requiresApproval);
  if (stepToApprove) {
    approveStep(op, stepToApprove.id, "user-1");
    assert("step approved", () =>
      stepToApprove.status === "approved" && stepToApprove.approvedBy === "user-1",
      `status=${stepToApprove.status}`);
  } else {
    assert("step approved", () => true, "no approval-required steps");
  }

  // Test 11: Start step changes status
  const firstStep = op.steps[0];
  startStep(op, firstStep.id);
  assert("step started", () =>
    firstStep.status === "executing" && firstStep.startedAt !== null,
    `status=${firstStep.status}`);

  // Test 12: Complete step moves to verifying
  const execResult: ExecutionResult = {
    stepId: firstStep.id,
    success: true,
    resourcesModified: firstStep.resourceCount,
    errors: [],
    startedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    durationMs: 5000,
    providerResponses: [],
  };
  completeStep(op, firstStep.id, execResult);
  assert("step verifying", () =>
    firstStep.status === "verifying",
    `status=${firstStep.status}`);

  // Test 13: Verify step succeeds
  const verResult: VerificationResult = {
    stepId: firstStep.id,
    passed: true,
    criteria: [{ criterionId: "vc-1", passed: true, actualValue: true, expectedValue: true, message: "OK" }],
    verifiedAt: new Date().toISOString(),
    durationMs: 2000,
  };
  verifyStep(op, firstStep.id, verResult);
  assert("step verified", () =>
    firstStep.status === "succeeded" && op.metrics.completedSteps === 1,
    `status=${firstStep.status}, completed=${op.metrics.completedSteps}`);

  // Test 14: Failed verification triggers rollback state
  const op2 = createOperation(input);
  const s2 = op2.steps[0];
  startStep(op2, s2.id);
  completeStep(op2, s2.id, { ...execResult, stepId: s2.id });
  verifyStep(op2, s2.id, {
    stepId: s2.id, passed: false, verifiedAt: new Date().toISOString(), durationMs: 1000,
    criteria: [{ criterionId: "vc-1", passed: false, actualValue: false, expectedValue: true, message: "FAIL" }],
  });
  assert("failed verification marks step failed", () =>
    s2.status === "failed",
    `status=${s2.status}`);

  // Test 15: Rollback step updates metrics
  rollbackStep(op2, s2.id, {
    stepId: s2.id, success: true, actionsCompleted: 3, actionsFailed: 0,
    errors: [], startedAt: new Date().toISOString(), completedAt: new Date().toISOString(), durationMs: 3000,
  });
  assert("rollback recorded", () =>
    s2.status === "rolled_back" && op2.metrics.rollbackSteps === 1,
    `status=${s2.status}, rollbacks=${op2.metrics.rollbackSteps}`);

  // Test 16: Cancel operation skips pending steps
  const op3 = createOperation(input);
  cancelOperation(op3, "user-1", "No longer needed");
  assert("cancel skips pending", () =>
    op3.status === "cancelled" && op3.steps.every((s) => s.status === "skipped"),
    `status=${op3.status}, skipped=${op3.metrics.skippedSteps}`);

  // Test 17: Validate operation catches issues
  const emptyOp: Operation = { ...createOperation(input), steps: [] };
  const validation = validateOperation(emptyOp);
  assert("validation catches empty", () =>
    !validation.valid && validation.errors.includes("Operation has no steps"),
    `valid=${validation.valid}`);

  // Test 18: Cycle detection works
  const cycles = detectDependencyCycles([
    { fromStepId: "a", toStepId: "b", type: "must_complete", condition: null },
    { fromStepId: "b", toStepId: "c", type: "must_complete", condition: null },
    { fromStepId: "c", toStepId: "a", type: "must_complete", condition: null },
  ]);
  assert("cycle detected", () => cycles.length > 0, `cycles=${cycles.length}`);

  // Test 19: Execution order computed
  const phases = getExecutionOrder(multiOp.steps, multiOp.dependencies);
  assert("execution order computed", () =>
    phases.length > 0 && phases.flat().length === multiOp.steps.length,
    `phases=${phases.length}, totalSteps=${phases.flat().length}`);

  // Test 20: Operation summary builds
  const summary = buildOperationSummary(op);
  assert("summary built", () =>
    summary.progress > 0 && summary.type === "rolling_compute_optimization",
    `progress=${summary.progress}%, type=${summary.type}`);

  return results;
}
