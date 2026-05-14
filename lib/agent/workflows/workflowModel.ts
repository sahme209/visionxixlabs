/**
 * Workflow definition model — typed contracts for durable, multi-step
 * operational workflows.
 *
 * A workflow is a deterministic recipe: an ordered list of steps, each
 * with a step type, inputs, safety requirements, and retry behavior.
 * The orchestrator hydrates a workflow definition into a sequence of
 * AgentJobs.
 */

import type { JobType } from "@/lib/agent/jobs/jobModel";

// ---------------------------------------------------------------------------
// Categories + triggers
// ---------------------------------------------------------------------------

export type WorkflowCategory =
  | "cloud_scan"
  | "provider_validation"
  | "recommendation_generation"
  | "execution_planning"
  | "approval_routing"
  | "terraform_export"
  | "rollback_preparation"
  | "verification"
  | "drift_detection"
  | "releaseops_readiness"
  | "github_sync"
  | "desktop_handoff"
  | "audit_export"
  | "executive_summary";

export type WorkflowTrigger =
  | "manual"
  | "schedule"           // Triggered by cron
  | "event"              // Triggered by an operational event
  | "approval"           // Triggered by an approval action
  | "post_execution";    // Triggered after another workflow completes

export interface WorkflowStep {
  /** Stable position within the workflow (0-based). */
  index: number;
  /** Display label. */
  label: string;
  /** Description used in workflow timeline UI. */
  description: string;
  /** Type of job this step produces. */
  jobType: JobType;
  /** Approval required before this step can start. */
  requiresApproval?: boolean;
  /** Rollback plan must be verified before this step. */
  requiresRollback?: boolean;
  /** Audit event mandatory after this step. */
  requiresAudit?: boolean;
  /** Specific verification check kinds expected after this step. */
  requiresVerifications?: string[];
  /** Whether this step can be retried automatically on transient failure. */
  retryable: boolean;
  /** Maximum retries allowed (overrides job-type default). */
  maxRetries?: number;
  /** Timeout in seconds for this step. */
  timeoutSec?: number;
}

// ---------------------------------------------------------------------------
// Workflow definition
// ---------------------------------------------------------------------------

export interface WorkflowDefinition {
  id: string;
  name: string;
  description: string;
  category: WorkflowCategory;
  trigger: WorkflowTrigger;
  /** Ordered steps. */
  steps: WorkflowStep[];
  /** Policy rule IDs that gate this workflow. */
  policyRequirements: string[];
  /** Whether at least one human approval is required somewhere in the workflow. */
  requiresApproval: boolean;
  /** Whether the workflow requires a verified rollback plan. */
  requiresRollback: boolean;
  /** Whether the workflow always writes audit events. */
  requiresAudit: boolean;
  /** Predicate signal map for success — descriptive only, not evaluated. */
  successConditions: string[];
  /** Predicate signal map for failure. */
  failureConditions: string[];
  /** Suggested next-best workflow to run after this one completes. */
  nextRecommendedWorkflowId?: string;
  /** Cron expression when trigger === "schedule". */
  cron?: string;
}

// ---------------------------------------------------------------------------
// Built-in workflow definitions
// ---------------------------------------------------------------------------

const step = (idx: number, label: string, description: string, jobType: JobType, extras: Partial<WorkflowStep> = {}): WorkflowStep => ({
  index: idx,
  label,
  description,
  jobType,
  retryable: extras.retryable ?? true,
  ...extras,
});

