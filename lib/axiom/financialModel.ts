/**
 * Phase 8: CFO Mode — Financial simulation.
 * Fully deterministic. No AI.
 */

export type FinancialModelInput = {
  estimatedAnnualSavings: number | null;
  currentSpend?: number | null;
  frictionIndex?: number;
  riskExposureLevel?: string;
};

export type FinancialModelOutput = {
  projectedSavings3Year: number;
  riskCostAvoidanceEstimate: number;
  reinvestmentOpportunity: string[];
  budgetReallocationSuggestion: string[];
  confidenceBand: "low" | "medium" | "high";
};

export function computeFinancialModel(input: FinancialModelInput): FinancialModelOutput {
  const savings = input.estimatedAnnualSavings ?? 0;
  const currentSpend = input.currentSpend ?? 0;
  const friction = input.frictionIndex ?? 50;
  const risk = input.riskExposureLevel ?? "Medium";

  const projectedSavings3Year = savings * 2.5;
  const riskMultiplier = risk === "High" ? 1.5 : risk === "Medium" ? 1.2 : 1.0;
  const riskCostAvoidanceEstimate = Math.round(savings * 0.15 * riskMultiplier);

  const reinvestmentOpportunity: string[] = [];
  if (savings > 10000) reinvestmentOpportunity.push("Automation and CI/CD tooling");
  if (savings > 20000) reinvestmentOpportunity.push("Platform engineering capacity");
  if (friction > 60) reinvestmentOpportunity.push("Deployment and environment standardization");
  if (risk === "High") reinvestmentOpportunity.push("Security and compliance tooling");
  if (reinvestmentOpportunity.length === 0) reinvestmentOpportunity.push("Baseline measurement and tagging");

  const budgetReallocationSuggestion: string[] = [];
  if (currentSpend > 0 && savings > 0) {
    const pct = Math.min(30, Math.round((savings / currentSpend) * 100));
    budgetReallocationSuggestion.push(`Reallocate ${pct}% of projected savings to platform improvements`);
  }
  budgetReallocationSuggestion.push("Shift from reactive firefighting to proactive optimization");
  if (friction > 70) budgetReallocationSuggestion.push("Invest in environment parity and deployment automation");

  let confidenceBand: "low" | "medium" | "high" = "medium";
  if (savings > 50000 && friction < 60) confidenceBand = "high";
  else if (savings < 5000 || friction > 80) confidenceBand = "low";

  return {
    projectedSavings3Year,
    riskCostAvoidanceEstimate,
    reinvestmentOpportunity,
    budgetReallocationSuggestion,
    confidenceBand,
  };
}
