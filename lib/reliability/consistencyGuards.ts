/**
 * Consistency guards for multi-step writes.
 *
 * Many platform flows touch more than one record: a scan writes a snapshot
 * *and* a findings batch *and* an event. If the second write fails, the
 * platform must not leave the first behind.
 *
 * Two patterns are supported:
 *  (1) Database transactions where all writes share a Prisma client — use
 *      `runInTransaction()` so all writes commit or roll back together.
 *  (2) Cross-system flows (DB + event bus + connector callback) where a
 *      single transaction isn't possible. Use a `CorrelationStitch` that
 *      records each step under one correlation id and exposes a recovery
 *      hook the workflow recovery engine reads.
 */

import type { CorrelationId } from "@/lib/domain/ids";
import { AxiomErrors } from "@/lib/errors/axiomErrors";

// ---------------------------------------------------------------------------
// Transaction wrapper — generic so it composes with Prisma without an
// explicit dependency in this typed library file.
// ---------------------------------------------------------------------------

/**
 * Run a unit of work inside a transaction supplied by the caller. The caller
 * passes a `begin` function that returns a transactional context (Prisma's
 * `$transaction(fn)` parameter, for example). Errors abort the transaction;
 * successful return commits.
 *
 * This is a thin shim — it exists to give callers a consistent API and to
 * record failures uniformly via AxiomError.
 */
export async function runInTransaction<Ctx, T>(begin: (work: (ctx: Ctx) => Promise<T>) => Promise<T>, work: (ctx: Ctx) => Promise<T>): Promise<T> {
  try {
    return await begin(work);
  } catch (err) {
    if (err && typeof err === "object" && "category" in err) throw err; // AxiomError pass-through
    throw AxiomErrors.internal("consistency.transaction_failed", err instanceof Error ? err.message : String(err), err);
  }
}

// ---------------------------------------------------------------------------
// Correlation stitch — for cross-system flows
// ---------------------------------------------------------------------------

export interface StitchStep {
  /** Stable name of the step — "snapshot.persist", "events.publish", etc. */
  name: string;
  /** When the step finished (success or otherwise). */
  at: string;
  /** Whether this step succeeded. */
  ok: boolean;
  /** Reference to the produced artifact (id), if any. */
  outputRef?: string;
  /** Error code if !ok. */
  errorCode?: string;
}

export interface CorrelationStitch {
  correlationId: CorrelationId;
  steps: StitchStep[];
  /** True when the most-recent step is `ok` and the chain is complete. */
  completed: boolean;
  /** Set when a step failed and no later compensating step succeeded. */
  failedAt?: number;
}

/**
 * Build an empty stitch. Used by the flow's first writer; subsequent writers
 * append via `appendStep()`. The orchestrator persists the stitch alongside
 * its workflow run so recovery can read it.
 */
export function startStitch(correlationId: CorrelationId): CorrelationStitch {
  return { correlationId, steps: [], completed: false };
}

export function appendStep(stitch: CorrelationStitch, step: Omit<StitchStep, "at"> & { at?: string }): CorrelationStitch {
  const at = step.at ?? new Date().toISOString();
  const steps = [...stitch.steps, { ...step, at }];
  const lastIdx = steps.length - 1;
  const completed = steps.every((s) => s.ok);
  const failedAt = steps.findIndex((s) => !s.ok);
  return {
    ...stitch,
    steps,
    completed,
    failedAt: failedAt >= 0 ? failedAt : undefined,
  };
}

// ---------------------------------------------------------------------------
// Consistency invariants — pure checks the orchestrator can run after a flow
// ---------------------------------------------------------------------------

export type InvariantKind =
  | "scan_event_without_snapshot"
  | "snapshot_without_findings"
  | "findings_without_recommendations"
  | "recommendations_without_reasoning"
  | "execution_plan_without_policy_decision"
  | "approval_without_audit"
  | "workflow_job_without_event"
  | "memory_record_without_source_event";

export interface InvariantViolation {
  kind: InvariantKind;
  correlationId: CorrelationId;
  detail: string;
}

export interface InvariantInputs {
  correlationId: CorrelationId;
  hasScanEvent?: boolean;
  hasSnapshot?: boolean;
  hasFindings?: boolean;
  hasRecommendations?: boolean;
  hasReasoning?: boolean;
  hasExecutionPlan?: boolean;
  hasPolicyDecision?: boolean;
  hasApproval?: boolean;
  hasAuditRecord?: boolean;
  hasWorkflowJob?: boolean;
  hasOperationalEvent?: boolean;
  hasMemoryRecord?: boolean;
  hasSourceEvent?: boolean;
}

/**
 * Check the standard cross-system invariants. Returns the violations so the
 * caller can dead-letter or recover them. Pure function.
 */
export function checkInvariants(input: InvariantInputs): InvariantViolation[] {
  const out: InvariantViolation[] = [];
  const push = (kind: InvariantKind, detail: string) => out.push({ kind, correlationId: input.correlationId, detail });
  if (input.hasScanEvent && !input.hasSnapshot) push("scan_event_without_snapshot", "Scan event emitted but no snapshot persisted.");
  if (input.hasSnapshot && input.hasFindings === false) push("snapshot_without_findings", "Snapshot persisted but findings generation did not complete.");
  if (input.hasFindings && input.hasRecommendations === false) push("findings_without_recommendations", "Findings present but recommendations missing.");
  if (input.hasRecommendations && input.hasReasoning === false) push("recommendations_without_reasoning", "Recommendations exist without a reasoning trace.");
  if (input.hasExecutionPlan && input.hasPolicyDecision === false) push("execution_plan_without_policy_decision", "Execution plan generated without a policy decision record.");
  if (input.hasApproval && input.hasAuditRecord === false) push("approval_without_audit", "Approval decision missing an audit record.");
  if (input.hasWorkflowJob && input.hasOperationalEvent === false) push("workflow_job_without_event", "Workflow job ran without emitting an operational event.");
  if (input.hasMemoryRecord && input.hasSourceEvent === false) push("memory_record_without_source_event", "Memory record exists without a source event.");
  return out;
}
