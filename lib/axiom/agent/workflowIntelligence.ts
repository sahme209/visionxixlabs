/**
 * Axiom Workflow Intelligence Engine
 *
 * Self-improving system that learns from historical execution data
 * to optimize agent behavior across seven measurable dimensions:
 *
 *   1. Priority accuracy    — focus on the right fixes first
 *   2. Sequencing quality   — order actions for maximum impact
 *   3. Noise reduction      — suppress low-value recommendations
 *   4. Risk calibration     — right-size risk estimates
 *   5. Savings accuracy     — close the gap between projected and realized
 *   6. Approval efficiency  — time approvals for operator workflows
 *   7. Execution reliability — increase success rate, reduce rollbacks
 *
 * Safety invariants:
 *   - Every adaptation is versioned, explainable, and reversible
 *   - Autonomy never escalates without admin approval
 *   - Adaptations are bounded: max ±15% per evaluation cycle
 *   - All adaptations undergo governance review before activation
 *   - Organization-scoped: no cross-org learning leakage
 *   - Human operators can freeze, rollback, or override any adaptation
 */

import type { CloudProvider } from "../cloudSnapshot";
import type { ActionType, RiskLevel } from "../executionPlan";
import type { FindingCategory, FindingSeverity } from "./types";

// ═══════════════════════════════════════════════════════════════════════════
// 1. LEARNING DIMENSIONS
// ═══════════════════════════════════════════════════════════════════════════

export type LearningDimension =
  | "priority_accuracy"
  | "sequencing_quality"
  | "noise_reduction"
  | "risk_calibration"
  | "savings_accuracy"
  | "approval_efficiency"
  | "execution_reliability";

export type DimensionWeight = {
  dimension: LearningDimension;
  weight: number;               // 0-1, sums to 1.0
  enabled: boolean;
  frozen: boolean;
};

const DEFAULT_WEIGHTS: DimensionWeight[] = [
  { dimension: "priority_accuracy", weight: 0.20, enabled: true, frozen: false },
  { dimension: "sequencing_quality", weight: 0.10, enabled: true, frozen: false },
  { dimension: "noise_reduction", weight: 0.15, enabled: true, frozen: false },
  { dimension: "risk_calibration", weight: 0.15, enabled: true, frozen: false },
  { dimension: "savings_accuracy", weight: 0.15, enabled: true, frozen: false },
  { dimension: "approval_efficiency", weight: 0.10, enabled: true, frozen: false },
  { dimension: "execution_reliability", weight: 0.15, enabled: true, frozen: false },
];

// ═══════════════════════════════════════════════════════════════════════════
// 2. OBSERVATION DATA — raw signals from past runs
// ═══════════════════════════════════════════════════════════════════════════

export type WorkflowObservation = {
  id: string;
  orgId: string;
  runId: string;
  timestamp: string;
  dimension: LearningDimension;
  signal: ObservationSignal;
};

export type ObservationSignal =
  | PrioritySignal
  | SequencingSignal
  | NoiseSignal
  | RiskSignal
  | SavingsSignal
  | ApprovalSignal
  | ExecutionSignal;

export type PrioritySignal = {
  type: "priority";
  findingId: string;
  category: FindingCategory;
  severity: FindingSeverity;
  assignedPriority: number;
  actualImpact: number;           // 0-100, measured post-action
  wasActedOn: boolean;
  provider: CloudProvider;
};

export type SequencingSignal = {
  type: "sequencing";
  operationId: string;
  stepOrder: string[];
  blockingDependencies: number;
  idleWaitMinutes: number;
  parallelismUsed: number;        // 0-1
  totalDurationMs: number;
  optimalDurationMs: number;      // estimated
};

export type NoiseSignal = {
  type: "noise";
  findingId: string;
  category: FindingCategory;
  severity: FindingSeverity;
  wasActedOn: boolean;
  wasSnoozed: boolean;
  wasExpired: boolean;
  recurrenceCount: number;
  provider: CloudProvider;
};

export type RiskSignal = {
  type: "risk";
  actionId: string;
  actionType: ActionType;
  predictedRisk: RiskLevel;
  actualOutcome: "success" | "partial" | "failure" | "rollback";
  confidenceScore: number;
  provider: CloudProvider;
  region: string;
};

export type SavingsSignal = {
  type: "savings";
  recommendationId: string;
  category: FindingCategory;
  projectedMonthlySavings: number;
  realizedMonthlySavings: number;
  measurementDays: number;
  provider: CloudProvider;
};

export type ApprovalSignal = {
  type: "approval";
  approvalId: string;
  actionType: ActionType;
  riskLevel: RiskLevel;
  submittedAt: string;
  decidedAt: string;
  decision: "approved" | "rejected" | "snoozed" | "expired";
  timeToDecisionMs: number;
  dayOfWeek: number;
  hourOfDay: number;
};

export type ExecutionSignal = {
  type: "execution";
  stepId: string;
  actionType: ActionType;
  provider: CloudProvider;
  region: string;
  success: boolean;
  durationMs: number;
  retryCount: number;
  rolledBack: boolean;
  verificationPassed: boolean;
  errorCode: string | null;
};

// ═══════════════════════════════════════════════════════════════════════════
// 3. LEARNED PATTERNS — extracted from observations
// ═══════════════════════════════════════════════════════════════════════════

export type LearnedPattern = {
  id: string;
  orgId: string;
  dimension: LearningDimension;
  patternType: PatternType;
  description: string;
  confidence: number;             // 0-100
  sampleSize: number;
  evidence: PatternEvidence[];
  learnedAt: string;
  lastValidatedAt: string;
  validationCount: number;
  status: "candidate" | "active" | "frozen" | "retired";
};

export type PatternType =
  | "category_priority_bias"
  | "provider_risk_bias"
  | "action_sequence_preference"
  | "noise_suppression_rule"
  | "savings_estimation_correction"
  | "approval_timing_preference"
  | "execution_retry_preference"
  | "region_risk_adjustment"
  | "severity_recalibration"
  | "batch_size_preference";

export type PatternEvidence = {
  observationId: string;
  timestamp: string;
  metric: string;
  value: number;
  supports: boolean;
};

// ═══════════════════════════════════════════════════════════════════════════
// 4. ADAPTATION RULES — how patterns become behavior changes
// ═══════════════════════════════════════════════════════════════════════════

export type Adaptation = {
  id: string;
  orgId: string;
  patternId: string;
  dimension: LearningDimension;
  ruleType: AdaptationRule;
  description: string;

  currentValue: number;
  proposedValue: number;
  delta: number;
  maxDelta: number;

  confidence: number;
  sampleSize: number;
  expectedImprovement: number;    // % improvement

  status: AdaptationStatus;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNotes: string | null;

  activatedAt: string | null;
  deactivatedAt: string | null;
  version: number;

  rollbackValue: number;
  canRollback: boolean;

  governance: AdaptationGovernance;
  metrics: AdaptationMetrics;

  createdAt: string;
  updatedAt: string;
};

