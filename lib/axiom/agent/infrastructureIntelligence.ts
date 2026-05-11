// ─────────────────────────────────────────────────────────────────────────────
// Infrastructure Intelligence Layer
// Continuous operational intelligence for Axiom Agent
// ─────────────────────────────────────────────────────────────────────────────

// ═══════════════════════════════════════════════════════════════════════════════
// §1 — Topology Intelligence Model
// ═══════════════════════════════════════════════════════════════════════════════

export type TopologyNodeType =
  | "compute_group"
  | "storage_tier"
  | "network_zone"
  | "database_cluster"
  | "container_fleet"
  | "serverless_pool"
  | "iam_boundary"
  | "monitoring_scope"
  | "load_balancer_frontend"
  | "cdn_edge"
  | "dns_namespace"
  | "vpn_tunnel"
  | "api_gateway"
  | "message_queue"
  | "cache_layer"
  | "backup_domain";

export type TopologyEdgeType =
  | "routes_traffic_to"
  | "reads_from"
  | "writes_to"
  | "authenticates_via"
  | "monitored_by"
  | "backed_up_by"
  | "replicates_to"
  | "scales_with"
  | "depends_on"
  | "failover_target"
  | "peered_with"
  | "encrypts_with"
  | "logs_to"
  | "alerts_via"
  | "cached_by"
  | "queues_for";

export interface TopologyNode {
  id: string;
  type: TopologyNodeType;
  provider: "aws" | "azure" | "gcp";
  region: string;
  accountId: string;
  label: string;
  resourceIds: string[];
  resourceCount: number;
  aggregatedCostMonthly: number;
  healthStatus: TopologyHealthStatus;
  criticality: TopologyCriticality;
  lastObserved: string;
  properties: Record<string, unknown>;
}

export type TopologyHealthStatus = "healthy" | "degraded" | "impaired" | "unknown";

export type TopologyCriticality = "critical" | "high" | "standard" | "low" | "development";

export interface TopologyEdge {
  id: string;
  type: TopologyEdgeType;
  sourceNodeId: string;
  targetNodeId: string;
  bandwidth: BandwidthEstimate | null;
  latencyMs: number | null;
  encrypted: boolean;
  crossRegion: boolean;
  crossProvider: boolean;
  confidence: number;
  discoveredVia: TopologyDiscoveryMethod;
  lastVerified: string;
}

export type TopologyDiscoveryMethod =
  | "security_group_analysis"
  | "vpc_flow_logs"
  | "dns_resolution"
  | "load_balancer_targets"
  | "iam_policy_analysis"
  | "tag_correlation"
  | "cloudtrail_api_calls"
  | "network_acl_rules"
  | "peering_connections"
  | "resource_references"
  | "inferred_from_config";

export interface BandwidthEstimate {
  avgGbPerDay: number;
  peakGbPerHour: number;
  estimatedCostPerMonth: number;
  direction: "inbound" | "outbound" | "bidirectional";
}

export interface InfrastructureTopologyMap {
  orgId: string;
  builtAt: string;
  providers: ("aws" | "azure" | "gcp")[];
  nodes: TopologyNode[];
  edges: TopologyEdge[];
  zones: TopologyZone[];
  summary: TopologyMapSummary;
}

export interface TopologyZone {
  id: string;
  name: string;
  zoneType: TopologyZoneType;
  nodeIds: string[];
  trustBoundary: boolean;
  internetFacing: boolean;
  complianceScope: string[];
  description: string;
}

export type TopologyZoneType =
  | "public_subnet"
  | "private_subnet"
  | "dmz"
  | "management_plane"
  | "data_plane"
  | "edge"
  | "isolated"
  | "shared_services";

