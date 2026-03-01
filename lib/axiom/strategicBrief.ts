/**
 * Phase 8: Strategic Brief Engine — C-level intelligence.
 * Uses unified AI provider (OpenAI, Gemini, Anthropic). Deterministic fallback if no provider or on error.
 */

import { orchestrateGenerate } from "@/lib/ai/orchestrator";

export type StrategicBriefInput = {
  profile: { projectType?: string; hostingProvider?: string; monthlySpend?: string; complianceNeeds?: string };
  axiomScores: {
    infrastructureScore?: number;
    estimatedAnnualSavings?: number | null;
    riskExposureLevel?: string;
    deploymentFrictionIndex?: number;
    automationReadinessScore?: number;
    complexityTier?: string;
  };
  trendHistory?: Array<{ infrastructureScore?: number; estimatedAnnualSavings?: number | null; riskExposureLevel?: string }>;
  driftSignals?: { hasDrift?: boolean; driftLevel?: string; signals?: string[] };
  tier: "free" | "pro" | "growth" | "enterprise";
};

export type StrategicBrief = {
  executiveSummary: string;
  financialRiskNarrative: string;
  operationalRiskNarrative: string;
  scalabilityOutlook: string;
  "90DayStrategicFocus": string[];
  boardLevelKPIsToTrack: string[];
  recommendedInvestmentZones: string[];
  riskIfIgnored: string;
  boardSlideOutline?: string[];
  /** Phase 9: Likely objections based on tier, savings, friction, risk */
  objectionForecast?: string[];
};

function buildSystemPrompt(tier: string): string {
  return `You are an executive advisor producing board-level strategic briefs for cloud infrastructure.
Rules:
- Executive tone. No jargon. Speak to CTO, CIO, CFO, Board.
- NEVER fabricate numbers. Only use metrics provided.
- Reference provided scores explicitly.
- Output ONLY valid JSON. No markdown, no explanations.
- If a field cannot be derived from inputs, use a generic placeholder based on score ranges.`;
}

function buildUserPrompt(input: StrategicBriefInput): string {
  const { profile, axiomScores, trendHistory, driftSignals } = input;
  const scores = axiomScores;
  const infra = scores.infrastructureScore ?? 0;
  const savings = scores.estimatedAnnualSavings ?? 0;
  const risk = scores.riskExposureLevel ?? "Medium";
  const friction = scores.deploymentFrictionIndex ?? 50;
  const auto = scores.automationReadinessScore ?? 50;

  const trendNote =
    trendHistory && trendHistory.length > 0
      ? `\nTrend history (last ${Math.min(5, trendHistory.length)} snapshots): ${JSON.stringify(
          trendHistory.slice(-5).map((t) => ({
            infrastructureScore: t.infrastructureScore,
            estimatedAnnualSavings: t.estimatedAnnualSavings,
            riskExposureLevel: t.riskExposureLevel,
          }))
        )}`
      : "";

  const driftNote =
    driftSignals?.hasDrift && driftSignals?.signals?.length
      ? `\nDrift detected: level ${driftSignals.driftLevel ?? "medium"}, signals: ${driftSignals.signals.slice(0, 5).join("; ")}`
      : "";

  return `Generate a strategic brief using ONLY these inputs:

Profile: ${profile.projectType ?? "N/A"}, hosted on ${profile.hostingProvider ?? "N/A"}, monthly spend ~${profile.monthlySpend ?? "N/A"}, compliance: ${profile.complianceNeeds ?? "None"}

Scores (use these exact values):
- infrastructureScore: ${infra}
- estimatedAnnualSavings: ${savings}
- riskExposureLevel: ${risk}
- deploymentFrictionIndex: ${friction}
- automationReadinessScore: ${auto}
- complexityTier: ${scores.complexityTier ?? "Growth"}
${trendNote}${driftNote}

Return this JSON structure (no other text):
{
  "executiveSummary": "2-3 sentence executive summary referencing the above scores",
  "financialRiskNarrative": "Paragraph on financial exposure and savings opportunity",
  "operationalRiskNarrative": "Paragraph on operational and deployment risk",
  "scalabilityOutlook": "Paragraph on scalability and growth constraints",
  "90DayStrategicFocus": ["focus 1", "focus 2", "focus 3"],
  "boardLevelKPIsToTrack": ["KPI 1", "KPI 2", "KPI 3"],
  "recommendedInvestmentZones": ["zone 1", "zone 2"],
  "riskIfIgnored": "1-2 sentences on consequence of inaction"
}${input.tier !== "free" ? ',\n  "objectionForecast": ["likely objection 1", "likely objection 2"]' : ""}${input.tier === "enterprise" ? ',\n  "boardSlideOutline": ["slide 1 title", "slide 2 title", "slide 3 title"]' : ""}`;
}

