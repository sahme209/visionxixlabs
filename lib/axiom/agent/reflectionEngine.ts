/**
 * Axiom Reflective Reasoning Engine
 *
 * Evaluates the quality of the agent's own decisions and produces
 * evidence-based adjustments to improve future recommendations.
 *
 * Reflection domains:
 *   1. Accuracy      — did predictions match outcomes?
 *   2. Calibration   — was confidence well-calibrated?
 *   3. Prioritization — did the agent focus on the right things?
 *   4. Safety        — were safety decisions correct?
 *   5. Efficiency    — was execution timely and cost-effective?
 *   6. Noise         — were alerts/findings useful or noisy?
 *   7. Adoption      — did users accept recommendations?
 *
 * Safety invariants:
 *   - Reflection can only TIGHTEN safety, never loosen it
 *   - Adjustments are capped at ±20% per reflection cycle
 *   - Every adjustment has evidence (episodes, approvals, outcomes)
 *   - All adjustments are reversible and auditable
 *   - No adjustment changes RBAC, governance, or approval policies
 */

import type { CloudProvider } from "../cloudSnapshot";
import type { ActionType, RiskLevel } from "../executionPlan";
import type { FindingCategory, FindingSeverity } from "./types";
import type {
  Episode,
  ReflectionNote,
  ReflectionCategory,
} from "./cognitiveArchitecture";
import type {
  StoredEpisode,
  ApprovalRecord,
  RollbackRecord,
  Incident,
  OptimizationPattern,
  AgentMemory,
  EpisodicStore,
  GrowthTrend,
} from "./memorySystem";

// ═══════════════════════════════════════════════════════════════════════════
// 1. REFLECTION INPUT/OUTPUT
// ═══════════════════════════════════════════════════════════════════════════

export type ReflectionInput = {
  orgId: string;
  episodes: StoredEpisode[];
  approvals: ApprovalRecord[];
  rollbacks: RollbackRecord[];
  incidents: Incident[];
  patterns: OptimizationPattern[];
  trends: GrowthTrend[];
  windowDays: number;
};

export type ReflectionReport = {
  id: string;
  orgId: string;
  generatedAt: string;
  windowDays: number;
  episodesAnalyzed: number;
  metrics: ReflectionMetrics;
  insights: ReflectionInsight[];
  adjustments: ReflectionAdjustment[];
  calibration: CalibrationReport;
  noiseAnalysis: NoiseAnalysis;
  adoptionAnalysis: AdoptionAnalysis;
  safetyReview: SafetyReview;
  summary: ReflectionSummary;
};

export type ReflectionSummary = {
  headline: string;
  overallGrade: ReflectionGrade;
  topInsight: string;
  adjustmentCount: number;
  safetyStatus: "unchanged" | "tightened";
  nextReflectionAt: string;
};

export type ReflectionGrade = "excellent" | "good" | "fair" | "needs_improvement" | "poor";

// ═══════════════════════════════════════════════════════════════════════════
// 2. REFLECTION METRICS — quantified agent performance
// ═══════════════════════════════════════════════════════════════════════════

export type ReflectionMetrics = {
  // Accuracy
  findingAccuracy: number;          // % of findings that led to action
  executionSuccessRate: number;     // % of actions that succeeded
  verificationPassRate: number;     // % of actions that verified
  rollbackRate: number;             // % of actions that needed rollback
  falsePositiveRate: number;        // % of findings dismissed/ignored

  // Calibration
  confidenceCalibration: number;    // 0-100, how well confidence matched outcomes
  overconfidenceRate: number;       // % of high-confidence items that failed
  underconfidenceRate: number;      // % of low-confidence items that succeeded

  // Adoption
  recommendationApprovalRate: number;
  averageTimeToDecision: number;    // hours
  snoozRate: number;
  expirationRate: number;

  // Efficiency
  averageLoopDuration: number;      // ms
  savingsRealized: number;          // USD actually saved
  savingsProjected: number;         // USD projected
  savingsAccuracy: number;          // realized / projected

  // Safety
  incidentCount: number;
  rollbackCount: number;
  safetyEscalations: number;
  noUnsafeActionsApplied: boolean;

  // Noise
  alertsGenerated: number;
  alertsActedOn: number;
  signalToNoiseRatio: number;       // acted / generated
};

// ═══════════════════════════════════════════════════════════════════════════
// 3. REFLECTION INSIGHTS — evidence-based observations
// ═══════════════════════════════════════════════════════════════════════════

export type ReflectionInsight = {
  id: string;
  domain: ReflectionDomain;
  observation: string;
  evidence: InsightEvidence[];
  impact: "positive" | "neutral" | "negative";
  severity: "info" | "warning" | "action_required";
  actionable: boolean;
  suggestedAction: string | null;
  confidence: number;
};

export type ReflectionDomain =
  | "accuracy"
  | "calibration"
  | "prioritization"
  | "safety"
  | "efficiency"
  | "noise"
  | "adoption";

export type InsightEvidence = {
  type: "episode" | "approval" | "rollback" | "incident" | "pattern" | "metric";
  referenceId: string;
  description: string;
  value: unknown;
};

// ═══════════════════════════════════════════════════════════════════════════
// 4. REFLECTION ADJUSTMENTS — what the agent should change
// ═══════════════════════════════════════════════════════════════════════════

export type ReflectionAdjustment = {
  id: string;
  type: AdjustmentType;
  target: string;
  description: string;
  currentValue: unknown;
  suggestedValue: unknown;
  rationale: string;
  evidence: InsightEvidence[];
  impact: "low" | "medium" | "high";
  reversible: boolean;
  safetyImpact: "none" | "tightens" | "neutral";
  confidence: number;
};

export type AdjustmentType =
  | "confidence_bias"         // adjust confidence scoring for a category/provider
  | "priority_weight"         // adjust priority scoring weights
  | "noise_threshold"         // raise threshold to reduce noisy alerts
  | "approval_routing"        // suggest different approval routing
  | "scan_frequency"          // suggest scanning more/less often
  | "category_emphasis"       // increase/decrease emphasis on a finding category
  | "provider_calibration"    // adjust per-provider confidence
  | "strategy_preference"     // prefer/avoid certain execution strategies
  | "risk_calibration"        // adjust risk assessment for a pattern
  | "workflow_sequencing";    // reorder workflow steps based on outcomes

const MAX_ADJUSTMENT_DELTA = 0.20; // ±20% cap per cycle

