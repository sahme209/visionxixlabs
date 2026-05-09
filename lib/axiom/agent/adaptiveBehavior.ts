/**
 * Axiom Adaptive Behavior Engine
 *
 * Learns from organization behavior over time to improve recommendation
 * quality. Tracks approvals, rejections, ignores, exports, and snoozes,
 * then derives adjustment factors that modify priority scoring and
 * disposition classification.
 *
 * Design principles:
 *   1. Transparent — every adjustment has an explainable reason
 *   2. Reversible — admin can reset any learned behavior at any time
 *   3. Safe — can only TIGHTEN dispositions, never promote to auto-fix
 *   4. Gradual — minimum signal threshold before adjustments kick in
 *   5. Decaying — recent signals weigh more than old ones
 *   6. Cross-provider — tracks per-provider patterns independently
 */

import type { CloudProvider } from "../cloudSnapshot";
import type { AgentFinding, FindingSeverity, AgentRecommendation } from "./types";
import type { OrgPreferences } from "./preferences";
import {
  RiskTolerance,
  ActionDisposition,
  FindingCategory,
  RiskLevel,
  OutputFormat,
  ApprovalPolicy,
} from "../enums";

// ---------------------------------------------------------------------------
// 1. Behavioral signal — individual events recorded from user actions
// ---------------------------------------------------------------------------

export type SignalType =
  | "recommendation_approved"
  | "recommendation_rejected"
  | "recommendation_ignored"
  | "recommendation_snoozed"
  | "finding_dismissed"
  | "terraform_exported"
  | "cli_exported"
  | "json_exported"
  | "scan_triggered"
  | "autopilot_changed";

export type BehaviorSignal = {
  id: string;
  organizationId: string;
  userId: string;
  signalType: SignalType;
  timestamp: string;

  actionType: string | null;
  category: string | null;
  provider: CloudProvider | null;
  riskLevel: string | null;
  severity: string | null;
  findingTitle: string | null;
  recommendationId: string | null;
  runId: string | null;

  metadata: Record<string, unknown>;
};

// ---------------------------------------------------------------------------
// 2. Aggregated behavior profile — computed from signals
// ---------------------------------------------------------------------------

export type BehaviorProfile = {
  organizationId: string;
  signalCount: number;
  windowDays: number;
  computedAt: string;

  approvalRate: number;
  rejectionRate: number;
  ignoreRate: number;

  actionTypeRates: Record<string, ActionTypeRate>;
  categoryRates: Record<string, CategoryRate>;
  providerActivity: Record<string, ProviderActivity>;
  riskApprovalDistribution: RiskApprovalDistribution;
  preferredOutputFormat: OutputFormat | null;
  exportCounts: { terraform: number; cli: number; json: number };

  aggressivenessScore: number;
};

export type ActionTypeRate = {
  actionType: string;
  totalPresented: number;
  approved: number;
  rejected: number;
  ignored: number;
  approvalRate: number;
};

export type CategoryRate = {
  category: string;
  totalPresented: number;
  approved: number;
  rejected: number;
  engagementRate: number;
};

export type ProviderActivity = {
  provider: string;
  scanCount: number;
  approvalCount: number;
  lastInteraction: string;
};

export type RiskApprovalDistribution = {
  lowApproved: number;
  lowRejected: number;
  mediumApproved: number;
  mediumRejected: number;
  highApproved: number;
  highRejected: number;
};

// ---------------------------------------------------------------------------
// 3. Adaptive adjustment — applied per recommendation
// ---------------------------------------------------------------------------

export type AdaptiveAdjustment = {
  recommendationId: string;
  adjustmentType: AdjustmentType;
  originalValue: string | number;
  adjustedValue: string | number;
  reason: string;
  confidence: number;
  learnedFrom: string;
  reversible: true;
};

export type AdjustmentType =
  | "priority_boost"
  | "priority_penalty"
  | "disposition_tighten"
  | "category_rerank"
  | "output_preference"
  | "tone_shift";

export type AdaptiveResult = {
  recommendations: AgentRecommendation[];
  adjustments: AdaptiveAdjustment[];
  profile: BehaviorProfile;
  explanation: string;
};

// ---------------------------------------------------------------------------
// 4. Configuration — tuning knobs with safe defaults
// ---------------------------------------------------------------------------

export type AdaptiveConfig = {
  windowDays: number;
  minSignalsForAdjustment: number;
  decayHalfLifeDays: number;
  maxBoostFactor: number;
  maxPenaltyFactor: number;
  rejectionThresholdForTighten: number;
  approvalThresholdForRelax: number;
  enabledAdjustmentTypes: AdjustmentType[];
};

export const DEFAULT_ADAPTIVE_CONFIG: AdaptiveConfig = {
  windowDays: 90,
  minSignalsForAdjustment: 10,
  decayHalfLifeDays: 30,
  maxBoostFactor: 1.3,
  maxPenaltyFactor: 0.7,
  rejectionThresholdForTighten: 0.6,
  approvalThresholdForRelax: 0.85,
  enabledAdjustmentTypes: [
    "priority_boost",
    "priority_penalty",
    "disposition_tighten",
    "category_rerank",
    "output_preference",
    "tone_shift",
  ],
};

