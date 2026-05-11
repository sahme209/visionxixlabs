// ─────────────────────────────────────────────────────────────────────────────
// Operational Simulation Engine
// Pre-execution impact simulation for Axiom Agent
// ─────────────────────────────────────────────────────────────────────────────

// ═══════════════════════════════════════════════════════════════════════════════
// §1 — Simulation Engine Core
// ═══════════════════════════════════════════════════════════════════════════════

export type SimulationMode = "conservative" | "balanced" | "optimistic";

export type SimulationStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled"
  | "expired";

export interface SimulationRequest {
  id: string;
  orgId: string;
  requestedAt: string;
  requestedBy: "agent" | "human";
  mode: SimulationMode;
  executionPlanId: string;
  targetResources: SimulationTarget[];
  simulationTypes: SimulationType[];
  constraints: SimulationConstraints;
  context: SimulationContext;
}

export type SimulationType =
  | "rollout_risk"
  | "downtime_likelihood"
  | "rollback_complexity"
  | "region_failure"
  | "resilience_improvement"
  | "cost_savings"
  | "dependency_conflict"
  | "scaling_behavior"
  | "replication_change";

export interface SimulationTarget {
  resourceId: string;
  resourceType: string;
  provider: "aws" | "azure" | "gcp";
  region: string;
  currentState: Record<string, unknown>;
  proposedState: Record<string, unknown>;
  action: string;
}

export interface SimulationConstraints {
  maxDowntimeToleranceMinutes: number;
  maxCostImpactUsd: number;
  maxBlastRadius: number;
  requireRollbackPlan: boolean;
  maintenanceWindowOnly: boolean;
  excludeRegions: string[];
  excludeResourceTypes: string[];
  freezePeriods: { start: string; end: string; reason: string }[];
}

export interface SimulationContext {
  currentTopology: TopologyReference;
  activeWorkloads: string[];
  recentIncidents: RecentIncidentRef[];
  approvalHistory: ApprovalPatternRef[];
  currentUtilization: UtilizationRef;
  timeOfDay: string;
  dayOfWeek: number;
  isMaintenanceWindow: boolean;
}

export interface TopologyReference {
  totalNodes: number;
  totalEdges: number;
  singlePointsOfFailure: string[];
  crossRegionDependencies: number;
}

export interface RecentIncidentRef {
  id: string;
  category: string;
  severity: string;
  resourceIds: string[];
  occurredAt: string;
  resolvedAt: string | null;
  relatedToProposedChanges: boolean;
}

export interface ApprovalPatternRef {
  actionType: string;
  domain: string;
  approvedCount: number;
  deniedCount: number;
  avgApprovalTimeMinutes: number;
}

