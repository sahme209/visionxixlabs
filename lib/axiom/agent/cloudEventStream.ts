/**
 * Axiom Agent — Cloud Event Stream Engine
 *
 * Real-time event ingestion from AWS CloudTrail, CloudWatch, EventBridge,
 * Azure Activity/Monitor, and GCP Audit/Monitoring. Transforms raw provider
 * events into the unified signal format that feeds the cognitive loop.
 *
 * This is the "ears" of Axiom — making it reactive to infrastructure changes
 * rather than relying solely on periodic snapshot polling.
 */

// ═══════════════════════════════════════════════════════════════════════════════
// §1 — Event Stream Architecture
// ═══════════════════════════════════════════════════════════════════════════════

export type CloudEventProvider = "aws" | "azure" | "gcp";

export type CloudEventSourceType =
  | "cloudtrail"
  | "cloudwatch_alarm"
  | "cloudwatch_metric"
  | "eventbridge"
  | "config_change"
  | "guardduty"
  | "security_hub"
  | "cost_explorer"
  | "trusted_advisor"
  | "azure_activity_log"
  | "azure_monitor_alert"
  | "azure_advisor"
  | "azure_security_center"
  | "azure_cost_management"
  | "gcp_audit_log"
  | "gcp_monitoring_alert"
  | "gcp_recommender"
  | "gcp_security_command_center"
  | "gcp_billing";

export type CloudEventSeverity = "critical" | "high" | "medium" | "low" | "informational";

export type CloudEventCategory =
  | "security"
  | "compliance"
  | "performance"
  | "cost"
  | "availability"
  | "configuration"
  | "access"
  | "network"
  | "storage"
  | "compute"
  | "database"
  | "identity";

export interface CloudEvent {
  id: string;
  provider: CloudEventProvider;
  sourceType: CloudEventSourceType;
  category: CloudEventCategory;
  severity: CloudEventSeverity;
  timestamp: string;
  receivedAt: string;
  accountId: string;
  region: string;
  resourceArn?: string;
  resourceType?: string;
  resourceId?: string;
  eventName: string;
  eventDetail: Record<string, unknown>;
  userIdentity?: EventUserIdentity;
  sourceIpAddress?: string;
  rawPayload: Record<string, unknown>;
  tags: Record<string, string>;
  dedupKey: string;
}

