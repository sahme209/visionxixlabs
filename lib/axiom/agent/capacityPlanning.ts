/**
 * Axiom Agent — Capacity Planning & Auto-Scaling Intelligence
 *
 * Predictive capacity management that prevents outages by analyzing
 * utilization trends, forecasting demand, and generating scaling
 * recommendations across AWS, Azure, and GCP.
 *
 * This module bridges signal detection (observations) with execution
 * (auto-scaling actions) — the proactive arm of Axiom Agent.
 */

// ═══════════════════════════════════════════════════════════════════════════════
// §1 — Capacity Architecture
// ═══════════════════════════════════════════════════════════════════════════════

export type ResourceDimension =
  | "cpu"
  | "memory"
  | "disk"
  | "network_bandwidth"
  | "iops"
  | "connections"
  | "request_rate"
  | "queue_depth"
  | "gpu"
  | "storage_capacity";

export type CapacityStatus = "healthy" | "warning" | "critical" | "over_provisioned" | "unknown";

export type ScalingDirection = "scale_up" | "scale_down" | "scale_out" | "scale_in" | "no_change";

export interface CapacityMetric {
  resourceArn: string;
  resourceType: string;
  provider: "aws" | "azure" | "gcp";
  dimension: ResourceDimension;
  currentValue: number;
  maxCapacity: number;
  utilizationPercent: number;
  unit: string;
  timestamp: string;
}

export interface CapacityThresholds {
  dimension: ResourceDimension;
  warningPercent: number;
  criticalPercent: number;
  overProvisionedBelowPercent: number;
  evaluationPeriodMinutes: number;
  cooldownMinutes: number;
}

export const DEFAULT_CAPACITY_THRESHOLDS: CapacityThresholds[] = [
  { dimension: "cpu", warningPercent: 75, criticalPercent: 90, overProvisionedBelowPercent: 20, evaluationPeriodMinutes: 15, cooldownMinutes: 10 },
  { dimension: "memory", warningPercent: 80, criticalPercent: 92, overProvisionedBelowPercent: 25, evaluationPeriodMinutes: 15, cooldownMinutes: 10 },
  { dimension: "disk", warningPercent: 80, criticalPercent: 90, overProvisionedBelowPercent: 30, evaluationPeriodMinutes: 60, cooldownMinutes: 30 },
  { dimension: "network_bandwidth", warningPercent: 70, criticalPercent: 85, overProvisionedBelowPercent: 15, evaluationPeriodMinutes: 5, cooldownMinutes: 5 },
  { dimension: "iops", warningPercent: 75, criticalPercent: 90, overProvisionedBelowPercent: 20, evaluationPeriodMinutes: 10, cooldownMinutes: 10 },
  { dimension: "connections", warningPercent: 70, criticalPercent: 85, overProvisionedBelowPercent: 20, evaluationPeriodMinutes: 5, cooldownMinutes: 5 },
  { dimension: "request_rate", warningPercent: 75, criticalPercent: 90, overProvisionedBelowPercent: 15, evaluationPeriodMinutes: 5, cooldownMinutes: 5 },
  { dimension: "queue_depth", warningPercent: 60, criticalPercent: 80, overProvisionedBelowPercent: 10, evaluationPeriodMinutes: 5, cooldownMinutes: 5 },
  { dimension: "gpu", warningPercent: 80, criticalPercent: 95, overProvisionedBelowPercent: 30, evaluationPeriodMinutes: 15, cooldownMinutes: 15 },
  { dimension: "storage_capacity", warningPercent: 75, criticalPercent: 85, overProvisionedBelowPercent: 40, evaluationPeriodMinutes: 1440, cooldownMinutes: 60 },
];

// ═══════════════════════════════════════════════════════════════════════════════
// §2 — Demand Forecasting
// ═══════════════════════════════════════════════════════════════════════════════

export type ForecastModel =
  | "linear_regression"
  | "exponential_smoothing"
  | "seasonal_decomposition"
  | "holt_winters"
  | "arima"
  | "prophet_style"
  | "ensemble";

export type ForecastHorizon = "1h" | "6h" | "24h" | "7d" | "30d" | "90d";

export interface DemandForecast {
  resourceArn: string;
  dimension: ResourceDimension;
  generatedAt: string;
  model: ForecastModel;
  horizon: ForecastHorizon;
  dataPointsUsed: number;
  predictions: ForecastPoint[];
  confidence: number;
  seasonalPatterns: SeasonalPattern[];
  breachPrediction?: CapacityBreachPrediction;
}

export interface ForecastPoint {
  timestamp: string;
  predictedValue: number;
  lowerBound: number;
  upperBound: number;
  confidencePercent: number;
}