export const BUILTIN_WORKFLOWS: WorkflowDefinition[] = [
  {
    id: "wf.cloud_scan",
    name: "Cloud infrastructure scan",
    description: "Validate provider, scan all authorized regions, persist normalized snapshot, generate findings + reasoning trace + execution plan candidates.",
    category: "cloud_scan",
    trigger: "manual",
    steps: [
      step(0, "Validate provider credentials", "Assume role / SP / SA and verify scope", "scan.provider_validation", { timeoutSec: 30 }),
      step(1, "Run cloud scan",                 "Enumerate resources across authorized regions",  "scan.cloud", { timeoutSec: 900 }),
      step(2, "Persist typed snapshot",         "Write normalized resource graph",                  "snapshot.persist", { requiresAudit: true }),
      step(3, "Generate findings",              "Run signal engine over snapshot",                  "findings.generate"),
      step(4, "Generate reasoning trace",       "Build 12-step cognitive trace for each finding",   "reasoning.trace"),
      step(5, "Build execution plan candidates","Produce approval-ready plan candidates",           "execution_plan.build", { requiresRollback: true, requiresAudit: true }),
    ],
    policyRequirements: ["default.permissions_must_be_verified"],
    requiresApproval: false,
    requiresRollback: false,
    requiresAudit: true,
    successConditions: ["snapshot.persisted == true", "findings.count >= 0"],
    failureConditions: ["scan.provider_validation == failed", "scan.cloud.error_count > 5"],
    nextRecommendedWorkflowId: "wf.executive_summary",
  },
  {
    id: "wf.terraform_export",
    name: "Terraform / CLI export",
    description: "Generate Terraform and CLI previews for an approved execution plan, attach rollback plan + verification spec, package for desktop handoff.",
    category: "terraform_export",
    trigger: "approval",
    steps: [
      step(0, "Evaluate approval policy",   "Confirm plan is approved",                "approval.route"),
      step(1, "Generate Terraform preview", "Produce phase-by-phase IaC",              "terraform.export", { requiresAudit: true }),
      step(2, "Generate CLI preview",       "Produce CLI command sequence",            "cli.export"),
      step(3, "Prepare rollback plan",      "Verify rollback path + measured RTO",     "rollback.prepare", { requiresRollback: true }),
      step(4, "Build verification spec",    "Produce pre/post/monitoring checks",      "verification.run"),
      step(5, "Prepare desktop handoff",    "Package plan + artifacts for desktop",    "desktop.handoff"),
    ],
    policyRequirements: ["default.terraform_export_audited", "default.desktop_handoff_local_confirm"],
    requiresApproval: true,
    requiresRollback: true,
    requiresAudit: true,
    successConditions: ["terraform.export == complete", "rollback.verified == true"],
    failureConditions: ["rollback.verified == false"],
  },
  {
    id: "wf.drift_detection",
    name: "Drift detection cycle",
    description: "Compare current cloud state to declared baseline. Emit drift events when out-of-band changes are detected.",
    category: "drift_detection",
    trigger: "schedule",
    cron: "0 */6 * * *", // Every 6 hours
    steps: [
      step(0, "Validate provider", "Confirm credentials still valid", "scan.provider_validation"),
      step(1, "Snapshot current state", "Build typed snapshot for diff", "snapshot.persist"),
      step(2, "Detect drift", "Diff against last baseline", "drift.detect", { requiresAudit: true }),
    ],
    policyRequirements: [],
    requiresApproval: false,
    requiresRollback: false,
    requiresAudit: true,
    successConditions: ["drift.detect == complete"],
    failureConditions: ["scan.provider_validation == failed"],
  },
  {
    id: "wf.releaseops_readiness",
    name: "ReleaseOps readiness check",
    description: "Sync GitHub repos + pipelines, score release readiness, emit readiness events.",
    category: "releaseops_readiness",
    trigger: "schedule",
    cron: "0 */12 * * *", // Every 12 hours
    steps: [
      step(0, "Sync GitHub", "Pull repos, pipelines, branch protection", "github.sync"),
      step(1, "Score readiness", "Compute composite + per-dimension scores", "releaseops.readiness_score"),
    ],
    policyRequirements: [],
    requiresApproval: false,
    requiresRollback: false,
    requiresAudit: true,
    successConditions: ["releaseops.readiness_score == complete"],
    failureConditions: ["github.sync == failed"],
  },
  {
    id: "wf.audit_export",
    name: "Audit bundle export",
    description: "Filter audit fabric, produce CSV/JSON/NDJSON bundle, optionally deliver to SIEM webhook.",
    category: "audit_export",
    trigger: "manual",
    steps: [
      step(0, "Export audit bundle", "Filter + serialize", "audit.export", { requiresAudit: true }),
      step(1, "Deliver notifications", "Notify configured destinations", "notification.deliver"),
    ],
    policyRequirements: [],
    requiresApproval: false,
    requiresRollback: false,
    requiresAudit: true,
    successConditions: ["audit.export == complete"],
    failureConditions: ["audit.export == failed"],
  },
  {
    id: "wf.executive_summary",
    name: "Weekly executive summary",
    description: "Generate operational summary from memory + state. Deliver via notification destinations.",
    category: "executive_summary",
    trigger: "schedule",
    cron: "0 9 * * 1", // Every Monday 9am UTC
    steps: [
      step(0, "Generate summary", "Compose summary from operational memory", "summary.executive"),
      step(1, "Deliver notifications", "Send to Slack / Teams / email destinations", "notification.deliver"),
    ],
    policyRequirements: [],
    requiresApproval: false,
    requiresRollback: false,
    requiresAudit: false,
    successConditions: ["summary.executive == complete"],
    failureConditions: ["summary.executive == failed"],
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function getWorkflow(id: string): WorkflowDefinition | undefined {
  return BUILTIN_WORKFLOWS.find((w) => w.id === id);
}

export function workflowsByCategory(category: WorkflowCategory): WorkflowDefinition[] {
  return BUILTIN_WORKFLOWS.filter((w) => w.category === category);
}

export function scheduledWorkflows(): WorkflowDefinition[] {
  return BUILTIN_WORKFLOWS.filter((w) => w.trigger === "schedule");
}