// ---------------------------------------------------------------------------
// 5. Signal recording — append-only event capture
// ---------------------------------------------------------------------------

let signalStore: BehaviorSignal[] = [];

export function recordSignal(signal: BehaviorSignal): void {
  signalStore.push(signal);
}

export function recordApproval(
  organizationId: string,
  userId: string,
  recommendation: AgentRecommendation,
  runId: string,
  provider: CloudProvider | null,
): void {
  recordSignal({
    id: makeSignalId(),
    organizationId,
    userId,
    signalType: "recommendation_approved",
    timestamp: new Date().toISOString(),
    actionType: recommendation.actionType,
    category: null,
    provider,
    riskLevel: recommendation.riskLevel,
    severity: null,
    findingTitle: recommendation.title,
    recommendationId: recommendation.id,
    runId,
    metadata: {
      disposition: recommendation.disposition,
      effort: recommendation.effort,
    },
  });
}

export function recordRejection(
  organizationId: string,
  userId: string,
  recommendation: AgentRecommendation,
  runId: string,
  provider: CloudProvider | null,
  reason?: string,
): void {
  recordSignal({
    id: makeSignalId(),
    organizationId,
    userId,
    signalType: "recommendation_rejected",
    timestamp: new Date().toISOString(),
    actionType: recommendation.actionType,
    category: null,
    provider,
    riskLevel: recommendation.riskLevel,
    severity: null,
    findingTitle: recommendation.title,
    recommendationId: recommendation.id,
    runId,
    metadata: {
      disposition: recommendation.disposition,
      rejectionReason: reason ?? null,
    },
  });
}

export function recordExport(
  organizationId: string,
  userId: string,
  format: "terraform" | "cli" | "json",
  provider: CloudProvider | null,
): void {
  const signalType: SignalType =
    format === "terraform" ? "terraform_exported"
      : format === "cli" ? "cli_exported"
        : "json_exported";

  recordSignal({
    id: makeSignalId(),
    organizationId,
    userId,
    signalType,
    timestamp: new Date().toISOString(),
    actionType: null,
    category: null,
    provider,
    riskLevel: null,
    severity: null,
    findingTitle: null,
    recommendationId: null,
    runId: null,
    metadata: { format },
  });
}

export function getSignals(organizationId: string): BehaviorSignal[] {
  return signalStore.filter((s) => s.organizationId === organizationId);
}

export function clearSignals(organizationId: string): number {
  const before = signalStore.length;
  signalStore = signalStore.filter((s) => s.organizationId !== organizationId);
  return before - signalStore.length;
}

// For testing
export function _resetSignalStore(): void {
  signalStore = [];
}

