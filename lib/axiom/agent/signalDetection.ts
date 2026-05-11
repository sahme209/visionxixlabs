// ─────────────────────────────────────────────────────────────────────────────
// Signal Detection & Processing Pipeline
// Unified operational signal intake that feeds the cognitive reasoning loop
// ─────────────────────────────────────────────────────────────────────────────

// ═══════════════════════════════════════════════════════════════════════════════
// §1 — Signal Architecture
// ═══════════════════════════════════════════════════════════════════════════════

export type SignalDomain =
  | "cost"
  | "security"
  | "performance"
  | "reliability"
  | "compliance"
  | "capacity"
  | "drift"
  | "lifecycle"
  | "network"
  | "iam"
  | "data"
  | "operational";

export type SignalSeverity = "info" | "low" | "medium" | "high" | "critical";

export type SignalConfidence = "speculative" | "low" | "moderate" | "high" | "confirmed";

export type SignalSource =
  | "cloud_api_scan"
  | "cloudwatch_alarm"
  | "azure_monitor"
  | "gcp_monitoring"
  | "cost_explorer"
  | "security_hub"
  | "config_rules"
  | "drift_detection"
  | "log_analysis"
  | "metric_anomaly"
  | "external_webhook"
  | "scheduled_scan"
  | "user_report"
  | "predictive_model";

export interface OperationalSignal {
  id: string;
  orgId: string;
  domain: SignalDomain;
  severity: SignalSeverity;
  confidence: SignalConfidence;
  source: SignalSource;
  provider: "aws" | "azure" | "gcp" | "multi";
  region: string;
  detectedAt: string;
  expiresAt: string | null;
  resourceIds: string[];
  resourceTypes: string[];
  title: string;
  description: string;
  evidence: SignalEvidence[];
  correlationId: string | null;
  parentSignalId: string | null;
  childSignalIds: string[];
  tags: Record<string, string>;
  metadata: Record<string, unknown>;
  state: SignalState;
  processingHistory: SignalProcessingEvent[];
}

export type SignalState =
  | "detected"
  | "enriching"
  | "enriched"
  | "correlating"
  | "correlated"
  | "triaging"
  | "triaged"
  | "routing"
  | "routed"
  | "acknowledged"
  | "investigating"
  | "resolved"
  | "dismissed"
  | "expired";

export interface SignalEvidence {
  type: "metric" | "log" | "config" | "state_change" | "api_response" | "comparison" | "threshold_breach" | "pattern_match";
  source: string;
  value: unknown;
  baseline: unknown | null;
  threshold: unknown | null;
  timestamp: string;
  description: string;
}

