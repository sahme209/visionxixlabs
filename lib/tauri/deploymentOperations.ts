/**
 * TAURI deployment-operations domain.
 *
 * This module is deliberately integration-neutral. Production actions are represented
 * as human-confirmed playbook steps and must be executed through an authorized adapter.
 */
export const deploymentStatuses = [
  "draft", "submitted", "devops_review", "needs_information", "access_blocked",
  "approval_blocked", "ready", "scheduled", "waiting_for_window",
  "change_approval_pending", "ready_to_deploy", "in_progress",
  "waiting_for_environment_approval", "waiting_for_manual_step",
  "validation_pending", "failed", "rollback_in_progress", "completed",
  "change_closure", "closed", "cancelled", "deferred", "rolled_back",
  "partially_completed", "completed_with_deferred_validation",
] as const;

export type DeploymentStatus = (typeof deploymentStatuses)[number];
export type FactClassification =
  | "confirmed" | "decided" | "proposed" | "issue"
  | "resolution" | "open_item" | "tbd";
export type ValidationOwner = "devops" | "application_team" | "shared" | "l1" | "dba" | "other";
export type RequestClass =
  | "planned_biweekly_release" | "planned_release" | "ad_hoc"
  | "emergency" | "maintenance" | "other";
export type ChangeType =
  | "enhancement" | "new_feature" | "new_client_implementation"
  | "configuration_change" | "infrastructure_change" | "database_change"
  | "security_image_refresh" | "credential_rotation" | "workflow_change"
  | "manual_configuration" | "bug_fix" | "other";
export type TimeZoneCode = "ET" | "CT" | "MT" | "PT" | "UTC" | "Other";

export interface SourcedFact {
  id: string;
  classification: FactClassification;
  value: string;
  sourceEvidenceId: string;
  confirmedBy?: string;
}

export interface ChecklistItem {
  id: string;
  instruction: string;
  owner: string;
  evidenceRequired: boolean;
  completed: boolean;
  validationInstruction?: string;
}

export interface DeploymentIntake {
  id: string;
  tenantId: string;
  title: string;
  serviceImpactingNow: boolean;
  requestClass: RequestClass;
  adHocReason?: string;
  adHocPriority?: string;
  businessImpact?: string;
  scheduleExceptionReason?: string;
  windowStartUtc: string;
  windowEndUtc: string;
  displayTimeZone: TimeZoneCode;
  changeTypes: ChangeType[];
  applications: string[];
  clients: string[];
  deploymentContact: string;
  repositoryUrls: string[];
  productionPrUrls: string[];
  noPrRequired: boolean;
  prApprovalStatus: "approved" | "pending" | "not_applicable";
  sourceBranch: string;
  targetBranch: string;
  deploymentMethod: string;
  workflowName: string;
  targetEnvironment: string;
  workflowInputs: Record<string, string>;
  manualSteps: ChecklistItem[];
  lowerEnvironmentTested: string[];
  lowerEnvironmentValidation: "yes" | "no" | "not_applicable";
  developmentReady: boolean;
  productionReady: boolean;
  validationSteps: ChecklistItem[];
  expectedProductionResult: string;
  validationOwner: ValidationOwner;
  deferredValidation?: {
    reason: string;
    trigger: string;
    expectedDateUtc: string;
    owner: string;
    monitoringPlan: string;
  };
  rollbackAvailability: "yes" | "no" | "not_applicable";
  rollbackSteps: ChecklistItem[];
  rollbackOwner?: string;
  backupRequired: boolean;
  backupEvidenceIds: string[];
  changeCreationMethod:
    | "rca_workflow" | "dbployer_automatic" | "manual_servicenow"
    | "existing_change" | "not_applicable" | "other";
  applicationContact: string;
  escalationContact: string;
  facts: SourcedFact[];
}

export type IntakeIssueCode =
  | "tenant_required" | "incident_route_required" | "ad_hoc_details_required"
  | "window_invalid" | "scope_required" | "contact_required"
  | "repository_required" | "pr_required" | "source_control_required"
  | "workflow_required" | "readiness_incomplete" | "validation_required" | "manual_step_incomplete"
  | "rollback_required" | "backup_evidence_required" | "uncertain_executable_fact";

