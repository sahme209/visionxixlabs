/**
 * Scheduled Scans — typed contract.
 *
 * Recurring read-only analysis schedule. Every scheduled task wires
 * through read-only adapters — apply paths are never reachable from
 * the scheduler. Cadence + status + lastRunAt + nextRunAt + sourceMode
 * are tracked per task; persistence ships when the scheduler runtime
 * lands.
 */

export type ScheduledTaskType =
  | "aws_readonly_scan"
  | "github_readonly_sync"
  | "security_scanner_run"
  | "releaseops_readiness_check"
  | "trust_evidence_refresh"
  | "integration_health_check"
  | "readiness_refresh";

export type ScheduledCadence =
  | "every_15_minutes"
  | "hourly"
  | "every_6_hours"
  | "daily"
  | "weekly"
  | "manual";

export type ScheduledTaskStatus =
  | "enabled"
  | "disabled_until_credentials"
  | "disabled_by_policy"
  | "paused"
  | "blocked"
  | "running";

export type ScheduledLastRunOutcome =
  | "succeeded"
  | "succeeded_with_warnings"
  | "failed"
  | "never_run"
  | "skipped";

export interface ScheduledScanTask {
  id: string;
  taskType: ScheduledTaskType;
  cadence: ScheduledCadence;
  status: ScheduledTaskStatus;
  sourceMode: string;
  /** Human label for UI rendering. */
  label: string;
  /** What this task does in one line. */
  description: string;
  /** Last time the task executed (or "never_run"). */
  lastRunAt?: string;
  lastRunOutcome: ScheduledLastRunOutcome;
  /** Honest predicted next run (or undefined when disabled/manual). */
  nextRunAt?: string;
  /** Missing config preventing scheduling. */
  missingConfig: string[];
  /** Findings produced by the most recent run. */
  lastRunFindingsCount: number;
  /** Risks created by the most recent run. */
  lastRunRisksCreated: number;
  /** Limitations. */
  limitations: string[];
  /** Safe next action. */
  safeNextAction: { label: string; href: string };
  /** Evidence ref the operator can audit. */
  evidenceRef: string;
}

export interface ScheduledScanReport {
  generatedAt: string;
  tenantId?: string;
  tasks: ScheduledScanTask[];
  summary: {
    total: number;
    enabled: number;
    disabled: number;
    paused: number;
    blocked: number;
    lastSucceeded: number;
    lastFailed: number;
    neverRun: number;
  };
  /** Hard literal — the scheduler never reaches an apply path. */
  safetyContract: "scheduled_tasks_read_only_only";
  /** Honest "scheduler runtime not yet wired" note. */
  limitations: string[];
  safeNextAction: { label: string; href: string };
}

export const TASK_TYPE_LABEL: Record<ScheduledTaskType, string> = {
  aws_readonly_scan:           "AWS read-only scan",
  github_readonly_sync:        "GitHub read-only sync",
  security_scanner_run:        "Security scanner run",
  releaseops_readiness_check:  "ReleaseOps readiness check",
  trust_evidence_refresh:      "Trust evidence refresh",
  integration_health_check:    "Integration health check",
  readiness_refresh:           "Readiness refresh",
};

export const CADENCE_LABEL: Record<ScheduledCadence, string> = {
  every_15_minutes: "Every 15 min",
  hourly:           "Hourly",
  every_6_hours:    "Every 6h",
  daily:            "Daily",
  weekly:           "Weekly",
  manual:           "Manual",
};

export const STATUS_TONE: Record<ScheduledTaskStatus, "emerald" | "cyan" | "amber" | "rose" | "zinc"> = {
  enabled:                    "emerald",
  running:                    "cyan",
  paused:                     "amber",
  blocked:                    "rose",
  disabled_until_credentials: "amber",
  disabled_by_policy:         "rose",
};

export const STATUS_LABEL: Record<ScheduledTaskStatus, string> = {
  enabled:                    "Enabled",
  running:                    "Running",
  paused:                     "Paused",
  blocked:                    "Blocked",
  disabled_until_credentials: "Disabled · credentials",
  disabled_by_policy:         "Disabled · policy",
};

export const OUTCOME_LABEL: Record<ScheduledLastRunOutcome, string> = {
  succeeded:               "Succeeded",
  succeeded_with_warnings: "Succeeded · warnings",
  failed:                  "Failed",
  never_run:               "Never run",
  skipped:                 "Skipped",
};
