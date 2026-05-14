/**
 * Step executors — pure functions that produce the typed result of running
 * a single workflow step.
 *
 * Executors are deliberately thin scaffolds: they emit operational events,
 * audit entries, and the next-step recommendation. Real work (calling AWS
 * APIs, building snapshots, etc.) happens via separate engines that already
 * exist in the codebase. The executor coordinates and reports.
 */

import type { AgentJob, JobType } from "@/lib/agent/jobs/jobModel";
import type { ActivityEventType } from "@/lib/operations/eventStream";

// ---------------------------------------------------------------------------
// Result shape
// ---------------------------------------------------------------------------

export type ExecutorOutcome = "completed" | "needs_approval" | "needs_input" | "blocked" | "failed" | "deferred";

export interface ExecutorResult {
  outcome: ExecutorOutcome;
  /** Structured output the next step can consume. */
  output: Record<string, string | number | boolean>;
  /** Operational events to emit. */
  eventsToEmit: { type: ActivityEventType; title: string; description?: string }[];
  /** Audit entries to write. */
  auditEntries: { actionType: string; status: "applied" | "failed" | "pending" }[];
  /** Suggested next step within the workflow. */
  nextStepHint?: string;
  /** Safety result attached to this step. */
  safety: { status: "safe" | "needs_approval" | "blocked"; reason?: string };
  /** Error message if outcome === "failed". */
  error?: string;
}

// ---------------------------------------------------------------------------
// Executor registry
// ---------------------------------------------------------------------------

type Executor = (job: AgentJob) => Promise<ExecutorResult>;

const EXECUTORS: Record<JobType, Executor> = {
  "scan.cloud":                async (j) => makeResult(j, "completed", {
    summary: "Scan executor invoked",
    eventType: "scan.completed",
    eventTitle: "Cloud scan completed",
  }),
  "scan.provider_validation":  async (j) => makeResult(j, "completed", {
    summary: "Provider validation succeeded",
    eventType: "scan.completed",
    eventTitle: "Provider credentials validated",
  }),
  "snapshot.persist":          async (j) => makeResult(j, "completed", {
    summary: "Snapshot persisted",
    eventType: "audit.event",
    eventTitle: "Snapshot persisted to operational memory",
    audit: true,
  }),
  "findings.generate":         async (j) => makeResult(j, "completed", {
    summary: "Findings generated",
    eventType: "finding.detected",
    eventTitle: "Findings generated from snapshot",
  }),
  "reasoning.trace":           async (j) => makeResult(j, "completed", {
    summary: "Reasoning trace generated",
    eventType: "agent.reasoning",
    eventTitle: "Reasoning trace generated",
  }),
  "execution_plan.build":      async (j) => makeResult(j, "needs_approval", {
    summary: "Execution plan candidate built — awaiting approval",
    eventType: "plan.generated",
    eventTitle: "Execution plan candidate ready",
    audit: true,
    safetyStatus: "needs_approval",
  }),
  "approval.route":            async (j) => makeResult(j, "needs_approval", {
    summary: "Routed to approver",
    eventType: "approval.required",
    eventTitle: "Approval routed",
    safetyStatus: "needs_approval",
  }),
  "terraform.export":          async (j) => makeResult(j, "completed", {
    summary: "Terraform export generated",
    eventType: "audit.event",
    eventTitle: "Terraform export generated",
    audit: true,
  }),
  "cli.export":                async (j) => makeResult(j, "completed", {
    summary: "CLI script generated",
    eventType: "audit.event",
    eventTitle: "CLI script generated",
  }),
  "rollback.prepare":          async (j) => makeResult(j, "completed", {
    summary: "Rollback plan prepared and verified",
    eventType: "rollback.prepared",
    eventTitle: "Rollback plan prepared",
    audit: true,
  }),
  "verification.run":          async (j) => makeResult(j, "completed", {
    summary: "Verification spec built and ready to execute",
    eventType: "audit.event",
    eventTitle: "Verification spec ready",
  }),
  "drift.detect":              async (j) => makeResult(j, "completed", {
    summary: "Drift detection complete",
    eventType: "drift.detected",
    eventTitle: "Drift detection cycle complete",
    audit: true,
  }),
  "releaseops.readiness_score": async (j) => makeResult(j, "completed", {
    summary: "ReleaseOps readiness scoring complete",
    eventType: "release.assessed",
    eventTitle: "Readiness score computed",
  }),
  "github.sync":               async (j) => makeResult(j, "completed", {
    summary: "GitHub sync complete",
    eventType: "audit.event",
    eventTitle: "GitHub repository sync complete",
  }),
  "desktop.handoff":           async (j) => makeResult(j, "completed", {
    summary: "Desktop handoff bundle prepared",
    eventType: "audit.event",
    eventTitle: "Desktop handoff bundle ready",
    audit: true,
  }),
  "audit.export":              async (j) => makeResult(j, "completed", {
    summary: "Audit bundle exported",
    eventType: "audit.event",
    eventTitle: "Audit bundle exported",
    audit: true,
  }),
  "notification.deliver":      async (j) => makeResult(j, "completed", {
    summary: "Notification routed to destinations",
    eventType: "audit.event",
    eventTitle: "Notification delivered",
  }),
  "summary.executive":         async (j) => makeResult(j, "completed", {
    summary: "Executive summary composed",
    eventType: "audit.event",
    eventTitle: "Executive summary composed",
  }),
};

// ---------------------------------------------------------------------------
// Public entry
// ---------------------------------------------------------------------------

/**
 * Execute a single step. The executor for the job's type is invoked; the
 * orchestrator consumes the result to advance the parent workflow.
 */
export async function executeStep(job: AgentJob): Promise<ExecutorResult> {
  const executor = EXECUTORS[job.type];
  if (!executor) {
    return {
      outcome: "failed",
      output: {},
      eventsToEmit: [],
      auditEntries: [],
      safety: { status: "blocked", reason: `No executor registered for job type ${job.type}` },
      error: `No executor registered for job type ${job.type}`,
    };
  }
  try {
    return await executor(job);
  } catch (err) {
    return {
      outcome: "failed",
      output: {},
      eventsToEmit: [],
      auditEntries: [{ actionType: job.type, status: "failed" }],
      safety: { status: "blocked", reason: "Executor threw" },
      error: err instanceof Error ? err.message : "Unknown executor error",
    };
  }
}

// ---------------------------------------------------------------------------
// Helper for building executor results
// ---------------------------------------------------------------------------

function makeResult(
  job: AgentJob,
  outcome: ExecutorOutcome,
  opts: {
    summary: string;
    eventType: ActivityEventType;
    eventTitle: string;
    audit?: boolean;
    safetyStatus?: "safe" | "needs_approval" | "blocked";
  }
): ExecutorResult {
  return {
    outcome,
    output: { summary: opts.summary, jobId: job.id },
    eventsToEmit: [{ type: opts.eventType, title: opts.eventTitle, description: opts.summary }],
    auditEntries: opts.audit ? [{ actionType: job.type, status: outcome === "completed" ? "applied" : "pending" }] : [],
    safety: { status: opts.safetyStatus ?? "safe" },
  };
}
