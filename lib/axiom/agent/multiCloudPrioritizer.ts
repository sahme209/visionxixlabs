import type { CloudProvider } from "../cloudSnapshot";
import type { SignalType, ConfidenceScore } from "../costSignals";
import type { ActionType, RiskLevel } from "../executionPlan";
import type {
  ActionDisposition,
  AgentFinding,
  AgentRecommendation,
  FindingSeverity,
  FindingCategory,
} from "./types";
import { CLOUD_PROVIDER_LABELS } from "../enums";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PrioritizedRecommendation = {
  recommendedOrder: number;
  priorityScore: number;
  priorityReason: string;
  priorityTier: "critical" | "high" | "medium" | "low" | "informational";
  provider: CloudProvider;
  finding: AgentFinding;
  recommendation: AgentRecommendation;
  scoreBreakdown: ScoreBreakdown;
};

export type ScoreBreakdown = {
  savingsScore: number;
  severityScore: number;
  confidenceScore: number;
  safetyBonus: number;
  effortPenalty: number;
  resourceCountBonus: number;
  businessImpactScore: number;
  signalTypeBoost: number;
  total: number;
};

export type MultiCloudRecommendationInput = {
  provider: CloudProvider;
  finding: AgentFinding;
  recommendation: AgentRecommendation;
  signalType?: SignalType;
  resourceCount?: number;
};

// ---------------------------------------------------------------------------
// Scoring weights — tuned so security/resilience can outrank pure cost savings
// ---------------------------------------------------------------------------

const SEVERITY_SCORES: Record<FindingSeverity, number> = {
  critical: 100,
  high: 75,
  medium: 45,
  low: 20,
  info: 5,
};

const CONFIDENCE_MULTIPLIERS: Record<ConfidenceScore, number> = {
  high: 1.0,
  medium: 0.75,
  low: 0.45,
};

const CATEGORY_WEIGHTS: Record<FindingCategory, number> = {
  security: 1.4,
  resilience: 1.3,
  compliance: 1.2,
  cost: 1.0,
  performance: 0.9,
};

const SAFETY_BONUSES: Record<ActionDisposition, number> = {
  auto_fix_candidate: 30,
  approval_required: 0,
  report_only: -10,
  blocked: -25,
};

const EFFORT_PENALTIES: Record<string, number> = {
  none: 0,
  low: 0,
  medium: -8,
  high: -20,
};

const SIGNAL_TYPE_BOOSTS: Record<SignalType, number> = {
  public_storage: 40,
  backup_warning: 35,
  idle_compute: 15,
  compute_rightsizing: 10,
  commitment_discount: 5,
  storage_tiering: 5,
  single_region_risk: 25,
  multi_region_sprawl: 0,
};

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export function prioritizeMultiCloudRecommendations(
  inputs: MultiCloudRecommendationInput[],
): PrioritizedRecommendation[] {
  const scored = inputs.map((input) => {
    const breakdown = computeScore(input);
    return {
      recommendedOrder: 0,
      priorityScore: breakdown.total,
      priorityReason: buildPriorityReason(input, breakdown),
      priorityTier: tierFromScore(breakdown.total),
      provider: input.provider,
      finding: input.finding,
      recommendation: input.recommendation,
      scoreBreakdown: breakdown,
    };
  });

  scored.sort((a, b) => b.priorityScore - a.priorityScore);
  scored.forEach((item, i) => { item.recommendedOrder = i + 1; });

  return scored;
}

// ---------------------------------------------------------------------------
// Score computation
// ---------------------------------------------------------------------------

function computeScore(input: MultiCloudRecommendationInput): ScoreBreakdown {
  const { finding, recommendation, signalType, resourceCount } = input;

  const savingsScore = computeSavingsScore(recommendation);
  const severityScore = computeSeverityScore(finding);
  const confidenceScore = computeConfidenceMultiplied(finding, severityScore);
  const safetyBonus = SAFETY_BONUSES[recommendation.disposition] ?? 0;
  const effortPenalty = EFFORT_PENALTIES[recommendation.effort] ?? 0;
  const resourceCountBonus = computeResourceCountBonus(
    resourceCount ?? finding.affectedResources.length,
  );
  const businessImpactScore = computeBusinessImpact(finding);
  const signalTypeBoost = signalType ? (SIGNAL_TYPE_BOOSTS[signalType] ?? 0) : 0;

  const total = Math.round(
    confidenceScore + savingsScore + safetyBonus + effortPenalty +
    resourceCountBonus + businessImpactScore + signalTypeBoost,
  );

  return {
    savingsScore: Math.round(savingsScore),
    severityScore: Math.round(severityScore),
    confidenceScore: Math.round(confidenceScore),
    safetyBonus,
    effortPenalty,
    resourceCountBonus: Math.round(resourceCountBonus),
    businessImpactScore: Math.round(businessImpactScore),
    signalTypeBoost,
    total,
  };
}

