/**
 * Pure agent workflow orchestrator — the keystone that turns isolated
 * kernels into a real autonomous workforce.
 *
 * Input: a typed workflow definition (ordered sequence of steps,
 * each naming a kernel + dependency + gate) + an initial trigger
 * event. Output: an immutable WorkflowExecutionState — what ran,
 * what failed, what's blocked, what's awaiting approval, in what
 * order. Pure / deterministic.
 *
 * The runtime that actually invokes kernels reads this plan and
 * dispatches one step at a time; the orchestrator decides what's
 * eligible. Approval gates short-circuit dispatch.
 *
 * Closed unions on step state + handoff kind so future shapes break
 * the build.
 */

export type StepState =
  | "pending"            // waiting on a dependency
  | "ready"              // eligible to dispatch right now
  | "running"            // dispatched, waiting for kernel result
  | "awaiting_approval"  // kernel returned a proposal that needs operator gate
  | "succeeded"          // kernel returned a verdict the workflow can act on
  | "failed"             // kernel failed; dependent steps abort
  | "skipped"            // explicit operator skip
  | "blocked";           // a dependency failed or a gate refused

export type GateKind =
  | "no_gate"
  | "single_approval"
  | "dual_approval"
  | "council_2_of_3"
  | "council_3_of_5";

export interface WorkflowStep {
  /** Stable id within the workflow. */
  id: string;
  /** Kernel module to invoke (e.g. "reasonerHypothesisWeaver"). */
  kernel: string;
  /** Step ids this step depends on — must be in `succeeded` state. */
  dependsOn: readonly string[];
  /** Gate before this step can dispatch. */
  gate: GateKind;
  /** Operator-readable purpose. */
  purpose: string;
  /** Maximum wall-clock seconds the runtime will wait. */
  timeoutSeconds: number;
}

export interface WorkflowDefinition {
  /** Stable workflow id. */
  id: string;
  /** Display name. */
  name: string;
  /** Operator-readable purpose. */
  purpose: string;
  /** Steps in declaration order. */
  steps: readonly WorkflowStep[];
}

export interface StepStatus {
  stepId: string;
  state: StepState;
  /** Operator-readable explanation. */
  rationale: string;
  /** When state is succeeded — the closed-union outcome. */
  outcome: "ok" | "partial" | "needs_human" | null;
}

export interface WorkflowExecutionState {
  workflowId: string;
  steps: readonly StepStatus[];
  /** Closed-union state of the whole workflow. */
  workflowState:
    | "running"
    | "blocked"
    | "succeeded"
    | "failed"
    | "needs_approval";
  /** Ids of steps eligible to dispatch right now. */
  readyStepIds: readonly string[];
  /** Operator-readable headline. */
  headline: string;
}

export interface KernelOutcome {
  stepId: string;
  /** What the kernel returned. */
  result: "ok" | "partial" | "needs_human" | "failed";
  /** Optional approval-gate state from the kernel for this step. */
  approval?: "pending" | "approved" | "rejected";
}

export type DefinitionError =
  | "no_steps"
  | "duplicate_step_id"
  | "unknown_dependency"
  | "cyclic_dependency"
  | "self_dependency";

export interface DefinitionValidation {
  ok: boolean;
  errors: readonly { code: DefinitionError; message: string }[];
}

export function validateDefinition(def: WorkflowDefinition): DefinitionValidation {
  const errors: { code: DefinitionError; message: string }[] = [];
  if (def.steps.length === 0) {
    errors.push({ code: "no_steps", message: "Workflow has no steps." });
  }
  const ids = new Set<string>();
  for (const s of def.steps) {
    if (ids.has(s.id)) errors.push({ code: "duplicate_step_id", message: `Duplicate step id: ${s.id}` });
    ids.add(s.id);
  }
  for (const s of def.steps) {
    for (const dep of s.dependsOn) {
      if (dep === s.id) {
        errors.push({ code: "self_dependency", message: `Step ${s.id} depends on itself.` });
      } else if (!ids.has(dep)) {
        errors.push({ code: "unknown_dependency", message: `Step ${s.id} depends on unknown step ${dep}.` });
      }
    }
  }
  // Cycle detection — Kahn-style topo sort; if we can't drain all nodes there's a cycle.
  const remaining = new Map<string, Set<string>>();
  for (const s of def.steps) remaining.set(s.id, new Set(s.dependsOn));
  while (remaining.size > 0) {
    const free = [...remaining.entries()].filter(([, deps]) => deps.size === 0).map(([id]) => id);
    if (free.length === 0) {
      errors.push({ code: "cyclic_dependency", message: `Cyclic deps among: ${[...remaining.keys()].join(", ")}` });
      break;
    }
    for (const id of free) {
      remaining.delete(id);
      for (const set of remaining.values()) set.delete(id);
    }
  }
  return { ok: errors.length === 0, errors };
}