export interface UtilizationRef {
  avgCpuPct: number;
  avgMemoryPct: number;
  peakCpuPct: number;
  peakMemoryPct: number;
  isCurrentlyPeak: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// §2 — Simulation Result Envelope
// ═══════════════════════════════════════════════════════════════════════════════

export interface OperationalSimulationResult {
  id: string;
  requestId: string;
  status: SimulationStatus;
  startedAt: string;
  completedAt: string | null;
  mode: SimulationMode;
  compositeRisk: CompositeRiskScore;
  verdict: SimulationVerdict;
  rolloutRisk: RolloutRiskResult | null;
  downtimeLikelihood: DowntimeLikelihoodResult | null;
  rollbackComplexity: RollbackComplexityResult | null;
  regionFailure: RegionFailureResult | null;
  resilienceImprovement: ResilienceImprovementResult | null;
  costSavings: CostSavingsResult | null;
  dependencyConflict: DependencyConflictResult | null;
  scalingBehavior: ScalingBehaviorResult | null;
  replicationChange: ReplicationChangeResult | null;
  explanations: SimulationExplanation[];
  warnings: SimulationWarning[];
  quality: SimulationQualityAssessment;
}

export type SimulationVerdict =
  | "safe_to_proceed"
  | "proceed_with_caution"
  | "requires_review"
  | "high_risk"
  | "do_not_proceed";

export interface SimulationExplanation {
  simulationType: SimulationType;
  summary: string;
  reasoning: string;
  evidence: SimulationEvidenceItem[];
  confidence: number;
  assumptions: string[];
  limitations: string[];
}

export interface SimulationEvidenceItem {
  type: "metric" | "configuration" | "historical" | "topology" | "calculation";
  description: string;
  value: string;
  source: string;
}

export interface SimulationWarning {
  severity: "info" | "caution" | "warning" | "critical";
  message: string;
  simulationType: SimulationType;
  affectedResources: string[];
  mitigationAvailable: boolean;
  mitigation: string | null;
}

export interface SimulationQualityAssessment {
  overallConfidence: number;
  dataCompleteness: number;
  topologyAvailable: boolean;
  historicalDataPoints: number;
  degradedSimulations: SimulationType[];
  missingInputs: string[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// §3 — Composite Risk Scoring System
// ═══════════════════════════════════════════════════════════════════════════════

export interface CompositeRiskScore {
  overall: number;
  category: "minimal" | "low" | "moderate" | "elevated" | "high" | "critical";
  components: RiskComponent[];
  dominantRisk: SimulationType;
  mitigatedScore: number | null;
  mitigationActions: string[];
}

export interface RiskComponent {
  simulationType: SimulationType;
  rawScore: number;
  weight: number;
  weightedScore: number;
  confidence: number;
  adjustmentFactors: RiskAdjustment[];
}

export interface RiskAdjustment {
  factor: string;
  direction: "increase" | "decrease";
  magnitude: number;
  reason: string;
}

export const RISK_WEIGHTS: Record<SimulationType, number> = {
  rollout_risk: 0.20,
  downtime_likelihood: 0.20,
  rollback_complexity: 0.15,
  region_failure: 0.10,
  resilience_improvement: 0.05,
  cost_savings: 0.05,
  dependency_conflict: 0.15,
  scaling_behavior: 0.05,
  replication_change: 0.05,
};

export const RISK_THRESHOLDS = {
  minimal: { min: 0, max: 15 },
  low: { min: 15, max: 30 },
  moderate: { min: 30, max: 50 },
  elevated: { min: 50, max: 70 },
  high: { min: 70, max: 85 },
  critical: { min: 85, max: 100 },
} as const;

export const VERDICT_MAPPING: Record<string, SimulationVerdict> = {
  minimal: "safe_to_proceed",
  low: "safe_to_proceed",
  moderate: "proceed_with_caution",
  elevated: "requires_review",
  high: "high_risk",
  critical: "do_not_proceed",
};

export const CONSERVATIVE_ADJUSTMENTS: RiskAdjustment[] = [
  {
    factor: "conservative_mode",
    direction: "increase",
    magnitude: 0.15,
    reason: "Conservative simulation mode applies a 15% risk uplift to account for unmodeled failure paths.",
  },
  {
    factor: "peak_hours",
    direction: "increase",
    magnitude: 0.20,
    reason: "Executing during peak utilization hours increases risk due to reduced capacity headroom.",
  },
  {
    factor: "recent_incident",
    direction: "increase",
    magnitude: 0.10,
    reason: "A recent incident involving related resources increases risk due to potential instability.",
  },
  {
    factor: "maintenance_window",
    direction: "decrease",
    magnitude: 0.10,
    reason: "Executing during a maintenance window reduces risk due to expected low traffic.",
  },
  {
    factor: "prior_successful_rollout",
    direction: "decrease",
    magnitude: 0.05,
    reason: "A similar rollout succeeded recently, reducing uncertainty.",
  },
  {
    factor: "first_time_action",
    direction: "increase",
    magnitude: 0.10,
    reason: "This action type has not been executed in this environment before, increasing uncertainty.",
  },
  {
    factor: "cross_region_change",
    direction: "increase",
    magnitude: 0.10,
    reason: "Changes spanning multiple regions have higher coordination risk.",
  },
  {
    factor: "high_dependency_count",
    direction: "increase",
    magnitude: 0.15,
    reason: "The target resource has many downstream dependencies, amplifying blast radius.",
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// §4 — Rollout Risk Simulation
// ═══════════════════════════════════════════════════════════════════════════════

export interface RolloutRiskResult {
  overallRisk: number;
  phases: RolloutPhaseRisk[];
  criticalGates: RolloutGate[];
  suggestedSequence: RolloutSequence;
  parallelizationSafe: boolean;
  estimatedDurationMinutes: number;
  canaryEligible: boolean;
}

export interface RolloutPhaseRisk {
  phaseIndex: number;
  phaseName: string;
  resourceIds: string[];
  riskScore: number;
  dependenciesSatisfied: boolean;
  blockedBy: string[];
  estimatedDurationMinutes: number;
  rollbackPointAvailable: boolean;
  verificationSteps: string[];
}

export interface RolloutGate {
  afterPhase: number;
  gateType: "automatic_verification" | "human_approval" | "metric_threshold" | "time_delay";
  description: string;
  passCondition: string;
  failAction: "pause" | "rollback" | "escalate";
  timeoutMinutes: number;
}

export interface RolloutSequence {
  strategy: "sequential" | "parallel_by_region" | "canary_then_full" | "blue_green" | "rolling";
  rationale: string;
  phases: RolloutPhaseSpec[];
  totalEstimatedMinutes: number;
  rollbackCheckpoints: number;
}

export interface RolloutPhaseSpec {
  order: number;
  name: string;
  resourceIds: string[];
  region: string;
  parallelizable: boolean;
  requiresGate: boolean;
  maxDurationMinutes: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// §5 — Downtime Likelihood Model
// ═══════════════════════════════════════════════════════════════════════════════

export interface DowntimeLikelihoodResult {
  probabilityPct: number;
  category: "negligible" | "unlikely" | "possible" | "likely" | "expected";
  estimatedDowntimeMinutes: DowntimeEstimate;
  affectedServices: DowntimeServiceImpact[];
  mitigations: DowntimeMitigation[];
  factors: DowntimeFactor[];
}

export interface DowntimeEstimate {
  bestCase: number;
  expected: number;
  worstCase: number;
  confidence: number;
}

export interface DowntimeServiceImpact {
  serviceName: string;
  impactType: "full_outage" | "degraded" | "increased_latency" | "partial_unavailability" | "none";
  userFacing: boolean;
  estimatedAffectedUsers: string;
  durationMinutes: DowntimeEstimate;
}

export interface DowntimeMitigation {
  description: string;
  effectivenessScore: number;
  implementationEffort: "none" | "trivial" | "low" | "medium" | "high";
  alreadyInPlace: boolean;
  reducesDowntimeByPct: number;
}

export interface DowntimeFactor {
  factor: string;
  direction: "increases" | "decreases";
  magnitude: "slight" | "moderate" | "significant";
  explanation: string;
}

export const DOWNTIME_PROBABILITY_THRESHOLDS = {
  negligible: { min: 0, max: 5 },
  unlikely: { min: 5, max: 20 },
  possible: { min: 20, max: 50 },
  likely: { min: 50, max: 80 },
  expected: { min: 80, max: 100 },
} as const;

export const DOWNTIME_FACTORS: DowntimeFactor[] = [
  { factor: "instance_restart_required", direction: "increases", magnitude: "significant", explanation: "The change requires an instance restart, causing a temporary service interruption for that instance." },
  { factor: "load_balancer_drain", direction: "decreases", magnitude: "moderate", explanation: "Load balancer connection draining redirects traffic before the change, reducing user impact." },
  { factor: "multi_az_deployment", direction: "decreases", magnitude: "significant", explanation: "Multi-AZ deployment means other AZs absorb traffic during the change." },
  { factor: "single_instance_service", direction: "increases", magnitude: "significant", explanation: "Service runs on a single instance with no redundancy. Any interruption affects all users." },
  { factor: "stateful_workload", direction: "increases", magnitude: "moderate", explanation: "Stateful workloads require session migration or reconnection, increasing disruption." },
  { factor: "dns_propagation_delay", direction: "increases", magnitude: "slight", explanation: "DNS changes may take time to propagate, causing intermittent failures during the transition." },
  { factor: "database_migration", direction: "increases", magnitude: "significant", explanation: "Database schema changes may lock tables or require maintenance mode." },
  { factor: "zero_downtime_deployment_pattern", direction: "decreases", magnitude: "significant", explanation: "Blue-green or rolling deployment patterns allow traffic shifting without interruption." },
  { factor: "health_check_configured", direction: "decreases", magnitude: "moderate", explanation: "Health checks detect failures quickly and route traffic away from impaired instances." },
  { factor: "circuit_breaker_in_place", direction: "decreases", magnitude: "moderate", explanation: "Circuit breakers prevent cascading failures by isolating degraded dependencies." },
];

// ═══════════════════════════════════════════════════════════════════════════════
// §6 — Rollback Complexity Assessment
// ═══════════════════════════════════════════════════════════════════════════════

export interface RollbackComplexityResult {
  complexityScore: number;
  complexityLevel: "trivial" | "simple" | "moderate" | "complex" | "dangerous";
  estimatedRollbackMinutes: DowntimeEstimate;
  rollbackStrategy: RollbackStrategySpec;
  blockers: RollbackBlocker[];
  stateCapture: StateCapturePlan;
  verificationAfterRollback: string[];
}

export interface RollbackStrategySpec {
  method: "terraform_revert" | "api_revert" | "snapshot_restore" | "blue_green_switch" | "manual_intervention";
  description: string;
  automatable: boolean;
  preConditions: string[];
  steps: RollbackStep[];
  failureMode: string;
  escalationRequired: boolean;
}

export interface RollbackStep {
  order: number;
  action: string;
  resourceId: string;
  estimatedDurationSeconds: number;
  canFail: boolean;
  failureAction: "abort_rollback" | "skip_and_continue" | "retry" | "escalate";
  verification: string;
}

export interface RollbackBlocker {
  blocker: string;
  severity: "warning" | "blocking";
  description: string;
  workaround: string | null;
}

export interface StateCapturePlan {
  captureBeforeApply: boolean;
  captureMethod: "terraform_state" | "api_snapshot" | "config_export" | "database_backup";
  storageLocation: string;
  retentionHours: number;
  verifyCapture: boolean;
  estimatedCaptureDurationSeconds: number;
}

export const ROLLBACK_COMPLEXITY_FACTORS = {
  trivial: { description: "Single API call or Terraform revert. No state dependencies. < 1 minute.", maxScore: 15 },
  simple: { description: "Few resources, clear revert path, no data changes. 1-5 minutes.", maxScore: 30 },
  moderate: { description: "Multiple resources with ordering requirements. May require brief downtime. 5-30 minutes.", maxScore: 55 },
  complex: { description: "Cross-service dependencies, data migration involved, manual steps needed. 30-120 minutes.", maxScore: 80 },
  dangerous: { description: "Irreversible data changes, cross-region coordination, or no clean rollback path. > 120 minutes or partial.", maxScore: 100 },
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// §7 — Region Failure Scenario Simulation
// ═══════════════════════════════════════════════════════════════════════════════

export interface RegionFailureResult {
  scenariosEvaluated: RegionFailureScenario[];
  worstCaseScenario: string;
  overallResilienceAfterChange: number;
  improvementOverCurrent: number;
  singleRegionRisks: SingleRegionRisk[];
}

export interface RegionFailureScenario {
  id: string;
  failedRegion: string;
  provider: "aws" | "azure" | "gcp";
  scenarioDescription: string;
  beforeChange: RegionFailureImpact;
  afterChange: RegionFailureImpact;
  improvementScore: number;
  newRisksIntroduced: string[];
}

export interface RegionFailureImpact {
  servicesAffected: number;
  totalResourcesInRegion: number;
  failoverAvailable: boolean;
  failoverRegion: string | null;
  estimatedFailoverMinutes: number;
  dataLossRisk: "none" | "minimal" | "possible" | "likely";
  estimatedRecoveryMinutes: number;
  revenueImpactPerHourUsd: number | null;
}

export interface SingleRegionRisk {
  resourceId: string;
  resourceType: string;
  region: string;
  riskDescription: string;
  mitigation: string;
  mitigationCostUsd: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// §8 — Resilience Improvement Simulation
// ═══════════════════════════════════════════════════════════════════════════════

export interface ResilienceImprovementResult {
  currentResilienceScore: number;
  projectedResilienceScore: number;
  improvementDelta: number;
  dimensionImprovements: ResilienceDimensionChange[];
  weaknessesResolved: string[];
  weaknessesIntroduced: string[];
  netWeaknessChange: number;
}

export interface ResilienceDimensionChange {
  dimension: string;
  currentScore: number;
  projectedScore: number;
  delta: number;
  explanation: string;
  affectedResources: string[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// §9 — Cost Savings Impact Simulation
// ═══════════════════════════════════════════════════════════════════════════════

export interface CostSavingsResult {
  projectedMonthlySavingsUsd: number;
  projectedAnnualSavingsUsd: number;
  confidenceRange: CostConfidenceRange;
  breakdownByResource: ResourceCostImpact[];
  oneTimeCosts: OneTimeCost[];
  netSavingsAfterOneTimeCosts: number;
  paybackPeriodMonths: number;
  savingsRealizationTimeline: SavingsTimeline[];
}

export interface CostConfidenceRange {
  low: number;
  expected: number;
  high: number;
  confidence: number;
  basis: string;
}

export interface ResourceCostImpact {
  resourceId: string;
  currentMonthlyCostUsd: number;
  projectedMonthlyCostUsd: number;
  savingsUsd: number;
  savingsSource: "right_sizing" | "reservation" | "deletion" | "storage_class" | "region_optimization" | "lifecycle_policy" | "other";
  confidence: number;
}

export interface OneTimeCost {
  description: string;
  costUsd: number;
  category: "migration" | "tooling" | "testing" | "downtime_revenue_loss" | "engineering_time";
}

export interface SavingsTimeline {
  month: number;
  cumulativeSavingsUsd: number;
  monthlySavingsUsd: number;
  oneTimeCostsUsd: number;
  netPositive: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// §10 — Dependency Conflict Detection
// ═══════════════════════════════════════════════════════════════════════════════

export interface DependencyConflictResult {
  conflictsDetected: number;
  conflicts: ExecutionConflict[];
  resolutionPlan: ConflictResolution[];
  safeExecutionOrder: string[] | null;
  parallelizableGroups: string[][];
  circularDependenciesFound: boolean;
}

export interface ExecutionConflict {
  id: string;
  conflictType: ExecutionConflictType;
  severity: "low" | "medium" | "high" | "blocking";
  resourceA: string;
  resourceB: string;
  description: string;
  resolution: string;
  autoResolvable: boolean;
}

export type ExecutionConflictType =
  | "ordering_dependency"
  | "mutual_exclusion"
  | "resource_contention"
  | "state_dependency"
  | "network_dependency"
  | "iam_dependency"
  | "data_dependency"
  | "circular_dependency";

export interface ConflictResolution {
  conflictId: string;
  strategy: "reorder" | "serialize" | "delay" | "split_phases" | "manual_intervention" | "skip";
  description: string;
  additionalTimeMinutes: number;
  additionalRisk: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// §11 — Scaling Behavior Simulation
// ═══════════════════════════════════════════════════════════════════════════════

export interface ScalingBehaviorResult {
  scalingImpacted: boolean;
  autoScalingGroups: AutoScalingImpact[];
  capacityHeadroomAfterChange: CapacityHeadroom;
  burstCapabilityAffected: boolean;
  scaleUpLatencyChange: ScaleLatencyChange;
  recommendedCapacityBuffer: number;
}

export interface AutoScalingImpact {
  groupId: string;
  groupName: string;
  currentMin: number;
  currentMax: number;
  currentDesired: number;
  afterChangeMin: number;
  afterChangeMax: number;
  afterChangeDesired: number;
  impactDescription: string;
  riskLevel: "none" | "low" | "medium" | "high";
}

export interface CapacityHeadroom {
  currentHeadroomPct: number;
  projectedHeadroomPct: number;
  minimumSafeHeadroomPct: number;
  headroomSufficient: boolean;
  recommendation: string;
}

export interface ScaleLatencyChange {
  currentScaleUpSeconds: number;
  projectedScaleUpSeconds: number;
  acceptableThresholdSeconds: number;
  withinThreshold: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// §12 — Replication Change Simulation
// ═══════════════════════════════════════════════════════════════════════════════

export interface ReplicationChangeResult {
  replicationImpacted: boolean;
  changes: ReplicationChangeDetail[];
  dataConsistencyRisk: DataConsistencyRisk;
  replicationLagImpact: ReplicationLagImpact;
  crossRegionDataTransferChange: DataTransferChange;
}

export interface ReplicationChangeDetail {
  resourceId: string;
  resourceType: string;
  currentReplication: ReplicationState;
  projectedReplication: ReplicationState;
  riskLevel: "none" | "low" | "medium" | "high" | "critical";
  description: string;
}

export interface ReplicationState {
  enabled: boolean;
  sourceRegion: string;
  targetRegions: string[];
  replicationType: "synchronous" | "asynchronous" | "eventual" | "none";
  currentLagMs: number | null;
  rpoMinutes: number | null;
}

export interface DataConsistencyRisk {
  riskLevel: "none" | "low" | "medium" | "high";
  description: string;
  windowOfInconsistencyMinutes: number;
  affectedReadPaths: string[];
  mitigation: string;
}

export interface ReplicationLagImpact {
  currentAvgLagMs: number;
  projectedAvgLagMs: number;
  peakLagMs: number;
  acceptableThresholdMs: number;
  withinThreshold: boolean;
}

export interface DataTransferChange {
  currentMonthlyGb: number;
  projectedMonthlyGb: number;
  currentMonthlyCostUsd: number;
  projectedMonthlyCostUsd: number;
  costDeltaUsd: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// §13 — Simulation Execution Pipeline
// ═══════════════════════════════════════════════════════════════════════════════

export type SimPipelineStage =
  | "validate_request"
  | "gather_context"
  | "build_dependency_graph"
  | "run_simulations"
  | "score_risk"
  | "generate_explanations"
  | "produce_verdict";

export interface SimPipelineDefinition {
  stage: SimPipelineStage;
  order: number;
  description: string;
  inputs: string[];
  outputs: string[];
  maxDurationMs: number;
  failureMode: string;
}

export const SIMULATION_PIPELINE: SimPipelineDefinition[] = [
  {
    stage: "validate_request",
    order: 1,
    description: "Validate simulation request inputs — resource IDs exist, proposed states are valid, constraints are satisfiable.",
    inputs: ["SimulationRequest"],
    outputs: ["ValidatedSimulationRequest"],
    maxDurationMs: 5000,
    failureMode: "Invalid request returns detailed validation errors. Simulation does not proceed.",
  },
  {
    stage: "gather_context",
    order: 2,
    description: "Collect current topology, utilization baselines, recent incidents, approval history, and active workloads from intelligence layer and memory.",
    inputs: ["ValidatedSimulationRequest"],
    outputs: ["SimulationContext"],
    maxDurationMs: 30000,
    failureMode: "Missing context data reduces simulation confidence but does not block execution.",
  },
  {
    stage: "build_dependency_graph",
    order: 3,
    description: "Construct a dependency graph of all target resources and their transitive dependencies from the topology.",
    inputs: ["SimulationContext", "SimulationTarget[]"],
    outputs: ["DependencyGraph"],
    maxDurationMs: 15000,
    failureMode: "Incomplete topology produces conservative dependency assumptions — edges assumed where uncertain.",
  },
  {
    stage: "run_simulations",
    order: 4,
    description: "Execute each requested simulation type in parallel. Each simulation produces an independent result.",
    inputs: ["SimulationContext", "DependencyGraph", "SimulationTarget[]"],
    outputs: ["SimulationResults[]"],
    maxDurationMs: 120000,
    failureMode: "Failed simulations are marked degraded with explanation. Other simulations continue.",
  },
  {
    stage: "score_risk",
    order: 5,
    description: "Compute composite risk score from all simulation results using weighted scoring with mode-specific adjustments.",
    inputs: ["SimulationResults[]", "SimulationMode"],
    outputs: ["CompositeRiskScore"],
    maxDurationMs: 5000,
    failureMode: "If no simulations completed, returns maximum risk score with explanation.",
  },
  {
    stage: "generate_explanations",
    order: 6,
    description: "Produce human-readable explanations for each simulation result, citing evidence, assumptions, and limitations.",
    inputs: ["SimulationResults[]", "CompositeRiskScore"],
    outputs: ["SimulationExplanation[]", "SimulationWarning[]"],
    maxDurationMs: 10000,
    failureMode: "Explanations are always generated. Degraded simulations produce lower-confidence explanations.",
  },
  {
    stage: "produce_verdict",
    order: 7,
    description: "Map composite risk score to verdict. Apply conservative bias — when in doubt, escalate to human review.",
    inputs: ["CompositeRiskScore", "SimulationWarning[]"],
    outputs: ["OperationalSimulationResult"],
    maxDurationMs: 5000,
    failureMode: "Verdict production never fails. Worst case returns 'requires_review' with explanation of why certainty is low.",
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// §14 — Conservative Simulation Principles
// ═══════════════════════════════════════════════════════════════════════════════

export interface SimulationPrinciple {
  name: string;
  description: string;
  enforcement: "architectural" | "algorithmic" | "review";
  example: string;
}

export const SIMULATION_PRINCIPLES: SimulationPrinciple[] = [
  {
    name: "pessimistic_defaults",
    description: "When data is missing or ambiguous, the simulation assumes the worse outcome. Unknown dependencies are treated as present. Unknown downtime is treated as likely.",
    enforcement: "algorithmic",
    example: "If utilization data is unavailable, the simulation assumes the resource is at 80% utilization rather than estimating low usage.",
  },
  {
    name: "no_optimistic_cascading",
    description: "Positive outcomes do not compound. If one simulation shows low risk, it does not reduce the risk score of another simulation. Risk is additive; safety is not.",
    enforcement: "algorithmic",
    example: "A low rollback complexity score does not reduce the downtime likelihood score, even though easy rollback mitigates downtime.",
  },
  {
    name: "confidence_weighted_scoring",
    description: "Low-confidence simulations contribute less to the composite score but never reduce it. A simulation that says 'I am uncertain' is treated as a mild risk signal, not a neutral one.",
    enforcement: "algorithmic",
    example: "A downtime simulation at 40% confidence with risk score 30 contributes (30 * 0.4 + 50 * 0.6) = 42 — uncertain simulations are pulled toward moderate risk.",
  },
  {
    name: "never_recommend_unsafe_parallel",
    description: "The simulation engine never recommends parallel execution of changes that share any dependency edge in the topology graph, regardless of how low the individual risk scores are.",
    enforcement: "architectural",
    example: "Two security group changes that both affect the same VPC are always serialized, even if each has a risk score of 5.",
  },
  {
    name: "historical_incident_uplift",
    description: "If a similar change caused an incident in the past (from memory), the risk score for that simulation type receives a permanent uplift that decays over time but never reaches zero.",
    enforcement: "algorithmic",
    example: "A right-sizing action that caused an OOM incident 6 months ago still carries a 5% uplift. At 3 months it would be 10%. The floor is 3%.",
  },
  {
    name: "first_time_penalty",
    description: "An action type that has never been executed in this environment receives a flat risk increase. The agent has no historical evidence that it will succeed, so it defaults to caution.",
    enforcement: "algorithmic",
    example: "The first credential rotation in an account gets +10% risk. After 3 successful rotations, the penalty is removed.",
  },
  {
    name: "blast_radius_amplification",
    description: "Risk scores are amplified in proportion to the number of downstream dependencies. A risky change affecting 2 resources is less dangerous than the same risky change affecting 200.",
    enforcement: "algorithmic",
    example: "A risk score of 40 with 3 downstream dependencies stays at 40. The same score with 30 downstream dependencies becomes 52.",
  },
  {
    name: "irreversibility_escalation",
    description: "Changes that are not reversible (data deletion, encryption key rotation, production database migration) automatically escalate the verdict by one level.",
    enforcement: "architectural",
    example: "A 'safe_to_proceed' verdict for an irreversible change becomes 'proceed_with_caution'. A 'proceed_with_caution' becomes 'requires_review'.",
  },
  {
    name: "cross_region_coordination_premium",
    description: "Changes spanning multiple regions incur an additional risk premium proportional to the number of regions involved. Cross-region coordination failures are a distinct failure mode.",
    enforcement: "algorithmic",
    example: "A replication change across 3 regions gets a 15% coordination premium (5% per additional region beyond the first).",
  },
  {
    name: "simulation_does_not_approve",
    description: "The simulation engine produces verdicts but never bypasses human approval gates. A 'safe_to_proceed' verdict is information for the approver, not an auto-approval.",
    enforcement: "architectural",
    example: "Even if all simulations return risk score 0, the agent's approval gate logic decides whether human review is required based on trust level and governance policy.",
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// §15 — Provider Simulation Capabilities
// ═══════════════════════════════════════════════════════════════════════════════

export interface ProviderSimulationCapability {
  provider: "aws" | "azure" | "gcp";
  simulationType: SimulationType;
  supported: boolean;
  fidelity: "full" | "partial" | "estimated" | "not_available";
  dataSources: string[];
  limitations: string[];
}

export const PROVIDER_SIMULATION_CAPABILITIES: ProviderSimulationCapability[] = [
  // AWS — full support
  { provider: "aws", simulationType: "rollout_risk", supported: true, fidelity: "full", dataSources: ["CloudFormation change sets", "Terraform plan", "EC2 describe", "ELB target health"], limitations: [] },
  { provider: "aws", simulationType: "downtime_likelihood", supported: true, fidelity: "full", dataSources: ["CloudWatch metrics", "ELB health", "ASG config", "Route53 health checks"], limitations: [] },
  { provider: "aws", simulationType: "rollback_complexity", supported: true, fidelity: "full", dataSources: ["Terraform state", "EC2 snapshots", "S3 versioning", "RDS snapshots"], limitations: [] },
  { provider: "aws", simulationType: "region_failure", supported: true, fidelity: "full", dataSources: ["Multi-AZ config", "Cross-region replication", "Route53 failover", "Global Accelerator"], limitations: [] },
  { provider: "aws", simulationType: "resilience_improvement", supported: true, fidelity: "full", dataSources: ["Infrastructure topology", "AZ distribution", "backup configs", "health checks"], limitations: [] },
  { provider: "aws", simulationType: "cost_savings", supported: true, fidelity: "full", dataSources: ["Cost Explorer", "Pricing API", "Reserved Instance coverage", "Savings Plans"], limitations: [] },
  { provider: "aws", simulationType: "dependency_conflict", supported: true, fidelity: "full", dataSources: ["VPC topology", "Security groups", "IAM policies", "CloudTrail"], limitations: [] },
  { provider: "aws", simulationType: "scaling_behavior", supported: true, fidelity: "full", dataSources: ["ASG configs", "CloudWatch scaling metrics", "Target Tracking policies"], limitations: [] },
  { provider: "aws", simulationType: "replication_change", supported: true, fidelity: "full", dataSources: ["S3 replication", "RDS read replicas", "DynamoDB global tables", "ElastiCache replication"], limitations: [] },
  // Azure — scan-only, estimated simulations
  { provider: "azure", simulationType: "rollout_risk", supported: true, fidelity: "estimated", dataSources: ["ARM template what-if", "Resource properties"], limitations: ["No apply capability — rollout simulation is based on config analysis, not execution dry-run"] },
  { provider: "azure", simulationType: "downtime_likelihood", supported: true, fidelity: "estimated", dataSources: ["Azure Monitor metrics", "Availability set config"], limitations: ["Limited historical metric depth compared to CloudWatch integration"] },
  { provider: "azure", simulationType: "rollback_complexity", supported: true, fidelity: "partial", dataSources: ["Resource lock status", "Snapshot existence", "Soft delete status"], limitations: ["Cannot verify Terraform state — estimation based on resource properties"] },
  { provider: "azure", simulationType: "region_failure", supported: true, fidelity: "estimated", dataSources: ["Availability zone config", "Geo-replication status", "Traffic Manager"], limitations: ["Failover simulation is estimated, not tested"] },
  { provider: "azure", simulationType: "resilience_improvement", supported: true, fidelity: "estimated", dataSources: ["Resource topology", "Backup vault status"], limitations: ["Limited to configuration analysis"] },
  { provider: "azure", simulationType: "cost_savings", supported: true, fidelity: "partial", dataSources: ["Azure Cost Management", "Retail Prices API"], limitations: ["EA/CSP pricing may not be reflected accurately"] },
  { provider: "azure", simulationType: "dependency_conflict", supported: true, fidelity: "partial", dataSources: ["Resource group relationships", "NSG rules", "RBAC assignments"], limitations: ["Activity log depth limited compared to CloudTrail"] },
  { provider: "azure", simulationType: "scaling_behavior", supported: true, fidelity: "estimated", dataSources: ["VMSS config", "App Service plan scaling rules"], limitations: ["Scaling simulation is config-based, not metric-based"] },
  { provider: "azure", simulationType: "replication_change", supported: true, fidelity: "estimated", dataSources: ["Geo-replication config", "Storage replication type"], limitations: ["Replication lag estimation not available without apply tier"] },
  // GCP — scan-only, estimated simulations
  { provider: "gcp", simulationType: "rollout_risk", supported: true, fidelity: "estimated", dataSources: ["Deployment Manager preview", "Resource properties"], limitations: ["No apply capability — config-based estimation only"] },
  { provider: "gcp", simulationType: "downtime_likelihood", supported: true, fidelity: "estimated", dataSources: ["Cloud Monitoring metrics", "Instance group config"], limitations: ["Limited historical metric integration"] },
  { provider: "gcp", simulationType: "rollback_complexity", supported: true, fidelity: "partial", dataSources: ["Snapshot existence", "Instance template versions"], limitations: ["Cannot verify Terraform state"] },
  { provider: "gcp", simulationType: "region_failure", supported: true, fidelity: "estimated", dataSources: ["Multi-region config", "Cloud DNS failover", "Regional MIG config"], limitations: ["Failover simulation is estimated"] },
  { provider: "gcp", simulationType: "resilience_improvement", supported: true, fidelity: "estimated", dataSources: ["Resource topology", "Backup config"], limitations: ["Limited to configuration analysis"] },
  { provider: "gcp", simulationType: "cost_savings", supported: true, fidelity: "partial", dataSources: ["Cloud Billing export", "Pricing catalog"], limitations: ["Committed use discount estimation may vary"] },
  { provider: "gcp", simulationType: "dependency_conflict", supported: true, fidelity: "partial", dataSources: ["VPC topology", "Firewall rules", "IAM bindings"], limitations: ["Activity log depth limited"] },
  { provider: "gcp", simulationType: "scaling_behavior", supported: true, fidelity: "estimated", dataSources: ["MIG autoscaler config", "Cloud Run scaling settings"], limitations: ["Config-based estimation only"] },
  { provider: "gcp", simulationType: "replication_change", supported: true, fidelity: "estimated", dataSources: ["Multi-region bucket config", "Cloud SQL replicas", "Spanner config"], limitations: ["Lag estimation limited without apply tier"] },
];

// ═══════════════════════════════════════════════════════════════════════════════
// §16 — Query Functions
// ═══════════════════════════════════════════════════════════════════════════════

export function getSimulationPipelineStage(stage: SimPipelineStage): SimPipelineDefinition | undefined {
  return SIMULATION_PIPELINE.find((s) => s.stage === stage);
}

export function getSimulationPipelineOrder(): SimPipelineStage[] {
  return [...SIMULATION_PIPELINE].sort((a, b) => a.order - b.order).map((s) => s.stage);
}

export function getRiskWeight(simulationType: SimulationType): number {
  return RISK_WEIGHTS[simulationType];
}

export function getRiskCategory(score: number): CompositeRiskScore["category"] {
  if (score < RISK_THRESHOLDS.minimal.max) return "minimal";
  if (score < RISK_THRESHOLDS.low.max) return "low";
  if (score < RISK_THRESHOLDS.moderate.max) return "moderate";
  if (score < RISK_THRESHOLDS.elevated.max) return "elevated";
  if (score < RISK_THRESHOLDS.high.max) return "high";
  return "critical";
}

export function getVerdict(riskCategory: CompositeRiskScore["category"]): SimulationVerdict {
  return VERDICT_MAPPING[riskCategory];
}

export function computeCompositeRiskScore(
  components: { simulationType: SimulationType; rawScore: number; confidence: number }[],
  mode: SimulationMode,
  adjustments: RiskAdjustment[],
): CompositeRiskScore {
  const riskComponents: RiskComponent[] = components.map((c) => {
    const weight = RISK_WEIGHTS[c.simulationType];
    const confidenceAdjustedScore = c.rawScore * c.confidence + 50 * (1 - c.confidence);
    return {
      simulationType: c.simulationType,
      rawScore: c.rawScore,
      weight,
      weightedScore: confidenceAdjustedScore * weight,
      confidence: c.confidence,
      adjustmentFactors: [],
    };
  });

  let overall = riskComponents.reduce((sum, c) => sum + c.weightedScore, 0);

  const applicableAdjustments = adjustments.filter((a) => {
    if (mode === "conservative") return true;
    if (mode === "balanced") return a.factor !== "conservative_mode";
    return a.direction === "decrease";
  });

  for (const adj of applicableAdjustments) {
    const delta = overall * adj.magnitude;
    overall = adj.direction === "increase" ? overall + delta : overall - delta;
  }

  overall = Math.max(0, Math.min(100, Math.round(overall * 100) / 100));

  const category = getRiskCategory(overall);
  const verdict = getVerdict(category);
  const dominantRisk = riskComponents.reduce((max, c) => c.weightedScore > max.weightedScore ? c : max, riskComponents[0]);

  return {
    overall,
    category,
    components: riskComponents,
    dominantRisk: dominantRisk.simulationType,
    mitigatedScore: null,
    mitigationActions: [],
  };
}

export function getProviderSimulationFidelity(
  provider: "aws" | "azure" | "gcp",
  simulationType: SimulationType,
): ProviderSimulationCapability | undefined {
  return PROVIDER_SIMULATION_CAPABILITIES.find(
    (c) => c.provider === provider && c.simulationType === simulationType,
  );
}

export function getProviderSimulationSummary(provider: "aws" | "azure" | "gcp"): {
  fullFidelity: number;
  partialFidelity: number;
  estimatedFidelity: number;
  notAvailable: number;
} {
  const caps = PROVIDER_SIMULATION_CAPABILITIES.filter((c) => c.provider === provider);
  return {
    fullFidelity: caps.filter((c) => c.fidelity === "full").length,
    partialFidelity: caps.filter((c) => c.fidelity === "partial").length,
    estimatedFidelity: caps.filter((c) => c.fidelity === "estimated").length,
    notAvailable: caps.filter((c) => c.fidelity === "not_available").length,
  };
}

export function getApplicableAdjustments(context: SimulationContext): RiskAdjustment[] {
  const adjustments: RiskAdjustment[] = [];

  if (context.isMaintenanceWindow) {
    adjustments.push(CONSERVATIVE_ADJUSTMENTS.find((a) => a.factor === "maintenance_window")!);
  }

  if (context.currentUtilization.isCurrentlyPeak) {
    adjustments.push(CONSERVATIVE_ADJUSTMENTS.find((a) => a.factor === "peak_hours")!);
  }

  if (context.recentIncidents.some((i) => i.relatedToProposedChanges)) {
    adjustments.push(CONSERVATIVE_ADJUSTMENTS.find((a) => a.factor === "recent_incident")!);
  }

  if (context.currentTopology.crossRegionDependencies > 0) {
    adjustments.push(CONSERVATIVE_ADJUSTMENTS.find((a) => a.factor === "cross_region_change")!);
  }

  return adjustments;
}

// ═══════════════════════════════════════════════════════════════════════════════
// §17 — Tests
// ═══════════════════════════════════════════════════════════════════════════════

export interface SimulationTestResult {
  name: string;
  passed: boolean;
  detail: string;
}

export function runOperationalSimulationTests(): SimulationTestResult[] {
  const results: SimulationTestResult[] = [];

  function assert(name: string, condition: boolean, detail: string) {
    results.push({ name, passed: condition, detail });
  }

  // Risk weights
  const totalWeight = Object.values(RISK_WEIGHTS).reduce((sum, w) => sum + w, 0);
  assert(
    "Risk weights sum to 1.0",
    Math.abs(totalWeight - 1.0) < 0.001,
    `Total weight: ${totalWeight}`,
  );

  assert(
    "All 9 simulation types have weights",
    Object.keys(RISK_WEIGHTS).length === 9,
    `Weight entries: ${Object.keys(RISK_WEIGHTS).length}`,
  );

  assert(
    "Rollout risk and downtime have highest weights",
    RISK_WEIGHTS.rollout_risk >= 0.15 && RISK_WEIGHTS.downtime_likelihood >= 0.15,
    `Rollout: ${RISK_WEIGHTS.rollout_risk}, Downtime: ${RISK_WEIGHTS.downtime_likelihood}`,
  );

  // Risk thresholds
  assert(
    "Risk thresholds cover 0-100 range",
    RISK_THRESHOLDS.minimal.min === 0 && RISK_THRESHOLDS.critical.max === 100,
    "Thresholds span full 0-100 range",
  );

  assert(
    "Risk thresholds are contiguous",
    RISK_THRESHOLDS.low.min === RISK_THRESHOLDS.minimal.max &&
    RISK_THRESHOLDS.moderate.min === RISK_THRESHOLDS.low.max &&
    RISK_THRESHOLDS.elevated.min === RISK_THRESHOLDS.moderate.max &&
    RISK_THRESHOLDS.high.min === RISK_THRESHOLDS.elevated.max &&
    RISK_THRESHOLDS.critical.min === RISK_THRESHOLDS.high.max,
    "All threshold boundaries align",
  );

  // Verdict mapping
  assert(
    "All risk categories have verdicts",
    ["minimal", "low", "moderate", "elevated", "high", "critical"].every((c) => VERDICT_MAPPING[c] !== undefined),
    "Every risk category maps to a verdict",
  );

  assert(
    "Critical risk maps to do_not_proceed",
    VERDICT_MAPPING.critical === "do_not_proceed",
    `Critical verdict: ${VERDICT_MAPPING.critical}`,
  );

  assert(
    "Minimal risk maps to safe_to_proceed",
    VERDICT_MAPPING.minimal === "safe_to_proceed",
    `Minimal verdict: ${VERDICT_MAPPING.minimal}`,
  );

  // Simulation pipeline
  assert(
    "Simulation pipeline has 7 stages",
    SIMULATION_PIPELINE.length === 7,
    `Pipeline stages: ${SIMULATION_PIPELINE.length}`,
  );

  assert(
    "Pipeline stages are ordered 1-7",
    SIMULATION_PIPELINE.every((s, i) => s.order === i + 1),
    "All stages have correct sequential ordering",
  );

  assert(
    "Validate is first, verdict is last",
    SIMULATION_PIPELINE[0].stage === "validate_request" &&
    SIMULATION_PIPELINE[SIMULATION_PIPELINE.length - 1].stage === "produce_verdict",
    `First: ${SIMULATION_PIPELINE[0].stage}, Last: ${SIMULATION_PIPELINE[SIMULATION_PIPELINE.length - 1].stage}`,
  );

  // Conservative principles
  assert(
    "At least 10 simulation principles defined",
    SIMULATION_PRINCIPLES.length >= 10,
    `Principles: ${SIMULATION_PRINCIPLES.length}`,
  );

  assert(
    "Simulation-does-not-approve principle exists",
    SIMULATION_PRINCIPLES.some((p) => p.name === "simulation_does_not_approve"),
    "Critical principle present: simulation never bypasses approval gates",
  );

  assert(
    "Irreversibility escalation principle exists",
    SIMULATION_PRINCIPLES.some((p) => p.name === "irreversibility_escalation"),
    "Critical principle present: irreversible changes auto-escalate verdict",
  );

  // Provider simulation capabilities
  assert(
    "AWS has full fidelity on all simulations",
    PROVIDER_SIMULATION_CAPABILITIES.filter((c) => c.provider === "aws").every((c) => c.fidelity === "full"),
    "All AWS simulation types are full fidelity",
  );

  assert(
    "Azure and GCP have no full fidelity simulations",
    PROVIDER_SIMULATION_CAPABILITIES.filter((c) => c.provider === "azure" || c.provider === "gcp").every((c) => c.fidelity !== "full"),
    "Scan-only providers have estimated/partial fidelity",
  );

  assert(
    "All providers have all 9 simulation types",
    (["aws", "azure", "gcp"] as const).every(
      (p) => PROVIDER_SIMULATION_CAPABILITIES.filter((c) => c.provider === p).length === 9,
    ),
    "Each provider has exactly 9 simulation type entries",
  );

  // Composite scoring
  const testScore = computeCompositeRiskScore(
    [
      { simulationType: "rollout_risk", rawScore: 30, confidence: 0.9 },
      { simulationType: "downtime_likelihood", rawScore: 20, confidence: 0.8 },
    ],
    "conservative",
    [],
  );

  assert(
    "Composite scoring produces valid output",
    testScore.overall >= 0 && testScore.overall <= 100,
    `Computed score: ${testScore.overall}`,
  );

  assert(
    "Composite scoring assigns a category",
    ["minimal", "low", "moderate", "elevated", "high", "critical"].includes(testScore.category),
    `Category: ${testScore.category}`,
  );

  assert(
    "Composite scoring identifies dominant risk",
    testScore.dominantRisk !== undefined,
    `Dominant risk: ${testScore.dominantRisk}`,
  );

  // Query functions
  assert(
    "getRiskCategory maps scores correctly",
    getRiskCategory(0) === "minimal" &&
    getRiskCategory(20) === "low" &&
    getRiskCategory(40) === "moderate" &&
    getRiskCategory(60) === "elevated" &&
    getRiskCategory(75) === "high" &&
    getRiskCategory(90) === "critical",
    "All score ranges map to correct categories",
  );

  assert(
    "getProviderSimulationSummary computes correctly",
    getProviderSimulationSummary("aws").fullFidelity === 9,
    `AWS full fidelity count: ${getProviderSimulationSummary("aws").fullFidelity}`,
  );

  const pipelineOrder = getSimulationPipelineOrder();
  assert(
    "getSimulationPipelineOrder returns all stages",
    pipelineOrder.length === 7,
    `Ordered stages: ${pipelineOrder.length}`,
  );

  // Downtime factors
  assert(
    "Downtime factors include both increasing and decreasing",
    DOWNTIME_FACTORS.some((f) => f.direction === "increases") &&
    DOWNTIME_FACTORS.some((f) => f.direction === "decreases"),
    `Increasing: ${DOWNTIME_FACTORS.filter((f) => f.direction === "increases").length}, Decreasing: ${DOWNTIME_FACTORS.filter((f) => f.direction === "decreases").length}`,
  );

  // Conservative adjustments
  assert(
    "Conservative adjustments include both increase and decrease",
    CONSERVATIVE_ADJUSTMENTS.some((a) => a.direction === "increase") &&
    CONSERVATIVE_ADJUSTMENTS.some((a) => a.direction === "decrease"),
    `Increases: ${CONSERVATIVE_ADJUSTMENTS.filter((a) => a.direction === "increase").length}, Decreases: ${CONSERVATIVE_ADJUSTMENTS.filter((a) => a.direction === "decrease").length}`,
  );

  assert(
    "More conservative adjustments increase risk than decrease it",
    CONSERVATIVE_ADJUSTMENTS.filter((a) => a.direction === "increase").length >
    CONSERVATIVE_ADJUSTMENTS.filter((a) => a.direction === "decrease").length,
    "Conservative bias confirmed — more upward adjustments than downward",
  );

  // Rollback complexity
  assert(
    "Rollback complexity levels are ordered by max score",
    ROLLBACK_COMPLEXITY_FACTORS.trivial.maxScore < ROLLBACK_COMPLEXITY_FACTORS.simple.maxScore &&
    ROLLBACK_COMPLEXITY_FACTORS.simple.maxScore < ROLLBACK_COMPLEXITY_FACTORS.moderate.maxScore &&
    ROLLBACK_COMPLEXITY_FACTORS.moderate.maxScore < ROLLBACK_COMPLEXITY_FACTORS.complex.maxScore &&
    ROLLBACK_COMPLEXITY_FACTORS.complex.maxScore < ROLLBACK_COMPLEXITY_FACTORS.dangerous.maxScore,
    "Complexity levels increase monotonically",
  );

  return results;
}