export interface SeasonalPattern {
  type: "daily" | "weekly" | "monthly" | "event_driven";
  peakHour?: number;
  peakDay?: string;
  peakWeek?: number;
  amplitudePercent: number;
  description: string;
}

export interface CapacityBreachPrediction {
  dimension: ResourceDimension;
  predictedBreachTime: string;
  hoursUntilBreach: number;
  currentUtilization: number;
  predictedUtilizationAtBreach: number;
  confidence: number;
  recommendedAction: ScalingDirection;
}

export interface ForecastConfig {
  id: string;
  name: string;
  model: ForecastModel;
  minDataPointsRequired: number;
  maxHistoryDays: number;
  retrainIntervalHours: number;
  confidenceThreshold: number;
  description: string;
}

export const FORECAST_CONFIGS: ForecastConfig[] = [
  { id: "fc-linear", name: "Linear Regression", model: "linear_regression", minDataPointsRequired: 24, maxHistoryDays: 7, retrainIntervalHours: 6, confidenceThreshold: 0.6, description: "Simple trend extrapolation for short-term predictions" },
  { id: "fc-exp-smooth", name: "Exponential Smoothing", model: "exponential_smoothing", minDataPointsRequired: 48, maxHistoryDays: 14, retrainIntervalHours: 12, confidenceThreshold: 0.65, description: "Weighted moving average with recency bias" },
  { id: "fc-seasonal", name: "Seasonal Decomposition", model: "seasonal_decomposition", minDataPointsRequired: 168, maxHistoryDays: 30, retrainIntervalHours: 24, confidenceThreshold: 0.7, description: "Separates trend, seasonal, and residual components" },
  { id: "fc-holt-winters", name: "Holt-Winters", model: "holt_winters", minDataPointsRequired: 336, maxHistoryDays: 60, retrainIntervalHours: 24, confidenceThreshold: 0.75, description: "Triple exponential smoothing with level, trend, and seasonality" },
  { id: "fc-ensemble", name: "Ensemble Forecast", model: "ensemble", minDataPointsRequired: 168, maxHistoryDays: 90, retrainIntervalHours: 12, confidenceThreshold: 0.8, description: "Weighted combination of multiple models for robust predictions" },
];

// ═══════════════════════════════════════════════════════════════════════════════
// §3 — Scaling Rules & Policies
// ═══════════════════════════════════════════════════════════════════════════════

export type ScalingTrigger =
  | "threshold_breach"
  | "forecast_breach"
  | "schedule"
  | "event"
  | "anomaly"
  | "manual";

export interface ScalingRule {
  id: string;
  name: string;
  description: string;
  provider: "aws" | "azure" | "gcp" | "all";
  resourceTypes: string[];
  trigger: ScalingTrigger;
  dimension: ResourceDimension;
  direction: ScalingDirection;
  conditions: ScalingCondition[];
  cooldownMinutes: number;
  maxScaleStepPercent: number;
  requiresApproval: boolean;
  automatable: boolean;
}

export interface ScalingCondition {
  metric: string;
  operator: "gt" | "lt" | "gte" | "lte" | "eq";
  threshold: number;
  durationMinutes: number;
}

