/**
 * Pure AGI-Engineer refactor sequencer.
 *
 * Input: a refactor target — a set of typed steps, each step naming
 * the modules it touches, the test files that cover it, and whether
 * it preserves behavior. Output: an ordered sequence the operator
 * can land one step at a time, each with its own rollback verdict.
 *
 * Why this kernel exists: large refactors fail when steps are
 * landed in the wrong order (consumer before producer) or when a
 * step that *should* preserve behavior accidentally doesn't. This
 * sequencer makes the dependency graph + the rollback story
 * explicit before any commit lands.
 *
 * Pure / deterministic. Closed unions on stepKind + verdict so new
 * shapes break the build.
 */

export type StepKind =
  | "extract"            // pull a helper out of an existing module
  | "inline"             // collapse a helper back into its caller
  | "rename"             // pure rename — exported name change
  | "move"               // module-to-module move
  | "behavior_neutral"   // any change that should preserve behavior
  | "behavior_changing"; // explicit behavior change

export interface RefactorStep {
  id: string;
  kind: StepKind;
  /** Modules this step touches. Used to detect dependency ordering. */
  touches: readonly string[];
  /** Modules this step depends on having landed first. */
  dependsOn: readonly string[];
  /** Test files that exercise the touched modules. Drives safety verdict. */
  coveredBy: readonly string[];
  /** True if the step preserves all observable behavior. */
  preservesBehavior: boolean;
  /** Operator-readable rationale. */
  rationale: string;
}

export type SafetyVerdict = "safe" | "needs_test" | "needs_review" | "blocked";

export interface SequencedStep {
  index: number;
  step: RefactorStep;
  verdict: SafetyVerdict;
  /** Rollback story for this specific step. */
  rollback: string;
  /** Reason this step landed at this position. */
  orderingReason: string;
}

export interface SequenceError {
  kind: "cycle" | "unknown_dependency";
  message: string;
  involves: readonly string[];
}

export type SequenceResult =
  | { ok: true; steps: readonly SequencedStep[] }
  | { ok: false; error: SequenceError };

export function sequenceRefactor(steps: readonly RefactorStep[]): SequenceResult {
  if (steps.length === 0) return { ok: true, steps: [] };

  // Validate: every dependsOn id refers to a step id that exists.
  const byId = new Map<string, RefactorStep>();
  for (const s of steps) byId.set(s.id, s);
  for (const s of steps) {
    for (const dep of s.dependsOn) {
      if (!byId.has(dep)) {
        return {
          ok: false,
          error: { kind: "unknown_dependency", message: `Step ${s.id} depends on ${dep} which is not in the input.`, involves: [s.id, dep] },
        };
      }
    }
  }

  // Topological sort with stable ordering by step id when ties.
  const incoming = new Map<string, Set<string>>();
  for (const s of steps) incoming.set(s.id, new Set(s.dependsOn));
  const out: SequencedStep[] = [];
  const ordered: RefactorStep[] = [];
  while (incoming.size > 0) {
    const ready = [...incoming.entries()]
      .filter(([, deps]) => deps.size === 0)
      .map(([id]) => id)
      .sort();
    if (ready.length === 0) {
      const remaining = [...incoming.keys()];
      return {
        ok: false,
        error: { kind: "cycle", message: `Dependency cycle among steps: ${remaining.join(", ")}`, involves: remaining },
      };
    }
    for (const id of ready) {
      const step = byId.get(id);
      if (!step) continue;
      ordered.push(step);
      incoming.delete(id);
      for (const deps of incoming.values()) deps.delete(id);
    }
  }

  for (let i = 0; i < ordered.length; i++) {
    const step = ordered[i];
    out.push({
      index: i,
      step,
      verdict: verdictFor(step),
      rollback: rollbackFor(step),
      orderingReason: orderingReasonFor(step, ordered, i),
    });
  }
  return { ok: true, steps: out };
}

function verdictFor(step: RefactorStep): SafetyVerdict {
  if (step.kind === "behavior_changing") {
    return step.coveredBy.length === 0 ? "blocked" : "needs_review";
  }
  if (!step.preservesBehavior) return "needs_review";
  if (step.coveredBy.length === 0) return "needs_test";
  return "safe";
}

function rollbackFor(step: RefactorStep): string {
  switch (step.kind) {
    case "extract":
      return "Revert the commit. Inlined original code is restored; no callers updated yet.";
    case "inline":
      return "Revert the commit. The extracted helper is restored.";
    case "rename":
      return "Revert the commit. The old export name is restored — pair with a codemod for callers if any landed in between.";
    case "move":
      return "Revert the commit. The old module path is restored — pair with import-fix codemod.";
    case "behavior_neutral":
      return "Revert the commit. Behavior was preserved, so no downstream cleanup is needed.";
    case "behavior_changing":
      return "Revert the commit AND back out any caller changes that depended on the new behavior — track them via the approval packet.";
  }
}

function orderingReasonFor(step: RefactorStep, ordered: readonly RefactorStep[], index: number): string {
  if (step.dependsOn.length === 0) return "No upstream steps — can land first.";
  const upstream = step.dependsOn.filter((dep) => ordered.findIndex((s) => s.id === dep) < index);
  return `Lands after: ${upstream.join(", ")}`;
}

/** Summary helper for the cockpit / marketing surface. */
export interface SequenceSummary {
  totalSteps: number;
  safe: number;
  needsTest: number;
  needsReview: number;
  blocked: number;
}

export function summarize(steps: readonly SequencedStep[]): SequenceSummary {
  const s: SequenceSummary = { totalSteps: steps.length, safe: 0, needsTest: 0, needsReview: 0, blocked: 0 };
  for (const x of steps) {
    if (x.verdict === "safe") s.safe += 1;
    else if (x.verdict === "needs_test") s.needsTest += 1;
    else if (x.verdict === "needs_review") s.needsReview += 1;
    else if (x.verdict === "blocked") s.blocked += 1;
  }
  return s;
}