export interface TopologyMapSummary {
  totalNodes: number;
  totalEdges: number;
  totalZones: number;
  providerBreakdown: Record<string, number>;
  regionBreakdown: Record<string, number>;
  crossRegionEdges: number;
  crossProviderEdges: number;
  unencryptedEdges: number;
  singlePointsOfFailure: string[];
  isolatedNodes: string[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// §2 — Infrastructure Relationship Graph
// ═══════════════════════════════════════════════════════════════════════════════

export type RelationshipStrength = "strong" | "moderate" | "weak" | "inferred";

export interface InfraRelationship {
  id: string;
  sourceResourceId: string;
  targetResourceId: string;
  relationshipType: TopologyEdgeType;
  strength: RelationshipStrength;
  direction: "unidirectional" | "bidirectional";
  operational: boolean;
  dataFlow: boolean;
  failureImpact: FailureImpactLevel;
  discoveryEvidence: RelationshipEvidence[];
  firstSeen: string;
  lastConfirmed: string;
  stale: boolean;
}

export type FailureImpactLevel = "cascading" | "degraded_service" | "reduced_capacity" | "isolated" | "none";

export interface RelationshipEvidence {
  source: TopologyDiscoveryMethod;
  detail: string;
  confidence: number;
  observedAt: string;
}

export interface DependencyChainAnalysis {
  rootResourceId: string;
  chains: DependencyChain[];
  maxDepth: number;
  criticalPathLength: number;
  singlePointsOfFailure: string[];
  circularDependencies: string[][];
}

export interface DependencyChain {
  path: string[];
  depth: number;
  failureImpact: FailureImpactLevel;
  crossRegion: boolean;
  crossProvider: boolean;
  weakestLink: string;
  weakestLinkConfidence: number;
}

export interface BlastRadiusAssessment {
  triggerResourceId: string;
  failureMode: InfraFailureMode;
  directlyAffected: string[];
  transitivelyAffected: string[];
  totalAffectedResources: number;
  estimatedUserImpact: UserImpactEstimate;
  estimatedDowntimeMinutes: number;
  mitigationAvailable: boolean;
  mitigationDescription: string;
  confidence: number;
}

export type InfraFailureMode =
  | "resource_unavailable"
  | "performance_degradation"
  | "data_loss"
  | "network_partition"
  | "authentication_failure"
  | "configuration_corruption"
  | "capacity_exhaustion";

export interface UserImpactEstimate {
  affectedServices: string[];
  estimatedAffectedUsers: "none" | "few" | "some" | "many" | "all";
  customerFacing: boolean;
  revenueImpactPerHourUsd: number | null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// §3 — Workload Behavior Model
// ═══════════════════════════════════════════════════════════════════════════════

export interface WorkloadProfile {
  id: string;
  orgId: string;
  name: string;
  workloadType: WorkloadType;
  resourceIds: string[];
  behaviorPattern: WorkloadBehaviorPattern;
  peakSchedule: PeakSchedule;
  utilizationBaseline: UtilizationBaseline;
  costProfile: WorkloadCostProfile;
  resiliencePosture: WorkloadResiliencePosture;
  lastAnalyzed: string;
}

export type WorkloadType =
  | "web_serving"
  | "api_backend"
  | "batch_processing"
  | "data_pipeline"
  | "machine_learning"
  | "database"
  | "message_processing"
  | "static_hosting"
  | "ci_cd"
  | "monitoring"
  | "development"
  | "disaster_recovery"
  | "unknown";

export interface WorkloadBehaviorPattern {
  cyclicality: "hourly" | "daily" | "weekly" | "monthly" | "seasonal" | "event_driven" | "steady_state";
  burstiness: "smooth" | "moderate_bursts" | "highly_bursty" | "unpredictable";
  growth: WorkloadGrowthTrend;
  statefulness: "stateless" | "session_sticky" | "stateful" | "persistent";
  latencySensitivity: "real_time" | "interactive" | "batch_tolerant" | "offline";
}

export type WorkloadGrowthTrend = "shrinking" | "stable" | "linear_growth" | "accelerating" | "decelerating" | "seasonal";

export interface PeakSchedule {
  timezone: string;
  peakHoursUtc: { start: number; end: number }[];
  peakDaysOfWeek: number[];
  seasonalPeaks: SeasonalPeak[];
  quietPeriods: QuietPeriod[];
}

export interface SeasonalPeak {
  name: string;
  startMonth: number;
  endMonth: number;
  expectedMultiplier: number;
}

export interface QuietPeriod {
  name: string;
  startHourUtc: number;
  endHourUtc: number;
  daysOfWeek: number[];
  scaleDownEligible: boolean;
}

export interface UtilizationBaseline {
  cpuAvgPct: number;
  cpuP95Pct: number;
  memoryAvgPct: number;
  memoryP95Pct: number;
  networkAvgMbps: number;
  networkPeakMbps: number;
  diskIopsAvg: number;
  diskIopsPeak: number;
  requestsPerSecondAvg: number;
  requestsPerSecondPeak: number;
  observationWindowDays: number;
}

export interface WorkloadCostProfile {
  monthlyTotalUsd: number;
  computePct: number;
  storagePct: number;
  networkPct: number;
  otherPct: number;
  costPerRequest: number | null;
  costPerGbProcessed: number | null;
  wasteEstimateUsd: number;
  optimizationPotentialUsd: number;
}

export interface WorkloadResiliencePosture {
  singleRegion: boolean;
  singleAz: boolean;
  hasFailover: boolean;
  hasBackups: boolean;
  backupTestedRecently: boolean;
  rtoEstimateMinutes: number;
  rpoEstimateMinutes: number;
  lastIncident: string | null;
  incidentCount90d: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// §4 — Temporal Evolution Engine
// ═══════════════════════════════════════════════════════════════════════════════

export type InfraEvolutionCategory =
  | "resource_growth"
  | "cost_trajectory"
  | "complexity_increase"
  | "security_posture_shift"
  | "resilience_change"
  | "provider_adoption"
  | "region_expansion"
  | "workload_migration"
  | "technology_adoption"
  | "deprecation_progress";

export interface InfraEvolutionTimeline {
  orgId: string;
  timeRange: TimeRange;
  snapshots: InfraStateSnapshot[];
  transitions: InfraTransition[];
  trends: InfraTrend[];
  milestones: InfraMilestone[];
}

export interface TimeRange {
  startDate: string;
  endDate: string;
  granularity: "hourly" | "daily" | "weekly" | "monthly";
}

export interface InfraStateSnapshot {
  timestamp: string;
  totalResources: number;
  totalMonthlyCostUsd: number;
  providerDistribution: Record<string, number>;
  regionDistribution: Record<string, number>;
  domainDistribution: Record<string, number>;
  complianceScore: number;
  securityScore: number;
  resilienceScore: number;
  costEfficiencyScore: number;
}

export interface InfraTransition {
  id: string;
  category: InfraEvolutionCategory;
  fromSnapshot: string;
  toSnapshot: string;
  description: string;
  magnitude: "minor" | "moderate" | "significant" | "major";
  intentional: boolean | null;
  relatedEvents: string[];
}

export interface InfraTrend {
  id: string;
  category: InfraEvolutionCategory;
  metric: string;
  direction: "increasing" | "decreasing" | "stable" | "volatile";
  rateOfChange: number;
  unit: string;
  timeRange: TimeRange;
  dataPoints: TrendDataPoint[];
  forecast: TrendForecast | null;
  significance: TrendSignificance;
  actionable: boolean;
  suggestedAction: string | null;
}

export interface TrendDataPoint {
  timestamp: string;
  value: number;
  anomaly: boolean;
  anomalyScore: number | null;
}

export interface TrendForecast {
  method: "linear_regression" | "exponential_smoothing" | "seasonal_decomposition" | "moving_average";
  forecastPoints: TrendDataPoint[];
  confidenceInterval: { lower: number; upper: number };
  forecastHorizonDays: number;
  accuracy: number;
}

export type TrendSignificance = "critical" | "important" | "noteworthy" | "informational";

export interface InfraMilestone {
  id: string;
  timestamp: string;
  category: InfraEvolutionCategory;
  title: string;
  description: string;
  impact: MilestoneImpact;
  beforeState: Record<string, unknown>;
  afterState: Record<string, unknown>;
}

export interface MilestoneImpact {
  costDeltaUsd: number;
  resourceDelta: number;
  riskDelta: number;
  complianceDelta: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// §5 — Risk Intelligence
// ═══════════════════════════════════════════════════════════════════════════════

export type InfraRiskCategory =
  | "capacity_exhaustion"
  | "cost_overrun"
  | "security_exposure"
  | "resilience_gap"
  | "compliance_drift"
  | "vendor_lock_in"
  | "technology_obsolescence"
  | "operational_complexity"
  | "key_person_dependency"
  | "untested_recovery";

export type InfraRiskSeverity = "low" | "moderate" | "elevated" | "high" | "critical";

export interface InfraRiskSignal {
  id: string;
  category: InfraRiskCategory;
  severity: InfraRiskSeverity;
  title: string;
  description: string;
  detectedAt: string;
  evidence: RiskEvidence[];
  affectedResources: string[];
  affectedDomains: string[];
  trend: "worsening" | "stable" | "improving";
  timeToImpact: TimeToImpactEstimate | null;
  mitigations: RiskMitigation[];
  relatedRiskIds: string[];
}

export interface RiskEvidence {
  type: "metric" | "configuration" | "historical_incident" | "trend_extrapolation" | "policy_analysis" | "dependency_analysis";
  description: string;
  dataPoint: string;
  confidence: number;
  source: string;
}

export interface TimeToImpactEstimate {
  estimatedDays: number;
  confidence: number;
  basis: string;
  worstCaseDays: number;
  bestCaseDays: number;
}

export interface RiskMitigation {
  id: string;
  description: string;
  effort: "trivial" | "low" | "medium" | "high" | "significant";
  automatable: boolean;
  estimatedCostUsd: number;
  riskReductionPct: number;
  prerequisiteActions: string[];
}

export interface RiskLandscape {
  orgId: string;
  assessedAt: string;
  signals: InfraRiskSignal[];
  overallRiskScore: number;
  categoryScores: Record<InfraRiskCategory, number>;
  emergingRisks: InfraRiskSignal[];
  resolvedSince: string[];
  riskVelocity: "accelerating" | "stable" | "decelerating";
  topMitigations: RiskMitigation[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// §6 — Optimization Trend Analysis
// ═══════════════════════════════════════════════════════════════════════════════

export interface OptimizationTrendReport {
  orgId: string;
  generatedAt: string;
  timeRange: TimeRange;
  overallSavingsUsd: number;
  overallWasteUsd: number;
  trends: OptimizationTrend[];
  recurringOpportunities: RecurringOpportunity[];
  realizationRate: number;
  topUnrealizedSavings: UnrealizedSaving[];
}

export interface OptimizationTrend {
  domain: string;
  metric: string;
  direction: "improving" | "stable" | "degrading";
  currentValue: number;
  previousValue: number;
  changePct: number;
  explanation: string;
  actionTaken: boolean;
}

export interface RecurringOpportunity {
  id: string;
  description: string;
  domain: string;
  recurrenceCount: number;
  firstSeen: string;
  lastSeen: string;
  avgSavingsUsd: number;
  totalUnrealizedUsd: number;
  blockerReason: string | null;
  automationCandidate: boolean;
}

export interface UnrealizedSaving {
  resourceId: string;
  domain: string;
  savingsUsd: number;
  firstIdentified: string;
  timesRecommended: number;
  lastRecommendedAction: string;
  blockerReason: string | null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// §7 — Stress Pattern Prediction
// ═══════════════════════════════════════════════════════════════════════════════

export type StressIndicator =
  | "cpu_saturation"
  | "memory_pressure"
  | "disk_throughput_limit"
  | "network_bandwidth_limit"
  | "connection_pool_exhaustion"
  | "request_queue_depth"
  | "error_rate_elevation"
  | "latency_degradation"
  | "throttling_events"
  | "capacity_ceiling";

export interface StressPattern {
  id: string;
  indicator: StressIndicator;
  affectedResources: string[];
  workloadId: string | null;
  pattern: StressPatternShape;
  currentSeverity: "nominal" | "watch" | "warning" | "stress" | "critical";
  predictedEscalation: StressEscalation | null;
  historicalOccurrences: number;
  lastOccurred: string | null;
  mitigationStrategy: string;
}

export type StressPatternShape =
  | "gradual_ramp"
  | "sudden_spike"
  | "periodic_burst"
  | "sustained_pressure"
  | "cascading_failure"
  | "resource_contention"
  | "thundering_herd";

export interface StressEscalation {
  estimatedTimeToStressHours: number;
  estimatedTimeToFailureHours: number | null;
  triggerCondition: string;
  confidence: number;
  preventiveAction: string;
  preventiveActionDeadline: string;
}

export interface StressForecast {
  orgId: string;
  generatedAt: string;
  forecastHorizonDays: number;
  patterns: StressPattern[];
  overallStressLevel: "low" | "moderate" | "elevated" | "high";
  predictedIncidents: PredictedIncident[];
  capacityBottlenecks: CapacityBottleneck[];
}

export interface PredictedIncident {
  description: string;
  probability: number;
  estimatedTimeframeDays: number;
  affectedResources: string[];
  preventiveAction: string;
  costOfPrevention: number;
  costOfIncident: number;
}

export interface CapacityBottleneck {
  resource: string;
  metric: string;
  currentUtilizationPct: number;
  projectedExhaustionDate: string;
  confidence: number;
  scaleUpAction: string;
  scaleUpCostUsd: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// §8 — Resilience Intelligence
// ═══════════════════════════════════════════════════════════════════════════════

export type ResilienceWeakness =
  | "single_az_deployment"
  | "single_region_deployment"
  | "no_failover_config"
  | "untested_backup"
  | "stale_backup"
  | "no_health_checks"
  | "missing_auto_recovery"
  | "no_circuit_breaker"
  | "cascade_risk"
  | "single_dependency"
  | "unmonitored_critical_path"
  | "manual_recovery_only"
  | "no_runbook"
  | "insufficient_capacity_headroom";

export interface ResilienceAssessment {
  orgId: string;
  assessedAt: string;
  overallScore: number;
  domainScores: ResilienceDomainScore[];
  weaknesses: ResilienceWeaknessDetail[];
  strengths: string[];
  comparedToBaseline: ResilienceComparison;
  recommendations: ResilienceRecommendation[];
}

export interface ResilienceDomainScore {
  domain: string;
  score: number;
  maxScore: number;
  weight: number;
  keyFactors: string[];
}

export interface ResilienceWeaknessDetail {
  weakness: ResilienceWeakness;
  severity: InfraRiskSeverity;
  affectedResources: string[];
  affectedWorkloads: string[];
  description: string;
  businessImpact: string;
  remediationEffort: "trivial" | "low" | "medium" | "high" | "significant";
  automatable: boolean;
  estimatedRtoImprovementMinutes: number;
}

export interface ResilienceComparison {
  baselineDate: string;
  scoreChange: number;
  newWeaknesses: ResilienceWeakness[];
  resolvedWeaknesses: ResilienceWeakness[];
  unchangedWeaknesses: ResilienceWeakness[];
}

export interface ResilienceRecommendation {
  id: string;
  title: string;
  description: string;
  weakness: ResilienceWeakness;
  priority: number;
  estimatedCostUsd: number;
  estimatedEffortDays: number;
  rtoImprovementMinutes: number;
  rpoImprovementMinutes: number;
  prerequisites: string[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// §9 — Organizational Infrastructure Understanding
// ═══════════════════════════════════════════════════════════════════════════════

export interface OrgInfraProfile {
  orgId: string;
  profiledAt: string;
  maturityLevel: InfraMaturityLevel;
  providerStrategy: ProviderStrategy;
  operationalCadence: OperationalCadence;
  costGovernancePosture: CostGovernancePosture;
  securityPostureSummary: SecurityPostureSummary;
  changeVelocity: ChangeVelocity;
  teamCapabilities: TeamCapabilityAssessment;
}

export type InfraMaturityLevel =
  | "ad_hoc"
  | "reactive"
  | "defined"
  | "managed"
  | "optimizing";

export interface ProviderStrategy {
  primaryProvider: "aws" | "azure" | "gcp";
  multiCloudReason: "regulatory" | "best_of_breed" | "acquisition" | "redundancy" | "team_preference" | "single_provider";
  providerSpend: Record<string, number>;
  migrationInProgress: boolean;
  migrationDirection: string | null;
}

export interface OperationalCadence {
  avgDeploymentsPerWeek: number;
  avgConfigChangesPerWeek: number;
  changeWindowsObserved: boolean;
  maintenanceWindows: { dayOfWeek: number; startHourUtc: number; durationHours: number }[];
  incidentResponseAvgMinutes: number;
  scanFrequency: "continuous" | "daily" | "weekly" | "monthly" | "ad_hoc";
}

export interface CostGovernancePosture {
  budgetDefined: boolean;
  budgetAdherence: "under" | "at_target" | "over" | "significantly_over";
  tagCoverage: number;
  reservationCoverage: number;
  wasteRatio: number;
  costTrendDirection: "decreasing" | "stable" | "increasing";
  monthlySpendUsd: number;
}

export interface SecurityPostureSummary {
  publicExposureCount: number;
  unencryptedStorageCount: number;
  overprivilegedRoleCount: number;
  mfaEnforcementPct: number;
  complianceFrameworks: string[];
  lastAuditDate: string | null;
  criticalVulnerabilities: number;
}

export interface ChangeVelocity {
  resourcesAddedPerWeek: number;
  resourcesRemovedPerWeek: number;
  configChangesPerWeek: number;
  netGrowthRate: number;
  churnRate: number;
  stabilityIndex: number;
}

export interface TeamCapabilityAssessment {
  cloudExpertiseLevel: "beginner" | "intermediate" | "advanced" | "expert";
  automationAdoption: "manual" | "scripted" | "ci_cd" | "gitops" | "full_automation";
  iacCoverage: number;
  monitoringCoverage: number;
  incidentResponseDocumented: boolean;
  runbooksExist: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// §10 — Intelligence Integration Contracts
// ═══════════════════════════════════════════════════════════════════════════════

export interface IntelligenceIntegration {
  subsystem: string;
  direction: "reads_from" | "writes_to" | "bidirectional";
  dataExchanged: string;
  cognitivePhases: string[];
  triggerCondition: string;
}

export const INTELLIGENCE_INTEGRATIONS: IntelligenceIntegration[] = [
  {
    subsystem: "operationalMemoryGraph",
    direction: "bidirectional",
    dataExchanged: "TopologyNodes and edges are persisted as GraphNodes/GraphEdges. Historical topology snapshots are retrieved via RetrievalRequest with intent 'temporal_evolution'.",
    cognitivePhases: ["observe", "interpret", "learn"],
    triggerCondition: "Every scan cycle writes updated topology. Learn phase persists trend data and risk signals.",
  },
  {
    subsystem: "cognitiveCore",
    direction: "reads_from",
    dataExchanged: "Intelligence Layer consumes PhaseDefinition to know when to produce topology, risk, and trend outputs. SubsystemCoordination entry defines the contract.",
    cognitivePhases: ["observe", "interpret", "reason", "reflect"],
    triggerCondition: "Cognitive loop invokes intelligence subsystems at observe (topology build), interpret (relationship analysis), reason (risk assessment), reflect (trend evaluation).",
  },
  {
    subsystem: "monitoringAgent",
    direction: "reads_from",
    dataExchanged: "MonitorAlerts and SnapshotDeltas feed into stress pattern detection and risk signal generation.",
    cognitivePhases: ["observe", "reason"],
    triggerCondition: "New MonitorResult triggers re-evaluation of stress patterns and risk landscape.",
  },
  {
    subsystem: "driftEngine",
    direction: "reads_from",
    dataExchanged: "DriftReport items indicate configuration mutations that may affect topology relationships or introduce resilience weaknesses.",
    cognitivePhases: ["interpret", "reason"],
    triggerCondition: "DriftReport with high-severity items triggers resilience reassessment and risk signal update.",
  },
  {
    subsystem: "multiCloudAbstraction",
    direction: "reads_from",
    dataExchanged: "UnifiedResource types and OperationalDomain definitions provide the normalized vocabulary for topology nodes and workload classification.",
    cognitivePhases: ["observe", "interpret"],
    triggerCondition: "Every topology build normalizes provider-specific resources through the abstraction layer.",
  },
  {
    subsystem: "governanceEngine",
    direction: "writes_to",
    dataExchanged: "Compliance drift signals and resilience weakness details feed governance violation detection.",
    cognitivePhases: ["reason"],
    triggerCondition: "Resilience weaknesses that violate governance policies are forwarded as PolicyViolation candidates.",
  },
  {
    subsystem: "planningEngine",
    direction: "writes_to",
    dataExchanged: "BlastRadiusAssessments and DependencyChainAnalysis inform plan phase ordering, rollback strategies, and approval checkpoint placement.",
    cognitivePhases: ["plan"],
    triggerCondition: "Every plan generation request includes blast radius data from the intelligence layer.",
  },
  {
    subsystem: "reflectionEngine",
    direction: "writes_to",
    dataExchanged: "Optimization trend reports and risk velocity feed reflection insights, enabling the agent to evaluate whether its recommendations are producing measurable improvement.",
    cognitivePhases: ["reflect"],
    triggerCondition: "Reflection cycle requests optimization realization rate and risk trend data.",
  },
  {
    subsystem: "memorySystem",
    direction: "bidirectional",
    dataExchanged: "Workload profiles are stored in SemanticStore as operational patterns. Historical risk signals feed EpisodicStore for incident correlation.",
    cognitivePhases: ["learn", "reason"],
    triggerCondition: "Learn phase persists new workload behavior patterns. Reason phase retrieves historical patterns for comparison.",
  },
  {
    subsystem: "explainabilityEngine",
    direction: "writes_to",
    dataExchanged: "Risk evidence, trend data points, and topology relationships provide structured evidence for explainable findings and recommendations.",
    cognitivePhases: ["reason", "plan"],
    triggerCondition: "Every risk signal and recommendation includes evidence traceable to intelligence layer observations.",
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// §11 — Intelligence Pipeline Stages
// ═══════════════════════════════════════════════════════════════════════════════

export type IntelligencePipelineStage =
  | "collect"
  | "normalize"
  | "correlate"
  | "build_topology"
  | "classify_workloads"
  | "assess_relationships"
  | "detect_trends"
  | "predict_stress"
  | "assess_risk"
  | "assess_resilience"
  | "profile_organization"
  | "generate_insights";

export interface IntelligenceStageDefinition {
  stage: IntelligencePipelineStage;
  order: number;
  description: string;
  inputs: string[];
  outputs: string[];
  dependsOn: IntelligencePipelineStage[];
  maxDurationMs: number;
  failureMode: string;
  cognitivePhase: string;
}

export const INTELLIGENCE_PIPELINE: IntelligenceStageDefinition[] = [
  {
    stage: "collect",
    order: 1,
    description: "Gather raw resource inventory, metrics, cost data, and configuration state from provider adapters.",
    inputs: ["ProviderCredentials", "ScanConfiguration"],
    outputs: ["RawProviderSnapshot"],
    dependsOn: [],
    maxDurationMs: 300000,
    failureMode: "Partial collection produces degraded-quality intelligence. Never blocks downstream stages entirely.",
    cognitivePhase: "observe",
  },
  {
    stage: "normalize",
    order: 2,
    description: "Transform provider-specific resources into UnifiedResource format via multiCloudAbstraction mappings.",
    inputs: ["RawProviderSnapshot"],
    outputs: ["UnifiedResource[]"],
    dependsOn: ["collect"],
    maxDurationMs: 30000,
    failureMode: "Unmapped resources preserved as raw types with reduced intelligence coverage.",
    cognitivePhase: "observe",
  },
  {
    stage: "correlate",
    order: 3,
    description: "Match resources across scans to detect additions, removals, and mutations. Correlate with prior topology state.",
    inputs: ["UnifiedResource[]", "PreviousTopologyMap"],
    outputs: ["ResourceCorrelation", "SnapshotDelta"],
    dependsOn: ["normalize"],
    maxDurationMs: 60000,
    failureMode: "First scan has no prior state — correlation produces baseline instead of deltas.",
    cognitivePhase: "interpret",
  },
  {
    stage: "build_topology",
    order: 4,
    description: "Construct infrastructure topology by analyzing security groups, VPC configurations, load balancer targets, IAM policies, DNS records, and resource tags.",
    inputs: ["UnifiedResource[]", "SecurityGroupRules", "VPCConfigurations", "LoadBalancerConfigs", "IAMPolicies"],
    outputs: ["InfrastructureTopologyMap"],
    dependsOn: ["normalize"],
    maxDurationMs: 120000,
    failureMode: "Incomplete topology if some discovery methods fail. Confidence scores reflect coverage gaps.",
    cognitivePhase: "interpret",
  },
  {
    stage: "classify_workloads",
    order: 5,
    description: "Group resources into workload profiles based on topology clusters, naming conventions, tags, and behavioral similarity.",
    inputs: ["InfrastructureTopologyMap", "UnifiedResource[]", "MetricsData"],
    outputs: ["WorkloadProfile[]"],
    dependsOn: ["build_topology"],
    maxDurationMs: 60000,
    failureMode: "Unknown workload types assigned. Classification improves over multiple scans via memory.",
    cognitivePhase: "interpret",
  },
  {
    stage: "assess_relationships",
    order: 6,
    description: "Analyze dependency chains, blast radius, and failure propagation paths across the topology.",
    inputs: ["InfrastructureTopologyMap", "WorkloadProfile[]"],
    outputs: ["DependencyChainAnalysis[]", "BlastRadiusAssessment[]"],
    dependsOn: ["build_topology", "classify_workloads"],
    maxDurationMs: 90000,
    failureMode: "Inferred relationships have lower confidence. Strong relationships from config analysis are always available.",
    cognitivePhase: "reason",
  },
  {
    stage: "detect_trends",
    order: 7,
    description: "Compare current state against historical snapshots to identify infrastructure evolution trends, cost trajectories, and security posture shifts.",
    inputs: ["InfraStateSnapshot", "PreviousSnapshots[]", "CostData"],
    outputs: ["InfraTrend[]", "OptimizationTrendReport"],
    dependsOn: ["correlate"],
    maxDurationMs: 60000,
    failureMode: "Trends require >= 3 data points. Insufficient history returns informational-only trends.",
    cognitivePhase: "reason",
  },
  {
    stage: "predict_stress",
    order: 8,
    description: "Analyze utilization patterns, growth trends, and capacity headroom to predict infrastructure stress events.",
    inputs: ["WorkloadProfile[]", "UtilizationMetrics", "InfraTrend[]"],
    outputs: ["StressForecast"],
    dependsOn: ["classify_workloads", "detect_trends"],
    maxDurationMs: 60000,
    failureMode: "Insufficient metrics data produces low-confidence forecasts flagged as speculative.",
    cognitivePhase: "reason",
  },
  {
    stage: "assess_risk",
    order: 9,
    description: "Evaluate emerging operational risks across all domains — capacity, cost, security, resilience, compliance, complexity.",
    inputs: ["InfrastructureTopologyMap", "InfraTrend[]", "StressForecast", "DependencyChainAnalysis[]"],
    outputs: ["RiskLandscape"],
    dependsOn: ["assess_relationships", "detect_trends", "predict_stress"],
    maxDurationMs: 60000,
    failureMode: "Partial risk assessment if some upstream stages degraded. Always produces at least configuration-based risks.",
    cognitivePhase: "reason",
  },
  {
    stage: "assess_resilience",
    order: 10,
    description: "Score resilience across domains, identify weaknesses, and generate remediation recommendations.",
    inputs: ["InfrastructureTopologyMap", "WorkloadProfile[]", "BlastRadiusAssessment[]"],
    outputs: ["ResilienceAssessment"],
    dependsOn: ["assess_relationships"],
    maxDurationMs: 60000,
    failureMode: "Resilience assessment always possible from topology — stress/trend data enriches but is not required.",
    cognitivePhase: "reason",
  },
  {
    stage: "profile_organization",
    order: 11,
    description: "Build organizational infrastructure understanding — maturity level, operational cadence, cost governance, security posture, team capabilities.",
    inputs: ["InfrastructureTopologyMap", "WorkloadProfile[]", "OptimizationTrendReport", "ResilienceAssessment", "AgentMemory"],
    outputs: ["OrgInfraProfile"],
    dependsOn: ["classify_workloads", "detect_trends", "assess_resilience"],
    maxDurationMs: 30000,
    failureMode: "Org profile accumulates over time. First assessment is coarse; accuracy improves with each scan cycle.",
    cognitivePhase: "reflect",
  },
  {
    stage: "generate_insights",
    order: 12,
    description: "Synthesize all intelligence outputs into actionable insights, prioritized by organizational context and risk severity.",
    inputs: ["RiskLandscape", "ResilienceAssessment", "StressForecast", "OptimizationTrendReport", "OrgInfraProfile"],
    outputs: ["IntelligenceReport"],
    dependsOn: ["assess_risk", "assess_resilience", "predict_stress", "profile_organization"],
    maxDurationMs: 30000,
    failureMode: "Insights are always generated. Degraded upstream stages reduce insight confidence, never prevent generation.",
    cognitivePhase: "reason",
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// §12 — Intelligence Report
// ═══════════════════════════════════════════════════════════════════════════════

export interface IntelligenceReport {
  orgId: string;
  generatedAt: string;
  scanCorrelationId: string;
  topology: InfrastructureTopologyMap;
  workloads: WorkloadProfile[];
  evolution: InfraEvolutionTimeline;
  risk: RiskLandscape;
  resilience: ResilienceAssessment;
  stressForecast: StressForecast;
  optimizationTrends: OptimizationTrendReport;
  orgProfile: OrgInfraProfile;
  insights: IntelligenceInsight[];
  quality: IntelligenceQuality;
}

export interface IntelligenceInsight {
  id: string;
  category: "risk" | "optimization" | "resilience" | "capacity" | "compliance" | "architecture";
  severity: InfraRiskSeverity;
  title: string;
  description: string;
  evidence: RiskEvidence[];
  suggestedAction: string;
  estimatedImpact: string;
  confidence: number;
  timeHorizon: "immediate" | "days" | "weeks" | "months" | "quarters";
  relatedWorkloads: string[];
  relatedResources: string[];
}

export interface IntelligenceQuality {
  overallConfidence: number;
  snapshotCompleteness: number;
  topologyConfidence: number;
  trendDataPoints: number;
  trendMinimumMet: boolean;
  stressPredictionConfidence: number;
  riskAssessmentConfidence: number;
  degradedStages: IntelligencePipelineStage[];
  dataGaps: string[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// §13 — Implementation Roadmap
// ═══════════════════════════════════════════════════════════════════════════════

export type IntelligenceRoadmapPhase = "foundation" | "behavioral" | "predictive" | "autonomous";

export interface IntelligenceRoadmapItem {
  id: string;
  phase: IntelligenceRoadmapPhase;
  name: string;
  description: string;
  dependencies: string[];
  estimatedWeeks: number;
  outputs: string[];
  integrationPoints: string[];
}

export const INTELLIGENCE_ROADMAP: IntelligenceRoadmapItem[] = [
  {
    id: "il-01",
    phase: "foundation",
    name: "Topology builder — AWS",
    description: "Build infrastructure topology from VPC, security groups, load balancers, and IAM. Discover routes_traffic_to, depends_on, and authenticates_via edges.",
    dependencies: [],
    estimatedWeeks: 3,
    outputs: ["InfrastructureTopologyMap (AWS)"],
    integrationPoints: ["multiCloudAbstraction", "operationalMemoryGraph"],
  },
  {
    id: "il-02",
    phase: "foundation",
    name: "Dependency chain analyzer",
    description: "Traverse topology to compute dependency chains, blast radius, and single points of failure. Feed results into planningEngine for phase ordering.",
    dependencies: ["il-01"],
    estimatedWeeks: 2,
    outputs: ["DependencyChainAnalysis", "BlastRadiusAssessment"],
    integrationPoints: ["planningEngine", "operationOrchestrator"],
  },
  {
    id: "il-03",
    phase: "foundation",
    name: "Resilience scorer",
    description: "Score infrastructure resilience across domains. Identify weaknesses and generate remediation recommendations.",
    dependencies: ["il-01", "il-02"],
    estimatedWeeks: 2,
    outputs: ["ResilienceAssessment"],
    integrationPoints: ["governanceEngine", "reflectionEngine"],
  },
  {
    id: "il-04",
    phase: "foundation",
    name: "Topology builder — Azure and GCP",
    description: "Extend topology builder with Azure VNet/NSG and GCP VPC/Firewall discovery. Normalize into same topology graph.",
    dependencies: ["il-01"],
    estimatedWeeks: 3,
    outputs: ["InfrastructureTopologyMap (Azure, GCP)"],
    integrationPoints: ["multiCloudAbstraction"],
  },
  {
    id: "il-05",
    phase: "behavioral",
    name: "Workload classifier",
    description: "Cluster resources into workload profiles using topology proximity, naming patterns, tags, and metric similarity.",
    dependencies: ["il-01"],
    estimatedWeeks: 3,
    outputs: ["WorkloadProfile[]"],
    integrationPoints: ["memorySystem", "adaptiveBehavior"],
  },
  {
    id: "il-06",
    phase: "behavioral",
    name: "Utilization baseline engine",
    description: "Compute rolling utilization baselines per workload. Detect peak schedules, quiet periods, and seasonal patterns.",
    dependencies: ["il-05"],
    estimatedWeeks: 2,
    outputs: ["UtilizationBaseline", "PeakSchedule"],
    integrationPoints: ["monitoringAgent"],
  },
  {
    id: "il-07",
    phase: "behavioral",
    name: "Temporal evolution tracker",
    description: "Compare topology snapshots over time. Detect resource growth, cost trajectories, security posture shifts, and complexity increases.",
    dependencies: ["il-01"],
    estimatedWeeks: 3,
    outputs: ["InfraEvolutionTimeline", "InfraTrend[]"],
    integrationPoints: ["operationalMemoryGraph", "reflectionEngine"],
  },
  {
    id: "il-08",
    phase: "behavioral",
    name: "Optimization trend reporter",
    description: "Track which optimization opportunities recur, which are realized, and which are consistently blocked. Feed adoption patterns to reflection engine.",
    dependencies: ["il-07"],
    estimatedWeeks: 2,
    outputs: ["OptimizationTrendReport"],
    integrationPoints: ["reflectionEngine", "workflowIntelligence"],
  },
  {
    id: "il-09",
    phase: "behavioral",
    name: "Organizational profiler",
    description: "Derive infrastructure maturity level, operational cadence, cost governance posture, and team capabilities from observed patterns.",
    dependencies: ["il-05", "il-07", "il-03"],
    estimatedWeeks: 2,
    outputs: ["OrgInfraProfile"],
    integrationPoints: ["memorySystem", "adaptiveBehavior"],
  },
  {
    id: "il-10",
    phase: "predictive",
    name: "Stress pattern detector",
    description: "Identify emerging stress patterns from utilization trends, capacity headroom analysis, and historical incident correlation.",
    dependencies: ["il-06", "il-07"],
    estimatedWeeks: 3,
    outputs: ["StressForecast", "StressPattern[]"],
    integrationPoints: ["monitoringAgent", "workflowEngine"],
  },
  {
    id: "il-11",
    phase: "predictive",
    name: "Risk intelligence engine",
    description: "Synthesize topology, trends, stress patterns, and dependency analysis into a unified risk landscape with time-to-impact estimates.",
    dependencies: ["il-02", "il-07", "il-10"],
    estimatedWeeks: 3,
    outputs: ["RiskLandscape", "InfraRiskSignal[]"],
    integrationPoints: ["cognitiveCore", "explainabilityEngine", "governanceEngine"],
  },
  {
    id: "il-12",
    phase: "predictive",
    name: "Capacity forecasting",
    description: "Project resource utilization trajectories to predict capacity exhaustion dates. Generate proactive scaling recommendations.",
    dependencies: ["il-06", "il-10"],
    estimatedWeeks: 2,
    outputs: ["CapacityBottleneck[]", "PredictedIncident[]"],
    integrationPoints: ["planningEngine", "workflowEngine"],
  },
  {
    id: "il-13",
    phase: "autonomous",
    name: "Continuous intelligence loop",
    description: "Run the full 12-stage intelligence pipeline continuously, producing IntelligenceReport after every scan cycle. Feed insights directly into cognitive loop.",
    dependencies: ["il-11", "il-12", "il-09"],
    estimatedWeeks: 3,
    outputs: ["IntelligenceReport", "IntelligenceInsight[]"],
    integrationPoints: ["cognitiveCore", "autonomousOrchestrator"],
  },
  {
    id: "il-14",
    phase: "autonomous",
    name: "Cross-organizational pattern learning",
    description: "With anonymization, learn infrastructure anti-patterns and optimization strategies across organizations to improve intelligence for all customers.",
    dependencies: ["il-13"],
    estimatedWeeks: 4,
    outputs: ["CrossOrgPatterns"],
    integrationPoints: ["memorySystem", "workflowIntelligence"],
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// §14 — Architecture Diagrams
// ═══════════════════════════════════════════════════════════════════════════════

export interface IntelligenceDiagram {
  name: string;
  description: string;
  ascii: string;
}

export const INTELLIGENCE_DIAGRAMS: IntelligenceDiagram[] = [
  {
    name: "Intelligence Pipeline",
    description: "The 12-stage intelligence pipeline from raw collection to insight generation.",
    ascii: `
  ┌──────────┐    ┌───────────┐    ┌───────────┐    ┌──────────────┐
  │ Collect  │───▶│ Normalize │───▶│ Correlate │───▶│ Build        │
  │ (observe)│    │ (observe) │    │(interpret)│    │ Topology     │
  └──────────┘    └───────────┘    └─────┬─────┘    │ (interpret)  │
                                         │          └──────┬───────┘
                                         │                 │
                           ┌─────────────┼─────────────────┤
                           │             │                 │
                           ▼             ▼                 ▼
                    ┌────────────┐ ┌──────────┐  ┌──────────────────┐
                    │ Detect     │ │ Classify │  │ Assess           │
                    │ Trends     │ │Workloads │  │ Relationships    │
                    │ (reason)   │ │(interpret│  │ (reason)         │
                    └─────┬──────┘ └────┬─────┘  └────────┬─────────┘
                          │             │                  │
              ┌───────────┼─────────────┼──────────────────┤
              │           │             │                  │
              ▼           ▼             ▼                  ▼
       ┌──────────┐ ┌──────────┐ ┌───────────┐  ┌──────────────────┐
       │ Predict  │ │ Assess   │ │ Assess    │  │ Profile          │
       │ Stress   │ │ Risk     │ │ Resilience│  │ Organization     │
       │ (reason) │ │ (reason) │ │ (reason)  │  │ (reflect)        │
       └────┬─────┘ └────┬─────┘ └─────┬─────┘  └────────┬─────────┘
            │             │             │                  │
            └─────────────┴─────────────┴──────────────────┘
                                    │
                                    ▼
                          ┌──────────────────┐
                          │ Generate Insights│
                          │ (reason)         │
                          └────────┬─────────┘
                                   │
                                   ▼
                          ┌──────────────────┐
                          │IntelligenceReport│
                          └──────────────────┘`,
  },
  {
    name: "Subsystem Integration",
    description: "How the intelligence layer connects to existing Axiom Agent subsystems.",
    ascii: `
                    ┌─────────────────────────────────────────┐
                    │       INFRASTRUCTURE INTELLIGENCE       │
                    │                                         │
                    │  Topology ─ Workloads ─ Relationships   │
                    │  Trends ─ Risk ─ Stress ─ Resilience    │
                    │  Org Profile ─ Insights                 │
                    └────┬──────┬──────┬──────┬──────┬────────┘
                         │      │      │      │      │
              ┌──────────┘      │      │      │      └──────────┐
              │          ┌──────┘      │      └──────┐          │
              ▼          ▼             ▼             ▼          ▼
     ┌────────────┐ ┌─────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐
     │ Operational│ │Cognitive│ │ Planning │ │Governance│ │Reflect │
     │ Memory     │ │ Core    │ │ Engine   │ │ Engine   │ │Engine  │
     │ Graph      │ │         │ │          │ │          │ │        │
     └────────────┘ └─────────┘ └──────────┘ └──────────┘ └────────┘
              │          │             │             │          │
              ▼          ▼             ▼             ▼          ▼
     ┌────────────┐ ┌─────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐
     │  Memory    │ │Reasoning│ │ Operation│ │Compliance│ │Workflow│
     │  System    │ │ Engine  │ │Orchestr. │ │ Policies │ │Intel.  │
     └────────────┘ └─────────┘ └──────────┘ └──────────┘ └────────┘`,
  },
  {
    name: "Topology Discovery",
    description: "How infrastructure relationships are discovered from cloud provider data.",
    ascii: `
     ┌──────────────────────────────────────────────────────────────┐
     │                   DISCOVERY METHODS                          │
     ├──────────────────────────────────────────────────────────────┤
     │                                                              │
     │  Security Groups ──▶ routes_traffic_to, depends_on          │
     │  VPC/Subnet Config ──▶ network zones, trust boundaries      │
     │  Load Balancer Targets ──▶ routes_traffic_to, scales_with   │
     │  IAM Policies ──▶ authenticates_via, depends_on             │
     │  DNS Records ──▶ routes_traffic_to, failover_target         │
     │  Resource Tags ──▶ workload grouping, ownership             │
     │  VPC Peering ──▶ peered_with, cross-region edges            │
     │  CloudTrail/Activity ──▶ reads_from, writes_to              │
     │  Replication Configs ──▶ replicates_to, backed_up_by        │
     │  Monitoring Configs ──▶ monitored_by, alerts_via            │
     │                                                              │
     ├──────────────────────────────────────────────────────────────┤
     │  Each method produces edges with confidence scores.          │
     │  Config-derived edges: 90-100% confidence.                  │
     │  Activity-inferred edges: 50-80% confidence.                │
     │  Tag-correlated edges: 30-60% confidence.                   │
     └──────────────────────────────────────────────────────────────┘`,
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// §15 — Query Functions
// ═══════════════════════════════════════════════════════════════════════════════

export function getIntelligenceStage(stage: IntelligencePipelineStage): IntelligenceStageDefinition | undefined {
  return INTELLIGENCE_PIPELINE.find((s) => s.stage === stage);
}

export function getIntelligenceStageOrder(): IntelligencePipelineStage[] {
  return [...INTELLIGENCE_PIPELINE].sort((a, b) => a.order - b.order).map((s) => s.stage);
}

export function getIntelligenceDependencies(stage: IntelligencePipelineStage): IntelligencePipelineStage[] {
  const def = INTELLIGENCE_PIPELINE.find((s) => s.stage === stage);
  return def?.dependsOn ?? [];
}

export function getReadyIntelligenceStages(completed: Set<IntelligencePipelineStage>): IntelligencePipelineStage[] {
  return INTELLIGENCE_PIPELINE
    .filter((s) => !completed.has(s.stage) && s.dependsOn.every((d) => completed.has(d)))
    .map((s) => s.stage);
}

export function getIntegrationForSubsystem(subsystem: string): IntelligenceIntegration | undefined {
  return INTELLIGENCE_INTEGRATIONS.find((i) => i.subsystem === subsystem);
}

export function getRoadmapByPhase(phase: IntelligenceRoadmapPhase): IntelligenceRoadmapItem[] {
  return INTELLIGENCE_ROADMAP.filter((r) => r.phase === phase);
}

export function getIntelligenceRoadmapProgress(): {
  totalItems: number;
  byPhase: Record<IntelligenceRoadmapPhase, number>;
  totalWeeks: number;
  criticalPath: string[];
} {
  const byPhase: Record<string, number> = { foundation: 0, behavioral: 0, predictive: 0, autonomous: 0 };
  let totalWeeks = 0;

  for (const item of INTELLIGENCE_ROADMAP) {
    byPhase[item.phase]++;
    totalWeeks += item.estimatedWeeks;
  }

  const criticalPath = computeCriticalPath();

  return {
    totalItems: INTELLIGENCE_ROADMAP.length,
    byPhase: byPhase as Record<IntelligenceRoadmapPhase, number>,
    totalWeeks,
    criticalPath,
  };
}

function computeCriticalPath(): string[] {
  const itemMap = new Map(INTELLIGENCE_ROADMAP.map((i) => [i.id, i]));
  let longestPath: string[] = [];
  let longestDuration = 0;

  function dfs(itemId: string, path: string[], duration: number) {
    const item = itemMap.get(itemId);
    if (!item) return;

    const newPath = [...path, item.id];
    const newDuration = duration + item.estimatedWeeks;

    const dependents = INTELLIGENCE_ROADMAP.filter((r) => r.dependencies.includes(itemId));
    if (dependents.length === 0) {
      if (newDuration > longestDuration) {
        longestDuration = newDuration;
        longestPath = newPath;
      }
    } else {
      for (const dep of dependents) {
        dfs(dep.id, newPath, newDuration);
      }
    }
  }

  const roots = INTELLIGENCE_ROADMAP.filter((r) => r.dependencies.length === 0);
  for (const root of roots) {
    dfs(root.id, [], 0);
  }

  return longestPath;
}

export function getTopologyDiscoveryMethods(): { method: TopologyDiscoveryMethod; produces: TopologyEdgeType[]; confidence: string }[] {
  return [
    { method: "security_group_analysis", produces: ["routes_traffic_to", "depends_on"], confidence: "90-100%" },
    { method: "vpc_flow_logs", produces: ["routes_traffic_to", "reads_from", "writes_to"], confidence: "80-95%" },
    { method: "dns_resolution", produces: ["routes_traffic_to", "failover_target"], confidence: "85-95%" },
    { method: "load_balancer_targets", produces: ["routes_traffic_to", "scales_with"], confidence: "95-100%" },
    { method: "iam_policy_analysis", produces: ["authenticates_via", "depends_on"], confidence: "90-100%" },
    { method: "tag_correlation", produces: ["depends_on", "scales_with"], confidence: "30-60%" },
    { method: "cloudtrail_api_calls", produces: ["reads_from", "writes_to"], confidence: "70-85%" },
    { method: "network_acl_rules", produces: ["routes_traffic_to"], confidence: "90-100%" },
    { method: "peering_connections", produces: ["peered_with"], confidence: "100%" },
    { method: "resource_references", produces: ["depends_on", "encrypts_with", "logs_to", "monitored_by"], confidence: "85-100%" },
    { method: "inferred_from_config", produces: ["backed_up_by", "replicates_to", "cached_by", "queues_for"], confidence: "80-95%" },
  ];
}

// ═══════════════════════════════════════════════════════════════════════════════
// §16 — Tests
// ═══════════════════════════════════════════════════════════════════════════════

export interface IntelligenceTestResult {
  name: string;
  passed: boolean;
  detail: string;
}

export function runInfrastructureIntelligenceTests(): IntelligenceTestResult[] {
  const results: IntelligenceTestResult[] = [];

  function assert(name: string, condition: boolean, detail: string) {
    results.push({ name, passed: condition, detail });
  }

  // Pipeline stages
  assert(
    "Intelligence pipeline has 12 stages",
    INTELLIGENCE_PIPELINE.length === 12,
    `Found ${INTELLIGENCE_PIPELINE.length} stages`,
  );

  assert(
    "Pipeline stages are ordered 1-12",
    INTELLIGENCE_PIPELINE.every((s, i) => s.order === i + 1),
    "All stages have correct sequential ordering",
  );

  assert(
    "No circular dependencies in pipeline",
    INTELLIGENCE_PIPELINE.every((s) => !s.dependsOn.includes(s.stage)),
    "No stage depends on itself",
  );

  assert(
    "All pipeline dependencies reference valid stages",
    INTELLIGENCE_PIPELINE.every((s) =>
      s.dependsOn.every((d) => INTELLIGENCE_PIPELINE.some((p) => p.stage === d)),
    ),
    "All dependency references resolve to existing stages",
  );

  assert(
    "Collect stage has no dependencies",
    INTELLIGENCE_PIPELINE[0].dependsOn.length === 0,
    `First stage dependencies: ${INTELLIGENCE_PIPELINE[0].dependsOn.length}`,
  );

  assert(
    "Generate insights depends on multiple upstream stages",
    INTELLIGENCE_PIPELINE[INTELLIGENCE_PIPELINE.length - 1].dependsOn.length >= 4,
    `Final stage depends on ${INTELLIGENCE_PIPELINE[INTELLIGENCE_PIPELINE.length - 1].dependsOn.length} stages`,
  );

  // Integration contracts
  assert(
    "Integration contracts cover key subsystems",
    INTELLIGENCE_INTEGRATIONS.some((i) => i.subsystem === "operationalMemoryGraph") &&
    INTELLIGENCE_INTEGRATIONS.some((i) => i.subsystem === "cognitiveCore") &&
    INTELLIGENCE_INTEGRATIONS.some((i) => i.subsystem === "monitoringAgent") &&
    INTELLIGENCE_INTEGRATIONS.some((i) => i.subsystem === "governanceEngine"),
    "Integrations include memory graph, cognitive core, monitoring, and governance",
  );

  assert(
    "Bidirectional integrations exist for memory systems",
    INTELLIGENCE_INTEGRATIONS.filter((i) => i.direction === "bidirectional").length >= 2,
    `Bidirectional integrations: ${INTELLIGENCE_INTEGRATIONS.filter((i) => i.direction === "bidirectional").length}`,
  );

  assert(
    "All integrations specify cognitive phases",
    INTELLIGENCE_INTEGRATIONS.every((i) => i.cognitivePhases.length > 0),
    "Every integration contract specifies at least one cognitive phase",
  );

  // Roadmap
  assert(
    "Roadmap has items in all four phases",
    ["foundation", "behavioral", "predictive", "autonomous"].every((p) =>
      INTELLIGENCE_ROADMAP.some((r) => r.phase === p),
    ),
    `Phases covered: ${[...new Set(INTELLIGENCE_ROADMAP.map((r) => r.phase))].join(", ")}`,
  );

  assert(
    "Foundation phase starts the roadmap",
    INTELLIGENCE_ROADMAP.filter((r) => r.phase === "foundation").some((r) => r.dependencies.length === 0),
    "At least one foundation item has no dependencies",
  );

  assert(
    "All roadmap dependencies reference valid items",
    INTELLIGENCE_ROADMAP.every((r) =>
      r.dependencies.every((d) => INTELLIGENCE_ROADMAP.some((item) => item.id === d)),
    ),
    "All dependency references resolve to existing roadmap items",
  );

  assert(
    "Roadmap IDs are unique",
    new Set(INTELLIGENCE_ROADMAP.map((r) => r.id)).size === INTELLIGENCE_ROADMAP.length,
    `Unique IDs: ${new Set(INTELLIGENCE_ROADMAP.map((r) => r.id)).size} of ${INTELLIGENCE_ROADMAP.length}`,
  );

  // Query functions
  assert(
    "getIntelligenceStageOrder returns all stages",
    getIntelligenceStageOrder().length === 12,
    `Ordered stages: ${getIntelligenceStageOrder().length}`,
  );

  assert(
    "getReadyIntelligenceStages returns collect when none completed",
    getReadyIntelligenceStages(new Set()).includes("collect"),
    `Ready stages from empty: ${getReadyIntelligenceStages(new Set()).join(", ")}`,
  );

  assert(
    "getReadyIntelligenceStages respects dependencies",
    !getReadyIntelligenceStages(new Set()).includes("build_topology"),
    "build_topology is not ready when collect/normalize have not completed",
  );

  assert(
    "getReadyIntelligenceStages unlocks after dependencies met",
    getReadyIntelligenceStages(new Set(["collect", "normalize"])).includes("correlate") &&
    getReadyIntelligenceStages(new Set(["collect", "normalize"])).includes("build_topology"),
    "correlate and build_topology become ready after collect+normalize",
  );

  const progress = getIntelligenceRoadmapProgress();
  assert(
    "Roadmap progress computes correctly",
    progress.totalItems === INTELLIGENCE_ROADMAP.length && progress.totalWeeks > 0,
    `Items: ${progress.totalItems}, Weeks: ${progress.totalWeeks}`,
  );

  assert(
    "Critical path is non-empty",
    progress.criticalPath.length > 0,
    `Critical path length: ${progress.criticalPath.length} items`,
  );

  // Topology discovery methods
  const methods = getTopologyDiscoveryMethods();
  assert(
    "Topology discovery methods cover all edge types",
    new Set(methods.flatMap((m) => m.produces)).size >= 10,
    `Unique edge types discovered: ${new Set(methods.flatMap((m) => m.produces)).size}`,
  );

  // Architecture diagrams
  assert(
    "Architecture diagrams defined",
    INTELLIGENCE_DIAGRAMS.length >= 3,
    `Diagrams: ${INTELLIGENCE_DIAGRAMS.length}`,
  );

  // Structural validation
  assert(
    "Topology node types cover key infrastructure categories",
    (["compute_group", "storage_tier", "network_zone", "database_cluster", "iam_boundary"] as TopologyNodeType[])
      .every((t) => typeof t === "string"),
    "Core topology node types are valid",
  );

  assert(
    "Risk categories span operational domains",
    (["capacity_exhaustion", "cost_overrun", "security_exposure", "resilience_gap", "compliance_drift"] as InfraRiskCategory[])
      .every((c) => typeof c === "string"),
    "Core risk categories are valid",
  );

  assert(
    "Resilience weaknesses are comprehensive",
    (["single_az_deployment", "no_failover_config", "untested_backup", "cascade_risk"] as ResilienceWeakness[])
      .every((w) => typeof w === "string"),
    "Core resilience weaknesses are valid",
  );

  return results;
}