export interface IntakeIssue {
  code: IntakeIssueCode;
  field: string;
  message: string;
}

function validDate(value: string): boolean {
  return value.length > 0 && Number.isFinite(Date.parse(value));
}

export function validateIntake(intake: DeploymentIntake): IntakeIssue[] {
  const issues: IntakeIssue[] = [];
  const add = (code: IntakeIssueCode, field: string, message: string) =>
    issues.push({ code, field, message });

  if (!intake.tenantId.trim()) add("tenant_required", "tenantId", "A tenant is required.");
  if (intake.serviceImpactingNow) {
    add("incident_route_required", "serviceImpactingNow", "Active impact must use the incident/support flow.");
  }
  if (intake.requestClass === "ad_hoc" || intake.requestClass === "emergency") {
    if (![intake.adHocReason, intake.adHocPriority, intake.businessImpact, intake.scheduleExceptionReason]
      .every((value) => Boolean(value?.trim()))) {
      add("ad_hoc_details_required", "requestClass", "Reason, priority, business impact, and schedule exception are required.");
    }
  }
  const start = Date.parse(intake.windowStartUtc);
  const end = Date.parse(intake.windowEndUtc);
  if (!validDate(intake.windowStartUtc) || !validDate(intake.windowEndUtc) || start >= end) {
    add("window_invalid", "windowStartUtc", "Deployment window must contain valid UTC instants with start before end.");
  }
  if (!intake.changeTypes.length || !intake.applications.length || !intake.clients.length) {
    add("scope_required", "changeTypes", "Change type, application, and client scope are required.");
  }
  if (![intake.deploymentContact, intake.applicationContact, intake.escalationContact]
    .every((value) => value.trim().length > 0)) {
    add("contact_required", "deploymentContact", "Deployment, application, and escalation contacts are required.");
  }
  if (!intake.repositoryUrls.length) add("repository_required", "repositoryUrls", "At least one repository is required.");
  if (!intake.noPrRequired && !intake.productionPrUrls.length) {
    add("pr_required", "productionPrUrls", "A production PR is required unless explicitly marked not applicable.");
  }
  if (!intake.sourceBranch.trim() || !intake.targetBranch.trim()) {
    add("source_control_required", "sourceBranch", "Source and target branches are required.");
  }
  if (!intake.deploymentMethod.trim() || !intake.workflowName.trim() ||
      !intake.targetEnvironment.trim() || !Object.keys(intake.workflowInputs).length) {
    add("workflow_required", "workflowName", "Method, workflow, environment, and exact inputs are required.");
  }
  if (!intake.developmentReady || !intake.productionReady ||
      intake.lowerEnvironmentValidation === "no" || !intake.lowerEnvironmentTested.length) {
    add("readiness_incomplete", "productionReady", "Development, lower-environment, and production readiness must be complete.");
  }
  if (intake.manualSteps.some((item) =>
    !item.instruction.trim()
    || !item.owner.trim()
    || !item.evidenceRequired
    || !item.validationInstruction?.trim()
  )) {
    add(
      "manual_step_incomplete",
      "manualSteps",
      "Every manual step requires an owner, exact instruction, evidence, and a validation instruction.",
    );
  }
  if (!intake.validationSteps.length || !intake.expectedProductionResult.trim()) {
    add("validation_required", "validationSteps", "Validation steps and the expected production result are required.");
  }
  if (intake.deferredValidation) {
    const d = intake.deferredValidation;
    if (![d.reason, d.trigger, d.owner, d.monitoringPlan].every((v) => v.trim()) || !validDate(d.expectedDateUtc)) {
      add("validation_required", "deferredValidation", "Deferred validation requires a reason, trigger, date, owner, and monitoring plan.");
    }
  }
  if (intake.rollbackAvailability === "yes" && (!intake.rollbackSteps.length || !intake.rollbackOwner?.trim())) {
    add("rollback_required", "rollbackSteps", "Rollback steps and an owner are required.");
  }
  if (intake.backupRequired && !intake.backupEvidenceIds.length) {
    add("backup_evidence_required", "backupEvidenceIds", "Backup evidence is a hard stop for destructive or database changes.");
  }
  if (intake.facts.some((fact) =>
    ["proposed", "open_item", "tbd"].includes(fact.classification) && !fact.confirmedBy)) {
    add("uncertain_executable_fact", "facts", "Uncertain facts require human confirmation before becoming executable.");
  }
  return issues;
}