export interface SignalProcessingEvent {
  stage: SignalPipelineStageId;
  status: "started" | "completed" | "failed" | "skipped";
  timestamp: string;
  durationMs: number;
  output: Record<string, unknown>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// §2 — Signal Detection Rules
// ═══════════════════════════════════════════════════════════════════════════════

export type DetectionRuleType =
  | "threshold"
  | "anomaly"
  | "pattern"
  | "state_change"
  | "absence"
  | "correlation"
  | "trend"
  | "comparison";

export interface DetectionRule {
  id: string;
  name: string;
  description: string;
  domain: SignalDomain;
  ruleType: DetectionRuleType;
  provider: "aws" | "azure" | "gcp" | "any";
  applicableResourceTypes: string[];
  condition: DetectionCondition;
  severity: SignalSeverity;
  confidence: SignalConfidence;
  cooldownMs: number;
  enabled: boolean;
  evaluationIntervalMs: number;
}

export type DetectionCondition =
  | { type: "threshold"; metric: string; operator: "gt" | "gte" | "lt" | "lte" | "eq"; value: number; durationMs: number }
  | { type: "anomaly"; metric: string; deviations: number; baselineWindowMs: number; direction: "above" | "below" | "both" }
  | { type: "pattern"; logGroup: string; pattern: string; countThreshold: number; windowMs: number }
  | { type: "state_change"; fromState: string; toState: string; resourceType: string }
  | { type: "absence"; metric: string; expectedIntervalMs: number; toleranceMs: number }
  | { type: "correlation"; signals: string[]; windowMs: number; minSignals: number }
  | { type: "trend"; metric: string; direction: "increasing" | "decreasing"; windowMs: number; changePercent: number }
  | { type: "comparison"; metric: string; compareWith: "baseline" | "peer" | "historical"; threshold: number };

export const DETECTION_RULES: DetectionRule[] = [
  // Cost signals
  {
    id: "cost-spike-daily",
    name: "Daily Cost Spike",
    description: "Detects when daily spend exceeds 150% of 7-day rolling average",
    domain: "cost",
    ruleType: "anomaly",
    provider: "any",
    applicableResourceTypes: [],
    condition: { type: "anomaly", metric: "daily_cost", deviations: 2, baselineWindowMs: 604_800_000, direction: "above" },
    severity: "medium",
    confidence: "moderate",
    cooldownMs: 86_400_000,
    enabled: true,
    evaluationIntervalMs: 3_600_000,
  },
  {
    id: "cost-budget-breach",
    name: "Budget Threshold Breach",
    description: "Monthly spend projected to exceed budget threshold",
    domain: "cost",
    ruleType: "trend",
    provider: "any",
    applicableResourceTypes: [],
    condition: { type: "trend", metric: "monthly_spend_projection", direction: "increasing", windowMs: 2_592_000_000, changePercent: 80 },
    severity: "high",
    confidence: "moderate",
    cooldownMs: 86_400_000,
    enabled: true,
    evaluationIntervalMs: 21_600_000,
  },
  {
    id: "idle-resource-detected",
    name: "Idle Resource Detected",
    description: "Resource with near-zero utilization for 7+ days",
    domain: "cost",
    ruleType: "threshold",
    provider: "any",
    applicableResourceTypes: ["aws_instance", "azurerm_virtual_machine", "google_compute_instance", "aws_db_instance", "aws_elasticache_cluster"],
    condition: { type: "threshold", metric: "cpu_utilization_avg", operator: "lt", value: 5, durationMs: 604_800_000 },
    severity: "low",
    confidence: "high",
    cooldownMs: 604_800_000,
    enabled: true,
    evaluationIntervalMs: 86_400_000,
  },
  // Security signals
  {
    id: "unauthorized-api-call",
    name: "Unauthorized API Call Burst",
    description: "Spike in unauthorized/denied API calls indicating potential breach attempt",
    domain: "security",
    ruleType: "threshold",
    provider: "aws",
    applicableResourceTypes: [],
    condition: { type: "threshold", metric: "unauthorized_api_calls", operator: "gt", value: 50, durationMs: 300_000 },
    severity: "critical",
    confidence: "high",
    cooldownMs: 300_000,
    enabled: true,
    evaluationIntervalMs: 60_000,
  },
  {
    id: "root-account-usage",
    name: "Root Account Usage",
    description: "AWS root account used for API calls",
    domain: "security",
    ruleType: "state_change",
    provider: "aws",
    applicableResourceTypes: [],
    condition: { type: "state_change", fromState: "inactive", toState: "active", resourceType: "aws_root_account" },
    severity: "critical",
    confidence: "confirmed",
    cooldownMs: 0,
    enabled: true,
    evaluationIntervalMs: 60_000,
  },
  {
    id: "public-resource-exposure",
    name: "Public Resource Exposure",
    description: "Resource made publicly accessible",
    domain: "security",
    ruleType: "state_change",
    provider: "any",
    applicableResourceTypes: ["aws_s3_bucket", "aws_db_instance", "aws_security_group", "azurerm_storage_account", "google_storage_bucket"],
    condition: { type: "state_change", fromState: "private", toState: "public", resourceType: "*" },
    severity: "critical",
    confidence: "confirmed",
    cooldownMs: 0,
    enabled: true,
    evaluationIntervalMs: 300_000,
  },
  {
    id: "iam-policy-escalation",
    name: "IAM Privilege Escalation",
    description: "IAM policy changed to grant broader permissions",
    domain: "iam",
    ruleType: "state_change",
    provider: "any",
    applicableResourceTypes: ["aws_iam_policy", "aws_iam_role", "azurerm_role_definition", "google_project_iam_custom_role"],
    condition: { type: "state_change", fromState: "scoped", toState: "escalated", resourceType: "*" },
    severity: "high",
    confidence: "high",
    cooldownMs: 300_000,
    enabled: true,
    evaluationIntervalMs: 300_000,
  },
  // Performance signals
  {
    id: "high-cpu-sustained",
    name: "Sustained High CPU",
    description: "CPU utilization above 90% for 30+ minutes",
    domain: "performance",
    ruleType: "threshold",
    provider: "any",
    applicableResourceTypes: ["aws_instance", "aws_ecs_service", "aws_lambda_function", "azurerm_virtual_machine", "google_compute_instance"],
    condition: { type: "threshold", metric: "cpu_utilization", operator: "gt", value: 90, durationMs: 1_800_000 },
    severity: "high",
    confidence: "high",
    cooldownMs: 3_600_000,
    enabled: true,
    evaluationIntervalMs: 300_000,
  },
  {
    id: "memory-pressure",
    name: "Memory Pressure",
    description: "Memory utilization above 85% with swap activity",
    domain: "performance",
    ruleType: "threshold",
    provider: "any",
    applicableResourceTypes: ["aws_instance", "aws_ecs_service", "azurerm_virtual_machine", "google_compute_instance"],
    condition: { type: "threshold", metric: "memory_utilization", operator: "gt", value: 85, durationMs: 900_000 },
    severity: "medium",
    confidence: "moderate",
    cooldownMs: 3_600_000,
    enabled: true,
    evaluationIntervalMs: 300_000,
  },
  {
    id: "latency-degradation",
    name: "Latency Degradation",
    description: "P99 latency increased 50%+ compared to baseline",
    domain: "performance",
    ruleType: "comparison",
    provider: "any",
    applicableResourceTypes: ["aws_lb", "aws_ecs_service", "aws_lambda_function", "azurerm_lb", "google_compute_forwarding_rule"],
    condition: { type: "comparison", metric: "p99_latency", compareWith: "baseline", threshold: 50 },
    severity: "high",
    confidence: "moderate",
    cooldownMs: 1_800_000,
    enabled: true,
    evaluationIntervalMs: 300_000,
  },
  // Reliability signals
  {
    id: "error-rate-spike",
    name: "Error Rate Spike",
    description: "5xx error rate exceeds 5% of total requests",
    domain: "reliability",
    ruleType: "threshold",
    provider: "any",
    applicableResourceTypes: ["aws_lb", "aws_ecs_service", "aws_lambda_function", "azurerm_lb"],
    condition: { type: "threshold", metric: "error_rate_5xx", operator: "gt", value: 5, durationMs: 300_000 },
    severity: "critical",
    confidence: "high",
    cooldownMs: 600_000,
    enabled: true,
    evaluationIntervalMs: 60_000,
  },
  {
    id: "health-check-failure",
    name: "Health Check Failures",
    description: "Service health checks failing consecutively",
    domain: "reliability",
    ruleType: "threshold",
    provider: "any",
    applicableResourceTypes: ["aws_lb_target_group", "aws_ecs_service", "azurerm_lb_probe"],
    condition: { type: "threshold", metric: "consecutive_health_check_failures", operator: "gte", value: 3, durationMs: 0 },
    severity: "critical",
    confidence: "confirmed",
    cooldownMs: 300_000,
    enabled: true,
    evaluationIntervalMs: 60_000,
  },
  // Compliance signals
  {
    id: "encryption-missing",
    name: "Encryption Not Enabled",
    description: "Storage or database resource without encryption at rest",
    domain: "compliance",
    ruleType: "state_change",
    provider: "any",
    applicableResourceTypes: ["aws_s3_bucket", "aws_ebs_volume", "aws_db_instance", "aws_rds_cluster", "azurerm_storage_account", "google_storage_bucket"],
    condition: { type: "state_change", fromState: "encrypted", toState: "unencrypted", resourceType: "*" },
    severity: "high",
    confidence: "confirmed",
    cooldownMs: 0,
    enabled: true,
    evaluationIntervalMs: 3_600_000,
  },
  {
    id: "logging-disabled",
    name: "Audit Logging Disabled",
    description: "Audit or access logging turned off on critical resource",
    domain: "compliance",
    ruleType: "state_change",
    provider: "any",
    applicableResourceTypes: ["aws_s3_bucket", "aws_cloudtrail", "aws_rds_cluster", "azurerm_storage_account"],
    condition: { type: "state_change", fromState: "enabled", toState: "disabled", resourceType: "*" },
    severity: "high",
    confidence: "confirmed",
    cooldownMs: 0,
    enabled: true,
    evaluationIntervalMs: 3_600_000,
  },
  // Capacity signals
  {
    id: "disk-space-low",
    name: "Low Disk Space",
    description: "Disk utilization above 85%",
    domain: "capacity",
    ruleType: "threshold",
    provider: "any",
    applicableResourceTypes: ["aws_instance", "aws_db_instance", "azurerm_virtual_machine", "google_compute_instance"],
    condition: { type: "threshold", metric: "disk_utilization", operator: "gt", value: 85, durationMs: 3_600_000 },
    severity: "medium",
    confidence: "high",
    cooldownMs: 86_400_000,
    enabled: true,
    evaluationIntervalMs: 3_600_000,
  },
  {
    id: "connection-pool-exhaustion",
    name: "Connection Pool Exhaustion",
    description: "Database connections above 80% of max",
    domain: "capacity",
    ruleType: "threshold",
    provider: "any",
    applicableResourceTypes: ["aws_db_instance", "aws_rds_cluster", "azurerm_mssql_database", "google_sql_database_instance"],
    condition: { type: "threshold", metric: "connection_utilization", operator: "gt", value: 80, durationMs: 600_000 },
    severity: "high",
    confidence: "high",
    cooldownMs: 1_800_000,
    enabled: true,
    evaluationIntervalMs: 300_000,
  },
  // Drift signals
  {
    id: "config-drift-detected",
    name: "Configuration Drift Detected",
    description: "Resource configuration differs from declared state",
    domain: "drift",
    ruleType: "comparison",
    provider: "any",
    applicableResourceTypes: [],
    condition: { type: "comparison", metric: "config_similarity", compareWith: "baseline", threshold: 95 },
    severity: "medium",
    confidence: "high",
    cooldownMs: 86_400_000,
    enabled: true,
    evaluationIntervalMs: 21_600_000,
  },
  {
    id: "manual-change-detected",
    name: "Manual Change Detected",
    description: "Resource modified outside of IaC pipeline",
    domain: "drift",
    ruleType: "state_change",
    provider: "any",
    applicableResourceTypes: [],
    condition: { type: "state_change", fromState: "managed", toState: "drifted", resourceType: "*" },
    severity: "medium",
    confidence: "moderate",
    cooldownMs: 3_600_000,
    enabled: true,
    evaluationIntervalMs: 3_600_000,
  },
  // Network signals
  {
    id: "network-throughput-anomaly",
    name: "Network Throughput Anomaly",
    description: "Unusual network traffic pattern detected",
    domain: "network",
    ruleType: "anomaly",
    provider: "any",
    applicableResourceTypes: ["aws_instance", "aws_lb", "azurerm_virtual_machine", "azurerm_lb", "google_compute_instance"],
    condition: { type: "anomaly", metric: "network_bytes_out", deviations: 3, baselineWindowMs: 604_800_000, direction: "above" },
    severity: "medium",
    confidence: "moderate",
    cooldownMs: 3_600_000,
    enabled: true,
    evaluationIntervalMs: 300_000,
  },
  // Lifecycle signals
  {
    id: "certificate-expiring",
    name: "Certificate Expiring Soon",
    description: "TLS certificate expiring within 30 days",
    domain: "lifecycle",
    ruleType: "threshold",
    provider: "any",
    applicableResourceTypes: ["aws_acm_certificate", "azurerm_app_service_certificate"],
    condition: { type: "threshold", metric: "days_until_expiry", operator: "lt", value: 30, durationMs: 0 },
    severity: "medium",
    confidence: "confirmed",
    cooldownMs: 604_800_000,
    enabled: true,
    evaluationIntervalMs: 86_400_000,
  },
  {
    id: "deprecated-resource",
    name: "Deprecated Resource Version",
    description: "Resource running deprecated engine/runtime version",
    domain: "lifecycle",
    ruleType: "comparison",
    provider: "any",
    applicableResourceTypes: ["aws_db_instance", "aws_lambda_function", "aws_eks_cluster", "aws_ecs_service"],
    condition: { type: "comparison", metric: "version_currency", compareWith: "baseline", threshold: 0 },
    severity: "low",
    confidence: "confirmed",
    cooldownMs: 604_800_000,
    enabled: true,
    evaluationIntervalMs: 86_400_000,
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// §3 — Signal Enrichment
// ═══════════════════════════════════════════════════════════════════════════════

export type EnrichmentType =
  | "resource_context"
  | "ownership"
  | "dependency_graph"
  | "historical_pattern"
  | "cost_attribution"
  | "compliance_mapping"
  | "risk_scoring"
  | "blast_radius_preview";

export interface EnrichmentResult {
  type: EnrichmentType;
  source: string;
  data: Record<string, unknown>;
  addedAt: string;
  durationMs: number;
}

export interface EnrichmentPipeline {
  stages: EnrichmentStage[];
  maxTotalDurationMs: number;
  parallelizable: EnrichmentType[][];
}

export interface EnrichmentStage {
  type: EnrichmentType;
  order: number;
  required: boolean;
  timeoutMs: number;
  retryable: boolean;
  applicableDomains: SignalDomain[];
}

export const ENRICHMENT_PIPELINE: EnrichmentPipeline = {
  stages: [
    { type: "resource_context", order: 1, required: true, timeoutMs: 10_000, retryable: true, applicableDomains: ["cost", "security", "performance", "reliability", "compliance", "capacity", "drift", "lifecycle", "network", "iam", "data", "operational"] },
    { type: "ownership", order: 2, required: false, timeoutMs: 5_000, retryable: true, applicableDomains: ["cost", "security", "performance", "reliability", "compliance", "capacity", "drift", "lifecycle", "network", "iam", "data", "operational"] },
    { type: "dependency_graph", order: 3, required: true, timeoutMs: 15_000, retryable: true, applicableDomains: ["security", "performance", "reliability", "capacity", "drift", "network"] },
    { type: "historical_pattern", order: 4, required: false, timeoutMs: 10_000, retryable: false, applicableDomains: ["cost", "performance", "reliability", "capacity"] },
    { type: "cost_attribution", order: 5, required: false, timeoutMs: 10_000, retryable: true, applicableDomains: ["cost"] },
    { type: "compliance_mapping", order: 6, required: false, timeoutMs: 5_000, retryable: false, applicableDomains: ["security", "compliance", "iam"] },
    { type: "risk_scoring", order: 7, required: true, timeoutMs: 10_000, retryable: false, applicableDomains: ["cost", "security", "performance", "reliability", "compliance", "capacity", "drift", "lifecycle", "network", "iam", "data", "operational"] },
    { type: "blast_radius_preview", order: 8, required: false, timeoutMs: 20_000, retryable: true, applicableDomains: ["security", "reliability", "drift", "network"] },
  ],
  maxTotalDurationMs: 60_000,
  parallelizable: [
    ["resource_context"],
    ["ownership", "dependency_graph"],
    ["historical_pattern", "cost_attribution", "compliance_mapping"],
    ["risk_scoring"],
    ["blast_radius_preview"],
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// §4 — Signal Correlation
// ═══════════════════════════════════════════════════════════════════════════════

export type CorrelationStrategy =
  | "temporal_proximity"
  | "shared_resource"
  | "causal_chain"
  | "same_domain"
  | "blast_radius_overlap"
  | "root_cause";

export interface CorrelationRule {
  id: string;
  name: string;
  description: string;
  strategy: CorrelationStrategy;
  windowMs: number;
  minSignals: number;
  maxSignals: number;
  domainFilter: SignalDomain[] | null;
  severityEscalation: boolean;
  mergeIntoParent: boolean;
}

export interface CorrelationGroup {
  id: string;
  parentSignalId: string;
  childSignalIds: string[];
  correlationRule: string;
  confidence: SignalConfidence;
  rootCauseHypothesis: string | null;
  aggregateSeverity: SignalSeverity;
  affectedResources: string[];
  createdAt: string;
}

export const CORRELATION_RULES: CorrelationRule[] = [
  { id: "temporal-burst", name: "Temporal Burst", description: "Multiple signals within 5 minutes from same resource", strategy: "temporal_proximity", windowMs: 300_000, minSignals: 3, maxSignals: 20, domainFilter: null, severityEscalation: true, mergeIntoParent: true },
  { id: "cascade-failure", name: "Cascade Failure", description: "Failure signals propagating through dependency chain", strategy: "causal_chain", windowMs: 600_000, minSignals: 2, maxSignals: 50, domainFilter: ["reliability", "performance"], severityEscalation: true, mergeIntoParent: false },
  { id: "shared-resource-cluster", name: "Shared Resource Cluster", description: "Signals from different domains affecting same resource", strategy: "shared_resource", windowMs: 900_000, minSignals: 2, maxSignals: 10, domainFilter: null, severityEscalation: false, mergeIntoParent: true },
  { id: "security-incident-chain", name: "Security Incident Chain", description: "Correlated security signals suggesting coordinated attack", strategy: "causal_chain", windowMs: 1_800_000, minSignals: 3, maxSignals: 100, domainFilter: ["security", "iam", "network"], severityEscalation: true, mergeIntoParent: false },
  { id: "cost-attribution-cluster", name: "Cost Attribution Cluster", description: "Cost signals from resources in same service/team", strategy: "same_domain", windowMs: 86_400_000, minSignals: 2, maxSignals: 50, domainFilter: ["cost"], severityEscalation: false, mergeIntoParent: true },
  { id: "blast-radius-overlap", name: "Blast Radius Overlap", description: "Signals with overlapping blast radius zones", strategy: "blast_radius_overlap", windowMs: 300_000, minSignals: 2, maxSignals: 20, domainFilter: null, severityEscalation: true, mergeIntoParent: false },
  { id: "root-cause-inference", name: "Root Cause Inference", description: "Inferring root cause from symptom signals", strategy: "root_cause", windowMs: 600_000, minSignals: 2, maxSignals: 30, domainFilter: null, severityEscalation: false, mergeIntoParent: false },
];

// ═══════════════════════════════════════════════════════════════════════════════
// §5 — Signal Triage & Routing
// ═══════════════════════════════════════════════════════════════════════════════

export type TriageDisposition =
  | "investigate_immediately"
  | "investigate_soon"
  | "schedule_review"
  | "auto_remediate"
  | "monitor_only"
  | "suppress"
  | "escalate";

export interface TriagePolicy {
  id: string;
  name: string;
  description: string;
  conditions: TriageCondition[];
  disposition: TriageDisposition;
  priority: number;
  autoRemediationAllowed: boolean;
  maxAutoRemediationBlastRadius: "minimal" | "low" | "moderate";
  notificationChannels: string[];
  escalationPath: string[];
}

export interface TriageCondition {
  field: "domain" | "severity" | "confidence" | "source" | "provider" | "resource_type" | "environment";
  operator: "eq" | "neq" | "in" | "not_in" | "gte" | "lte";
  value: unknown;
}

export interface RoutingDecision {
  signalId: string;
  disposition: TriageDisposition;
  policyId: string;
  routedTo: RoutingTarget[];
  priority: number;
  explanation: string;
  timestamp: string;
}

export interface RoutingTarget {
  type: "cognitive_loop" | "auto_remediation" | "human_review" | "monitoring" | "suppression";
  targetId: string;
  priority: number;
}

export const TRIAGE_POLICIES: TriagePolicy[] = [
  {
    id: "critical-security-immediate",
    name: "Critical Security Immediate",
    description: "Critical security signals require immediate investigation",
    conditions: [
      { field: "domain", operator: "in", value: ["security", "iam"] },
      { field: "severity", operator: "eq", value: "critical" },
    ],
    disposition: "investigate_immediately",
    priority: 100,
    autoRemediationAllowed: false,
    maxAutoRemediationBlastRadius: "minimal",
    notificationChannels: ["security_team", "ops_team", "org_admin"],
    escalationPath: ["security_admin", "platform_admin"],
  },
  {
    id: "critical-reliability-immediate",
    name: "Critical Reliability Immediate",
    description: "Service-impacting reliability signals need immediate attention",
    conditions: [
      { field: "domain", operator: "eq", value: "reliability" },
      { field: "severity", operator: "eq", value: "critical" },
    ],
    disposition: "investigate_immediately",
    priority: 95,
    autoRemediationAllowed: true,
    maxAutoRemediationBlastRadius: "low",
    notificationChannels: ["ops_team", "service_owner"],
    escalationPath: ["org_admin", "platform_admin"],
  },
  {
    id: "high-performance-investigate",
    name: "High Performance Investigate",
    description: "High severity performance degradation needs investigation",
    conditions: [
      { field: "domain", operator: "eq", value: "performance" },
      { field: "severity", operator: "in", value: ["high", "critical"] },
    ],
    disposition: "investigate_soon",
    priority: 80,
    autoRemediationAllowed: true,
    maxAutoRemediationBlastRadius: "low",
    notificationChannels: ["ops_team"],
    escalationPath: ["service_owner"],
  },
  {
    id: "compliance-high-escalate",
    name: "High Compliance Escalate",
    description: "High severity compliance issues escalate for review",
    conditions: [
      { field: "domain", operator: "eq", value: "compliance" },
      { field: "severity", operator: "in", value: ["high", "critical"] },
    ],
    disposition: "escalate",
    priority: 85,
    autoRemediationAllowed: false,
    maxAutoRemediationBlastRadius: "minimal",
    notificationChannels: ["compliance_team", "security_team"],
    escalationPath: ["compliance_officer", "org_admin"],
  },
  {
    id: "cost-low-auto-remediate",
    name: "Low-Risk Cost Auto-Remediate",
    description: "Low-risk cost optimizations can be auto-remediated",
    conditions: [
      { field: "domain", operator: "eq", value: "cost" },
      { field: "severity", operator: "in", value: ["low", "info"] },
      { field: "confidence", operator: "in", value: ["high", "confirmed"] },
    ],
    disposition: "auto_remediate",
    priority: 30,
    autoRemediationAllowed: true,
    maxAutoRemediationBlastRadius: "minimal",
    notificationChannels: ["cost_team"],
    escalationPath: [],
  },
  {
    id: "drift-medium-schedule",
    name: "Medium Drift Schedule Review",
    description: "Configuration drift scheduled for next review cycle",
    conditions: [
      { field: "domain", operator: "eq", value: "drift" },
      { field: "severity", operator: "in", value: ["medium", "low"] },
    ],
    disposition: "schedule_review",
    priority: 40,
    autoRemediationAllowed: false,
    maxAutoRemediationBlastRadius: "minimal",
    notificationChannels: ["ops_team"],
    escalationPath: [],
  },
  {
    id: "lifecycle-info-monitor",
    name: "Lifecycle Info Monitor",
    description: "Lifecycle signals monitored for awareness",
    conditions: [
      { field: "domain", operator: "eq", value: "lifecycle" },
      { field: "severity", operator: "eq", value: "info" },
    ],
    disposition: "monitor_only",
    priority: 10,
    autoRemediationAllowed: false,
    maxAutoRemediationBlastRadius: "minimal",
    notificationChannels: [],
    escalationPath: [],
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// §6 — Signal Processing Pipeline
// ═══════════════════════════════════════════════════════════════════════════════

export type SignalPipelineStageId =
  | "intake"
  | "deduplication"
  | "enrichment"
  | "correlation"
  | "triage"
  | "routing"
  | "notification"
  | "audit";

export interface SignalPipelineStage {
  id: SignalPipelineStageId;
  name: string;
  description: string;
  order: number;
  required: boolean;
  timeoutMs: number;
  retryable: boolean;
  maxRetries: number;
  dependsOn: SignalPipelineStageId[];
}

export const SIGNAL_PIPELINE: SignalPipelineStage[] = [
  { id: "intake", name: "Signal Intake", description: "Receive and validate incoming signals", order: 1, required: true, timeoutMs: 5_000, retryable: false, maxRetries: 0, dependsOn: [] },
  { id: "deduplication", name: "Deduplication", description: "Identify and merge duplicate signals", order: 2, required: true, timeoutMs: 5_000, retryable: false, maxRetries: 0, dependsOn: ["intake"] },
  { id: "enrichment", name: "Signal Enrichment", description: "Add resource context, ownership, dependencies", order: 3, required: true, timeoutMs: 60_000, retryable: true, maxRetries: 2, dependsOn: ["deduplication"] },
  { id: "correlation", name: "Signal Correlation", description: "Correlate related signals into groups", order: 4, required: true, timeoutMs: 15_000, retryable: false, maxRetries: 0, dependsOn: ["enrichment"] },
  { id: "triage", name: "Triage", description: "Determine disposition and priority", order: 5, required: true, timeoutMs: 5_000, retryable: false, maxRetries: 0, dependsOn: ["correlation"] },
  { id: "routing", name: "Routing", description: "Route signal to appropriate handler", order: 6, required: true, timeoutMs: 5_000, retryable: true, maxRetries: 1, dependsOn: ["triage"] },
  { id: "notification", name: "Notification", description: "Send notifications per triage policy", order: 7, required: false, timeoutMs: 10_000, retryable: true, maxRetries: 3, dependsOn: ["routing"] },
  { id: "audit", name: "Audit Recording", description: "Record signal processing in audit trail", order: 8, required: true, timeoutMs: 5_000, retryable: true, maxRetries: 3, dependsOn: ["routing"] },
];

// ═══════════════════════════════════════════════════════════════════════════════
// §7 — Signal Suppression
// ═══════════════════════════════════════════════════════════════════════════════

export interface SuppressionRule {
  id: string;
  name: string;
  description: string;
  conditions: TriageCondition[];
  duration: SuppressionDuration;
  reason: string;
  createdBy: string;
  createdAt: string;
  expiresAt: string;
  active: boolean;
  suppressedCount: number;
}

export interface SuppressionDuration {
  type: "fixed" | "until_resolved" | "maintenance_window";
  durationMs: number | null;
  maintenanceWindowId: string | null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// §8 — Signal Metrics & Analytics
// ═══════════════════════════════════════════════════════════════════════════════

export interface SignalAnalytics {
  orgId: string;
  periodStart: string;
  periodEnd: string;
  totalSignals: number;
  signalsByDomain: Record<SignalDomain, number>;
  signalsBySeverity: Record<SignalSeverity, number>;
  signalsByDisposition: Record<TriageDisposition, number>;
  meanTimeToDetectMs: number;
  meanTimeToTriageMs: number;
  meanTimeToResolveMs: number;
  autoRemediatedCount: number;
  falsePositiveRate: number;
  suppressedCount: number;
  correlationGroupCount: number;
  topSignalSources: { source: SignalSource; count: number }[];
  topAffectedResources: { resourceId: string; signalCount: number }[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// §9 — Integration Contracts
// ═══════════════════════════════════════════════════════════════════════════════

export type SignalIntegrationTarget =
  | "cognitive_loop"
  | "reasoning_engine"
  | "monitoring_agent"
  | "drift_engine"
  | "memory_system"
  | "governance_engine"
  | "observability"
  | "notification_system"
  | "org_intelligence"
  | "infrastructure_intelligence";

export interface SignalIntegrationContract {
  target: SignalIntegrationTarget;
  direction: "consumes" | "produces" | "bidirectional";
  description: string;
  dataFlow: string;
}

export const SIGNAL_INTEGRATION_CONTRACTS: SignalIntegrationContract[] = [
  { target: "cognitive_loop", direction: "produces", description: "Feeds triaged signals into the cognitive reasoning loop", dataFlow: "TriagedSignal → CognitiveIntake" },
  { target: "reasoning_engine", direction: "produces", description: "Provides enriched signals for causal reasoning", dataFlow: "EnrichedSignal → ReasoningContext" },
  { target: "monitoring_agent", direction: "consumes", description: "Receives raw metric and alarm data from monitors", dataFlow: "MonitorData → SignalIntake" },
  { target: "drift_engine", direction: "consumes", description: "Receives drift detection results as signals", dataFlow: "DriftResult → SignalIntake" },
  { target: "memory_system", direction: "bidirectional", description: "Reads historical patterns, writes signal outcomes", dataFlow: "SignalOutcome ↔ PatternMemory" },
  { target: "governance_engine", direction: "produces", description: "Routes compliance signals to governance review", dataFlow: "ComplianceSignal → GovernanceReview" },
  { target: "observability", direction: "produces", description: "Emits signal processing metrics and traces", dataFlow: "SignalEvent → ObservabilityPipeline" },
  { target: "notification_system", direction: "produces", description: "Sends signal notifications per triage policy", dataFlow: "SignalNotification → NotificationChannel" },
  { target: "org_intelligence", direction: "consumes", description: "Applies org-specific suppression and triage preferences", dataFlow: "OrgPreferences → TriageConfig" },
  { target: "infrastructure_intelligence", direction: "bidirectional", description: "Uses topology for blast radius, feeds signal data back", dataFlow: "TopologyData ↔ SignalEnrichment" },
];

// ═══════════════════════════════════════════════════════════════════════════════
// §10 — Query Functions
// ═══════════════════════════════════════════════════════════════════════════════

export function getDetectionRule(id: string): DetectionRule | undefined {
  return DETECTION_RULES.find((r) => r.id === id);
}

export function getDetectionRulesByDomain(domain: SignalDomain): DetectionRule[] {
  return DETECTION_RULES.filter((r) => r.domain === domain);
}

export function getDetectionRulesByProvider(provider: "aws" | "azure" | "gcp"): DetectionRule[] {
  return DETECTION_RULES.filter((r) => r.provider === provider || r.provider === "any");
}

export function getEnabledDetectionRules(): DetectionRule[] {
  return DETECTION_RULES.filter((r) => r.enabled);
}

export function getCriticalDetectionRules(): DetectionRule[] {
  return DETECTION_RULES.filter((r) => r.severity === "critical");
}

export function getTriagePolicy(id: string): TriagePolicy | undefined {
  return TRIAGE_POLICIES.find((p) => p.id === id);
}

export function getTriagePoliciesByDisposition(disposition: TriageDisposition): TriagePolicy[] {
  return TRIAGE_POLICIES.filter((p) => p.disposition === disposition);
}

export function getAutoRemediablePolicies(): TriagePolicy[] {
  return TRIAGE_POLICIES.filter((p) => p.autoRemediationAllowed);
}

export function getCorrelationRule(id: string): CorrelationRule | undefined {
  return CORRELATION_RULES.find((r) => r.id === id);
}

export function getCorrelationRulesByStrategy(strategy: CorrelationStrategy): CorrelationRule[] {
  return CORRELATION_RULES.filter((r) => r.strategy === strategy);
}

export function getEnrichmentStage(type: EnrichmentType): EnrichmentStage | undefined {
  return ENRICHMENT_PIPELINE.stages.find((s) => s.type === type);
}

export function getSignalPipelineStage(id: SignalPipelineStageId): SignalPipelineStage | undefined {
  return SIGNAL_PIPELINE.find((s) => s.id === id);
}

export function getSignalPipelineOrder(): SignalPipelineStageId[] {
  return [...SIGNAL_PIPELINE].sort((a, b) => a.order - b.order).map((s) => s.id);
}

export function getSignalIntegration(target: SignalIntegrationTarget): SignalIntegrationContract | undefined {
  return SIGNAL_INTEGRATION_CONTRACTS.find((c) => c.target === target);
}

export function computeSignalPriority(severity: SignalSeverity, confidence: SignalConfidence, domain: SignalDomain): number {
  const severityScores: Record<SignalSeverity, number> = { info: 10, low: 30, medium: 50, high: 75, critical: 100 };
  const confidenceMultiplier: Record<SignalConfidence, number> = { speculative: 0.3, low: 0.5, moderate: 0.7, high: 0.9, confirmed: 1.0 };
  const domainBoost: Record<SignalDomain, number> = { security: 15, reliability: 12, compliance: 10, iam: 10, performance: 8, cost: 5, capacity: 7, drift: 5, network: 8, lifecycle: 3, data: 6, operational: 4 };
  return Math.min(100, severityScores[severity] * confidenceMultiplier[confidence] + domainBoost[domain]);
}

// ═══════════════════════════════════════════════════════════════════════════════
// §11 — Tests
// ═══════════════════════════════════════════════════════════════════════════════

export interface SignalDetectionTestResult {
  name: string;
  passed: boolean;
  message: string;
}

export function runSignalDetectionTests(): SignalDetectionTestResult[] {
  const results: SignalDetectionTestResult[] = [];
  const assert = (name: string, condition: boolean, msg: string) => {
    results.push({ name, passed: condition, message: condition ? "OK" : msg });
  };

  // §1 — Signal Architecture
  assert("signal-domains-12", (["cost", "security", "performance", "reliability", "compliance", "capacity", "drift", "lifecycle", "network", "iam", "data", "operational"] as SignalDomain[]).length === 12, "Should have 12 signal domains");
  assert("signal-states-14", (["detected", "enriching", "enriched", "correlating", "correlated", "triaging", "triaged", "routing", "routed", "acknowledged", "investigating", "resolved", "dismissed", "expired"] as SignalState[]).length === 14, "Should have 14 signal states");

  // §2 — Detection Rules
  assert("detection-rules-exist", DETECTION_RULES.length === 21, "Should have 21 detection rules");
  assert("enabled-rules", getEnabledDetectionRules().length === 21, "All rules should be enabled by default");
  assert("critical-rules", getCriticalDetectionRules().length >= 4, "Should have at least 4 critical rules");
  assert("cost-domain-rules", getDetectionRulesByDomain("cost").length >= 3, "Should have at least 3 cost rules");
  assert("security-domain-rules", getDetectionRulesByDomain("security").length >= 4, "Should have at least 4 security rules");
  assert("aws-rules", getDetectionRulesByProvider("aws").length >= 20, "AWS should have many applicable rules");
  assert("rule-lookup", getDetectionRule("unauthorized-api-call")?.severity === "critical", "Unauthorized API call should be critical");
  assert("all-rules-have-cooldown", DETECTION_RULES.every((r) => r.cooldownMs >= 0), "All rules should have cooldown defined");

  // §3 — Enrichment
  assert("enrichment-8-stages", ENRICHMENT_PIPELINE.stages.length === 8, "Should have 8 enrichment stages");
  assert("enrichment-ordered", ENRICHMENT_PIPELINE.stages.every((s, i) => i === 0 || s.order >= ENRICHMENT_PIPELINE.stages[i - 1].order), "Stages should be ordered");
  assert("resource-context-required", getEnrichmentStage("resource_context")?.required === true, "Resource context should be required");
  assert("risk-scoring-required", getEnrichmentStage("risk_scoring")?.required === true, "Risk scoring should be required");

  // §4 — Correlation
  assert("correlation-rules-exist", CORRELATION_RULES.length === 7, "Should have 7 correlation rules");
  assert("correlation-lookup", getCorrelationRule("cascade-failure")?.strategy === "causal_chain", "Cascade failure should use causal chain");
  assert("security-correlation-escalates", CORRELATION_RULES.find((r) => r.id === "security-incident-chain")?.severityEscalation === true, "Security incidents should escalate severity");

  // §5 — Triage
  assert("triage-policies-exist", TRIAGE_POLICIES.length === 7, "Should have 7 triage policies");
  assert("critical-security-immediate", getTriagePolicy("critical-security-immediate")?.disposition === "investigate_immediately", "Critical security should investigate immediately");
  assert("auto-remediable-policies", getAutoRemediablePolicies().length >= 2, "Should have at least 2 auto-remediable policies");
  assert("security-no-auto-remediate", getTriagePolicy("critical-security-immediate")?.autoRemediationAllowed === false, "Critical security should not auto-remediate");
  assert("triage-priority-ordering", TRIAGE_POLICIES.find((p) => p.id === "critical-security-immediate")!.priority > TRIAGE_POLICIES.find((p) => p.id === "lifecycle-info-monitor")!.priority, "Security priority should exceed lifecycle");

  // §6 — Pipeline
  assert("pipeline-8-stages", SIGNAL_PIPELINE.length === 8, "Should have 8 pipeline stages");
  assert("pipeline-ordered", SIGNAL_PIPELINE.every((s, i) => i === 0 || s.order >= SIGNAL_PIPELINE[i - 1].order), "Pipeline should be ordered");
  assert("intake-first", getSignalPipelineStage("intake")?.order === 1, "Intake should be first");
  assert("audit-last", getSignalPipelineStage("audit")?.order === 8, "Audit should be last");

  // §9 — Integration Contracts
  assert("integration-contracts-exist", SIGNAL_INTEGRATION_CONTRACTS.length === 10, "Should have 10 integration contracts");
  assert("cognitive-loop-integration", getSignalIntegration("cognitive_loop")?.direction === "produces", "Should produce to cognitive loop");
  assert("memory-bidirectional", getSignalIntegration("memory_system")?.direction === "bidirectional", "Memory should be bidirectional");

  // §10 — Signal Priority
  assert("critical-security-high-priority", computeSignalPriority("critical", "confirmed", "security") > 100, "Critical confirmed security should be max priority");
  assert("info-speculative-low-priority", computeSignalPriority("info", "speculative", "operational") < 20, "Info speculative operational should be low priority");
  assert("severity-ordering", computeSignalPriority("high", "high", "security") > computeSignalPriority("low", "high", "security"), "Higher severity should produce higher priority");
  assert("confidence-effect", computeSignalPriority("medium", "confirmed", "cost") > computeSignalPriority("medium", "speculative", "cost"), "Higher confidence should produce higher priority");

  return results;
}