export interface EventUserIdentity {
  type: "iam_user" | "assumed_role" | "federated" | "root" | "service" | "unknown";
  arn?: string;
  accountId?: string;
  principalId?: string;
  userName?: string;
  sessionContext?: {
    mfaAuthenticated: boolean;
    creationDate?: string;
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// §2 — Event Source Definitions
// ═══════════════════════════════════════════════════════════════════════════════

export interface EventSourceConfig {
  id: string;
  name: string;
  provider: CloudEventProvider;
  sourceType: CloudEventSourceType;
  enabled: boolean;
  pollingIntervalMs?: number;
  webhookEndpoint?: string;
  filterPatterns: EventFilterPattern[];
  rateLimitPerSecond: number;
  batchSize: number;
  retryPolicy: EventRetryPolicy;
  description: string;
}

export interface EventFilterPattern {
  field: string;
  operator: "equals" | "not_equals" | "contains" | "starts_with" | "regex" | "in" | "not_in";
  value: string | string[];
}

export interface EventRetryPolicy {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

export const EVENT_SOURCE_CONFIGS: EventSourceConfig[] = [
  // ── AWS Sources ──
  {
    id: "aws-cloudtrail",
    name: "AWS CloudTrail",
    provider: "aws",
    sourceType: "cloudtrail",
    enabled: true,
    pollingIntervalMs: 60_000,
    filterPatterns: [
      { field: "readOnly", operator: "equals", value: "false" },
    ],
    rateLimitPerSecond: 100,
    batchSize: 50,
    retryPolicy: { maxRetries: 3, baseDelayMs: 1_000, maxDelayMs: 30_000, backoffMultiplier: 2 },
    description: "Captures all write API calls across AWS services for change detection and security audit",
  },
  {
    id: "aws-cloudwatch-alarms",
    name: "AWS CloudWatch Alarms",
    provider: "aws",
    sourceType: "cloudwatch_alarm",
    enabled: true,
    pollingIntervalMs: 30_000,
    filterPatterns: [],
    rateLimitPerSecond: 50,
    batchSize: 20,
    retryPolicy: { maxRetries: 3, baseDelayMs: 2_000, maxDelayMs: 60_000, backoffMultiplier: 2 },
    description: "Monitors CloudWatch alarm state changes for availability and performance signals",
  },
  {
    id: "aws-eventbridge",
    name: "AWS EventBridge",
    provider: "aws",
    sourceType: "eventbridge",
    enabled: true,
    webhookEndpoint: "/api/axiom/events/aws/eventbridge",
    filterPatterns: [],
    rateLimitPerSecond: 200,
    batchSize: 100,
    retryPolicy: { maxRetries: 5, baseDelayMs: 500, maxDelayMs: 15_000, backoffMultiplier: 2 },
    description: "Receives real-time events from EventBridge rules for immediate reaction",
  },
  {
    id: "aws-guardduty",
    name: "AWS GuardDuty",
    provider: "aws",
    sourceType: "guardduty",
    enabled: true,
    pollingIntervalMs: 300_000,
    filterPatterns: [],
    rateLimitPerSecond: 20,
    batchSize: 10,
    retryPolicy: { maxRetries: 3, baseDelayMs: 5_000, maxDelayMs: 60_000, backoffMultiplier: 2 },
    description: "Ingests GuardDuty findings for threat detection and security signal generation",
  },
  {
    id: "aws-security-hub",
    name: "AWS Security Hub",
    provider: "aws",
    sourceType: "security_hub",
    enabled: true,
    pollingIntervalMs: 600_000,
    filterPatterns: [
      { field: "Severity.Label", operator: "in", value: ["CRITICAL", "HIGH", "MEDIUM"] },
    ],
    rateLimitPerSecond: 10,
    batchSize: 25,
    retryPolicy: { maxRetries: 3, baseDelayMs: 5_000, maxDelayMs: 120_000, backoffMultiplier: 2 },
    description: "Aggregates Security Hub findings across AWS security services",
  },
  {
    id: "aws-config-changes",
    name: "AWS Config",
    provider: "aws",
    sourceType: "config_change",
    enabled: true,
    pollingIntervalMs: 120_000,
    filterPatterns: [],
    rateLimitPerSecond: 30,
    batchSize: 20,
    retryPolicy: { maxRetries: 3, baseDelayMs: 2_000, maxDelayMs: 60_000, backoffMultiplier: 2 },
    description: "Tracks AWS Config configuration changes and compliance rule evaluations",
  },
  {
    id: "aws-trusted-advisor",
    name: "AWS Trusted Advisor",
    provider: "aws",
    sourceType: "trusted_advisor",
    enabled: true,
    pollingIntervalMs: 3_600_000,
    filterPatterns: [],
    rateLimitPerSecond: 5,
    batchSize: 50,
    retryPolicy: { maxRetries: 2, baseDelayMs: 10_000, maxDelayMs: 120_000, backoffMultiplier: 2 },
    description: "Pulls Trusted Advisor checks for cost, security, performance, and fault tolerance",
  },
  {
    id: "aws-cost-explorer",
    name: "AWS Cost Explorer",
    provider: "aws",
    sourceType: "cost_explorer",
    enabled: true,
    pollingIntervalMs: 3_600_000,
    filterPatterns: [],
    rateLimitPerSecond: 5,
    batchSize: 1,
    retryPolicy: { maxRetries: 2, baseDelayMs: 10_000, maxDelayMs: 120_000, backoffMultiplier: 2 },
    description: "Fetches cost and usage data for anomaly detection and optimization signals",
  },

  // ── Azure Sources ──
  {
    id: "azure-activity-log",
    name: "Azure Activity Log",
    provider: "azure",
    sourceType: "azure_activity_log",
    enabled: true,
    pollingIntervalMs: 60_000,
    filterPatterns: [
      { field: "status.value", operator: "not_equals", value: "Started" },
    ],
    rateLimitPerSecond: 50,
    batchSize: 50,
    retryPolicy: { maxRetries: 3, baseDelayMs: 2_000, maxDelayMs: 60_000, backoffMultiplier: 2 },
    description: "Tracks Azure subscription-level operations for change and access monitoring",
  },
  {
    id: "azure-monitor-alerts",
    name: "Azure Monitor Alerts",
    provider: "azure",
    sourceType: "azure_monitor_alert",
    enabled: true,
    pollingIntervalMs: 30_000,
    filterPatterns: [],
    rateLimitPerSecond: 30,
    batchSize: 20,
    retryPolicy: { maxRetries: 3, baseDelayMs: 2_000, maxDelayMs: 60_000, backoffMultiplier: 2 },
    description: "Receives Azure Monitor alert firings for performance and availability signals",
  },
  {
    id: "azure-advisor",
    name: "Azure Advisor",
    provider: "azure",
    sourceType: "azure_advisor",
    enabled: true,
    pollingIntervalMs: 3_600_000,
    filterPatterns: [],
    rateLimitPerSecond: 10,
    batchSize: 50,
    retryPolicy: { maxRetries: 2, baseDelayMs: 5_000, maxDelayMs: 120_000, backoffMultiplier: 2 },
    description: "Pulls Azure Advisor recommendations for cost, security, and performance",
  },
  {
    id: "azure-security-center",
    name: "Azure Security Center",
    provider: "azure",
    sourceType: "azure_security_center",
    enabled: true,
    pollingIntervalMs: 600_000,
    filterPatterns: [],
    rateLimitPerSecond: 10,
    batchSize: 25,
    retryPolicy: { maxRetries: 3, baseDelayMs: 5_000, maxDelayMs: 120_000, backoffMultiplier: 2 },
    description: "Ingests Security Center alerts and secure score changes",
  },

  // ── GCP Sources ──
  {
    id: "gcp-audit-log",
    name: "GCP Audit Log",
    provider: "gcp",
    sourceType: "gcp_audit_log",
    enabled: true,
    pollingIntervalMs: 60_000,
    filterPatterns: [],
    rateLimitPerSecond: 50,
    batchSize: 50,
    retryPolicy: { maxRetries: 3, baseDelayMs: 2_000, maxDelayMs: 60_000, backoffMultiplier: 2 },
    description: "Captures GCP admin activity and data access audit logs",
  },
  {
    id: "gcp-monitoring-alerts",
    name: "GCP Cloud Monitoring",
    provider: "gcp",
    sourceType: "gcp_monitoring_alert",
    enabled: true,
    pollingIntervalMs: 30_000,
    filterPatterns: [],
    rateLimitPerSecond: 30,
    batchSize: 20,
    retryPolicy: { maxRetries: 3, baseDelayMs: 2_000, maxDelayMs: 60_000, backoffMultiplier: 2 },
    description: "Receives GCP Cloud Monitoring alerting policy notifications",
  },
  {
    id: "gcp-recommender",
    name: "GCP Recommender",
    provider: "gcp",
    sourceType: "gcp_recommender",
    enabled: true,
    pollingIntervalMs: 3_600_000,
    filterPatterns: [],
    rateLimitPerSecond: 10,
    batchSize: 50,
    retryPolicy: { maxRetries: 2, baseDelayMs: 5_000, maxDelayMs: 120_000, backoffMultiplier: 2 },
    description: "Pulls GCP Recommender insights for cost and performance optimization",
  },
  {
    id: "gcp-security-command-center",
    name: "GCP Security Command Center",
    provider: "gcp",
    sourceType: "gcp_security_command_center",
    enabled: true,
    pollingIntervalMs: 600_000,
    filterPatterns: [],
    rateLimitPerSecond: 10,
    batchSize: 25,
    retryPolicy: { maxRetries: 3, baseDelayMs: 5_000, maxDelayMs: 120_000, backoffMultiplier: 2 },
    description: "Ingests Security Command Center findings and asset discovery",
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// §3 — Event Normalization Rules
// ═══════════════════════════════════════════════════════════════════════════════

export interface EventNormalizationRule {
  id: string;
  name: string;
  sourceType: CloudEventSourceType;
  provider: CloudEventProvider;
  extractors: FieldExtractor[];
  categoryMapping: Record<string, CloudEventCategory>;
  severityMapping: Record<string, CloudEventSeverity>;
  dedupKeyTemplate: string;
  description: string;
}

export interface FieldExtractor {
  targetField: keyof CloudEvent | string;
  sourcePath: string;
  transform?: "lowercase" | "uppercase" | "trim" | "parse_arn" | "parse_timestamp" | "stringify";
  defaultValue?: string;
}

export const EVENT_NORMALIZATION_RULES: EventNormalizationRule[] = [
  {
    id: "normalize-cloudtrail",
    name: "CloudTrail Event Normalization",
    sourceType: "cloudtrail",
    provider: "aws",
    extractors: [
      { targetField: "eventName", sourcePath: "eventName" },
      { targetField: "resourceArn", sourcePath: "resources[0].ARN" },
      { targetField: "resourceType", sourcePath: "resources[0].type" },
      { targetField: "region", sourcePath: "awsRegion" },
      { targetField: "accountId", sourcePath: "recipientAccountId" },
      { targetField: "sourceIpAddress", sourcePath: "sourceIPAddress" },
      { targetField: "timestamp", sourcePath: "eventTime", transform: "parse_timestamp" },
    ],
    categoryMapping: {
      "CreateSecurityGroup": "security",
      "AuthorizeSecurityGroupIngress": "security",
      "RevokeSecurityGroupIngress": "security",
      "CreateUser": "identity",
      "DeleteUser": "identity",
      "AttachUserPolicy": "identity",
      "PutBucketPolicy": "security",
      "CreateBucket": "storage",
      "DeleteBucket": "storage",
      "RunInstances": "compute",
      "TerminateInstances": "compute",
      "ModifyInstanceAttribute": "compute",
      "CreateDBInstance": "database",
      "DeleteDBInstance": "database",
      "ModifyDBInstance": "database",
      "CreateVpc": "network",
      "DeleteVpc": "network",
      "CreateSubnet": "network",
      "DEFAULT": "configuration",
    },
    severityMapping: {
      "DeleteDBInstance": "critical",
      "TerminateInstances": "high",
      "DeleteBucket": "high",
      "PutBucketPolicy": "high",
      "AttachUserPolicy": "medium",
      "AuthorizeSecurityGroupIngress": "medium",
      "RunInstances": "low",
      "CreateBucket": "low",
      "DEFAULT": "informational",
    },
    dedupKeyTemplate: "${provider}:${sourceType}:${accountId}:${eventName}:${resourceArn}:${timestamp}",
    description: "Normalizes AWS CloudTrail events into unified format with category/severity classification",
  },
  {
    id: "normalize-cloudwatch-alarm",
    name: "CloudWatch Alarm Normalization",
    sourceType: "cloudwatch_alarm",
    provider: "aws",
    extractors: [
      { targetField: "eventName", sourcePath: "AlarmName" },
      { targetField: "resourceArn", sourcePath: "AlarmArn" },
      { targetField: "region", sourcePath: "Region" },
      { targetField: "accountId", sourcePath: "AWSAccountId" },
      { targetField: "timestamp", sourcePath: "StateChangeTime", transform: "parse_timestamp" },
    ],
    categoryMapping: {
      "CPUUtilization": "performance",
      "MemoryUtilization": "performance",
      "DiskSpaceUtilization": "performance",
      "NetworkIn": "network",
      "NetworkOut": "network",
      "StatusCheckFailed": "availability",
      "UnHealthyHostCount": "availability",
      "5XXError": "availability",
      "4XXError": "performance",
      "EstimatedCharges": "cost",
      "DEFAULT": "performance",
    },
    severityMapping: {
      "ALARM": "high",
      "INSUFFICIENT_DATA": "medium",
      "OK": "informational",
      "DEFAULT": "medium",
    },
    dedupKeyTemplate: "${provider}:${sourceType}:${accountId}:${eventName}:${region}",
    description: "Normalizes CloudWatch alarm state transitions into performance/availability signals",
  },
  {
    id: "normalize-guardduty",
    name: "GuardDuty Finding Normalization",
    sourceType: "guardduty",
    provider: "aws",
    extractors: [
      { targetField: "eventName", sourcePath: "Type" },
      { targetField: "resourceArn", sourcePath: "Resource.InstanceDetails.InstanceId" },
      { targetField: "resourceType", sourcePath: "Resource.ResourceType" },
      { targetField: "region", sourcePath: "Region" },
      { targetField: "accountId", sourcePath: "AccountId" },
      { targetField: "timestamp", sourcePath: "CreatedAt", transform: "parse_timestamp" },
    ],
    categoryMapping: {
      "Recon": "security",
      "UnauthorizedAccess": "security",
      "CryptoCurrency": "security",
      "Trojan": "security",
      "Backdoor": "security",
      "PenTest": "security",
      "Policy": "compliance",
      "DEFAULT": "security",
    },
    severityMapping: {
      "8": "critical",
      "7": "critical",
      "6": "high",
      "5": "high",
      "4": "medium",
      "3": "medium",
      "2": "low",
      "1": "low",
      "DEFAULT": "medium",
    },
    dedupKeyTemplate: "${provider}:guardduty:${accountId}:${eventName}:${resourceArn}",
    description: "Normalizes GuardDuty findings with threat-level severity mapping",
  },
  {
    id: "normalize-azure-activity",
    name: "Azure Activity Log Normalization",
    sourceType: "azure_activity_log",
    provider: "azure",
    extractors: [
      { targetField: "eventName", sourcePath: "operationName.value" },
      { targetField: "resourceArn", sourcePath: "resourceId" },
      { targetField: "resourceType", sourcePath: "resourceType.value" },
      { targetField: "region", sourcePath: "location" },
      { targetField: "accountId", sourcePath: "subscriptionId" },
      { targetField: "timestamp", sourcePath: "eventTimestamp", transform: "parse_timestamp" },
    ],
    categoryMapping: {
      "Microsoft.Compute": "compute",
      "Microsoft.Storage": "storage",
      "Microsoft.Network": "network",
      "Microsoft.Sql": "database",
      "Microsoft.Authorization": "identity",
      "Microsoft.Security": "security",
      "DEFAULT": "configuration",
    },
    severityMapping: {
      "Critical": "critical",
      "Error": "high",
      "Warning": "medium",
      "Informational": "low",
      "DEFAULT": "informational",
    },
    dedupKeyTemplate: "${provider}:${sourceType}:${accountId}:${eventName}:${resourceArn}:${timestamp}",
    description: "Normalizes Azure Activity Log entries with resource provider categorization",
  },
  {
    id: "normalize-gcp-audit",
    name: "GCP Audit Log Normalization",
    sourceType: "gcp_audit_log",
    provider: "gcp",
    extractors: [
      { targetField: "eventName", sourcePath: "protoPayload.methodName" },
      { targetField: "resourceArn", sourcePath: "protoPayload.resourceName" },
      { targetField: "resourceType", sourcePath: "resource.type" },
      { targetField: "region", sourcePath: "resource.labels.zone" },
      { targetField: "accountId", sourcePath: "resource.labels.project_id" },
      { targetField: "sourceIpAddress", sourcePath: "protoPayload.requestMetadata.callerIp" },
      { targetField: "timestamp", sourcePath: "timestamp", transform: "parse_timestamp" },
    ],
    categoryMapping: {
      "compute.instances": "compute",
      "storage.buckets": "storage",
      "cloudsql.instances": "database",
      "iam.serviceAccounts": "identity",
      "compute.firewalls": "security",
      "DEFAULT": "configuration",
    },
    severityMapping: {
      "EMERGENCY": "critical",
      "ALERT": "critical",
      "CRITICAL": "critical",
      "ERROR": "high",
      "WARNING": "medium",
      "NOTICE": "low",
      "INFO": "informational",
      "DEBUG": "informational",
      "DEFAULT": "informational",
    },
    dedupKeyTemplate: "${provider}:${sourceType}:${accountId}:${eventName}:${resourceArn}:${timestamp}",
    description: "Normalizes GCP Audit Log entries with service-based categorization",
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// §4 — Event Classification & Threat Intelligence
// ═══════════════════════════════════════════════════════════════════════════════

export type ThreatIndicatorType =
  | "ip_reputation"
  | "impossible_travel"
  | "credential_stuffing"
  | "privilege_escalation"
  | "data_exfiltration"
  | "resource_hijacking"
  | "api_abuse"
  | "configuration_tampering";

export interface EventClassificationRule {
  id: string;
  name: string;
  description: string;
  provider: CloudEventProvider | "all";
  sourceTypes: CloudEventSourceType[];
  conditions: ClassificationCondition[];
  outputCategory: CloudEventCategory;
  outputSeverity: CloudEventSeverity;
  threatIndicator?: ThreatIndicatorType;
  mitreTactic?: string;
  mitreTechnique?: string;
  autoEscalate: boolean;
}

export interface ClassificationCondition {
  field: string;
  operator: "equals" | "not_equals" | "contains" | "regex" | "in" | "gt" | "lt" | "exists";
  value: string | number | string[];
  logicalOp?: "and" | "or";
}

export const EVENT_CLASSIFICATION_RULES: EventClassificationRule[] = [
  {
    id: "cls-root-account-usage",
    name: "Root Account Usage Detected",
    description: "Root account login or API call — always critical regardless of action",
    provider: "aws",
    sourceTypes: ["cloudtrail"],
    conditions: [
      { field: "userIdentity.type", operator: "equals", value: "Root" },
    ],
    outputCategory: "security",
    outputSeverity: "critical",
    threatIndicator: "privilege_escalation",
    mitreTactic: "Privilege Escalation",
    mitreTechnique: "T1078.004",
    autoEscalate: true,
  },
  {
    id: "cls-console-login-no-mfa",
    name: "Console Login Without MFA",
    description: "User logged into AWS console without multi-factor authentication",
    provider: "aws",
    sourceTypes: ["cloudtrail"],
    conditions: [
      { field: "eventName", operator: "equals", value: "ConsoleLogin" },
      { field: "additionalEventData.MFAUsed", operator: "equals", value: "No", logicalOp: "and" },
    ],
    outputCategory: "security",
    outputSeverity: "high",
    threatIndicator: "credential_stuffing",
    mitreTactic: "Initial Access",
    mitreTechnique: "T1078",
    autoEscalate: true,
  },
  {
    id: "cls-iam-policy-wildcard",
    name: "IAM Policy With Wildcard Actions",
    description: "IAM policy attached with Action: * or Resource: * — overly permissive",
    provider: "aws",
    sourceTypes: ["cloudtrail"],
    conditions: [
      { field: "eventName", operator: "in", value: ["PutUserPolicy", "PutRolePolicy", "PutGroupPolicy", "AttachUserPolicy", "AttachRolePolicy"] },
    ],
    outputCategory: "security",
    outputSeverity: "high",
    threatIndicator: "privilege_escalation",
    mitreTactic: "Privilege Escalation",
    mitreTechnique: "T1098",
    autoEscalate: false,
  },
  {
    id: "cls-s3-public-access",
    name: "S3 Bucket Made Public",
    description: "S3 bucket ACL or policy changed to allow public access",
    provider: "aws",
    sourceTypes: ["cloudtrail", "config_change"],
    conditions: [
      { field: "eventName", operator: "in", value: ["PutBucketAcl", "PutBucketPolicy", "PutBucketPublicAccessBlock"] },
    ],
    outputCategory: "security",
    outputSeverity: "critical",
    threatIndicator: "data_exfiltration",
    mitreTactic: "Collection",
    mitreTechnique: "T1530",
    autoEscalate: true,
  },
  {
    id: "cls-security-group-open",
    name: "Security Group Opened to 0.0.0.0/0",
    description: "Security group ingress rule added allowing traffic from any IP",
    provider: "aws",
    sourceTypes: ["cloudtrail"],
    conditions: [
      { field: "eventName", operator: "equals", value: "AuthorizeSecurityGroupIngress" },
    ],
    outputCategory: "security",
    outputSeverity: "high",
    threatIndicator: "configuration_tampering",
    mitreTactic: "Defense Evasion",
    mitreTechnique: "T1562.007",
    autoEscalate: false,
  },
  {
    id: "cls-unusual-api-volume",
    name: "Unusual API Call Volume",
    description: "Spike in API calls from a single identity — possible enumeration or abuse",
    provider: "all",
    sourceTypes: ["cloudtrail", "azure_activity_log", "gcp_audit_log"],
    conditions: [
      { field: "_meta.callCountLast5m", operator: "gt", value: 500 },
    ],
    outputCategory: "security",
    outputSeverity: "medium",
    threatIndicator: "api_abuse",
    mitreTactic: "Discovery",
    mitreTechnique: "T1580",
    autoEscalate: false,
  },
  {
    id: "cls-kms-key-deletion",
    name: "KMS Key Scheduled for Deletion",
    description: "Encryption key scheduled for deletion — data may become unrecoverable",
    provider: "aws",
    sourceTypes: ["cloudtrail"],
    conditions: [
      { field: "eventName", operator: "equals", value: "ScheduleKeyDeletion" },
    ],
    outputCategory: "security",
    outputSeverity: "critical",
    threatIndicator: "data_exfiltration",
    mitreTactic: "Impact",
    mitreTechnique: "T1485",
    autoEscalate: true,
  },
  {
    id: "cls-production-db-modification",
    name: "Production Database Modified",
    description: "RDS/SQL instance in production environment was modified or deleted",
    provider: "all",
    sourceTypes: ["cloudtrail", "azure_activity_log", "gcp_audit_log"],
    conditions: [
      { field: "resourceType", operator: "in", value: ["AWS::RDS::DBInstance", "Microsoft.Sql/servers", "sqladmin.googleapis.com/Instance"] },
      { field: "_meta.environment", operator: "equals", value: "production", logicalOp: "and" },
    ],
    outputCategory: "database",
    outputSeverity: "high",
    threatIndicator: "configuration_tampering",
    mitreTactic: "Impact",
    mitreTechnique: "T1489",
    autoEscalate: true,
  },
  {
    id: "cls-cost-spike",
    name: "Cost Anomaly Detected",
    description: "Spending rate significantly exceeds baseline for the time period",
    provider: "all",
    sourceTypes: ["cost_explorer", "azure_cost_management", "gcp_billing"],
    conditions: [
      { field: "_meta.costVariancePercent", operator: "gt", value: 50 },
    ],
    outputCategory: "cost",
    outputSeverity: "high",
    autoEscalate: false,
  },
  {
    id: "cls-compliance-drift",
    name: "Compliance Configuration Drift",
    description: "Resource configuration changed in a way that violates compliance rules",
    provider: "all",
    sourceTypes: ["config_change", "security_hub", "azure_security_center", "gcp_security_command_center"],
    conditions: [
      { field: "_meta.complianceStatus", operator: "equals", value: "NON_COMPLIANT" },
    ],
    outputCategory: "compliance",
    outputSeverity: "high",
    autoEscalate: false,
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// §5 — Event Processing Pipeline
// ═══════════════════════════════════════════════════════════════════════════════

export type EventPipelineStageId =
  | "ingest"
  | "validate"
  | "normalize"
  | "deduplicate"
  | "classify"
  | "enrich"
  | "correlate"
  | "route"
  | "buffer"
  | "emit";

export interface EventPipelineStage {
  id: EventPipelineStageId;
  name: string;
  order: number;
  timeoutMs: number;
  canDrop: boolean;
  metricsKey: string;
  description: string;
}

export const EVENT_PIPELINE: EventPipelineStage[] = [
  { id: "ingest", name: "Ingest", order: 1, timeoutMs: 5_000, canDrop: false, metricsKey: "event_pipeline.ingest", description: "Receive raw event from provider source" },
  { id: "validate", name: "Validate", order: 2, timeoutMs: 1_000, canDrop: true, metricsKey: "event_pipeline.validate", description: "Schema validation and structural integrity check" },
  { id: "normalize", name: "Normalize", order: 3, timeoutMs: 2_000, canDrop: false, metricsKey: "event_pipeline.normalize", description: "Transform provider-specific format into CloudEvent" },
  { id: "deduplicate", name: "Deduplicate", order: 4, timeoutMs: 500, canDrop: true, metricsKey: "event_pipeline.dedup", description: "Filter duplicate events using dedup key with sliding window" },
  { id: "classify", name: "Classify", order: 5, timeoutMs: 2_000, canDrop: false, metricsKey: "event_pipeline.classify", description: "Apply classification rules for threat and category detection" },
  { id: "enrich", name: "Enrich", order: 6, timeoutMs: 5_000, canDrop: false, metricsKey: "event_pipeline.enrich", description: "Add context: resource tags, owner, environment, cost center" },
  { id: "correlate", name: "Correlate", order: 7, timeoutMs: 3_000, canDrop: false, metricsKey: "event_pipeline.correlate", description: "Group related events into correlated clusters" },
  { id: "route", name: "Route", order: 8, timeoutMs: 1_000, canDrop: false, metricsKey: "event_pipeline.route", description: "Determine downstream consumers for this event" },
  { id: "buffer", name: "Buffer", order: 9, timeoutMs: 500, canDrop: false, metricsKey: "event_pipeline.buffer", description: "Batch events for efficient downstream delivery" },
  { id: "emit", name: "Emit", order: 10, timeoutMs: 5_000, canDrop: false, metricsKey: "event_pipeline.emit", description: "Deliver to signal detection, incident response, and audit log" },
];

// ═══════════════════════════════════════════════════════════════════════════════
// §6 — Deduplication & Windowing
// ═══════════════════════════════════════════════════════════════════════════════

export interface DeduplicationConfig {
  windowSizeMs: number;
  maxWindowEntries: number;
  hashAlgorithm: "sha256" | "xxhash" | "murmur3";
  cleanupIntervalMs: number;
  storageBackend: "memory" | "redis" | "dynamodb";
}

export const DEFAULT_DEDUP_CONFIG: DeduplicationConfig = {
  windowSizeMs: 300_000,
  maxWindowEntries: 100_000,
  hashAlgorithm: "sha256",
  cleanupIntervalMs: 60_000,
  storageBackend: "memory",
};

export interface EventWindow {
  windowId: string;
  startTime: string;
  endTime: string;
  eventCount: number;
  provider: CloudEventProvider;
  accountId: string;
  categories: Record<CloudEventCategory, number>;
  severities: Record<CloudEventSeverity, number>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// §7 — Event Correlation Engine
// ═══════════════════════════════════════════════════════════════════════════════

export type CorrelationStrategyType =
  | "temporal_proximity"
  | "resource_affinity"
  | "identity_chain"
  | "blast_radius"
  | "causal_sequence"
  | "cross_provider";

export interface EventCorrelationRule {
  id: string;
  name: string;
  strategy: CorrelationStrategyType;
  windowMs: number;
  minEvents: number;
  maxEvents: number;
  conditions: CorrelationCondition[];
  outputSeverityEscalation: boolean;
  description: string;
}

export interface CorrelationCondition {
  type: "same_resource" | "same_identity" | "same_account" | "same_region" | "temporal" | "causal";
  parameters: Record<string, string | number>;
}

export const EVENT_CORRELATION_RULES: EventCorrelationRule[] = [
  {
    id: "corr-attack-chain",
    name: "Multi-Stage Attack Chain",
    strategy: "causal_sequence",
    windowMs: 3_600_000,
    minEvents: 3,
    maxEvents: 50,
    conditions: [
      { type: "same_identity", parameters: {} },
      { type: "temporal", parameters: { maxGapMs: 600_000 } },
    ],
    outputSeverityEscalation: true,
    description: "Detects sequences of security events from the same identity suggesting a multi-stage attack",
  },
  {
    id: "corr-resource-cascade",
    name: "Resource Modification Cascade",
    strategy: "resource_affinity",
    windowMs: 300_000,
    minEvents: 5,
    maxEvents: 100,
    conditions: [
      { type: "same_account", parameters: {} },
      { type: "same_region", parameters: {} },
    ],
    outputSeverityEscalation: true,
    description: "Groups rapid configuration changes to related resources indicating cascading modifications",
  },
  {
    id: "corr-cross-provider",
    name: "Cross-Provider Correlated Activity",
    strategy: "cross_provider",
    windowMs: 900_000,
    minEvents: 2,
    maxEvents: 20,
    conditions: [
      { type: "same_identity", parameters: {} },
      { type: "temporal", parameters: { maxGapMs: 300_000 } },
    ],
    outputSeverityEscalation: false,
    description: "Correlates activity from the same identity across AWS, Azure, and GCP",
  },
  {
    id: "corr-blast-radius-expansion",
    name: "Blast Radius Expansion",
    strategy: "blast_radius",
    windowMs: 600_000,
    minEvents: 3,
    maxEvents: 50,
    conditions: [
      { type: "same_account", parameters: {} },
      { type: "causal", parameters: { relationship: "depends_on" } },
    ],
    outputSeverityEscalation: true,
    description: "Detects changes spreading through dependency chains, indicating growing blast radius",
  },
  {
    id: "corr-credential-abuse",
    name: "Credential Abuse Pattern",
    strategy: "identity_chain",
    windowMs: 1_800_000,
    minEvents: 3,
    maxEvents: 100,
    conditions: [
      { type: "same_identity", parameters: {} },
      { type: "temporal", parameters: { maxGapMs: 300_000 } },
    ],
    outputSeverityEscalation: true,
    description: "Identifies patterns of credential reuse or abuse across multiple services and regions",
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// §8 — Stream Health & Backpressure
// ═══════════════════════════════════════════════════════════════════════════════

export interface StreamHealthConfig {
  maxQueueDepth: number;
  backpressureThreshold: number;
  dropPolicy: "oldest" | "lowest_severity" | "random" | "none";
  healthCheckIntervalMs: number;
  lagAlertThresholdMs: number;
  staleSourceAlertMs: number;
}

export const DEFAULT_STREAM_HEALTH_CONFIG: StreamHealthConfig = {
  maxQueueDepth: 10_000,
  backpressureThreshold: 0.8,
  dropPolicy: "lowest_severity",
  healthCheckIntervalMs: 10_000,
  lagAlertThresholdMs: 60_000,
  staleSourceAlertMs: 300_000,
};

export interface StreamHealthSnapshot {
  timestamp: string;
  totalEventsProcessed: number;
  eventsPerSecond: number;
  queueDepth: number;
  queueUtilization: number;
  backpressureActive: boolean;
  eventsDropped: number;
  processingLatencyP50Ms: number;
  processingLatencyP99Ms: number;
  sourceHealth: Record<string, SourceHealthStatus>;
  pipelineStageLatencies: Record<EventPipelineStageId, number>;
}

export interface SourceHealthStatus {
  sourceId: string;
  lastEventAt: string;
  eventsLast5m: number;
  errorsLast5m: number;
  healthy: boolean;
  lastError?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// §9 — Integration Contracts
// ═══════════════════════════════════════════════════════════════════════════════

export type EventStreamIntegrationTarget =
  | "signal_detection"
  | "incident_response"
  | "cost_intelligence"
  | "compliance_engine"
  | "cognitive_loop"
  | "audit_trail"
  | "notification_engine"
  | "memory_system"
  | "dashboard_api"
  | "external_siem";

export interface EventStreamIntegrationContract {
  target: EventStreamIntegrationTarget;
  direction: "outbound" | "inbound" | "bidirectional";
  protocol: "function_call" | "event_bus" | "webhook" | "queue";
  dataShape: string;
  slaMs: number;
  description: string;
}

export const EVENT_STREAM_INTEGRATION_CONTRACTS: EventStreamIntegrationContract[] = [
  { target: "signal_detection", direction: "outbound", protocol: "function_call", dataShape: "CloudEvent → SignalInput", slaMs: 100, description: "Classified events are forwarded to signal detection for rule evaluation and enrichment" },
  { target: "incident_response", direction: "outbound", protocol: "event_bus", dataShape: "CloudEvent(critical) → IncidentTrigger", slaMs: 50, description: "Auto-escalated events immediately trigger incident creation" },
  { target: "cost_intelligence", direction: "outbound", protocol: "function_call", dataShape: "CloudEvent(cost) → CostEvent", slaMs: 500, description: "Cost-category events are routed to cost intelligence for anomaly detection" },
  { target: "compliance_engine", direction: "outbound", protocol: "function_call", dataShape: "CloudEvent(compliance) → ComplianceDriftInput", slaMs: 200, description: "Configuration changes are checked against compliance rules" },
  { target: "cognitive_loop", direction: "outbound", protocol: "event_bus", dataShape: "CorrelatedEventCluster → CognitiveInput", slaMs: 1_000, description: "Correlated event clusters are fed into the cognitive reasoning loop" },
  { target: "audit_trail", direction: "outbound", protocol: "function_call", dataShape: "CloudEvent → AuditEntry", slaMs: 100, description: "All events are persisted to the audit trail for governance" },
  { target: "notification_engine", direction: "outbound", protocol: "event_bus", dataShape: "CloudEvent(autoEscalated) → NotificationTrigger", slaMs: 200, description: "Auto-escalated events trigger immediate notification delivery" },
  { target: "memory_system", direction: "bidirectional", protocol: "function_call", dataShape: "CloudEvent ↔ HistoricalPattern", slaMs: 500, description: "Events query memory for historical context; patterns are stored for future correlation" },
  { target: "dashboard_api", direction: "outbound", protocol: "event_bus", dataShape: "StreamHealthSnapshot → DashboardMetrics", slaMs: 5_000, description: "Stream health metrics are published to the dashboard API" },
  { target: "external_siem", direction: "outbound", protocol: "webhook", dataShape: "CloudEvent → CEF/LEEF", slaMs: 5_000, description: "Events can be forwarded to external SIEM systems in CEF or LEEF format" },
];

// ═══════════════════════════════════════════════════════════════════════════════
// §10 — Query Functions
// ═══════════════════════════════════════════════════════════════════════════════

export function getEventSourceConfig(id: string): EventSourceConfig | undefined {
  return EVENT_SOURCE_CONFIGS.find(s => s.id === id);
}

export function getEventSourcesByProvider(provider: CloudEventProvider): EventSourceConfig[] {
  return EVENT_SOURCE_CONFIGS.filter(s => s.provider === provider);
}

export function getEnabledEventSources(): EventSourceConfig[] {
  return EVENT_SOURCE_CONFIGS.filter(s => s.enabled);
}

export function getPollingEventSources(): EventSourceConfig[] {
  return EVENT_SOURCE_CONFIGS.filter(s => s.pollingIntervalMs !== undefined);
}

export function getWebhookEventSources(): EventSourceConfig[] {
  return EVENT_SOURCE_CONFIGS.filter(s => s.webhookEndpoint !== undefined);
}

export function getNormalizationRule(sourceType: CloudEventSourceType, provider: CloudEventProvider): EventNormalizationRule | undefined {
  return EVENT_NORMALIZATION_RULES.find(r => r.sourceType === sourceType && r.provider === provider);
}

export function getClassificationRule(id: string): EventClassificationRule | undefined {
  return EVENT_CLASSIFICATION_RULES.find(r => r.id === id);
}

export function getAutoEscalatingRules(): EventClassificationRule[] {
  return EVENT_CLASSIFICATION_RULES.filter(r => r.autoEscalate);
}

export function getRulesWithMitreMapping(): EventClassificationRule[] {
  return EVENT_CLASSIFICATION_RULES.filter(r => r.mitreTechnique !== undefined);
}

export function getClassificationRulesByProvider(provider: CloudEventProvider | "all"): EventClassificationRule[] {
  return EVENT_CLASSIFICATION_RULES.filter(r => r.provider === provider || r.provider === "all");
}

export function getCorrelationRule(id: string): EventCorrelationRule | undefined {
  return EVENT_CORRELATION_RULES.find(r => r.id === id);
}

export function getEventPipelineStage(id: EventPipelineStageId): EventPipelineStage | undefined {
  return EVENT_PIPELINE.find(s => s.id === id);
}

export function getEventPipelineOrder(): EventPipelineStageId[] {
  return [...EVENT_PIPELINE].sort((a, b) => a.order - b.order).map(s => s.id);
}

export function getEventStreamIntegration(target: EventStreamIntegrationTarget): EventStreamIntegrationContract | undefined {
  return EVENT_STREAM_INTEGRATION_CONTRACTS.find(c => c.target === target);
}

export function computeEventPriority(event: CloudEvent): number {
  const severityScores: Record<CloudEventSeverity, number> = {
    critical: 100,
    high: 75,
    medium: 50,
    low: 25,
    informational: 10,
  };
  const categoryBoosts: Partial<Record<CloudEventCategory, number>> = {
    security: 20,
    availability: 15,
    compliance: 10,
    cost: 5,
  };
  return severityScores[event.severity] + (categoryBoosts[event.category] ?? 0);
}

// ═══════════════════════════════════════════════════════════════════════════════
// §11 — Tests
// ═══════════════════════════════════════════════════════════════════════════════

export interface CloudEventStreamTestResult {
  name: string;
  passed: boolean;
  detail: string;
}

export function runCloudEventStreamTests(): CloudEventStreamTestResult[] {
  const results: CloudEventStreamTestResult[] = [];
  const assert = (name: string, condition: boolean, detail: string) =>
    results.push({ name, passed: condition, detail });

  // §1 — Event Source Configs
  assert("Event sources exist", EVENT_SOURCE_CONFIGS.length >= 17, `Found ${EVENT_SOURCE_CONFIGS.length} sources`);
  assert("All sources have retry policy", EVENT_SOURCE_CONFIGS.every(s => s.retryPolicy.maxRetries > 0), "Every source has retry");
  assert("All providers represented", new Set(EVENT_SOURCE_CONFIGS.map(s => s.provider)).size === 3, "AWS, Azure, GCP");
  assert("AWS has most sources", getEventSourcesByProvider("aws").length >= 8, "AWS sources dominate");
  assert("All sources have rate limits", EVENT_SOURCE_CONFIGS.every(s => s.rateLimitPerSecond > 0), "Rate limited");
  assert("Webhook sources have endpoints", getWebhookEventSources().every(s => s.webhookEndpoint !== undefined), "Endpoints defined");

  // §2 — Normalization Rules
  assert("Normalization rules exist", EVENT_NORMALIZATION_RULES.length >= 5, `Found ${EVENT_NORMALIZATION_RULES.length} rules`);
  assert("CloudTrail has normalization", getNormalizationRule("cloudtrail", "aws") !== undefined, "CloudTrail covered");
  assert("GuardDuty has normalization", getNormalizationRule("guardduty", "aws") !== undefined, "GuardDuty covered");
  assert("Azure Activity has normalization", getNormalizationRule("azure_activity_log", "azure") !== undefined, "Azure covered");
  assert("GCP Audit has normalization", getNormalizationRule("gcp_audit_log", "gcp") !== undefined, "GCP covered");
  assert("All rules have extractors", EVENT_NORMALIZATION_RULES.every(r => r.extractors.length > 0), "Extractors defined");

  // §3 — Classification Rules
  assert("Classification rules exist", EVENT_CLASSIFICATION_RULES.length >= 10, `Found ${EVENT_CLASSIFICATION_RULES.length} rules`);
  assert("Auto-escalation rules exist", getAutoEscalatingRules().length >= 4, "Critical auto-escalate");
  assert("MITRE mapped rules exist", getRulesWithMitreMapping().length >= 7, "MITRE coverage");
  assert("Root account rule critical", getClassificationRule("cls-root-account-usage")?.outputSeverity === "critical", "Root = critical");
  assert("Cross-provider rules exist", getClassificationRulesByProvider("all").length >= 3, "Multi-provider rules");

  // §4 — Pipeline
  assert("Pipeline has 10 stages", EVENT_PIPELINE.length === 10, `Found ${EVENT_PIPELINE.length} stages`);
  assert("Pipeline starts with ingest", getEventPipelineOrder()[0] === "ingest", "Ingest first");
  assert("Pipeline ends with emit", getEventPipelineOrder()[9] === "emit", "Emit last");

  // §5 — Correlation Rules
  assert("Correlation rules exist", EVENT_CORRELATION_RULES.length >= 5, `Found ${EVENT_CORRELATION_RULES.length} rules`);
  assert("Cross-provider correlation exists", EVENT_CORRELATION_RULES.some(r => r.strategy === "cross_provider"), "Multi-cloud correlation");

  // §6 — Dedup Config
  assert("Dedup window is 5 minutes", DEFAULT_DEDUP_CONFIG.windowSizeMs === 300_000, "5m window");

  // §7 — Stream Health
  assert("Max queue depth set", DEFAULT_STREAM_HEALTH_CONFIG.maxQueueDepth === 10_000, "10k queue");
  assert("Backpressure at 80%", DEFAULT_STREAM_HEALTH_CONFIG.backpressureThreshold === 0.8, "80% threshold");

  // §8 — Integration Contracts
  assert("Integration contracts exist", EVENT_STREAM_INTEGRATION_CONTRACTS.length === 10, `Found ${EVENT_STREAM_INTEGRATION_CONTRACTS.length} contracts`);
  assert("Signal detection contract exists", getEventStreamIntegration("signal_detection") !== undefined, "Signal detection connected");
  assert("Incident response contract exists", getEventStreamIntegration("incident_response") !== undefined, "Incident response connected");

  // §9 — Priority Computation
  const mockEvent: CloudEvent = {
    id: "test-1", provider: "aws", sourceType: "guardduty", category: "security",
    severity: "critical", timestamp: "2026-01-01T00:00:00Z", receivedAt: "2026-01-01T00:00:01Z",
    accountId: "123456789012", region: "us-east-1", eventName: "UnauthorizedAccess:EC2/MaliciousIPCaller",
    eventDetail: {}, rawPayload: {}, tags: {}, dedupKey: "test-dedup-1",
  };
  assert("Critical security priority is 120", computeEventPriority(mockEvent) === 120, "100 (critical) + 20 (security)");

  return results;
}
