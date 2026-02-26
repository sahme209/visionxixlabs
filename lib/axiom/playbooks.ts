import type { PlanTask, PlanPhase, ThirtyDayPlan } from "./infrastructureAdvantage";

export type PlaybookStep = {
  step: string;
  command?: string;
  file?: string;
  validation?: string;
};

export type PhasePlaybook = {
  phaseName: string;
  objective: string;
  prerequisites: string[];
  stepByStep: PlaybookStep[];
  rollbackPlan: string[];
  successCriteria: string[];
};

export type PlaybookPack = {
  phasePlaybooks: PhasePlaybook[];
  cutoverChecklist: string[];
  ownerRoles: string[];
  estimatedEffortHours: number;
};

function phaseToPlaybook(phase: PlanPhase): PhasePlaybook {
  const steps: PlaybookStep[] = phase.tasks.map((t, i) => ({
    step: t.technicalAction,
    command: undefined,
    file: undefined,
    validation: t.estimatedImprovementEffect,
  }));
  const rollbackPlan = phase.tasks.map(
    (t) => `Revert: ${t.technicalAction} — manual rollback if needed`
  );
  const successCriteria = phase.tasks.map(
    (t) => `${t.businessImpact} (Effect: ${t.estimatedImprovementEffect})`
  );

  return {
    phaseName: phase.label,
    objective: phase.category,
    prerequisites: phase.tasks.length > 0 ? ["Backup current config", "Verify access"] : [],
    stepByStep: steps,
    rollbackPlan,
    successCriteria,
  };
}

/**
 * Phase 5: Deterministic playbook generation from 30-day plan.
 */
export function generatePlaybooks(plan: ThirtyDayPlan): PlaybookPack {
  const phases = [
    plan.timeSequencedPlan.stabilization,
    plan.timeSequencedPlan.costOptimization,
    plan.timeSequencedPlan.deploymentAcceleration,
    plan.timeSequencedPlan.scalabilityHardening,
  ];

  const phasePlaybooks = phases.map(phaseToPlaybook);
  const cutoverChecklist = [
    "Review all playbook steps",
    "Schedule maintenance window",
    "Notify stakeholders",
    "Verify rollback procedure",
    "Execute in sequence",
    "Validate success criteria",
    "Document completion",
  ];

  const ownerRoles = ["Infrastructure Lead", "DevOps Engineer", "Security Reviewer"];
  const taskCount =
    plan.prioritizedCategories.critical.length +
    plan.prioritizedCategories.highImpact.length +
    plan.prioritizedCategories.strategic.length +
    plan.prioritizedCategories.optimization.length;
  const estimatedEffortHours = Math.max(4, Math.min(80, taskCount * 2));

  return {
    phasePlaybooks,
    cutoverChecklist,
    ownerRoles,
    estimatedEffortHours,
  };
}