function deterministicFallback(input: StrategicBriefInput): StrategicBrief {
  const scores = input.axiomScores;
  const infra = scores.infrastructureScore ?? 0;
  const savings = scores.estimatedAnnualSavings ?? 0;
  const risk = scores.riskExposureLevel ?? "Medium";
  const friction = scores.deploymentFrictionIndex ?? 50;

  const exec =
    infra >= 70
      ? `Infrastructure readiness is strong (${infra}/100). Estimated annual savings of ${savings ? `$${savings.toLocaleString()}` : "material"} available. Focus on automation and governance.`
      : `Infrastructure score ${infra}/100 indicates optimization opportunity. Risk level: ${risk}. Prioritize stabilization and cost levers.`;

  const financial =
    savings && savings > 0
      ? `Identified savings of approximately $${savings.toLocaleString()} annually. Right-sizing, reserved capacity, and storage tiering are primary levers.`
      : "Cost optimization levers require baseline measurement. Establish tagging and attribution first.";

  const operational =
    risk === "High"
      ? "Operational risk is elevated. Address security posture and deployment friction before scaling."
      : "Operational baseline is manageable. Incremental improvements in CI/CD and drift detection recommended.";

  const scal = infra >= 60 ? "Scalability outlook is positive. Automation readiness supports growth." : "Scalability constrained until infrastructure baseline improves.";

  return {
    executiveSummary: exec,
    financialRiskNarrative: financial,
    operationalRiskNarrative: operational,
    scalabilityOutlook: scal,
    "90DayStrategicFocus": [
      "Stabilize security posture and reduce risk exposure",
      "Implement cost optimization levers",
      "Establish drift detection and governance baseline",
    ],
    boardLevelKPIsToTrack: [
      "Infrastructure score trend",
      "Annualized savings realized",
      "Deployment friction index",
      "Security incident count",
    ],
    recommendedInvestmentZones: ["Automation and CI/CD", "Cost optimization tooling", "Governance and compliance"],
    riskIfIgnored: "Continued drift and unaddressed risk will increase technical debt and reduce ability to scale.",
    objectionForecast: input.tier !== "free"
      ? [
          savings < 5000 ? "ROI may be questioned — emphasize risk avoidance" : "Timing and prioritization — align with current initiatives",
          friction > 70 ? "Implementation effort concerns — offer phased approach" : "Budget constraints — lead with quick wins",
        ]
      : undefined,
  };
}

function parseJSON<T>(text: string): Partial<T> {
  const s = text.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  try {
    return JSON.parse(s) as Partial<T>;
  } catch {
    return {};
  }
}

export async function generateStrategicBrief(input: StrategicBriefInput): Promise<StrategicBrief> {
  const fallback = deterministicFallback(input);

  if (input.tier === "free") {
    return {
      ...fallback,
      executiveSummary: fallback.executiveSummary,
      financialRiskNarrative: fallback.financialRiskNarrative,
      "90DayStrategicFocus": fallback["90DayStrategicFocus"].slice(0, 2),
      boardLevelKPIsToTrack: fallback.boardLevelKPIsToTrack.slice(0, 2),
      recommendedInvestmentZones: fallback.recommendedInvestmentZones.slice(0, 1),
    };
  }

  try {
    const { text } = await orchestrateGenerate({
      taskType: "reasoning_planning",
      systemPrompt: buildSystemPrompt(input.tier),
      userPrompt: buildUserPrompt(input),
      temperature: 0.3,
      maxTokens: 2048,
      responseFormat: "json",
    });
    const parsed = parseJSON<StrategicBrief>(text);

    return {
      executiveSummary: parsed.executiveSummary ?? fallback.executiveSummary,
      financialRiskNarrative: parsed.financialRiskNarrative ?? fallback.financialRiskNarrative,
      operationalRiskNarrative: parsed.operationalRiskNarrative ?? fallback.operationalRiskNarrative,
      scalabilityOutlook: parsed.scalabilityOutlook ?? fallback.scalabilityOutlook,
      "90DayStrategicFocus": Array.isArray(parsed["90DayStrategicFocus"]) ? parsed["90DayStrategicFocus"] : fallback["90DayStrategicFocus"],
      boardLevelKPIsToTrack: Array.isArray(parsed.boardLevelKPIsToTrack) ? parsed.boardLevelKPIsToTrack : fallback.boardLevelKPIsToTrack,
      recommendedInvestmentZones: Array.isArray(parsed.recommendedInvestmentZones) ? parsed.recommendedInvestmentZones : fallback.recommendedInvestmentZones,
      riskIfIgnored: parsed.riskIfIgnored ?? fallback.riskIfIgnored,
      boardSlideOutline: input.tier === "enterprise" && Array.isArray(parsed.boardSlideOutline) ? parsed.boardSlideOutline : undefined,
      objectionForecast: Array.isArray(parsed.objectionForecast) ? parsed.objectionForecast : fallback.objectionForecast,
    };
  } catch {
    return fallback;
  }
}
