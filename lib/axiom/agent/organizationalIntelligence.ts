// ─────────────────────────────────────────────────────────────────────────────
// Organizational Intelligence System
// How Axiom Agent learns and adapts to an organization's operational DNA
// ─────────────────────────────────────────────────────────────────────────────

// ═══════════════════════════════════════════════════════════════════════════════
// §1 — Organizational Memory Architecture
// ═══════════════════════════════════════════════════════════════════════════════

export interface OrgMemoryStore {
  orgId: string;
  createdAt: string;
  lastUpdated: string;
  memoryVersion: number;
  operationalDna: OperationalDna;
  approvalBehavior: ApprovalBehaviorModel;
  riskPosture: OrgRiskPosture;
  growthIntelligence: GrowthIntelligenceModel;
  usagePatterns: CloudUsagePatternModel;
  optimizationPriorities: OptimizationPriorityModel;
  executionTendencies: ExecutionTendencyModel;
  workflowEfficiency: WorkflowEfficiencyModel;
  governanceLearning: GovernanceLearningModel;
  adaptationState: OrgAdaptationState;
  transparencyLog: TransparencyLogEntry[];
}

export type OrgMemoryCategory =
  | "operational_preference"
  | "approval_pattern"
  | "risk_tolerance"
  | "growth_pattern"
  | "usage_pattern"
  | "optimization_priority"
  | "execution_tendency"
  | "workflow_efficiency"
  | "governance_requirement";

export interface OrgMemoryObservation {
  id: string;
  orgId: string;
  category: OrgMemoryCategory;
  observedAt: string;
  source: ObservationSource;
  signal: OrgSignalData;
  confidence: number;
  decayRate: number;
  expiresAt: string | null;
}

export type ObservationSource =
  | "scan_result"
  | "approval_decision"
  | "rejection_decision"
  | "execution_outcome"
  | "rollback_event"
  | "escalation_event"
  | "override_event"
  | "configuration_change"
  | "budget_action"
  | "policy_update"
  | "incident_response"
  | "manual_feedback";