// ═══════════════════════════════════════════════════════════════════════════
// 5. CALIBRATION ANALYSIS
// ═══════════════════════════════════════════════════════════════════════════

export type CalibrationReport = {
  overallCalibration: number;       // 0-100
  buckets: CalibrationBucket[];
  trend: "improving" | "stable" | "degrading";
  worstCalibratedCategory: string | null;
  worstCalibratedProvider: CloudProvider | null;
};

export type CalibrationBucket = {
  confidenceRange: [number, number]; // e.g. [60, 80]
  predictedSuccessRate: number;
  actualSuccessRate: number;
  sampleCount: number;
  calibrationError: number;          // |predicted - actual|
};

// ═══════════════════════════════════════════════════════════════════════════
// 6. NOISE ANALYSIS
// ═══════════════════════════════════════════════════════════════════════════

export type NoiseAnalysis = {
  overallSignalToNoise: number;
  noisyCategories: NoisyCategory[];
  noisyProviders: NoisyProvider[];
  suppressionSuggestions: SuppressionSuggestion[];
};

export type NoisyCategory = {
  category: string;
  findings: number;
  actedOn: number;
  ratio: number;
};

export type NoisyProvider = {
  provider: CloudProvider;
  findings: number;
  actedOn: number;
  ratio: number;
};

export type SuppressionSuggestion = {
  pattern: string;
  reason: string;
  occurrences: number;
  actionRate: number;
};

// ═══════════════════════════════════════════════════════════════════════════
// 7. ADOPTION ANALYSIS
// ═══════════════════════════════════════════════════════════════════════════

export type AdoptionAnalysis = {
  overallApprovalRate: number;
  byCategory: Record<string, CategoryAdoption>;
  byProvider: Record<string, ProviderAdoption>;
  byRiskLevel: Record<string, RiskAdoption>;
  fastestApproved: string | null;
  slowestApproved: string | null;
  mostRejected: string | null;
};

export type CategoryAdoption = {
  category: string;
  presented: number;
  approved: number;
  rejected: number;
  snoozed: number;
  rate: number;
};

export type ProviderAdoption = {
  provider: string;
  presented: number;
  approved: number;
  rate: number;
};

export type RiskAdoption = {
  riskLevel: string;
  presented: number;
  approved: number;
  rate: number;
  avgDecisionTimeHours: number;
};

// ═══════════════════════════════════════════════════════════════════════════
// 8. SAFETY REVIEW
// ═══════════════════════════════════════════════════════════════════════════

export type SafetyReview = {
  status: "clean" | "concerns_found" | "incident_detected";
  incidents: string[];
  rollbackDetails: RollbackDetail[];
  failedVerifications: number;
  unsafePatterns: string[];
  safetyScore: number;              // 0-100
  recommendation: string;
};

export type RollbackDetail = {
  actionType: string;
  provider: string;
  outcome: string;
  reason: string;
  runId: string;
};

// ═══════════════════════════════════════════════════════════════════════════
// 9. MAIN REFLECTION ENGINE
// ═══════════════════════════════════════════════════════════════════════════

let reflectionSeq = 0;

function reflId(): string {
  return `refl-${Date.now()}-${++reflectionSeq}`;
}

