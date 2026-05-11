/**
 * Axiom Agent — Disaster Recovery & Business Continuity
 *
 * Backup verification, failover management, DR testing, and RTO/RPO
 * tracking across AWS, Azure, and GCP. Ensures infrastructure can
 * survive regional failures, data corruption, and service outages.
 *
 * This is the "safety net" of Axiom — the final line of defense
 * that makes the system trustworthy for production workloads.
 */

// ═══════════════════════════════════════════════════════════════════════════════
// §1 — DR Architecture
// ═══════════════════════════════════════════════════════════════════════════════

export type DRTier = "tier1_mission_critical" | "tier2_business_critical" | "tier3_business_important" | "tier4_administrative";

export type DRStrategy = "pilot_light" | "warm_standby" | "multi_site_active" | "backup_restore" | "cold_standby";

export type FailoverType = "automatic" | "semi_automatic" | "manual";

export type DRTestStatus = "scheduled" | "in_progress" | "passed" | "failed" | "partial" | "cancelled";

export interface DRPlan {
  id: string;
  name: string;
  description: string;
  tier: DRTier;
  strategy: DRStrategy;
  provider: "aws" | "azure" | "gcp";
  primaryRegion: string;
  failoverRegion: string;
  rtoMinutes: number;
  rpoMinutes: number;
  failoverType: FailoverType;
  services: DRServiceConfig[];
  backupPolicies: BackupPolicy[];
  failoverRunbook: FailoverRunbookStep[];
  lastTestedAt?: string;
  lastTestResult?: DRTestStatus;
  nextTestDue?: string;
  owner: string;
  active: boolean;
}

