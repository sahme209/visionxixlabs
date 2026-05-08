/**
 * Axiom Agent Reasoning Engine
 *
 * Transforms raw findings + recommendations into explainable, prioritized
 * intelligence. Instead of listing signals, the agent reasons about what
 * matters, groups related issues into themes, explains tradeoffs, and
 * decides dispositions with human-readable rationale.
 *
 * Pipeline:  Context → Cluster → Analyze → Reason → Tag → Narrate → Cap
 */

import type { CloudProvider, CloudSnapshot } from "../cloudSnapshot";
import type { CostSignal, SignalType, ConfidenceScore } from "../costSignals";
import type { ExecutionPlanItem, ActionType, RiskLevel } from "../executionPlan";
import type {
  AgentFinding,
  AgentRecommendation,
  FindingCategory,
  FindingSeverity,
  ActionDisposition,
} from "./types";
import type { OrgPreferences } from "./preferences";
import { RiskTolerance, ApprovalPolicy, OutputFormat, BusinessContext } from "../enums";

// ---------------------------------------------------------------------------
// 1. Reasoning Context — assembled input for the pipeline
// ---------------------------------------------------------------------------

export type ReasoningContext = {
  snapshot: CloudSnapshot;
  findings: AgentFinding[];
  recommendations: AgentRecommendation[];
  signals: CostSignal[];
  preferences: OrgPreferences;
  previousRunSummaries: PreviousRunSummary[];
  executionItems: ExecutionPlanItem[];
};

export type PreviousRunSummary = {
  runId: string;
  completedAt: string;
  findingCount: number;
  savingsIdentified: { monthly: number; yearly: number };
  themes: string[];
  appliedActions: string[];
};

// ---------------------------------------------------------------------------
// 2. Theme — clustered group of related findings
// ---------------------------------------------------------------------------

export type Theme = {
  id: string;
  label: string;
  category: FindingCategory;
  findings: AgentFinding[];
  recommendations: AgentRecommendation[];
  aggregatedSavings: { monthly: number; yearly: number };
  highestSeverity: FindingSeverity;
  resourceCount: number;
  regions: string[];
  providers: CloudProvider[];
  signalTypes: SignalType[];
  tradeoff: Tradeoff;
  disposition: ThemeDisposition;
  tags: ThemeTag[];
  narrative: string;
};

export type ThemeTag = "urgent" | "quick_win" | "high_savings" | "recurring" | "new" | "escalating";

export type ThemeDisposition = {
  recommended: ActionDisposition;
  reason: string;
  alternativeIfRejected: string;
};

// ---------------------------------------------------------------------------
// 3. Tradeoff — act vs. wait analysis
// ---------------------------------------------------------------------------

export type Tradeoff = {
  actNow: TradeoffSide;
  waitOrIgnore: TradeoffSide;
  recommendation: "act" | "wait" | "monitor";
  confidence: ConfidenceScore;
  timeHorizon: string;
};

type TradeoffSide = {
  outcome: string;
  risk: string;
  cost: string;
};

// ---------------------------------------------------------------------------
// 4. Reasoned Output — the engine's final product
// ---------------------------------------------------------------------------

export type ReasonedOutput = {
  themes: Theme[];
  executiveSummary: string;
  agentNarrative: string;
  quickWins: Theme[];
  urgentItems: Theme[];
  monitorOnly: Theme[];
  autoFixCandidates: Theme[];
  approvalRequired: Theme[];
  totalSavings: { monthly: number; yearly: number };
  cognitiveLoadScore: number;
  cappedAt: number | null;
  trend: TrendAnalysis | null;
};

