// ─────────────────────────────────────────────────────────────────────────────
// Incident Response Engine
// Automated incident lifecycle: detect → classify → contain → remediate →
// verify → review — with human escalation, blast radius awareness, and
// post-incident learning
// ─────────────────────────────────────────────────────────────────────────────

// ═══════════════════════════════════════════════════════════════════════════════
// §1 — Incident Architecture
// ═══════════════════════════════════════════════════════════════════════════════

export type IncidentSeverityLevel = "sev1" | "sev2" | "sev3" | "sev4" | "sev5";

export type IncidentCategory =
  | "availability"
  | "performance_degradation"
  | "security_breach"
  | "data_integrity"
  | "cost_anomaly"
  | "compliance_violation"
  | "configuration_drift"
  | "capacity_exhaustion"
  | "network_disruption"
  | "iam_compromise"
  | "dependency_failure"
  | "cascading_failure";

export type IncidentPhase =
  | "detected"
  | "classifying"
  | "classified"
  | "containing"
  | "contained"
  | "investigating"
  | "remediating"
  | "remediated"
  | "verifying"
  | "verified"
  | "monitoring_post_fix"
  | "reviewing"
  | "closed"
  | "escalated";

export interface Incident {
  id: string;
  orgId: string;
  title: string;
  description: string;
  severityLevel: IncidentSeverityLevel;
  category: IncidentCategory;
  phase: IncidentPhase;
  provider: "aws" | "azure" | "gcp" | "multi";
  region: string;
  environment: string;
  triggeringSignalIds: string[];
  correlatedSignalIds: string[];
  affectedResources: AffectedResource[];
  affectedServices: string[];
  impactAssessment: ImpactAssessment;
  timeline: IncidentTimelineEntry[];
  assignedTo: IncidentAssignment;
  containmentActions: ContainmentAction[];
  remediationPlan: RemediationPlan | null;
  verificationChecks: VerificationCheck[];
  postIncidentReview: PostIncidentReview | null;
  createdAt: string;
  detectedAt: string;
  containedAt: string | null;
  resolvedAt: string | null;
  closedAt: string | null;
  ttlMs: number;
  metadata: Record<string, unknown>;
}

export interface AffectedResource {
  resourceId: string;
  resourceType: string;
  provider: "aws" | "azure" | "gcp";
  region: string;
  impactType: "primary" | "downstream" | "potential";
  currentState: "degraded" | "unavailable" | "misconfigured" | "compromised" | "unknown";
}

export interface ImpactAssessment {
  userImpact: UserImpactLevel;
  serviceImpact: ServiceImpactLevel;
  dataImpact: DataImpactLevel;
  financialImpact: FinancialImpactEstimate;
  blastRadius: IncidentBlastRadius;
  estimatedRecoveryTimeMs: number;
  confidenceInAssessment: number;
}

export type UserImpactLevel = "none" | "minor" | "moderate" | "major" | "total";
export type ServiceImpactLevel = "healthy" | "degraded" | "partial_outage" | "major_outage" | "total_outage";
export type DataImpactLevel = "none" | "stale" | "inconsistent" | "corrupted" | "lost";

export interface FinancialImpactEstimate {
  estimatedCostPerHour: number;
  estimatedRevenueLossPerHour: number;
  remediationCost: number;
  currency: "USD";
}

