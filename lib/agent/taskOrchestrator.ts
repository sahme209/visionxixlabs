/**
 * Task orchestrator — typed operational tasks the copilot creates and the
 * platform tracks across surfaces (command center, workflows, onboarding,
 * ReleaseOps, desktop).
 *
 * Each task is structured, traceable, and consumable by both UI and copilot
 * suggestions.
 */

export type TaskType =
  | "connect_provider"
  | "validate_credentials"
  | "run_scan"
  | "review_findings"
  | "generate_execution_plan"
  | "request_approval"
  | "export_terraform"
  | "prepare_rollback"
  | "verify_execution"
  | "investigate_drift"
  | "connect_github"
  | "review_release_readiness"
  | "configure_desktop"
  | "export_audit_bundle"
  | "troubleshoot_error"
  | "read_docs";

export type TaskStatus =
  | "pending"
  | "in_progress"
  | "blocked"
  | "ready_for_review"
  | "completed"
  | "dismissed";

export type TaskPriority = "low" | "medium" | "high" | "critical";

export interface OperationalTask {
  id: string;
  title: string;
  description: string;
  type: TaskType;
  status: TaskStatus;
  priority: TaskPriority;
  owner?: string;
  /** Inputs the user must provide to complete the task. */
  requiredInputs?: string[];
  /** Related provider, if any. */
  relatedProvider?: "aws" | "azure" | "gcp";
  /** Related connector ID, if any. */
  relatedConnectorId?: string;
  /** Related resources. */
  relatedResourceIds?: string[];
  /** Related policy check IDs that drove this task. */
  relatedPolicyCheckIds?: string[];
  /** Related workflow if part of a recurring job. */
  relatedWorkflowId?: string;
  /** Doc deep-link explaining the task. */
  docsHref?: string;
  /** Concrete next action the user should take. */
  nextAction?: { label: string; href: string };
  /** If status === "blocked", why. */
  blockedReason?: string;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

interface TaskBuilderOptions {
  title: string;
  description: string;
  type: TaskType;
  priority?: TaskPriority;
  relatedProvider?: OperationalTask["relatedProvider"];
  relatedConnectorId?: string;
  relatedResourceIds?: string[];
  docsHref?: string;
  nextAction?: OperationalTask["nextAction"];
}

export function buildTask(opts: TaskBuilderOptions): OperationalTask {
  const now = new Date().toISOString();
  return {
    id: `task_${opts.type}_${Date.now().toString(36)}`,
    title: opts.title,
    description: opts.description,
    type: opts.type,
    status: "pending",
    priority: opts.priority ?? "medium",
    relatedProvider: opts.relatedProvider,
    relatedConnectorId: opts.relatedConnectorId,
    relatedResourceIds: opts.relatedResourceIds,
    docsHref: opts.docsHref,
    nextAction: opts.nextAction,
    createdAt: now,
    updatedAt: now,
  };
}

// ---------------------------------------------------------------------------
// Sorting / filtering helpers
// ---------------------------------------------------------------------------

const PRIORITY_ORDER: Record<TaskPriority, number> = { critical: 0, high: 1, medium: 2, low: 3 };

/** Sort tasks: priority desc, then by createdAt desc. */
export function sortByPriority(tasks: OperationalTask[]): OperationalTask[] {
  return [...tasks].sort((a, b) => {
    const p = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    if (p !== 0) return p;
    return b.createdAt.localeCompare(a.createdAt);
  });
}

/** Open tasks — anything that's not completed or dismissed. */
export function openTasks(tasks: OperationalTask[]): OperationalTask[] {
  return tasks.filter((t) => t.status !== "completed" && t.status !== "dismissed");
}

/** Group tasks by type. */
export function groupByType(tasks: OperationalTask[]): Record<TaskType, OperationalTask[]> {
  return tasks.reduce(
    (acc, t) => {
      (acc[t.type] ??= []).push(t);
      return acc;
    },
    {} as Record<TaskType, OperationalTask[]>
  );
}

/** Advance a task to a new status with audit trail. */
export function advanceTask(task: OperationalTask, to: TaskStatus, note?: string): OperationalTask {
  return {
    ...task,
    status: to,
    updatedAt: new Date().toISOString(),
    blockedReason: to === "blocked" ? note : undefined,
  };
}
