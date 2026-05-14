/**
 * Workflow recovery engine.
 *
 * Detects stuck/partial workflow runs and recommends a safe next move. The
 * orchestrator persists `WorkflowRun` records (status, jobs, outputs, last
 * update timestamp); this module reads those records and a set of declared
 * thresholds, then emits typed `RecoveryAction` suggestions.
 *
 * Why typed actions vs auto-fixing: recovery is one of the riskiest parts
 * of an operational system. Auto-resuming a partially-completed scan is
 * usually fine; auto-rerunning an execution_plan.build that already invoked
 * a connector is not. The module *recommends* — humans (or a downstream
 * policy decision) act.
 */

import type { WorkflowRun, RunStatus } from "@/lib/agent/workflows/workflowOrchestrator";
import type { AgentJob, JobStatus } from "@/lib/agent/jobs/jobModel";

// ---------------------------------------------------------------------------
// Health signals
// ---------------------------------------------------------------------------

export type WorkflowHealth = "healthy" | "stalled" | "stuck" | "failed" | "partial";

export interface RecoveryThresholds {
  /** Run hasn't advanced for this many ms while in "running" — stalled. */
  stalledRunningMs: number;
  /** Job has been "queued" longer than this — stuck. */
  stuckQueuedMs: number;
  /** Run sitting in paused_for_approval longer than this — flag for action. */
  approvalExpiryMs: number;
  /** Run sitting in paused_for_input longer than this — flag for action. */
  inputExpiryMs: number;
}

export const DEFAULT_RECOVERY_THRESHOLDS: RecoveryThresholds = {
  stalledRunningMs: 15 * 60 * 1000,   // 15 min
  stuckQueuedMs:    10 * 60 * 1000,   // 10 min
  approvalExpiryMs: 72 * 60 * 60 * 1000, // 3 days
  inputExpiryMs:    24 * 60 * 60 * 1000, // 1 day
};

// ---------------------------------------------------------------------------
// Recovery actions
// ---------------------------------------------------------------------------

export type RecoveryActionKind =
  | "resume_from_last_safe_step"
  | "retry_safe_step"
  | "mark_failed"
  | "request_user_input"
  | "request_approval"
  | "create_incident_event"
  | "schedule_follow_up_job"
  | "preserve_partial_output"
  | "no_action";

export interface RecoveryAction {
  kind: RecoveryActionKind;
  /** Human-readable label rendered next to the suggestion. */
  label: string;
  /** Operator-facing rationale. */
  reason: string;
  /** Whether this action can be performed automatically (vs requiring human review). */
  autoSafe: boolean;
  /** Optional reference into the workflow run — e.g. step index to resume from. */
  targetStepIndex?: number;
}

export interface WorkflowDiagnosis {
  runId: string;
  organizationId: string;
  workflowId: string;
  health: WorkflowHealth;
  reason: string;
  /** Suggested action — the *recommended* primary move. */
  action: RecoveryAction;
  /** Other plausible actions, ranked. */
  alternateActions?: RecoveryAction[];
}

// ---------------------------------------------------------------------------
// Diagnose
// ---------------------------------------------------------------------------

/**
 * Inspect a workflow run and return a diagnosis. Pure — does no IO.
 * `now` is parameterised so tests can be deterministic.
 */