function computeSavingsScore(rec: AgentRecommendation): number {
  const yearly = rec.estimatedSavings?.yearly ?? 0;
  if (yearly <= 0) return 0;
  if (yearly < 500) return 5;
  if (yearly < 2000) return 15;
  if (yearly < 5000) return 30;
  if (yearly < 10000) return 45;
  return Math.min(60, 45 + (yearly - 10000) / 2000);
}

function computeSeverityScore(finding: AgentFinding): number {
  return SEVERITY_SCORES[finding.severity] ?? 10;
}

function computeConfidenceMultiplied(finding: AgentFinding, severityScore: number): number {
  const catWeight = CATEGORY_WEIGHTS[finding.category] ?? 1.0;
  const confMult = CONFIDENCE_MULTIPLIERS[finding.confidence] ?? 0.5;
  return severityScore * catWeight * confMult;
}

function computeResourceCountBonus(count: number): number {
  if (count <= 1) return 0;
  if (count <= 3) return 5;
  if (count <= 10) return 10;
  return Math.min(20, 10 + Math.log2(count) * 2);
}

function computeBusinessImpact(finding: AgentFinding): number {
  let score = 0;

  if (finding.category === "security") score += 15;
  if (finding.category === "resilience") score += 10;

  if (finding.severity === "critical") score += 20;
  else if (finding.severity === "high") score += 10;

  if (finding.category === "security" && finding.severity === "high") score += 10;

  return score;
}

// ---------------------------------------------------------------------------
// Priority tier mapping
// ---------------------------------------------------------------------------

function tierFromScore(score: number): PrioritizedRecommendation["priorityTier"] {
  if (score >= 150) return "critical";
  if (score >= 100) return "high";
  if (score >= 60) return "medium";
  if (score >= 30) return "low";
  return "informational";
}

// ---------------------------------------------------------------------------
// Human-readable priority reason
// ---------------------------------------------------------------------------

