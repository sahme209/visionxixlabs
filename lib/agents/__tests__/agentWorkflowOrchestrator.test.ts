import { describe, it, expect } from "vitest";
import {
  validateDefinition,
  computeExecutionState,
  type WorkflowDefinition,
  type KernelOutcome,
} from "../agentWorkflowOrchestrator";

function def(steps: WorkflowDefinition["steps"]): WorkflowDefinition {
  return { id: "wf-1", name: "test", purpose: "tests", steps };
}

describe("validateDefinition", () => {
  it("rejects empty workflows", () => {
    const r = validateDefinition(def([]));
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.code === "no_steps")).toBe(true);
  });

  it("rejects duplicate step ids", () => {
    const r = validateDefinition(def([
      { id: "a", kernel: "k", dependsOn: [], gate: "no_gate", purpose: "x", timeoutSeconds: 60 },
      { id: "a", kernel: "k", dependsOn: [], gate: "no_gate", purpose: "x", timeoutSeconds: 60 },
    ]));
    expect(r.errors.some((e) => e.code === "duplicate_step_id")).toBe(true);
  });

  it("rejects self-dependency", () => {
    const r = validateDefinition(def([
      { id: "a", kernel: "k", dependsOn: ["a"], gate: "no_gate", purpose: "x", timeoutSeconds: 60 },
    ]));
    expect(r.errors.some((e) => e.code === "self_dependency")).toBe(true);
  });

  it("rejects unknown dependency", () => {
    const r = validateDefinition(def([
      { id: "a", kernel: "k", dependsOn: ["ghost"], gate: "no_gate", purpose: "x", timeoutSeconds: 60 },
    ]));
    expect(r.errors.some((e) => e.code === "unknown_dependency")).toBe(true);
  });

  it("rejects cyclic deps", () => {
    const r = validateDefinition(def([
      { id: "a", kernel: "k", dependsOn: ["b"], gate: "no_gate", purpose: "x", timeoutSeconds: 60 },
      { id: "b", kernel: "k", dependsOn: ["a"], gate: "no_gate", purpose: "x", timeoutSeconds: 60 },
    ]));
    expect(r.errors.some((e) => e.code === "cyclic_dependency")).toBe(true);
  });

  it("happy path validates", () => {
    const r = validateDefinition(def([
      { id: "a", kernel: "k", dependsOn: [],     gate: "no_gate", purpose: "", timeoutSeconds: 60 },
      { id: "b", kernel: "k", dependsOn: ["a"],  gate: "single_approval", purpose: "", timeoutSeconds: 60 },
    ]));
    expect(r.ok).toBe(true);
  });
});

describe("computeExecutionState", () => {
  const TWO_STEP = def([
    { id: "a", kernel: "k1", dependsOn: [],     gate: "no_gate",          purpose: "first",  timeoutSeconds: 60 },
    { id: "b", kernel: "k2", dependsOn: ["a"],  gate: "single_approval",  purpose: "second", timeoutSeconds: 60 },
  ]);

  it("no outcomes → first step ready, second pending", () => {
    const s = computeExecutionState(TWO_STEP, []);
    expect(s.steps.find((x) => x.stepId === "a")?.state).toBe("ready");
    expect(s.steps.find((x) => x.stepId === "b")?.state).toBe("pending");
    expect(s.readyStepIds).toEqual(["a"]);
    expect(s.workflowState).toBe("running");
  });

  it("first step succeeded → second becomes ready", () => {
    const outcomes: KernelOutcome[] = [{ stepId: "a", result: "ok" }];
    const s = computeExecutionState(TWO_STEP, outcomes);
    expect(s.steps.find((x) => x.stepId === "a")?.state).toBe("succeeded");
    expect(s.steps.find((x) => x.stepId === "b")?.state).toBe("ready");
  });

  it("step with gate but no approval → awaiting_approval (not succeeded)", () => {
    const outcomes: KernelOutcome[] = [
      { stepId: "a", result: "ok" },
      { stepId: "b", result: "ok", approval: "pending" },
    ];
    const s = computeExecutionState(TWO_STEP, outcomes);
    expect(s.steps.find((x) => x.stepId === "b")?.state).toBe("awaiting_approval");
    expect(s.workflowState).toBe("needs_approval");
  });

  it("step gated + approved → succeeded", () => {
    const outcomes: KernelOutcome[] = [
      { stepId: "a", result: "ok" },
      { stepId: "b", result: "ok", approval: "approved" },
    ];
    const s = computeExecutionState(TWO_STEP, outcomes);
    expect(s.steps.find((x) => x.stepId === "b")?.state).toBe("succeeded");
    expect(s.workflowState).toBe("succeeded");
  });

  it("step rejected → blocked", () => {
    const outcomes: KernelOutcome[] = [
      { stepId: "a", result: "ok" },
      { stepId: "b", result: "ok", approval: "rejected" },
    ];
    const s = computeExecutionState(TWO_STEP, outcomes);
    expect(s.steps.find((x) => x.stepId === "b")?.state).toBe("blocked");
  });

  it("first step failed → second blocked, workflow failed", () => {
    const outcomes: KernelOutcome[] = [{ stepId: "a", result: "failed" }];
    const s = computeExecutionState(TWO_STEP, outcomes);
    expect(s.steps.find((x) => x.stepId === "a")?.state).toBe("failed");
    expect(s.steps.find((x) => x.stepId === "b")?.state).toBe("blocked");
    expect(s.workflowState).toBe("failed");
  });

  it("workflow with parallel branch", () => {
    const wf = def([
      { id: "root",   kernel: "k", dependsOn: [],             gate: "no_gate", purpose: "", timeoutSeconds: 60 },
      { id: "left",   kernel: "k", dependsOn: ["root"],       gate: "no_gate", purpose: "", timeoutSeconds: 60 },
      { id: "right",  kernel: "k", dependsOn: ["root"],       gate: "no_gate", purpose: "", timeoutSeconds: 60 },
      { id: "joiner", kernel: "k", dependsOn: ["left", "right"], gate: "no_gate", purpose: "", timeoutSeconds: 60 },
    ]);
    // After root succeeds, both branches ready.
    const s = computeExecutionState(wf, [{ stepId: "root", result: "ok" }]);
    expect(s.steps.find((x) => x.stepId === "left")?.state).toBe("ready");
    expect(s.steps.find((x) => x.stepId === "right")?.state).toBe("ready");
    expect(s.steps.find((x) => x.stepId === "joiner")?.state).toBe("pending");
  });

  it("partial outcomes still considered for downstream", () => {
    const outcomes: KernelOutcome[] = [{ stepId: "a", result: "partial" }];
    const s = computeExecutionState(TWO_STEP, outcomes);
    // a is treated as succeeded → b becomes ready
    expect(s.steps.find((x) => x.stepId === "b")?.state).toBe("ready");
  });

  it("headline reflects workflow state", () => {
    const s = computeExecutionState(TWO_STEP, []);
    expect(s.headline).toMatch(/ready to dispatch/);
  });
});