export function diagnoseWorkflow(run: WorkflowRun, thresholds: RecoveryThresholds = DEFAULT_RECOVERY_THRESHOLDS, now: Date = new Date()): WorkflowDiagnosis {
  const updatedMs = Date.parse(run.updatedAt);
  const elapsedMs = Math.max(0, now.getTime() - updatedMs);

  // Terminal: completed → healthy, cancelled → no_action, failed → mark_failed
  if (run.status === "completed") {
    return diag(run, "healthy", "Run completed.", { kind: "no_action", label: "No action needed", reason: "Run is complete.", autoSafe: true });
  }
  if (run.status === "cancelled") {
    return diag(run, "healthy", "Run cancelled.", { kind: "no_action", label: "No action needed", reason: "Run was cancelled.", autoSafe: true });
  }
  if (run.status === "failed") {
    return diag(run, "failed", "Run is in failed state.", {
      kind: "mark_failed",
      label: "Mark as terminal",
      reason: "Run already failed. Preserve outputs and audit before any further action.",
      autoSafe: false,
    }, [
      { kind: "preserve_partial_output", label: "Preserve partial output", reason: "Keep accumulated step outputs for forensic review.", autoSafe: true },
      { kind: "create_incident_event", label: "Open incident", reason: "Surface to ops if not already.", autoSafe: false },
    ]);
  }

  // Paused for approval
  if (run.status === "paused_for_approval") {
    if (elapsedMs > thresholds.approvalExpiryMs) {
      return diag(run, "stuck", `Awaiting approval for ${formatMs(elapsedMs)}.`, {
        kind: "request_approval",
        label: "Ping approvers",
        reason: "Approval has been pending past the configured expiry window.",
        autoSafe: false,
      });
    }
    return diag(run, "healthy", "Waiting on approval (within window).", {
      kind: "no_action",
      label: "Waiting on approver",
      reason: "Run is paused as designed.",
      autoSafe: true,
    });
  }

  // Paused for input
  if (run.status === "paused_for_input") {
    if (elapsedMs > thresholds.inputExpiryMs) {
      return diag(run, "stuck", `Awaiting user input for ${formatMs(elapsedMs)}.`, {
        kind: "request_user_input",
        label: "Prompt user",
        reason: "User input has been pending past the configured window.",
        autoSafe: false,
      });
    }
    return diag(run, "healthy", "Waiting on user input.", {
      kind: "no_action",
      label: "Waiting on user",
      reason: "Run is paused as designed.",
      autoSafe: true,
    });
  }

  // Blocked
  if (run.status === "blocked") {
    return diag(run, "stuck", run.blockedReason ?? "Workflow blocked.", {
      kind: "preserve_partial_output",
      label: "Preserve outputs",
      reason: run.blockedReason ?? "Run is blocked — preserve evidence before any human action.",
      autoSafe: true,
    }, [
      { kind: "create_incident_event", label: "Open incident", reason: "Surface to ops.", autoSafe: false },
    ]);
  }

  // Running or queued — check stalling
  const stuckJobs = run.jobs.filter((j) => isJobStuck(j, thresholds, now));
  if (run.status === "queued" && elapsedMs > thresholds.stuckQueuedMs) {
    return diag(run, "stuck", `Queued for ${formatMs(elapsedMs)}.`, {
      kind: "retry_safe_step",
      label: "Retry first step",
      reason: "Run queued past the threshold — first step has not been picked up.",
      autoSafe: false,
      targetStepIndex: 0,
    });
  }
  if (run.status === "running" && elapsedMs > thresholds.stalledRunningMs) {
    return diag(run, "stalled", `Running but no progress for ${formatMs(elapsedMs)}.`, {
      kind: "resume_from_last_safe_step",
      label: "Resume from last safe step",
      reason: "Run hasn't advanced past the stall threshold.",
      autoSafe: false,
      targetStepIndex: run.currentStepIndex,
    });
  }

  if (stuckJobs.length > 0) {
    return diag(run, "stuck", `${stuckJobs.length} job(s) stuck in transient state.`, {
      kind: "retry_safe_step",
      label: "Retry current step",
      reason: "One or more jobs are sitting in a transient state past the threshold.",
      autoSafe: false,
      targetStepIndex: run.currentStepIndex,
    });
  }

  // Partial output but completed jobs lower than current index
  const hasPartial = Object.keys(run.outputs).length > 0 && run.status !== "completed";
  if (hasPartial && run.status === "running") {
    return diag(run, "partial", "Run is progressing with partial outputs.", {
      kind: "no_action",
      label: "Continue monitoring",
      reason: "Run is healthy but partial outputs exist — visible in workflow detail.",
      autoSafe: true,
    });
  }

  return diag(run, "healthy", "Run is operating within thresholds.", {
    kind: "no_action",
    label: "No action needed",
    reason: "Run is healthy.",
    autoSafe: true,
  });
}

function isJobStuck(job: AgentJob, thresholds: RecoveryThresholds, now: Date): boolean {
  const transientStatuses: JobStatus[] = ["queued", "retrying"];
  if (!transientStatuses.includes(job.status)) return false;
  const updated = Date.parse(job.updatedAt);
  return now.getTime() - updated > thresholds.stuckQueuedMs;
}

function diag(run: WorkflowRun, health: WorkflowHealth, reason: string, action: RecoveryAction, alternateActions?: RecoveryAction[]): WorkflowDiagnosis {
  return {
    runId: run.id,
    organizationId: run.organizationId,
    workflowId: run.workflowId,
    health,
    reason,
    action,
    alternateActions,
  };
}

function formatMs(ms: number): string {
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  if (ms < 60 * 60_000) return `${Math.round(ms / 60_000)}m`;
  if (ms < 24 * 60 * 60_000) return `${Math.round(ms / (60 * 60_000))}h`;
  return `${Math.round(ms / (24 * 60 * 60_000))}d`;
}

// ---------------------------------------------------------------------------
// Batch summarisation
// ---------------------------------------------------------------------------

export interface RecoveryFleetSummary {
  total: number;
  healthy: number;
  stalled: number;
  stuck: number;
  failed: number;
  partial: number;
  /** Diagnoses needing operator attention (anything except healthy). */
  actionable: WorkflowDiagnosis[];
}

export function summarizeRecoveryFleet(runs: WorkflowRun[], thresholds: RecoveryThresholds = DEFAULT_RECOVERY_THRESHOLDS, now: Date = new Date()): RecoveryFleetSummary {
  let healthy = 0, stalled = 0, stuck = 0, failed = 0, partial = 0;
  const actionable: WorkflowDiagnosis[] = [];
  for (const run of runs) {
    const d = diagnoseWorkflow(run, thresholds, now);
    if (d.health === "healthy") healthy++;
    else if (d.health === "stalled") { stalled++; actionable.push(d); }
    else if (d.health === "stuck") { stuck++; actionable.push(d); }
    else if (d.health === "failed") { failed++; actionable.push(d); }
    else if (d.health === "partial") partial++;
  }
  return { total: runs.length, healthy, stalled, stuck, failed, partial, actionable };
}