function buildPriorityReason(
  input: MultiCloudRecommendationInput,
  breakdown: ScoreBreakdown,
): string {
  const { finding, recommendation, signalType } = input;
  const label = CLOUD_PROVIDER_LABELS[input.provider] ?? input.provider;
  const parts: string[] = [];

  if (signalType === "public_storage") {
    parts.push(`Public storage exposure in ${label} — security risk that outweighs cost considerations.`);
  } else if (signalType === "backup_warning") {
    parts.push(`No backup strategy detected in ${label} — data loss risk requires immediate attention.`);
  } else if (signalType === "single_region_risk") {
    parts.push(`All resources in a single ${label} region — resilience gap with no failover.`);
  } else if (recommendation.disposition === "auto_fix_candidate" && breakdown.savingsScore >= 15) {
    parts.push(`Low-risk, high-savings fix in ${label} — safe to apply automatically.`);
  } else if (finding.severity === "critical" || finding.severity === "high") {
    parts.push(`High-severity ${finding.category} issue in ${label}.`);
  } else if (breakdown.savingsScore >= 30) {
    parts.push(`Significant cost savings opportunity in ${label}.`);
  } else {
    parts.push(`${capitalize(finding.category)} optimization in ${label}.`);
  }

  const factors: string[] = [];
  if (breakdown.savingsScore > 0) {
    factors.push(`$${(recommendation.estimatedSavings?.yearly ?? 0).toLocaleString()}/yr savings`);
  }
  if (finding.severity === "high" || finding.severity === "critical") {
    factors.push(`${finding.severity} severity`);
  }
  if (recommendation.disposition === "auto_fix_candidate") {
    factors.push("safe to auto-apply");
  }
  if (finding.confidence === "high") {
    factors.push("high confidence");
  }
  if (recommendation.effort === "low" || recommendation.effort === "none") {
    factors.push("low effort");
  }

  if (factors.length > 0) {
    parts.push(`Key factors: ${factors.join(", ")}.`);
  }

  return parts.join(" ");
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ---------------------------------------------------------------------------
// Scoring rules documentation (exported for API reference / UI tooltips)
// ---------------------------------------------------------------------------

export const SCORING_RULES = {
  description: "Multi-cloud recommendation prioritizer scoring system",
  maxTheoreticalScore: 285,
  factors: [
    {
      name: "Severity × Category × Confidence",
      weight: "Up to 140 points",
      description:
        "Base severity (5–100) multiplied by category weight (security 1.4×, resilience 1.3×, " +
        "cost 1.0×) and confidence multiplier (high 1.0×, low 0.45×). This ensures high-severity " +
        "security issues with high confidence rank above moderate cost savings.",
    },
    {
      name: "Estimated savings",
      weight: "0–60 points",
      description:
        "Logarithmic scale: <$500/yr = 5pts, $2–5K = 30pts, $10K+ caps at 60pts. " +
        "Capped to prevent cost savings from dominating security/resilience issues.",
    },
    {
      name: "Signal type boost",
      weight: "0–40 points",
      description:
        "public_storage (+40) and backup_warning (+35) rank highest because data exposure " +
        "and data loss are existential risks. single_region_risk (+25) reflects outage impact. " +
        "idle_compute (+15) outranks pure rightsizing (+10) because it's pure waste.",
    },
    {
      name: "Safety bonus",
      weight: "-25 to +30 points",
      description:
        "auto_fix_candidate gets +30 (low-risk fixes should be done first), " +
        "report_only gets -10 (deprioritize items that can't be acted on yet).",
    },
    {
      name: "Business impact",
      weight: "0–45 points",
      description:
        "Extra weight for security category (+15), resilience (+10), critical severity (+20), " +
        "high severity (+10), and the combo of high-severity security (+10 additional).",
    },
    {
      name: "Resource count",
      weight: "0–20 points",
      description:
        "Logarithmic bonus for multi-resource findings. More affected resources = higher blast " +
        "radius = higher priority. Caps at 20 to prevent giant accounts from dominating.",
    },
    {
      name: "Effort penalty",
      weight: "-20 to 0 points",
      description:
        "High-effort actions (-20) and medium-effort (-8) are slightly deprioritized. " +
        "Low/no effort have no penalty — we want quick wins surfaced first.",
    },
  ],
  tiers: [
    { tier: "critical", range: "≥150", description: "Act immediately — security exposure, data loss risk, or high-value safe fix" },
    { tier: "high", range: "100–149", description: "Address this week — significant savings or resilience gap" },
    { tier: "medium", range: "60–99", description: "Plan for this sprint — moderate savings or optimization" },
    { tier: "low", range: "30–59", description: "Backlog — minor improvement, low urgency" },
    { tier: "informational", range: "<30", description: "FYI — no action needed, monitoring only" },
  ],
  designPrinciples: [
    "Public exposure and backup gaps always rank above pure cost savings",
    "Low-risk + high-savings fixes rank very high (safety bonus + savings score)",
    "High-severity security issues outrank even large cost savings",
    "Confidence acts as a multiplier — low-confidence findings are dampened, not removed",
    "Effort is a tiebreaker, not a primary factor — hard-but-important beats easy-but-trivial",
  ],
} as const;

// ---------------------------------------------------------------------------
// Sample input/output for documentation
// ---------------------------------------------------------------------------

export const SAMPLE_INPUT: MultiCloudRecommendationInput[] = [
  {
    provider: "aws",
    signalType: "compute_rightsizing",
    resourceCount: 3,
    finding: {
      id: "f-1", category: "cost", severity: "medium", title: "3 oversized EC2 instances",
      description: "3x m5.2xlarge running at 18% CPU", affectedResources: ["i-01", "i-02", "i-03"],
      region: "us-east-1", provider: "aws", confidence: "high",
      estimatedSavings: { monthly: 420, yearly: 5040 }, data: {},
    },
    recommendation: {
      id: "r-1", findingId: "f-1", title: "Downsize 3x m5.2xlarge → m5.xlarge",
      rationale: "CPU usage averaging 18% over 7 days",
      estimatedSavings: { monthly: 420, yearly: 5040 },
      actionType: "resize_compute", disposition: "approval_required",
      dispositionReason: "Resize requires restart", riskLevel: "medium",
      effort: "medium", actionable: true,
    },
  },
  {
    provider: "gcp",
    signalType: "public_storage",
    resourceCount: 2,
    finding: {
      id: "f-2", category: "security", severity: "high", title: "2 GCS buckets with public access",
      description: "Public access enabled on production buckets", affectedResources: ["prod-data", "user-uploads"],
      region: "us-central1", provider: "gcp", confidence: "high",
      estimatedSavings: null, data: {},
    },
    recommendation: {
      id: "r-2", findingId: "f-2", title: "Restrict public access on 2 GCS buckets",
      rationale: "Public buckets are a data exposure risk",
      estimatedSavings: { monthly: 0, yearly: 0 },
      actionType: "restrict_public_access", disposition: "approval_required",
      dispositionReason: "Verify no CDN dependencies", riskLevel: "medium",
      effort: "medium", actionable: true,
    },
  },
  {
    provider: "azure",
    signalType: "storage_tiering",
    resourceCount: 8,
    finding: {
      id: "f-3", category: "cost", severity: "low", title: "8 storage accounts on Hot tier",
      description: "Cold data on Hot tier across 8 accounts", affectedResources: ["st01", "st02", "st03", "st04", "st05", "st06", "st07", "st08"],
      region: "eastus", provider: "azure", confidence: "medium",
      estimatedSavings: { monthly: 150, yearly: 1800 }, data: {},
    },
    recommendation: {
      id: "r-3", findingId: "f-3", title: "Apply Blob lifecycle policies to 8 storage accounts",
      rationale: "Data not accessed in 60+ days",
      estimatedSavings: { monthly: 150, yearly: 1800 },
      actionType: "apply_storage_policy", disposition: "auto_fix_candidate",
      dispositionReason: "Lifecycle policies are non-disruptive", riskLevel: "low",
      effort: "low", actionable: true,
    },
  },
  {
    provider: "aws",
    signalType: "backup_warning",
    resourceCount: 12,
    finding: {
      id: "f-4", category: "resilience", severity: "high", title: "No backup strategy detected",
      description: "12 resources with no AWS Backup configuration", affectedResources: Array.from({ length: 12 }, (_, i) => `r-${i}`),
      region: "us-east-1", provider: "aws", confidence: "high",
      estimatedSavings: null, data: {},
    },
    recommendation: {
      id: "r-4", findingId: "f-4", title: "Enable AWS Backup for 12 unprotected resources",
      rationale: "No backup or replication detected",
      estimatedSavings: { monthly: 0, yearly: 0 },
      actionType: "enable_backup", disposition: "report_only",
      dispositionReason: "Backup configuration requires review", riskLevel: "low",
      effort: "low", actionable: false,
    },
  },
  {
    provider: "aws",
    signalType: "idle_compute",
    resourceCount: 2,
    finding: {
      id: "f-5", category: "cost", severity: "medium", title: "2 idle/stopped EC2 instances",
      description: "1 running at 1% CPU, 1 stopped with EBS billing", affectedResources: ["i-idle", "i-stopped"],
      region: "us-east-1", provider: "aws", confidence: "high",
      estimatedSavings: { monthly: 140, yearly: 1680 }, data: {},
    },
    recommendation: {
      id: "r-5", findingId: "f-5", title: "Decommission 2 idle EC2 instances",
      rationale: "Near-zero utilization and stopped with disks billing",
      estimatedSavings: { monthly: 140, yearly: 1680 },
      actionType: "decommission_compute", disposition: "approval_required",
      dispositionReason: "Deletion is irreversible", riskLevel: "high",
      effort: "high", actionable: true,
    },
  },
];

export const SAMPLE_OUTPUT: Pick<PrioritizedRecommendation, "recommendedOrder" | "priorityScore" | "priorityTier" | "priorityReason" | "provider">[] = [
  {
    recommendedOrder: 1,
    priorityScore: 180,
    priorityTier: "critical",
    provider: "gcp",
    priorityReason: "Public storage exposure in Google Cloud — security risk that outweighs cost considerations. Key factors: high severity, high confidence.",
  },
  {
    recommendedOrder: 2,
    priorityScore: 152,
    priorityTier: "critical",
    provider: "aws",
    priorityReason: "No backup strategy detected in AWS — data loss risk requires immediate attention. Key factors: high severity, high confidence, low effort.",
  },
  {
    recommendedOrder: 3,
    priorityScore: 100,
    priorityTier: "high",
    provider: "azure",
    priorityReason: "Low-risk, high-savings fix in Azure — safe to apply automatically. Key factors: $1,800/yr savings, safe to auto-apply, low effort.",
  },
  {
    recommendedOrder: 4,
    priorityScore: 92,
    priorityTier: "medium",
    provider: "aws",
    priorityReason: "Significant cost savings opportunity in AWS. Key factors: $5,040/yr savings, high confidence.",
  },
  {
    recommendedOrder: 5,
    priorityScore: 72,
    priorityTier: "medium",
    provider: "aws",
    priorityReason: "Cost optimization in AWS. Key factors: $1,680/yr savings, high confidence.",
  },
];

// ---------------------------------------------------------------------------
// Test runner — validates scoring invariants
// ---------------------------------------------------------------------------

export type PrioritizerTestResult = {
  name: string;
  pass: boolean;
  message: string;
};

export function runPrioritizerTests(): PrioritizerTestResult[] {
  const results: PrioritizerTestResult[] = [];
  const prioritized = prioritizeMultiCloudRecommendations(SAMPLE_INPUT);

  // Test 1: Public storage outranks pure cost savings
  const publicStorage = prioritized.find((p) => p.finding.id === "f-2");
  const rightsizing = prioritized.find((p) => p.finding.id === "f-1");
  results.push({
    name: "public_storage_outranks_cost_savings",
    pass: !!publicStorage && !!rightsizing && publicStorage.recommendedOrder < rightsizing.recommendedOrder,
    message: publicStorage && rightsizing
      ? `Public storage ranked #${publicStorage.recommendedOrder} (score ${publicStorage.priorityScore}), ` +
        `rightsizing ranked #${rightsizing.recommendedOrder} (score ${rightsizing.priorityScore})`
      : "Missing test inputs",
  });

  // Test 2: Backup warning outranks cost savings
  const backup = prioritized.find((p) => p.finding.id === "f-4");
  results.push({
    name: "backup_warning_outranks_cost_savings",
    pass: !!backup && !!rightsizing && backup.recommendedOrder < rightsizing.recommendedOrder,
    message: backup && rightsizing
      ? `Backup warning ranked #${backup.recommendedOrder} (score ${backup.priorityScore}), ` +
        `rightsizing ranked #${rightsizing.recommendedOrder} (score ${rightsizing.priorityScore})`
      : "Missing test inputs",
  });

  // Test 3: Safe auto-fix with savings ranks high
  const storageTiering = prioritized.find((p) => p.finding.id === "f-3");
  results.push({
    name: "safe_autofix_ranks_high",
    pass: !!storageTiering && storageTiering.priorityTier === "high",
    message: storageTiering
      ? `Storage tiering auto-fix: tier=${storageTiering.priorityTier}, score=${storageTiering.priorityScore}`
      : "Missing test input",
  });

  // Test 4: Public storage is critical tier
  results.push({
    name: "public_storage_is_critical",
    pass: !!publicStorage && publicStorage.priorityTier === "critical",
    message: publicStorage
      ? `Public storage: tier=${publicStorage.priorityTier}, score=${publicStorage.priorityScore}`
      : "Missing test input",
  });

  // Test 5: Backup warning is critical tier
  results.push({
    name: "backup_warning_is_critical",
    pass: !!backup && backup.priorityTier === "critical",
    message: backup
      ? `Backup warning: tier=${backup.priorityTier}, score=${backup.priorityScore}`
      : "Missing test input",
  });

  // Test 6: Recommended order is sequential 1..N
  const orders = prioritized.map((p) => p.recommendedOrder);
  const expectedOrders = Array.from({ length: prioritized.length }, (_, i) => i + 1);
  results.push({
    name: "sequential_ordering",
    pass: JSON.stringify(orders) === JSON.stringify(expectedOrders),
    message: `Orders: [${orders.join(", ")}]`,
  });

  // Test 7: Scores are monotonically decreasing
  const scores = prioritized.map((p) => p.priorityScore);
  const isDecreasing = scores.every((s, i) => i === 0 || s <= scores[i - 1]);
  results.push({
    name: "scores_monotonically_decreasing",
    pass: isDecreasing,
    message: `Scores: [${scores.join(", ")}]`,
  });

  // Test 8: Every item has a non-empty priorityReason
  const allHaveReasons = prioritized.every((p) => p.priorityReason.length > 10);
  results.push({
    name: "all_have_priority_reasons",
    pass: allHaveReasons,
    message: `All ${prioritized.length} items have priority reasons`,
  });

  // Test 9: High-effort penalty visible — idle compute (high effort) ranks below storage tiering (low effort, auto-fix)
  const idle = prioritized.find((p) => p.finding.id === "f-5");
  results.push({
    name: "effort_penalty_applied",
    pass: !!idle && !!storageTiering && idle.recommendedOrder > storageTiering.recommendedOrder,
    message: idle && storageTiering
      ? `Idle compute (high effort) ranked #${idle.recommendedOrder}, ` +
        `storage tiering (low effort, auto-fix) ranked #${storageTiering.recommendedOrder}`
      : "Missing test inputs",
  });

  // Test 10: Cross-provider ranking — GCP security issue outranks AWS cost issue
  results.push({
    name: "cross_provider_security_beats_cost",
    pass: !!publicStorage && publicStorage.provider === "gcp" && publicStorage.recommendedOrder === 1,
    message: publicStorage
      ? `GCP public storage ranked #${publicStorage.recommendedOrder} across all providers`
      : "Missing test input",
  });

  return results;
}