const transitions: Record<DeploymentStatus, readonly DeploymentStatus[]> = {
  draft: ["submitted", "cancelled"],
  submitted: ["devops_review", "cancelled"],
  devops_review: ["needs_information", "access_blocked", "approval_blocked", "ready", "cancelled"],
  needs_information: ["devops_review", "cancelled"],
  access_blocked: ["devops_review", "deferred", "cancelled"],
  approval_blocked: ["devops_review", "deferred", "cancelled"],
  ready: ["scheduled", "deferred", "cancelled"],
  scheduled: ["waiting_for_window", "deferred", "cancelled"],
  waiting_for_window: ["change_approval_pending", "ready_to_deploy", "deferred", "cancelled"],
  change_approval_pending: ["ready_to_deploy", "approval_blocked", "cancelled"],
  ready_to_deploy: ["in_progress", "cancelled"],
  in_progress: ["waiting_for_environment_approval", "waiting_for_manual_step", "validation_pending", "failed", "completed", "partially_completed"],
  waiting_for_environment_approval: ["in_progress", "failed", "cancelled"],
  waiting_for_manual_step: ["in_progress", "failed", "rollback_in_progress"],
  validation_pending: ["completed", "completed_with_deferred_validation", "failed", "rollback_in_progress"],
  failed: ["rollback_in_progress", "partially_completed", "cancelled"],
  rollback_in_progress: ["rolled_back", "failed"],
  completed: ["change_closure"],
  completed_with_deferred_validation: ["change_closure"],
  change_closure: ["closed"],
  closed: [],
  cancelled: [],
  deferred: ["devops_review", "scheduled", "cancelled"],
  rolled_back: ["change_closure"],
  partially_completed: ["validation_pending", "rollback_in_progress", "change_closure"],
};

export function canTransition(from: DeploymentStatus, to: DeploymentStatus): boolean {
  return transitions[from].includes(to);
}

export interface TransitionContext {
  nowUtc: string;
  actorId: string;
  requesterId: string;
  approverIds: string[];
  hasRequiredAccess: boolean;
  approvalsComplete: boolean;
}

export function transitionBlockers(
  intake: DeploymentIntake,
  from: DeploymentStatus,
  to: DeploymentStatus,
  context: TransitionContext,
): string[] {
  if (!canTransition(from, to)) return [`Transition ${from} → ${to} is not permitted.`];
  const blockers: string[] = [];
  if (to === "submitted") blockers.push(...validateIntake(intake).map((issue) => issue.message));
  if (to === "ready" && !context.hasRequiredAccess) blockers.push("Required repository, workflow, and environment capabilities are not confirmed.");
  if (["ready", "ready_to_deploy", "in_progress"].includes(to) && !context.approvalsComplete) {
    blockers.push("Required approvals are incomplete.");
  }
  if (to === "in_progress") {
    if (!context.hasRequiredAccess) {
      blockers.push("Repository, workflow, change, and environment permissions must be reverified immediately before execution.");
    }
    const now = Date.parse(context.nowUtc);
    if (now < Date.parse(intake.windowStartUtc) || now > Date.parse(intake.windowEndUtc)) {
      blockers.push("Production execution is outside the approved deployment window.");
    }
    if (context.actorId === context.requesterId || context.approverIds.includes(context.actorId)) {
      blockers.push("Four-eyes separation requires a deployment executor distinct from requester and approvers.");
    }
  }
  return blockers;
}

export type PlaybookStepType =
  | "verify_pr_approval" | "verify_checks" | "verify_branch" | "merge_pr"
  | "create_change" | "wait_for_change_approval" | "dispatch_workflow"
  | "manual_step" | "attach_evidence" | "validate" | "rollback"
  | "notify_support" | "close_change";

export interface PlaybookStep {
  id: string;
  order: number;
  type: PlaybookStepType;
  title: string;
  requiredRole: string;
  requiresHumanConfirmation: boolean;
  evidenceRequired: boolean;
  instructions: string;
  validationInstruction?: string;
  activation: "always" | "on_success" | "on_failure";
  status: "pending" | "blocked" | "completed" | "skipped";
}