export interface IncidentBlastRadius {
  directlyAffected: number;
  indirectlyAffected: number;
  potentiallyAffected: number;
  affectedTeams: string[];
  affectedRegions: string[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// §2 — Incident Classification
// ═══════════════════════════════════════════════════════════════════════════════

export interface ClassificationRule {
  id: string;
  name: string;
  description: string;
  conditions: ClassificationCondition[];
  resultSeverity: IncidentSeverityLevel;
  resultCategory: IncidentCategory;
  confidence: number;
  autoClassify: boolean;
}

export interface ClassificationCondition {
  field: "signal_domain" | "signal_severity" | "signal_count" | "affected_resources" | "affected_services" | "environment" | "provider" | "error_rate" | "latency_p99" | "availability";
  operator: "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "in" | "contains";
  value: unknown;
}

export const CLASSIFICATION_RULES: ClassificationRule[] = [
  {
    id: "sev1-total-outage",
    name: "SEV1 Total Service Outage",
    description: "Complete service unavailability in production",
    conditions: [
      { field: "environment", operator: "eq", value: "production" },
      { field: "availability", operator: "lt", value: 1 },
      { field: "affected_services", operator: "gte", value: 1 },
    ],
    resultSeverity: "sev1",
    resultCategory: "availability",
    confidence: 0.95,
    autoClassify: true,
  },
  {
    id: "sev1-security-breach",
    name: "SEV1 Active Security Breach",
    description: "Confirmed unauthorized access or data exfiltration",
    conditions: [
      { field: "signal_domain", operator: "in", value: ["security", "iam"] },
      { field: "signal_severity", operator: "eq", value: "critical" },
      { field: "signal_count", operator: "gte", value: 3 },
    ],
    resultSeverity: "sev1",
    resultCategory: "security_breach",
    confidence: 0.90,
    autoClassify: true,
  },
  {
    id: "sev1-data-loss",
    name: "SEV1 Data Loss or Corruption",
    description: "Confirmed data loss or integrity compromise",
    conditions: [
      { field: "signal_domain", operator: "eq", value: "data" },
      { field: "signal_severity", operator: "eq", value: "critical" },
    ],
    resultSeverity: "sev1",
    resultCategory: "data_integrity",
    confidence: 0.85,
    autoClassify: false,
  },
  {
    id: "sev2-major-degradation",
    name: "SEV2 Major Performance Degradation",
    description: "Significant performance impact affecting many users",
    conditions: [
      { field: "environment", operator: "eq", value: "production" },
      { field: "error_rate", operator: "gt", value: 10 },
      { field: "latency_p99", operator: "gt", value: 5000 },
    ],
    resultSeverity: "sev2",
    resultCategory: "performance_degradation",
    confidence: 0.85,
    autoClassify: true,
  },
  {
    id: "sev2-partial-outage",
    name: "SEV2 Partial Service Outage",
    description: "Some service functionality unavailable",
    conditions: [
      { field: "environment", operator: "eq", value: "production" },
      { field: "availability", operator: "lt", value: 90 },
      { field: "availability", operator: "gte", value: 1 },
    ],
    resultSeverity: "sev2",
    resultCategory: "availability",
    confidence: 0.85,
    autoClassify: true,
  },
  {
    id: "sev2-cascading",
    name: "SEV2 Cascading Failure",
    description: "Failure propagating across dependent services",
    conditions: [
      { field: "affected_services", operator: "gte", value: 3 },
      { field: "signal_count", operator: "gte", value: 5 },
    ],
    resultSeverity: "sev2",
    resultCategory: "cascading_failure",
    confidence: 0.80,
    autoClassify: true,
  },
  {
    id: "sev3-capacity-warning",
    name: "SEV3 Capacity Exhaustion Warning",
    description: "Resources approaching capacity limits",
    conditions: [
      { field: "signal_domain", operator: "eq", value: "capacity" },
      { field: "signal_severity", operator: "in", value: ["high", "critical"] },
    ],
    resultSeverity: "sev3",
    resultCategory: "capacity_exhaustion",
    confidence: 0.80,
    autoClassify: true,
  },
  {
    id: "sev3-compliance-drift",
    name: "SEV3 Compliance Violation Detected",
    description: "Resource drifted out of compliance",
    conditions: [
      { field: "signal_domain", operator: "eq", value: "compliance" },
      { field: "signal_severity", operator: "in", value: ["high", "critical"] },
    ],
    resultSeverity: "sev3",
    resultCategory: "compliance_violation",
    confidence: 0.85,
    autoClassify: true,
  },
  {
    id: "sev3-cost-anomaly",
    name: "SEV3 Significant Cost Anomaly",
    description: "Unexpected cost spike exceeding thresholds",
    conditions: [
      { field: "signal_domain", operator: "eq", value: "cost" },
      { field: "signal_severity", operator: "in", value: ["high", "critical"] },
    ],
    resultSeverity: "sev3",
    resultCategory: "cost_anomaly",
    confidence: 0.75,
    autoClassify: true,
  },
  {
    id: "sev4-config-drift",
    name: "SEV4 Configuration Drift",
    description: "Non-critical configuration drift detected",
    conditions: [
      { field: "signal_domain", operator: "eq", value: "drift" },
      { field: "signal_severity", operator: "in", value: ["medium", "low"] },
    ],
    resultSeverity: "sev4",
    resultCategory: "configuration_drift",
    confidence: 0.80,
    autoClassify: true,
  },
  {
    id: "sev5-informational",
    name: "SEV5 Informational Alert",
    description: "Low-priority operational awareness signal",
    conditions: [
      { field: "signal_severity", operator: "in", value: ["info", "low"] },
    ],
    resultSeverity: "sev5",
    resultCategory: "configuration_drift",
    confidence: 0.70,
    autoClassify: true,
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// §3 — Severity Definitions & SLA
// ═══════════════════════════════════════════════════════════════════════════════

export interface SeverityDefinition {
  level: IncidentSeverityLevel;
  name: string;
  description: string;
  responseTimeSlaMs: number;
  updateFrequencyMs: number;
  containmentTargetMs: number;
  resolutionTargetMs: number;
  escalationAfterMs: number;
  notificationChannels: string[];
  requiresHumanLead: boolean;
  autonomousRemediationAllowed: boolean;
  maxAutonomousBlastRadius: "minimal" | "low" | "moderate" | "none";
  pageOnCall: boolean;
}

export const SEVERITY_DEFINITIONS: SeverityDefinition[] = [
  {
    level: "sev1",
    name: "Critical",
    description: "Total service outage, active security breach, or confirmed data loss",
    responseTimeSlaMs: 300_000,
    updateFrequencyMs: 900_000,
    containmentTargetMs: 1_800_000,
    resolutionTargetMs: 14_400_000,
    escalationAfterMs: 600_000,
    notificationChannels: ["pagerduty", "slack_critical", "email_oncall", "sms_oncall"],
    requiresHumanLead: true,
    autonomousRemediationAllowed: false,
    maxAutonomousBlastRadius: "none",
    pageOnCall: true,
  },
  {
    level: "sev2",
    name: "Major",
    description: "Significant degradation, partial outage, or cascading failure",
    responseTimeSlaMs: 900_000,
    updateFrequencyMs: 1_800_000,
    containmentTargetMs: 3_600_000,
    resolutionTargetMs: 28_800_000,
    escalationAfterMs: 1_800_000,
    notificationChannels: ["slack_urgent", "email_oncall"],
    requiresHumanLead: true,
    autonomousRemediationAllowed: true,
    maxAutonomousBlastRadius: "minimal",
    pageOnCall: true,
  },
  {
    level: "sev3",
    name: "Moderate",
    description: "Limited impact, capacity warning, compliance drift, cost anomaly",
    responseTimeSlaMs: 3_600_000,
    updateFrequencyMs: 7_200_000,
    containmentTargetMs: 14_400_000,
    resolutionTargetMs: 86_400_000,
    escalationAfterMs: 7_200_000,
    notificationChannels: ["slack_ops", "email_team"],
    requiresHumanLead: false,
    autonomousRemediationAllowed: true,
    maxAutonomousBlastRadius: "low",
    pageOnCall: false,
  },
  {
    level: "sev4",
    name: "Low",
    description: "Minor issue, non-critical drift, optimization opportunity",
    responseTimeSlaMs: 86_400_000,
    updateFrequencyMs: 86_400_000,
    containmentTargetMs: 172_800_000,
    resolutionTargetMs: 604_800_000,
    escalationAfterMs: 172_800_000,
    notificationChannels: ["slack_ops"],
    requiresHumanLead: false,
    autonomousRemediationAllowed: true,
    maxAutonomousBlastRadius: "low",
    pageOnCall: false,
  },
  {
    level: "sev5",
    name: "Informational",
    description: "Awareness only, no immediate action required",
    responseTimeSlaMs: 604_800_000,
    updateFrequencyMs: 604_800_000,
    containmentTargetMs: 0,
    resolutionTargetMs: 2_592_000_000,
    escalationAfterMs: 0,
    notificationChannels: [],
    requiresHumanLead: false,
    autonomousRemediationAllowed: true,
    maxAutonomousBlastRadius: "moderate",
    pageOnCall: false,
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// §4 — Containment Strategies
// ═══════════════════════════════════════════════════════════════════════════════

export type ContainmentStrategy =
  | "isolate_resource"
  | "traffic_divert"
  | "scale_replacement"
  | "disable_endpoint"
  | "revoke_credentials"
  | "enable_waf_rule"
  | "throttle_traffic"
  | "failover"
  | "snapshot_and_isolate"
  | "quarantine_network"
  | "no_action";

export interface ContainmentAction {
  id: string;
  strategy: ContainmentStrategy;
  description: string;
  targetResourceIds: string[];
  executedAt: string | null;
  completedAt: string | null;
  executedBy: "autonomous" | "human";
  success: boolean | null;
  rollbackAvailable: boolean;
  rollbackAction: string | null;
  sideEffects: string[];
}

export interface ContainmentPlaybook {
  id: string;
  name: string;
  description: string;
  applicableCategories: IncidentCategory[];
  applicableProviders: ("aws" | "azure" | "gcp" | "any")[];
  steps: ContainmentStep[];
  estimatedDurationMs: number;
  riskLevel: "low" | "medium" | "high";
  autonomousExecutionAllowed: boolean;
  requiredApprovals: string[];
  rollbackPlaybookId: string | null;
}

export interface ContainmentStep {
  order: number;
  strategy: ContainmentStrategy;
  description: string;
  targetSelector: string;
  timeoutMs: number;
  continueOnFailure: boolean;
  verificationCheck: string | null;
}

export const CONTAINMENT_PLAYBOOKS: ContainmentPlaybook[] = [
  {
    id: "contain-security-breach-aws",
    name: "AWS Security Breach Containment",
    description: "Isolate compromised resources, revoke credentials, enable WAF rules",
    applicableCategories: ["security_breach", "iam_compromise"],
    applicableProviders: ["aws"],
    steps: [
      { order: 1, strategy: "revoke_credentials", description: "Rotate and revoke compromised IAM credentials", targetSelector: "compromised_iam_entities", timeoutMs: 60_000, continueOnFailure: false, verificationCheck: "verify_credentials_revoked" },
      { order: 2, strategy: "quarantine_network", description: "Apply restrictive security group to isolate affected resources", targetSelector: "compromised_resources", timeoutMs: 30_000, continueOnFailure: false, verificationCheck: "verify_network_isolated" },
      { order: 3, strategy: "snapshot_and_isolate", description: "Snapshot compromised instances for forensics", targetSelector: "compromised_ec2_instances", timeoutMs: 300_000, continueOnFailure: true, verificationCheck: "verify_snapshot_created" },
      { order: 4, strategy: "enable_waf_rule", description: "Enable WAF rules to block attack vectors", targetSelector: "public_endpoints", timeoutMs: 30_000, continueOnFailure: true, verificationCheck: null },
    ],
    estimatedDurationMs: 420_000,
    riskLevel: "high",
    autonomousExecutionAllowed: false,
    requiredApprovals: ["security_admin", "org_admin"],
    rollbackPlaybookId: "rollback-security-containment",
  },
  {
    id: "contain-availability-outage",
    name: "Service Availability Containment",
    description: "Failover traffic, scale replacements, isolate unhealthy instances",
    applicableCategories: ["availability", "cascading_failure"],
    applicableProviders: ["aws", "azure", "gcp", "any"],
    steps: [
      { order: 1, strategy: "traffic_divert", description: "Divert traffic from unhealthy targets", targetSelector: "unhealthy_targets", timeoutMs: 60_000, continueOnFailure: false, verificationCheck: "verify_traffic_diverted" },
      { order: 2, strategy: "failover", description: "Activate standby/failover resources", targetSelector: "failover_targets", timeoutMs: 120_000, continueOnFailure: false, verificationCheck: "verify_failover_active" },
      { order: 3, strategy: "scale_replacement", description: "Scale up healthy replacement instances", targetSelector: "auto_scaling_groups", timeoutMs: 300_000, continueOnFailure: true, verificationCheck: "verify_capacity_restored" },
      { order: 4, strategy: "isolate_resource", description: "Isolate unhealthy instances for investigation", targetSelector: "unhealthy_instances", timeoutMs: 60_000, continueOnFailure: true, verificationCheck: null },
    ],
    estimatedDurationMs: 540_000,
    riskLevel: "medium",
    autonomousExecutionAllowed: true,
    requiredApprovals: [],
    rollbackPlaybookId: "rollback-availability-containment",
  },
  {
    id: "contain-performance-degradation",
    name: "Performance Degradation Containment",
    description: "Throttle traffic, scale resources, isolate slow components",
    applicableCategories: ["performance_degradation"],
    applicableProviders: ["aws", "azure", "gcp", "any"],
    steps: [
      { order: 1, strategy: "throttle_traffic", description: "Enable rate limiting to reduce load", targetSelector: "overloaded_endpoints", timeoutMs: 30_000, continueOnFailure: true, verificationCheck: "verify_throttling_active" },
      { order: 2, strategy: "scale_replacement", description: "Scale up to increase capacity", targetSelector: "auto_scaling_groups", timeoutMs: 300_000, continueOnFailure: false, verificationCheck: "verify_capacity_increased" },
      { order: 3, strategy: "isolate_resource", description: "Isolate degraded components", targetSelector: "degraded_resources", timeoutMs: 60_000, continueOnFailure: true, verificationCheck: null },
    ],
    estimatedDurationMs: 390_000,
    riskLevel: "low",
    autonomousExecutionAllowed: true,
    requiredApprovals: [],
    rollbackPlaybookId: null,
  },
  {
    id: "contain-capacity-exhaustion",
    name: "Capacity Exhaustion Containment",
    description: "Scale resources, cleanup unused, throttle non-critical workloads",
    applicableCategories: ["capacity_exhaustion"],
    applicableProviders: ["aws", "azure", "gcp", "any"],
    steps: [
      { order: 1, strategy: "scale_replacement", description: "Scale up exhausted resources", targetSelector: "capacity_constrained", timeoutMs: 300_000, continueOnFailure: false, verificationCheck: "verify_capacity_available" },
      { order: 2, strategy: "throttle_traffic", description: "Throttle non-critical traffic", targetSelector: "non_critical_endpoints", timeoutMs: 30_000, continueOnFailure: true, verificationCheck: null },
    ],
    estimatedDurationMs: 330_000,
    riskLevel: "low",
    autonomousExecutionAllowed: true,
    requiredApprovals: [],
    rollbackPlaybookId: null,
  },
  {
    id: "contain-cost-anomaly",
    name: "Cost Anomaly Containment",
    description: "Identify and stop runaway cost sources",
    applicableCategories: ["cost_anomaly"],
    applicableProviders: ["aws", "azure", "gcp", "any"],
    steps: [
      { order: 1, strategy: "throttle_traffic", description: "Rate-limit expensive API calls", targetSelector: "high_cost_endpoints", timeoutMs: 30_000, continueOnFailure: true, verificationCheck: null },
      { order: 2, strategy: "isolate_resource", description: "Stop or isolate runaway resources", targetSelector: "cost_anomaly_resources", timeoutMs: 60_000, continueOnFailure: false, verificationCheck: "verify_cost_trend_declining" },
    ],
    estimatedDurationMs: 90_000,
    riskLevel: "medium",
    autonomousExecutionAllowed: false,
    requiredApprovals: ["org_admin"],
    rollbackPlaybookId: null,
  },
  {
    id: "contain-compliance-violation",
    name: "Compliance Violation Containment",
    description: "Remediate compliance drift immediately",
    applicableCategories: ["compliance_violation"],
    applicableProviders: ["aws", "azure", "gcp", "any"],
    steps: [
      { order: 1, strategy: "no_action", description: "Log violation and prepare remediation plan", targetSelector: "non_compliant_resources", timeoutMs: 10_000, continueOnFailure: false, verificationCheck: null },
    ],
    estimatedDurationMs: 10_000,
    riskLevel: "low",
    autonomousExecutionAllowed: true,
    requiredApprovals: [],
    rollbackPlaybookId: null,
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// §5 — Remediation Plans
// ═══════════════════════════════════════════════════════════════════════════════

export interface RemediationPlan {
  id: string;
  incidentId: string;
  strategy: RemediationStrategy;
  steps: RemediationStep[];
  estimatedDurationMs: number;
  estimatedCost: number;
  blastRadius: "minimal" | "low" | "moderate" | "high";
  approvalRequired: boolean;
  approvedBy: string[];
  rollbackPlanId: string | null;
  status: RemediationStatus;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

export type RemediationStrategy =
  | "automated_fix"
  | "terraform_change"
  | "config_restoration"
  | "credential_rotation"
  | "scaling_adjustment"
  | "failover_activation"
  | "backup_restoration"
  | "manual_intervention"
  | "vendor_engagement";

export type RemediationStatus = "planned" | "approved" | "executing" | "completed" | "failed" | "rolled_back" | "cancelled";

export interface RemediationStep {
  id: string;
  order: number;
  description: string;
  actionType: "automated" | "manual" | "approval_gate";
  targetResources: string[];
  estimatedDurationMs: number;
  timeoutMs: number;
  requiresApproval: boolean;
  rollbackOnFailure: boolean;
  verificationCheck: string | null;
  status: RemediationStatus;
}

// ═══════════════════════════════════════════════════════════════════════════════
// §6 — Incident Timeline
// ═══════════════════════════════════════════════════════════════════════════════

export type IncidentTimelineEventType =
  | "detected"
  | "classified"
  | "assigned"
  | "escalated"
  | "containment_started"
  | "containment_completed"
  | "containment_failed"
  | "investigation_started"
  | "root_cause_identified"
  | "remediation_planned"
  | "remediation_approved"
  | "remediation_started"
  | "remediation_step_completed"
  | "remediation_completed"
  | "remediation_failed"
  | "verification_started"
  | "verification_passed"
  | "verification_failed"
  | "monitoring_started"
  | "all_clear"
  | "review_started"
  | "review_completed"
  | "closed"
  | "reopened"
  | "note_added"
  | "severity_changed"
  | "communication_sent";

export interface IncidentTimelineEntry {
  id: string;
  eventType: IncidentTimelineEventType;
  timestamp: string;
  actor: "system" | "human" | "autonomous";
  actorId: string | null;
  description: string;
  details: Record<string, unknown>;
  automated: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// §7 — Assignment & Escalation
// ═══════════════════════════════════════════════════════════════════════════════

export interface IncidentAssignment {
  primaryResponder: string | null;
  incidentCommander: string | null;
  supportTeams: string[];
  escalationLevel: number;
  assignedAt: string | null;
  lastEscalatedAt: string | null;
}

export interface EscalationPolicy {
  id: string;
  name: string;
  description: string;
  applicableSeverities: IncidentSeverityLevel[];
  levels: EscalationLevel[];
  maxEscalations: number;
  escalationCooldownMs: number;
}

export interface EscalationLevel {
  level: number;
  triggerAfterMs: number;
  notifyTargets: string[];
  notifyChannels: string[];
  requiresAcknowledgment: boolean;
  autoAssign: boolean;
}

export const DEFAULT_ESCALATION_POLICY: EscalationPolicy = {
  id: "default-escalation",
  name: "Default Escalation Policy",
  description: "Standard escalation path for all incident severities",
  applicableSeverities: ["sev1", "sev2", "sev3", "sev4", "sev5"],
  levels: [
    { level: 1, triggerAfterMs: 0, notifyTargets: ["on_call_primary"], notifyChannels: ["slack_ops"], requiresAcknowledgment: true, autoAssign: true },
    { level: 2, triggerAfterMs: 900_000, notifyTargets: ["on_call_secondary", "team_lead"], notifyChannels: ["slack_ops", "pagerduty"], requiresAcknowledgment: true, autoAssign: false },
    { level: 3, triggerAfterMs: 1_800_000, notifyTargets: ["engineering_manager", "org_admin"], notifyChannels: ["slack_critical", "pagerduty", "sms"], requiresAcknowledgment: true, autoAssign: false },
    { level: 4, triggerAfterMs: 3_600_000, notifyTargets: ["vp_engineering", "cto"], notifyChannels: ["slack_executive", "sms", "phone"], requiresAcknowledgment: false, autoAssign: false },
  ],
  maxEscalations: 4,
  escalationCooldownMs: 600_000,
};

// ═══════════════════════════════════════════════════════════════════════════════
// §8 — Verification & Recovery
// ═══════════════════════════════════════════════════════════════════════════════

export interface VerificationCheck {
  id: string;
  name: string;
  description: string;
  checkType: "health_check" | "metric_comparison" | "functional_test" | "state_validation" | "user_confirmation";
  target: string;
  expectedResult: unknown;
  actualResult: unknown | null;
  passed: boolean | null;
  executedAt: string | null;
  durationMs: number | null;
}

export interface RecoveryValidation {
  allChecksPassed: boolean;
  passedChecks: number;
  failedChecks: number;
  pendingChecks: number;
  metricsBackToBaseline: boolean;
  baselineComparisonPercent: number;
  stabilizationPeriodMs: number;
  monitoringDurationMs: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// §9 — Post-Incident Review (PIR)
// ═══════════════════════════════════════════════════════════════════════════════

export interface PostIncidentReview {
  id: string;
  incidentId: string;
  conductedAt: string;
  participants: string[];
  rootCause: RootCauseAnalysis;
  timeline: string;
  whatWorked: string[];
  whatDidNotWork: string[];
  actionItems: PostIncidentActionItem[];
  lessonsLearned: LessonLearned[];
  blameless: boolean;
  preventionRecommendations: PreventionRecommendation[];
}

export interface RootCauseAnalysis {
  primaryCause: string;
  contributingFactors: string[];
  triggerEvent: string;
  impactChain: string[];
  fiveWhys: string[];
  categoryTag: string;
}

export interface PostIncidentActionItem {
  id: string;
  description: string;
  assignedTo: string;
  priority: "critical" | "high" | "medium" | "low";
  dueDate: string;
  status: "open" | "in_progress" | "completed" | "cancelled";
  category: "prevention" | "detection" | "response" | "recovery" | "process";
}

export interface LessonLearned {
  id: string;
  lesson: string;
  applicableDomains: string[];
  memoryRecordId: string | null;
}

export interface PreventionRecommendation {
  id: string;
  description: string;
  category: "monitoring" | "architecture" | "process" | "tooling" | "training";
  estimatedEffort: "low" | "medium" | "high";
  estimatedImpact: "low" | "medium" | "high";
  automatable: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// §10 — Incident Response Pipeline
// ═══════════════════════════════════════════════════════════════════════════════

export type IncidentPipelineStageId =
  | "signal_intake"
  | "classification"
  | "severity_assignment"
  | "impact_assessment"
  | "assignment"
  | "notification"
  | "containment"
  | "investigation"
  | "remediation_planning"
  | "remediation_execution"
  | "verification"
  | "monitoring"
  | "review"
  | "closure"
  | "memory_recording";

export interface IncidentPipelineStage {
  id: IncidentPipelineStageId;
  name: string;
  description: string;
  order: number;
  required: boolean;
  timeoutMs: number;
  automatable: boolean;
  dependsOn: IncidentPipelineStageId[];
}

export const INCIDENT_PIPELINE: IncidentPipelineStage[] = [
  { id: "signal_intake", name: "Signal Intake", description: "Receive correlated signals that triggered the incident", order: 1, required: true, timeoutMs: 5_000, automatable: true, dependsOn: [] },
  { id: "classification", name: "Classification", description: "Classify incident category using rules", order: 2, required: true, timeoutMs: 10_000, automatable: true, dependsOn: ["signal_intake"] },
  { id: "severity_assignment", name: "Severity Assignment", description: "Assign severity level based on impact", order: 3, required: true, timeoutMs: 5_000, automatable: true, dependsOn: ["classification"] },
  { id: "impact_assessment", name: "Impact Assessment", description: "Assess user, service, data, and financial impact", order: 4, required: true, timeoutMs: 30_000, automatable: true, dependsOn: ["severity_assignment"] },
  { id: "assignment", name: "Assignment", description: "Assign responders per escalation policy", order: 5, required: true, timeoutMs: 5_000, automatable: true, dependsOn: ["severity_assignment"] },
  { id: "notification", name: "Notification", description: "Notify stakeholders per severity policy", order: 6, required: true, timeoutMs: 10_000, automatable: true, dependsOn: ["assignment"] },
  { id: "containment", name: "Containment", description: "Execute containment playbook to limit blast radius", order: 7, required: true, timeoutMs: 600_000, automatable: true, dependsOn: ["impact_assessment"] },
  { id: "investigation", name: "Investigation", description: "Investigate root cause using reasoning engine", order: 8, required: true, timeoutMs: 1_800_000, automatable: true, dependsOn: ["containment"] },
  { id: "remediation_planning", name: "Remediation Planning", description: "Generate remediation plan with safety analysis", order: 9, required: true, timeoutMs: 300_000, automatable: true, dependsOn: ["investigation"] },
  { id: "remediation_execution", name: "Remediation Execution", description: "Execute remediation through execution safety engine", order: 10, required: true, timeoutMs: 3_600_000, automatable: true, dependsOn: ["remediation_planning"] },
  { id: "verification", name: "Verification", description: "Verify remediation restored normal operation", order: 11, required: true, timeoutMs: 600_000, automatable: true, dependsOn: ["remediation_execution"] },
  { id: "monitoring", name: "Post-Fix Monitoring", description: "Monitor for regression during stabilization period", order: 12, required: true, timeoutMs: 0, automatable: true, dependsOn: ["verification"] },
  { id: "review", name: "Post-Incident Review", description: "Conduct blameless post-incident review", order: 13, required: true, timeoutMs: 0, automatable: false, dependsOn: ["monitoring"] },
  { id: "closure", name: "Closure", description: "Close incident and update status", order: 14, required: true, timeoutMs: 5_000, automatable: true, dependsOn: ["review"] },
  { id: "memory_recording", name: "Memory Recording", description: "Record incident in operational memory for learning", order: 15, required: true, timeoutMs: 10_000, automatable: true, dependsOn: ["closure"] },
];

// ═══════════════════════════════════════════════════════════════════════════════
// §11 — Incident Invariants
// ═══════════════════════════════════════════════════════════════════════════════

export interface IncidentInvariant {
  id: string;
  name: string;
  description: string;
  enforcedPhases: IncidentPhase[];
  violationAction: "block" | "escalate" | "alert";
}

export const INCIDENT_INVARIANTS: IncidentInvariant[] = [
  { id: "no-sev1-auto-remediate", name: "No SEV1 Autonomous Remediation", description: "SEV1 incidents must have human-led remediation", enforcedPhases: ["remediating"], violationAction: "block" },
  { id: "no-remediation-without-containment", name: "Containment Before Remediation", description: "Remediation cannot start until containment is achieved or explicitly bypassed", enforcedPhases: ["remediating"], violationAction: "block" },
  { id: "no-closure-without-verification", name: "Verify Before Close", description: "Incidents cannot close without passing verification checks", enforcedPhases: ["closed"], violationAction: "block" },
  { id: "no-closure-without-review-sev12", name: "Review Required for SEV1/SEV2", description: "SEV1 and SEV2 must have post-incident review before closure", enforcedPhases: ["closed"], violationAction: "block" },
  { id: "escalation-on-sla-breach", name: "Escalate on SLA Breach", description: "Automatic escalation when response or resolution SLA is breached", enforcedPhases: ["detected", "classifying", "classified", "containing", "investigating", "remediating"], violationAction: "escalate" },
  { id: "audit-trail-continuous", name: "Continuous Audit Trail", description: "Every phase transition must be recorded in timeline", enforcedPhases: ["detected", "classifying", "classified", "containing", "contained", "investigating", "remediating", "remediated", "verifying", "verified", "monitoring_post_fix", "reviewing", "closed", "escalated"], violationAction: "alert" },
  { id: "blameless-reviews", name: "Blameless Reviews Required", description: "Post-incident reviews must follow blameless methodology", enforcedPhases: ["reviewing"], violationAction: "alert" },
  { id: "blast-radius-respected", name: "Containment Blast Radius Respected", description: "Containment actions must not exceed incident blast radius", enforcedPhases: ["containing"], violationAction: "block" },
];

// ═══════════════════════════════════════════════════════════════════════════════
// §12 — Integration Contracts
// ═══════════════════════════════════════════════════════════════════════════════

export type IncidentIntegrationTarget =
  | "signal_detection"
  | "cognitive_loop"
  | "reasoning_engine"
  | "execution_safety"
  | "terraform_generation"
  | "monitoring_agent"
  | "memory_system"
  | "governance_engine"
  | "observability"
  | "notification_system";

export interface IncidentIntegrationContract {
  target: IncidentIntegrationTarget;
  direction: "consumes" | "produces" | "bidirectional";
  description: string;
  dataFlow: string;
}

export const INCIDENT_INTEGRATION_CONTRACTS: IncidentIntegrationContract[] = [
  { target: "signal_detection", direction: "consumes", description: "Receives correlated signals that trigger incidents", dataFlow: "CorrelatedSignals → IncidentCreation" },
  { target: "cognitive_loop", direction: "bidirectional", description: "Uses reasoning for investigation, feeds back lessons", dataFlow: "IncidentContext ↔ CognitiveReasoning" },
  { target: "reasoning_engine", direction: "consumes", description: "Uses causal reasoning for root cause analysis", dataFlow: "IncidentData → RootCauseHypothesis" },
  { target: "execution_safety", direction: "produces", description: "Submits remediation plans for safe execution", dataFlow: "RemediationPlan → ExecutionPipeline" },
  { target: "terraform_generation", direction: "produces", description: "Generates IaC changes for infrastructure remediation", dataFlow: "RemediationSpec → TerraformChangeSet" },
  { target: "monitoring_agent", direction: "bidirectional", description: "Configures post-fix monitoring, receives health data", dataFlow: "MonitorConfig ↔ HealthMetrics" },
  { target: "memory_system", direction: "produces", description: "Records incident for operational learning", dataFlow: "IncidentRecord → OperationalMemory" },
  { target: "governance_engine", direction: "consumes", description: "Validates containment and remediation against policies", dataFlow: "ActionPlan → GovernanceCheck" },
  { target: "observability", direction: "produces", description: "Emits incident lifecycle metrics and traces", dataFlow: "IncidentEvent → ObservabilityPipeline" },
  { target: "notification_system", direction: "produces", description: "Sends incident notifications per severity policy", dataFlow: "IncidentNotification → NotificationChannel" },
];

// ═══════════════════════════════════════════════════════════════════════════════
// §13 — Query Functions
// ═══════════════════════════════════════════════════════════════════════════════

export function getSeverityDefinition(level: IncidentSeverityLevel): SeverityDefinition | undefined {
  return SEVERITY_DEFINITIONS.find((d) => d.level === level);
}

export function getClassificationRule(id: string): ClassificationRule | undefined {
  return CLASSIFICATION_RULES.find((r) => r.id === id);
}

export function getAutoClassifiableRules(): ClassificationRule[] {
  return CLASSIFICATION_RULES.filter((r) => r.autoClassify);
}

export function getClassificationRulesBySeverity(severity: IncidentSeverityLevel): ClassificationRule[] {
  return CLASSIFICATION_RULES.filter((r) => r.resultSeverity === severity);
}

export function getContainmentPlaybook(id: string): ContainmentPlaybook | undefined {
  return CONTAINMENT_PLAYBOOKS.find((p) => p.id === id);
}

export function getPlaybooksForCategory(category: IncidentCategory): ContainmentPlaybook[] {
  return CONTAINMENT_PLAYBOOKS.filter((p) => p.applicableCategories.includes(category));
}

export function getAutonomousPlaybooks(): ContainmentPlaybook[] {
  return CONTAINMENT_PLAYBOOKS.filter((p) => p.autonomousExecutionAllowed);
}

export function getIncidentPipelineStage(id: IncidentPipelineStageId): IncidentPipelineStage | undefined {
  return INCIDENT_PIPELINE.find((s) => s.id === id);
}

export function getIncidentPipelineOrder(): IncidentPipelineStageId[] {
  return [...INCIDENT_PIPELINE].sort((a, b) => a.order - b.order).map((s) => s.id);
}

export function getIncidentInvariant(id: string): IncidentInvariant | undefined {
  return INCIDENT_INVARIANTS.find((i) => i.id === id);
}

export function getBlockingInvariants(): IncidentInvariant[] {
  return INCIDENT_INVARIANTS.filter((i) => i.violationAction === "block");
}

export function canAutonomouslyRemediate(severity: IncidentSeverityLevel): boolean {
  const def = getSeverityDefinition(severity);
  return def?.autonomousRemediationAllowed ?? false;
}

export function getResponseSla(severity: IncidentSeverityLevel): number {
  return getSeverityDefinition(severity)?.responseTimeSlaMs ?? 0;
}

export function getIncidentIntegration(target: IncidentIntegrationTarget): IncidentIntegrationContract | undefined {
  return INCIDENT_INTEGRATION_CONTRACTS.find((c) => c.target === target);
}

// ═══════════════════════════════════════════════════════════════════════════════
// §14 — Tests
// ═══════════════════════════════════════════════════════════════════════════════

export interface IncidentResponseTestResult {
  name: string;
  passed: boolean;
  message: string;
}

export function runIncidentResponseTests(): IncidentResponseTestResult[] {
  const results: IncidentResponseTestResult[] = [];
  const assert = (name: string, condition: boolean, msg: string) => {
    results.push({ name, passed: condition, message: condition ? "OK" : msg });
  };

  // §1 — Architecture
  assert("incident-categories-12", (["availability", "performance_degradation", "security_breach", "data_integrity", "cost_anomaly", "compliance_violation", "configuration_drift", "capacity_exhaustion", "network_disruption", "iam_compromise", "dependency_failure", "cascading_failure"] as IncidentCategory[]).length === 12, "Should have 12 incident categories");
  assert("incident-phases-14", (["detected", "classifying", "classified", "containing", "contained", "investigating", "remediating", "remediated", "verifying", "verified", "monitoring_post_fix", "reviewing", "closed", "escalated"] as IncidentPhase[]).length === 14, "Should have 14 incident phases");

  // §2 — Classification Rules
  assert("classification-rules-11", CLASSIFICATION_RULES.length === 11, "Should have 11 classification rules");
  assert("auto-classifiable", getAutoClassifiableRules().length >= 9, "Should have at least 9 auto-classifiable rules");
  assert("sev1-rules", getClassificationRulesBySeverity("sev1").length >= 2, "Should have at least 2 SEV1 rules");
  assert("rule-lookup", getClassificationRule("sev1-total-outage")?.resultCategory === "availability", "Total outage should classify as availability");

  // §3 — Severity Definitions
  assert("severity-definitions-5", SEVERITY_DEFINITIONS.length === 5, "Should have 5 severity definitions");
  assert("sev1-strictest", getSeverityDefinition("sev1")?.requiresHumanLead === true, "SEV1 should require human lead");
  assert("sev1-no-auto-remediate", !canAutonomouslyRemediate("sev1"), "SEV1 should not allow autonomous remediation");
  assert("sev3-auto-remediate", canAutonomouslyRemediate("sev3"), "SEV3 should allow autonomous remediation");
  assert("sev1-pages-oncall", getSeverityDefinition("sev1")?.pageOnCall === true, "SEV1 should page on-call");
  assert("sev5-no-page", getSeverityDefinition("sev5")?.pageOnCall === false, "SEV5 should not page");
  assert("sla-ordering", getResponseSla("sev1") < getResponseSla("sev2") && getResponseSla("sev2") < getResponseSla("sev3"), "SLAs should be stricter for higher severity");

  // §4 — Containment
  assert("containment-playbooks-6", CONTAINMENT_PLAYBOOKS.length === 6, "Should have 6 containment playbooks");
  assert("security-playbook-no-auto", getContainmentPlaybook("contain-security-breach-aws")?.autonomousExecutionAllowed === false, "Security breach should not allow autonomous execution");
  assert("availability-playbook-auto", getContainmentPlaybook("contain-availability-outage")?.autonomousExecutionAllowed === true, "Availability containment should allow autonomous execution");
  assert("autonomous-playbooks", getAutonomousPlaybooks().length >= 3, "Should have at least 3 autonomous playbooks");
  assert("playbooks-for-category", getPlaybooksForCategory("security_breach").length >= 1, "Should find playbooks for security breach");
  assert("all-playbooks-have-steps", CONTAINMENT_PLAYBOOKS.every((p) => p.steps.length > 0), "All playbooks should have steps");

  // §7 — Escalation
  assert("escalation-4-levels", DEFAULT_ESCALATION_POLICY.levels.length === 4, "Should have 4 escalation levels");
  assert("escalation-level1-immediate", DEFAULT_ESCALATION_POLICY.levels[0].triggerAfterMs === 0, "Level 1 should trigger immediately");

  // §10 — Pipeline
  assert("pipeline-15-stages", INCIDENT_PIPELINE.length === 15, "Should have 15 pipeline stages");
  assert("pipeline-ordered", INCIDENT_PIPELINE.every((s, i) => i === 0 || s.order >= INCIDENT_PIPELINE[i - 1].order), "Pipeline should be ordered");
  assert("signal-intake-first", getIncidentPipelineStage("signal_intake")?.order === 1, "Signal intake should be first");
  assert("memory-recording-last", getIncidentPipelineStage("memory_recording")?.order === 15, "Memory recording should be last");

  // §11 — Invariants
  assert("invariants-8", INCIDENT_INVARIANTS.length === 8, "Should have 8 invariants");
  assert("blocking-invariants", getBlockingInvariants().length >= 4, "Should have at least 4 blocking invariants");
  assert("no-sev1-auto", getIncidentInvariant("no-sev1-auto-remediate") !== undefined, "Must have no-SEV1-auto-remediate invariant");
  assert("containment-before-remediation", getIncidentInvariant("no-remediation-without-containment") !== undefined, "Must enforce containment before remediation");

  // §12 — Integration Contracts
  assert("integration-contracts-10", INCIDENT_INTEGRATION_CONTRACTS.length === 10, "Should have 10 integration contracts");
  assert("signal-integration", getIncidentIntegration("signal_detection")?.direction === "consumes", "Should consume from signal detection");
  assert("memory-integration", getIncidentIntegration("memory_system")?.direction === "produces", "Should produce to memory system");

  return results;
}