export type TrendAnalysis = {
  direction: "improving" | "stable" | "degrading";
  comparedToRunId: string | null;
  deltaFindings: number;
  deltaSavings: number;
  summary: string;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_THEMES_SHOWN = 7;
const QUICK_WIN_EFFORT_CEILING: AgentRecommendation["effort"][] = ["none", "low"];
const QUICK_WIN_RISK_CEILING: RiskLevel[] = ["low"];
const HIGH_SAVINGS_THRESHOLD_YEARLY = 2400;
const URGENCY_SEVERITY_FLOOR: FindingSeverity[] = ["high", "critical"];

const SEVERITY_RANK: Record<FindingSeverity, number> = {
  info: 0, low: 1, medium: 2, high: 3, critical: 4,
};

const CATEGORY_RANK: Record<FindingCategory, number> = {
  security: 5, compliance: 4, resilience: 3, cost: 2, performance: 1,
};

// ---------------------------------------------------------------------------
// Theme affinity keys — determines which findings cluster together
// ---------------------------------------------------------------------------

type AffinityKey = string;

function affinityKey(finding: AgentFinding, rec: AgentRecommendation | undefined): AffinityKey {
  const action = rec?.actionType ?? "none";
  return `${finding.category}::${action}::${finding.provider}`;
}

// ---------------------------------------------------------------------------
// Stage 1: Context validation
// ---------------------------------------------------------------------------

function validateContext(ctx: ReasoningContext): void {
  if (!ctx.snapshot) throw new Error("ReasoningEngine: snapshot is required");
  if (!ctx.findings) throw new Error("ReasoningEngine: findings are required");
  if (!ctx.preferences) throw new Error("ReasoningEngine: preferences are required");
}

// ---------------------------------------------------------------------------
// Stage 2: Theme clustering
// ---------------------------------------------------------------------------

const THEME_LABELS: Record<string, string> = {
  "cost::resize_compute": "Compute Right-Sizing",
  "cost::apply_storage_policy": "Storage Optimization",
  "cost::purchase_commitment": "Commitment Discount Opportunity",
  "cost::decommission_compute": "Idle Resource Cleanup",
  "cost::none": "Cost Observation",
  "resilience::none": "Resilience Gap",
  "resilience::enable_backup": "Backup & Recovery",
  "security::restrict_public_access": "Public Exposure Risk",
  "security::none": "Security Observation",
  "compliance::none": "Compliance Observation",
  "performance::none": "Performance Observation",
  "performance::resize_compute": "Performance Tuning",
};

function themeLabel(category: FindingCategory, actionType: ActionType | null | undefined): string {
  const key = `${category}::${actionType ?? "none"}`;
  return THEME_LABELS[key] ?? `${category.charAt(0).toUpperCase() + category.slice(1)} Issue`;
}

function clusterIntoThemes(
  findings: AgentFinding[],
  recommendations: AgentRecommendation[],
): Map<AffinityKey, { findings: AgentFinding[]; recommendations: AgentRecommendation[] }> {
  const recByFinding = new Map<string, AgentRecommendation>();
  for (const rec of recommendations) {
    recByFinding.set(rec.findingId, rec);
  }

  const clusters = new Map<AffinityKey, { findings: AgentFinding[]; recommendations: AgentRecommendation[] }>();

  for (const finding of findings) {
    const rec = recByFinding.get(finding.id);
    const key = affinityKey(finding, rec);

    if (!clusters.has(key)) {
      clusters.set(key, { findings: [], recommendations: [] });
    }
    const cluster = clusters.get(key)!;
    cluster.findings.push(finding);
    if (rec) cluster.recommendations.push(rec);
  }

  return clusters;
}

// ---------------------------------------------------------------------------
// Stage 3: Tradeoff analysis
// ---------------------------------------------------------------------------

function analyzeTradeoff(
  findings: AgentFinding[],
  recommendations: AgentRecommendation[],
  prefs: OrgPreferences,
): Tradeoff {
  const totalYearlySavings = findings.reduce(
    (sum, f) => sum + (f.estimatedSavings?.yearly ?? 0), 0,
  );
  const highestSev = findings.reduce(
    (max, f) => (SEVERITY_RANK[f.severity] > SEVERITY_RANK[max] ? f.severity : max),
    "info" as FindingSeverity,
  );
  const highestRisk = recommendations.reduce(
    (max, r) => {
      const rank: Record<string, number> = { low: 1, medium: 2, high: 3 };
      return (rank[r.riskLevel ?? "low"] ?? 0) > (rank[max] ?? 0) ? (r.riskLevel ?? "low") : max;
    },
    "low" as string,
  ) as RiskLevel;

  const category = findings[0]?.category ?? "cost";
  const isSecurityOrCompliance = category === "security" || category === "compliance";
  const isResilience = category === "resilience";
  const isConservative = prefs.riskTolerance === RiskTolerance.Conservative;

  const avgConfidence = computeAverageConfidence(findings);

  if (isSecurityOrCompliance && SEVERITY_RANK[highestSev] >= SEVERITY_RANK["high"]) {
    return {
      actNow: {
        outcome: "Eliminates active security/compliance exposure",
        risk: highestRisk === "high" ? "Requires careful change management" : "Low operational risk",
        cost: totalYearlySavings > 0 ? `Saves ~$${fmt(totalYearlySavings)}/yr` : "No direct cost impact",
      },
      waitOrIgnore: {
        outcome: "Exposure persists — potential breach, audit finding, or regulatory penalty",
        risk: "Risk compounds over time; incident cost far exceeds remediation cost",
        cost: "Potential incident cost: 10–100× remediation cost",
      },
      recommendation: "act",
      confidence: avgConfidence,
      timeHorizon: "Immediate — address within 24–48 hours",
    };
  }

  if (isResilience && SEVERITY_RANK[highestSev] >= SEVERITY_RANK["medium"]) {
    return {
      actNow: {
        outcome: "Improves fault tolerance and disaster recovery posture",
        risk: highestRisk === "high" ? "Infrastructure changes needed" : "Minimal disruption expected",
        cost: totalYearlySavings > 0 ? `Saves ~$${fmt(totalYearlySavings)}/yr` : "May increase costs slightly for redundancy",
      },
      waitOrIgnore: {
        outcome: "Single point of failure remains — outage probability unchanged",
        risk: "Next outage has full-blast-radius impact; recovery time unimproved",
        cost: "Estimated downtime cost: $1,000–$50,000 per hour depending on workload",
      },
      recommendation: "act",
      confidence: avgConfidence,
      timeHorizon: "This sprint — address within 1–2 weeks",
    };
  }

  if (totalYearlySavings >= HIGH_SAVINGS_THRESHOLD_YEARLY && highestRisk !== "high") {
    return {
      actNow: {
        outcome: `Reduces annual spend by ~$${fmt(totalYearlySavings)}`,
        risk: highestRisk === "medium" ? "Moderate risk — validate in staging first" : "Low operational risk",
        cost: `Net savings: ~$${fmt(totalYearlySavings)}/yr after implementation effort`,
      },
      waitOrIgnore: {
        outcome: `Overspend continues at ~$${fmt(Math.round(totalYearlySavings / 12))}/month`,
        risk: "No operational risk from inaction, but opportunity cost accumulates",
        cost: `Cumulative waste: ~$${fmt(totalYearlySavings)} per year of delay`,
      },
      recommendation: isConservative && highestRisk === "medium" ? "monitor" : "act",
      confidence: avgConfidence,
      timeHorizon: highestRisk === "medium" ? "Next maintenance window" : "This week — low-risk optimization",
    };
  }

  if (highestRisk === "high" || avgConfidence === "low") {
    return {
      actNow: {
        outcome: "Addresses identified issue but requires careful execution",
        risk: "High implementation risk or low-confidence analysis",
        cost: totalYearlySavings > 0 ? `Potential savings: ~$${fmt(totalYearlySavings)}/yr` : "No direct savings",
      },
      waitOrIgnore: {
        outcome: "Gather more data before committing to changes",
        risk: "Minimal risk from waiting; allows confidence to improve",
        cost: "Small ongoing opportunity cost, offset by reduced change risk",
      },
      recommendation: "monitor",
      confidence: avgConfidence,
      timeHorizon: "Revisit in 7–14 days with additional data",
    };
  }

  return {
    actNow: {
      outcome: totalYearlySavings > 0
        ? `Saves ~$${fmt(totalYearlySavings)}/yr with straightforward changes`
        : "Improves infrastructure posture",
      risk: "Low implementation risk",
      cost: totalYearlySavings > 0 ? `$${fmt(totalYearlySavings)}/yr saved` : "Minimal cost impact",
    },
    waitOrIgnore: {
      outcome: "Current state is acceptable but suboptimal",
      risk: "No immediate risk, but technical debt may accumulate",
      cost: totalYearlySavings > 0 ? `~$${fmt(Math.round(totalYearlySavings / 12))}/month wasted` : "No direct cost",
    },
    recommendation: totalYearlySavings >= 600 ? "act" : "monitor",
    confidence: avgConfidence,
    timeHorizon: "Next planning cycle",
  };
}

// ---------------------------------------------------------------------------
// Stage 4: Disposition reasoning
// ---------------------------------------------------------------------------

function reasonDisposition(
  findings: AgentFinding[],
  recommendations: AgentRecommendation[],
  tradeoff: Tradeoff,
  prefs: OrgPreferences,
): ThemeDisposition {
  const dispositions = recommendations.map((r) => r.disposition);
  const hasAutoFix = dispositions.includes("auto_fix_candidate");
  const hasApproval = dispositions.includes("approval_required");
  const allReportOnly = dispositions.every((d) => d === "report_only" || d === "blocked");
  const category = findings[0]?.category ?? "cost";
  const highestSev = findings.reduce(
    (max, f) => (SEVERITY_RANK[f.severity] > SEVERITY_RANK[max] ? f.severity : max),
    "info" as FindingSeverity,
  );

  if (allReportOnly || recommendations.length === 0) {
    return {
      recommended: "report_only",
      reason: tradeoff.recommendation === "monitor"
        ? "Low confidence or high risk — monitoring is the safer path until more data is available."
        : "This is informational — no automated action is appropriate at this time.",
      alternativeIfRejected: "No action needed. This will resurface in the next scan if conditions change.",
    };
  }

  if (hasAutoFix && prefs.autoApplyEnabled && tradeoff.recommendation === "act") {
    const safeCount = recommendations.filter((r) => r.disposition === "auto_fix_candidate").length;
    return {
      recommended: "auto_fix_candidate",
      reason: `${safeCount} action(s) are low-risk, reversible, and match your auto-apply policy. `
        + (category === "security"
          ? "Remediating security exposure quickly reduces attack surface."
          : `Based on ${tradeoff.confidence}-confidence analysis, these changes are safe to apply automatically.`),
      alternativeIfRejected: "Move to approval-required — you'll review each action before it's applied.",
    };
  }

  if (hasAutoFix && !prefs.autoApplyEnabled) {
    return {
      recommended: "approval_required",
      reason: "These actions are technically safe to auto-apply, but your organization requires explicit approval. "
        + "Review the execution preview and approve when ready.",
      alternativeIfRejected: "Switch to monitor-only — the agent will track this and remind you on the next scan.",
    };
  }

  if (hasApproval) {
    const isCritical = SEVERITY_RANK[highestSev] >= SEVERITY_RANK["high"];
    return {
      recommended: "approval_required",
      reason: isCritical
        ? `${highestSev.charAt(0).toUpperCase() + highestSev.slice(1)}-severity ${category} issue — requires human review before changes are applied.`
        : "Moderate complexity or scope — review the execution plan and approve the actions you're comfortable with.",
      alternativeIfRejected: "Defer to next scan cycle. The agent will re-evaluate and update you on any changes.",
    };
  }

  return {
    recommended: "report_only",
    reason: "No actionable remediation available at this time.",
    alternativeIfRejected: "No action needed.",
  };
}

// ---------------------------------------------------------------------------
// Stage 5: Urgency & quick-win tagging
// ---------------------------------------------------------------------------

function tagTheme(
  findings: AgentFinding[],
  recommendations: AgentRecommendation[],
  tradeoff: Tradeoff,
  previousRuns: PreviousRunSummary[],
  themeLabel: string,
): ThemeTag[] {
  const tags: ThemeTag[] = [];

  const highestSev = findings.reduce(
    (max, f) => (SEVERITY_RANK[f.severity] > SEVERITY_RANK[max] ? f.severity : max),
    "info" as FindingSeverity,
  );
  if (URGENCY_SEVERITY_FLOOR.includes(highestSev) || tradeoff.timeHorizon.startsWith("Immediate")) {
    tags.push("urgent");
  }

  const isQuickWin = recommendations.length > 0
    && recommendations.every((r) =>
      QUICK_WIN_EFFORT_CEILING.includes(r.effort)
      && QUICK_WIN_RISK_CEILING.includes(r.riskLevel ?? "low"),
    )
    && tradeoff.recommendation === "act";
  if (isQuickWin) tags.push("quick_win");

  const totalYearly = findings.reduce((s, f) => s + (f.estimatedSavings?.yearly ?? 0), 0);
  if (totalYearly >= HIGH_SAVINGS_THRESHOLD_YEARLY) tags.push("high_savings");

  const prevThemes = previousRuns.flatMap((r) => r.themes);
  if (prevThemes.includes(themeLabel)) {
    tags.push("recurring");
  } else if (previousRuns.length > 0) {
    tags.push("new");
  }

  if (previousRuns.length >= 2) {
    const lastTwo = previousRuns.slice(-2);
    const countTrend = lastTwo.map((r) => r.findingCount);
    if (countTrend.length === 2 && countTrend[1] > countTrend[0]) {
      tags.push("escalating");
    }
  }

  return tags;
}

// ---------------------------------------------------------------------------
// Stage 6: Narrative synthesis
// ---------------------------------------------------------------------------

function synthesizeNarrative(
  label: string,
  findings: AgentFinding[],
  recommendations: AgentRecommendation[],
  tradeoff: Tradeoff,
  disposition: ThemeDisposition,
  tags: ThemeTag[],
  totalSavings: { monthly: number; yearly: number },
): string {
  const parts: string[] = [];
  const provider = findings[0]?.provider ?? "your cloud";
  const providerName = provider === "aws" ? "AWS" : provider === "azure" ? "Azure" : provider === "gcp" ? "Google Cloud" : provider;
  const resourceCount = new Set(findings.flatMap((f) => f.affectedResources)).size;
  const regions = [...new Set(findings.map((f) => f.region))];
  const regionStr = regions.length === 1 ? regions[0] : `${regions.length} regions`;
  const confidence = computeAverageConfidence(findings);

  if (tags.includes("urgent")) {
    parts.push(`⚠ **Urgent:** `);
  }

  const findingNoun = findings.length === 1 ? "finding" : "findings";

  if (totalSavings.yearly > 0) {
    parts.push(
      `I found a ${riskWord(tradeoff)} optimization opportunity affecting `
      + `${resourceCount} resource${resourceCount !== 1 ? "s" : ""} in ${regionStr} (${providerName}). `
      + `Based on ${confidence}-confidence analysis, `
      + `${label.toLowerCase()} could reduce annual spend by ~$${fmt(totalSavings.yearly)} `
      + `with ${riskWord(tradeoff)} operational risk.`,
    );
  } else {
    parts.push(
      `I identified ${findings.length} ${findingNoun} related to **${label.toLowerCase()}** `
      + `across ${resourceCount} resource${resourceCount !== 1 ? "s" : ""} in ${regionStr} (${providerName}).`,
    );
  }

  if (tradeoff.recommendation === "act") {
    parts.push(` My recommendation: **${disposition.reason}**`);
  } else if (tradeoff.recommendation === "monitor") {
    parts.push(` I recommend monitoring this for now. ${tradeoff.waitOrIgnore.outcome}.`);
  }

  if (tags.includes("quick_win")) {
    parts.push(` This is a **quick win** — low effort, low risk, and safe to execute.`);
  }

  if (tags.includes("recurring")) {
    parts.push(` Note: this theme has appeared in previous scans.`);
  }

  if (tags.includes("escalating")) {
    parts.push(` ⬆ This issue is growing — more resources are affected compared to the last scan.`);
  }

  return parts.join("");
}

function riskWord(tradeoff: Tradeoff): string {
  if (tradeoff.actNow.risk.toLowerCase().includes("high")) return "higher-risk";
  if (tradeoff.actNow.risk.toLowerCase().includes("moderate") || tradeoff.actNow.risk.toLowerCase().includes("medium")) return "moderate-risk";
  return "low-risk";
}

// ---------------------------------------------------------------------------
// Stage 7: Cognitive load management & output capping
// ---------------------------------------------------------------------------

function computeCognitiveLoad(themes: Theme[]): number {
  let score = 0;
  for (const theme of themes) {
    score += theme.findings.length * 2;
    score += theme.recommendations.length * 3;
    if (theme.tags.includes("urgent")) score += 10;
    if (theme.disposition.recommended === "approval_required") score += 5;
  }
  return Math.min(score, 100);
}

function capAndPrioritize(themes: Theme[]): { themes: Theme[]; cappedAt: number | null } {
  const sorted = [...themes].sort((a, b) => {
    const aUrgent = a.tags.includes("urgent") ? 1 : 0;
    const bUrgent = b.tags.includes("urgent") ? 1 : 0;
    if (aUrgent !== bUrgent) return bUrgent - aUrgent;

    const aCat = CATEGORY_RANK[a.category] ?? 0;
    const bCat = CATEGORY_RANK[b.category] ?? 0;
    if (aCat !== bCat) return bCat - aCat;

    const aSev = SEVERITY_RANK[a.highestSeverity] ?? 0;
    const bSev = SEVERITY_RANK[b.highestSeverity] ?? 0;
    if (aSev !== bSev) return bSev - aSev;

    const aSavings = a.aggregatedSavings.yearly;
    const bSavings = b.aggregatedSavings.yearly;
    return bSavings - aSavings;
  });

  if (sorted.length <= MAX_THEMES_SHOWN) {
    return { themes: sorted, cappedAt: null };
  }

  return { themes: sorted.slice(0, MAX_THEMES_SHOWN), cappedAt: sorted.length };
}

// ---------------------------------------------------------------------------
// Trend analysis (compared to previous runs)
// ---------------------------------------------------------------------------

function analyzeTrend(
  currentFindings: AgentFinding[],
  currentSavings: { monthly: number; yearly: number },
  previousRuns: PreviousRunSummary[],
): TrendAnalysis | null {
  if (previousRuns.length === 0) return null;

  const lastRun = previousRuns[previousRuns.length - 1];
  const deltaFindings = currentFindings.length - lastRun.findingCount;
  const deltaSavings = currentSavings.yearly - lastRun.savingsIdentified.yearly;

  let direction: TrendAnalysis["direction"];
  if (deltaFindings < -2) direction = "improving";
  else if (deltaFindings > 2) direction = "degrading";
  else direction = "stable";

  let summary: string;
  if (direction === "improving") {
    summary = `Infrastructure health is improving — ${Math.abs(deltaFindings)} fewer findings than last scan.`;
    if (deltaSavings < 0) summary += ` Savings opportunities reduced by $${fmt(Math.abs(deltaSavings))}/yr (good — means you've captured them).`;
  } else if (direction === "degrading") {
    summary = `${deltaFindings} new findings since last scan — infrastructure needs attention.`;
    if (deltaSavings > 0) summary += ` Uncaptured savings grew by $${fmt(deltaSavings)}/yr.`;
  } else {
    summary = "Infrastructure posture is stable since last scan.";
    if (Math.abs(deltaSavings) > 100) {
      summary += deltaSavings > 0
        ? ` Savings opportunities increased slightly (+$${fmt(deltaSavings)}/yr).`
        : ` Some savings have been captured (-$${fmt(Math.abs(deltaSavings))}/yr).`;
    }
  }

  return {
    direction,
    comparedToRunId: lastRun.runId,
    deltaFindings,
    deltaSavings,
    summary,
  };
}

// ---------------------------------------------------------------------------
// Executive summary builder
// ---------------------------------------------------------------------------

function buildExecutiveSummary(themes: Theme[], trend: TrendAnalysis | null): string {
  if (themes.length === 0) {
    return "Your infrastructure is well-optimized. No significant findings at this time.";
  }

  const urgentCount = themes.filter((t) => t.tags.includes("urgent")).length;
  const quickWinCount = themes.filter((t) => t.tags.includes("quick_win")).length;
  const totalSavings = themes.reduce((s, t) => s + t.aggregatedSavings.yearly, 0);
  const autoFixCount = themes.filter((t) => t.disposition.recommended === "auto_fix_candidate").length;

  const parts: string[] = [];

  if (urgentCount > 0) {
    parts.push(`${urgentCount} urgent issue${urgentCount !== 1 ? "s" : ""} requiring immediate attention`);
  }

  if (quickWinCount > 0) {
    parts.push(`${quickWinCount} quick win${quickWinCount !== 1 ? "s" : ""} ready to execute`);
  }

  if (totalSavings > 0) {
    parts.push(`~$${fmt(totalSavings)}/yr in identified savings`);
  }

  if (autoFixCount > 0) {
    parts.push(`${autoFixCount} theme${autoFixCount !== 1 ? "s" : ""} safe for automatic remediation`);
  }

  let summary = `I analyzed your infrastructure and found ${themes.length} theme${themes.length !== 1 ? "s" : ""}`;
  if (parts.length > 0) summary += `: ${parts.join(", ")}`;
  summary += ".";

  if (trend) {
    summary += ` ${trend.summary}`;
  }

  return summary;
}

// ---------------------------------------------------------------------------
// Agent narrative builder (longer, theme-by-theme)
// ---------------------------------------------------------------------------

function buildAgentNarrative(themes: Theme[], trend: TrendAnalysis | null): string {
  const lines: string[] = [];

  if (trend) {
    lines.push(`**Trend:** ${trend.summary}`);
    lines.push("");
  }

  const urgent = themes.filter((t) => t.tags.includes("urgent"));
  const quickWins = themes.filter((t) => t.tags.includes("quick_win") && !t.tags.includes("urgent"));
  const rest = themes.filter((t) => !t.tags.includes("urgent") && !t.tags.includes("quick_win"));

  if (urgent.length > 0) {
    lines.push("### Requires Immediate Attention");
    for (const t of urgent) lines.push(`- ${t.narrative}`);
    lines.push("");
  }

  if (quickWins.length > 0) {
    lines.push("### Quick Wins");
    for (const t of quickWins) lines.push(`- ${t.narrative}`);
    lines.push("");
  }

  if (rest.length > 0) {
    lines.push("### Other Findings");
    for (const t of rest) lines.push(`- ${t.narrative}`);
    lines.push("");
  }

  return lines.join("\n").trim();
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function computeAverageConfidence(findings: AgentFinding[]): ConfidenceScore {
  if (findings.length === 0) return "low";
  const rank: Record<ConfidenceScore, number> = { high: 3, medium: 2, low: 1 };
  const avg = findings.reduce((s, f) => s + rank[f.confidence], 0) / findings.length;
  if (avg >= 2.5) return "high";
  if (avg >= 1.5) return "medium";
  return "low";
}

function fmt(n: number): string {
  return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function makeThemeId(index: number, label: string): string {
  return `theme_${index}_${label.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`;
}

// ---------------------------------------------------------------------------
// Main pipeline — public entry point
// ---------------------------------------------------------------------------

export function runReasoningEngine(ctx: ReasoningContext): ReasonedOutput {
  validateContext(ctx);

  // Stage 2: Cluster
  const clusters = clusterIntoThemes(ctx.findings, ctx.recommendations);

  // Stage 3–6: Build themes
  const rawThemes: Theme[] = [];
  let themeIndex = 0;

  for (const [, cluster] of clusters) {
    const { findings, recommendations } = cluster;
    if (findings.length === 0) continue;

    const category = findings[0].category;
    const actionType = recommendations[0]?.actionType;
    const label = themeLabel(category, actionType);

    const tradeoff = analyzeTradeoff(findings, recommendations, ctx.preferences);
    const disposition = reasonDisposition(findings, recommendations, tradeoff, ctx.preferences);
    const tags = tagTheme(findings, recommendations, tradeoff, ctx.previousRunSummaries, label);

    const aggregatedSavings = {
      monthly: findings.reduce((s, f) => s + (f.estimatedSavings?.monthly ?? 0), 0),
      yearly: findings.reduce((s, f) => s + (f.estimatedSavings?.yearly ?? 0), 0),
    };

    const highestSeverity = findings.reduce(
      (max, f) => (SEVERITY_RANK[f.severity] > SEVERITY_RANK[max] ? f.severity : max),
      "info" as FindingSeverity,
    );

    const regions = [...new Set(findings.map((f) => f.region))];
    const providers = [...new Set(findings.map((f) => f.provider))];
    const signalTypes = [...new Set(
      recommendations
        .map((r) => r.actionType)
        .filter((a): a is ActionType => a !== null)
        .map(actionToSignalType)
        .filter((s): s is SignalType => s !== null),
    )];

    const resourceCount = new Set(findings.flatMap((f) => f.affectedResources)).size;

    const narrative = synthesizeNarrative(
      label, findings, recommendations, tradeoff, disposition, tags, aggregatedSavings,
    );

    rawThemes.push({
      id: makeThemeId(themeIndex++, label),
      label,
      category,
      findings,
      recommendations,
      aggregatedSavings,
      highestSeverity,
      resourceCount,
      regions,
      providers,
      signalTypes,
      tradeoff,
      disposition,
      tags,
      narrative,
    });
  }

  // Stage 7: Cap & prioritize
  const { themes, cappedAt } = capAndPrioritize(rawThemes);

  const totalSavings = {
    monthly: themes.reduce((s, t) => s + t.aggregatedSavings.monthly, 0),
    yearly: themes.reduce((s, t) => s + t.aggregatedSavings.yearly, 0),
  };

  const trend = analyzeTrend(ctx.findings, totalSavings, ctx.previousRunSummaries);

  const cognitiveLoadScore = computeCognitiveLoad(themes);
  const executiveSummary = buildExecutiveSummary(themes, trend);
  const agentNarrative = buildAgentNarrative(themes, trend);

  return {
    themes,
    executiveSummary,
    agentNarrative,
    quickWins: themes.filter((t) => t.tags.includes("quick_win")),
    urgentItems: themes.filter((t) => t.tags.includes("urgent")),
    monitorOnly: themes.filter((t) => t.disposition.recommended === "report_only"),
    autoFixCandidates: themes.filter((t) => t.disposition.recommended === "auto_fix_candidate"),
    approvalRequired: themes.filter((t) => t.disposition.recommended === "approval_required"),
    totalSavings,
    cognitiveLoadScore,
    cappedAt,
    trend,
  };
}

// ---------------------------------------------------------------------------
// ActionType → SignalType mapping (reverse of what recommendationBuilder does)
// ---------------------------------------------------------------------------

function actionToSignalType(action: ActionType): SignalType | null {
  const map: Record<ActionType, SignalType> = {
    resize_compute: "compute_rightsizing",
    apply_storage_policy: "storage_tiering",
    purchase_commitment: "commitment_discount",
    decommission_compute: "idle_compute",
    restrict_public_access: "public_storage",
    enable_backup: "backup_warning",
  };
  return map[action] ?? null;
}

// ---------------------------------------------------------------------------
// Prompt templates — for LLM-assisted reasoning (optional enhancement)
// ---------------------------------------------------------------------------

export const PROMPT_TEMPLATES = {
  themeNarrative: (theme: Theme) =>
    `You are Axiom, an AI cloud optimization agent. Write a 2-3 sentence explanation of the following theme for a technical decision-maker.\n\n`
    + `Theme: ${theme.label}\n`
    + `Category: ${theme.category}\n`
    + `Severity: ${theme.highestSeverity}\n`
    + `Affected resources: ${theme.resourceCount} across ${theme.regions.join(", ")}\n`
    + `Estimated savings: $${fmt(theme.aggregatedSavings.yearly)}/yr\n`
    + `Recommended disposition: ${theme.disposition.recommended}\n`
    + `Tradeoff if acting: ${theme.tradeoff.actNow.outcome}\n`
    + `Tradeoff if waiting: ${theme.tradeoff.waitOrIgnore.outcome}\n\n`
    + `Write conversationally. Be specific about numbers and resources. Explain WHY this matters, not just WHAT it is. `
    + `Do not use bullet points. End with a clear recommendation.`,

  executiveBrief: (output: ReasonedOutput) =>
    `You are Axiom, an AI cloud optimization agent. Write a 3-4 sentence executive brief.\n\n`
    + `Themes found: ${output.themes.length}\n`
    + `Urgent: ${output.urgentItems.length}\n`
    + `Quick wins: ${output.quickWins.length}\n`
    + `Total annual savings: $${fmt(output.totalSavings.yearly)}\n`
    + `Auto-fix candidates: ${output.autoFixCandidates.length}\n`
    + `Trend: ${output.trend?.summary ?? "First scan"}\n\n`
    + `Be direct. Lead with what matters most. Use exact dollar figures. `
    + `If there are urgent items, lead with those. If no urgent items, lead with quick wins.`,

  tradeoffExplanation: (theme: Theme) =>
    `Explain this tradeoff to a VP of Engineering in 2 sentences:\n\n`
    + `If we act now: ${theme.tradeoff.actNow.outcome}. Risk: ${theme.tradeoff.actNow.risk}.\n`
    + `If we wait: ${theme.tradeoff.waitOrIgnore.outcome}. Risk: ${theme.tradeoff.waitOrIgnore.risk}.\n`
    + `Time horizon: ${theme.tradeoff.timeHorizon}\n\n`
    + `Be concrete. Avoid hedging.`,
} as const;

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

export type ReasoningTestResult = { name: string; passed: boolean; detail: string };

export function runReasoningTests(): ReasoningTestResult[] {
  const results: ReasoningTestResult[] = [];

  const mockPrefs: OrgPreferences = {
    organizationId: "test-org",
    preferredProviders: [],
    riskTolerance: RiskTolerance.Moderate,
    approvalPolicy: ApprovalPolicy.AutoSafe,
    autoApplyEnabled: true,
    outputFormat: OutputFormat.Terraform,
    businessContext: BusinessContext.SaaS,
    ignoredFindingTitles: new Set(),
    priorityCategories: [],
    notes: null,
  };

  const makeFinding = (
    overrides: Partial<AgentFinding>,
  ): AgentFinding => ({
    id: `f-${Math.random().toString(36).slice(2, 8)}`,
    category: "cost",
    severity: "medium",
    title: "Test finding",
    description: "Test",
    affectedResources: ["res-1"],
    region: "us-east-1",
    provider: "aws",
    confidence: "high",
    estimatedSavings: { monthly: 100, yearly: 1200 },
    data: {},
    ...overrides,
  });

  const makeRec = (
    findingId: string,
    overrides: Partial<AgentRecommendation>,
  ): AgentRecommendation => ({
    id: `r-${Math.random().toString(36).slice(2, 8)}`,
    findingId,
    title: "Test rec",
    rationale: "Test",
    estimatedSavings: { monthly: 100, yearly: 1200 },
    actionType: "resize_compute",
    disposition: "approval_required",
    dispositionReason: "Test",
    riskLevel: "low",
    effort: "low",
    actionable: true,
    ...overrides,
  });

  const mockSnapshot: CloudSnapshot = {
    provider: "aws",
    accountId: "123456789",
    scannedAt: new Date().toISOString(),
    regions: ["us-east-1"],
    resources: [],
    flags: { singleRegion: true, noBackupsDetected: false },
  };

  // Test 1: Security findings are always tagged urgent
  {
    const f = makeFinding({ category: "security", severity: "high" });
    const r = makeRec(f.id, { actionType: "restrict_public_access", disposition: "approval_required" });
    const ctx: ReasoningContext = {
      snapshot: mockSnapshot,
      findings: [f],
      recommendations: [r],
      signals: [],
      preferences: mockPrefs,
      previousRunSummaries: [],
      executionItems: [],
    };
    const output = runReasoningEngine(ctx);
    const secTheme = output.themes.find((t) => t.category === "security");
    results.push({
      name: "High-severity security findings tagged urgent",
      passed: secTheme?.tags.includes("urgent") ?? false,
      detail: secTheme ? `Tags: ${secTheme.tags.join(", ")}` : "No security theme found",
    });
  }

  // Test 2: Low-effort, low-risk findings are tagged quick_win
  {
    const f = makeFinding({ severity: "low", estimatedSavings: { monthly: 500, yearly: 6000 } });
    const r = makeRec(f.id, { effort: "low", riskLevel: "low", disposition: "auto_fix_candidate" });
    const ctx: ReasoningContext = {
      snapshot: mockSnapshot,
      findings: [f],
      recommendations: [r],
      signals: [],
      preferences: mockPrefs,
      previousRunSummaries: [],
      executionItems: [],
    };
    const output = runReasoningEngine(ctx);
    const theme = output.themes[0];
    results.push({
      name: "Low-effort low-risk findings tagged quick_win",
      passed: theme?.tags.includes("quick_win") ?? false,
      detail: theme ? `Tags: ${theme.tags.join(", ")}` : "No theme found",
    });
  }

  // Test 3: Urgent themes sort before cost themes
  {
    const secF = makeFinding({ category: "security", severity: "critical", estimatedSavings: null });
    const secR = makeRec(secF.id, { actionType: "restrict_public_access", estimatedSavings: null });
    const costF = makeFinding({ category: "cost", severity: "low", estimatedSavings: { monthly: 1000, yearly: 12000 } });
    const costR = makeRec(costF.id, { actionType: "resize_compute" });
    const ctx: ReasoningContext = {
      snapshot: mockSnapshot,
      findings: [costF, secF],
      recommendations: [costR, secR],
      signals: [],
      preferences: mockPrefs,
      previousRunSummaries: [],
      executionItems: [],
    };
    const output = runReasoningEngine(ctx);
    results.push({
      name: "Urgent security themes rank above high-savings cost themes",
      passed: output.themes[0]?.category === "security",
      detail: `First theme: ${output.themes[0]?.label} (${output.themes[0]?.category})`,
    });
  }

  // Test 4: Conservative org tightens auto-fix to approval
  {
    const f = makeFinding({ severity: "medium" });
    const r = makeRec(f.id, { disposition: "auto_fix_candidate", riskLevel: "medium" });
    const conservativePrefs = { ...mockPrefs, riskTolerance: RiskTolerance.Conservative, autoApplyEnabled: false };
    const ctx: ReasoningContext = {
      snapshot: mockSnapshot,
      findings: [f],
      recommendations: [r],
      signals: [],
      preferences: conservativePrefs,
      previousRunSummaries: [],
      executionItems: [],
    };
    const output = runReasoningEngine(ctx);
    const theme = output.themes[0];
    results.push({
      name: "Conservative org with auto-apply off → approval_required",
      passed: theme?.disposition.recommended === "approval_required",
      detail: `Disposition: ${theme?.disposition.recommended}`,
    });
  }

  // Test 5: Cognitive load capped at reasonable level
  {
    const findings: AgentFinding[] = [];
    const recs: AgentRecommendation[] = [];
    for (let i = 0; i < 20; i++) {
      const f = makeFinding({ id: `f-${i}`, category: i % 2 === 0 ? "cost" : "resilience" });
      const r = makeRec(f.id, { id: `r-${i}` });
      findings.push(f);
      recs.push(r);
    }
    const ctx: ReasoningContext = {
      snapshot: mockSnapshot,
      findings,
      recommendations: recs,
      signals: [],
      preferences: mockPrefs,
      previousRunSummaries: [],
      executionItems: [],
    };
    const output = runReasoningEngine(ctx);
    results.push({
      name: "Output capped to avoid overwhelming user",
      passed: output.themes.length <= MAX_THEMES_SHOWN,
      detail: `Themes shown: ${output.themes.length}, total: ${output.cappedAt ?? output.themes.length}`,
    });
  }

  // Test 6: Trend detected when previous runs exist
  {
    const f = makeFinding({});
    const r = makeRec(f.id, {});
    const ctx: ReasoningContext = {
      snapshot: mockSnapshot,
      findings: [f],
      recommendations: [r],
      signals: [],
      preferences: mockPrefs,
      previousRunSummaries: [{
        runId: "prev-1",
        completedAt: new Date(Date.now() - 7 * 86400000).toISOString(),
        findingCount: 5,
        savingsIdentified: { monthly: 500, yearly: 6000 },
        themes: ["Compute Right-Sizing"],
        appliedActions: ["resize_compute"],
      }],
      executionItems: [],
    };
    const output = runReasoningEngine(ctx);
    results.push({
      name: "Trend analysis produced when previous runs exist",
      passed: output.trend !== null && output.trend.direction === "improving",
      detail: output.trend ? `Direction: ${output.trend.direction}, delta: ${output.trend.deltaFindings}` : "No trend",
    });
  }

  // Test 7: Empty findings produce clean output
  {
    const ctx: ReasoningContext = {
      snapshot: mockSnapshot,
      findings: [],
      recommendations: [],
      signals: [],
      preferences: mockPrefs,
      previousRunSummaries: [],
      executionItems: [],
    };
    const output = runReasoningEngine(ctx);
    results.push({
      name: "Empty findings produce clean 'well-optimized' output",
      passed: output.themes.length === 0 && output.executiveSummary.includes("well-optimized"),
      detail: `Summary: ${output.executiveSummary}`,
    });
  }

  return results;
}
