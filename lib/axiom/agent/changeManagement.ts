/**
 * Axiom Agent — Change Management & Approval Workflow
 *
 * Enterprise-grade change management that governs all infrastructure
 * modifications. Implements ITIL-aligned change processes with risk
 * assessment, approval chains, change windows, and audit-ready records.
 *
 * Every infrastructure action in Axiom flows through this engine —
 * the governance layer between "agent wants to do X" and "X happens."
 */

// ═══════════════════════════════════════════════════════════════════════════════
// §1 — Change Request Architecture
// ═══════════════════════════════════════════════════════════════════════════════

export type ChangeCategory = "standard" | "normal" | "emergency" | "pre_approved";

export type ChangeRiskLevel = "critical" | "high" | "medium" | "low" | "negligible";

export type ChangeStatus =
  | "draft"
  | "submitted"
  | "risk_assessed"
  | "pending_approval"
  | "approved"
  | "scheduled"
  | "in_progress"
  | "implementing"
  | "verifying"
  | "completed"
  | "failed"
  | "rolled_back"
  | "cancelled"
  | "rejected";

export type ChangeImpactScope = "single_resource" | "service" | "account" | "region" | "multi_region" | "global";

export interface ChangeRequest {
  id: string;
  title: string;
  description: string;
  category: ChangeCategory;
  status: ChangeStatus;
  riskLevel: ChangeRiskLevel;
  impactScope: ChangeImpactScope;
  requestedBy: ChangeRequestor;
  createdAt: string;
  updatedAt: string;
  scheduledStart?: string;
  scheduledEnd?: string;
  actualStart?: string;
  actualEnd?: string;
  provider: "aws" | "azure" | "gcp";
  accountId: string;
  region: string;
  affectedResources: AffectedChangeResource[];
  riskAssessment: ChangeRiskAssessment;
  approvalChain: ApprovalChainStep[];
  rollbackPlan: ChangeRollbackPlan;
  verificationCriteria: VerificationCriterion[];
  changeWindow?: ChangeWindowRef;
  linkedTicket?: ExternalTicketRef;
  tags: Record<string, string>;
}

export interface ChangeRequestor {
  type: "agent" | "user" | "automation" | "system";
  id: string;
  name: string;
  reason: string;
  urgency: "immediate" | "high" | "normal" | "low" | "planned";
}

export interface AffectedChangeResource {
  resourceArn: string;
  resourceType: string;
  changeType: "create" | "modify" | "delete" | "replace";
  currentState: string;
  desiredState: string;
  reversible: boolean;
}

export interface ChangeRiskAssessment {
  overallRisk: ChangeRiskLevel;
  blastRadius: number;
  serviceImpact: "none" | "degraded" | "partial_outage" | "full_outage";
  dataRisk: "none" | "read_only" | "data_modification" | "data_loss_possible";
  rollbackComplexity: "trivial" | "simple" | "moderate" | "complex" | "impossible";
  downtimeExpected: boolean;
  downtimeMinutes?: number;
  factors: RiskFactor[];
  mitigations: RiskMitigation[];
}

export interface RiskFactor {
  name: string;
  severity: ChangeRiskLevel;
  description: string;
  weight: number;
}