export const SCALING_RULES: ScalingRule[] = [
  {
    id: "scale-ec2-cpu-up",
    name: "EC2 CPU Scale Up",
    description: "Scale up EC2 instances when CPU exceeds threshold",
    provider: "aws",
    resourceTypes: ["AWS::EC2::Instance", "AWS::AutoScaling::AutoScalingGroup"],
    trigger: "threshold_breach",
    dimension: "cpu",
    direction: "scale_out",
    conditions: [{ metric: "CPUUtilization", operator: "gt", threshold: 80, durationMinutes: 10 }],
    cooldownMinutes: 10,
    maxScaleStepPercent: 50,
    requiresApproval: false,
    automatable: true,
  },
  {
    id: "scale-ec2-cpu-down",
    name: "EC2 CPU Scale Down",
    description: "Scale down EC2 instances when CPU is consistently low",
    provider: "aws",
    resourceTypes: ["AWS::AutoScaling::AutoScalingGroup"],
    trigger: "threshold_breach",
    dimension: "cpu",
    direction: "scale_in",
    conditions: [{ metric: "CPUUtilization", operator: "lt", threshold: 25, durationMinutes: 30 }],
    cooldownMinutes: 15,
    maxScaleStepPercent: 25,
    requiresApproval: false,
    automatable: true,
  },
  {
    id: "scale-rds-connections",
    name: "RDS Connection Pool Scale Up",
    description: "Resize RDS when connection count approaches limit",
    provider: "aws",
    resourceTypes: ["AWS::RDS::DBInstance"],
    trigger: "threshold_breach",
    dimension: "connections",
    direction: "scale_up",
    conditions: [{ metric: "DatabaseConnections", operator: "gt", threshold: 80, durationMinutes: 5 }],
    cooldownMinutes: 30,
    maxScaleStepPercent: 100,
    requiresApproval: true,
    automatable: true,
  },
  {
    id: "scale-rds-storage",
    name: "RDS Storage Auto-Expansion",
    description: "Expand RDS storage when disk utilization is high",
    provider: "aws",
    resourceTypes: ["AWS::RDS::DBInstance"],
    trigger: "forecast_breach",
    dimension: "storage_capacity",
    direction: "scale_up",
    conditions: [{ metric: "FreeStorageSpace", operator: "lt", threshold: 20, durationMinutes: 60 }],
    cooldownMinutes: 60,
    maxScaleStepPercent: 50,
    requiresApproval: true,
    automatable: true,
  },
  {
    id: "scale-ecs-tasks",
    name: "ECS Task Count Scale",
    description: "Scale ECS service tasks based on request rate",
    provider: "aws",
    resourceTypes: ["AWS::ECS::Service"],
    trigger: "threshold_breach",
    dimension: "request_rate",
    direction: "scale_out",
    conditions: [{ metric: "RequestCountPerTarget", operator: "gt", threshold: 1000, durationMinutes: 5 }],
    cooldownMinutes: 5,
    maxScaleStepPercent: 100,
    requiresApproval: false,
    automatable: true,
  },
  {
    id: "scale-lambda-concurrency",
    name: "Lambda Reserved Concurrency Adjustment",
    description: "Adjust Lambda reserved concurrency when throttling detected",
    provider: "aws",
    resourceTypes: ["AWS::Lambda::Function"],
    trigger: "anomaly",
    dimension: "request_rate",
    direction: "scale_up",
    conditions: [{ metric: "Throttles", operator: "gt", threshold: 0, durationMinutes: 5 }],
    cooldownMinutes: 5,
    maxScaleStepPercent: 100,
    requiresApproval: false,
    automatable: true,
  },
  {
    id: "scale-sqs-consumers",
    name: "SQS Consumer Scale Out",
    description: "Add consumers when queue depth grows",
    provider: "aws",
    resourceTypes: ["AWS::SQS::Queue"],
    trigger: "threshold_breach",
    dimension: "queue_depth",
    direction: "scale_out",
    conditions: [{ metric: "ApproximateNumberOfMessagesVisible", operator: "gt", threshold: 1000, durationMinutes: 5 }],
    cooldownMinutes: 5,
    maxScaleStepPercent: 100,
    requiresApproval: false,
    automatable: true,
  },
  {
    id: "scale-ebs-iops",
    name: "EBS IOPS Scale Up",
    description: "Upgrade EBS volume IOPS when throughput bottlenecked",
    provider: "aws",
    resourceTypes: ["AWS::EC2::Volume"],
    trigger: "threshold_breach",
    dimension: "iops",
    direction: "scale_up",
    conditions: [{ metric: "VolumeQueueLength", operator: "gt", threshold: 1, durationMinutes: 15 }],
    cooldownMinutes: 60,
    maxScaleStepPercent: 100,
    requiresApproval: true,
    automatable: true,
  },
  {
    id: "scale-azure-vmss",
    name: "Azure VMSS Auto-Scale",
    description: "Scale Azure VM Scale Set instances on CPU utilization",
    provider: "azure",
    resourceTypes: ["Microsoft.Compute/virtualMachineScaleSets"],
    trigger: "threshold_breach",
    dimension: "cpu",
    direction: "scale_out",
    conditions: [{ metric: "Percentage CPU", operator: "gt", threshold: 80, durationMinutes: 10 }],
    cooldownMinutes: 10,
    maxScaleStepPercent: 50,
    requiresApproval: false,
    automatable: true,
  },
  {
    id: "scale-gcp-mig",
    name: "GCP Managed Instance Group Scale",
    description: "Scale GCP MIG based on CPU utilization target",
    provider: "gcp",
    resourceTypes: ["compute.googleapis.com/InstanceGroupManager"],
    trigger: "threshold_breach",
    dimension: "cpu",
    direction: "scale_out",
    conditions: [{ metric: "instance/cpu/utilization", operator: "gt", threshold: 0.8, durationMinutes: 10 }],
    cooldownMinutes: 10,
    maxScaleStepPercent: 50,
    requiresApproval: false,
    automatable: true,
  },
  {
    id: "scale-predictive-prewarming",
    name: "Predictive Pre-Warming",
    description: "Pre-scale resources based on forecasted demand peak",
    provider: "all",
    resourceTypes: ["AWS::AutoScaling::AutoScalingGroup", "AWS::ECS::Service", "Microsoft.Compute/virtualMachineScaleSets"],
    trigger: "forecast_breach",
    dimension: "cpu",
    direction: "scale_out",
    conditions: [{ metric: "forecast_utilization", operator: "gt", threshold: 70, durationMinutes: 0 }],
    cooldownMinutes: 30,
    maxScaleStepPercent: 30,
    requiresApproval: false,
    automatable: true,
  },
  {
    id: "scale-off-hours-reduction",
    name: "Off-Hours Capacity Reduction",
    description: "Reduce capacity during non-business hours for cost savings",
    provider: "all",
    resourceTypes: ["AWS::AutoScaling::AutoScalingGroup", "AWS::ECS::Service"],
    trigger: "schedule",
    dimension: "cpu",
    direction: "scale_in",
    conditions: [{ metric: "schedule", operator: "eq", threshold: 0, durationMinutes: 0 }],
    cooldownMinutes: 60,
    maxScaleStepPercent: 50,
    requiresApproval: false,
    automatable: true,
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// §4 — Resource Right-Sizing
// ═══════════════════════════════════════════════════════════════════════════════

export interface RightSizingRecommendation {
  resourceArn: string;
  resourceType: string;
  provider: "aws" | "azure" | "gcp";
  currentSpec: ResourceSpec;
  recommendedSpec: ResourceSpec;
  reason: string;
  confidence: number;
  estimatedMonthlySavings: number;
  estimatedPerformanceImpact: "improved" | "neutral" | "slight_risk" | "risk";
  analysisWindowDays: number;
  peakUtilization: Record<ResourceDimension, number>;
  averageUtilization: Record<ResourceDimension, number>;
}

export interface ResourceSpec {
  instanceType?: string;
  vcpus?: number;
  memoryGb?: number;
  storageGb?: number;
  iops?: number;
  networkBandwidthGbps?: number;
  estimatedMonthlyCost: number;
}

export interface RightSizingPolicy {
  id: string;
  name: string;
  description: string;
  minAnalysisDays: number;
  maxUtilizationTarget: number;
  minUtilizationFloor: number;
  peakHeadroomPercent: number;
  excludePatterns: string[];
  requiresApproval: boolean;
}

export const DEFAULT_RIGHTSIZING_POLICY: RightSizingPolicy = {
  id: "default-rightsizing",
  name: "Default Right-Sizing Policy",
  description: "Standard right-sizing analysis parameters",
  minAnalysisDays: 14,
  maxUtilizationTarget: 70,
  minUtilizationFloor: 10,
  peakHeadroomPercent: 30,
  excludePatterns: [],
  requiresApproval: true,
};

// ═══════════════════════════════════════════════════════════════════════════════
// §5 — Capacity Planning Pipeline
// ═══════════════════════════════════════════════════════════════════════════════

export type CapacityPipelineStageId =
  | "collect_metrics"
  | "evaluate_thresholds"
  | "run_forecasts"
  | "detect_anomalies"
  | "compute_rightsizing"
  | "evaluate_scaling_rules"
  | "generate_actions"
  | "safety_check"
  | "emit_recommendations"
  | "update_dashboard";

export interface CapacityPipelineStage {
  id: CapacityPipelineStageId;
  name: string;
  order: number;
  timeoutMs: number;
  parallelizable: boolean;
  metricsKey: string;
  description: string;
}

export const CAPACITY_PIPELINE: CapacityPipelineStage[] = [
  { id: "collect_metrics", name: "Collect Metrics", order: 1, timeoutMs: 30_000, parallelizable: false, metricsKey: "capacity_pipeline.collect", description: "Gather utilization metrics from CloudWatch, Azure Monitor, GCP Monitoring" },
  { id: "evaluate_thresholds", name: "Evaluate Thresholds", order: 2, timeoutMs: 5_000, parallelizable: true, metricsKey: "capacity_pipeline.thresholds", description: "Check current utilization against warning/critical thresholds" },
  { id: "run_forecasts", name: "Run Forecasts", order: 3, timeoutMs: 60_000, parallelizable: true, metricsKey: "capacity_pipeline.forecasts", description: "Run demand forecasting models on historical metric data" },
  { id: "detect_anomalies", name: "Detect Anomalies", order: 4, timeoutMs: 15_000, parallelizable: true, metricsKey: "capacity_pipeline.anomalies", description: "Identify unusual capacity patterns that deviate from forecasts" },
  { id: "compute_rightsizing", name: "Compute Right-Sizing", order: 5, timeoutMs: 30_000, parallelizable: true, metricsKey: "capacity_pipeline.rightsizing", description: "Analyze resource utilization for right-sizing opportunities" },
  { id: "evaluate_scaling_rules", name: "Evaluate Scaling Rules", order: 6, timeoutMs: 10_000, parallelizable: false, metricsKey: "capacity_pipeline.scaling", description: "Match current state against scaling rules for action generation" },
  { id: "generate_actions", name: "Generate Actions", order: 7, timeoutMs: 10_000, parallelizable: false, metricsKey: "capacity_pipeline.actions", description: "Create concrete scaling and right-sizing action plans" },
  { id: "safety_check", name: "Safety Check", order: 8, timeoutMs: 5_000, parallelizable: false, metricsKey: "capacity_pipeline.safety", description: "Validate actions against safety constraints and blast radius limits" },
  { id: "emit_recommendations", name: "Emit Recommendations", order: 9, timeoutMs: 5_000, parallelizable: false, metricsKey: "capacity_pipeline.emit", description: "Publish recommendations to signal detection and notification engine" },
  { id: "update_dashboard", name: "Update Dashboard", order: 10, timeoutMs: 5_000, parallelizable: false, metricsKey: "capacity_pipeline.dashboard", description: "Push capacity metrics and forecasts to dashboard API" },
];

// ═══════════════════════════════════════════════════════════════════════════════
// §6 — Provider Capacity Profiles
// ═══════════════════════════════════════════════════════════════════════════════

export interface ProviderCapacityProfile {
  provider: "aws" | "azure" | "gcp";
  supportedDimensions: ResourceDimension[];
  metricSources: CapacityMetricSource[];
  scalingLatencyMs: Record<string, number>;
  maxScaleOperationsPerHour: number;
}

export interface CapacityMetricSource {
  dimension: ResourceDimension;
  service: string;
  metricName: string;
  namespace: string;
  statistic: "Average" | "Maximum" | "Minimum" | "Sum" | "p99";
  periodSeconds: number;
}

export const PROVIDER_CAPACITY_PROFILES: ProviderCapacityProfile[] = [
  {
    provider: "aws",
    supportedDimensions: ["cpu", "memory", "disk", "network_bandwidth", "iops", "connections", "request_rate", "queue_depth", "gpu", "storage_capacity"],
    metricSources: [
      { dimension: "cpu", service: "EC2", metricName: "CPUUtilization", namespace: "AWS/EC2", statistic: "Average", periodSeconds: 300 },
      { dimension: "memory", service: "EC2", metricName: "MemoryUtilization", namespace: "CWAgent", statistic: "Average", periodSeconds: 300 },
      { dimension: "disk", service: "EC2", metricName: "DiskSpaceUtilization", namespace: "CWAgent", statistic: "Maximum", periodSeconds: 300 },
      { dimension: "network_bandwidth", service: "EC2", metricName: "NetworkIn", namespace: "AWS/EC2", statistic: "Average", periodSeconds: 300 },
      { dimension: "iops", service: "EBS", metricName: "VolumeReadOps", namespace: "AWS/EBS", statistic: "Sum", periodSeconds: 300 },
      { dimension: "connections", service: "RDS", metricName: "DatabaseConnections", namespace: "AWS/RDS", statistic: "Maximum", periodSeconds: 60 },
      { dimension: "request_rate", service: "ALB", metricName: "RequestCount", namespace: "AWS/ApplicationELB", statistic: "Sum", periodSeconds: 60 },
      { dimension: "queue_depth", service: "SQS", metricName: "ApproximateNumberOfMessagesVisible", namespace: "AWS/SQS", statistic: "Maximum", periodSeconds: 60 },
    ],
    scalingLatencyMs: {
      "ec2_launch": 120_000,
      "asg_scale_out": 180_000,
      "ecs_task_launch": 60_000,
      "rds_resize": 1_800_000,
      "lambda_concurrency": 5_000,
      "ebs_modification": 600_000,
    },
    maxScaleOperationsPerHour: 20,
  },
  {
    provider: "azure",
    supportedDimensions: ["cpu", "memory", "disk", "network_bandwidth", "connections", "request_rate", "storage_capacity"],
    metricSources: [
      { dimension: "cpu", service: "VirtualMachines", metricName: "Percentage CPU", namespace: "Microsoft.Compute/virtualMachines", statistic: "Average", periodSeconds: 300 },
      { dimension: "memory", service: "VirtualMachines", metricName: "Available Memory Bytes", namespace: "Microsoft.Compute/virtualMachines", statistic: "Average", periodSeconds: 300 },
      { dimension: "disk", service: "VirtualMachines", metricName: "Data Disk Used Burst IO Credits Percentage", namespace: "Microsoft.Compute/virtualMachines", statistic: "Maximum", periodSeconds: 300 },
      { dimension: "connections", service: "SQL Database", metricName: "connection_successful", namespace: "Microsoft.Sql/servers/databases", statistic: "Maximum", periodSeconds: 60 },
    ],
    scalingLatencyMs: {
      "vmss_scale_out": 180_000,
      "app_service_scale": 120_000,
      "sql_resize": 1_800_000,
    },
    maxScaleOperationsPerHour: 15,
  },
  {
    provider: "gcp",
    supportedDimensions: ["cpu", "memory", "disk", "network_bandwidth", "connections", "request_rate", "storage_capacity"],
    metricSources: [
      { dimension: "cpu", service: "Compute Engine", metricName: "instance/cpu/utilization", namespace: "compute.googleapis.com", statistic: "Average", periodSeconds: 300 },
      { dimension: "memory", service: "Compute Engine", metricName: "instance/memory/utilization", namespace: "compute.googleapis.com", statistic: "Average", periodSeconds: 300 },
      { dimension: "disk", service: "Compute Engine", metricName: "instance/disk/utilization", namespace: "compute.googleapis.com", statistic: "Maximum", periodSeconds: 300 },
      { dimension: "connections", service: "Cloud SQL", metricName: "database/network/connections", namespace: "cloudsql.googleapis.com", statistic: "Maximum", periodSeconds: 60 },
    ],
    scalingLatencyMs: {
      "mig_scale_out": 180_000,
      "cloud_run_scale": 10_000,
      "cloud_sql_resize": 1_800_000,
    },
    maxScaleOperationsPerHour: 15,
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// §7 — Capacity Alerts & SLAs
// ═══════════════════════════════════════════════════════════════════════════════

export interface CapacityAlert {
  id: string;
  resourceArn: string;
  dimension: ResourceDimension;
  status: CapacityStatus;
  currentUtilization: number;
  threshold: number;
  triggeredAt: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
  forecastedBreachTime?: string;
  autoScalingTriggered: boolean;
  escalated: boolean;
}

export interface CapacitySLA {
  id: string;
  name: string;
  description: string;
  targetAvailability: number;
  maxResponseTimeMs: number;
  headroomPercent: number;
  autoScaleEnabled: boolean;
  notifyOnWarning: boolean;
  notifyOnCritical: boolean;
  escalateOnCritical: boolean;
}

export const DEFAULT_CAPACITY_SLAS: CapacitySLA[] = [
  { id: "sla-production", name: "Production", description: "Production workloads requiring high availability", targetAvailability: 99.9, maxResponseTimeMs: 200, headroomPercent: 30, autoScaleEnabled: true, notifyOnWarning: true, notifyOnCritical: true, escalateOnCritical: true },
  { id: "sla-staging", name: "Staging", description: "Staging environment for pre-production testing", targetAvailability: 99.0, maxResponseTimeMs: 500, headroomPercent: 20, autoScaleEnabled: true, notifyOnWarning: false, notifyOnCritical: true, escalateOnCritical: false },
  { id: "sla-development", name: "Development", description: "Development workloads with relaxed requirements", targetAvailability: 95.0, maxResponseTimeMs: 2000, headroomPercent: 10, autoScaleEnabled: false, notifyOnWarning: false, notifyOnCritical: true, escalateOnCritical: false },
];

// ═══════════════════════════════════════════════════════════════════════════════
// §8 — Integration Contracts
// ═══════════════════════════════════════════════════════════════════════════════

export type CapacityIntegrationTarget =
  | "cloud_event_stream"
  | "signal_detection"
  | "cost_intelligence"
  | "execution_safety"
  | "terraform_generation"
  | "notification_engine"
  | "cognitive_loop"
  | "incident_response"
  | "audit_trail"
  | "dashboard_api";

export interface CapacityIntegrationContract {
  target: CapacityIntegrationTarget;
  direction: "inbound" | "outbound" | "bidirectional";
  protocol: "function_call" | "event_bus" | "webhook";
  dataShape: string;
  slaMs: number;
  description: string;
}

export const CAPACITY_INTEGRATION_CONTRACTS: CapacityIntegrationContract[] = [
  { target: "cloud_event_stream", direction: "inbound", protocol: "event_bus", dataShape: "CloudEvent(performance) → CapacityMetricInput", slaMs: 100, description: "Receives performance and availability events for real-time capacity assessment" },
  { target: "signal_detection", direction: "outbound", protocol: "function_call", dataShape: "CapacityAlert → Signal", slaMs: 200, description: "Capacity alerts are emitted as signals for the cognitive loop" },
  { target: "cost_intelligence", direction: "bidirectional", protocol: "function_call", dataShape: "ScalingAction ↔ CostImpact", slaMs: 500, description: "Scaling actions are cost-checked; right-sizing feeds cost optimization" },
  { target: "execution_safety", direction: "outbound", protocol: "function_call", dataShape: "ScalingAction → SafetyValidation", slaMs: 2_000, description: "Scaling actions are validated by execution safety before apply" },
  { target: "terraform_generation", direction: "outbound", protocol: "function_call", dataShape: "ScalingAction → TerraformPlan", slaMs: 5_000, description: "Approved scaling actions generate terraform plans for execution" },
  { target: "notification_engine", direction: "outbound", protocol: "event_bus", dataShape: "CapacityAlert → NotificationTrigger", slaMs: 200, description: "Critical capacity alerts trigger notifications" },
  { target: "cognitive_loop", direction: "outbound", protocol: "function_call", dataShape: "CapacityPosture → CognitiveContext", slaMs: 1_000, description: "Capacity status informs the cognitive loop's infrastructure assessment" },
  { target: "incident_response", direction: "outbound", protocol: "event_bus", dataShape: "CriticalCapacityBreach → IncidentTrigger", slaMs: 50, description: "Critical capacity breaches auto-create incidents" },
  { target: "audit_trail", direction: "outbound", protocol: "function_call", dataShape: "ScalingEvent → AuditEntry", slaMs: 100, description: "All capacity events and scaling actions are audited" },
  { target: "dashboard_api", direction: "outbound", protocol: "event_bus", dataShape: "CapacityMetrics → DashboardData", slaMs: 5_000, description: "Capacity metrics, forecasts, and alerts pushed to dashboard" },
];

// ═══════════════════════════════════════════════════════════════════════════════
// §9 — Query Functions
// ═══════════════════════════════════════════════════════════════════════════════

export function getCapacityThreshold(dimension: ResourceDimension): CapacityThresholds | undefined {
  return DEFAULT_CAPACITY_THRESHOLDS.find(t => t.dimension === dimension);
}

export function getForecastConfig(model: ForecastModel): ForecastConfig | undefined {
  return FORECAST_CONFIGS.find(c => c.model === model);
}

export function getScalingRule(id: string): ScalingRule | undefined {
  return SCALING_RULES.find(r => r.id === id);
}

export function getScalingRulesByProvider(provider: "aws" | "azure" | "gcp" | "all"): ScalingRule[] {
  return SCALING_RULES.filter(r => r.provider === provider || r.provider === "all");
}

export function getScalingRulesByTrigger(trigger: ScalingTrigger): ScalingRule[] {
  return SCALING_RULES.filter(r => r.trigger === trigger);
}

export function getAutomatableScalingRules(): ScalingRule[] {
  return SCALING_RULES.filter(r => r.automatable && !r.requiresApproval);
}

export function getApprovalRequiredScalingRules(): ScalingRule[] {
  return SCALING_RULES.filter(r => r.requiresApproval);
}

export function getProviderCapacityProfile(provider: "aws" | "azure" | "gcp"): ProviderCapacityProfile | undefined {
  return PROVIDER_CAPACITY_PROFILES.find(p => p.provider === provider);
}

export function getCapacitySLA(id: string): CapacitySLA | undefined {
  return DEFAULT_CAPACITY_SLAS.find(s => s.id === id);
}

export function getCapacityPipelineStage(id: CapacityPipelineStageId): CapacityPipelineStage | undefined {
  return CAPACITY_PIPELINE.find(s => s.id === id);
}

export function getCapacityPipelineOrder(): CapacityPipelineStageId[] {
  return [...CAPACITY_PIPELINE].sort((a, b) => a.order - b.order).map(s => s.id);
}

export function getCapacityIntegration(target: CapacityIntegrationTarget): CapacityIntegrationContract | undefined {
  return CAPACITY_INTEGRATION_CONTRACTS.find(c => c.target === target);
}

export function evaluateCapacityStatus(utilizationPercent: number, thresholds: CapacityThresholds): CapacityStatus {
  if (utilizationPercent >= thresholds.criticalPercent) return "critical";
  if (utilizationPercent >= thresholds.warningPercent) return "warning";
  if (utilizationPercent <= thresholds.overProvisionedBelowPercent) return "over_provisioned";
  return "healthy";
}

export function estimateScalingLatency(provider: "aws" | "azure" | "gcp", operationType: string): number {
  const profile = getProviderCapacityProfile(provider);
  if (!profile) return 300_000;
  return profile.scalingLatencyMs[operationType] ?? 300_000;
}

// ═══════════════════════════════════════════════════════════════════════════════
// §10 — Tests
// ═══════════════════════════════════════════════════════════════════════════════

export interface CapacityPlanningTestResult {
  name: string;
  passed: boolean;
  detail: string;
}

export function runCapacityPlanningTests(): CapacityPlanningTestResult[] {
  const results: CapacityPlanningTestResult[] = [];
  const assert = (name: string, condition: boolean, detail: string) =>
    results.push({ name, passed: condition, detail });

  // §1 — Thresholds
  assert("All 10 dimensions have thresholds", DEFAULT_CAPACITY_THRESHOLDS.length === 10, `Found ${DEFAULT_CAPACITY_THRESHOLDS.length}`);
  assert("CPU threshold exists", getCapacityThreshold("cpu") !== undefined, "CPU defined");
  assert("CPU warning at 75%", getCapacityThreshold("cpu")?.warningPercent === 75, "CPU warning");
  assert("CPU critical at 90%", getCapacityThreshold("cpu")?.criticalPercent === 90, "CPU critical");

  // §2 — Forecast Configs
  assert("Forecast configs exist", FORECAST_CONFIGS.length >= 5, `Found ${FORECAST_CONFIGS.length}`);
  assert("Ensemble model exists", getForecastConfig("ensemble") !== undefined, "Ensemble defined");
  assert("Ensemble has high confidence threshold", (getForecastConfig("ensemble")?.confidenceThreshold ?? 0) >= 0.8, "80% confidence");

  // §3 — Scaling Rules
  assert("Scaling rules exist", SCALING_RULES.length >= 12, `Found ${SCALING_RULES.length}`);
  assert("AWS scaling rules", getScalingRulesByProvider("aws").length >= 8, "AWS rules");
  assert("Azure scaling rules", getScalingRulesByProvider("azure").length >= 1, "Azure rules");
  assert("GCP scaling rules", getScalingRulesByProvider("gcp").length >= 1, "GCP rules");
  assert("Automatable rules", getAutomatableScalingRules().length >= 6, "Auto-scalable");
  assert("Approval-required rules", getApprovalRequiredScalingRules().length >= 3, "Need approval");
  assert("Predictive rule exists", getScalingRulesByTrigger("forecast_breach").length >= 2, "Predictive scaling");

  // §4 — Right-Sizing Policy
  assert("Default policy 14 day minimum", DEFAULT_RIGHTSIZING_POLICY.minAnalysisDays === 14, "14 day min");
  assert("70% utilization target", DEFAULT_RIGHTSIZING_POLICY.maxUtilizationTarget === 70, "70% target");
  assert("30% peak headroom", DEFAULT_RIGHTSIZING_POLICY.peakHeadroomPercent === 30, "30% headroom");

  // §5 — Pipeline
  assert("Pipeline has 10 stages", CAPACITY_PIPELINE.length === 10, `Found ${CAPACITY_PIPELINE.length}`);
  assert("Starts with collect", getCapacityPipelineOrder()[0] === "collect_metrics", "Collect first");
  assert("Ends with dashboard", getCapacityPipelineOrder()[9] === "update_dashboard", "Dashboard last");

  // §6 — Provider Profiles
  assert("All 3 providers defined", PROVIDER_CAPACITY_PROFILES.length === 3, "AWS, Azure, GCP");
  assert("AWS has 10 dimensions", getProviderCapacityProfile("aws")?.supportedDimensions.length === 10, "Full AWS coverage");
  assert("AWS has metric sources", (getProviderCapacityProfile("aws")?.metricSources.length ?? 0) >= 8, "AWS metrics");
  assert("AWS scaling latencies", Object.keys(getProviderCapacityProfile("aws")?.scalingLatencyMs ?? {}).length >= 6, "AWS latencies");

  // §7 — SLAs
  assert("3 SLA tiers defined", DEFAULT_CAPACITY_SLAS.length === 3, "Prod, staging, dev");
  assert("Production 99.9% target", getCapacitySLA("sla-production")?.targetAvailability === 99.9, "99.9% SLA");

  // §8 — Integration Contracts
  assert("10 integration contracts", CAPACITY_INTEGRATION_CONTRACTS.length === 10, `Found ${CAPACITY_INTEGRATION_CONTRACTS.length}`);

  // §9 — Status Evaluation
  const cpuThreshold = getCapacityThreshold("cpu")!;
  assert("95% CPU = critical", evaluateCapacityStatus(95, cpuThreshold) === "critical", "Critical status");
  assert("80% CPU = warning", evaluateCapacityStatus(80, cpuThreshold) === "warning", "Warning status");
  assert("50% CPU = healthy", evaluateCapacityStatus(50, cpuThreshold) === "healthy", "Healthy status");
  assert("10% CPU = over_provisioned", evaluateCapacityStatus(10, cpuThreshold) === "over_provisioned", "Over-provisioned");

  // §10 — Scaling Latency
  assert("EC2 launch ~120s", estimateScalingLatency("aws", "ec2_launch") === 120_000, "EC2 latency");
  assert("Unknown op defaults to 300s", estimateScalingLatency("aws", "unknown_operation") === 300_000, "Default latency");

  return results;
}