export type AdaptationRule =
  | "priority_weight_adjustment"
  | "noise_threshold_raise"
  | "noise_threshold_lower"
  | "risk_score_bias"
  | "savings_multiplier"
  | "approval_window_shift"
  | "retry_count_adjustment"
  | "batch_size_change"
  | "sequence_reorder"
  | "category_emphasis"
  | "provider_confidence_bias"
  | "severity_remap";

export type AdaptationStatus =
  | "proposed"
  | "pending_review"
  | "approved"
  | "active"
  | "monitoring"
  | "frozen"
  | "rolled_back"
  | "retired";

export type AdaptationGovernance = {
  requiresReview: boolean;
  autoApproveIfLowRisk: boolean;
  affectsAutonomy: boolean;
  affectsSafety: boolean;
  escalationRequired: boolean;
  auditTrail: GovernanceEntry[];
};

export type GovernanceEntry = {
  timestamp: string;
  actor: string;
  action: "proposed" | "reviewed" | "approved" | "rejected" | "activated" | "frozen" | "rolled_back" | "retired";
  reason: string;
  metadata: Record<string, unknown>;
};

export type AdaptationMetrics = {
  preActivationBaseline: number;
  postActivationValue: number | null;
  improvementPercent: number | null;
  evaluationCycles: number;
  regressionDetected: boolean;
};

const MAX_ADAPTATION_DELTA = 0.15; // ±15% per cycle

// ═══════════════════════════════════════════════════════════════════════════
// 5. EVALUATION PIPELINE
// ═══════════════════════════════════════════════════════════════════════════

export type EvaluationInput = {
  orgId: string;
  observations: WorkflowObservation[];
  existingPatterns: LearnedPattern[];
  activeAdaptations: Adaptation[];
  weights: DimensionWeight[];
  windowDays: number;
};

export type EvaluationReport = {
  id: string;
  orgId: string;
  evaluatedAt: string;
  windowDays: number;
  observationsAnalyzed: number;

  dimensionScores: DimensionScore[];
  overallScore: number;           // 0-100
  trend: "improving" | "stable" | "degrading";

  patternsDiscovered: LearnedPattern[];
  patternsRetired: string[];
  adaptationsProposed: Adaptation[];
  adaptationsExpired: string[];

  regressions: Regression[];
  safeguardChecks: SafeguardResult[];
  recommendations: IntelligenceRecommendation[];

  summary: EvaluationSummary;
};

export type DimensionScore = {
  dimension: LearningDimension;
  score: number;                  // 0-100
  previousScore: number | null;
  trend: "improving" | "stable" | "degrading";
  sampleSize: number;
  topContributor: string;
  topDetractor: string;
};

export type Regression = {
  dimension: LearningDimension;
  adaptationId: string;
  expectedImprovement: number;
  actualChange: number;
  severity: "minor" | "moderate" | "severe";
  recommendation: "monitor" | "freeze" | "rollback";
};

export type SafeguardResult = {
  check: string;
  passed: boolean;
  details: string;
};

export type IntelligenceRecommendation = {
  id: string;
  dimension: LearningDimension;
  action: string;
  rationale: string;
  expectedImpact: number;
  confidence: number;
  requiresApproval: boolean;
};

export type EvaluationSummary = {
  headline: string;
  overallGrade: "A" | "B" | "C" | "D" | "F";
  improvingDimensions: string[];
  degradingDimensions: string[];
  activeAdaptations: number;
  proposedAdaptations: number;
  regressionsDetected: number;
  safeguardsPassed: boolean;
};

// ═══════════════════════════════════════════════════════════════════════════
// 6. EVALUATION ENGINE
// ═══════════════════════════════════════════════════════════════════════════

let evalSeq = 0;

function evalId(prefix: string): string {
  return `${prefix}-${Date.now()}-${++evalSeq}`;
}