export interface RiskMitigation {
  name: string;
  description: string;
  implemented: boolean;
  reducesRiskBy: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// §2 — Approval Chains
// ═══════════════════════════════════════════════════════════════════════════════

export type ApprovalAction = "approve" | "reject" | "delegate" | "request_info" | "auto_approve";

export interface ApprovalChainStep {
  stepId: string;
  order: number;
  approverType: "user" | "role" | "team" | "system" | "auto";
  approverId: string;
  approverName: string;
  required: boolean;
  status: "pending" | "approved" | "rejected" | "delegated" | "skipped" | "timed_out";
  action?: ApprovalAction;
  actionAt?: string;
  comment?: string;
  timeoutHours: number;
  escalateOnTimeout: boolean;
}

export interface ApprovalPolicy {
  id: string;
  name: string;
  description: string;
  riskLevel: ChangeRiskLevel;
  category: ChangeCategory;
  requiredApprovals: ApprovalRequirement[];
  autoApproveConditions: AutoApproveCondition[];
  escalationTimeoutHours: number;
  notifyOnSubmission: string[];
  notifyOnApproval: string[];
}

export interface ApprovalRequirement {
  role: string;
  count: number;
  required: boolean;
  canDelegate: boolean;
}

export interface AutoApproveCondition {
  name: string;
  description: string;
  conditions: Record<string, string | number | boolean>;
}

export const APPROVAL_POLICIES: ApprovalPolicy[] = [
  {
    id: "ap-pre-approved",
    name: "Pre-Approved Changes",
    description: "Low-risk, reversible changes that match pre-approved patterns",
    riskLevel: "negligible",
    category: "pre_approved",
    requiredApprovals: [],
    autoApproveConditions: [
      { name: "Low blast radius", description: "Single resource with blast radius < 5", conditions: { maxBlastRadius: 5, maxResources: 1 } },
      { name: "Reversible", description: "Change is fully reversible", conditions: { reversible: true } },
      { name: "No data risk", description: "No data modification or loss risk", conditions: { dataRisk: "none" } },
    ],
    escalationTimeoutHours: 0,
    notifyOnSubmission: [],
    notifyOnApproval: ["audit-log"],
  },
  {
    id: "ap-standard",
    name: "Standard Change Approval",
    description: "Low-risk changes requiring single team lead approval",
    riskLevel: "low",
    category: "standard",
    requiredApprovals: [
      { role: "team_lead", count: 1, required: true, canDelegate: true },
    ],
    autoApproveConditions: [],
    escalationTimeoutHours: 4,
    notifyOnSubmission: ["team-channel"],
    notifyOnApproval: ["requestor", "audit-log"],
  },
  {
    id: "ap-normal",
    name: "Normal Change Approval",
    description: "Medium-risk changes requiring CAB review",
    riskLevel: "medium",
    category: "normal",
    requiredApprovals: [
      { role: "team_lead", count: 1, required: true, canDelegate: true },
      { role: "change_manager", count: 1, required: true, canDelegate: false },
    ],
    autoApproveConditions: [],
    escalationTimeoutHours: 8,
    notifyOnSubmission: ["cab-channel", "team-channel"],
    notifyOnApproval: ["requestor", "team-channel", "audit-log"],
  },
  {
    id: "ap-high-risk",
    name: "High-Risk Change Approval",
    description: "High-risk changes requiring multiple approvals including VP",
    riskLevel: "high",
    category: "normal",
    requiredApprovals: [
      { role: "team_lead", count: 1, required: true, canDelegate: false },
      { role: "change_manager", count: 1, required: true, canDelegate: false },
      { role: "vp_engineering", count: 1, required: true, canDelegate: false },
    ],
    autoApproveConditions: [],
    escalationTimeoutHours: 24,
    notifyOnSubmission: ["cab-channel", "leadership-channel"],
    notifyOnApproval: ["requestor", "cab-channel", "leadership-channel", "audit-log"],
  },
  {
    id: "ap-critical",
    name: "Critical Change Approval",
    description: "Critical changes requiring executive approval and production freeze check",
    riskLevel: "critical",
    category: "normal",
    requiredApprovals: [
      { role: "team_lead", count: 1, required: true, canDelegate: false },
      { role: "change_manager", count: 1, required: true, canDelegate: false },
      { role: "vp_engineering", count: 1, required: true, canDelegate: false },
      { role: "cto", count: 1, required: true, canDelegate: false },
    ],
    autoApproveConditions: [],
    escalationTimeoutHours: 48,
    notifyOnSubmission: ["cab-channel", "leadership-channel", "exec-channel"],
    notifyOnApproval: ["requestor", "all-stakeholders", "audit-log"],
  },
  {
    id: "ap-emergency",
    name: "Emergency Change Process",
    description: "Emergency changes with expedited approval — post-implementation review required",
    riskLevel: "critical",
    category: "emergency",
    requiredApprovals: [
      { role: "oncall_lead", count: 1, required: true, canDelegate: false },
    ],
    autoApproveConditions: [],
    escalationTimeoutHours: 1,
    notifyOnSubmission: ["incident-channel", "oncall-channel"],
    notifyOnApproval: ["all-stakeholders", "audit-log", "pir-queue"],
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// §3 — Change Windows
// ═══════════════════════════════════════════════════════════════════════════════

export type ChangeWindowType = "maintenance" | "deployment" | "emergency" | "blackout";

export interface ChangeWindow {
  id: string;
  name: string;
  type: ChangeWindowType;
  description: string;
  recurring: boolean;
  schedule?: ChangeWindowSchedule;
  startTime?: string;
  endTime?: string;
  allowedCategories: ChangeCategory[];
  maxConcurrentChanges: number;
  requiresNotification: boolean;
  notificationLeadTimeHours: number;
}

export interface ChangeWindowSchedule {
  dayOfWeek: number[];
  startHourUTC: number;
  durationHours: number;
  timezone: string;
}

export const DEFAULT_CHANGE_WINDOWS: ChangeWindow[] = [
  {
    id: "cw-weekly-maintenance",
    name: "Weekly Maintenance Window",
    type: "maintenance",
    description: "Standard weekly maintenance window for routine changes",
    recurring: true,
    schedule: { dayOfWeek: [2], startHourUTC: 6, durationHours: 4, timezone: "UTC" },
    allowedCategories: ["standard", "normal", "pre_approved"],
    maxConcurrentChanges: 5,
    requiresNotification: true,
    notificationLeadTimeHours: 24,
  },
  {
    id: "cw-daily-deployment",
    name: "Daily Deployment Window",
    type: "deployment",
    description: "Daily window for pre-approved deployments and standard changes",
    recurring: true,
    schedule: { dayOfWeek: [1, 2, 3, 4, 5], startHourUTC: 14, durationHours: 2, timezone: "UTC" },
    allowedCategories: ["standard", "pre_approved"],
    maxConcurrentChanges: 3,
    requiresNotification: false,
    notificationLeadTimeHours: 0,
  },
  {
    id: "cw-emergency",
    name: "Emergency Change Window",
    type: "emergency",
    description: "Always-open window for emergency changes during active incidents",
    recurring: false,
    allowedCategories: ["emergency"],
    maxConcurrentChanges: 1,
    requiresNotification: true,
    notificationLeadTimeHours: 0,
  },
  {
    id: "cw-freeze-eoy",
    name: "End of Year Change Freeze",
    type: "blackout",
    description: "Annual change freeze during holiday period — emergencies only",
    recurring: true,
    schedule: { dayOfWeek: [0, 1, 2, 3, 4, 5, 6], startHourUTC: 0, durationHours: 24, timezone: "UTC" },
    allowedCategories: ["emergency"],
    maxConcurrentChanges: 1,
    requiresNotification: true,
    notificationLeadTimeHours: 0,
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// §4 — Rollback Planning
// ═══════════════════════════════════════════════════════════════════════════════

export interface ChangeRollbackPlan {
  strategy: "automatic" | "manual" | "hybrid";
  estimatedRollbackMinutes: number;
  steps: ChangeRollbackStep[];
  verificationAfterRollback: string[];
  rollbackDeadlineMinutes: number;
  requiresApproval: boolean;
}

export interface ChangeRollbackStep {
  order: number;
  description: string;
  command?: string;
  automatable: boolean;
  estimatedMinutes: number;
  rollbackFailureAction: "escalate" | "manual_intervention" | "abort";
}

export interface ChangeWindowRef {
  windowId: string;
  windowName: string;
  startsAt: string;
  endsAt: string;
}

export interface VerificationCriterion {
  id: string;
  name: string;
  description: string;
  type: "health_check" | "metric_threshold" | "manual_verification" | "automated_test";
  target: string;
  expectedResult: string;
  timeoutMinutes: number;
  required: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// §5 — External Integrations (Ticketing)
// ═══════════════════════════════════════════════════════════════════════════════

export type TicketingSystem = "jira" | "servicenow" | "linear" | "github_issues" | "azure_devops" | "pagerduty";

export interface ExternalTicketRef {
  system: TicketingSystem;
  ticketId: string;
  ticketUrl: string;
  status: string;
  syncEnabled: boolean;
}

export interface TicketingIntegrationConfig {
  system: TicketingSystem;
  enabled: boolean;
  baseUrl: string;
  projectKey: string;
  autoCreateTicket: boolean;
  autoSyncStatus: boolean;
  statusMapping: Record<ChangeStatus, string>;
  priorityMapping: Record<ChangeRiskLevel, string>;
  customFields: Record<string, string>;
}

export const TICKETING_INTEGRATIONS: TicketingIntegrationConfig[] = [
  {
    system: "jira",
    enabled: false,
    baseUrl: "",
    projectKey: "",
    autoCreateTicket: true,
    autoSyncStatus: true,
    statusMapping: {
      draft: "Open", submitted: "Open", risk_assessed: "In Review", pending_approval: "In Review",
      approved: "Approved", scheduled: "Ready", in_progress: "In Progress", implementing: "In Progress",
      verifying: "In Progress", completed: "Done", failed: "Failed", rolled_back: "Rolled Back",
      cancelled: "Cancelled", rejected: "Rejected",
    },
    priorityMapping: { critical: "Highest", high: "High", medium: "Medium", low: "Low", negligible: "Lowest" },
    customFields: {},
  },
  {
    system: "servicenow",
    enabled: false,
    baseUrl: "",
    projectKey: "",
    autoCreateTicket: true,
    autoSyncStatus: true,
    statusMapping: {
      draft: "New", submitted: "Assess", risk_assessed: "Assess", pending_approval: "Authorize",
      approved: "Authorized", scheduled: "Scheduled", in_progress: "Implement", implementing: "Implement",
      verifying: "Review", completed: "Closed", failed: "Closed", rolled_back: "Closed",
      cancelled: "Cancelled", rejected: "Closed",
    },
    priorityMapping: { critical: "1 - Critical", high: "2 - High", medium: "3 - Moderate", low: "4 - Low", negligible: "4 - Low" },
    customFields: {},
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// §6 — Risk Scoring
// ═══════════════════════════════════════════════════════════════════════════════

export interface RiskScoringRule {
  id: string;
  name: string;
  description: string;
  factor: string;
  weight: number;
  scoringLogic: string;
  maxScore: number;
}

export const RISK_SCORING_RULES: RiskScoringRule[] = [
  { id: "rs-blast-radius", name: "Blast Radius", description: "Number and criticality of affected resources", factor: "affectedResources", weight: 25, scoringLogic: "resources.length * criticality_multiplier", maxScore: 25 },
  { id: "rs-service-impact", name: "Service Impact", description: "Expected impact on service availability", factor: "serviceImpact", weight: 20, scoringLogic: "none=0, degraded=10, partial=15, full=20", maxScore: 20 },
  { id: "rs-data-risk", name: "Data Risk", description: "Risk of data loss or corruption", factor: "dataRisk", weight: 20, scoringLogic: "none=0, read_only=5, modification=12, loss=20", maxScore: 20 },
  { id: "rs-rollback-complexity", name: "Rollback Complexity", description: "Difficulty of rolling back the change", factor: "rollbackComplexity", weight: 15, scoringLogic: "trivial=0, simple=3, moderate=8, complex=12, impossible=15", maxScore: 15 },
  { id: "rs-time-sensitivity", name: "Time Sensitivity", description: "Whether change is during peak hours or change freeze", factor: "timing", weight: 10, scoringLogic: "off_hours=0, business_hours=5, peak=8, freeze=10", maxScore: 10 },
  { id: "rs-novelty", name: "Change Novelty", description: "Whether this type of change has been done before", factor: "novelty", weight: 10, scoringLogic: "routine=0, occasional=3, rare=7, first_time=10", maxScore: 10 },
];

export function computeChangeRiskScore(factors: Record<string, number>): { score: number; riskLevel: ChangeRiskLevel } {
  let score = 0;
  for (const rule of RISK_SCORING_RULES) {
    const factorValue = factors[rule.factor] ?? 0;
    score += Math.min(factorValue, rule.maxScore);
  }
  const riskLevel: ChangeRiskLevel =
    score >= 80 ? "critical" :
    score >= 60 ? "high" :
    score >= 35 ? "medium" :
    score >= 15 ? "low" :
    "negligible";
  return { score, riskLevel };
}

// ═══════════════════════════════════════════════════════════════════════════════
// §7 — Change Management Pipeline
// ═══════════════════════════════════════════════════════════════════════════════

export type ChangePipelineStageId =
  | "create_request"
  | "assess_risk"
  | "select_approval_policy"
  | "request_approvals"
  | "wait_for_approvals"
  | "schedule_change"
  | "pre_change_verification"
  | "implement_change"
  | "post_change_verification"
  | "close_request"
  | "post_implementation_review";

export interface ChangePipelineStage {
  id: ChangePipelineStageId;
  name: string;
  order: number;
  timeoutMs: number;
  automatable: boolean;
  metricsKey: string;
  description: string;
}

export const CHANGE_PIPELINE: ChangePipelineStage[] = [
  { id: "create_request", name: "Create Request", order: 1, timeoutMs: 5_000, automatable: true, metricsKey: "change_pipeline.create", description: "Create change request from agent action or user submission" },
  { id: "assess_risk", name: "Assess Risk", order: 2, timeoutMs: 10_000, automatable: true, metricsKey: "change_pipeline.risk", description: "Run risk scoring rules and compute risk level" },
  { id: "select_approval_policy", name: "Select Approval Policy", order: 3, timeoutMs: 1_000, automatable: true, metricsKey: "change_pipeline.policy", description: "Match risk level and category to approval policy" },
  { id: "request_approvals", name: "Request Approvals", order: 4, timeoutMs: 5_000, automatable: true, metricsKey: "change_pipeline.request", description: "Send approval requests to required approvers" },
  { id: "wait_for_approvals", name: "Wait for Approvals", order: 5, timeoutMs: 172_800_000, automatable: false, metricsKey: "change_pipeline.wait", description: "Wait for all required approvals (up to 48h)" },
  { id: "schedule_change", name: "Schedule Change", order: 6, timeoutMs: 5_000, automatable: true, metricsKey: "change_pipeline.schedule", description: "Schedule change within an appropriate change window" },
  { id: "pre_change_verification", name: "Pre-Change Verification", order: 7, timeoutMs: 60_000, automatable: true, metricsKey: "change_pipeline.pre_verify", description: "Run pre-change health checks and capture baseline" },
  { id: "implement_change", name: "Implement Change", order: 8, timeoutMs: 3_600_000, automatable: true, metricsKey: "change_pipeline.implement", description: "Execute the change via terraform/API calls" },
  { id: "post_change_verification", name: "Post-Change Verification", order: 9, timeoutMs: 300_000, automatable: true, metricsKey: "change_pipeline.post_verify", description: "Run verification criteria and compare to baseline" },
  { id: "close_request", name: "Close Request", order: 10, timeoutMs: 5_000, automatable: true, metricsKey: "change_pipeline.close", description: "Record outcome and close the change request" },
  { id: "post_implementation_review", name: "Post-Implementation Review", order: 11, timeoutMs: 86_400_000, automatable: false, metricsKey: "change_pipeline.pir", description: "Scheduled review of change outcomes (mandatory for emergency and failed changes)" },
];

// ═══════════════════════════════════════════════════════════════════════════════
// §8 — Integration Contracts
// ═══════════════════════════════════════════════════════════════════════════════

export type ChangeIntegrationTarget =
  | "execution_safety"
  | "terraform_generation"
  | "cognitive_loop"
  | "notification_engine"
  | "incident_response"
  | "compliance_engine"
  | "audit_trail"
  | "api_gateway"
  | "ticketing_system"
  | "dashboard_api";

export interface ChangeIntegrationContract {
  target: ChangeIntegrationTarget;
  direction: "inbound" | "outbound" | "bidirectional";
  protocol: "function_call" | "event_bus" | "webhook" | "rest_api";
  dataShape: string;
  slaMs: number;
  description: string;
}

export const CHANGE_INTEGRATION_CONTRACTS: ChangeIntegrationContract[] = [
  { target: "execution_safety", direction: "bidirectional", protocol: "function_call", dataShape: "ChangeRequest ↔ SafetyValidation", slaMs: 2_000, description: "Changes are safety-validated before execution; outcomes feed back" },
  { target: "terraform_generation", direction: "outbound", protocol: "function_call", dataShape: "ApprovedChange → TerraformPlan", slaMs: 5_000, description: "Approved changes generate terraform plans for execution" },
  { target: "cognitive_loop", direction: "inbound", protocol: "function_call", dataShape: "CognitiveAction → ChangeRequest", slaMs: 1_000, description: "Agent actions create change requests for governance" },
  { target: "notification_engine", direction: "outbound", protocol: "event_bus", dataShape: "ChangeEvent → NotificationTrigger", slaMs: 200, description: "Change status updates trigger notifications to stakeholders" },
  { target: "incident_response", direction: "bidirectional", protocol: "function_call", dataShape: "IncidentAction ↔ EmergencyChange", slaMs: 500, description: "Incident remediation creates emergency changes; change failures may create incidents" },
  { target: "compliance_engine", direction: "outbound", protocol: "function_call", dataShape: "ChangeRecord → ComplianceEvidence", slaMs: 500, description: "Completed changes serve as compliance evidence for audit readiness" },
  { target: "audit_trail", direction: "outbound", protocol: "function_call", dataShape: "ChangeEvent → AuditEntry", slaMs: 100, description: "Every change lifecycle event is recorded in the audit trail" },
  { target: "api_gateway", direction: "inbound", protocol: "rest_api", dataShape: "APIRequest → ChangeAction", slaMs: 1_000, description: "API endpoints for creating, approving, and managing changes" },
  { target: "ticketing_system", direction: "bidirectional", protocol: "webhook", dataShape: "ChangeRequest ↔ Ticket", slaMs: 5_000, description: "Changes sync with external ticketing systems (Jira, ServiceNow)" },
  { target: "dashboard_api", direction: "outbound", protocol: "event_bus", dataShape: "ChangeMetrics → DashboardData", slaMs: 5_000, description: "Change metrics and pipeline status pushed to dashboard" },
];

// ═══════════════════════════════════════════════════════════════════════════════
// §9 — Query Functions
// ═══════════════════════════════════════════════════════════════════════════════

export function getApprovalPolicy(id: string): ApprovalPolicy | undefined {
  return APPROVAL_POLICIES.find(p => p.id === id);
}

export function getApprovalPolicyForRisk(riskLevel: ChangeRiskLevel, category: ChangeCategory): ApprovalPolicy | undefined {
  if (category === "emergency") return APPROVAL_POLICIES.find(p => p.category === "emergency");
  if (category === "pre_approved") return APPROVAL_POLICIES.find(p => p.category === "pre_approved");
  return APPROVAL_POLICIES.find(p => p.riskLevel === riskLevel && p.category !== "emergency" && p.category !== "pre_approved");
}

export function getChangeWindow(id: string): ChangeWindow | undefined {
  return DEFAULT_CHANGE_WINDOWS.find(w => w.id === id);
}

export function getAvailableChangeWindows(category: ChangeCategory): ChangeWindow[] {
  return DEFAULT_CHANGE_WINDOWS.filter(w => w.allowedCategories.includes(category));
}

export function getBlackoutWindows(): ChangeWindow[] {
  return DEFAULT_CHANGE_WINDOWS.filter(w => w.type === "blackout");
}

export function getRiskScoringRule(id: string): RiskScoringRule | undefined {
  return RISK_SCORING_RULES.find(r => r.id === id);
}

export function getTicketingConfig(system: TicketingSystem): TicketingIntegrationConfig | undefined {
  return TICKETING_INTEGRATIONS.find(t => t.system === system);
}

export function getChangePipelineStage(id: ChangePipelineStageId): ChangePipelineStage | undefined {
  return CHANGE_PIPELINE.find(s => s.id === id);
}

export function getChangePipelineOrder(): ChangePipelineStageId[] {
  return [...CHANGE_PIPELINE].sort((a, b) => a.order - b.order).map(s => s.id);
}

export function getChangeIntegration(target: ChangeIntegrationTarget): ChangeIntegrationContract | undefined {
  return CHANGE_INTEGRATION_CONTRACTS.find(c => c.target === target);
}

export function getRequiredApprovalsCount(riskLevel: ChangeRiskLevel): number {
  const policy = APPROVAL_POLICIES.find(p => p.riskLevel === riskLevel && p.category !== "emergency");
  if (!policy) return 0;
  return policy.requiredApprovals.filter(r => r.required).reduce((sum, r) => sum + r.count, 0);
}

export function isChangeWindowOpen(window: ChangeWindow, timestamp: string): boolean {
  if (!window.recurring || !window.schedule) return false;
  const date = new Date(timestamp);
  const dayOfWeek = date.getUTCDay();
  const hourUTC = date.getUTCHours();
  if (!window.schedule.dayOfWeek.includes(dayOfWeek)) return false;
  const endHour = window.schedule.startHourUTC + window.schedule.durationHours;
  return hourUTC >= window.schedule.startHourUTC && hourUTC < endHour;
}

// ═══════════════════════════════════════════════════════════════════════════════
// §10 — Tests
// ═══════════════════════════════════════════════════════════════════════════════

export interface ChangeManagementTestResult {
  name: string;
  passed: boolean;
  detail: string;
}

export function runChangeManagementTests(): ChangeManagementTestResult[] {
  const results: ChangeManagementTestResult[] = [];
  const assert = (name: string, condition: boolean, detail: string) =>
    results.push({ name, passed: condition, detail });

  // §1 — Approval Policies
  assert("Approval policies exist", APPROVAL_POLICIES.length >= 6, `Found ${APPROVAL_POLICIES.length}`);
  assert("Pre-approved policy exists", getApprovalPolicy("ap-pre-approved") !== undefined, "Pre-approved defined");
  assert("Emergency policy exists", getApprovalPolicyForRisk("critical", "emergency") !== undefined, "Emergency fast-track");
  assert("Critical needs 4 approvers", getRequiredApprovalsCount("critical") === 4, "CTO + VP + CM + TL");
  assert("Low needs 1 approver", getRequiredApprovalsCount("low") === 1, "Team lead only");
  assert("Negligible needs 0 approvers", getRequiredApprovalsCount("negligible") === 0, "Auto-approved");

  // §2 — Change Windows
  assert("Change windows defined", DEFAULT_CHANGE_WINDOWS.length >= 4, `Found ${DEFAULT_CHANGE_WINDOWS.length}`);
  assert("Weekly maintenance exists", getChangeWindow("cw-weekly-maintenance") !== undefined, "Weekly window");
  assert("Blackout window exists", getBlackoutWindows().length >= 1, "Change freeze defined");
  assert("Emergency window available", getAvailableChangeWindows("emergency").length >= 1, "Emergency always open");
  assert("Standard has deployment window", getAvailableChangeWindows("standard").length >= 2, "Standard has windows");

  // §3 — Risk Scoring
  assert("6 risk scoring rules", RISK_SCORING_RULES.length === 6, `Found ${RISK_SCORING_RULES.length}`);
  assert("Max total score is 100", RISK_SCORING_RULES.reduce((s, r) => s + r.maxScore, 0) === 100, "Scores sum to 100");
  assert("Zero score = negligible", computeChangeRiskScore({}).riskLevel === "negligible", "Empty = negligible");
  assert("Max score = critical", computeChangeRiskScore({
    affectedResources: 25, serviceImpact: 20, dataRisk: 20, rollbackComplexity: 15, timing: 10, novelty: 10,
  }).riskLevel === "critical", "Full score = critical");

  // §4 — Ticketing Integrations
  assert("Jira config exists", getTicketingConfig("jira") !== undefined, "Jira integration");
  assert("ServiceNow config exists", getTicketingConfig("servicenow") !== undefined, "ServiceNow integration");

  // §5 — Pipeline
  assert("Pipeline has 11 stages", CHANGE_PIPELINE.length === 11, `Found ${CHANGE_PIPELINE.length}`);
  assert("Starts with create", getChangePipelineOrder()[0] === "create_request", "Create first");
  assert("Ends with PIR", getChangePipelineOrder()[10] === "post_implementation_review", "PIR last");

  // §6 — Integration Contracts
  assert("10 integration contracts", CHANGE_INTEGRATION_CONTRACTS.length === 10, `Found ${CHANGE_INTEGRATION_CONTRACTS.length}`);
  assert("Audit trail connected", getChangeIntegration("audit_trail") !== undefined, "Audit connected");
  assert("Ticketing connected", getChangeIntegration("ticketing_system") !== undefined, "Ticketing connected");

  // §7 — Window Time Check
  const tuesdayMorning = "2026-01-06T07:00:00Z"; // Tuesday 7am UTC
  const maintenanceWindow = getChangeWindow("cw-weekly-maintenance")!;
  assert("Window open on Tuesday 7am", isChangeWindowOpen(maintenanceWindow, tuesdayMorning), "In maintenance window");
  const sundayMorning = "2026-01-04T07:00:00Z"; // Sunday
  assert("Window closed on Sunday", !isChangeWindowOpen(maintenanceWindow, sundayMorning), "Not in window");

  return results;
}