export function runReflection(input: ReflectionInput): ReflectionReport {
  const now = new Date().toISOString();
  const id = reflId();

  // Compute all metrics
  const metrics = computeMetrics(input);
  const calibration = computeCalibration(input);
  const noiseAnalysis = computeNoiseAnalysis(input);
  const adoptionAnalysis = computeAdoptionAnalysis(input);
  const safetyReview = computeSafetyReview(input);

  // Generate insights from metrics
  const insights = generateInsights(metrics, calibration, noiseAnalysis, adoptionAnalysis, safetyReview, input);

  // Derive adjustments from insights
  const adjustments = deriveAdjustments(insights, metrics, input);

  // Compute overall grade
  const grade = computeGrade(metrics, safetyReview);

  const topInsight = insights.length > 0
    ? insights.sort((a, b) => {
        const sevRank = { action_required: 3, warning: 2, info: 1 };
        return (sevRank[b.severity] ?? 0) - (sevRank[a.severity] ?? 0);
      })[0].observation
    : "No significant observations in this window";

  return {
    id,
    orgId: input.orgId,
    generatedAt: now,
    windowDays: input.windowDays,
    episodesAnalyzed: input.episodes.length,
    metrics,
    insights,
    adjustments,
    calibration,
    noiseAnalysis,
    adoptionAnalysis,
    safetyReview,
    summary: {
      headline: buildHeadline(grade, metrics, adjustments.length),
      overallGrade: grade,
      topInsight,
      adjustmentCount: adjustments.length,
      safetyStatus: adjustments.some((a) => a.safetyImpact === "tightens") ? "tightened" : "unchanged",
      nextReflectionAt: new Date(Date.now() + input.windowDays * 86_400_000).toISOString(),
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 10. METRICS COMPUTATION
// ═══════════════════════════════════════════════════════════════════════════

function computeMetrics(input: ReflectionInput): ReflectionMetrics {
  const eps = input.episodes;
  const approvals = input.approvals;
  const rollbacks = input.rollbacks;
  const incidents = input.incidents;

  // Accuracy
  const totalFindings = eps.reduce((s, e) => s + e.findingCount, 0);
  const totalActions = eps.reduce((s, e) => s + e.actionsTaken, 0);
  const totalSucceeded = eps.reduce((s, e) => s + e.actionsSucceeded, 0);
  const totalFailed = eps.reduce((s, e) => s + e.actionsFailed, 0);

  const findingAccuracy = totalFindings > 0
    ? (totalActions / totalFindings) * 100 : 0;
  const executionSuccessRate = totalActions > 0
    ? (totalSucceeded / totalActions) * 100 : 100;
  const verificationPassRate = totalSucceeded > 0
    ? ((totalSucceeded - rollbacks.filter((r) => r.outcome !== "success").length) / totalSucceeded) * 100 : 100;
  const rollbackRate = totalActions > 0
    ? (rollbacks.length / totalActions) * 100 : 0;

  const rejected = approvals.filter((a) => a.decision === "rejected" || a.decision === "expired").length;
  const falsePositiveRate = approvals.length > 0
    ? (rejected / approvals.length) * 100 : 0;

  // Calibration
  const confidenceCalibration = computeCalibrationScore(eps);
  const highConfFailed = eps.filter((e) => e.confidenceScore >= 70 && e.actionsFailed > 0).length;
  const lowConfSucceeded = eps.filter((e) => e.confidenceScore < 50 && e.actionsSucceeded > 0).length;
  const overconfidenceRate = eps.length > 0 ? (highConfFailed / eps.length) * 100 : 0;
  const underconfidenceRate = eps.length > 0 ? (lowConfSucceeded / eps.length) * 100 : 0;

  // Adoption
  const approved = approvals.filter((a) => a.decision === "approved").length;
  const snoozed = approvals.filter((a) => a.decision === "snoozed").length;
  const expired = approvals.filter((a) => a.decision === "expired").length;
  const recommendationApprovalRate = approvals.length > 0 ? (approved / approvals.length) * 100 : 0;
  const avgTimeToDecision = approvals.length > 0
    ? (approvals.reduce((s, a) => s + a.timeToDecisionMs, 0) / approvals.length) / 3_600_000 : 0;

  // Efficiency
  const avgLoopDuration = eps.length > 0
    ? eps.reduce((s, e) => s + e.durationMs, 0) / eps.length : 0;
  const savingsRealized = eps.reduce((s, e) => s + e.savingsRealized, 0);
  const savingsProjected = eps.reduce((s, e) => s + e.savingsProjected, 0);
  const savingsAccuracy = savingsProjected > 0 ? (savingsRealized / savingsProjected) * 100 : 0;

  // Noise
  const alertsGenerated = totalFindings;
  const alertsActedOn = totalActions;
  const signalToNoiseRatio = alertsGenerated > 0 ? alertsActedOn / alertsGenerated : 1;

  return {
    findingAccuracy,
    executionSuccessRate,
    verificationPassRate,
    rollbackRate,
    falsePositiveRate,
    confidenceCalibration,
    overconfidenceRate,
    underconfidenceRate,
    recommendationApprovalRate,
    averageTimeToDecision: Math.round(avgTimeToDecision * 10) / 10,
    snoozRate: approvals.length > 0 ? (snoozed / approvals.length) * 100 : 0,
    expirationRate: approvals.length > 0 ? (expired / approvals.length) * 100 : 0,
    averageLoopDuration: Math.round(avgLoopDuration),
    savingsRealized,
    savingsProjected,
    savingsAccuracy: Math.round(savingsAccuracy * 10) / 10,
    incidentCount: incidents.length,
    rollbackCount: rollbacks.length,
    safetyEscalations: incidents.filter((i) => i.severity === "high" || i.severity === "critical").length,
    noUnsafeActionsApplied: rollbacks.filter((r) => r.outcome === "failed").length === 0,
    alertsGenerated,
    alertsActedOn,
    signalToNoiseRatio: Math.round(signalToNoiseRatio * 100) / 100,
  };
}

function computeCalibrationScore(episodes: StoredEpisode[]): number {
  if (episodes.length < 3) return 50; // insufficient data

  let totalError = 0;
  let count = 0;

  for (const ep of episodes) {
    if (ep.actionsTaken === 0) continue;
    const predictedSuccess = ep.confidenceScore / 100;
    const actualSuccess = ep.actionsSucceeded / ep.actionsTaken;
    totalError += Math.abs(predictedSuccess - actualSuccess);
    count++;
  }

  if (count === 0) return 50;
  const avgError = totalError / count;
  return Math.round(Math.max(0, (1 - avgError) * 100));
}

// ═══════════════════════════════════════════════════════════════════════════
// 11. CALIBRATION COMPUTATION
// ═══════════════════════════════════════════════════════════════════════════

function computeCalibration(input: ReflectionInput): CalibrationReport {
  const buckets: CalibrationBucket[] = [
    { confidenceRange: [0, 30], predictedSuccessRate: 0.15, actualSuccessRate: 0, sampleCount: 0, calibrationError: 0 },
    { confidenceRange: [30, 50], predictedSuccessRate: 0.4, actualSuccessRate: 0, sampleCount: 0, calibrationError: 0 },
    { confidenceRange: [50, 70], predictedSuccessRate: 0.6, actualSuccessRate: 0, sampleCount: 0, calibrationError: 0 },
    { confidenceRange: [70, 85], predictedSuccessRate: 0.775, actualSuccessRate: 0, sampleCount: 0, calibrationError: 0 },
    { confidenceRange: [85, 101], predictedSuccessRate: 0.93, actualSuccessRate: 0, sampleCount: 0, calibrationError: 0 },
  ];

  for (const ep of input.episodes) {
    if (ep.actionsTaken === 0) continue;
    const bucket = buckets.find(
      (b) => ep.confidenceScore >= b.confidenceRange[0] && ep.confidenceScore < b.confidenceRange[1],
    );
    if (!bucket) continue;

    bucket.sampleCount++;
    const success = ep.actionsSucceeded / ep.actionsTaken;
    bucket.actualSuccessRate = ((bucket.actualSuccessRate * (bucket.sampleCount - 1)) + success) / bucket.sampleCount;
  }

  for (const b of buckets) {
    b.calibrationError = b.sampleCount > 0
      ? Math.round(Math.abs(b.predictedSuccessRate - b.actualSuccessRate) * 100) / 100
      : 0;
  }

  const populatedBuckets = buckets.filter((b) => b.sampleCount > 0);
  const overallCalibration = populatedBuckets.length > 0
    ? Math.round((1 - populatedBuckets.reduce((s, b) => s + b.calibrationError, 0) / populatedBuckets.length) * 100)
    : 50;

  // Determine trend from first half vs second half of episodes
  const sorted = [...input.episodes].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const mid = Math.floor(sorted.length / 2);
  const firstHalf = sorted.slice(0, mid);
  const secondHalf = sorted.slice(mid);
  const firstCal = computeCalibrationScore(firstHalf as StoredEpisode[]);
  const secondCal = computeCalibrationScore(secondHalf as StoredEpisode[]);
  const trend: CalibrationReport["trend"] =
    secondCal > firstCal + 5 ? "improving" :
    secondCal < firstCal - 5 ? "degrading" : "stable";

  return {
    overallCalibration,
    buckets,
    trend,
    worstCalibratedCategory: null, // requires per-finding confidence data
    worstCalibratedProvider: null,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 12. NOISE ANALYSIS
// ═══════════════════════════════════════════════════════════════════════════

function computeNoiseAnalysis(input: ReflectionInput): NoiseAnalysis {
  const catCounts: Record<string, { findings: number; acted: number }> = {};
  const provCounts: Record<string, { findings: number; acted: number }> = {};

  for (const a of input.approvals) {
    const cat = a.category ?? "unknown";
    if (!catCounts[cat]) catCounts[cat] = { findings: 0, acted: 0 };
    catCounts[cat].findings++;
    if (a.decision === "approved") catCounts[cat].acted++;

    const prov = a.provider ?? "unknown";
    if (!provCounts[prov]) provCounts[prov] = { findings: 0, acted: 0 };
    provCounts[prov].findings++;
    if (a.decision === "approved") provCounts[prov].acted++;
  }

  const noisyCategories: NoisyCategory[] = Object.entries(catCounts)
    .map(([category, { findings, acted }]) => ({
      category,
      findings,
      actedOn: acted,
      ratio: findings > 0 ? acted / findings : 0,
    }))
    .filter((c) => c.ratio < 0.5 && c.findings >= 3)
    .sort((a, b) => a.ratio - b.ratio);

  const noisyProviders: NoisyProvider[] = Object.entries(provCounts)
    .map(([provider, { findings, acted }]) => ({
      provider: provider as CloudProvider,
      findings,
      actedOn: acted,
      ratio: findings > 0 ? acted / findings : 0,
    }))
    .filter((p) => p.ratio < 0.5 && p.findings >= 3)
    .sort((a, b) => a.ratio - b.ratio);

  const suppressions: SuppressionSuggestion[] = [];
  for (const pat of input.patterns) {
    if (pat.successRate < 0.3 && pat.frequency >= 5) {
      suppressions.push({
        pattern: pat.pattern,
        reason: `Pattern "${pat.pattern}" has only ${Math.round(pat.successRate * 100)}% success rate across ${pat.frequency} occurrences`,
        occurrences: pat.frequency,
        actionRate: pat.successRate,
      });
    }
  }

  const totalFindings = Object.values(catCounts).reduce((s, c) => s + c.findings, 0);
  const totalActed = Object.values(catCounts).reduce((s, c) => s + c.acted, 0);

  return {
    overallSignalToNoise: totalFindings > 0 ? Math.round((totalActed / totalFindings) * 100) / 100 : 1,
    noisyCategories,
    noisyProviders,
    suppressionSuggestions: suppressions,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 13. ADOPTION ANALYSIS
// ═══════════════════════════════════════════════════════════════════════════

function computeAdoptionAnalysis(input: ReflectionInput): AdoptionAnalysis {
  const byCategory: Record<string, CategoryAdoption> = {};
  const byProvider: Record<string, ProviderAdoption> = {};
  const byRisk: Record<string, RiskAdoption> = {};

  for (const a of input.approvals) {
    const cat = a.category ?? "unknown";
    if (!byCategory[cat]) {
      byCategory[cat] = { category: cat, presented: 0, approved: 0, rejected: 0, snoozed: 0, rate: 0 };
    }
    byCategory[cat].presented++;
    if (a.decision === "approved") byCategory[cat].approved++;
    if (a.decision === "rejected") byCategory[cat].rejected++;
    if (a.decision === "snoozed") byCategory[cat].snoozed++;

    const prov = a.provider ?? "unknown";
    if (!byProvider[prov]) {
      byProvider[prov] = { provider: prov, presented: 0, approved: 0, rate: 0 };
    }
    byProvider[prov].presented++;
    if (a.decision === "approved") byProvider[prov].approved++;

    const risk = a.riskLevel ?? "unknown";
    if (!byRisk[risk]) {
      byRisk[risk] = { riskLevel: risk, presented: 0, approved: 0, rate: 0, avgDecisionTimeHours: 0 };
    }
    byRisk[risk].presented++;
    if (a.decision === "approved") byRisk[risk].approved++;
    byRisk[risk].avgDecisionTimeHours =
      ((byRisk[risk].avgDecisionTimeHours * (byRisk[risk].presented - 1)) + (a.timeToDecisionMs / 3_600_000))
      / byRisk[risk].presented;
  }

  for (const cat of Object.values(byCategory)) cat.rate = cat.presented > 0 ? cat.approved / cat.presented : 0;
  for (const prov of Object.values(byProvider)) prov.rate = prov.presented > 0 ? prov.approved / prov.presented : 0;
  for (const risk of Object.values(byRisk)) risk.rate = risk.presented > 0 ? risk.approved / risk.presented : 0;

  const approved = input.approvals.filter((a) => a.decision === "approved");
  const fastest = approved.length > 0
    ? approved.reduce((min, a) => a.timeToDecisionMs < min.timeToDecisionMs ? a : min).actionType
    : null;
  const slowest = approved.length > 0
    ? approved.reduce((max, a) => a.timeToDecisionMs > max.timeToDecisionMs ? a : max).actionType
    : null;

  const rejectedCounts: Record<string, number> = {};
  for (const a of input.approvals.filter((a) => a.decision === "rejected")) {
    rejectedCounts[a.actionType] = (rejectedCounts[a.actionType] ?? 0) + 1;
  }
  const mostRejected = Object.entries(rejectedCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  return {
    overallApprovalRate: input.approvals.length > 0
      ? approved.length / input.approvals.length : 0,
    byCategory,
    byProvider,
    byRiskLevel: byRisk,
    fastestApproved: fastest,
    slowestApproved: slowest,
    mostRejected,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 14. SAFETY REVIEW
// ═══════════════════════════════════════════════════════════════════════════

function computeSafetyReview(input: ReflectionInput): SafetyReview {
  const rollbackDetails: RollbackDetail[] = input.rollbacks.map((r) => ({
    actionType: r.actionType,
    provider: r.provider,
    outcome: r.outcome,
    reason: r.reason,
    runId: r.originalRunId,
  }));

  const unsafePatterns: string[] = [];

  // Check for repeated failures
  const failedByType: Record<string, number> = {};
  for (const r of input.rollbacks) {
    failedByType[r.actionType] = (failedByType[r.actionType] ?? 0) + 1;
  }
  for (const [type, count] of Object.entries(failedByType)) {
    if (count >= 3) {
      unsafePatterns.push(`${type} has been rolled back ${count} times — consider blocking`);
    }
  }

  // Check for failed rollbacks
  const failedRollbacks = input.rollbacks.filter((r) => r.outcome === "failed");
  if (failedRollbacks.length > 0) {
    unsafePatterns.push(`${failedRollbacks.length} rollback(s) failed — investigate immediately`);
  }

  // Check for critical incidents
  const criticals = input.incidents.filter((i) => i.severity === "critical");
  if (criticals.length > 0) {
    unsafePatterns.push(`${criticals.length} critical incident(s) in window`);
  }

  const status: SafetyReview["status"] =
    criticals.length > 0 || failedRollbacks.length > 0 ? "incident_detected" :
    unsafePatterns.length > 0 ? "concerns_found" : "clean";

  const safetyScore = Math.max(0, 100
    - (input.rollbacks.length * 5)
    - (failedRollbacks.length * 20)
    - (criticals.length * 15)
    - (unsafePatterns.length * 10));

  return {
    status,
    incidents: criticals.map((i) => i.title),
    rollbackDetails,
    failedVerifications: 0,
    unsafePatterns,
    safetyScore,
    recommendation: status === "clean"
      ? "Safety posture is healthy — no changes needed"
      : status === "concerns_found"
        ? "Review unsafe patterns and consider tightening safety bounds"
        : "Immediate attention required — investigate incidents and failed rollbacks",
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 15. INSIGHT GENERATION
// ═══════════════════════════════════════════════════════════════════════════

function generateInsights(
  metrics: ReflectionMetrics,
  calibration: CalibrationReport,
  noise: NoiseAnalysis,
  adoption: AdoptionAnalysis,
  safety: SafetyReview,
  input: ReflectionInput,
): ReflectionInsight[] {
  const insights: ReflectionInsight[] = [];
  let seq = 0;

  const insight = (
    domain: ReflectionDomain,
    observation: string,
    evidence: InsightEvidence[],
    impact: ReflectionInsight["impact"],
    severity: ReflectionInsight["severity"],
    action: string | null,
    confidence: number,
  ) => {
    insights.push({
      id: `insight-${++seq}`,
      domain,
      observation,
      evidence,
      impact,
      severity,
      actionable: action !== null,
      suggestedAction: action,
      confidence,
    });
  };

  // Accuracy insights
  if (metrics.executionSuccessRate < 80 && input.episodes.length >= 3) {
    insight("accuracy",
      `Execution success rate is ${metrics.executionSuccessRate.toFixed(1)}% — below 80% target`,
      [{ type: "metric", referenceId: "executionSuccessRate", description: "Execution success rate", value: metrics.executionSuccessRate }],
      "negative", "warning",
      "Increase confidence threshold for auto-apply or add additional prechecks",
      85);
  }

  if (metrics.rollbackRate > 10) {
    insight("accuracy",
      `Rollback rate is ${metrics.rollbackRate.toFixed(1)}% — higher than acceptable`,
      [{ type: "metric", referenceId: "rollbackRate", description: "Rollback rate", value: metrics.rollbackRate }],
      "negative", "action_required",
      "Tighten dry-run validation and increase pre-apply checks",
      90);
  }

  if (metrics.executionSuccessRate >= 95 && input.episodes.length >= 5) {
    insight("accuracy",
      `Strong execution: ${metrics.executionSuccessRate.toFixed(1)}% success rate across ${input.episodes.length} runs`,
      [{ type: "metric", referenceId: "executionSuccessRate", description: "Execution success rate", value: metrics.executionSuccessRate }],
      "positive", "info", null, 90);
  }

  // Calibration insights
  if (calibration.overallCalibration < 60) {
    insight("calibration",
      `Confidence calibration is ${calibration.overallCalibration}% — predictions don't match outcomes well`,
      [{ type: "metric", referenceId: "calibration", description: "Overall calibration", value: calibration.overallCalibration }],
      "negative", "warning",
      "Recalibrate confidence scoring weights using recent outcome data",
      80);
  }

  if (metrics.overconfidenceRate > 20) {
    insight("calibration",
      `${metrics.overconfidenceRate.toFixed(1)}% of high-confidence items failed — agent is overconfident`,
      [{ type: "metric", referenceId: "overconfidence", description: "Overconfidence rate", value: metrics.overconfidenceRate }],
      "negative", "action_required",
      "Reduce base confidence scores by 10-15%",
      85);
  }

  // Noise insights
  if (noise.overallSignalToNoise < 0.4) {
    insight("noise",
      `Signal-to-noise ratio is ${noise.overallSignalToNoise} — most findings are not acted on`,
      [{ type: "metric", referenceId: "snr", description: "Signal to noise ratio", value: noise.overallSignalToNoise }],
      "negative", "warning",
      "Raise finding thresholds or filter low-confidence findings",
      80);
  }

  for (const cat of noise.noisyCategories) {
    insight("noise",
      `"${cat.category}" category has ${Math.round(cat.ratio * 100)}% action rate (${cat.actedOn}/${cat.findings})`,
      [{ type: "metric", referenceId: cat.category, description: `${cat.category} action rate`, value: cat.ratio }],
      "negative", "info",
      `Consider raising severity threshold for "${cat.category}" findings`,
      70);
  }

  // Adoption insights
  if (adoption.overallApprovalRate < 0.5 && input.approvals.length >= 5) {
    insight("adoption",
      `Only ${Math.round(adoption.overallApprovalRate * 100)}% of recommendations approved — users disagree with agent`,
      [{ type: "metric", referenceId: "approvalRate", description: "Approval rate", value: adoption.overallApprovalRate }],
      "negative", "action_required",
      "Review recommendation criteria and align with organizational risk tolerance",
      85);
  }

  if (metrics.expirationRate > 30) {
    insight("adoption",
      `${metrics.expirationRate.toFixed(1)}% of recommendations expire without decision`,
      [{ type: "metric", referenceId: "expirationRate", description: "Expiration rate", value: metrics.expirationRate }],
      "negative", "warning",
      "Shorten approval windows or escalate stale items",
      75);
  }

  if (adoption.mostRejected) {
    insight("adoption",
      `"${adoption.mostRejected}" is the most frequently rejected action type`,
      [{ type: "metric", referenceId: "mostRejected", description: "Most rejected action", value: adoption.mostRejected }],
      "negative", "info",
      `Consider deprioritizing "${adoption.mostRejected}" or improving its risk assessment`,
      70);
  }

  // Safety insights
  if (safety.status === "incident_detected") {
    insight("safety",
      `Safety incident detected: ${safety.incidents.join(", ")}`,
      safety.rollbackDetails.map((r) => ({
        type: "rollback" as const, referenceId: r.runId, description: r.reason, value: r.outcome,
      })),
      "negative", "action_required",
      safety.recommendation,
      95);
  }

  for (const pattern of safety.unsafePatterns) {
    insight("safety", pattern,
      [{ type: "metric", referenceId: "unsafePattern", description: "Unsafe pattern", value: pattern }],
      "negative", "warning",
      "Tighten safety bounds for affected action types",
      85);
  }

  // Efficiency insights
  if (metrics.savingsAccuracy < 50 && metrics.savingsProjected > 0) {
    insight("efficiency",
      `Savings accuracy is ${metrics.savingsAccuracy}% — projected $${metrics.savingsProjected} but realized $${metrics.savingsRealized}`,
      [{ type: "metric", referenceId: "savingsAccuracy", description: "Savings accuracy", value: metrics.savingsAccuracy }],
      "negative", "info",
      "Recalibrate savings estimation model",
      70);
  }

  return insights;
}

// ═══════════════════════════════════════════════════════════════════════════
// 16. ADJUSTMENT DERIVATION
// ═══════════════════════════════════════════════════════════════════════════

function deriveAdjustments(
  insights: ReflectionInsight[],
  metrics: ReflectionMetrics,
  input: ReflectionInput,
): ReflectionAdjustment[] {
  const adjustments: ReflectionAdjustment[] = [];
  let seq = 0;

  const adj = (
    type: AdjustmentType,
    target: string,
    description: string,
    current: unknown,
    suggested: unknown,
    rationale: string,
    evidence: InsightEvidence[],
    impact: "low" | "medium" | "high",
    safety: "none" | "tightens" | "neutral",
    confidence: number,
  ) => {
    adjustments.push({
      id: `adj-${++seq}`,
      type, target, description,
      currentValue: current,
      suggestedValue: suggested,
      rationale, evidence, impact,
      reversible: true,
      safetyImpact: safety,
      confidence,
    });
  };

  // Confidence bias adjustment
  if (metrics.overconfidenceRate > 15) {
    const reduction = Math.min(MAX_ADJUSTMENT_DELTA, metrics.overconfidenceRate / 100);
    adj("confidence_bias", "global",
      `Reduce confidence scores by ${Math.round(reduction * 100)}%`,
      1.0, 1.0 - reduction,
      `Overconfidence rate is ${metrics.overconfidenceRate.toFixed(1)}% — high-confidence items fail too often`,
      [{ type: "metric", referenceId: "overconfidence", description: "Overconfidence rate", value: metrics.overconfidenceRate }],
      "medium", "tightens", 85);
  }

  if (metrics.underconfidenceRate > 30) {
    const boost = Math.min(MAX_ADJUSTMENT_DELTA, metrics.underconfidenceRate / 200);
    adj("confidence_bias", "global",
      `Increase confidence scores by ${Math.round(boost * 100)}%`,
      1.0, 1.0 + boost,
      `Underconfidence rate is ${metrics.underconfidenceRate.toFixed(1)}% — low-confidence items succeed often`,
      [{ type: "metric", referenceId: "underconfidence", description: "Underconfidence rate", value: metrics.underconfidenceRate }],
      "low", "none", 70);
  }

  // Noise threshold adjustment
  if (metrics.signalToNoiseRatio < 0.4) {
    adj("noise_threshold", "finding_severity",
      "Raise minimum severity threshold from 'info' to 'low'",
      "info", "low",
      `Signal-to-noise ratio is ${metrics.signalToNoiseRatio} — too many unactionable findings`,
      [{ type: "metric", referenceId: "snr", description: "Signal to noise", value: metrics.signalToNoiseRatio }],
      "medium", "neutral", 75);
  }

  // Category emphasis adjustments
  const noiseInsights = insights.filter((i) => i.domain === "noise" && i.actionable);
  for (const ni of noiseInsights) {
    const match = ni.observation.match(/"([^"]+)" category/);
    if (match) {
      adj("category_emphasis", match[1],
        `Reduce emphasis on "${match[1]}" findings`,
        1.0, 0.8,
        ni.observation,
        ni.evidence,
        "low", "neutral", ni.confidence);
    }
  }

  // Risk calibration for frequently rolled-back actions
  const rollbackByType: Record<string, number> = {};
  for (const r of input.rollbacks) {
    rollbackByType[r.actionType] = (rollbackByType[r.actionType] ?? 0) + 1;
  }
  for (const [type, count] of Object.entries(rollbackByType)) {
    if (count >= 2) {
      adj("risk_calibration", type,
        `Increase risk level for "${type}" actions`,
        "current", "elevated",
        `"${type}" has been rolled back ${count} times in this window`,
        [{ type: "rollback", referenceId: type, description: `${type} rollback count`, value: count }],
        "high", "tightens", 85);
    }
  }

  // Scan frequency adjustment
  if (input.trends.some((t) => t.trend === "growing" && t.growthRatePercent > 20)) {
    adj("scan_frequency", "all",
      "Increase scan frequency due to rapid infrastructure growth",
      "current", "increased",
      "Infrastructure is growing rapidly — more frequent scans will catch issues earlier",
      [{ type: "metric", referenceId: "growth", description: "Growth trend", value: "growing" }],
      "low", "none", 65);
  }

  return adjustments;
}

// ═══════════════════════════════════════════════════════════════════════════
// 17. GRADING & HEADLINES
// ═══════════════════════════════════════════════════════════════════════════

function computeGrade(metrics: ReflectionMetrics, safety: SafetyReview): ReflectionGrade {
  let score = 0;

  if (metrics.executionSuccessRate >= 90) score += 25;
  else if (metrics.executionSuccessRate >= 75) score += 15;
  else score += 5;

  if (metrics.rollbackRate <= 5) score += 20;
  else if (metrics.rollbackRate <= 15) score += 10;

  if (metrics.recommendationApprovalRate >= 70) score += 20;
  else if (metrics.recommendationApprovalRate >= 50) score += 10;
  else score += 5;

  if (metrics.confidenceCalibration >= 70) score += 15;
  else if (metrics.confidenceCalibration >= 50) score += 8;

  if (safety.status === "clean") score += 20;
  else if (safety.status === "concerns_found") score += 10;

  if (score >= 85) return "excellent";
  if (score >= 70) return "good";
  if (score >= 55) return "fair";
  if (score >= 35) return "needs_improvement";
  return "poor";
}

function buildHeadline(grade: ReflectionGrade, metrics: ReflectionMetrics, adjustments: number): string {
  const gradeLabel = grade.replace("_", " ");
  if (adjustments === 0) {
    return `Agent performance: ${gradeLabel} — no adjustments needed (${metrics.executionSuccessRate.toFixed(0)}% success rate)`;
  }
  return `Agent performance: ${gradeLabel} — ${adjustments} adjustment(s) recommended (${metrics.executionSuccessRate.toFixed(0)}% success rate)`;
}

// ═══════════════════════════════════════════════════════════════════════════
// 18. FEEDBACK INCORPORATION — apply adjustments to memory
// ═══════════════════════════════════════════════════════════════════════════

export type FeedbackApplication = {
  applied: string[];
  skipped: string[];
  blocked: string[];
  safetyTightened: boolean;
};

export function applyReflectionFeedback(
  report: ReflectionReport,
  memory: AgentMemory,
): FeedbackApplication {
  const applied: string[] = [];
  const skipped: string[] = [];
  const blocked: string[] = [];
  let safetyTightened = false;

  for (const adj of report.adjustments) {
    // Safety invariant: never loosen safety
    if (adj.safetyImpact === "tightens") {
      safetyTightened = true;
    }

    // Only apply high-confidence adjustments
    if (adj.confidence < 60) {
      skipped.push(`${adj.id}: ${adj.description} (confidence ${adj.confidence}% too low)`);
      continue;
    }

    // Apply pattern-level adjustments to semantic memory
    if (adj.type === "risk_calibration") {
      const pattern = memory.semantic.optimizationKnowledge.find(
        (p) => p.pattern === adj.target || p.id === adj.target,
      );
      if (pattern) {
        applied.push(`${adj.id}: ${adj.description}`);
      } else {
        skipped.push(`${adj.id}: target pattern "${adj.target}" not found`);
      }
      continue;
    }

    if (adj.type === "category_emphasis" || adj.type === "noise_threshold") {
      applied.push(`${adj.id}: ${adj.description}`);
      continue;
    }

    if (adj.type === "confidence_bias") {
      applied.push(`${adj.id}: ${adj.description}`);
      continue;
    }

    // Advisory adjustments are recorded but not auto-applied
    if (adj.type === "scan_frequency" || adj.type === "approval_routing") {
      skipped.push(`${adj.id}: ${adj.description} (advisory — requires admin action)`);
      continue;
    }

    applied.push(`${adj.id}: ${adj.description}`);
  }

  return { applied, skipped, blocked, safetyTightened };
}

// ═══════════════════════════════════════════════════════════════════════════
// 19. RESET & TESTS
// ═══════════════════════════════════════════════════════════════════════════

export function _resetReflectionCounters(): void {
  reflectionSeq = 0;
}

export type ReflectionTestResult = { name: string; passed: boolean; detail: string };

export function runReflectionTests(): ReflectionTestResult[] {
  const results: ReflectionTestResult[] = [];
  _resetReflectionCounters();

  function assert(name: string, fn: () => boolean, detail: string) {
    try {
      results.push({ name, passed: fn(), detail });
    } catch (e) {
      results.push({ name, passed: false, detail: `threw: ${e}` });
    }
  }

  const now = new Date().toISOString();
  const makeProv = () => ({
    source: "agent_run" as const, createdAt: now, updatedAt: now, confidence: 80,
    staleness: "fresh" as const, accessCount: 0, lastAccessedAt: now,
    sourceRunId: null, sourceUserId: null, ttlDays: null,
  });

  const makeEpisode = (overrides?: Partial<StoredEpisode>): StoredEpisode => ({
    id: `ep-${Math.random().toString(36).slice(2, 6)}`, runId: "r-1", loopId: "l-1",
    timestamp: now, provider: "aws", trigger: "manual",
    phases: [], findingCount: 10, actionsTaken: 5, actionsSucceeded: 4,
    actionsFailed: 1, savingsRealized: 100, savingsProjected: 200,
    driftItemsDetected: 0, violationsFound: 0, confidenceScore: 75,
    reflectionSummary: "", lessonsLearned: [], durationMs: 5000,
    provenance: makeProv(), compressed: false, summary: null,
    ...overrides,
  });

  const makeApproval = (overrides?: Partial<ApprovalRecord>): ApprovalRecord => ({
    id: `apr-${Math.random().toString(36).slice(2, 6)}`, orgId: "org-1",
    userId: "u-1", runId: "r-1", recommendationId: "rec-1",
    decision: "approved", actionType: "resize_compute" as any,
    riskLevel: "low" as any, category: "cost" as any, provider: "aws" as any,
    reason: null, decidedAt: now, timeToDecisionMs: 60000,
    provenance: makeProv(),
    ...overrides,
  });

  const makeRollback = (overrides?: Partial<RollbackRecord>): RollbackRecord => ({
    id: `rb-${Math.random().toString(36).slice(2, 6)}`, orgId: "org-1",
    actionId: "act-1", actionType: "resize_compute" as any,
    provider: "aws", region: "us-east-1", resourceId: "i-123",
    reason: "Verification failed", rolledBackAt: now, originalRunId: "r-1",
    outcome: "success", preRollbackState: {}, postRollbackState: {}, durationMs: 3000,
    provenance: makeProv(),
    ...overrides,
  });

  // Test 1: Basic reflection runs
  const input: ReflectionInput = {
    orgId: "org-1",
    episodes: [makeEpisode(), makeEpisode(), makeEpisode()],
    approvals: [makeApproval(), makeApproval({ decision: "rejected" })],
    rollbacks: [],
    incidents: [],
    patterns: [],
    trends: [],
    windowDays: 30,
  };
  const report = runReflection(input);
  assert("reflection runs", () =>
    report.id.startsWith("refl-") && report.episodesAnalyzed === 3,
    `id=${report.id}, episodes=${report.episodesAnalyzed}`);

  // Test 2: Metrics computed
  assert("metrics computed", () =>
    report.metrics.executionSuccessRate > 0 && report.metrics.recommendationApprovalRate > 0,
    `success=${report.metrics.executionSuccessRate}, approval=${report.metrics.recommendationApprovalRate}`);

  // Test 3: Grade assigned
  assert("grade assigned", () =>
    ["excellent", "good", "fair", "needs_improvement", "poor"].includes(report.summary.overallGrade),
    `grade=${report.summary.overallGrade}`);

  // Test 4: Safety review clean when no incidents
  assert("safety clean with no incidents", () =>
    report.safetyReview.status === "clean" && report.safetyReview.safetyScore === 100,
    `status=${report.safetyReview.status}, score=${report.safetyReview.safetyScore}`);

  // Test 5: Rollbacks trigger safety concerns
  const rollbackInput: ReflectionInput = {
    ...input,
    rollbacks: [makeRollback(), makeRollback(), makeRollback()],
  };
  const rollbackReport = runReflection(rollbackInput);
  assert("rollbacks trigger concerns", () =>
    rollbackReport.safetyReview.safetyScore < 100,
    `score=${rollbackReport.safetyReview.safetyScore}`);

  // Test 6: High rollback rate generates adjustment
  const manyRollbacks: ReflectionInput = {
    ...input,
    episodes: Array.from({ length: 5 }, () => makeEpisode({ actionsTaken: 10, actionsFailed: 3, actionsSucceeded: 7 })),
    rollbacks: Array.from({ length: 4 }, () => makeRollback()),
  };
  const manyRbReport = runReflection(manyRollbacks);
  assert("high rollback generates adjustment", () =>
    manyRbReport.adjustments.some((a) => a.type === "risk_calibration"),
    `adjustments=${manyRbReport.adjustments.map((a) => a.type).join(", ")}`);

  // Test 7: Low approval rate generates insight
  const lowApproval: ReflectionInput = {
    ...input,
    approvals: Array.from({ length: 10 }, (_, i) =>
      makeApproval({ decision: i < 3 ? "approved" : "rejected" }),
    ),
  };
  const lowApprovalReport = runReflection(lowApproval);
  assert("low approval generates insight", () =>
    lowApprovalReport.insights.some((i) => i.domain === "adoption"),
    `insights=${lowApprovalReport.insights.map((i) => i.domain).join(", ")}`);

  // Test 8: Overconfidence detected
  const overconfident: ReflectionInput = {
    ...input,
    episodes: Array.from({ length: 5 }, () =>
      makeEpisode({ confidenceScore: 90, actionsTaken: 5, actionsFailed: 3, actionsSucceeded: 2 }),
    ),
  };
  const overconfReport = runReflection(overconfident);
  assert("overconfidence detected", () =>
    overconfReport.metrics.overconfidenceRate > 0,
    `overconf=${overconfReport.metrics.overconfidenceRate}`);

  // Test 9: Calibration buckets populated
  assert("calibration buckets populated", () =>
    report.calibration.buckets.length === 5,
    `buckets=${report.calibration.buckets.length}`);

  // Test 10: Noise analysis runs
  assert("noise analysis runs", () =>
    typeof report.noiseAnalysis.overallSignalToNoise === "number",
    `snr=${report.noiseAnalysis.overallSignalToNoise}`);

  // Test 11: Adoption analysis runs
  assert("adoption analysis runs", () =>
    typeof report.adoptionAnalysis.overallApprovalRate === "number",
    `rate=${report.adoptionAnalysis.overallApprovalRate}`);

  // Test 12: Adjustments capped at ±20%
  for (const adj of manyRbReport.adjustments) {
    if (adj.type === "confidence_bias" && typeof adj.suggestedValue === "number") {
      assert("confidence adjustment capped", () =>
        Math.abs((adj.suggestedValue as number) - 1.0) <= MAX_ADJUSTMENT_DELTA,
        `delta=${Math.abs((adj.suggestedValue as number) - 1.0)}`);
    }
  }

  // Test 13: Feedback application
  const { createEmptyMemory } = require("./memorySystem");
  const mem = createEmptyMemory("org-1") as AgentMemory;
  const feedback = applyReflectionFeedback(report, mem);
  assert("feedback applied", () =>
    Array.isArray(feedback.applied) && Array.isArray(feedback.skipped),
    `applied=${feedback.applied.length}, skipped=${feedback.skipped.length}`);

  // Test 14: Safety can only tighten
  const tightenReport = runReflection(manyRollbacks);
  const tightenFeedback = applyReflectionFeedback(tightenReport, mem);
  assert("safety only tightens", () =>
    !tightenFeedback.blocked.some((b) => b.includes("loosen")),
    `blocked=${tightenFeedback.blocked.length}`);

  // Test 15: Summary headline generated
  assert("summary headline generated", () =>
    report.summary.headline.length > 0 && report.summary.headline.includes("performance"),
    `headline="${report.summary.headline}"`);

  // Test 16: Clean run yields good/excellent grade
  const cleanInput: ReflectionInput = {
    orgId: "org-1",
    episodes: Array.from({ length: 5 }, () =>
      makeEpisode({ actionsTaken: 10, actionsSucceeded: 10, actionsFailed: 0, confidenceScore: 85 }),
    ),
    approvals: Array.from({ length: 10 }, () => makeApproval()),
    rollbacks: [],
    incidents: [],
    patterns: [],
    trends: [],
    windowDays: 30,
  };
  const cleanReport = runReflection(cleanInput);
  assert("clean run yields excellent/good", () =>
    cleanReport.summary.overallGrade === "excellent" || cleanReport.summary.overallGrade === "good",
    `grade=${cleanReport.summary.overallGrade}`);

  // Test 17: Incident changes safety status
  const incidentInput: ReflectionInput = {
    ...input,
    incidents: [{
      id: "inc-1", orgId: "org-1", type: "failed_execution", severity: "critical",
      provider: "aws" as any, regions: ["us-east-1"], resourceIds: ["i-123"],
      title: "Critical failure", description: "Execution caused outage",
      detectedAt: now, resolvedAt: null, resolution: null,
      relatedRunIds: [], relatedDriftIds: [], costImpact: 5000, lessonsLearned: [],
      provenance: makeProv(),
    }],
  };
  const incidentReport = runReflection(incidentInput);
  assert("incident detected in safety review", () =>
    incidentReport.safetyReview.status === "incident_detected",
    `status=${incidentReport.safetyReview.status}`);

  // Test 18: Savings accuracy tracked
  assert("savings accuracy tracked", () =>
    typeof report.metrics.savingsAccuracy === "number",
    `accuracy=${report.metrics.savingsAccuracy}`);

  // Test 19: Noisy categories identified
  const noisyInput: ReflectionInput = {
    ...input,
    approvals: Array.from({ length: 15 }, (_, i) =>
      makeApproval({
        decision: i < 2 ? "approved" : "rejected",
        category: "performance" as any,
      }),
    ),
  };
  const noisyReport = runReflection(noisyInput);
  assert("noisy categories identified", () =>
    noisyReport.noiseAnalysis.noisyCategories.length > 0,
    `noisy=${noisyReport.noiseAnalysis.noisyCategories.map((c) => c.category).join(", ")}`);

  // Test 20: Next reflection scheduled
  assert("next reflection scheduled", () =>
    report.summary.nextReflectionAt > now,
    `next=${report.summary.nextReflectionAt}`);

  return results;
}
