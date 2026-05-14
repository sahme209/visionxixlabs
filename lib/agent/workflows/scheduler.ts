/**
 * Workflow scheduler — typed scheduled-workflow registry.
 *
 * Holds the typed contract for recurring workflows; the actual cron / queue
 * backend is the deployment's concern. The Workflows UI consumes this
 * registry to honestly show "scheduled", "configured but not active", etc.
 */

import { BUILTIN_WORKFLOWS, scheduledWorkflows, type WorkflowDefinition } from "./workflowModel";

// ---------------------------------------------------------------------------
// Schedule state
// ---------------------------------------------------------------------------

export type ScheduleState =
  | "active"          // Real cron is firing this workflow
  | "configured"      // Cron is configured but not yet observed firing
  | "preview"         // UI shows the schedule but it isn't wired to a real cron
  | "planned"         // Future capability
  | "failed"          // Last run errored
  | "paused";         // Manually paused by tenant admin

export interface ScheduledWorkflow {
  workflow: WorkflowDefinition;
  state: ScheduleState;
  cron: string;
  /** When the next run is expected. */
  nextRunAt?: string;
  /** Last run timestamp. */
  lastRunAt?: string;
  /** Last run status. */
  lastRunStatus?: "completed" | "failed" | "blocked" | "running";
  /** Number of runs this calendar week. */
  runsThisWeek: number;
  /** Honest note about why the state is what it is. */
  note?: string;
}

// ---------------------------------------------------------------------------
// Default schedule registry — honest preview state until real cron is wired
// ---------------------------------------------------------------------------

const DEFAULT_SCHEDULE: Record<string, Omit<ScheduledWorkflow, "workflow">> = {
  "wf.drift_detection": {
    state: "preview",
    cron: "0 */6 * * *",
    runsThisWeek: 0,
    note: "Cron configured. Recurring queue backend wires in next platform cycle.",
  },
  "wf.releaseops_readiness": {
    state: "preview",
    cron: "0 */12 * * *",
    runsThisWeek: 0,
    note: "Cron configured. Becomes active once a GitHub connector is connected.",
  },
  "wf.executive_summary": {
    state: "preview",
    cron: "0 9 * * 1",
    runsThisWeek: 0,
    note: "Weekly Monday 9am UTC. Wires when notification destinations are configured.",
  },
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Return all scheduled workflows with their state. Honest: preview-state
 * entries are tagged "preview" until a real scheduler backend is wired.
 */
export function listScheduledWorkflows(): ScheduledWorkflow[] {
  return scheduledWorkflows().map((wf) => {
    const cfg = DEFAULT_SCHEDULE[wf.id] ?? {
      state: "preview" as const,
      cron: wf.cron ?? "",
      runsThisWeek: 0,
      note: "No explicit schedule configuration — defaulting to preview state.",
    };
    return { workflow: wf, ...cfg };
  });
}

/**
 * Look up the next-run timestamp for a scheduled workflow.
 * Returns undefined when the schedule is preview/planned.
 */
export function nextRunFor(workflowId: string): string | undefined {
  const sw = listScheduledWorkflows().find((s) => s.workflow.id === workflowId);
  return sw?.nextRunAt;
}

/**
 * Summarize schedule states for the workflows UI.
 */
export function scheduleSummary(): Record<ScheduleState, number> {
  const out: Record<ScheduleState, number> = { active: 0, configured: 0, preview: 0, planned: 0, failed: 0, paused: 0 };
  for (const sw of listScheduledWorkflows()) out[sw.state]++;
  return out;
}

/**
 * Compute the next cron firing for a Cron-style string.
 * Stub: returns 24h from now to keep the UI working without a cron library.
 * Real implementation slots in here later.
 */
export function approximateNextRunAt(cron: string, now: Date = new Date()): string {
  void cron;
  return new Date(now.getTime() + 86_400_000).toISOString();
}

export { BUILTIN_WORKFLOWS };