export interface DRServiceConfig {
  serviceId: string;
  serviceName: string;
  tier: DRTier;
  rtoMinutes: number;
  rpoMinutes: number;
  failoverStrategy: DRStrategy;
  dependencies: string[];
  primaryResources: string[];
  failoverResources: string[];
  healthCheckEndpoint?: string;
  dataReplicationMethod: "synchronous" | "asynchronous" | "snapshot" | "none";
  replicationLagMaxSeconds: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// §2 — Backup Policies & Verification
// ═══════════════════════════════════════════════════════════════════════════════

export type BackupType = "full" | "incremental" | "differential" | "snapshot" | "continuous_replication";

export type BackupStatus = "healthy" | "stale" | "failed" | "missing" | "unverified";

export interface BackupPolicy {
  id: string;
  name: string;
  resourceType: string;
  provider: "aws" | "azure" | "gcp";
  backupType: BackupType;
  frequencyHours: number;
  retentionDays: number;
  crossRegionCopy: boolean;
  crossAccountCopy: boolean;
  encryptionRequired: boolean;
  verificationFrequencyDays: number;
  restoreTestFrequencyDays: number;
  description: string;
}

export const DEFAULT_BACKUP_POLICIES: BackupPolicy[] = [
  {
    id: "bp-rds-production",
    name: "RDS Production Backup",
    resourceType: "AWS::RDS::DBInstance",
    provider: "aws",
    backupType: "snapshot",
    frequencyHours: 24,
    retentionDays: 35,
    crossRegionCopy: true,
    crossAccountCopy: true,
    encryptionRequired: true,
    verificationFrequencyDays: 7,
    restoreTestFrequencyDays: 30,
    description: "Daily automated snapshots with cross-region copy for production databases",
  },
  {
    id: "bp-rds-staging",
    name: "RDS Staging Backup",
    resourceType: "AWS::RDS::DBInstance",
    provider: "aws",
    backupType: "snapshot",
    frequencyHours: 24,
    retentionDays: 7,
    crossRegionCopy: false,
    crossAccountCopy: false,
    encryptionRequired: true,
    verificationFrequencyDays: 30,
    restoreTestFrequencyDays: 90,
    description: "Daily snapshots for staging databases with minimal retention",
  },
  {
    id: "bp-s3-critical",
    name: "S3 Critical Data Backup",
    resourceType: "AWS::S3::Bucket",
    provider: "aws",
    backupType: "continuous_replication",
    frequencyHours: 0,
    retentionDays: 365,
    crossRegionCopy: true,
    crossAccountCopy: true,
    encryptionRequired: true,
    verificationFrequencyDays: 7,
    restoreTestFrequencyDays: 30,
    description: "Cross-region replication with versioning for critical data buckets",
  },
  {
    id: "bp-ebs-production",
    name: "EBS Production Backup",
    resourceType: "AWS::EC2::Volume",
    provider: "aws",
    backupType: "snapshot",
    frequencyHours: 12,
    retentionDays: 14,
    crossRegionCopy: true,
    crossAccountCopy: false,
    encryptionRequired: true,
    verificationFrequencyDays: 14,
    restoreTestFrequencyDays: 60,
    description: "Twice-daily EBS snapshots for production volumes",
  },
  {
    id: "bp-dynamodb",
    name: "DynamoDB Backup",
    resourceType: "AWS::DynamoDB::Table",
    provider: "aws",
    backupType: "continuous_replication",
    frequencyHours: 0,
    retentionDays: 35,
    crossRegionCopy: true,
    crossAccountCopy: false,
    encryptionRequired: true,
    verificationFrequencyDays: 7,
    restoreTestFrequencyDays: 30,
    description: "Point-in-time recovery with global table replication",
  },
  {
    id: "bp-azure-sql",
    name: "Azure SQL Database Backup",
    resourceType: "Microsoft.Sql/servers/databases",
    provider: "azure",
    backupType: "continuous_replication",
    frequencyHours: 0,
    retentionDays: 35,
    crossRegionCopy: true,
    crossAccountCopy: false,
    encryptionRequired: true,
    verificationFrequencyDays: 7,
    restoreTestFrequencyDays: 30,
    description: "Azure SQL geo-redundant backup with long-term retention",
  },
  {
    id: "bp-gcp-cloudsql",
    name: "Cloud SQL Backup",
    resourceType: "sqladmin.googleapis.com/Instance",
    provider: "gcp",
    backupType: "snapshot",
    frequencyHours: 24,
    retentionDays: 30,
    crossRegionCopy: true,
    crossAccountCopy: false,
    encryptionRequired: true,
    verificationFrequencyDays: 7,
    restoreTestFrequencyDays: 30,
    description: "Daily automated backups with cross-region copies for Cloud SQL",
  },
];

export interface BackupVerificationResult {
  policyId: string;
  resourceArn: string;
  verifiedAt: string;
  status: BackupStatus;
  lastBackupAt?: string;
  backupSizeBytes?: number;
  encryptionVerified: boolean;
  crossRegionVerified: boolean;
  restoreTestPassed?: boolean;
  restoreTimeSeconds?: number;
  issues: string[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// §3 — RTO/RPO Definitions
// ═══════════════════════════════════════════════════════════════════════════════

export interface RTORPOTarget {
  tier: DRTier;
  rtoMinutes: number;
  rpoMinutes: number;
  availabilityTarget: number;
  annualDowntimeMinutes: number;
  failoverType: FailoverType;
  testFrequencyDays: number;
  description: string;
}

export const RTO_RPO_TARGETS: RTORPOTarget[] = [
  { tier: "tier1_mission_critical", rtoMinutes: 15, rpoMinutes: 1, availabilityTarget: 99.99, annualDowntimeMinutes: 52, failoverType: "automatic", testFrequencyDays: 30, description: "Mission-critical services: near-zero downtime, sub-minute data loss" },
  { tier: "tier2_business_critical", rtoMinutes: 60, rpoMinutes: 15, availabilityTarget: 99.95, annualDowntimeMinutes: 263, failoverType: "semi_automatic", testFrequencyDays: 90, description: "Business-critical: 1h recovery, 15min max data loss" },
  { tier: "tier3_business_important", rtoMinutes: 240, rpoMinutes: 60, availabilityTarget: 99.9, annualDowntimeMinutes: 526, failoverType: "manual", testFrequencyDays: 180, description: "Business-important: 4h recovery, 1h max data loss" },
  { tier: "tier4_administrative", rtoMinutes: 1440, rpoMinutes: 1440, availabilityTarget: 99.0, annualDowntimeMinutes: 5256, failoverType: "manual", testFrequencyDays: 365, description: "Administrative: next business day recovery" },
];

// ═══════════════════════════════════════════════════════════════════════════════
// §4 — Failover Runbooks
// ═══════════════════════════════════════════════════════════════════════════════

export interface FailoverRunbookStep {
  order: number;
  name: string;
  description: string;
  automatable: boolean;
  estimatedMinutes: number;
  command?: string;
  verificationCheck: string;
  rollbackStep?: string;
  criticalPath: boolean;
}

export interface FailoverExecution {
  id: string;
  planId: string;
  triggeredAt: string;
  triggeredBy: "automatic" | "manual" | "test";
  reason: string;
  status: "initiated" | "in_progress" | "dns_switching" | "verification" | "completed" | "failed" | "rolled_back";
  currentStep: number;
  totalSteps: number;
  stepsCompleted: FailoverStepResult[];
  startedAt: string;
  completedAt?: string;
  actualRtoMinutes?: number;
  actualRpoMinutes?: number;
  dataLossAssessment?: string;
}

export interface FailoverStepResult {
  stepOrder: number;
  stepName: string;
  status: "completed" | "failed" | "skipped";
  startedAt: string;
  completedAt: string;
  durationSeconds: number;
  output?: string;
  error?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// §5 — DR Testing
// ═══════════════════════════════════════════════════════════════════════════════

export type DRTestType = "tabletop" | "walkthrough" | "simulation" | "parallel_recovery" | "full_failover";

export interface DRTest {
  id: string;
  planId: string;
  testType: DRTestType;
  scheduledAt: string;
  executedAt?: string;
  status: DRTestStatus;
  scope: string;
  participants: string[];
  objectives: string[];
  results: DRTestResult[];
  findings: DRTestFinding[];
  rtoAchieved?: number;
  rpoAchieved?: number;
  overallGrade: "A" | "B" | "C" | "D" | "F" | "pending";
  nextActions: string[];
}

export interface DRTestResult {
  objective: string;
  met: boolean;
  actualValue?: string;
  expectedValue?: string;
  notes: string;
}

export interface DRTestFinding {
  severity: "critical" | "high" | "medium" | "low";
  category: string;
  description: string;
  remediation: string;
  dueDate?: string;
  assignee?: string;
}

export const DR_TEST_SCHEDULE: Record<DRTier, { testType: DRTestType; frequencyDays: number }[]> = {
  tier1_mission_critical: [
    { testType: "tabletop", frequencyDays: 30 },
    { testType: "simulation", frequencyDays: 90 },
    { testType: "full_failover", frequencyDays: 180 },
  ],
  tier2_business_critical: [
    { testType: "tabletop", frequencyDays: 90 },
    { testType: "simulation", frequencyDays: 180 },
    { testType: "parallel_recovery", frequencyDays: 365 },
  ],
  tier3_business_important: [
    { testType: "tabletop", frequencyDays: 180 },
    { testType: "walkthrough", frequencyDays: 365 },
  ],
  tier4_administrative: [
    { testType: "tabletop", frequencyDays: 365 },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// §6 — DR Pipeline
// ═══════════════════════════════════════════════════════════════════════════════

export type DRPipelineStageId =
  | "assess_readiness"
  | "verify_backups"
  | "check_replication"
  | "validate_failover_targets"
  | "test_dns_failover"
  | "measure_rto_rpo"
  | "generate_report"
  | "schedule_next_test"
  | "update_dashboard";

export interface DRPipelineStage {
  id: DRPipelineStageId;
  name: string;
  order: number;
  timeoutMs: number;
  parallelizable: boolean;
  metricsKey: string;
  description: string;
}

export const DR_PIPELINE: DRPipelineStage[] = [
  { id: "assess_readiness", name: "Assess Readiness", order: 1, timeoutMs: 30_000, parallelizable: false, metricsKey: "dr_pipeline.readiness", description: "Evaluate overall DR readiness score" },
  { id: "verify_backups", name: "Verify Backups", order: 2, timeoutMs: 120_000, parallelizable: true, metricsKey: "dr_pipeline.backups", description: "Verify all backup policies are met and backups are restorable" },
  { id: "check_replication", name: "Check Replication", order: 3, timeoutMs: 60_000, parallelizable: true, metricsKey: "dr_pipeline.replication", description: "Verify data replication lag is within RPO targets" },
  { id: "validate_failover_targets", name: "Validate Targets", order: 4, timeoutMs: 60_000, parallelizable: true, metricsKey: "dr_pipeline.targets", description: "Confirm failover region resources are healthy and ready" },
  { id: "test_dns_failover", name: "Test DNS Failover", order: 5, timeoutMs: 30_000, parallelizable: false, metricsKey: "dr_pipeline.dns", description: "Verify DNS failover mechanisms work correctly" },
  { id: "measure_rto_rpo", name: "Measure RTO/RPO", order: 6, timeoutMs: 10_000, parallelizable: false, metricsKey: "dr_pipeline.metrics", description: "Calculate actual vs target RTO and RPO" },
  { id: "generate_report", name: "Generate Report", order: 7, timeoutMs: 10_000, parallelizable: false, metricsKey: "dr_pipeline.report", description: "Generate DR readiness report for stakeholders" },
  { id: "schedule_next_test", name: "Schedule Next Test", order: 8, timeoutMs: 5_000, parallelizable: false, metricsKey: "dr_pipeline.schedule", description: "Schedule next DR test based on tier requirements" },
  { id: "update_dashboard", name: "Update Dashboard", order: 9, timeoutMs: 5_000, parallelizable: false, metricsKey: "dr_pipeline.dashboard", description: "Push DR metrics and readiness scores to dashboard" },
];

// ═══════════════════════════════════════════════════════════════════════════════
// §7 — Integration Contracts
// ═══════════════════════════════════════════════════════════════════════════════

export type DRIntegrationTarget =
  | "cloud_event_stream"
  | "incident_response"
  | "change_management"
  | "notification_engine"
  | "compliance_engine"
  | "execution_safety"
  | "capacity_planning"
  | "audit_trail"
  | "cognitive_loop"
  | "dashboard_api";

export interface DRIntegrationContract {
  target: DRIntegrationTarget;
  direction: "inbound" | "outbound" | "bidirectional";
  protocol: "function_call" | "event_bus" | "webhook";
  dataShape: string;
  slaMs: number;
  description: string;
}

export const DR_INTEGRATION_CONTRACTS: DRIntegrationContract[] = [
  { target: "cloud_event_stream", direction: "inbound", protocol: "event_bus", dataShape: "CloudEvent(availability) → DRTrigger", slaMs: 100, description: "Regional failures and outage events trigger DR assessment" },
  { target: "incident_response", direction: "bidirectional", protocol: "function_call", dataShape: "IncidentSeverity1 ↔ FailoverExecution", slaMs: 500, description: "SEV1 incidents may trigger failover; failover status feeds incident timeline" },
  { target: "change_management", direction: "outbound", protocol: "function_call", dataShape: "FailoverAction → EmergencyChangeRequest", slaMs: 1_000, description: "Failover actions create emergency change requests for governance" },
  { target: "notification_engine", direction: "outbound", protocol: "event_bus", dataShape: "DREvent → CriticalNotification", slaMs: 50, description: "DR activations and test failures trigger immediate notifications" },
  { target: "compliance_engine", direction: "outbound", protocol: "function_call", dataShape: "DRTestResult → ComplianceEvidence", slaMs: 500, description: "DR test results serve as compliance evidence for audit readiness" },
  { target: "execution_safety", direction: "outbound", protocol: "function_call", dataShape: "FailoverPlan → SafetyValidation", slaMs: 2_000, description: "Failover plans are safety-validated before execution" },
  { target: "capacity_planning", direction: "outbound", protocol: "function_call", dataShape: "FailoverCapacity → CapacityCheck", slaMs: 1_000, description: "Verify failover region has sufficient capacity before activation" },
  { target: "audit_trail", direction: "outbound", protocol: "function_call", dataShape: "DREvent → AuditEntry", slaMs: 100, description: "All DR events, tests, and failovers are audited" },
  { target: "cognitive_loop", direction: "outbound", protocol: "function_call", dataShape: "DRReadiness → CognitiveContext", slaMs: 1_000, description: "DR readiness informs the cognitive loop's risk assessment" },
  { target: "dashboard_api", direction: "outbound", protocol: "event_bus", dataShape: "DRMetrics → DashboardData", slaMs: 5_000, description: "DR readiness scores, backup status, and test results on dashboard" },
];

// ═══════════════════════════════════════════════════════════════════════════════
// §8 — Query Functions
// ═══════════════════════════════════════════════════════════════════════════════

export function getRTORPOTarget(tier: DRTier): RTORPOTarget | undefined {
  return RTO_RPO_TARGETS.find(t => t.tier === tier);
}

export function getBackupPolicy(id: string): BackupPolicy | undefined {
  return DEFAULT_BACKUP_POLICIES.find(p => p.id === id);
}

export function getBackupPoliciesByProvider(provider: "aws" | "azure" | "gcp"): BackupPolicy[] {
  return DEFAULT_BACKUP_POLICIES.filter(p => p.provider === provider);
}

export function getBackupPoliciesByResourceType(resourceType: string): BackupPolicy[] {
  return DEFAULT_BACKUP_POLICIES.filter(p => p.resourceType === resourceType);
}

export function getCrossRegionBackupPolicies(): BackupPolicy[] {
  return DEFAULT_BACKUP_POLICIES.filter(p => p.crossRegionCopy);
}

export function getDRTestSchedule(tier: DRTier): { testType: DRTestType; frequencyDays: number }[] {
  return DR_TEST_SCHEDULE[tier];
}

export function getDRPipelineStage(id: DRPipelineStageId): DRPipelineStage | undefined {
  return DR_PIPELINE.find(s => s.id === id);
}

export function getDRPipelineOrder(): DRPipelineStageId[] {
  return [...DR_PIPELINE].sort((a, b) => a.order - b.order).map(s => s.id);
}

export function getDRIntegration(target: DRIntegrationTarget): DRIntegrationContract | undefined {
  return DR_INTEGRATION_CONTRACTS.find(c => c.target === target);
}

export function isRTOCompliant(actualMinutes: number, tier: DRTier): boolean {
  const target = getRTORPOTarget(tier);
  if (!target) return false;
  return actualMinutes <= target.rtoMinutes;
}

export function isRPOCompliant(actualMinutes: number, tier: DRTier): boolean {
  const target = getRTORPOTarget(tier);
  if (!target) return false;
  return actualMinutes <= target.rpoMinutes;
}

export function computeDRReadinessScore(
  backupsVerified: number,
  backupsTotal: number,
  replicationHealthy: boolean,
  lastTestPassed: boolean,
  lastTestDaysAgo: number,
  testFrequencyDays: number,
): number {
  let score = 0;
  const backupScore = backupsTotal > 0 ? (backupsVerified / backupsTotal) * 40 : 0;
  score += backupScore;
  score += replicationHealthy ? 25 : 0;
  score += lastTestPassed ? 20 : 0;
  const testFreshness = Math.max(0, 1 - (lastTestDaysAgo / (testFrequencyDays * 2)));
  score += testFreshness * 15;
  return Math.round(score);
}

// ═══════════════════════════════════════════════════════════════════════════════
// §9 — Tests
// ═══════════════════════════════════════════════════════════════════════════════

export interface DisasterRecoveryTestResult {
  name: string;
  passed: boolean;
  detail: string;
}

export function runDisasterRecoveryTests(): DisasterRecoveryTestResult[] {
  const results: DisasterRecoveryTestResult[] = [];
  const assert = (name: string, condition: boolean, detail: string) =>
    results.push({ name, passed: condition, detail });

  // §1 — RTO/RPO Targets
  assert("All 4 DR tiers defined", RTO_RPO_TARGETS.length === 4, `Found ${RTO_RPO_TARGETS.length}`);
  assert("Tier1 RTO = 15min", getRTORPOTarget("tier1_mission_critical")?.rtoMinutes === 15, "Mission-critical RTO");
  assert("Tier1 RPO = 1min", getRTORPOTarget("tier1_mission_critical")?.rpoMinutes === 1, "Mission-critical RPO");
  assert("Tier4 RTO = 24h", getRTORPOTarget("tier4_administrative")?.rtoMinutes === 1440, "Administrative RTO");
  assert("Tiers scale in availability", (getRTORPOTarget("tier1_mission_critical")?.availabilityTarget ?? 0) > (getRTORPOTarget("tier4_administrative")?.availabilityTarget ?? 0), "Tier scaling");

  // §2 — Backup Policies
  assert("Backup policies exist", DEFAULT_BACKUP_POLICIES.length >= 7, `Found ${DEFAULT_BACKUP_POLICIES.length}`);
  assert("AWS backup policies", getBackupPoliciesByProvider("aws").length >= 5, "AWS coverage");
  assert("Azure backup policies", getBackupPoliciesByProvider("azure").length >= 1, "Azure coverage");
  assert("GCP backup policies", getBackupPoliciesByProvider("gcp").length >= 1, "GCP coverage");
  assert("Cross-region copies", getCrossRegionBackupPolicies().length >= 5, "Cross-region replication");
  assert("All backups encrypted", DEFAULT_BACKUP_POLICIES.every(p => p.encryptionRequired), "Encryption mandatory");

  // §3 — DR Test Schedule
  assert("Tier1 tests quarterly", getDRTestSchedule("tier1_mission_critical").length >= 3, "Tier1 test frequency");
  assert("Tier1 has full failover", getDRTestSchedule("tier1_mission_critical").some(t => t.testType === "full_failover"), "Full failover test");
  assert("Tier4 minimal testing", getDRTestSchedule("tier4_administrative").length === 1, "Tier4 annual only");

  // §4 — Pipeline
  assert("DR pipeline has 9 stages", DR_PIPELINE.length === 9, `Found ${DR_PIPELINE.length}`);
  assert("Starts with readiness", getDRPipelineOrder()[0] === "assess_readiness", "Readiness first");
  assert("Ends with dashboard", getDRPipelineOrder()[8] === "update_dashboard", "Dashboard last");

  // §5 — Integration Contracts
  assert("10 integration contracts", DR_INTEGRATION_CONTRACTS.length === 10, `Found ${DR_INTEGRATION_CONTRACTS.length}`);
  assert("Incident response connected", getDRIntegration("incident_response") !== undefined, "Incident connected");
  assert("Change management connected", getDRIntegration("change_management") !== undefined, "Change mgmt connected");

  // §6 — Compliance Checks
  assert("RTO compliant: 10min in Tier1", isRTOCompliant(10, "tier1_mission_critical"), "Under RTO");
  assert("RTO non-compliant: 20min in Tier1", !isRTOCompliant(20, "tier1_mission_critical"), "Over RTO");
  assert("RPO compliant: 0.5min in Tier1", isRPOCompliant(0.5, "tier1_mission_critical"), "Under RPO");

  // §7 — Readiness Score
  const perfectScore = computeDRReadinessScore(10, 10, true, true, 1, 30);
  assert("Perfect readiness near 100", perfectScore >= 95, `Score: ${perfectScore}`);
  const poorScore = computeDRReadinessScore(2, 10, false, false, 100, 30);
  assert("Poor readiness < 20", poorScore < 20, `Score: ${poorScore}`);

  return results;
}
