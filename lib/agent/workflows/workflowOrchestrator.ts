/**
 * Workflow orchestrator — hydrates a WorkflowDefinition into a sequence of
 * AgentJobs and advances them step-by-step through the executor registry.
 *
 * The orchestrator is the safety boundary: every step is checked against
 * the policy engine before it runs; approval/rollback/audit requirements
 * are enforced; retries follow retryPolicy; failures are surfaced honestly.
 *
 * Pure orchestration logic — durable persistence is the caller's concern.
 */

import { type AgentJob, buildJob, advanceJob, type JobStatus, type SafetyStatus } from "@/lib/agent/jobs/jobModel";
import type { WorkflowDefinition, WorkflowStep } from "@/lib/agent/workflows/workflowModel";
import { executeStep, type ExecutorResult } from "@/lib/agent/workflows/stepExecutors";
import { evaluateRetry, statusAfterFailure, type FailureKind } from "@/lib/agent/workflows/retryPolicy";

// ---------------------------------------------------------------------------
// Run state
// ---------------------------------------------------------------------------

export type RunStatus = "queued" | "running" | "paused_for_approval" | "paused_for_input" | "blocked" | "completed" | "failed" | "cancelled";

export interface WorkflowRun {
  id: string;
  organizationId: string;
  workflowId: string;
  status: RunStatus;
  /** Index of the current step (0-based). */
  currentStepIndex: number;
  /** Jobs created so far — newest last. */
  jobs: AgentJob[];
  /** Outputs accumulated from completed steps, keyed by step index. */
  outputs: Record<number, ExecutorResult["output"]>;
  /** Reason set when status === "blocked" or "failed". */
  blockedReason?: string;
  startedAt: string;
  updatedAt: string;
  completedAt?: string;
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

interface StartOptions {
  organizationId: string;
  userId?: string;
}

/**
 * Start a new workflow run. Creates the first job; the caller persists it
 * and then calls `advanceRun` to progress through subsequent steps.
 */
export function startWorkflow(definition: WorkflowDefinition, opts: StartOptions): WorkflowRun {
  const firstStep = definition.steps[0];
  if (!firstStep) {
    throw new Error(`Workflow ${definition.id} has no steps.`);
  }

  const firstJob = buildJob({
    organizationId: opts.organizationId,
    userId: opts.userId,
    type: firstStep.jobType,
    title: firstStep.label,
    description: firstStep.description,
    maxRetries: firstStep.maxRetries,
    createdBy: "system",
  });
  firstJob.relatedWorkflowId = definition.id;
  firstJob.currentStepIndex = 0;
  firstJob.currentStepLabel = firstStep.label;

  const now = new Date().toISOString();
  return {
    id: `run_${definition.id}_${Date.now().toString(36)}`,
    organizationId: opts.organizationId,
    workflowId: definition.id,
    status: "queued",
    currentStepIndex: 0,
    jobs: [firstJob],
    outputs: {},
    startedAt: now,
    updatedAt: now,
  };
}

/**
 * Advance a workflow run by one step.
 *
 * The job at the current step is executed; based on the executor outcome,
 * the run either:
 *   - completes (terminal step finished successfully)
 *   - advances to the next step (creates the next job)
 *   - pauses for approval / input
 *   - blocks (policy / credentials / dependency)
 *   - retries (if retryable)
 *   - fails
 */
export async function advanceRun(run: WorkflowRun, definition: WorkflowDefinition): Promise<WorkflowRun> {
  const step = definition.steps[run.currentStepIndex];
  if (!step) return { ...run, status: "completed", completedAt: new Date().toISOString(), updatedAt: new Date().toISOString() };

  const job = currentJob(run);
  if (!job) return failRun(run, "Workflow run has no current job — internal error.");

  const result = await executeStep(job);

  // Map executor outcome → next run state
  switch (result.outcome) {
    case "completed":
      return handleStepCompleted(run, definition, step, result);
    case "needs_approval":
      return pauseForApproval(run, job, result);
    case "needs_input":
      return pauseForInput(run, job);
    case "blocked":
      return blockRun(run, job, result.safety.reason ?? "Blocked by step executor");
    case "deferred":
      return { ...run, updatedAt: new Date().toISOString() };
    case "failed": {
      const failureKind = inferFailureKind(result.error ?? "");
      const decision = evaluateRetry(job, failureKind, result.error);
      if (decision.retry) {
        const retried = advanceJob(job, { status: "retrying", retryCount: job.retryCount + 1, updatedAt: new Date().toISOString() });
        return {
          ...run,
          jobs: replaceJob(run.jobs, retried),
          status: "running",
          updatedAt: new Date().toISOString(),
        };
      }
      const status = statusAfterFailure(decision, failureKind);
      const failedJob = advanceJob(job, { status, failureReason: result.error, blockedReason: decision.reason });
      return {
        ...run,
        jobs: replaceJob(run.jobs, failedJob),
        status: terminalStatusFromJobStatus(status),
        blockedReason: decision.reason,
        updatedAt: new Date().toISOString(),
      };
    }
  }
}

// ---------------------------------------------------------------------------
// Outcome handlers
// ---------------------------------------------------------------------------

function handleStepCompleted(run: WorkflowRun, definition: WorkflowDefinition, step: WorkflowStep, result: ExecutorResult): WorkflowRun {
  const completedJob = advanceJob(currentJob(run)!, { status: "completed", progress: 1, safetyStatus: result.safety.status as SafetyStatus });
  const nextIndex = run.currentStepIndex + 1;
  const isLastStep = nextIndex >= definition.steps.length;

  if (isLastStep) {
    return {
      ...run,
      jobs: replaceJob(run.jobs, completedJob),
      outputs: { ...run.outputs, [run.currentStepIndex]: result.output },
      status: "completed",
      completedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  const nextStep = definition.steps[nextIndex];
  const nextJob = buildJob({
    organizationId: run.organizationId,
    type: nextStep.jobType,
    title: nextStep.label,
    description: nextStep.description,
    maxRetries: nextStep.maxRetries,
  });
  nextJob.relatedWorkflowId = definition.id;
  nextJob.currentStepIndex = nextIndex;
  nextJob.currentStepLabel = nextStep.label;

  return {
    ...run,
    jobs: [...replaceJob(run.jobs, completedJob), nextJob],
    outputs: { ...run.outputs, [run.currentStepIndex]: result.output },
    currentStepIndex: nextIndex,
    status: "running",
    updatedAt: new Date().toISOString(),
  };
  void step;
}

function pauseForApproval(run: WorkflowRun, job: AgentJob, result: ExecutorResult): WorkflowRun {
  const paused = advanceJob(job, { status: "waiting_for_approval", safetyStatus: "needs_approval", blockedReason: result.safety.reason ?? "Approval required" });
  return {
    ...run,
    jobs: replaceJob(run.jobs, paused),
    status: "paused_for_approval",
    blockedReason: result.safety.reason ?? "Approval required",
    updatedAt: new Date().toISOString(),
  };
}

function pauseForInput(run: WorkflowRun, job: AgentJob): WorkflowRun {
  const paused = advanceJob(job, { status: "waiting_for_input" });
  return {
    ...run,
    jobs: replaceJob(run.jobs, paused),
    status: "paused_for_input",
    updatedAt: new Date().toISOString(),
  };
}

function blockRun(run: WorkflowRun, job: AgentJob, reason: string): WorkflowRun {
  const blockedJob = advanceJob(job, { status: "blocked_by_policy", blockedReason: reason, safetyStatus: "blocked" });
  return {
    ...run,
    jobs: replaceJob(run.jobs, blockedJob),
    status: "blocked",
    blockedReason: reason,
    updatedAt: new Date().toISOString(),
  };
}

function failRun(run: WorkflowRun, reason: string): WorkflowRun {
  return {
    ...run,
    status: "failed",
    blockedReason: reason,
    completedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function currentJob(run: WorkflowRun): AgentJob | undefined {
  return run.jobs.find((j) => j.currentStepIndex === run.currentStepIndex);
}

function replaceJob(jobs: AgentJob[], updated: AgentJob): AgentJob[] {
  return jobs.map((j) => (j.id === updated.id ? updated : j));
}

function inferFailureKind(error: string): FailureKind {
  const e = error.toLowerCase();
  if (/timeout/.test(e)) return "timeout";
  if (/rate.?limit|throttl/.test(e)) return "rate_limited";
  if (/permission|forbidden|access.?denied/.test(e)) return "permission_denied";
  if (/credential|unauthor/.test(e)) return "credentials_invalid";
  if (/policy/.test(e)) return "policy_blocked";
  if (/input/.test(e)) return "user_input_required";
  if (/network|socket|connection.?refused/.test(e)) return "transient_network";
  return "external_api_error";
}

function terminalStatusFromJobStatus(s: JobStatus): RunStatus {
  if (s === "blocked_by_policy" || s === "blocked_by_credentials" || s === "blocked_by_dependency") return "blocked";
  if (s === "waiting_for_input") return "paused_for_input";
  if (s === "waiting_for_approval") return "paused_for_approval";
  return "failed";
}