export interface DeploymentPlaybook {
  deploymentId: string;
  tenantId: string;
  version: number;
  generatedAtUtc: string;
  status: DeploymentStatus;
  scope: string;
  repositoryUrls: string[];
  productionPrUrls: string[];
  window: { startUtc: string; endUtc: string; displayTimeZone: TimeZoneCode };
  workflowInputs: Record<string, string>;
  steps: PlaybookStep[];
  contacts: { deployment: string; application: string; escalation: string };
  sourceFactIds: string[];
}

export function generatePlaybook(intake: DeploymentIntake, generatedAtUtc: string, version = 1): DeploymentPlaybook {
  const step = (
    type: PlaybookStepType, title: string, role: string, instructions: string,
    evidenceRequired = false,
    activation: PlaybookStep["activation"] = "always",
    validationInstruction?: string,
  ): Omit<PlaybookStep, "id" | "order"> => ({
    type,
    title,
    requiredRole: role,
    instructions,
    evidenceRequired,
    activation,
    ...(validationInstruction ? { validationInstruction } : {}),
    requiresHumanConfirmation: true,
    status: "pending",
  });
  const raw = [
    step("verify_pr_approval", "Verify peer and Code Owner approvals", "devops", "Confirm each production PR approval independently from merge capability."),
    step("verify_checks", "Verify blocking checks", "devops", "Review required jobs; unknown failures block completion."),
    step("verify_branch", "Verify source and target branches", "devops", `${intake.sourceBranch} → ${intake.targetBranch}`),
    step("create_change", "Create or verify change", "devops", `Method: ${intake.changeCreationMethod}`, true),
    step("wait_for_change_approval", "Confirm change approvals", "it_approver", "IT and business approval remain separate from merge access."),
    step("merge_pr", "Perform authorized production merge", "devops", "Merge only during the approved window.", true),
    step("dispatch_workflow", `Run ${intake.workflowName}`, "devops", "Use the exact immutable workflow inputs shown in this playbook.", true),
    ...intake.manualSteps.map((item) => step(
      "manual_step",
      item.instruction,
      item.owner,
      item.instruction,
      item.evidenceRequired,
      "always",
      item.validationInstruction,
    )),
    ...intake.validationSteps.map((item) => step("validate", item.instruction, item.owner, item.instruction, item.evidenceRequired, "on_success")),
    ...intake.rollbackSteps.map((item) => step("rollback", item.instruction, intake.rollbackOwner ?? item.owner, item.instruction, item.evidenceRequired, "on_failure")),
    step("notify_support", "Notify support", "devops", "Communicate deployment and validation outcome."),
    step("close_change", "Close change", "devops", "Close only after validation evidence or documented deferred validation.", true, "on_success"),
  ];
  return {
    deploymentId: intake.id, tenantId: intake.tenantId, version, generatedAtUtc,
    status: "submitted",
    scope: `${intake.title}: ${intake.changeTypes.join(", ")} for ${intake.applications.join(", ")}`,
    repositoryUrls: [...intake.repositoryUrls],
    productionPrUrls: [...intake.productionPrUrls],
    window: { startUtc: intake.windowStartUtc, endUtc: intake.windowEndUtc, displayTimeZone: intake.displayTimeZone },
    workflowInputs: { ...intake.workflowInputs },
    steps: raw.map((item, index) => ({ ...item, id: `step-${index + 1}`, order: index + 1 })),
    contacts: { deployment: intake.deploymentContact, application: intake.applicationContact, escalation: intake.escalationContact },
    sourceFactIds: intake.facts.map((fact) => fact.id),
  };
}

const SECRET_ASSIGNMENT_PATTERN =
  /(password|passwd|token|secret|api[_-]?key)\s*[:=]\s*[^\s,;]+/gi;
const BEARER_PATTERN = /bearer\s+[a-z0-9._~+\/-]+=*/gi;

export function redactSecrets(value: string): string {
  return value
    .replace(SECRET_ASSIGNMENT_PATTERN, "$1=[REDACTED]")
    .replace(BEARER_PATTERN, "Bearer [REDACTED]");
}
