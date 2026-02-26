import type { AxiomScores, PlanTask, ThirtyDayPlan } from "./infrastructureAdvantage";

export type SimulationResult = {
  scoreLift: { min: number; max: number };
  savingsLift: { min: number; max: number };
  riskReduction: { min: number; max: number };
  frictionLift: { min: number; max: number };
  confidence: "low" | "medium" | "high";
  assumptions: string[];
};

function hasCicdTasks(plan: ThirtyDayPlan): boolean {
  const allTasks = [
    ...plan.prioritizedCategories.critical,
    ...plan.prioritizedCategories.highImpact,
    ...plan.prioritizedCategories.strategic,
    ...plan.prioritizedCategories.optimization,
  ];
  const text = allTasks
    .map((t: PlanTask) => t.technicalAction.toLowerCase())
    .join(" ");
  return text.includes("ci/cd") || text.includes("cicd") || text.includes("pipeline") || text.includes("deploy");
}

function hasRightsizingTasks(plan: ThirtyDayPlan): boolean {
  const allTasks = [
    ...plan.prioritizedCategories.critical,
    ...plan.prioritizedCategories.highImpact,
  ];
  const text = allTasks
    .map((t: PlanTask) => t.technicalAction.toLowerCase())
    .join(" ");
  return (
    text.includes("right-size") ||
    text.includes("rightsizing") ||
    text.includes("reserved") ||
    text.includes("capacity")
  );
}

function hasSecurityTasks(plan: ThirtyDayPlan): boolean {
  const allTasks = [
    ...plan.prioritizedCategories.critical,
    ...plan.prioritizedCategories.highImpact,
  ];
  const text = allTasks
    .map((t: PlanTask) => t.technicalAction.toLowerCase())
    .join(" ");
  return (
    text.includes("iam") ||
    text.includes("segment") ||
    text.includes("least-privilege") ||
    text.includes("security")
  );
}

/**
 * Phase 4: Deterministic automation simulation.
 * Estimates expected score/savings/risk/friction lifts from plan execution.
 * No AI calls.
 */
export function simulateImpact(
  scores: AxiomScores,
  plan: ThirtyDayPlan
): SimulationResult {
  const assumptions: string[] = [];

  let scoreMin = 0;
  let scoreMax = 0;
  if (hasCicdTasks(plan)) {
    scoreMin += 3;
    scoreMax += 10;
    assumptions.push("CI/CD adoption typically yields 3–10 point infrastructure score lift.");
  }
  if (hasRightsizingTasks(plan) && (scores.estimatedAnnualSavings ?? 0) > 0) {
    scoreMin += 2;
    scoreMax += 8;
    assumptions.push("Right-sizing and reserved capacity drive cost efficiency score gains.");
  }
  if (hasSecurityTasks(plan) && scores.riskExposureLevel === "High") {
    scoreMin += 5;
    scoreMax += 15;
    assumptions.push("IAM and segmentation tasks reduce security risk significantly.");
  }
  scoreMin = Math.min(20, scoreMin);
  scoreMax = Math.min(30, scoreMax);

  let savingsMin = 0;
  let savingsMax = 0;
  const annualSavings = scores.estimatedAnnualSavings ?? 0;
  if (hasRightsizingTasks(plan) && annualSavings > 10000) {
    savingsMin = Math.round(annualSavings * 0.05);
    savingsMax = Math.round(annualSavings * 0.25);
    assumptions.push("5–25% of estimated savings typically captured in first 90 days.");
  } else if (annualSavings > 0) {
    savingsMin = Math.round(annualSavings * 0.02);
    savingsMax = Math.round(annualSavings * 0.1);
    assumptions.push("2–10% savings lift from general optimization tasks.");
  }

  let riskMin = 0;
  let riskMax = 0;
  if (scores.riskExposureLevel === "High" && hasSecurityTasks(plan)) {
    riskMin = 30;
    riskMax = 60;
    assumptions.push("High-risk profiles see 30–60% risk reduction from IAM/segmentation.");
  } else if (scores.riskExposureLevel === "Medium" && hasSecurityTasks(plan)) {
    riskMin = 10;
    riskMax = 30;
    assumptions.push("Medium-risk profiles see 10–30% risk reduction from hardening.");
  }

  let frictionMin = 0;
  let frictionMax = 0;
  if (hasCicdTasks(plan)) {
    frictionMin = Math.round(scores.deploymentFrictionIndex * 0.1);
    frictionMax = Math.round(scores.deploymentFrictionIndex * 0.35);
    assumptions.push("CI/CD adoption reduces deployment friction by 10–35%.");
  }

  const taskCount =
    plan.prioritizedCategories.critical.length +
    plan.prioritizedCategories.highImpact.length +
    plan.prioritizedCategories.strategic.length +
    plan.prioritizedCategories.optimization.length;
  const confidence: "low" | "medium" | "high" =
    taskCount >= 6 && assumptions.length >= 2 ? "high" : taskCount >= 3 ? "medium" : "low";

  return {
    scoreLift: { min: scoreMin, max: scoreMax },
    savingsLift: { min: savingsMin, max: savingsMax },
    riskReduction: { min: riskMin, max: riskMax },
    frictionLift: { min: frictionMin, max: frictionMax },
    confidence,
    assumptions,
  };
}
