// ─────────────────────────────────────────────────────────────────────────────
// Cost Intelligence Engine
// Deep cost analysis, forecasting, anomaly detection, optimization
// recommendations, and FinOps governance across AWS, Azure, and GCP
// ─────────────────────────────────────────────────────────────────────────────

// ═══════════════════════════════════════════════════════════════════════════════
// §1 — Cost Architecture
// ═══════════════════════════════════════════════════════════════════════════════

export type CostGranularity = "hourly" | "daily" | "weekly" | "monthly" | "quarterly" | "yearly";

export type CostDimension =
  | "service"
  | "resource"
  | "account"
  | "region"
  | "tag"
  | "team"
  | "environment"
  | "project"
  | "usage_type"
  | "operation";

export type CostTrendDirection = "increasing" | "decreasing" | "stable" | "volatile";

export interface CostSnapshot {
  id: string;
  orgId: string;
  provider: "aws" | "azure" | "gcp";
  periodStart: string;
  periodEnd: string;
  granularity: CostGranularity;
  totalCost: number;
  currency: "USD";
  breakdown: CostBreakdownEntry[];
  tags: Record<string, string>;
  capturedAt: string;
}

export interface CostBreakdownEntry {
  dimension: CostDimension;
  key: string;
  cost: number;
  percentOfTotal: number;
  previousPeriodCost: number | null;
  changePercent: number | null;
  trend: CostTrendDirection;
  anomaly: boolean;
}

export interface MultiCloudCostSummary {
  orgId: string;
  periodStart: string;
  periodEnd: string;
  totalCost: number;
  costByProvider: Record<"aws" | "azure" | "gcp", number>;
  costByEnvironment: Record<string, number>;
  costByTeam: Record<string, number>;
  topServices: { service: string; provider: string; cost: number }[];
  topResources: { resourceId: string; resourceType: string; cost: number }[];
  trend: CostTrendDirection;
  forecastedMonthEnd: number;
  budgetStatus: BudgetStatus;
}