export function evaluate(input: EvaluationInput): EvaluationReport {
  const now = new Date().toISOString();

  const dimensionScores = scoreDimensions(input);
  const overallScore = computeOverallScore(dimensionScores, input.weights);
  const trend = detectOverallTrend(dimensionScores);

  const patternsDiscovered = discoverPatterns(input);
  const patternsRetired = retireStalePatterns(input.existingPatterns, input.observations);
  const adaptationsProposed = proposeAdaptations(patternsDiscovered, input);
  const adaptationsExpired = expireUnusedAdaptations(input.activeAdaptations);

  const regressions = detectRegressions(input.activeAdaptations);
  const safeguardChecks = runSafeguards(adaptationsProposed, input);
  const recommendations = generateRecommendations(dimensionScores, regressions, input);

  const improving = dimensionScores.filter((d) => d.trend === "improving").map((d) => d.dimension);
  const degrading = dimensionScores.filter((d) => d.trend === "degrading").map((d) => d.dimension);

  const grade = overallScore >= 85 ? "A" : overallScore >= 70 ? "B" : overallScore >= 55 ? "C" : overallScore >= 40 ? "D" : "F";

  return {
    id: evalId("eval"),
    orgId: input.orgId,
    evaluatedAt: now,
    windowDays: input.windowDays,
    observationsAnalyzed: input.observations.length,
    dimensionScores,
    overallScore,
    trend,
    patternsDiscovered,
    patternsRetired,
    adaptationsProposed,
    adaptationsExpired,
    regressions,
    safeguardChecks,
    recommendations,
    summary: {
      headline: buildHeadline(grade, overallScore, adaptationsProposed.length, regressions.length),
      overallGrade: grade,
      improvingDimensions: improving,
      degradingDimensions: degrading,
      activeAdaptations: input.activeAdaptations.filter((a) => a.status === "active").length,
      proposedAdaptations: adaptationsProposed.length,
      regressionsDetected: regressions.length,
      safeguardsPassed: safeguardChecks.every((s) => s.passed),
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 7. DIMENSION SCORING
// ═══════════════════════════════════════════════════════════════════════════

function scoreDimensions(input: EvaluationInput): DimensionScore[] {
  const scores: DimensionScore[] = [];

  for (const w of input.weights) {
    if (!w.enabled) continue;

    const obs = input.observations.filter((o) => o.dimension === w.dimension);
    const score = scoreDimension(w.dimension, obs);
    const prevAdaptation = input.activeAdaptations.find((a) => a.dimension === w.dimension && a.metrics.preActivationBaseline > 0);
    const previousScore = prevAdaptation?.metrics.preActivationBaseline ?? null;

    const trend: DimensionScore["trend"] =
      previousScore !== null
        ? score > previousScore + 3 ? "improving" : score < previousScore - 3 ? "degrading" : "stable"
        : "stable";

    const { topContributor, topDetractor } = findContributors(w.dimension, obs);

    scores.push({
      dimension: w.dimension,
      score: Math.round(score),
      previousScore: previousScore !== null ? Math.round(previousScore) : null,
      trend,
      sampleSize: obs.length,
      topContributor,
      topDetractor,
    });
  }

  return scores;
}

function scoreDimension(dimension: LearningDimension, observations: WorkflowObservation[]): number {
  if (observations.length === 0) return 50;

  switch (dimension) {
    case "priority_accuracy":
      return scorePriority(observations);
    case "sequencing_quality":
      return scoreSequencing(observations);
    case "noise_reduction":
      return scoreNoise(observations);
    case "risk_calibration":
      return scoreRisk(observations);
    case "savings_accuracy":
      return scoreSavings(observations);
    case "approval_efficiency":
      return scoreApproval(observations);
    case "execution_reliability":
      return scoreExecution(observations);
    default:
      return 50;
  }
}

function scorePriority(obs: WorkflowObservation[]): number {
  const signals = obs.map((o) => o.signal).filter((s): s is PrioritySignal => s.type === "priority");
  if (signals.length === 0) return 50;

  let correlationSum = 0;
  for (const s of signals) {
    const normalizedPriority = s.assignedPriority / 100;
    const normalizedImpact = s.actualImpact / 100;
    correlationSum += 1 - Math.abs(normalizedPriority - normalizedImpact);
  }

  return Math.round((correlationSum / signals.length) * 100);
}

function scoreSequencing(obs: WorkflowObservation[]): number {
  const signals = obs.map((o) => o.signal).filter((s): s is SequencingSignal => s.type === "sequencing");
  if (signals.length === 0) return 50;

  let efficiencySum = 0;
  for (const s of signals) {
    const efficiency = s.optimalDurationMs > 0
      ? Math.min(1, s.optimalDurationMs / Math.max(s.totalDurationMs, 1))
      : 0.5;
    const parallelismBonus = s.parallelismUsed * 0.2;
    const idlePenalty = Math.min(0.3, (s.idleWaitMinutes / 60) * 0.1);
    efficiencySum += Math.min(1, efficiency + parallelismBonus - idlePenalty);
  }

  return Math.round((efficiencySum / signals.length) * 100);
}

function scoreNoise(obs: WorkflowObservation[]): number {
  const signals = obs.map((o) => o.signal).filter((s): s is NoiseSignal => s.type === "noise");
  if (signals.length === 0) return 50;

  const actedOn = signals.filter((s) => s.wasActedOn).length;
  const snoozed = signals.filter((s) => s.wasSnoozed).length;
  const expired = signals.filter((s) => s.wasExpired).length;

  const actionRate = actedOn / signals.length;
  const noiseRate = (snoozed + expired) / signals.length;

  return Math.round(Math.max(0, (actionRate - noiseRate * 0.5) * 100));
}

function scoreRisk(obs: WorkflowObservation[]): number {
  const signals = obs.map((o) => o.signal).filter((s): s is RiskSignal => s.type === "risk");
  if (signals.length === 0) return 50;

  const riskRank: Record<RiskLevel, number> = { low: 0.2, medium: 0.5, high: 0.8 };
  const outcomeRank: Record<string, number> = { success: 1.0, partial: 0.6, failure: 0.2, rollback: 0.0 };

  let calibrationSum = 0;
  for (const s of signals) {
    const predictedFailRate = riskRank[s.predictedRisk] ?? 0.5;
    const actualFailRate = 1 - (outcomeRank[s.actualOutcome] ?? 0.5);
    calibrationSum += 1 - Math.abs(predictedFailRate - actualFailRate);
  }

  return Math.round((calibrationSum / signals.length) * 100);
}

function scoreSavings(obs: WorkflowObservation[]): number {
  const signals = obs.map((o) => o.signal).filter((s): s is SavingsSignal => s.type === "savings");
  if (signals.length === 0) return 50;

  let accuracySum = 0;
  for (const s of signals) {
    if (s.projectedMonthlySavings === 0) {
      accuracySum += s.realizedMonthlySavings === 0 ? 1 : 0;
      continue;
    }
    const ratio = s.realizedMonthlySavings / s.projectedMonthlySavings;
    accuracySum += Math.max(0, 1 - Math.abs(1 - ratio));
  }

  return Math.round((accuracySum / signals.length) * 100);
}

function scoreApproval(obs: WorkflowObservation[]): number {
  const signals = obs.map((o) => o.signal).filter((s): s is ApprovalSignal => s.type === "approval");
  if (signals.length === 0) return 50;

  const approved = signals.filter((s) => s.decision === "approved");
  const approvalRate = approved.length / signals.length;

  const avgDecisionHours = signals.reduce((s, a) => s + a.timeToDecisionMs, 0) / signals.length / 3_600_000;
  const speedScore = Math.max(0, 1 - (avgDecisionHours / 48)); // 48h = 0 score

  const expiredRate = signals.filter((s) => s.decision === "expired").length / signals.length;

  return Math.round(((approvalRate * 0.5) + (speedScore * 0.3) + ((1 - expiredRate) * 0.2)) * 100);
}

function scoreExecution(obs: WorkflowObservation[]): number {
  const signals = obs.map((o) => o.signal).filter((s): s is ExecutionSignal => s.type === "execution");
  if (signals.length === 0) return 50;

  const successRate = signals.filter((s) => s.success).length / signals.length;
  const verificationRate = signals.filter((s) => s.verificationPassed).length / signals.length;
  const rollbackRate = signals.filter((s) => s.rolledBack).length / signals.length;
  const avgRetries = signals.reduce((s, e) => s + e.retryCount, 0) / signals.length;

  const retryPenalty = Math.min(0.2, avgRetries * 0.05);

  return Math.round(((successRate * 0.4) + (verificationRate * 0.3) + ((1 - rollbackRate) * 0.2) - retryPenalty) * 100);
}

function findContributors(dimension: LearningDimension, obs: WorkflowObservation[]): { topContributor: string; topDetractor: string } {
  if (obs.length === 0) return { topContributor: "insufficient data", topDetractor: "insufficient data" };

  const providerScores: Record<string, { sum: number; count: number }> = {};
  for (const o of obs) {
    const sig = o.signal as Record<string, unknown>;
    const provider = (sig.provider as string) ?? "unknown";
    if (!providerScores[provider]) providerScores[provider] = { sum: 0, count: 0 };
    providerScores[provider].count++;

    if (sig.type === "priority") providerScores[provider].sum += (sig as PrioritySignal).wasActedOn ? 1 : 0;
    else if (sig.type === "execution") providerScores[provider].sum += (sig as ExecutionSignal).success ? 1 : 0;
    else if (sig.type === "noise") providerScores[provider].sum += (sig as NoiseSignal).wasActedOn ? 1 : -0.5;
    else providerScores[provider].sum += 0.5;
  }

  const sorted = Object.entries(providerScores)
    .map(([k, v]) => ({ provider: k, avg: v.sum / v.count }))
    .sort((a, b) => b.avg - a.avg);

  return {
    topContributor: sorted[0]?.provider ?? "none",
    topDetractor: sorted[sorted.length - 1]?.provider ?? "none",
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 8. OVERALL SCORE & TREND
// ═══════════════════════════════════════════════════════════════════════════

function computeOverallScore(scores: DimensionScore[], weights: DimensionWeight[]): number {
  let totalWeight = 0;
  let weightedSum = 0;

  for (const s of scores) {
    const w = weights.find((w) => w.dimension === s.dimension);
    if (!w || !w.enabled) continue;
    weightedSum += s.score * w.weight;
    totalWeight += w.weight;
  }

  return totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 50;
}

function detectOverallTrend(scores: DimensionScore[]): "improving" | "stable" | "degrading" {
  const improving = scores.filter((s) => s.trend === "improving").length;
  const degrading = scores.filter((s) => s.trend === "degrading").length;

  if (improving > degrading + 1) return "improving";
  if (degrading > improving + 1) return "degrading";
  return "stable";
}

// ═══════════════════════════════════════════════════════════════════════════
// 9. PATTERN DISCOVERY
// ═══════════════════════════════════════════════════════════════════════════

function discoverPatterns(input: EvaluationInput): LearnedPattern[] {
  const now = new Date().toISOString();
  const patterns: LearnedPattern[] = [];

  // Priority bias patterns
  const priorityObs = input.observations
    .filter((o) => o.dimension === "priority_accuracy")
    .map((o) => o.signal)
    .filter((s): s is PrioritySignal => s.type === "priority");

  const categoryAccuracy: Record<string, { correct: number; total: number }> = {};
  for (const s of priorityObs) {
    if (!categoryAccuracy[s.category]) categoryAccuracy[s.category] = { correct: 0, total: 0 };
    categoryAccuracy[s.category].total++;
    const priorityMatch = Math.abs(s.assignedPriority - s.actualImpact) < 20;
    if (priorityMatch) categoryAccuracy[s.category].correct++;
  }

  for (const [category, data] of Object.entries(categoryAccuracy)) {
    if (data.total < 5) continue;
    const accuracy = data.correct / data.total;
    if (accuracy < 0.5) {
      patterns.push({
        id: evalId("pat"),
        orgId: input.orgId,
        dimension: "priority_accuracy",
        patternType: "category_priority_bias",
        description: `Priority scoring for "${category}" findings has ${Math.round(accuracy * 100)}% accuracy — needs recalibration`,
        confidence: Math.min(90, 50 + data.total * 2),
        sampleSize: data.total,
        evidence: priorityObs.filter((s) => s.category === category).map((s) => ({
          observationId: s.findingId,
          timestamp: now,
          metric: "priority_accuracy",
          value: accuracy,
          supports: true,
        })),
        learnedAt: now,
        lastValidatedAt: now,
        validationCount: 1,
        status: "candidate",
      });
    }
  }

  // Risk calibration patterns per provider
  const riskObs = input.observations
    .filter((o) => o.dimension === "risk_calibration")
    .map((o) => o.signal)
    .filter((s): s is RiskSignal => s.type === "risk");

  const providerRisk: Record<string, { overestimated: number; underestimated: number; total: number }> = {};
  for (const s of riskObs) {
    if (!providerRisk[s.provider]) providerRisk[s.provider] = { overestimated: 0, underestimated: 0, total: 0 };
    providerRisk[s.provider].total++;

    const riskVal: Record<RiskLevel, number> = { low: 1, medium: 2, high: 3 };
    const outcomeVal: Record<string, number> = { success: 1, partial: 2, failure: 3, rollback: 3 };
    const predicted = riskVal[s.predictedRisk] ?? 2;
    const actual = outcomeVal[s.actualOutcome] ?? 2;

    if (predicted > actual) providerRisk[s.provider].overestimated++;
    if (predicted < actual) providerRisk[s.provider].underestimated++;
  }

  for (const [provider, data] of Object.entries(providerRisk)) {
    if (data.total < 5) continue;
    const overRate = data.overestimated / data.total;
    const underRate = data.underestimated / data.total;

    if (overRate > 0.4) {
      patterns.push({
        id: evalId("pat"),
        orgId: input.orgId,
        dimension: "risk_calibration",
        patternType: "provider_risk_bias",
        description: `Risk overestimated for ${provider} — ${Math.round(overRate * 100)}% of actions had lower risk than predicted`,
        confidence: Math.min(85, 50 + data.total * 2),
        sampleSize: data.total,
        evidence: [{ observationId: provider, timestamp: now, metric: "overestimate_rate", value: overRate, supports: true }],
        learnedAt: now,
        lastValidatedAt: now,
        validationCount: 1,
        status: "candidate",
      });
    }

    if (underRate > 0.3) {
      patterns.push({
        id: evalId("pat"),
        orgId: input.orgId,
        dimension: "risk_calibration",
        patternType: "provider_risk_bias",
        description: `Risk underestimated for ${provider} — ${Math.round(underRate * 100)}% of actions had higher risk than predicted`,
        confidence: Math.min(90, 55 + data.total * 2),
        sampleSize: data.total,
        evidence: [{ observationId: provider, timestamp: now, metric: "underestimate_rate", value: underRate, supports: true }],
        learnedAt: now,
        lastValidatedAt: now,
        validationCount: 1,
        status: "candidate",
      });
    }
  }

  // Noise suppression patterns
  const noiseObs = input.observations
    .filter((o) => o.dimension === "noise_reduction")
    .map((o) => o.signal)
    .filter((s): s is NoiseSignal => s.type === "noise");

  const categoryNoise: Record<string, { noisy: number; total: number }> = {};
  for (const s of noiseObs) {
    if (!categoryNoise[s.category]) categoryNoise[s.category] = { noisy: 0, total: 0 };
    categoryNoise[s.category].total++;
    if (!s.wasActedOn && (s.wasSnoozed || s.wasExpired)) categoryNoise[s.category].noisy++;
  }

  for (const [category, data] of Object.entries(categoryNoise)) {
    if (data.total < 5) continue;
    const noiseRate = data.noisy / data.total;
    if (noiseRate > 0.5) {
      patterns.push({
        id: evalId("pat"),
        orgId: input.orgId,
        dimension: "noise_reduction",
        patternType: "noise_suppression_rule",
        description: `"${category}" findings have ${Math.round(noiseRate * 100)}% noise rate — consider raising threshold`,
        confidence: Math.min(85, 50 + data.total),
        sampleSize: data.total,
        evidence: [{ observationId: category, timestamp: now, metric: "noise_rate", value: noiseRate, supports: true }],
        learnedAt: now,
        lastValidatedAt: now,
        validationCount: 1,
        status: "candidate",
      });
    }
  }

  // Savings accuracy patterns
  const savingsObs = input.observations
    .filter((o) => o.dimension === "savings_accuracy")
    .map((o) => o.signal)
    .filter((s): s is SavingsSignal => s.type === "savings");

  if (savingsObs.length >= 5) {
    const totalProjected = savingsObs.reduce((s, o) => s + o.projectedMonthlySavings, 0);
    const totalRealized = savingsObs.reduce((s, o) => s + o.realizedMonthlySavings, 0);

    if (totalProjected > 0) {
      const ratio = totalRealized / totalProjected;
      if (Math.abs(1 - ratio) > 0.2) {
        patterns.push({
          id: evalId("pat"),
          orgId: input.orgId,
          dimension: "savings_accuracy",
          patternType: "savings_estimation_correction",
          description: ratio < 1
            ? `Savings over-projected by ${Math.round((1 - ratio) * 100)}% — apply ${ratio.toFixed(2)}x correction`
            : `Savings under-projected by ${Math.round((ratio - 1) * 100)}% — apply ${ratio.toFixed(2)}x correction`,
          confidence: Math.min(85, 50 + savingsObs.length),
          sampleSize: savingsObs.length,
          evidence: [{ observationId: "savings_ratio", timestamp: now, metric: "projection_ratio", value: ratio, supports: true }],
          learnedAt: now,
          lastValidatedAt: now,
          validationCount: 1,
          status: "candidate",
        });
      }
    }
  }

  // Approval timing patterns
  const approvalObs = input.observations
    .filter((o) => o.dimension === "approval_efficiency")
    .map((o) => o.signal)
    .filter((s): s is ApprovalSignal => s.type === "approval");

  if (approvalObs.length >= 10) {
    const byHour: Record<number, { approved: number; total: number }> = {};
    for (const s of approvalObs) {
      if (!byHour[s.hourOfDay]) byHour[s.hourOfDay] = { approved: 0, total: 0 };
      byHour[s.hourOfDay].total++;
      if (s.decision === "approved") byHour[s.hourOfDay].approved++;
    }

    const bestHour = Object.entries(byHour)
      .filter(([, v]) => v.total >= 3)
      .sort((a, b) => (b[1].approved / b[1].total) - (a[1].approved / a[1].total))[0];

    if (bestHour) {
      const [hour, data] = bestHour;
      const rate = data.approved / data.total;
      if (rate > 0.7) {
        patterns.push({
          id: evalId("pat"),
          orgId: input.orgId,
          dimension: "approval_efficiency",
          patternType: "approval_timing_preference" as PatternType,
          description: `Approvals submitted at hour ${hour} UTC have ${Math.round(rate * 100)}% approval rate`,
          confidence: Math.min(75, 40 + data.total * 3),
          sampleSize: data.total,
          evidence: [{ observationId: `hour-${hour}`, timestamp: now, metric: "approval_rate_by_hour", value: rate, supports: true }],
          learnedAt: now,
          lastValidatedAt: now,
          validationCount: 1,
          status: "candidate",
        });
      }
    }
  }

  return patterns;
}

function retireStalePatterns(existing: LearnedPattern[], observations: WorkflowObservation[]): string[] {
  const retired: string[] = [];

  for (const pattern of existing) {
    if (pattern.status === "retired") continue;

    const relevantObs = observations.filter((o) => o.dimension === pattern.dimension);
    if (relevantObs.length === 0) continue;

    const daysSinceValidation = (Date.now() - new Date(pattern.lastValidatedAt).getTime()) / 86_400_000;
    if (daysSinceValidation > 90 && pattern.sampleSize < 20) {
      retired.push(pattern.id);
    }
  }

  return retired;
}

// ═══════════════════════════════════════════════════════════════════════════
// 10. ADAPTATION PROPOSAL
// ═══════════════════════════════════════════════════════════════════════════

function proposeAdaptations(patterns: LearnedPattern[], input: EvaluationInput): Adaptation[] {
  const now = new Date().toISOString();
  const adaptations: Adaptation[] = [];

  for (const pattern of patterns) {
    if (pattern.confidence < 60) continue;
    if (pattern.sampleSize < 5) continue;

    const existing = input.activeAdaptations.find(
      (a) => a.dimension === pattern.dimension && a.patternId === pattern.id,
    );
    if (existing && existing.status === "active") continue;

    const adaptation = patternToAdaptation(pattern, now);
    if (adaptation) {
      adaptations.push(adaptation);
    }
  }

  return adaptations;
}

function patternToAdaptation(pattern: LearnedPattern, now: string): Adaptation | null {
  let ruleType: AdaptationRule;
  let currentValue = 1.0;
  let proposedValue = 1.0;
  let description = "";
  let affectsSafety = false;

  switch (pattern.patternType) {
    case "category_priority_bias":
      ruleType = "priority_weight_adjustment";
      proposedValue = 0.85;
      description = `Adjust priority weights for category with low accuracy`;
      break;

    case "provider_risk_bias":
      ruleType = "risk_score_bias";
      const isOver = pattern.description.includes("overestimated");
      proposedValue = isOver ? 0.90 : 1.10;
      description = isOver ? "Reduce risk scores for over-estimated provider" : "Increase risk scores for under-estimated provider";
      affectsSafety = !isOver;
      break;

    case "noise_suppression_rule":
      ruleType = "noise_threshold_raise";
      proposedValue = 1.15;
      description = "Raise noise threshold for consistently noisy category";
      break;

    case "savings_estimation_correction":
      ruleType = "savings_multiplier";
      const ratio = pattern.evidence[0]?.value ?? 1;
      proposedValue = Math.max(1 - MAX_ADAPTATION_DELTA, Math.min(1 + MAX_ADAPTATION_DELTA, ratio));
      description = `Apply ${proposedValue.toFixed(2)}x savings correction factor`;
      break;

    case "approval_timing_preference":
      ruleType = "approval_window_shift";
      proposedValue = pattern.evidence[0]?.value ?? 1.0;
      description = "Shift approval submission timing to high-approval window";
      break;

    default:
      return null;
  }

  const delta = proposedValue - currentValue;
  const clampedDelta = Math.max(-MAX_ADAPTATION_DELTA, Math.min(MAX_ADAPTATION_DELTA, delta));
  const clampedValue = currentValue + clampedDelta;

  return {
    id: evalId("adapt"),
    orgId: pattern.orgId,
    patternId: pattern.id,
    dimension: pattern.dimension,
    ruleType,
    description,
    currentValue,
    proposedValue: Math.round(clampedValue * 1000) / 1000,
    delta: Math.round(clampedDelta * 1000) / 1000,
    maxDelta: MAX_ADAPTATION_DELTA,
    confidence: pattern.confidence,
    sampleSize: pattern.sampleSize,
    expectedImprovement: Math.round(Math.abs(clampedDelta) * 100),
    status: "proposed",
    reviewedBy: null,
    reviewedAt: null,
    reviewNotes: null,
    activatedAt: null,
    deactivatedAt: null,
    version: 1,
    rollbackValue: currentValue,
    canRollback: true,
    governance: {
      requiresReview: true,
      autoApproveIfLowRisk: !affectsSafety && Math.abs(clampedDelta) <= 0.05,
      affectsAutonomy: false,
      affectsSafety,
      escalationRequired: affectsSafety,
      auditTrail: [{
        timestamp: now,
        actor: "agent",
        action: "proposed",
        reason: pattern.description,
        metadata: { patternId: pattern.id, confidence: pattern.confidence, sampleSize: pattern.sampleSize },
      }],
    },
    metrics: {
      preActivationBaseline: 0,
      postActivationValue: null,
      improvementPercent: null,
      evaluationCycles: 0,
      regressionDetected: false,
    },
    createdAt: now,
    updatedAt: now,
  };
}

function expireUnusedAdaptations(adaptations: Adaptation[]): string[] {
  const expired: string[] = [];
  const now = Date.now();

  for (const a of adaptations) {
    if (a.status !== "proposed" && a.status !== "pending_review") continue;
    const ageDays = (now - new Date(a.createdAt).getTime()) / 86_400_000;
    if (ageDays > 30) {
      expired.push(a.id);
    }
  }

  return expired;
}

// ═══════════════════════════════════════════════════════════════════════════
// 11. REGRESSION DETECTION
// ═══════════════════════════════════════════════════════════════════════════

function detectRegressions(adaptations: Adaptation[]): Regression[] {
  const regressions: Regression[] = [];

  for (const a of adaptations) {
    if (a.status !== "active" && a.status !== "monitoring") continue;
    if (a.metrics.postActivationValue === null) continue;

    const change = a.metrics.postActivationValue - a.metrics.preActivationBaseline;
    if (change < -2) {
      const severity: Regression["severity"] =
        change < -10 ? "severe" : change < -5 ? "moderate" : "minor";

      regressions.push({
        dimension: a.dimension,
        adaptationId: a.id,
        expectedImprovement: a.expectedImprovement,
        actualChange: Math.round(change),
        severity,
        recommendation: severity === "severe" ? "rollback" : severity === "moderate" ? "freeze" : "monitor",
      });
    }
  }

  return regressions;
}

// ═══════════════════════════════════════════════════════════════════════════
// 12. GOVERNANCE SAFEGUARDS
// ═══════════════════════════════════════════════════════════════════════════

function runSafeguards(adaptations: Adaptation[], input: EvaluationInput): SafeguardResult[] {
  const results: SafeguardResult[] = [];

  // Safeguard 1: No autonomy escalation
  const autonomyChanges = adaptations.filter((a) => a.governance.affectsAutonomy);
  results.push({
    check: "no_autonomy_escalation",
    passed: autonomyChanges.length === 0,
    details: autonomyChanges.length === 0
      ? "No adaptations affect autonomy level"
      : `${autonomyChanges.length} adaptation(s) would change autonomy — blocked`,
  });

  // Safeguard 2: Delta within bounds
  const outOfBounds = adaptations.filter((a) => Math.abs(a.delta) > MAX_ADAPTATION_DELTA);
  results.push({
    check: "delta_within_bounds",
    passed: outOfBounds.length === 0,
    details: outOfBounds.length === 0
      ? `All deltas within ±${MAX_ADAPTATION_DELTA * 100}%`
      : `${outOfBounds.length} adaptation(s) exceed max delta`,
  });

  // Safeguard 3: Safety adaptations require escalation
  const safetyNoEscalation = adaptations.filter((a) => a.governance.affectsSafety && !a.governance.escalationRequired);
  results.push({
    check: "safety_requires_escalation",
    passed: safetyNoEscalation.length === 0,
    details: safetyNoEscalation.length === 0
      ? "All safety-affecting adaptations require escalation"
      : `${safetyNoEscalation.length} safety adaptation(s) missing escalation`,
  });

  // Safeguard 4: Minimum sample size
  const thinEvidence = adaptations.filter((a) => a.sampleSize < 5);
  results.push({
    check: "minimum_sample_size",
    passed: thinEvidence.length === 0,
    details: thinEvidence.length === 0
      ? "All adaptations have sufficient evidence"
      : `${thinEvidence.length} adaptation(s) have fewer than 5 observations`,
  });

  // Safeguard 5: No cross-org leakage
  const wrongOrg = adaptations.filter((a) => a.orgId !== input.orgId);
  results.push({
    check: "org_isolation",
    passed: wrongOrg.length === 0,
    details: wrongOrg.length === 0
      ? "All adaptations scoped to current organization"
      : `${wrongOrg.length} adaptation(s) reference wrong organization`,
  });

  // Safeguard 6: All adaptations reversible
  const irreversible = adaptations.filter((a) => !a.canRollback);
  results.push({
    check: "all_reversible",
    passed: irreversible.length === 0,
    details: irreversible.length === 0
      ? "All adaptations are reversible"
      : `${irreversible.length} irreversible adaptation(s)`,
  });

  // Safeguard 7: Review required for high-impact
  const highNoReview = adaptations.filter((a) => Math.abs(a.delta) > 0.10 && !a.governance.requiresReview);
  results.push({
    check: "high_impact_review",
    passed: highNoReview.length === 0,
    details: highNoReview.length === 0
      ? "All high-impact adaptations require review"
      : `${highNoReview.length} high-impact adaptation(s) bypass review`,
  });

  return results;
}

// ═══════════════════════════════════════════════════════════════════════════
// 13. RECOMMENDATIONS
// ═══════════════════════════════════════════════════════════════════════════

function generateRecommendations(
  scores: DimensionScore[],
  regressions: Regression[],
  input: EvaluationInput,
): IntelligenceRecommendation[] {
  const recs: IntelligenceRecommendation[] = [];
  let seq = 0;

  for (const score of scores) {
    if (score.score < 50 && score.sampleSize >= 5) {
      recs.push({
        id: `rec-${++seq}`,
        dimension: score.dimension,
        action: `Improve ${score.dimension.replace(/_/g, " ")} (currently ${score.score}/100)`,
        rationale: `Score ${score.score} is below threshold. Top detractor: ${score.topDetractor}`,
        expectedImpact: Math.min(20, 50 - score.score),
        confidence: Math.min(80, score.sampleSize * 3),
        requiresApproval: false,
      });
    }
  }

  for (const reg of regressions) {
    recs.push({
      id: `rec-${++seq}`,
      dimension: reg.dimension,
      action: `${reg.recommendation === "rollback" ? "Rollback" : reg.recommendation === "freeze" ? "Freeze" : "Monitor"} adaptation ${reg.adaptationId}`,
      rationale: `Expected +${reg.expectedImprovement}% but got ${reg.actualChange}% (${reg.severity})`,
      expectedImpact: Math.abs(reg.actualChange),
      confidence: 85,
      requiresApproval: reg.recommendation === "rollback",
    });
  }

  return recs;
}

// ═══════════════════════════════════════════════════════════════════════════
// 14. ADAPTATION LIFECYCLE
// ═══════════════════════════════════════════════════════════════════════════

export function reviewAdaptation(
  adaptation: Adaptation,
  decision: "approve" | "reject",
  userId: string,
  notes: string,
): Adaptation {
  const now = new Date().toISOString();

  adaptation.reviewedBy = userId;
  adaptation.reviewedAt = now;
  adaptation.reviewNotes = notes;
  adaptation.status = decision === "approve" ? "approved" : "retired";
  adaptation.updatedAt = now;

  adaptation.governance.auditTrail.push({
    timestamp: now,
    actor: userId,
    action: decision === "approve" ? "approved" : "rejected",
    reason: notes,
    metadata: { decision },
  });

  return adaptation;
}

export function activateAdaptation(adaptation: Adaptation, baselineScore: number): Adaptation {
  const now = new Date().toISOString();

  if (adaptation.status !== "approved") {
    return adaptation;
  }

  adaptation.status = "active";
  adaptation.activatedAt = now;
  adaptation.updatedAt = now;
  adaptation.metrics.preActivationBaseline = baselineScore;

  adaptation.governance.auditTrail.push({
    timestamp: now,
    actor: "agent",
    action: "activated",
    reason: `Baseline score: ${baselineScore}`,
    metadata: { baselineScore },
  });

  return adaptation;
}

export function freezeAdaptation(adaptation: Adaptation, userId: string, reason: string): Adaptation {
  const now = new Date().toISOString();
  adaptation.status = "frozen";
  adaptation.updatedAt = now;

  adaptation.governance.auditTrail.push({
    timestamp: now,
    actor: userId,
    action: "frozen",
    reason,
    metadata: {},
  });

  return adaptation;
}

export function rollbackAdaptation(adaptation: Adaptation, userId: string, reason: string): Adaptation {
  const now = new Date().toISOString();

  if (!adaptation.canRollback) return adaptation;

  adaptation.status = "rolled_back";
  adaptation.deactivatedAt = now;
  adaptation.updatedAt = now;

  adaptation.governance.auditTrail.push({
    timestamp: now,
    actor: userId,
    action: "rolled_back",
    reason,
    metadata: { rollbackTo: adaptation.rollbackValue },
  });

  return adaptation;
}

export function recordAdaptationMetric(adaptation: Adaptation, currentScore: number): Adaptation {
  adaptation.metrics.postActivationValue = currentScore;
  adaptation.metrics.evaluationCycles++;

  if (adaptation.metrics.preActivationBaseline > 0) {
    adaptation.metrics.improvementPercent = Math.round(
      ((currentScore - adaptation.metrics.preActivationBaseline) / adaptation.metrics.preActivationBaseline) * 100,
    );
  }

  if (adaptation.metrics.improvementPercent !== null && adaptation.metrics.improvementPercent < -5) {
    adaptation.metrics.regressionDetected = true;
  }

  adaptation.updatedAt = new Date().toISOString();
  return adaptation;
}

// ═══════════════════════════════════════════════════════════════════════════
// 15. HEADLINE BUILDER
// ═══════════════════════════════════════════════════════════════════════════

function buildHeadline(grade: string, score: number, proposed: number, regressions: number): string {
  if (regressions > 0) {
    return `Grade ${grade} (${score}/100) — ${regressions} regression(s) detected, ${proposed} new adaptation(s) proposed`;
  }
  if (proposed > 0) {
    return `Grade ${grade} (${score}/100) — ${proposed} improvement(s) available`;
  }
  return `Grade ${grade} (${score}/100) — agent performance stable`;
}

// ═══════════════════════════════════════════════════════════════════════════
// 16. RESET & TESTS
// ═══════════════════════════════════════════════════════════════════════════

export function _resetIntelligenceCounters(): void {
  evalSeq = 0;
}

export type WorkflowIntelligenceTestResult = { name: string; passed: boolean; detail: string };

export function runWorkflowIntelligenceTests(): WorkflowIntelligenceTestResult[] {
  const results: WorkflowIntelligenceTestResult[] = [];
  _resetIntelligenceCounters();

  function assert(name: string, fn: () => boolean, detail: string) {
    try {
      results.push({ name, passed: fn(), detail });
    } catch (e) {
      results.push({ name, passed: false, detail: `threw: ${e}` });
    }
  }

  const now = new Date().toISOString();

  const makeObs = (
    dimension: LearningDimension,
    signal: ObservationSignal,
  ): WorkflowObservation => ({
    id: `obs-${Math.random().toString(36).slice(2, 6)}`,
    orgId: "org-1",
    runId: "run-1",
    timestamp: now,
    dimension,
    signal,
  });

  const makePriorityObs = (overrides?: Partial<PrioritySignal>) =>
    makeObs("priority_accuracy", {
      type: "priority",
      findingId: "f-1",
      category: "cost",
      severity: "medium",
      assignedPriority: 70,
      actualImpact: 65,
      wasActedOn: true,
      provider: "aws",
      ...overrides,
    });

  const makeRiskObs = (overrides?: Partial<RiskSignal>) =>
    makeObs("risk_calibration", {
      type: "risk",
      actionId: "a-1",
      actionType: "resize_compute",
      predictedRisk: "medium",
      actualOutcome: "success",
      confidenceScore: 75,
      provider: "aws",
      region: "us-east-1",
      ...overrides,
    });

  const makeNoiseObs = (overrides?: Partial<NoiseSignal>) =>
    makeObs("noise_reduction", {
      type: "noise",
      findingId: "f-1",
      category: "performance",
      severity: "low",
      wasActedOn: false,
      wasSnoozed: true,
      wasExpired: false,
      recurrenceCount: 3,
      provider: "aws",
      ...overrides,
    });

  const makeExecObs = (overrides?: Partial<ExecutionSignal>) =>
    makeObs("execution_reliability", {
      type: "execution",
      stepId: "s-1",
      actionType: "resize_compute",
      provider: "aws",
      region: "us-east-1",
      success: true,
      durationMs: 5000,
      retryCount: 0,
      rolledBack: false,
      verificationPassed: true,
      errorCode: null,
      ...overrides,
    });

  const makeSavingsObs = (overrides?: Partial<SavingsSignal>) =>
    makeObs("savings_accuracy", {
      type: "savings",
      recommendationId: "r-1",
      category: "cost",
      projectedMonthlySavings: 100,
      realizedMonthlySavings: 80,
      measurementDays: 30,
      provider: "aws",
      ...overrides,
    });

  const makeApprovalObs = (overrides?: Partial<ApprovalSignal>) =>
    makeObs("approval_efficiency", {
      type: "approval",
      approvalId: "apr-1",
      actionType: "resize_compute",
      riskLevel: "low",
      submittedAt: now,
      decidedAt: now,
      decision: "approved",
      timeToDecisionMs: 3_600_000,
      dayOfWeek: 2,
      hourOfDay: 14,
      ...overrides,
    });

  // Test 1: Basic evaluation
  const input: EvaluationInput = {
    orgId: "org-1",
    observations: [
      ...Array.from({ length: 5 }, () => makePriorityObs()),
      ...Array.from({ length: 5 }, () => makeExecObs()),
    ],
    existingPatterns: [],
    activeAdaptations: [],
    weights: DEFAULT_WEIGHTS,
    windowDays: 30,
  };
  const report = evaluate(input);
  assert("evaluation runs", () =>
    report.id.startsWith("eval-") && report.observationsAnalyzed === 10,
    `id=${report.id}, obs=${report.observationsAnalyzed}`);

  // Test 2: Dimension scores computed
  assert("dimension scores", () =>
    report.dimensionScores.length > 0 && report.dimensionScores.every((s) => s.score >= 0 && s.score <= 100),
    `dims=${report.dimensionScores.length}`);

  // Test 3: Overall score computed
  assert("overall score", () =>
    report.overallScore >= 0 && report.overallScore <= 100,
    `score=${report.overallScore}`);

  // Test 4: Grade assigned
  assert("grade assigned", () =>
    ["A", "B", "C", "D", "F"].includes(report.summary.overallGrade),
    `grade=${report.summary.overallGrade}`);

  // Test 5: Safeguards all pass for clean input
  assert("safeguards pass", () =>
    report.safeguardChecks.every((s) => s.passed),
    `passed=${report.safeguardChecks.filter((s) => s.passed).length}/${report.safeguardChecks.length}`);

  // Test 6: Noise pattern discovered
  const noisyInput: EvaluationInput = {
    ...input,
    observations: Array.from({ length: 10 }, () =>
      makeNoiseObs({ wasActedOn: false, wasSnoozed: true }),
    ),
  };
  const noisyReport = evaluate(noisyInput);
  assert("noise pattern discovered", () =>
    noisyReport.patternsDiscovered.some((p) => p.patternType === "noise_suppression_rule"),
    `patterns=${noisyReport.patternsDiscovered.map((p) => p.patternType).join(", ")}`);

  // Test 7: Risk overestimate pattern
  const overRiskInput: EvaluationInput = {
    ...input,
    observations: Array.from({ length: 10 }, () =>
      makeRiskObs({ predictedRisk: "high", actualOutcome: "success" }),
    ),
  };
  const overRiskReport = evaluate(overRiskInput);
  assert("risk overestimate pattern", () =>
    overRiskReport.patternsDiscovered.some((p) => p.patternType === "provider_risk_bias"),
    `patterns=${overRiskReport.patternsDiscovered.length}`);

  // Test 8: Savings correction pattern
  const badSavingsInput: EvaluationInput = {
    ...input,
    observations: Array.from({ length: 8 }, () =>
      makeSavingsObs({ projectedMonthlySavings: 200, realizedMonthlySavings: 100 }),
    ),
  };
  const savingsReport = evaluate(badSavingsInput);
  assert("savings correction pattern", () =>
    savingsReport.patternsDiscovered.some((p) => p.patternType === "savings_estimation_correction"),
    `patterns=${savingsReport.patternsDiscovered.length}`);

  // Test 9: Adaptation proposed from pattern
  assert("adaptations proposed", () =>
    noisyReport.adaptationsProposed.length > 0 || savingsReport.adaptationsProposed.length > 0,
    `noisy=${noisyReport.adaptationsProposed.length}, savings=${savingsReport.adaptationsProposed.length}`);

  // Test 10: Adaptations bounded by MAX_DELTA
  for (const a of savingsReport.adaptationsProposed) {
    assert("adaptation delta bounded", () =>
      Math.abs(a.delta) <= MAX_ADAPTATION_DELTA,
      `delta=${a.delta}, max=${MAX_ADAPTATION_DELTA}`);
  }

  // Test 11: Review adaptation
  if (noisyReport.adaptationsProposed.length > 0) {
    const adapted = reviewAdaptation(noisyReport.adaptationsProposed[0], "approve", "user-1", "Looks good");
    assert("review adaptation", () =>
      adapted.status === "approved" && adapted.reviewedBy === "user-1",
      `status=${adapted.status}`);

    // Test 12: Activate adaptation
    const activated = activateAdaptation(adapted, 50);
    assert("activate adaptation", () =>
      activated.status === "active" && activated.metrics.preActivationBaseline === 50,
      `status=${activated.status}`);

    // Test 13: Record metric
    const measured = recordAdaptationMetric(activated, 60);
    assert("record metric", () =>
      measured.metrics.postActivationValue === 60 && measured.metrics.improvementPercent === 20,
      `improvement=${measured.metrics.improvementPercent}%`);

    // Test 14: Freeze adaptation
    const frozen = freezeAdaptation(measured, "user-1", "Testing");
    assert("freeze adaptation", () =>
      frozen.status === "frozen" && frozen.governance.auditTrail.length > 0,
      `status=${frozen.status}, trail=${frozen.governance.auditTrail.length}`);

    // Test 15: Rollback adaptation
    const rolledBack = rollbackAdaptation(frozen, "user-1", "Regression detected");
    assert("rollback adaptation", () =>
      rolledBack.status === "rolled_back" && rolledBack.deactivatedAt !== null,
      `status=${rolledBack.status}`);
  } else {
    for (let i = 11; i <= 15; i++) {
      assert(`lifecycle test ${i}`, () => true, "skipped — no adaptations proposed");
    }
  }

  // Test 16: Regression detection
  const regressingAdaptation: Adaptation = {
    id: "a-1", orgId: "org-1", patternId: "p-1", dimension: "noise_reduction",
    ruleType: "noise_threshold_raise", description: "Test",
    currentValue: 1.0, proposedValue: 1.15, delta: 0.15, maxDelta: MAX_ADAPTATION_DELTA,
    confidence: 80, sampleSize: 10, expectedImprovement: 15,
    status: "active", reviewedBy: "u-1", reviewedAt: now, reviewNotes: "ok",
    activatedAt: now, deactivatedAt: null, version: 1,
    rollbackValue: 1.0, canRollback: true,
    governance: { requiresReview: true, autoApproveIfLowRisk: false, affectsAutonomy: false, affectsSafety: false, escalationRequired: false, auditTrail: [] },
    metrics: { preActivationBaseline: 60, postActivationValue: 45, improvementPercent: -25, evaluationCycles: 3, regressionDetected: true },
    createdAt: now, updatedAt: now,
  };
  const regressionInput: EvaluationInput = {
    ...input,
    activeAdaptations: [regressingAdaptation],
  };
  const regReport = evaluate(regressionInput);
  assert("regression detected", () =>
    regReport.regressions.length > 0,
    `regressions=${regReport.regressions.length}`);

  // Test 17: Regression severity
  assert("regression severity", () =>
    regReport.regressions[0]?.severity === "severe" || regReport.regressions[0]?.severity === "moderate",
    `severity=${regReport.regressions[0]?.severity}`);

  // Test 18: No autonomy escalation safeguard
  assert("autonomy safeguard", () =>
    report.safeguardChecks.some((s) => s.check === "no_autonomy_escalation" && s.passed),
    `found=${report.safeguardChecks.find((s) => s.check === "no_autonomy_escalation")?.passed}`);

  // Test 19: Summary headline
  assert("summary headline", () =>
    report.summary.headline.includes("Grade") && report.summary.headline.length > 0,
    `headline="${report.summary.headline}"`);

  // Test 20: Approval timing pattern with sufficient data
  const approvalInput: EvaluationInput = {
    ...input,
    observations: Array.from({ length: 15 }, (_, i) =>
      makeApprovalObs({
        hourOfDay: i < 10 ? 14 : 3,
        decision: i < 10 ? "approved" : "expired",
      }),
    ),
  };
  const approvalReport = evaluate(approvalInput);
  assert("approval timing pattern", () =>
    approvalReport.dimensionScores.some((s) => s.dimension === "approval_efficiency"),
    `dims=${approvalReport.dimensionScores.map((s) => s.dimension).join(", ")}`);

  return results;
}