export interface OrgSignalData {
  signalType: string;
  payload: Record<string, unknown>;
  resourceIds: string[];
  provider: "aws" | "azure" | "gcp" | null;
  region: string | null;
  actor: "agent" | "human";
  contextNotes: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// §2 — Operational DNA
// ═══════════════════════════════════════════════════════════════════════════════

export interface OperationalDna {
  orgId: string;
  profiledSince: string;
  lastUpdated: string;
  observationCount: number;
  maturity: OrgOperationalMaturity;
  changePhilosophy: ChangePhilosophy;
  communicationStyle: CommunicationStyle;
  decisionSpeed: DecisionSpeed;
  automationComfort: AutomationComfort;
  cloudStrategy: OrgCloudStrategy;
  complianceOrientation: ComplianceOrientation;
  costSensitivity: CostSensitivity;
}

export type OrgOperationalMaturity =
  | "nascent"
  | "emerging"
  | "established"
  | "advanced"
  | "leading";

export interface ChangePhilosophy {
  preferredPace: "conservative" | "measured" | "moderate" | "aggressive";
  batchPreference: "small_frequent" | "medium_batches" | "large_infrequent";
  testingExpectation: "no_testing" | "basic_verification" | "comprehensive_testing" | "canary_then_full";
  rollbackExpectation: "manual_acceptable" | "automated_preferred" | "automated_required";
  maintenanceWindowRequired: boolean;
  observedFromCount: number;
}

export interface CommunicationStyle {
  detailLevel: "summary_only" | "key_details" | "comprehensive" | "technical_depth";
  explanationPreference: "just_do_it" | "brief_rationale" | "full_reasoning" | "evidence_based";
  notificationFrequency: "critical_only" | "important" | "regular" | "verbose";
  observedFromCount: number;
}

export interface DecisionSpeed {
  avgApprovalTimeMinutes: number;
  medianApprovalTimeMinutes: number;
  p95ApprovalTimeMinutes: number;
  approvalsDuringBusinessHours: number;
  approvalsOutsideBusinessHours: number;
  businessHoursStart: number;
  businessHoursEnd: number;
  timezone: string;
  observedFromCount: number;
}

export interface AutomationComfort {
  currentTrustLevel: number;
  maxGrantedAutonomy: number;
  autoApproveThreshold: "never" | "safe_only" | "low_risk" | "medium_risk";
  manualOverrideFrequency: number;
  escalationFrequency: number;
  trendDirection: "increasing_trust" | "stable" | "decreasing_trust";
  observedFromCount: number;
}

export interface OrgCloudStrategy {
  primaryProvider: "aws" | "azure" | "gcp";
  activeProviders: ("aws" | "azure" | "gcp")[];
  multiCloudMotivation: "regulatory" | "redundancy" | "best_of_breed" | "acquisition" | "team_preference" | "cost_optimization";
  iacAdoption: "none" | "partial" | "majority" | "full";
  iacTool: "terraform" | "cloudformation" | "pulumi" | "arm" | "cdk" | "mixed" | "none";
  ciCdIntegrated: boolean;
  observedFromCount: number;
}

export type ComplianceOrientation = "minimal" | "standard" | "strict" | "regulated";

export type CostSensitivity = "cost_indifferent" | "cost_aware" | "cost_conscious" | "cost_driven";

// ═══════════════════════════════════════════════════════════════════════════════
// §3 — Approval Behavior Model
// ═══════════════════════════════════════════════════════════════════════════════

export interface ApprovalBehaviorModel {
  totalObservations: number;
  lastUpdated: string;
  overallApprovalRate: number;
  categoryRates: ApprovalCategoryRate[];
  riskLevelRates: ApprovalRiskLevelRate[];
  temporalPatterns: ApprovalTemporalPattern;
  approverProfiles: ApproverProfile[];
  rejectionReasons: RejectionReasonFrequency[];
  escalationPatterns: EscalationPattern[];
}

export interface ApprovalCategoryRate {
  category: string;
  approvedCount: number;
  deniedCount: number;
  approvalRate: number;
  avgTimeToDecisionMinutes: number;
  trend: "more_approvals" | "stable" | "more_denials";
  trendPeriodDays: number;
}

export interface ApprovalRiskLevelRate {
  riskLevel: "safe" | "low" | "medium" | "high" | "critical";
  approvedCount: number;
  deniedCount: number;
  approvalRate: number;
  avgTimeToDecisionMinutes: number;
  autoApproveEligible: boolean;
}

export interface ApprovalTemporalPattern {
  fastestApprovalDayOfWeek: number;
  slowestApprovalDayOfWeek: number;
  fastestApprovalHourUtc: number;
  slowestApprovalHourUtc: number;
  avgResponseTimeByDayOfWeek: Record<number, number>;
  weekendApprovalRate: number;
  afterHoursApprovalRate: number;
}

export interface ApproverProfile {
  approverId: string;
  totalDecisions: number;
  approvalRate: number;
  avgResponseTimeMinutes: number;
  specializations: string[];
  activeHoursUtc: { start: number; end: number };
  lastActiveAt: string;
}

export interface RejectionReasonFrequency {
  reason: string;
  count: number;
  percentage: number;
  examples: string[];
  addressable: boolean;
  addressedByAgent: boolean;
}

export interface EscalationPattern {
  triggerCondition: string;
  frequency: number;
  avgResolutionTimeMinutes: number;
  escalationChain: string[];
  outcomeAfterEscalation: "approved" | "denied" | "modified" | "deferred";
}

// ═══════════════════════════════════════════════════════════════════════════════
// §4 — Risk Posture Model
// ═══════════════════════════════════════════════════════════════════════════════

export interface OrgRiskPosture {
  lastUpdated: string;
  observationCount: number;
  overallTolerance: RiskToleranceLevel;
  domainTolerances: DomainRiskTolerance[];
  acceptedRiskPatterns: AcceptedRiskPattern[];
  riskEscalationThresholds: RiskEscalationThreshold[];
  historicalIncidentResponse: IncidentResponsePattern[];
  riskBudget: RiskBudget;
}

export type RiskToleranceLevel = "very_conservative" | "conservative" | "moderate" | "accepting" | "aggressive";

export interface DomainRiskTolerance {
  domain: string;
  tolerance: RiskToleranceLevel;
  maxAcceptableRiskScore: number;
  autoApproveBelow: number;
  requireReviewAbove: number;
  neverAutoApprove: string[];
  evidenceBasis: string;
  observedFromCount: number;
}

export interface AcceptedRiskPattern {
  id: string;
  description: string;
  riskType: string;
  acceptedSince: string;
  acceptanceReason: string;
  reviewSchedule: "monthly" | "quarterly" | "annually" | "none";
  lastReviewed: string | null;
  stillValid: boolean;
}

export interface RiskEscalationThreshold {
  condition: string;
  blastRadiusAbove: number;
  costImpactAboveUsd: number;
  resourceCountAbove: number;
  escalateTo: string;
  observedFromCount: number;
}

export interface IncidentResponsePattern {
  incidentCategory: string;
  avgResponseTimeMinutes: number;
  avgResolutionTimeMinutes: number;
  postMortemConducted: boolean;
  changesImplementedAfter: number;
  recurrenceRate: number;
}

export interface RiskBudget {
  monthlyRiskCapacity: number;
  currentMonthRiskSpent: number;
  riskCapacityRemaining: number;
  highRiskActionsThisMonth: number;
  maxHighRiskActionsPerMonth: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// §5 — Growth Intelligence Model
// ═══════════════════════════════════════════════════════════════════════════════

export interface GrowthIntelligenceModel {
  lastUpdated: string;
  observationWindowDays: number;
  resourceGrowth: ResourceGrowthPattern;
  costGrowth: CostGrowthPattern;
  regionalExpansion: RegionalExpansionPattern;
  serviceAdoption: ServiceAdoptionPattern[];
  projections: GrowthProjection[];
}

export interface ResourceGrowthPattern {
  currentTotal: number;
  growthRatePerMonth: number;
  growthTrend: "accelerating" | "linear" | "decelerating" | "stable" | "shrinking";
  byProvider: Record<string, { count: number; growthRate: number }>;
  byDomain: Record<string, { count: number; growthRate: number }>;
  seasonality: boolean;
  seasonalPeakMonth: number | null;
  seasonalTroughMonth: number | null;
}

export interface CostGrowthPattern {
  currentMonthlyUsd: number;
  growthRatePerMonth: number;
  growthTrend: "accelerating" | "linear" | "decelerating" | "stable" | "shrinking";
  costPerResource: number;
  costPerResourceTrend: "increasing" | "stable" | "decreasing";
  topGrowthDrivers: CostGrowthDriver[];
}

export interface CostGrowthDriver {
  category: string;
  monthlyGrowthUsd: number;
  percentOfTotalGrowth: number;
  actionable: boolean;
  suggestedMitigation: string | null;
}

export interface RegionalExpansionPattern {
  currentRegions: string[];
  regionsAddedLast90d: string[];
  regionsRemovedLast90d: string[];
  expansionDirection: string | null;
  concentrationIndex: number;
  diversificationTrend: "concentrating" | "stable" | "diversifying";
}

export interface ServiceAdoptionPattern {
  service: string;
  provider: "aws" | "azure" | "gcp";
  adoptedAt: string;
  currentUsage: "experimental" | "growing" | "production" | "critical" | "declining";
  resourceCount: number;
  monthlyCostUsd: number;
}

export interface GrowthProjection {
  metric: string;
  currentValue: number;
  projectedValue30d: number;
  projectedValue90d: number;
  projectedValue180d: number;
  confidence: number;
  basis: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// §6 — Cloud Usage Pattern Model
// ═══════════════════════════════════════════════════════════════════════════════

export interface CloudUsagePatternModel {
  lastUpdated: string;
  utilizationProfile: OrgUtilizationProfile;
  schedulingPatterns: SchedulingPattern[];
  resourceLifecycle: ResourceLifecyclePattern;
  tagCompliance: TagCompliancePattern;
  costAllocation: CostAllocationPattern;
}

export interface OrgUtilizationProfile {
  avgCpuAcrossFleet: number;
  avgMemoryAcrossFleet: number;
  avgStorageUtilization: number;
  overProvisionedPct: number;
  underProvisionedPct: number;
  rightSizedPct: number;
  idleResourcePct: number;
  orphanedResourcePct: number;
}

export interface SchedulingPattern {
  workloadType: string;
  peakHoursUtc: { start: number; end: number }[];
  quietHoursUtc: { start: number; end: number }[];
  weekendReduction: boolean;
  weekendUtilizationPct: number;
  scaleDownEligible: boolean;
  estimatedSavingsFromScheduling: number;
}

export interface ResourceLifecyclePattern {
  avgResourceLifetimeDays: number;
  medianResourceLifetimeDays: number;
  shortLivedPct: number;
  longLivedPct: number;
  resourceChurnRate: number;
  cleanupCadence: "daily" | "weekly" | "monthly" | "ad_hoc" | "never";
  orphanDetectionLag: number;
}

export interface TagCompliancePattern {
  overallTagCoverage: number;
  requiredTagsCoverage: Record<string, number>;
  mostMissedTags: string[];
  tagEnforcementActive: boolean;
  tagComplianceTrend: "improving" | "stable" | "degrading";
}

export interface CostAllocationPattern {
  allocationCompleteness: number;
  unallocatedCostPct: number;
  allocationMethod: "tags" | "accounts" | "resource_groups" | "manual" | "none";
  costCenterCount: number;
  topCostCenters: { name: string; monthlyUsd: number; percentOfTotal: number }[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// §7 — Optimization Priority Model
// ═══════════════════════════════════════════════════════════════════════════════

export interface OptimizationPriorityModel {
  lastUpdated: string;
  observationCount: number;
  overallPriority: OptimizationFocus;
  domainPriorities: DomainOptimizationPriority[];
  acceptedRecommendations: AcceptedRecommendationPattern[];
  rejectedRecommendations: RejectedRecommendationPattern[];
  implementationVelocity: ImplementationVelocity;
}

export type OptimizationFocus = "cost_first" | "security_first" | "reliability_first" | "compliance_first" | "balanced";

export interface DomainOptimizationPriority {
  domain: string;
  priority: number;
  acceptanceRate: number;
  avgImplementationDays: number;
  lastActionedAt: string | null;
  blockers: string[];
  observedFromCount: number;
}

export interface AcceptedRecommendationPattern {
  category: string;
  acceptanceRate: number;
  avgSavingsRealized: number;
  avgTimeToImplementDays: number;
  preferredExecutionWindow: string | null;
  count: number;
}

export interface RejectedRecommendationPattern {
  category: string;
  rejectionRate: number;
  topReasons: { reason: string; count: number }[];
  count: number;
  shouldSuppressFuture: boolean;
}

export interface ImplementationVelocity {
  pendingRecommendations: number;
  implementedLast30d: number;
  implementedLast90d: number;
  avgBacklogAgeDays: number;
  velocityTrend: "accelerating" | "stable" | "decelerating" | "stalled";
  bottleneckStage: string | null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// §8 — Execution Tendency Model
// ═══════════════════════════════════════════════════════════════════════════════

export interface ExecutionTendencyModel {
  lastUpdated: string;
  totalExecutions: number;
  successRate: number;
  rollbackRate: number;
  executionPreferences: ExecutionPreferenceSet;
  failurePatterns: ExecutionFailurePattern[];
  recoveryBehavior: RecoveryBehaviorProfile;
  verificationHabits: VerificationHabits;
}

export interface ExecutionPreferenceSet {
  preferredExecutionTime: "business_hours" | "after_hours" | "maintenance_window" | "any";
  batchSizePreference: "single" | "small_batch" | "medium_batch" | "large_batch";
  parallelExecutionComfort: "sequential_only" | "limited_parallel" | "parallel_acceptable";
  dryRunExpectation: "always" | "for_high_risk" | "optional" | "never";
  observedFromCount: number;
}

export interface ExecutionFailurePattern {
  failureType: string;
  occurrenceCount: number;
  lastOccurred: string;
  avgRecoveryMinutes: number;
  rootCauseCategories: string[];
  preventionAvailable: boolean;
  preventionDescription: string | null;
}

export interface RecoveryBehaviorProfile {
  avgTimeToDetectFailureMinutes: number;
  avgTimeToRecoverMinutes: number;
  preferredRecoveryMethod: "automatic_rollback" | "manual_rollback" | "forward_fix" | "escalate";
  rollbackSuccessRate: number;
  postFailureActions: ("pause_further_changes" | "incident_report" | "root_cause_analysis" | "notification" | "none")[];
  observedFromCount: number;
}

export interface VerificationHabits {
  postApplyVerificationRate: number;
  verificationDepth: "none" | "basic_health_check" | "functional_verification" | "comprehensive_testing";
  avgVerificationDurationMinutes: number;
  verificationFailureFollowUp: "immediate_rollback" | "investigation" | "escalation" | "ignore";
  observedFromCount: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// §9 — Workflow Efficiency Model
// ═══════════════════════════════════════════════════════════════════════════════

export interface WorkflowEfficiencyModel {
  lastUpdated: string;
  avgCycleTimeMinutes: number;
  stageBottlenecks: StageBottleneck[];
  approvalBottlenecks: ApprovalBottleneck[];
  handoffDelays: HandoffDelay[];
  throughputMetrics: ThroughputMetrics;
  wastedEffort: WastedEffortAnalysis;
}

export interface StageBottleneck {
  stage: string;
  avgDurationMinutes: number;
  p95DurationMinutes: number;
  isBottleneck: boolean;
  bottleneckSeverity: "mild" | "moderate" | "severe";
  cause: string;
  mitigation: string;
}

export interface ApprovalBottleneck {
  approvalType: string;
  avgWaitTimeMinutes: number;
  medianWaitTimeMinutes: number;
  timeoutRate: number;
  bottleneckCause: "slow_response" | "unclear_ownership" | "too_many_approvers" | "approval_fatigue" | "timezone_gap";
  suggestedImprovement: string;
}

export interface HandoffDelay {
  fromStage: string;
  toStage: string;
  avgDelayMinutes: number;
  cause: string;
  automationCandidate: boolean;
}

export interface ThroughputMetrics {
  recommendationsPerWeek: number;
  approvalsPerWeek: number;
  executionsPerWeek: number;
  successfulCompletionsPerWeek: number;
  throughputTrend: "increasing" | "stable" | "decreasing";
}

export interface WastedEffortAnalysis {
  abandonedRecommendationsPct: number;
  duplicateWorkPct: number;
  unnecessaryEscalationsPct: number;
  falsePositiveAlertsPct: number;
  totalWastedHoursPerMonth: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// §10 — Governance Learning Model
// ═══════════════════════════════════════════════════════════════════════════════

export interface GovernanceLearningModel {
  lastUpdated: string;
  observedPolicies: ObservedGovernancePolicy[];
  complianceFrameworks: DetectedComplianceFramework[];
  enforcementStyle: GovernanceEnforcementStyle;
  policyViolationPatterns: PolicyViolationPattern[];
  auditReadiness: AuditReadinessAssessment;
}

export interface ObservedGovernancePolicy {
  policyArea: string;
  observedBehavior: string;
  strictness: "lax" | "standard" | "strict" | "zero_tolerance";
  enforcedSince: string;
  violationCount: number;
  exceptionCount: number;
  exceptionPattern: string | null;
}

export interface DetectedComplianceFramework {
  framework: string;
  confidence: number;
  evidencePoints: string[];
  gapCount: number;
  lastAssessedAt: string;
}

export interface GovernanceEnforcementStyle {
  approachDescription: string;
  preventive: boolean;
  detective: boolean;
  corrective: boolean;
  policyAsCode: boolean;
  manualReviewRequired: boolean;
  observedFromCount: number;
}

export interface PolicyViolationPattern {
  policyArea: string;
  violationFrequency: number;
  avgResolutionDays: number;
  repeatOffenderResources: string[];
  rootCause: string;
  trendDirection: "increasing" | "stable" | "decreasing";
}

export interface AuditReadinessAssessment {
  overallReadiness: "not_ready" | "partially_ready" | "mostly_ready" | "audit_ready";
  evidenceCompleteness: number;
  controlCoverage: number;
  lastAuditDate: string | null;
  nextExpectedAudit: string | null;
  gapAreas: string[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// §11 — Adaptation State & Rules
// ═══════════════════════════════════════════════════════════════════════════════

export interface OrgAdaptationState {
  totalAdaptations: number;
  activeAdaptations: OrgBehavioralAdaptation[];
  pendingAdaptations: OrgBehavioralAdaptation[];
  frozenAdaptations: OrgBehavioralAdaptation[];
  revertedAdaptations: OrgBehavioralAdaptation[];
  adaptationBudget: OrgAdaptationBudget;
}

export interface OrgBehavioralAdaptation {
  id: string;
  name: string;
  category: OrgMemoryCategory;
  description: string;
  status: "proposed" | "active" | "frozen" | "reverted" | "expired";
  proposedAt: string;
  activatedAt: string | null;
  evidence: OrgAdaptationEvidence[];
  effect: OrgAdaptationEffect;
  constraints: OrgAdaptationConstraint;
  expiresAt: string | null;
  reviewSchedule: "weekly" | "biweekly" | "monthly" | "quarterly";
  lastReviewedAt: string | null;
}

export interface OrgAdaptationEvidence {
  observationId: string;
  description: string;
  confidence: number;
  observedAt: string;
}

export interface OrgAdaptationEffect {
  targetBehavior: string;
  adjustmentType: "increase" | "decrease" | "enable" | "disable" | "reweight";
  adjustmentMagnitude: number;
  affectedPhases: string[];
  affectedDomains: string[];
  explanation: string;
}

export interface OrgAdaptationConstraint {
  maxMagnitude: number;
  cannotEscalateAutonomy: boolean;
  cannotReduceSafety: boolean;
  cannotBypassApproval: boolean;
  requiresHumanActivation: boolean;
  autoRevertAfterDays: number | null;
}

export interface OrgAdaptationBudget {
  maxActiveAdaptations: number;
  maxAdaptationsPerMonth: number;
  currentActiveCount: number;
  adaptationsThisMonth: number;
  budgetRemaining: number;
  cooldownBetweenAdaptationsDays: number;
}

export const ORG_ADAPTATION_INVARIANTS: OrgAdaptationInvariant[] = [
  {
    name: "no_autonomy_escalation",
    description: "No adaptation may increase the agent's autonomy level, grant new permissions, or bypass existing approval gates. Autonomy is always human-granted.",
    enforcement: "architectural",
    violationResponse: "Adaptation is rejected. Incident logged. Human notified.",
  },
  {
    name: "no_safety_reduction",
    description: "No adaptation may reduce blast radius limits, increase cost ceilings, remove forbidden action types, or relax freeze periods.",
    enforcement: "architectural",
    violationResponse: "Adaptation is rejected. Safety boundary violation logged.",
  },
  {
    name: "no_governance_weakening",
    description: "No adaptation may disable governance policies, reduce compliance checking, or skip audit logging.",
    enforcement: "architectural",
    violationResponse: "Adaptation is rejected. Governance violation logged.",
  },
  {
    name: "bounded_magnitude",
    description: "Every adaptation has a maximum magnitude cap. Priority weights can shift by at most 20%. Confidence thresholds can shift by at most 10 points. No adaptation flips a boolean gate.",
    enforcement: "algorithmic",
    violationResponse: "Magnitude clamped to maximum. Over-range amount logged for human review.",
  },
  {
    name: "human_activation_for_high_impact",
    description: "Adaptations that affect more than 3 cognitive phases or more than 2 operational domains require explicit human activation. The agent proposes; the human decides.",
    enforcement: "architectural",
    violationResponse: "Adaptation remains in proposed state until human reviews and activates.",
  },
  {
    name: "auto_revert_window",
    description: "Every adaptation has an auto-revert window (default 30 days). If not renewed by human or agent review, the adaptation reverts to baseline behavior.",
    enforcement: "algorithmic",
    violationResponse: "Expired adaptations automatically revert. Reversion logged in transparency log.",
  },
  {
    name: "full_transparency",
    description: "Every adaptation — proposed, active, frozen, or reverted — is visible in the transparency log with full evidence chain, effect description, and rationale.",
    enforcement: "architectural",
    violationResponse: "Adaptations without transparency log entries are invalid and cannot activate.",
  },
  {
    name: "adaptation_budget",
    description: "The system limits the total number of active adaptations and the rate of new adaptations. This prevents runaway behavioral drift from compounding adjustments.",
    enforcement: "algorithmic",
    violationResponse: "New adaptations are queued until budget is available. Oldest low-impact adaptations may be expired to make room.",
  },
];

export interface OrgAdaptationInvariant {
  name: string;
  description: string;
  enforcement: "architectural" | "algorithmic";
  violationResponse: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// §12 — Transparency & Organizational Control
// ═══════════════════════════════════════════════════════════════════════════════

export interface TransparencyLogEntry {
  id: string;
  timestamp: string;
  eventType: TransparencyEventType;
  category: OrgMemoryCategory;
  summary: string;
  detail: string;
  evidence: string[];
  impact: string;
  reversible: boolean;
  humanVisible: boolean;
  acknowledged: boolean;
  acknowledgedBy: string | null;
  acknowledgedAt: string | null;
}

export type TransparencyEventType =
  | "observation_recorded"
  | "pattern_detected"
  | "adaptation_proposed"
  | "adaptation_activated"
  | "adaptation_frozen"
  | "adaptation_reverted"
  | "adaptation_expired"
  | "profile_updated"
  | "risk_posture_shifted"
  | "priority_reweighted"
  | "suppression_applied"
  | "manual_override_recorded"
  | "governance_learning_updated";

export interface OrgControlPanel {
  orgId: string;
  currentAdaptations: OrgBehavioralAdaptation[];
  proposedAdaptations: OrgBehavioralAdaptation[];
  operationalDnaSummary: OperationalDnaSummary;
  transparencyLog: TransparencyLogEntry[];
  overrideCapabilities: OrgOverride[];
}

export interface OperationalDnaSummary {
  maturity: OrgOperationalMaturity;
  changePhilosophy: string;
  riskTolerance: string;
  optimizationFocus: string;
  automationComfort: string;
  lastUpdated: string;
  confidenceLevel: number;
}

export interface OrgOverride {
  id: string;
  overrideType: OrgOverrideType;
  description: string;
  appliedAt: string;
  appliedBy: string;
  expiresAt: string | null;
  active: boolean;
}

export type OrgOverrideType =
  | "force_priority"
  | "suppress_category"
  | "lock_risk_tolerance"
  | "freeze_all_adaptations"
  | "reset_to_baseline"
  | "override_execution_preference"
  | "mandate_approval_for_all";

// ═══════════════════════════════════════════════════════════════════════════════
// §13 — Cognitive Integration Contracts
// ═══════════════════════════════════════════════════════════════════════════════

export interface OrgIntelligenceIntegration {
  subsystem: string;
  direction: "reads_from" | "writes_to" | "bidirectional";
  dataExchanged: string;
  cognitivePhases: string[];
  triggerCondition: string;
}

export const ORG_INTELLIGENCE_INTEGRATIONS: OrgIntelligenceIntegration[] = [
  {
    subsystem: "cognitiveCore",
    direction: "reads_from",
    dataExchanged: "OperationalDna informs confidence calibration, noise thresholds, and explanation depth at every phase.",
    cognitivePhases: ["observe", "interpret", "reason", "prioritize", "plan", "reflect"],
    triggerCondition: "Every cognitive loop iteration reads the current operational DNA.",
  },
  {
    subsystem: "reasoningEngine",
    direction: "writes_to",
    dataExchanged: "DomainRiskTolerance and DomainOptimizationPriority influence finding severity classification and recommendation ordering.",
    cognitivePhases: ["reason", "prioritize"],
    triggerCondition: "Reasoning phase applies org risk tolerances to adjust severity. Prioritize phase applies optimization priorities.",
  },
  {
    subsystem: "planningEngine",
    direction: "writes_to",
    dataExchanged: "ExecutionPreferenceSet, ChangePhilosophy, and ApprovalBehaviorModel inform plan phase ordering, batch sizing, and gate placement.",
    cognitivePhases: ["plan"],
    triggerCondition: "Plan generation reads execution preferences to match the org's operational rhythm.",
  },
  {
    subsystem: "autonomousOrchestrator",
    direction: "writes_to",
    dataExchanged: "ApprovalTemporalPattern and ApproverProfile data optimizes gate timing and approver routing.",
    cognitivePhases: ["plan", "execute"],
    triggerCondition: "Workflow scheduling reads temporal patterns to request approvals when response is fastest.",
  },
  {
    subsystem: "adaptiveBehavior",
    direction: "bidirectional",
    dataExchanged: "OrgBehavioralAdaptation definitions feed BehaviorSignal processing. AdaptiveBehavior results are recorded as observations.",
    cognitivePhases: ["reason", "prioritize", "reflect", "learn"],
    triggerCondition: "Every adaptive adjustment is constrained by org adaptation invariants.",
  },
  {
    subsystem: "workflowIntelligence",
    direction: "bidirectional",
    dataExchanged: "WorkflowEfficiencyModel feeds workflow optimization. Workflow observation signals feed back as org memory observations.",
    cognitivePhases: ["reflect", "learn"],
    triggerCondition: "Reflection phase evaluates workflow efficiency. Learn phase records new patterns.",
  },
  {
    subsystem: "operationalMemoryGraph",
    direction: "writes_to",
    dataExchanged: "Org memory observations are persisted as graph nodes. OrgBehavioralAdaptations are linked to evidence nodes.",
    cognitivePhases: ["learn"],
    triggerCondition: "Learn phase writes new observations and adaptation records to the memory graph.",
  },
  {
    subsystem: "governanceEngine",
    direction: "bidirectional",
    dataExchanged: "GovernanceLearningModel informs policy preset selection and severity mapping. Governance violations feed back as observation signals.",
    cognitivePhases: ["reason", "learn"],
    triggerCondition: "Governance evaluation reads learned policy patterns. Violations are recorded as observations for continuous learning.",
  },
  {
    subsystem: "infrastructureIntelligence",
    direction: "reads_from",
    dataExchanged: "GrowthIntelligenceModel and CloudUsagePatternModel consume infrastructure intelligence trend data and topology state.",
    cognitivePhases: ["observe", "interpret"],
    triggerCondition: "Each scan cycle reads intelligence layer outputs to update growth and usage models.",
  },
  {
    subsystem: "operationalSimulation",
    direction: "writes_to",
    dataExchanged: "OrgRiskPosture and ExecutionTendencyModel inform simulation context — risk thresholds, execution preferences, and historical incident patterns.",
    cognitivePhases: ["plan"],
    triggerCondition: "Simulation requests include org risk posture and execution preferences for context-appropriate risk scoring.",
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// §14 — Learning Pipeline
// ═══════════════════════════════════════════════════════════════════════════════

export type OrgLearningStage =
  | "observe_signal"
  | "classify_signal"
  | "update_model"
  | "detect_pattern"
  | "propose_adaptation"
  | "validate_adaptation"
  | "activate_or_queue"
  | "monitor_effect"
  | "review_and_renew";

export interface OrgLearningStageDefinition {
  stage: OrgLearningStage;
  order: number;
  description: string;
  inputs: string[];
  outputs: string[];
  maxDurationMs: number;
  failureMode: string;
}

export const ORG_LEARNING_PIPELINE: OrgLearningStageDefinition[] = [
  {
    stage: "observe_signal",
    order: 1,
    description: "Capture raw organizational signals — approval decisions, execution outcomes, configuration changes, budget actions, manual feedback.",
    inputs: ["ExternalEvent"],
    outputs: ["OrgMemoryObservation"],
    maxDurationMs: 1000,
    failureMode: "Signal loss is acceptable. Learning is eventual, not transactional.",
  },
  {
    stage: "classify_signal",
    order: 2,
    description: "Classify observation into memory category and determine which model(s) it updates.",
    inputs: ["OrgMemoryObservation"],
    outputs: ["ClassifiedSignal"],
    maxDurationMs: 500,
    failureMode: "Unclassifiable signals are logged and discarded. Never force-fit ambiguous signals.",
  },
  {
    stage: "update_model",
    order: 3,
    description: "Apply observation to the appropriate model using exponential moving averages with decay. Recent signals carry more weight.",
    inputs: ["ClassifiedSignal", "CurrentModel"],
    outputs: ["UpdatedModel"],
    maxDurationMs: 2000,
    failureMode: "Model update failures leave previous model intact. Never corrupt stable state with a failed update.",
  },
  {
    stage: "detect_pattern",
    order: 4,
    description: "After N observations of the same type, check if a stable pattern has emerged (e.g., approvals always faster on Tuesdays, cost changes consistently rejected).",
    inputs: ["UpdatedModel", "ObservationHistory"],
    outputs: ["DetectedPattern | null"],
    maxDurationMs: 5000,
    failureMode: "Pattern detection requires minimum observation count. Below threshold, no pattern reported.",
  },
  {
    stage: "propose_adaptation",
    order: 5,
    description: "If a pattern is strong enough (confidence > 0.7, observation count > 10), propose a behavioral adaptation.",
    inputs: ["DetectedPattern"],
    outputs: ["OrgBehavioralAdaptation (proposed)"],
    maxDurationMs: 2000,
    failureMode: "Weak patterns are recorded but do not generate adaptations. They may strengthen over time.",
  },
  {
    stage: "validate_adaptation",
    order: 6,
    description: "Check proposed adaptation against all invariants — no autonomy escalation, no safety reduction, bounded magnitude, budget available.",
    inputs: ["OrgBehavioralAdaptation (proposed)"],
    outputs: ["ValidatedAdaptation | RejectedAdaptation"],
    maxDurationMs: 1000,
    failureMode: "Adaptations that violate invariants are rejected with detailed explanation.",
  },
  {
    stage: "activate_or_queue",
    order: 7,
    description: "Low-impact adaptations activate immediately. High-impact adaptations enter proposed state awaiting human activation.",
    inputs: ["ValidatedAdaptation"],
    outputs: ["ActivatedAdaptation | QueuedAdaptation"],
    maxDurationMs: 1000,
    failureMode: "If budget is exhausted, adaptation is queued. If queue is full, lowest-priority adaptation is dropped.",
  },
  {
    stage: "monitor_effect",
    order: 8,
    description: "After activation, monitor the adaptation's effect on the target metric. Compare against expected impact.",
    inputs: ["ActivatedAdaptation", "OngoingMetrics"],
    outputs: ["EffectAssessment"],
    maxDurationMs: 0,
    failureMode: "Continuous stage. Runs in background. Assessment windows are 7, 14, and 30 days post-activation.",
  },
  {
    stage: "review_and_renew",
    order: 9,
    description: "At scheduled review intervals, evaluate whether adaptation is still valid. Renew, freeze, or revert based on measured effect and continued relevance.",
    inputs: ["EffectAssessment", "HumanFeedback"],
    outputs: ["RenewedAdaptation | FrozenAdaptation | RevertedAdaptation"],
    maxDurationMs: 5000,
    failureMode: "If review is missed, adaptation auto-reverts at expiry deadline.",
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// §15 — Query Functions
// ═══════════════════════════════════════════════════════════════════════════════

export function getOrgLearningStage(stage: OrgLearningStage): OrgLearningStageDefinition | undefined {
  return ORG_LEARNING_PIPELINE.find((s) => s.stage === stage);
}

export function getOrgLearningStageOrder(): OrgLearningStage[] {
  return [...ORG_LEARNING_PIPELINE].sort((a, b) => a.order - b.order).map((s) => s.stage);
}

export function getOrgIntegrationForSubsystem(subsystem: string): OrgIntelligenceIntegration | undefined {
  return ORG_INTELLIGENCE_INTEGRATIONS.find((i) => i.subsystem === subsystem);
}

export function getOrgIntegrationsByPhase(phase: string): OrgIntelligenceIntegration[] {
  return ORG_INTELLIGENCE_INTEGRATIONS.filter((i) => i.cognitivePhases.includes(phase));
}

export function validateOrgAdaptation(adaptation: OrgBehavioralAdaptation): {
  valid: boolean;
  violations: string[];
} {
  const violations: string[] = [];

  if (!adaptation.constraints.cannotEscalateAutonomy) {
    violations.push("Adaptation must have cannotEscalateAutonomy = true");
  }

  if (!adaptation.constraints.cannotReduceSafety) {
    violations.push("Adaptation must have cannotReduceSafety = true");
  }

  if (!adaptation.constraints.cannotBypassApproval) {
    violations.push("Adaptation must have cannotBypassApproval = true");
  }

  if (adaptation.effect.adjustmentMagnitude > adaptation.constraints.maxMagnitude) {
    violations.push(
      `Adjustment magnitude ${adaptation.effect.adjustmentMagnitude} exceeds max ${adaptation.constraints.maxMagnitude}`,
    );
  }

  if (adaptation.effect.affectedPhases.length > 3 && !adaptation.constraints.requiresHumanActivation) {
    violations.push("Adaptations affecting >3 phases require human activation");
  }

  if (adaptation.effect.affectedDomains.length > 2 && !adaptation.constraints.requiresHumanActivation) {
    violations.push("Adaptations affecting >2 domains require human activation");
  }

  if (adaptation.evidence.length === 0) {
    violations.push("Adaptations require at least one evidence observation");
  }

  return { valid: violations.length === 0, violations };
}

export function getAdaptationBudgetStatus(state: OrgAdaptationState): {
  activeCount: number;
  maxActive: number;
  monthlyCount: number;
  maxMonthly: number;
  canPropose: boolean;
  reason: string;
} {
  const { adaptationBudget } = state;
  const canPropose =
    adaptationBudget.currentActiveCount < adaptationBudget.maxActiveAdaptations &&
    adaptationBudget.adaptationsThisMonth < adaptationBudget.maxAdaptationsPerMonth;

  let reason = "Budget available";
  if (adaptationBudget.currentActiveCount >= adaptationBudget.maxActiveAdaptations) {
    reason = "Active adaptation limit reached";
  } else if (adaptationBudget.adaptationsThisMonth >= adaptationBudget.maxAdaptationsPerMonth) {
    reason = "Monthly adaptation limit reached";
  }

  return {
    activeCount: adaptationBudget.currentActiveCount,
    maxActive: adaptationBudget.maxActiveAdaptations,
    monthlyCount: adaptationBudget.adaptationsThisMonth,
    maxMonthly: adaptationBudget.maxAdaptationsPerMonth,
    canPropose,
    reason,
  };
}

export function computeOrgMaturity(dna: OperationalDna): {
  maturity: OrgOperationalMaturity;
  score: number;
  factors: { factor: string; score: number; weight: number }[];
} {
  const factors: { factor: string; score: number; weight: number }[] = [];

  const iacScore = { none: 0, partial: 30, majority: 60, full: 100 }[dna.cloudStrategy.iacAdoption];
  factors.push({ factor: "IaC adoption", score: iacScore, weight: 0.2 });

  const automationScore = { never: 0, safe_only: 25, low_risk: 50, medium_risk: 75 }[dna.automationComfort.autoApproveThreshold];
  factors.push({ factor: "Automation comfort", score: automationScore, weight: 0.15 });

  const complianceScore = { minimal: 20, standard: 50, strict: 75, regulated: 90 }[dna.complianceOrientation];
  factors.push({ factor: "Compliance orientation", score: complianceScore, weight: 0.15 });

  const changeScore = { conservative: 30, measured: 50, moderate: 70, aggressive: 85 }[dna.changePhilosophy.preferredPace];
  factors.push({ factor: "Change maturity", score: changeScore, weight: 0.15 });

  const testingScore = { no_testing: 0, basic_verification: 30, comprehensive_testing: 70, canary_then_full: 100 }[dna.changePhilosophy.testingExpectation];
  factors.push({ factor: "Testing maturity", score: testingScore, weight: 0.15 });

  const rollbackScore = { manual_acceptable: 30, automated_preferred: 60, automated_required: 90 }[dna.changePhilosophy.rollbackExpectation];
  factors.push({ factor: "Rollback maturity", score: rollbackScore, weight: 0.1 });

  const ciCdScore = dna.cloudStrategy.ciCdIntegrated ? 80 : 20;
  factors.push({ factor: "CI/CD integration", score: ciCdScore, weight: 0.1 });

  const overallScore = Math.round(factors.reduce((sum, f) => sum + f.score * f.weight, 0));

  let maturity: OrgOperationalMaturity;
  if (overallScore < 20) maturity = "nascent";
  else if (overallScore < 40) maturity = "emerging";
  else if (overallScore < 60) maturity = "established";
  else if (overallScore < 80) maturity = "advanced";
  else maturity = "leading";

  return { maturity, score: overallScore, factors };
}

// ═══════════════════════════════════════════════════════════════════════════════
// §16 — Tests
// ═══════════════════════════════════════════════════════════════════════════════

export interface OrgIntelligenceTestResult {
  name: string;
  passed: boolean;
  detail: string;
}

export function runOrganizationalIntelligenceTests(): OrgIntelligenceTestResult[] {
  const results: OrgIntelligenceTestResult[] = [];

  function assert(name: string, condition: boolean, detail: string) {
    results.push({ name, passed: condition, detail });
  }

  // Adaptation invariants
  assert(
    "Adaptation invariants defined",
    ORG_ADAPTATION_INVARIANTS.length >= 8,
    `Invariants: ${ORG_ADAPTATION_INVARIANTS.length}`,
  );

  assert(
    "No-autonomy-escalation invariant exists",
    ORG_ADAPTATION_INVARIANTS.some((i) => i.name === "no_autonomy_escalation"),
    "Critical invariant present",
  );

  assert(
    "No-safety-reduction invariant exists",
    ORG_ADAPTATION_INVARIANTS.some((i) => i.name === "no_safety_reduction"),
    "Critical invariant present",
  );

  assert(
    "No-governance-weakening invariant exists",
    ORG_ADAPTATION_INVARIANTS.some((i) => i.name === "no_governance_weakening"),
    "Critical invariant present",
  );

  assert(
    "Full-transparency invariant exists",
    ORG_ADAPTATION_INVARIANTS.some((i) => i.name === "full_transparency"),
    "Critical invariant present",
  );

  // Learning pipeline
  assert(
    "Learning pipeline has 9 stages",
    ORG_LEARNING_PIPELINE.length === 9,
    `Stages: ${ORG_LEARNING_PIPELINE.length}`,
  );

  assert(
    "Learning pipeline stages ordered 1-9",
    ORG_LEARNING_PIPELINE.every((s, i) => s.order === i + 1),
    "All stages have correct sequential ordering",
  );

  assert(
    "Pipeline starts with observe_signal",
    ORG_LEARNING_PIPELINE[0].stage === "observe_signal",
    `First stage: ${ORG_LEARNING_PIPELINE[0].stage}`,
  );

  assert(
    "Pipeline ends with review_and_renew",
    ORG_LEARNING_PIPELINE[ORG_LEARNING_PIPELINE.length - 1].stage === "review_and_renew",
    `Last stage: ${ORG_LEARNING_PIPELINE[ORG_LEARNING_PIPELINE.length - 1].stage}`,
  );

  // Integration contracts
  assert(
    "Integration contracts cover key subsystems",
    ORG_INTELLIGENCE_INTEGRATIONS.some((i) => i.subsystem === "cognitiveCore") &&
    ORG_INTELLIGENCE_INTEGRATIONS.some((i) => i.subsystem === "reasoningEngine") &&
    ORG_INTELLIGENCE_INTEGRATIONS.some((i) => i.subsystem === "planningEngine") &&
    ORG_INTELLIGENCE_INTEGRATIONS.some((i) => i.subsystem === "governanceEngine"),
    "Core subsystem integrations present",
  );

  assert(
    "All integrations specify cognitive phases",
    ORG_INTELLIGENCE_INTEGRATIONS.every((i) => i.cognitivePhases.length > 0),
    "Every integration specifies at least one cognitive phase",
  );

  assert(
    "Bidirectional integrations exist",
    ORG_INTELLIGENCE_INTEGRATIONS.filter((i) => i.direction === "bidirectional").length >= 3,
    `Bidirectional: ${ORG_INTELLIGENCE_INTEGRATIONS.filter((i) => i.direction === "bidirectional").length}`,
  );

  // Adaptation validation
  const validAdaptation: OrgBehavioralAdaptation = {
    id: "test-1",
    name: "Test adaptation",
    category: "approval_pattern",
    description: "Test",
    status: "proposed",
    proposedAt: "2026-05-01",
    activatedAt: null,
    evidence: [{ observationId: "obs-1", description: "Test observation", confidence: 0.8, observedAt: "2026-05-01" }],
    effect: {
      targetBehavior: "approval_timing",
      adjustmentType: "reweight",
      adjustmentMagnitude: 0.1,
      affectedPhases: ["plan"],
      affectedDomains: ["cost_optimization"],
      explanation: "Schedule approvals for Tuesday mornings when response is fastest",
    },
    constraints: {
      maxMagnitude: 0.2,
      cannotEscalateAutonomy: true,
      cannotReduceSafety: true,
      cannotBypassApproval: true,
      requiresHumanActivation: false,
      autoRevertAfterDays: 30,
    },
    expiresAt: "2026-06-01",
    reviewSchedule: "monthly",
    lastReviewedAt: null,
  };

  const validationResult = validateOrgAdaptation(validAdaptation);
  assert(
    "Valid adaptation passes validation",
    validationResult.valid,
    `Violations: ${validationResult.violations.join(", ") || "none"}`,
  );

  const unsafeAdaptation = {
    ...validAdaptation,
    constraints: { ...validAdaptation.constraints, cannotEscalateAutonomy: false },
  };
  const unsafeResult = validateOrgAdaptation(unsafeAdaptation);
  assert(
    "Unsafe adaptation fails validation",
    !unsafeResult.valid,
    `Correctly caught: ${unsafeResult.violations.join(", ")}`,
  );

  const overMagnitudeAdaptation = {
    ...validAdaptation,
    effect: { ...validAdaptation.effect, adjustmentMagnitude: 0.5 },
  };
  const overMagnitudeResult = validateOrgAdaptation(overMagnitudeAdaptation);
  assert(
    "Over-magnitude adaptation fails validation",
    !overMagnitudeResult.valid,
    `Correctly caught: ${overMagnitudeResult.violations.join(", ")}`,
  );

  const multiPhaseAdaptation = {
    ...validAdaptation,
    effect: { ...validAdaptation.effect, affectedPhases: ["observe", "interpret", "reason", "prioritize"] },
    constraints: { ...validAdaptation.constraints, requiresHumanActivation: false },
  };
  const multiPhaseResult = validateOrgAdaptation(multiPhaseAdaptation);
  assert(
    "Multi-phase adaptation without human activation fails",
    !multiPhaseResult.valid,
    `Correctly caught: ${multiPhaseResult.violations.join(", ")}`,
  );

  // Adaptation budget
  const testState: OrgAdaptationState = {
    totalAdaptations: 10,
    activeAdaptations: [],
    pendingAdaptations: [],
    frozenAdaptations: [],
    revertedAdaptations: [],
    adaptationBudget: {
      maxActiveAdaptations: 15,
      maxAdaptationsPerMonth: 5,
      currentActiveCount: 10,
      adaptationsThisMonth: 3,
      budgetRemaining: 5,
      cooldownBetweenAdaptationsDays: 3,
    },
  };

  const budgetStatus = getAdaptationBudgetStatus(testState);
  assert(
    "Budget status reports correctly",
    budgetStatus.canPropose && budgetStatus.activeCount === 10,
    `Can propose: ${budgetStatus.canPropose}, Active: ${budgetStatus.activeCount}`,
  );

  const exhaustedState = {
    ...testState,
    adaptationBudget: { ...testState.adaptationBudget, currentActiveCount: 15 },
  };
  const exhaustedBudget = getAdaptationBudgetStatus(exhaustedState);
  assert(
    "Exhausted budget blocks new proposals",
    !exhaustedBudget.canPropose,
    `Reason: ${exhaustedBudget.reason}`,
  );

  // Maturity computation
  const testDna: OperationalDna = {
    orgId: "test",
    profiledSince: "2025-01-01",
    lastUpdated: "2026-05-01",
    observationCount: 500,
    maturity: "established",
    changePhilosophy: {
      preferredPace: "moderate",
      batchPreference: "medium_batches",
      testingExpectation: "comprehensive_testing",
      rollbackExpectation: "automated_preferred",
      maintenanceWindowRequired: true,
      observedFromCount: 100,
    },
    communicationStyle: {
      detailLevel: "key_details",
      explanationPreference: "brief_rationale",
      notificationFrequency: "important",
      observedFromCount: 50,
    },
    decisionSpeed: {
      avgApprovalTimeMinutes: 45,
      medianApprovalTimeMinutes: 30,
      p95ApprovalTimeMinutes: 180,
      approvalsDuringBusinessHours: 85,
      approvalsOutsideBusinessHours: 15,
      businessHoursStart: 9,
      businessHoursEnd: 17,
      timezone: "America/New_York",
      observedFromCount: 200,
    },
    automationComfort: {
      currentTrustLevel: 3,
      maxGrantedAutonomy: 4,
      autoApproveThreshold: "low_risk",
      manualOverrideFrequency: 5,
      escalationFrequency: 8,
      trendDirection: "increasing_trust",
      observedFromCount: 150,
    },
    cloudStrategy: {
      primaryProvider: "aws",
      activeProviders: ["aws", "azure"],
      multiCloudMotivation: "regulatory",
      iacAdoption: "majority",
      iacTool: "terraform",
      ciCdIntegrated: true,
      observedFromCount: 100,
    },
    complianceOrientation: "strict",
    costSensitivity: "cost_conscious",
  };

  const maturityResult = computeOrgMaturity(testDna);
  assert(
    "Maturity computation produces valid result",
    maturityResult.score >= 0 && maturityResult.score <= 100,
    `Score: ${maturityResult.score}, Maturity: ${maturityResult.maturity}`,
  );

  assert(
    "Maturity computation includes all factors",
    maturityResult.factors.length >= 7,
    `Factors: ${maturityResult.factors.length}`,
  );

  assert(
    "Maturity factor weights sum to ~1.0",
    Math.abs(maturityResult.factors.reduce((sum, f) => sum + f.weight, 0) - 1.0) < 0.001,
    `Weight sum: ${maturityResult.factors.reduce((sum, f) => sum + f.weight, 0)}`,
  );

  // Query functions
  assert(
    "getOrgLearningStageOrder returns all stages",
    getOrgLearningStageOrder().length === 9,
    `Stages: ${getOrgLearningStageOrder().length}`,
  );

  assert(
    "getOrgIntegrationsByPhase returns results for reason",
    getOrgIntegrationsByPhase("reason").length >= 3,
    `Reason phase integrations: ${getOrgIntegrationsByPhase("reason").length}`,
  );

  assert(
    "getOrgIntegrationForSubsystem returns result for cognitiveCore",
    getOrgIntegrationForSubsystem("cognitiveCore") !== undefined,
    "CognitiveCore integration found",
  );

  return results;
}