export interface BudgetStatus {
  budgetAmount: number;
  currentSpend: number;
  forecastedSpend: number;
  percentUsed: number;
  percentForecasted: number;
  onTrack: boolean;
  daysRemaining: number;
  dailyBurnRate: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// §2 — Cost Anomaly Detection
// ═══════════════════════════════════════════════════════════════════════════════

export type AnomalyType =
  | "spike"
  | "sustained_increase"
  | "unexpected_service"
  | "region_outlier"
  | "idle_resource_cost"
  | "data_transfer_surge"
  | "reserved_instance_underutilization"
  | "spot_termination_cascade"
  | "new_resource_cost"
  | "billing_error";

export interface CostAnomaly {
  id: string;
  orgId: string;
  provider: "aws" | "azure" | "gcp";
  anomalyType: AnomalyType;
  severity: "low" | "medium" | "high" | "critical";
  detectedAt: string;
  periodStart: string;
  periodEnd: string;
  expectedCost: number;
  actualCost: number;
  deviationPercent: number;
  deviationAmount: number;
  affectedDimension: CostDimension;
  affectedKey: string;
  rootCauseHypothesis: string;
  confidence: number;
  acknowledged: boolean;
  actionTaken: string | null;
}

export interface AnomalyDetectionConfig {
  baselineWindowDays: number;
  deviationThresholdPercent: number;
  minimumDollarThreshold: number;
  evaluationFrequency: CostGranularity;
  enabledAnomalyTypes: AnomalyType[];
  suppressionRules: AnomalySuppressionRule[];
}

export interface AnomalySuppressionRule {
  id: string;
  dimension: CostDimension;
  key: string;
  reason: string;
  expiresAt: string;
}

export const DEFAULT_ANOMALY_CONFIG: AnomalyDetectionConfig = {
  baselineWindowDays: 30,
  deviationThresholdPercent: 25,
  minimumDollarThreshold: 50,
  evaluationFrequency: "daily",
  enabledAnomalyTypes: [
    "spike", "sustained_increase", "unexpected_service", "region_outlier",
    "idle_resource_cost", "data_transfer_surge", "reserved_instance_underutilization",
    "new_resource_cost", "billing_error",
  ],
  suppressionRules: [],
};

// ═══════════════════════════════════════════════════════════════════════════════
// §3 — Cost Optimization
// ═══════════════════════════════════════════════════════════════════════════════

export type OptimizationCategory =
  | "rightsizing"
  | "idle_resource"
  | "reserved_instances"
  | "savings_plans"
  | "spot_instances"
  | "storage_tiering"
  | "data_transfer"
  | "license_optimization"
  | "architecture_change"
  | "scheduling"
  | "region_optimization"
  | "commitment_management";

export type OptimizationRisk = "none" | "low" | "medium" | "high";

export interface CostOptimizationRecommendation {
  id: string;
  orgId: string;
  category: OptimizationCategory;
  provider: "aws" | "azure" | "gcp";
  title: string;
  description: string;
  affectedResources: string[];
  currentMonthlyCost: number;
  projectedMonthlyCost: number;
  estimatedMonthlySavings: number;
  estimatedAnnualSavings: number;
  implementationEffort: "trivial" | "low" | "medium" | "high";
  risk: OptimizationRisk;
  confidence: number;
  autoImplementable: boolean;
  requiresApproval: boolean;
  requiresDowntime: boolean;
  implementationSteps: string[];
  prerequisites: string[];
  caveats: string[];
  priority: number;
  status: OptimizationStatus;
  createdAt: string;
}

export type OptimizationStatus =
  | "identified"
  | "analyzed"
  | "recommended"
  | "approved"
  | "implementing"
  | "implemented"
  | "verified"
  | "rejected"
  | "deferred";

export interface OptimizationRule {
  id: string;
  name: string;
  description: string;
  category: OptimizationCategory;
  provider: "aws" | "azure" | "gcp" | "any";
  applicableResourceTypes: string[];
  condition: OptimizationCondition;
  savingsEstimation: SavingsEstimationMethod;
  risk: OptimizationRisk;
  autoImplementable: boolean;
  enabled: boolean;
}

export type OptimizationCondition =
  | { type: "utilization_below"; metric: string; threshold: number; durationDays: number }
  | { type: "oversized"; currentSize: string; recommendedSize: string; utilizationPercent: number }
  | { type: "no_reserved_coverage"; serviceType: string; utilizationThreshold: number }
  | { type: "storage_class_mismatch"; currentClass: string; recommendedClass: string; accessFrequency: string }
  | { type: "idle"; daysIdle: number; costThreshold: number }
  | { type: "schedule_opportunity"; onHours: number; offHours: number; weekendUsage: boolean }
  | { type: "data_transfer_excessive"; gbPerMonth: number; costPerGb: number }
  | { type: "generation_outdated"; currentGeneration: string; latestGeneration: string };

export type SavingsEstimationMethod =
  | { type: "percentage"; percent: number }
  | { type: "fixed_monthly"; amount: number }
  | { type: "size_based"; currentCost: number; projectedCost: number }
  | { type: "commitment_discount"; onDemandCost: number; committedCost: number; termMonths: number };

export const OPTIMIZATION_RULES: OptimizationRule[] = [
  {
    id: "ec2-rightsizing",
    name: "EC2 Rightsizing",
    description: "Downsize underutilized EC2 instances",
    category: "rightsizing",
    provider: "aws",
    applicableResourceTypes: ["aws_instance"],
    condition: { type: "utilization_below", metric: "cpu_utilization", threshold: 30, durationDays: 14 },
    savingsEstimation: { type: "percentage", percent: 40 },
    risk: "low",
    autoImplementable: false,
    enabled: true,
  },
  {
    id: "rds-rightsizing",
    name: "RDS Rightsizing",
    description: "Downsize underutilized RDS instances",
    category: "rightsizing",
    provider: "aws",
    applicableResourceTypes: ["aws_db_instance"],
    condition: { type: "utilization_below", metric: "cpu_utilization", threshold: 25, durationDays: 14 },
    savingsEstimation: { type: "percentage", percent: 35 },
    risk: "medium",
    autoImplementable: false,
    enabled: true,
  },
  {
    id: "idle-ec2",
    name: "Idle EC2 Instances",
    description: "Terminate EC2 instances with near-zero utilization",
    category: "idle_resource",
    provider: "aws",
    applicableResourceTypes: ["aws_instance"],
    condition: { type: "idle", daysIdle: 7, costThreshold: 10 },
    savingsEstimation: { type: "percentage", percent: 100 },
    risk: "medium",
    autoImplementable: false,
    enabled: true,
  },
  {
    id: "idle-ebs-volumes",
    name: "Unattached EBS Volumes",
    description: "Delete unattached EBS volumes accumulating cost",
    category: "idle_resource",
    provider: "aws",
    applicableResourceTypes: ["aws_ebs_volume"],
    condition: { type: "idle", daysIdle: 14, costThreshold: 5 },
    savingsEstimation: { type: "percentage", percent: 100 },
    risk: "low",
    autoImplementable: true,
    enabled: true,
  },
  {
    id: "idle-elastic-ips",
    name: "Unused Elastic IPs",
    description: "Release Elastic IPs not associated with running instances",
    category: "idle_resource",
    provider: "aws",
    applicableResourceTypes: ["aws_eip"],
    condition: { type: "idle", daysIdle: 1, costThreshold: 0 },
    savingsEstimation: { type: "fixed_monthly", amount: 3.6 },
    risk: "none",
    autoImplementable: true,
    enabled: true,
  },
  {
    id: "s3-intelligent-tiering",
    name: "S3 Intelligent Tiering",
    description: "Move infrequently accessed S3 objects to cheaper storage class",
    category: "storage_tiering",
    provider: "aws",
    applicableResourceTypes: ["aws_s3_bucket"],
    condition: { type: "storage_class_mismatch", currentClass: "STANDARD", recommendedClass: "INTELLIGENT_TIERING", accessFrequency: "infrequent" },
    savingsEstimation: { type: "percentage", percent: 30 },
    risk: "none",
    autoImplementable: true,
    enabled: true,
  },
  {
    id: "gp3-migration",
    name: "EBS gp2 to gp3 Migration",
    description: "Migrate gp2 volumes to gp3 for 20% cost reduction",
    category: "storage_tiering",
    provider: "aws",
    applicableResourceTypes: ["aws_ebs_volume"],
    condition: { type: "generation_outdated", currentGeneration: "gp2", latestGeneration: "gp3" },
    savingsEstimation: { type: "percentage", percent: 20 },
    risk: "low",
    autoImplementable: true,
    enabled: true,
  },
  {
    id: "reserved-instance-coverage",
    name: "Reserved Instance Coverage Gap",
    description: "Purchase reserved instances for stable workloads",
    category: "reserved_instances",
    provider: "aws",
    applicableResourceTypes: ["aws_instance", "aws_db_instance", "aws_elasticache_cluster"],
    condition: { type: "no_reserved_coverage", serviceType: "ec2", utilizationThreshold: 80 },
    savingsEstimation: { type: "commitment_discount", onDemandCost: 0, committedCost: 0, termMonths: 12 },
    risk: "low",
    autoImplementable: false,
    enabled: true,
  },
  {
    id: "dev-env-scheduling",
    name: "Development Environment Scheduling",
    description: "Schedule dev/staging environments to run only during business hours",
    category: "scheduling",
    provider: "any",
    applicableResourceTypes: ["aws_instance", "aws_db_instance", "aws_ecs_service", "azurerm_virtual_machine", "google_compute_instance"],
    condition: { type: "schedule_opportunity", onHours: 10, offHours: 14, weekendUsage: false },
    savingsEstimation: { type: "percentage", percent: 65 },
    risk: "none",
    autoImplementable: true,
    enabled: true,
  },
  {
    id: "data-transfer-optimization",
    name: "Data Transfer Optimization",
    description: "Reduce cross-region and cross-AZ data transfer costs",
    category: "data_transfer",
    provider: "aws",
    applicableResourceTypes: [],
    condition: { type: "data_transfer_excessive", gbPerMonth: 1000, costPerGb: 0.09 },
    savingsEstimation: { type: "percentage", percent: 40 },
    risk: "medium",
    autoImplementable: false,
    enabled: true,
  },
  {
    id: "azure-vm-rightsizing",
    name: "Azure VM Rightsizing",
    description: "Downsize underutilized Azure VMs",
    category: "rightsizing",
    provider: "azure",
    applicableResourceTypes: ["azurerm_virtual_machine"],
    condition: { type: "utilization_below", metric: "cpu_utilization", threshold: 30, durationDays: 14 },
    savingsEstimation: { type: "percentage", percent: 40 },
    risk: "low",
    autoImplementable: false,
    enabled: true,
  },
  {
    id: "gcp-vm-rightsizing",
    name: "GCP VM Rightsizing",
    description: "Apply GCP custom machine types for exact-fit sizing",
    category: "rightsizing",
    provider: "gcp",
    applicableResourceTypes: ["google_compute_instance"],
    condition: { type: "utilization_below", metric: "cpu_utilization", threshold: 30, durationDays: 14 },
    savingsEstimation: { type: "percentage", percent: 45 },
    risk: "low",
    autoImplementable: false,
    enabled: true,
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// §4 — Cost Forecasting
// ═══════════════════════════════════════════════════════════════════════════════

export type ForecastModel = "linear" | "exponential" | "seasonal" | "arima" | "weighted_average";

export interface CostForecast {
  orgId: string;
  provider: "aws" | "azure" | "gcp" | "all";
  forecastModel: ForecastModel;
  forecastPeriodDays: number;
  generatedAt: string;
  dataPoints: ForecastDataPoint[];
  confidenceInterval: ConfidenceInterval;
  assumptions: string[];
  accuracy: ForecastAccuracy;
}

export interface ForecastDataPoint {
  date: string;
  predictedCost: number;
  lowerBound: number;
  upperBound: number;
  baselineCost: number | null;
}

export interface ConfidenceInterval {
  level: number;
  lowerBoundPercent: number;
  upperBoundPercent: number;
}

export interface ForecastAccuracy {
  mape: number;
  rmse: number;
  dataPointsUsed: number;
  lastValidatedAt: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// §5 — FinOps Governance
// ═══════════════════════════════════════════════════════════════════════════════

export interface CostPolicy {
  id: string;
  name: string;
  description: string;
  type: CostPolicyType;
  scope: CostPolicyScope;
  threshold: CostPolicyThreshold;
  action: CostPolicyAction;
  enabled: boolean;
  createdBy: string;
  createdAt: string;
}

export type CostPolicyType =
  | "budget_limit"
  | "spend_rate_limit"
  | "resource_cost_cap"
  | "tag_enforcement"
  | "approval_threshold"
  | "anomaly_alert"
  | "commitment_coverage"
  | "waste_threshold";

export type CostPolicyScope =
  | { type: "org" }
  | { type: "team"; teamId: string }
  | { type: "project"; projectId: string }
  | { type: "environment"; environment: string }
  | { type: "service"; service: string }
  | { type: "provider"; provider: "aws" | "azure" | "gcp" };

export interface CostPolicyThreshold {
  value: number;
  unit: "usd" | "percent" | "count";
  period: CostGranularity | null;
}

export type CostPolicyAction =
  | { type: "alert"; channels: string[] }
  | { type: "require_approval"; approvers: string[] }
  | { type: "block"; reason: string }
  | { type: "throttle"; limitPercent: number }
  | { type: "tag_noncompliant"; tag: string };

export const DEFAULT_COST_POLICIES: CostPolicy[] = [
  {
    id: "monthly-budget-warning",
    name: "Monthly Budget 80% Warning",
    description: "Alert when monthly spend reaches 80% of budget",
    type: "budget_limit",
    scope: { type: "org" },
    threshold: { value: 80, unit: "percent", period: "monthly" },
    action: { type: "alert", channels: ["slack_finance", "email_admin"] },
    enabled: true,
    createdBy: "system",
    createdAt: "2026-01-01T00:00:00Z",
  },
  {
    id: "monthly-budget-critical",
    name: "Monthly Budget 95% Critical",
    description: "Require approval for new resources when budget at 95%",
    type: "budget_limit",
    scope: { type: "org" },
    threshold: { value: 95, unit: "percent", period: "monthly" },
    action: { type: "require_approval", approvers: ["finance_admin", "org_admin"] },
    enabled: true,
    createdBy: "system",
    createdAt: "2026-01-01T00:00:00Z",
  },
  {
    id: "single-resource-cost-cap",
    name: "Single Resource Cost Cap",
    description: "Alert on any single resource costing >$500/month",
    type: "resource_cost_cap",
    scope: { type: "org" },
    threshold: { value: 500, unit: "usd", period: "monthly" },
    action: { type: "alert", channels: ["slack_ops"] },
    enabled: true,
    createdBy: "system",
    createdAt: "2026-01-01T00:00:00Z",
  },
  {
    id: "cost-tag-enforcement",
    name: "Cost Allocation Tag Enforcement",
    description: "Flag resources missing required cost allocation tags",
    type: "tag_enforcement",
    scope: { type: "org" },
    threshold: { value: 0, unit: "count", period: null },
    action: { type: "tag_noncompliant", tag: "cost-center" },
    enabled: true,
    createdBy: "system",
    createdAt: "2026-01-01T00:00:00Z",
  },
  {
    id: "waste-threshold",
    name: "Monthly Waste Threshold",
    description: "Alert when estimated waste exceeds 10% of total spend",
    type: "waste_threshold",
    scope: { type: "org" },
    threshold: { value: 10, unit: "percent", period: "monthly" },
    action: { type: "alert", channels: ["slack_finance", "email_admin"] },
    enabled: true,
    createdBy: "system",
    createdAt: "2026-01-01T00:00:00Z",
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// §6 — Cost Attribution & Showback
// ═══════════════════════════════════════════════════════════════════════════════

export interface CostAttributionModel {
  orgId: string;
  attributionType: "direct" | "shared" | "proportional";
  dimensions: CostDimension[];
  sharedCostAllocation: SharedCostAllocationMethod;
  untaggedCostHandling: "pool" | "distribute_proportional" | "assign_default";
}

export type SharedCostAllocationMethod =
  | { type: "even_split" }
  | { type: "proportional_to_usage" }
  | { type: "proportional_to_direct_cost" }
  | { type: "custom_weights"; weights: Record<string, number> };

export interface CostShowbackReport {
  orgId: string;
  periodStart: string;
  periodEnd: string;
  teams: TeamCostReport[];
  unattributedCost: number;
  sharedServicesCost: number;
  totalCost: number;
}

export interface TeamCostReport {
  teamId: string;
  teamName: string;
  directCost: number;
  sharedCostAllocation: number;
  totalCost: number;
  percentOfOrgTotal: number;
  costByService: Record<string, number>;
  costByEnvironment: Record<string, number>;
  trend: CostTrendDirection;
  optimizationOpportunities: number;
  estimatedSavings: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// §7 — Provider Cost APIs
// ═══════════════════════════════════════════════════════════════════════════════

export interface ProviderCostProfile {
  provider: "aws" | "azure" | "gcp";
  costExplorerApi: string;
  billingApi: string;
  pricingApi: string;
  supportedGranularities: CostGranularity[];
  supportedDimensions: CostDimension[];
  dataLatencyHours: number;
  maxHistoryDays: number;
  reservationApi: string | null;
  savingsPlanApi: string | null;
  budgetApi: string | null;
  anomalyDetectionApi: string | null;
  tagRequirements: TagRequirement[];
}

export interface TagRequirement {
  key: string;
  required: boolean;
  description: string;
  validValues: string[] | null;
}

export const PROVIDER_COST_PROFILES: ProviderCostProfile[] = [
  {
    provider: "aws",
    costExplorerApi: "ce:GetCostAndUsage",
    billingApi: "ce:GetCostForecast",
    pricingApi: "pricing:GetProducts",
    supportedGranularities: ["hourly", "daily", "monthly"],
    supportedDimensions: ["service", "resource", "account", "region", "tag", "usage_type", "operation"],
    dataLatencyHours: 24,
    maxHistoryDays: 365,
    reservationApi: "ce:GetReservationUtilization",
    savingsPlanApi: "ce:GetSavingsPlansUtilization",
    budgetApi: "budgets:DescribeBudgets",
    anomalyDetectionApi: "ce:GetAnomalies",
    tagRequirements: [
      { key: "cost-center", required: true, description: "Cost center for chargeback", validValues: null },
      { key: "environment", required: true, description: "Environment tag", validValues: ["production", "staging", "development", "sandbox"] },
      { key: "team", required: true, description: "Owning team identifier", validValues: null },
      { key: "project", required: false, description: "Project identifier", validValues: null },
    ],
  },
  {
    provider: "azure",
    costExplorerApi: "Microsoft.CostManagement/query",
    billingApi: "Microsoft.CostManagement/forecast",
    pricingApi: "Microsoft.Commerce/RateCard",
    supportedGranularities: ["daily", "monthly"],
    supportedDimensions: ["service", "resource", "region", "tag"],
    dataLatencyHours: 48,
    maxHistoryDays: 365,
    reservationApi: "Microsoft.Consumption/reservationUtilization",
    savingsPlanApi: null,
    budgetApi: "Microsoft.Consumption/budgets",
    anomalyDetectionApi: "Microsoft.CostManagement/alerts",
    tagRequirements: [
      { key: "cost-center", required: true, description: "Cost center for chargeback", validValues: null },
      { key: "environment", required: true, description: "Environment tag", validValues: ["production", "staging", "development", "sandbox"] },
    ],
  },
  {
    provider: "gcp",
    costExplorerApi: "bigquery:cloud_billing_export",
    billingApi: "cloudbilling.googleapis.com",
    pricingApi: "cloudbilling.googleapis.com/v1/services",
    supportedGranularities: ["hourly", "daily", "monthly"],
    supportedDimensions: ["service", "resource", "project", "region", "tag"],
    dataLatencyHours: 24,
    maxHistoryDays: 365,
    reservationApi: "compute.googleapis.com/commitments",
    savingsPlanApi: null,
    budgetApi: "billingbudgets.googleapis.com",
    anomalyDetectionApi: null,
    tagRequirements: [
      { key: "cost-center", required: true, description: "Cost center label", validValues: null },
      { key: "environment", required: true, description: "Environment label", validValues: ["production", "staging", "development", "sandbox"] },
    ],
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// §8 — Cost Intelligence Pipeline
// ═══════════════════════════════════════════════════════════════════════════════

export type CostPipelineStageId =
  | "data_collection"
  | "normalization"
  | "attribution"
  | "anomaly_detection"
  | "trend_analysis"
  | "forecasting"
  | "optimization_scan"
  | "policy_evaluation"
  | "report_generation"
  | "notification"
  | "memory_recording";

export interface CostPipelineStage {
  id: CostPipelineStageId;
  name: string;
  description: string;
  order: number;
  required: boolean;
  scheduleFrequency: CostGranularity;
  timeoutMs: number;
  dependsOn: CostPipelineStageId[];
}

export const COST_PIPELINE: CostPipelineStage[] = [
  { id: "data_collection", name: "Data Collection", description: "Collect cost data from provider APIs", order: 1, required: true, scheduleFrequency: "daily", timeoutMs: 120_000, dependsOn: [] },
  { id: "normalization", name: "Cost Normalization", description: "Normalize costs across providers to common format", order: 2, required: true, scheduleFrequency: "daily", timeoutMs: 30_000, dependsOn: ["data_collection"] },
  { id: "attribution", name: "Cost Attribution", description: "Attribute costs to teams, projects, environments", order: 3, required: true, scheduleFrequency: "daily", timeoutMs: 30_000, dependsOn: ["normalization"] },
  { id: "anomaly_detection", name: "Anomaly Detection", description: "Detect cost anomalies against baseline", order: 4, required: true, scheduleFrequency: "daily", timeoutMs: 60_000, dependsOn: ["normalization"] },
  { id: "trend_analysis", name: "Trend Analysis", description: "Analyze cost trends across dimensions", order: 5, required: true, scheduleFrequency: "daily", timeoutMs: 30_000, dependsOn: ["attribution"] },
  { id: "forecasting", name: "Cost Forecasting", description: "Generate cost forecasts using historical data", order: 6, required: true, scheduleFrequency: "weekly", timeoutMs: 120_000, dependsOn: ["trend_analysis"] },
  { id: "optimization_scan", name: "Optimization Scan", description: "Scan for cost optimization opportunities", order: 7, required: true, scheduleFrequency: "daily", timeoutMs: 120_000, dependsOn: ["normalization"] },
  { id: "policy_evaluation", name: "Policy Evaluation", description: "Evaluate cost policies and budgets", order: 8, required: true, scheduleFrequency: "daily", timeoutMs: 15_000, dependsOn: ["attribution", "forecasting"] },
  { id: "report_generation", name: "Report Generation", description: "Generate cost intelligence reports", order: 9, required: true, scheduleFrequency: "daily", timeoutMs: 30_000, dependsOn: ["policy_evaluation"] },
  { id: "notification", name: "Notification", description: "Send cost alerts and reports", order: 10, required: false, scheduleFrequency: "daily", timeoutMs: 10_000, dependsOn: ["report_generation"] },
  { id: "memory_recording", name: "Memory Recording", description: "Record cost patterns in operational memory", order: 11, required: true, scheduleFrequency: "weekly", timeoutMs: 15_000, dependsOn: ["report_generation"] },
];

// ═══════════════════════════════════════════════════════════════════════════════
// §9 — Integration Contracts
// ═══════════════════════════════════════════════════════════════════════════════

export type CostIntegrationTarget =
  | "signal_detection"
  | "cognitive_loop"
  | "planning_engine"
  | "terraform_generation"
  | "memory_system"
  | "governance_engine"
  | "observability"
  | "notification_system"
  | "org_intelligence"
  | "simulation_engine";

export interface CostIntegrationContract {
  target: CostIntegrationTarget;
  direction: "consumes" | "produces" | "bidirectional";
  description: string;
  dataFlow: string;
}

export const COST_INTEGRATION_CONTRACTS: CostIntegrationContract[] = [
  { target: "signal_detection", direction: "produces", description: "Generates cost anomaly signals", dataFlow: "CostAnomaly → OperationalSignal" },
  { target: "cognitive_loop", direction: "produces", description: "Provides cost context for reasoning", dataFlow: "CostContext → CognitiveInput" },
  { target: "planning_engine", direction: "produces", description: "Provides cost impact for execution plans", dataFlow: "CostEstimate → PlanCostAnalysis" },
  { target: "terraform_generation", direction: "produces", description: "Provides cost analysis for generated changes", dataFlow: "ResourceCost → ChangeSetCostImpact" },
  { target: "memory_system", direction: "produces", description: "Records cost patterns and optimization outcomes", dataFlow: "CostPattern → OperationalMemory" },
  { target: "governance_engine", direction: "bidirectional", description: "Enforces cost policies, receives policy updates", dataFlow: "CostViolation ↔ PolicyDecision" },
  { target: "observability", direction: "produces", description: "Emits cost intelligence metrics", dataFlow: "CostMetric → ObservabilityPipeline" },
  { target: "notification_system", direction: "produces", description: "Sends cost alerts and reports", dataFlow: "CostAlert → NotificationChannel" },
  { target: "org_intelligence", direction: "bidirectional", description: "Learns org cost preferences, applies them", dataFlow: "CostBehavior ↔ OrgPreferences" },
  { target: "simulation_engine", direction: "produces", description: "Provides cost models for simulation", dataFlow: "CostModel → SimulationInput" },
];

// ═══════════════════════════════════════════════════════════════════════════════
// §10 — Query Functions
// ═══════════════════════════════════════════════════════════════════════════════

export function getOptimizationRule(id: string): OptimizationRule | undefined {
  return OPTIMIZATION_RULES.find((r) => r.id === id);
}

export function getOptimizationRulesByCategory(category: OptimizationCategory): OptimizationRule[] {
  return OPTIMIZATION_RULES.filter((r) => r.category === category);
}

export function getOptimizationRulesByProvider(provider: "aws" | "azure" | "gcp"): OptimizationRule[] {
  return OPTIMIZATION_RULES.filter((r) => r.provider === provider || r.provider === "any");
}

export function getAutoImplementableRules(): OptimizationRule[] {
  return OPTIMIZATION_RULES.filter((r) => r.autoImplementable);
}

export function getEnabledOptimizationRules(): OptimizationRule[] {
  return OPTIMIZATION_RULES.filter((r) => r.enabled);
}

export function getCostPolicy(id: string): CostPolicy | undefined {
  return DEFAULT_COST_POLICIES.find((p) => p.id === id);
}

export function getProviderCostProfile(provider: "aws" | "azure" | "gcp"): ProviderCostProfile | undefined {
  return PROVIDER_COST_PROFILES.find((p) => p.provider === provider);
}

export function getCostPipelineStage(id: CostPipelineStageId): CostPipelineStage | undefined {
  return COST_PIPELINE.find((s) => s.id === id);
}

export function getCostPipelineOrder(): CostPipelineStageId[] {
  return [...COST_PIPELINE].sort((a, b) => a.order - b.order).map((s) => s.id);
}

export function getCostIntegration(target: CostIntegrationTarget): CostIntegrationContract | undefined {
  return COST_INTEGRATION_CONTRACTS.find((c) => c.target === target);
}

export function estimateOptimizationSavings(rules: OptimizationRule[], currentMonthlyCost: number): number {
  let totalSavingsPercent = 0;
  for (const rule of rules) {
    if (rule.savingsEstimation.type === "percentage") {
      totalSavingsPercent += rule.savingsEstimation.percent;
    }
  }
  return currentMonthlyCost * Math.min(totalSavingsPercent, 100) / 100;
}

// ═══════════════════════════════════════════════════════════════════════════════
// §11 — Tests
// ═══════════════════════════════════════════════════════════════════════════════

export interface CostIntelligenceTestResult {
  name: string;
  passed: boolean;
  message: string;
}

export function runCostIntelligenceTests(): CostIntelligenceTestResult[] {
  const results: CostIntelligenceTestResult[] = [];
  const assert = (name: string, condition: boolean, msg: string) => {
    results.push({ name, passed: condition, message: condition ? "OK" : msg });
  };

  // §1 — Architecture
  assert("cost-dimensions-10", (["service", "resource", "account", "region", "tag", "team", "environment", "project", "usage_type", "operation"] as CostDimension[]).length === 10, "Should have 10 cost dimensions");

  // §2 — Anomaly Detection
  assert("anomaly-types-10", (["spike", "sustained_increase", "unexpected_service", "region_outlier", "idle_resource_cost", "data_transfer_surge", "reserved_instance_underutilization", "spot_termination_cascade", "new_resource_cost", "billing_error"] as AnomalyType[]).length === 10, "Should have 10 anomaly types");
  assert("default-anomaly-config", DEFAULT_ANOMALY_CONFIG.baselineWindowDays === 30, "Default baseline should be 30 days");

  // §3 — Optimization Rules
  assert("optimization-rules-12", OPTIMIZATION_RULES.length === 12, "Should have 12 optimization rules");
  assert("enabled-rules", getEnabledOptimizationRules().length === 12, "All rules should be enabled");
  assert("auto-implementable", getAutoImplementableRules().length >= 4, "Should have at least 4 auto-implementable rules");
  assert("aws-rules", getOptimizationRulesByProvider("aws").length >= 8, "AWS should have at least 8 rules");
  assert("azure-rules", getOptimizationRulesByProvider("azure").length >= 2, "Azure should have at least 2 rules");
  assert("gcp-rules", getOptimizationRulesByProvider("gcp").length >= 2, "GCP should have at least 2 rules");
  assert("rightsizing-rules", getOptimizationRulesByCategory("rightsizing").length >= 3, "Should have at least 3 rightsizing rules");
  assert("idle-resource-rules", getOptimizationRulesByCategory("idle_resource").length >= 3, "Should have at least 3 idle resource rules");
  assert("rule-lookup", getOptimizationRule("ec2-rightsizing")?.category === "rightsizing", "EC2 rightsizing should be categorized correctly");

  // §5 — FinOps Governance
  assert("cost-policies-5", DEFAULT_COST_POLICIES.length === 5, "Should have 5 default cost policies");
  assert("budget-warning-policy", getCostPolicy("monthly-budget-warning") !== undefined, "Budget warning policy should exist");
  assert("tag-enforcement-policy", getCostPolicy("cost-tag-enforcement") !== undefined, "Tag enforcement policy should exist");

  // §7 — Provider Profiles
  assert("three-provider-profiles", PROVIDER_COST_PROFILES.length === 3, "Should have 3 provider cost profiles");
  assert("aws-cost-profile", getProviderCostProfile("aws")?.costExplorerApi === "ce:GetCostAndUsage", "AWS should use Cost Explorer");
  assert("aws-tag-requirements", getProviderCostProfile("aws")!.tagRequirements.length >= 3, "AWS should require 3+ tags");

  // §8 — Pipeline
  assert("cost-pipeline-11-stages", COST_PIPELINE.length === 11, "Should have 11 pipeline stages");
  assert("pipeline-ordered", COST_PIPELINE.every((s, i) => i === 0 || s.order >= COST_PIPELINE[i - 1].order), "Pipeline should be ordered");
  assert("data-collection-first", getCostPipelineStage("data_collection")?.order === 1, "Data collection should be first");

  // §9 — Integration Contracts
  assert("integration-contracts-10", COST_INTEGRATION_CONTRACTS.length === 10, "Should have 10 integration contracts");
  assert("signal-integration", getCostIntegration("signal_detection")?.direction === "produces", "Should produce to signal detection");
  assert("governance-bidirectional", getCostIntegration("governance_engine")?.direction === "bidirectional", "Governance should be bidirectional");

  // §10 — Savings Estimation
  assert("savings-estimate", estimateOptimizationSavings([OPTIMIZATION_RULES[0]], 1000) === 400, "40% savings on $1000 should be $400");
  assert("savings-estimate-cap", estimateOptimizationSavings(OPTIMIZATION_RULES, 1000) <= 1000, "Savings should not exceed total cost");

  return results;
}