/**
 * Given the static definition + the outcomes the runtime has reported
 * so far + the approval ledger, return the next execution state of
 * the workflow.
 */
export function computeExecutionState(
  def: WorkflowDefinition,
  outcomes: ReadonlyArray<KernelOutcome>,
): WorkflowExecutionState {
  const outcomeMap = new Map(outcomes.map((o) => [o.stepId, o]));
  const statusById = new Map<string, StepStatus>();

  // First pass: classify each step based on its outcome (if any) + the
  // states of its dependencies.
  for (const step of def.steps) {
    const out = outcomeMap.get(step.id);

    // Terminal outcomes win immediately.
    if (out?.result === "failed") {
      statusById.set(step.id, {
        stepId: step.id,
        state: "failed",
        rationale: "Kernel returned failed.",
        outcome: null,
      });
      continue;
    }
    if (out?.result === "ok" || out?.result === "partial" || out?.result === "needs_human") {
      // Rejection wins over everything: a rejected step is blocked.
      if (out.approval === "rejected") {
        statusById.set(step.id, {
          stepId: step.id,
          state: "blocked",
          rationale: "Operator rejected the proposal.",
          outcome: out.result,
        });
        continue;
      }
      // Gate handling: if the step requires approval and the operator
      // hasn't approved yet, the step is in "awaiting_approval".
      if (step.gate !== "no_gate" && out.approval !== "approved") {
        statusById.set(step.id, {
          stepId: step.id,
          state: "awaiting_approval",
          rationale: `Kernel produced a ${out.result} proposal; awaiting ${step.gate.replace("_", " ")}.`,
          outcome: out.result,
        });
        continue;
      }
      statusById.set(step.id, {
        stepId: step.id,
        state: "succeeded",
        rationale: "Kernel succeeded + gate cleared.",
        outcome: out.result,
      });
      continue;
    }
  }

  // Second pass: for steps without outcomes, determine pending / ready /
  // blocked based on dependency state.
  for (const step of def.steps) {
    if (statusById.has(step.id)) continue;

    const depStatuses = step.dependsOn.map((id) => statusById.get(id));
    const anyDepFailed = depStatuses.some((s) => s?.state === "failed" || s?.state === "blocked");
    if (anyDepFailed) {
      statusById.set(step.id, {
        stepId: step.id,
        state: "blocked",
        rationale: "A dependency failed or was blocked.",
        outcome: null,
      });
      continue;
    }
    const allDepsSucceeded = depStatuses.every((s) => s?.state === "succeeded");
    if (allDepsSucceeded || step.dependsOn.length === 0) {
      statusById.set(step.id, {
        stepId: step.id,
        state: "ready",
        rationale: step.dependsOn.length === 0
          ? "No dependencies — eligible to dispatch."
          : "All dependencies succeeded — eligible to dispatch.",
        outcome: null,
      });
      continue;
    }
    statusById.set(step.id, {
      stepId: step.id,
      state: "pending",
      rationale: "Waiting on at least one dependency.",
      outcome: null,
    });
  }

  // Preserve declaration order in the output.
  const steps = def.steps.map((s) => statusById.get(s.id)!);
  const readyStepIds = steps.filter((s) => s.state === "ready").map((s) => s.stepId);

  // Workflow-level state.
  let workflowState: WorkflowExecutionState["workflowState"];
  let headline: string;
  if (steps.some((s) => s.state === "failed")) {
    workflowState = "failed";
    headline = "Workflow has a failed step; dependent steps are blocked.";
  } else if (steps.every((s) => s.state === "succeeded")) {
    workflowState = "succeeded";
    headline = "Every step succeeded.";
  } else if (steps.some((s) => s.state === "awaiting_approval")) {
    workflowState = "needs_approval";
    headline = "At least one step is awaiting operator approval.";
  } else if (steps.every((s) => s.state === "blocked" || s.state === "succeeded")) {
    workflowState = "blocked";
    headline = "Workflow is blocked by an upstream rejection or failure.";
  } else {
    workflowState = "running";
    headline = `${readyStepIds.length} step(s) ready to dispatch.`;
  }

  return { workflowId: def.id, steps, workflowState, readyStepIds, headline };
}