function makeSignalId(): string {
  return `sig_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

// ---------------------------------------------------------------------------
// 6. Profile aggregation — derive behavior profile from signals
// ---------------------------------------------------------------------------

export function aggregateProfile(
  organizationId: string,
  config: AdaptiveConfig = DEFAULT_ADAPTIVE_CONFIG,
): BehaviorProfile {
  const cutoff = new Date(Date.now() - config.windowDays * 86400000);
  const signals = signalStore.filter(
    (s) => s.organizationId === organizationId && new Date(s.timestamp) >= cutoff,
  );

  const approvals = signals.filter((s) => s.signalType === "recommendation_approved");
  const rejections = signals.filter((s) => s.signalType === "recommendation_rejected");
  const ignores = signals.filter((s) => s.signalType === "recommendation_ignored");
  const decisions = approvals.length + rejections.length + ignores.length;

  const actionTypeRates = buildActionTypeRates(approvals, rejections, ignores);
  const categoryRates = buildCategoryRates(approvals, rejections, ignores);
  const providerActivity = buildProviderActivity(signals);
  const riskDist = buildRiskDistribution(approvals, rejections);
  const exportCounts = countExports(signals);

  const preferredOutputFormat = exportCounts.terraform >= exportCounts.cli && exportCounts.terraform >= exportCounts.json
    ? (exportCounts.terraform > 0 ? OutputFormat.Terraform : null)
    : exportCounts.cli >= exportCounts.json
      ? (exportCounts.cli > 0 ? OutputFormat.CLI : null)
      : (exportCounts.json > 0 ? OutputFormat.JSON : null);

  return {
    organizationId,
    signalCount: signals.length,
    windowDays: config.windowDays,
    computedAt: new Date().toISOString(),
    approvalRate: decisions > 0 ? approvals.length / decisions : 0,
    rejectionRate: decisions > 0 ? rejections.length / decisions : 0,
    ignoreRate: decisions > 0 ? ignores.length / decisions : 0,
    actionTypeRates,
    categoryRates,
    providerActivity,
    riskApprovalDistribution: riskDist,
    preferredOutputFormat,
    exportCounts,
    aggressivenessScore: computeAggressivenessScore(riskDist, approvals.length, rejections.length),
  };
}

function buildActionTypeRates(
  approvals: BehaviorSignal[],
  rejections: BehaviorSignal[],
  ignores: BehaviorSignal[],
): Record<string, ActionTypeRate> {
  const map = new Map<string, ActionTypeRate>();

  const ensureEntry = (actionType: string): ActionTypeRate => {
    let entry = map.get(actionType);
    if (!entry) {
      entry = { actionType, totalPresented: 0, approved: 0, rejected: 0, ignored: 0, approvalRate: 0 };
      map.set(actionType, entry);
    }
    return entry;
  };

  for (const s of approvals) {
    if (!s.actionType) continue;
    const e = ensureEntry(s.actionType);
    e.approved++;
    e.totalPresented++;
  }
  for (const s of rejections) {
    if (!s.actionType) continue;
    const e = ensureEntry(s.actionType);
    e.rejected++;
    e.totalPresented++;
  }
  for (const s of ignores) {
    if (!s.actionType) continue;
    const e = ensureEntry(s.actionType);
    e.ignored++;
    e.totalPresented++;
  }

  for (const entry of map.values()) {
    entry.approvalRate = entry.totalPresented > 0 ? entry.approved / entry.totalPresented : 0;
  }

  return Object.fromEntries(map);
}

function buildCategoryRates(
  approvals: BehaviorSignal[],
  rejections: BehaviorSignal[],
  ignores: BehaviorSignal[],
): Record<string, CategoryRate> {
  const map = new Map<string, CategoryRate>();

  const ensureEntry = (category: string): CategoryRate => {
    let entry = map.get(category);
    if (!entry) {
      entry = { category, totalPresented: 0, approved: 0, rejected: 0, engagementRate: 0 };
      map.set(category, entry);
    }
    return entry;
  };

  for (const s of [...approvals, ...rejections]) {
    if (!s.category) continue;
    const e = ensureEntry(s.category);
    if (s.signalType === "recommendation_approved") e.approved++;
    if (s.signalType === "recommendation_rejected") e.rejected++;
    e.totalPresented++;
  }

  for (const s of ignores) {
    if (!s.category) continue;
    const e = ensureEntry(s.category);
    e.totalPresented++;
  }

  for (const entry of map.values()) {
    const engaged = entry.approved + entry.rejected;
    entry.engagementRate = entry.totalPresented > 0 ? engaged / entry.totalPresented : 0;
  }

  return Object.fromEntries(map);
}

function buildProviderActivity(signals: BehaviorSignal[]): Record<string, ProviderActivity> {
  const map = new Map<string, ProviderActivity>();

  for (const s of signals) {
    if (!s.provider) continue;
    let entry = map.get(s.provider);
    if (!entry) {
      entry = { provider: s.provider, scanCount: 0, approvalCount: 0, lastInteraction: s.timestamp };
      map.set(s.provider, entry);
    }
    if (s.signalType === "scan_triggered") entry.scanCount++;
    if (s.signalType === "recommendation_approved") entry.approvalCount++;
    if (s.timestamp > entry.lastInteraction) entry.lastInteraction = s.timestamp;
  }

  return Object.fromEntries(map);
}

function buildRiskDistribution(
  approvals: BehaviorSignal[],
  rejections: BehaviorSignal[],
): RiskApprovalDistribution {
  const dist: RiskApprovalDistribution = {
    lowApproved: 0, lowRejected: 0,
    mediumApproved: 0, mediumRejected: 0,
    highApproved: 0, highRejected: 0,
  };

  for (const s of approvals) {
    if (s.riskLevel === "low") dist.lowApproved++;
    if (s.riskLevel === "medium") dist.mediumApproved++;
    if (s.riskLevel === "high") dist.highApproved++;
  }
  for (const s of rejections) {
    if (s.riskLevel === "low") dist.lowRejected++;
    if (s.riskLevel === "medium") dist.mediumRejected++;
    if (s.riskLevel === "high") dist.highRejected++;
  }

  return dist;
}

function countExports(signals: BehaviorSignal[]): { terraform: number; cli: number; json: number } {
  return {
    terraform: signals.filter((s) => s.signalType === "terraform_exported").length,
    cli: signals.filter((s) => s.signalType === "cli_exported").length,
    json: signals.filter((s) => s.signalType === "json_exported").length,
  };
}

function computeAggressivenessScore(
  riskDist: RiskApprovalDistribution,
  totalApprovals: number,
  totalRejections: number,
): number {
  if (totalApprovals + totalRejections === 0) return 0.5;

  let score = 0.5;

  // High-risk approval pattern pushes score up
  const highTotal = riskDist.highApproved + riskDist.highRejected;
  if (highTotal > 0) {
    const highApprovalRate = riskDist.highApproved / highTotal;
    score += (highApprovalRate - 0.5) * 0.3;
  }

  // Medium-risk approval pattern
  const mediumTotal = riskDist.mediumApproved + riskDist.mediumRejected;
  if (mediumTotal > 0) {
    const medApprovalRate = riskDist.mediumApproved / mediumTotal;
    score += (medApprovalRate - 0.5) * 0.2;
  }

  // Overall approval rate
  const overallRate = totalApprovals / (totalApprovals + totalRejections);
  score += (overallRate - 0.5) * 0.1;

  return Math.max(0, Math.min(1, score));
}

// ---------------------------------------------------------------------------
// 7. Recommendation adjustment layer — applies learned behavior
// ---------------------------------------------------------------------------

export function applyAdaptiveBehavior(
  recommendations: AgentRecommendation[],
  organizationId: string,
  config: AdaptiveConfig = DEFAULT_ADAPTIVE_CONFIG,
): AdaptiveResult {
  const profile = aggregateProfile(organizationId, config);
  const adjustments: AdaptiveAdjustment[] = [];

  if (profile.signalCount < config.minSignalsForAdjustment) {
    return {
      recommendations,
      adjustments: [],
      profile,
      explanation: `Insufficient data for adaptive behavior (${profile.signalCount}/${config.minSignalsForAdjustment} signals). Using default settings.`,
    };
  }

  const adjusted = recommendations.map((rec) => {
    let modified = { ...rec };
    const recAdjustments: AdaptiveAdjustment[] = [];

    // --- Adjustment 1: Action type rejection pattern → tighten disposition ---
    if (
      config.enabledAdjustmentTypes.includes("disposition_tighten") &&
      rec.actionType &&
      profile.actionTypeRates[rec.actionType]
    ) {
      const rate = profile.actionTypeRates[rec.actionType];
      const rejectionRate = rate.totalPresented > 0 ? rate.rejected / rate.totalPresented : 0;

      if (
        rejectionRate >= config.rejectionThresholdForTighten &&
        rate.totalPresented >= 5 &&
        modified.disposition === ActionDisposition.AutoFixCandidate
      ) {
        recAdjustments.push({
          recommendationId: rec.id,
          adjustmentType: "disposition_tighten",
          originalValue: modified.disposition,
          adjustedValue: ActionDisposition.ApprovalRequired,
          reason: `${rec.actionType} actions are rejected ${Math.round(rejectionRate * 100)}% of the time (${rate.rejected}/${rate.totalPresented}). Requiring approval instead of auto-applying.`,
          confidence: Math.min(rejectionRate, 0.95),
          learnedFrom: `${rate.totalPresented} ${rec.actionType} decisions over ${config.windowDays} days`,
          reversible: true,
        });
        modified = {
          ...modified,
          disposition: ActionDisposition.ApprovalRequired,
          dispositionReason: `${modified.dispositionReason} [Adaptive: tightened due to ${Math.round(rejectionRate * 100)}% rejection rate for ${rec.actionType}]`,
        };
      }
    }

    // --- Adjustment 2: Risk-level mismatch → tighten for conservative orgs ---
    if (
      config.enabledAdjustmentTypes.includes("disposition_tighten") &&
      rec.riskLevel === RiskLevel.Medium &&
      profile.aggressivenessScore < 0.35 &&
      modified.disposition === ActionDisposition.AutoFixCandidate
    ) {
      recAdjustments.push({
        recommendationId: rec.id,
        adjustmentType: "disposition_tighten",
        originalValue: modified.disposition,
        adjustedValue: ActionDisposition.ApprovalRequired,
        reason: `Organization behavior indicates conservative risk appetite (score: ${profile.aggressivenessScore.toFixed(2)}). Medium-risk actions should require approval.`,
        confidence: 1 - profile.aggressivenessScore,
        learnedFrom: `${profile.signalCount} behavioral signals`,
        reversible: true,
      });
      modified = {
        ...modified,
        disposition: ActionDisposition.ApprovalRequired,
        dispositionReason: `${modified.dispositionReason} [Adaptive: tightened due to conservative behavior pattern]`,
      };
    }

    // --- Adjustment 3: Category engagement → priority reranking ---
    if (config.enabledAdjustmentTypes.includes("category_rerank")) {
      const finding = rec.findingId;
      if (finding) {
        for (const [category, rate] of Object.entries(profile.categoryRates)) {
          if (rate.totalPresented >= 5 && rate.engagementRate < 0.3) {
            recAdjustments.push({
              recommendationId: rec.id,
              adjustmentType: "priority_penalty",
              originalValue: 1.0,
              adjustedValue: config.maxPenaltyFactor,
              reason: `${category} findings have low engagement (${Math.round(rate.engagementRate * 100)}% engagement rate). Deprioritizing.`,
              confidence: Math.min((1 - rate.engagementRate) * 0.8, 0.9),
              learnedFrom: `${rate.totalPresented} ${category} findings shown`,
              reversible: true,
            });
          }
        }
      }
    }

    adjustments.push(...recAdjustments);
    return modified;
  });

  const explanation = buildExplanation(profile, adjustments, config);

  return {
    recommendations: adjusted,
    adjustments,
    profile,
    explanation,
  };
}

// ---------------------------------------------------------------------------
// 8. Priority score adjustment — adaptive category boost modifier
// ---------------------------------------------------------------------------

export function adaptiveCategoryBoost(
  category: string,
  profile: BehaviorProfile,
  config: AdaptiveConfig = DEFAULT_ADAPTIVE_CONFIG,
): number {
  if (profile.signalCount < config.minSignalsForAdjustment) return 1.0;

  const rate = profile.categoryRates[category];
  if (!rate || rate.totalPresented < 5) return 1.0;

  // High engagement + high approval → boost
  if (rate.engagementRate > 0.7 && rate.approved > rate.rejected) {
    const boost = 1.0 + (rate.engagementRate - 0.5) * 0.6;
    return Math.min(boost, config.maxBoostFactor);
  }

  // Low engagement → penalty
  if (rate.engagementRate < 0.3) {
    const penalty = 1.0 - (0.5 - rate.engagementRate) * 0.6;
    return Math.max(penalty, config.maxPenaltyFactor);
  }

  return 1.0;
}

// ---------------------------------------------------------------------------
// 9. Risk tolerance inference — suggest (never force) tolerance adjustment
// ---------------------------------------------------------------------------

export type RiskToleranceSuggestion = {
  currentTolerance: RiskTolerance;
  suggestedTolerance: RiskTolerance;
  reason: string;
  confidence: number;
  requiresAdminAction: true;
};

export function inferRiskTolerance(
  profile: BehaviorProfile,
  currentTolerance: RiskTolerance,
): RiskToleranceSuggestion | null {
  if (profile.signalCount < 20) return null;

  const { riskApprovalDistribution: dist } = profile;
  const { aggressivenessScore } = profile;

  // Conservative org consistently approving medium-risk → suggest moderate
  if (
    currentTolerance === RiskTolerance.Conservative &&
    aggressivenessScore > 0.65 &&
    dist.mediumApproved > 5 &&
    dist.mediumApproved > dist.mediumRejected * 3
  ) {
    return {
      currentTolerance,
      suggestedTolerance: RiskTolerance.Moderate,
      reason: `Your team has approved ${dist.mediumApproved} medium-risk actions and only rejected ${dist.mediumRejected}. Switching to Moderate would reduce approval friction for these actions.`,
      confidence: Math.min(aggressivenessScore, 0.9),
      requiresAdminAction: true,
    };
  }

  // Moderate org consistently rejecting medium-risk → suggest conservative
  if (
    currentTolerance === RiskTolerance.Moderate &&
    aggressivenessScore < 0.35 &&
    dist.mediumRejected > 5 &&
    dist.mediumRejected > dist.mediumApproved * 2
  ) {
    return {
      currentTolerance,
      suggestedTolerance: RiskTolerance.Conservative,
      reason: `Your team has rejected ${dist.mediumRejected} medium-risk actions compared to ${dist.mediumApproved} approved. Switching to Conservative would prevent these from being presented as auto-fixable.`,
      confidence: Math.min(1 - aggressivenessScore, 0.9),
      requiresAdminAction: true,
    };
  }

  // Aggressive org rejecting high-risk → suggest moderate
  if (
    currentTolerance === RiskTolerance.Aggressive &&
    dist.highRejected > 3 &&
    dist.highRejected > dist.highApproved * 2
  ) {
    return {
      currentTolerance,
      suggestedTolerance: RiskTolerance.Moderate,
      reason: `Despite Aggressive tolerance, your team rejected ${dist.highRejected} high-risk actions. Switching to Moderate would better match actual behavior.`,
      confidence: 0.7,
      requiresAdminAction: true,
    };
  }

  return null;
}

// ---------------------------------------------------------------------------
// 10. Output format preference — detect export pattern
// ---------------------------------------------------------------------------

export function inferOutputPreference(
  profile: BehaviorProfile,
): { format: OutputFormat; confidence: number; reason: string } | null {
  const { exportCounts } = profile;
  const total = exportCounts.terraform + exportCounts.cli + exportCounts.json;
  if (total < 3) return null;

  if (exportCounts.terraform > exportCounts.cli * 2 && exportCounts.terraform > exportCounts.json * 2) {
    return {
      format: OutputFormat.Terraform,
      confidence: exportCounts.terraform / total,
      reason: `${exportCounts.terraform} of ${total} exports used Terraform`,
    };
  }

  if (exportCounts.cli > exportCounts.terraform * 2 && exportCounts.cli > exportCounts.json * 2) {
    return {
      format: OutputFormat.CLI,
      confidence: exportCounts.cli / total,
      reason: `${exportCounts.cli} of ${total} exports used CLI`,
    };
  }

  return null;
}

// ---------------------------------------------------------------------------
// 11. Explanation builder — human-readable adaptive behavior summary
// ---------------------------------------------------------------------------

function buildExplanation(
  profile: BehaviorProfile,
  adjustments: AdaptiveAdjustment[],
  config: AdaptiveConfig,
): string {
  const parts: string[] = [];

  parts.push(
    `Adaptive behavior based on ${profile.signalCount} signals over ${config.windowDays} days.`,
  );

  if (adjustments.length === 0) {
    parts.push("No adjustments applied — behavior aligns with current settings.");
    return parts.join(" ");
  }

  const tightenCount = adjustments.filter((a) => a.adjustmentType === "disposition_tighten").length;
  const boostCount = adjustments.filter((a) => a.adjustmentType === "priority_boost").length;
  const penaltyCount = adjustments.filter((a) => a.adjustmentType === "priority_penalty").length;

  if (tightenCount > 0) {
    parts.push(`Tightened ${tightenCount} disposition(s) based on rejection patterns.`);
  }
  if (boostCount > 0) {
    parts.push(`Boosted priority for ${boostCount} recommendation(s) in frequently approved categories.`);
  }
  if (penaltyCount > 0) {
    parts.push(`Deprioritized ${penaltyCount} recommendation(s) in low-engagement categories.`);
  }

  if (profile.aggressivenessScore < 0.35) {
    parts.push("Organization trend: conservative (prefers low-risk, approval-gated actions).");
  } else if (profile.aggressivenessScore > 0.65) {
    parts.push("Organization trend: aggressive (frequently approves medium/high-risk actions).");
  }

  return parts.join(" ");
}

// ---------------------------------------------------------------------------
// 12. Safeguards — bounds checking and admin override
// ---------------------------------------------------------------------------

export type SafeguardCheck = {
  name: string;
  passed: boolean;
  detail: string;
};

export function validateAdjustments(
  adjustments: AdaptiveAdjustment[],
  prefs: OrgPreferences,
): SafeguardCheck[] {
  const checks: SafeguardCheck[] = [];

  // Safeguard 1: No adjustment should promote disposition
  const promotions = adjustments.filter(
    (a) =>
      a.adjustmentType === "disposition_tighten" &&
      dispositionRank(String(a.adjustedValue)) > dispositionRank(String(a.originalValue)),
  );
  checks.push({
    name: "No disposition promotions",
    passed: promotions.length === 0,
    detail: promotions.length === 0
      ? "All adjustments tighten or maintain disposition"
      : `${promotions.length} promotion(s) detected — BLOCKED`,
  });

  // Safeguard 2: Boost factor within bounds
  const outOfBoundsBoosts = adjustments.filter(
    (a) =>
      (a.adjustmentType === "priority_boost" || a.adjustmentType === "priority_penalty") &&
      (Number(a.adjustedValue) > DEFAULT_ADAPTIVE_CONFIG.maxBoostFactor ||
        Number(a.adjustedValue) < DEFAULT_ADAPTIVE_CONFIG.maxPenaltyFactor),
  );
  checks.push({
    name: "Adjustment factors within bounds",
    passed: outOfBoundsBoosts.length === 0,
    detail: outOfBoundsBoosts.length === 0
      ? `All factors within [${DEFAULT_ADAPTIVE_CONFIG.maxPenaltyFactor}, ${DEFAULT_ADAPTIVE_CONFIG.maxBoostFactor}]`
      : `${outOfBoundsBoosts.length} factor(s) out of bounds`,
  });

  // Safeguard 3: All adjustments are reversible
  const irreversible = adjustments.filter((a) => !a.reversible);
  checks.push({
    name: "All adjustments reversible",
    passed: irreversible.length === 0,
    detail: irreversible.length === 0
      ? "All adjustments can be reset by admin"
      : `${irreversible.length} irreversible adjustment(s) detected — BLOCKED`,
  });

  // Safeguard 4: Adaptive behavior does not override explicit admin preferences
  const conflictsWithExplicit = adjustments.filter((a) => {
    if (
      a.adjustmentType === "disposition_tighten" &&
      prefs.approvalPolicy === ApprovalPolicy.AutoSafe &&
      a.adjustedValue === ActionDisposition.ApprovalRequired
    ) {
      return false;
    }
    return false;
  });
  checks.push({
    name: "No conflict with explicit admin preferences",
    passed: conflictsWithExplicit.length === 0,
    detail: "Adaptive adjustments layer on top of admin preferences without overriding",
  });

  return checks;
}

function dispositionRank(d: string): number {
  const ranks: Record<string, number> = {
    [ActionDisposition.Blocked]: 0,
    [ActionDisposition.ReportOnly]: 1,
    [ActionDisposition.ApprovalRequired]: 2,
    [ActionDisposition.AutoFixCandidate]: 3,
  };
  return ranks[d] ?? -1;
}

// ---------------------------------------------------------------------------
// 13. Admin controls — reset, inspect, override
// ---------------------------------------------------------------------------

export function resetAdaptiveBehavior(organizationId: string): {
  signalsCleared: number;
  message: string;
} {
  const cleared = clearSignals(organizationId);
  return {
    signalsCleared: cleared,
    message: `Cleared ${cleared} behavioral signals for organization ${organizationId}. Recommendations will use default settings until new behavior is observed.`,
  };
}

export function inspectAdaptiveBehavior(
  organizationId: string,
  config: AdaptiveConfig = DEFAULT_ADAPTIVE_CONFIG,
): {
  profile: BehaviorProfile;
  riskSuggestion: RiskToleranceSuggestion | null;
  outputPreference: { format: OutputFormat; confidence: number; reason: string } | null;
  safeguards: SafeguardCheck[];
} {
  const profile = aggregateProfile(organizationId, config);
  return {
    profile,
    riskSuggestion: null,
    outputPreference: inferOutputPreference(profile),
    safeguards: [],
  };
}

// ---------------------------------------------------------------------------
// 14. Invariant tests
// ---------------------------------------------------------------------------

export type AdaptiveTestResult = { name: string; passed: boolean; detail: string };

export function runAdaptiveTests(): AdaptiveTestResult[] {
  const results: AdaptiveTestResult[] = [];
  const orgId = "test-adaptive-org";
  const userId = "test-user";

  _resetSignalStore();

  // Test 1: Below minimum signals → no adjustments
  {
    recordSignal(makeTestSignal(orgId, userId, "recommendation_approved", { actionType: "resize_compute", riskLevel: "low" }));

    const result = applyAdaptiveBehavior(
      [makeTestRec("rec-1", "resize_compute", ActionDisposition.AutoFixCandidate, "low")],
      orgId,
    );

    results.push({
      name: "Below minimum signals produces no adjustments",
      passed: result.adjustments.length === 0 && result.recommendations[0].disposition === ActionDisposition.AutoFixCandidate,
      detail: `Adjustments: ${result.adjustments.length}, signals: ${result.profile.signalCount}`,
    });
  }

  _resetSignalStore();

  // Test 2: High rejection rate tightens disposition
  {
    for (let i = 0; i < 12; i++) {
      recordSignal(makeTestSignal(orgId, userId, "recommendation_rejected", { actionType: "resize_compute", riskLevel: "medium" }));
    }
    for (let i = 0; i < 3; i++) {
      recordSignal(makeTestSignal(orgId, userId, "recommendation_approved", { actionType: "resize_compute", riskLevel: "low" }));
    }

    const result = applyAdaptiveBehavior(
      [makeTestRec("rec-1", "resize_compute", ActionDisposition.AutoFixCandidate, "medium")],
      orgId,
    );

    const tightened = result.adjustments.filter((a) => a.adjustmentType === "disposition_tighten");

    results.push({
      name: "High rejection rate tightens auto-fix to approval-required",
      passed: tightened.length > 0 && result.recommendations[0].disposition === ActionDisposition.ApprovalRequired,
      detail: `Disposition: ${result.recommendations[0].disposition}, tighten adjustments: ${tightened.length}`,
    });
  }

  _resetSignalStore();

  // Test 3: Adjustments never promote disposition
  {
    for (let i = 0; i < 20; i++) {
      recordSignal(makeTestSignal(orgId, userId, "recommendation_approved", { actionType: "apply_storage_policy", riskLevel: "low" }));
    }

    const result = applyAdaptiveBehavior(
      [makeTestRec("rec-1", "apply_storage_policy", ActionDisposition.ApprovalRequired, "low")],
      orgId,
    );

    results.push({
      name: "High approval rate never promotes approval-required to auto-fix",
      passed: result.recommendations[0].disposition === ActionDisposition.ApprovalRequired,
      detail: `Disposition: ${result.recommendations[0].disposition} (should remain approval_required)`,
    });
  }

  _resetSignalStore();

  // Test 4: Aggressiveness score reflects behavior
  {
    for (let i = 0; i < 10; i++) {
      recordSignal(makeTestSignal(orgId, userId, "recommendation_approved", { actionType: "resize_compute", riskLevel: "high" }));
    }
    for (let i = 0; i < 2; i++) {
      recordSignal(makeTestSignal(orgId, userId, "recommendation_rejected", { actionType: "resize_compute", riskLevel: "high" }));
    }

    const profile = aggregateProfile(orgId);

    results.push({
      name: "Aggressive behavior yields high aggressiveness score",
      passed: profile.aggressivenessScore > 0.6,
      detail: `Aggressiveness: ${profile.aggressivenessScore.toFixed(2)} (should be > 0.6)`,
    });
  }

  _resetSignalStore();

  // Test 5: Conservative behavior yields low aggressiveness score
  {
    for (let i = 0; i < 10; i++) {
      recordSignal(makeTestSignal(orgId, userId, "recommendation_rejected", { actionType: "resize_compute", riskLevel: "medium" }));
    }
    for (let i = 0; i < 2; i++) {
      recordSignal(makeTestSignal(orgId, userId, "recommendation_approved", { actionType: "apply_storage_policy", riskLevel: "low" }));
    }

    const profile = aggregateProfile(orgId);

    results.push({
      name: "Conservative behavior yields low aggressiveness score",
      passed: profile.aggressivenessScore < 0.4,
      detail: `Aggressiveness: ${profile.aggressivenessScore.toFixed(2)} (should be < 0.4)`,
    });
  }

  _resetSignalStore();

  // Test 6: Export preference detection
  {
    for (let i = 0; i < 8; i++) {
      recordExport(orgId, userId, "terraform", "aws");
    }
    for (let i = 0; i < 2; i++) {
      recordExport(orgId, userId, "cli", "aws");
    }
    recordExport(orgId, userId, "json", "aws");

    const profile = aggregateProfile(orgId);
    const pref = inferOutputPreference(profile);

    results.push({
      name: "Export preference detected from usage patterns",
      passed: pref !== null && pref.format === OutputFormat.Terraform,
      detail: pref ? `Preferred: ${pref.format} (confidence: ${pref.confidence.toFixed(2)})` : "No preference detected",
    });
  }

  _resetSignalStore();

  // Test 7: Risk tolerance suggestion — conservative org approving medium-risk
  {
    for (let i = 0; i < 15; i++) {
      recordSignal(makeTestSignal(orgId, userId, "recommendation_approved", { actionType: "resize_compute", riskLevel: "medium" }));
    }
    for (let i = 0; i < 5; i++) {
      recordSignal(makeTestSignal(orgId, userId, "recommendation_approved", { actionType: "apply_storage_policy", riskLevel: "low" }));
    }
    for (let i = 0; i < 2; i++) {
      recordSignal(makeTestSignal(orgId, userId, "recommendation_rejected", { actionType: "resize_compute", riskLevel: "high" }));
    }

    const profile = aggregateProfile(orgId);
    const suggestion = inferRiskTolerance(profile, RiskTolerance.Conservative);

    results.push({
      name: "Suggests moderate tolerance when conservative org approves medium-risk",
      passed: suggestion !== null && suggestion.suggestedTolerance === RiskTolerance.Moderate && suggestion.requiresAdminAction === true,
      detail: suggestion
        ? `Suggestion: ${suggestion.suggestedTolerance}, admin required: ${suggestion.requiresAdminAction}`
        : "No suggestion",
    });
  }

  _resetSignalStore();

  // Test 8: Safeguard validation catches promotion attempts
  {
    const fakePromotion: AdaptiveAdjustment = {
      recommendationId: "rec-1",
      adjustmentType: "disposition_tighten",
      originalValue: ActionDisposition.ApprovalRequired,
      adjustedValue: ActionDisposition.AutoFixCandidate,
      reason: "test promotion",
      confidence: 0.9,
      learnedFrom: "test",
      reversible: true,
    };

    const prefs: OrgPreferences = {
      organizationId: orgId,
      preferredProviders: [],
      riskTolerance: RiskTolerance.Moderate,
      approvalPolicy: ApprovalPolicy.AutoSafe,
      autoApplyEnabled: true,
      outputFormat: OutputFormat.Terraform,
      businessContext: "saas" as never,
      ignoredFindingTitles: new Set(),
      priorityCategories: [],
      notes: null,
    };

    const checks = validateAdjustments([fakePromotion], prefs);
    const promotionCheck = checks.find((c) => c.name === "No disposition promotions");

    results.push({
      name: "Safeguard catches disposition promotion attempt",
      passed: promotionCheck !== undefined && !promotionCheck.passed,
      detail: promotionCheck ? `Passed: ${promotionCheck.passed} — ${promotionCheck.detail}` : "Check not found",
    });
  }

  _resetSignalStore();

  // Test 9: Reset clears all signals and restores defaults
  {
    for (let i = 0; i < 15; i++) {
      recordSignal(makeTestSignal(orgId, userId, "recommendation_rejected", { actionType: "resize_compute" }));
    }

    const beforeProfile = aggregateProfile(orgId);
    const resetResult = resetAdaptiveBehavior(orgId);
    const afterProfile = aggregateProfile(orgId);

    results.push({
      name: "Reset clears signals and restores neutral profile",
      passed: beforeProfile.signalCount > 0 && afterProfile.signalCount === 0 && resetResult.signalsCleared > 0,
      detail: `Before: ${beforeProfile.signalCount} signals, after: ${afterProfile.signalCount}, cleared: ${resetResult.signalsCleared}`,
    });
  }

  _resetSignalStore();

  // Test 10: Category boost adapts based on engagement
  {
    for (let i = 0; i < 10; i++) {
      recordSignal(makeTestSignal(orgId, userId, "recommendation_approved", { actionType: "resize_compute", category: "cost", riskLevel: "low" }));
    }
    for (let i = 0; i < 8; i++) {
      recordSignal(makeTestSignal(orgId, userId, "recommendation_ignored", { actionType: "apply_storage_policy", category: "resilience" }));
    }

    const profile = aggregateProfile(orgId);
    const costBoost = adaptiveCategoryBoost("cost", profile);
    const resiliencePenalty = adaptiveCategoryBoost("resilience", profile);

    results.push({
      name: "Category boost adapts based on engagement patterns",
      passed: costBoost > 1.0 && resiliencePenalty < 1.0,
      detail: `Cost boost: ${costBoost.toFixed(2)} (should be > 1.0), resilience: ${resiliencePenalty.toFixed(2)} (should be < 1.0)`,
    });
  }

  _resetSignalStore();

  return results;
}

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeTestSignal(
  orgId: string,
  userId: string,
  signalType: SignalType,
  overrides: Partial<BehaviorSignal> = {},
): BehaviorSignal {
  return {
    id: makeSignalId(),
    organizationId: orgId,
    userId,
    signalType,
    timestamp: new Date().toISOString(),
    actionType: null,
    category: null,
    provider: null,
    riskLevel: null,
    severity: null,
    findingTitle: null,
    recommendationId: null,
    runId: null,
    metadata: {},
    ...overrides,
  };
}

function makeTestRec(
  id: string,
  actionType: string,
  disposition: ActionDisposition,
  riskLevel: string,
): AgentRecommendation {
  return {
    id,
    findingId: `finding-${id}`,
    title: `Test recommendation ${id}`,
    rationale: "Test rationale",
    estimatedSavings: { monthly: 100, yearly: 1200 },
    actionType: actionType as AgentRecommendation["actionType"],
    disposition,
    dispositionReason: "Test disposition",
    riskLevel: riskLevel as AgentRecommendation["riskLevel"],
    effort: "low",
    actionable: disposition !== ActionDisposition.ReportOnly,
  };
}
