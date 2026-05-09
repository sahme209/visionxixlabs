// ---------------------------------------------------------------------------
// Axiom Platform Enums
// Mirror Prisma schema enums — use these in application code for type safety.
// Values match database enum values exactly (lowercase/snake_case).
// ---------------------------------------------------------------------------

export enum CloudProvider {
  AWS = "aws",
  Azure = "azure",
  GCP = "gcp",
}

export enum AgentRunStatus {
  Pending = "pending",
  Running = "running",
  Completed = "completed",
  Failed = "failed",
  PartiallyCompleted = "partially_completed",
}

export enum AgentTrigger {
  Manual = "manual",
  Scheduled = "scheduled",
  Drift = "drift",
  Onboarding = "onboarding",
  Webhook = "webhook",
}

export enum FindingCategory {
  Cost = "cost",
  Resilience = "resilience",
  Security = "security",
  Performance = "performance",
  Compliance = "compliance",
}

export enum FindingSeverity {
  Info = "info",
  Low = "low",
  Medium = "medium",
  High = "high",
  Critical = "critical",
}

export enum ActionDisposition {
  AutoFixCandidate = "auto_fix_candidate",
  ApprovalRequired = "approval_required",
  ReportOnly = "report_only",
  Blocked = "blocked",
}

export enum ActionType {
  ResizeCompute = "resize_compute",
  ApplyStoragePolicy = "apply_storage_policy",
  PurchaseCommitment = "purchase_commitment",
  DecommissionCompute = "decommission_compute",
}

export enum RiskLevel {
  Low = "low",
  Medium = "medium",
  High = "high",
}

export enum ApprovalDecision {
  ApproveAll = "approve_all",
  ApprovePartial = "approve_partial",
  RejectAll = "reject_all",
}

export enum AuditEventStatus {
  Pending = "pending",
  PrecheckFailed = "precheck_failed",
  Applied = "applied",
  Verified = "verified",
  Failed = "failed",
  RolledBack = "rolled_back",
}

export enum ScheduleFrequency {
  Daily = "daily",
  Weekly = "weekly",
}

export enum NotificationType {
  ScanDiff = "scan_diff",
  NewHighRisk = "new_high_risk",
  SavingsIncreased = "savings_increased",
  RiskResolved = "risk_resolved",
  ScanFailed = "scan_failed",
}

export enum RiskTolerance {
  Conservative = "conservative",
  Moderate = "moderate",
  Aggressive = "aggressive",
}

export enum ApprovalPolicy {
  RequireAll = "require_all",
  AutoLowRisk = "auto_low_risk",
  AutoSafe = "auto_safe",
}

export enum OutputFormat {
  Terraform = "terraform",
  CLI = "cli",
  JSON = "json",
}

export enum BusinessContext {
  Startup = "startup",
  Agency = "agency",
  Enterprise = "enterprise",
  Ecommerce = "ecommerce",
  Healthcare = "healthcare",
  Fintech = "fintech",
  SaaS = "saas",
  Other = "other",
}

export enum ApprovalItemStatus {
  Pending = "pending",
  Approved = "approved",
  Rejected = "rejected",
  Snoozed = "snoozed",
  Applied = "applied",
  Failed = "failed",
  Expired = "expired",
}

export enum AutopilotMode {
  ObserveOnly = "observe_only",
  Recommend = "recommend",
  AssistedApply = "assisted_apply",
  FullGuarded = "full_guarded",
}

export enum AgentTaskType {
  ScanCloud = "scan_cloud",
  AnalyzeSnapshot = "analyze_snapshot",
  GenerateExecutionPlan = "generate_execution_plan",
  GenerateTerraform = "generate_terraform",
  RequestApproval = "request_approval",
  ApplyAction = "apply_action",
  VerifyAction = "verify_action",
  RollbackAction = "rollback_action",
  ScheduleNextScan = "schedule_next_scan",
}

export enum AgentTaskStatus {
  Pending = "pending",
  Running = "running",
  Completed = "completed",
  Failed = "failed",
  Skipped = "skipped",
}

export enum OrgRole {
  Owner = "owner",
  Admin = "admin",
  Operator = "operator",
  SecurityReviewer = "security_reviewer",
  FinanceViewer = "finance_viewer",
  ReadOnly = "read_only",
}

export enum ApprovalChainStatus {
  PendingApprovals = "pending_approvals",
  Approved = "approved",
  Rejected = "rejected",
  Escalated = "escalated",
  Expired = "expired",
  Bypassed = "bypassed",
}

// ---------------------------------------------------------------------------
// Savings range — used wherever estimated savings appear
// ---------------------------------------------------------------------------

export type SavingsEstimate = {
  monthlyLow: number;
  monthlyHigh: number;
  yearlyLow: number;
  yearlyHigh: number;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export const CLOUD_PROVIDER_LABELS: Record<CloudProvider, string> = {
  [CloudProvider.AWS]: "AWS",
  [CloudProvider.Azure]: "Azure",
  [CloudProvider.GCP]: "Google Cloud",
};

export const ALL_PROVIDERS = Object.values(CloudProvider);
export const ALL_DISPOSITIONS = Object.values(ActionDisposition);
export const ALL_STATUSES = Object.values(AgentRunStatus);
