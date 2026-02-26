/**
 * Cloud Intelligence Scoring Engine — deterministic, rule-based.
 * Analyzes form inputs (and optional AI output) to produce scores.
 * No AI calls; no Prisma changes.
 */

export type OptimizationLevel = "Low" | "Medium" | "High";
export type RiskLevel = "Low" | "Medium" | "High";
export type ComplexityTier = "Self-Serve" | "Growth" | "Enterprise";

export type CloudIntelligence = {
  cloudMaturityScore: number;
  optimizationOpportunity: OptimizationLevel;
  riskLevel: RiskLevel;
  estimatedAnnualSavings: number | null;
  complexityTier: ComplexityTier;
  generatedAt: string;
};

function parseMonthlySpend(value: unknown): number {
  if (value == null || value === "") return 0;
  const s = String(value).replace(/[$,]/g, "").trim();
  const n = parseFloat(s);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function parseTrafficLevel(value: unknown): "low" | "medium" | "high" {
  const s = String(value || "").toLowerCase();
  if (/million|m\b|500k|100k|high|heavy/.test(s)) return "high";
  if (/10k|50k|100k|moderate|medium/.test(s)) return "medium";
  return "low";
}

function countServices(value: unknown): number {
  const s = String(value || "");
  const parts = s.split(/[,;]/).map((p) => p.trim()).filter(Boolean);
  if (parts.length > 0) return parts.length;
  if (s.length > 30) return 4;
  if (s.length > 10) return 2;
  return 1;
}

function hasMultiRegion(value: unknown): boolean {
  const s = String(value || "").toLowerCase();
  return /multi|,|;|\band\b|multiple/.test(s) && s.length > 3;
}

function hasStrictCompliance(value: unknown): boolean {
  const s = String(value || "").toLowerCase();
  return /soc\s*2|hipaa|pci|gdpr|fedramp|compliance/.test(s);
}

function hasPublicExposure(value: unknown): boolean {
  const s = String(value || "").toLowerCase();
  return /api|web|public|internet|facing/.test(s) && s.length > 2;
}

/**
 * Compute cloud intelligence from form and optional output.
 * Pure function; deterministic.
 */
export function computeCloudIntelligence(
  serviceType: string,
  form: Record<string, unknown>,
  _output?: Record<string, unknown> | null
): CloudIntelligence {
  const now = new Date().toISOString();

  const monthlySpend =
    serviceType === "cost"
      ? parseMonthlySpend(form.estimatedMonthlySpend)
      : 0;
  const trafficEstimate =
    serviceType === "architecture"
      ? parseTrafficLevel(form.trafficEstimate)
      : "low";
  const regionRaw = form.region;
  const multiRegion =
    hasMultiRegion(regionRaw) ||
    (serviceType === "networking" && hasMultiRegion(form.connectivity));
  const compliance = hasStrictCompliance(
    serviceType === "security" ? form.complianceGoal : ""
  );
  const publicExposure =
    serviceType === "security"
      ? hasPublicExposure(form.publicServices)
      : serviceType === "architecture"
      ? hasPublicExposure(form.appType) || hasPublicExposure(form.dataStorageNeeds)
      : false;
  const serviceCount =
    serviceType === "cost"
      ? countServices(form.servicesUsed)
      : serviceType === "architecture" || serviceType === "networking"
      ? countServices(form.dataStorageNeeds ?? form.vpcRequirements ?? "")
      : 2;

  // —— Cloud Maturity Score (0–100) ——
  let maturity = 40;
  if (monthlySpend >= 2000) maturity += 15;
  else if (monthlySpend >= 500) maturity += 10;
  if (multiRegion) maturity += 10;
  if (compliance) maturity += 10;
  if (trafficEstimate === "high") maturity += 5;
  if (serviceCount >= 5) maturity += 5;
  if (serviceType === "security" && publicExposure) maturity += 10;
  if (serviceType === "architecture" && serviceCount >= 3) maturity += 5;
  const cloudMaturityScore = Math.min(100, Math.max(0, maturity));

  // —— Optimization Opportunity ——
  let optimizationOpportunity: OptimizationLevel = "Low";
  if (serviceType === "cost") {
    if (monthlySpend >= 2000) optimizationOpportunity = "High";
    else if (monthlySpend >= 500) optimizationOpportunity = "Medium";
  }

  // —— Risk Level ——
  let riskLevel: RiskLevel = "Low";
  if (serviceType === "security" && publicExposure) {
    riskLevel = compliance ? "High" : "Medium";
  } else if (publicExposure && serviceType === "architecture") {
    riskLevel = "Medium";
  }

  // —— Estimated Annual Savings (cost only) ——
  let estimatedAnnualSavings: number | null = null;
  if (serviceType === "cost" && monthlySpend > 0) {
    const annual = monthlySpend * 12;
    const rate =
      optimizationOpportunity === "High" ? 0.2 : optimizationOpportunity === "Medium" ? 0.15 : 0.1;
    estimatedAnnualSavings = Math.round(annual * rate);
  }

  // —— Complexity Tier ——
  let complexityTier: ComplexityTier = "Self-Serve";
  if (
    cloudMaturityScore >= 70 ||
    monthlySpend >= 2000 ||
    (multiRegion && compliance)
  ) {
    complexityTier = "Enterprise";
  } else if (cloudMaturityScore >= 45 || monthlySpend >= 500 || serviceCount >= 4) {
    complexityTier = "Growth";
  }

  return {
    cloudMaturityScore,
    optimizationOpportunity,
    riskLevel,
    estimatedAnnualSavings,
    complexityTier,
    generatedAt: now,
  };
}
