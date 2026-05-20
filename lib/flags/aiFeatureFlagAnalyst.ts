/**
 * AI feature-flag analyst.
 *
 * Given a list of feature flags with usage stats (rollout %, days
 * since flip, calls/day), recommend which flags should be promoted
 * (graduated) vs. retired vs. left alone. Approval-only-no-execution:
 * recommendations only; nothing toggles automatically.
 *
 * Pure orchestration. NEVER throws. Falls back to deterministic
 * rules.
 */

import "server-only";
import { getAIProviderManager } from "@/lib/ai/AIProviderManager";

export interface FeatureFlagSnapshot {
  key: string;
  rolloutPct: number;            // 0..100
  daysSinceFlip: number;
  callsPerDay: number;
  ownerTeam: string | null;
}

export interface FlagRecommendation {
  key: string;
  action: "promote" | "retire" | "leave_alone" | "investigate";
  rationale: string;
}

export interface FlagAnalysisResult {
  recommendations: FlagRecommendation[];
  aiUsed: boolean;
  provider: string | null;
  model: string | null;
  latencyMs: number;
}

const ALLOWED_ACTIONS = ["promote", "retire", "leave_alone", "investigate"] as const;

const SYSTEM = [
  "You analyze feature-flag rollouts.",
  "Allowed actions: promote, retire, leave_alone, investigate.",
  "Reply strictly as JSON: { \"recommendations\": [{ \"key\": \"<flag>\", \"action\": \"<action>\", \"rationale\": \"<= 25 words\" }] }.",
  "Never invent flag keys beyond the supplied list. Recommendations are ADVISORY.",
].join(" ");

function deterministicRecs(flags: readonly FeatureFlagSnapshot[]): FlagRecommendation[] {
  return flags.map((f) => {
    // 100% rollout for >= 30 days with traffic → promote (bake into code).
    if (f.rolloutPct >= 100 && f.daysSinceFlip >= 30 && f.callsPerDay > 0) {
      return { key: f.key, action: "promote", rationale: "fully rolled out and stable; safe to retire the flag." };
    }
    // 0% rollout for >= 30 days OR zero traffic → retire.
    if ((f.rolloutPct === 0 && f.daysSinceFlip >= 30) || f.callsPerDay === 0) {
      return { key: f.key, action: "retire", rationale: "no traffic or stuck at 0% — likely dead code." };
    }
    // Partial mid-flight rollout → investigate.
    if (f.rolloutPct > 0 && f.rolloutPct < 100 && f.daysSinceFlip >= 14) {
      return { key: f.key, action: "investigate", rationale: "mid-rollout for 2+ weeks — confirm direction." };
    }
    return { key: f.key, action: "leave_alone", rationale: "still within recent rollout window." };
  });
}

const isValidAction = (s: unknown): s is FlagRecommendation["action"] =>
  typeof s === "string" && (ALLOWED_ACTIONS as readonly string[]).includes(s);

export async function analyzeFeatureFlags(flags: readonly FeatureFlagSnapshot[]): Promise<FlagAnalysisResult> {
  const fallback: FlagAnalysisResult = {
    recommendations: deterministicRecs(flags),
    aiUsed: false, provider: null, model: null, latencyMs: 0,
  };
  if (flags.length === 0) return fallback;

  try {
    const mgr = getAIProviderManager();
    const list = flags
      .map((f) => `- ${f.key} rollout=${f.rolloutPct}% age=${f.daysSinceFlip}d calls/day=${f.callsPerDay} owner=${f.ownerTeam ?? "(none)"}`)
      .join("\n");
    const r = await mgr.extractStructuredData<{ recommendations?: unknown }>(
      list,
      `{ "recommendations": [{ "key": "string (must be one of the supplied flag keys)", "action": "promote | retire | leave_alone | investigate", "rationale": "string" }] }`,
      { system: SYSTEM, temperature: 0, maxTokens: 4096, timeoutMs: 15_000 },
    );
    if (r.provider === "mock") return { ...fallback, latencyMs: r.latencyMs };
    const arr = (r.data as { recommendations?: unknown }).recommendations;
    if (!Array.isArray(arr)) return { ...fallback, provider: r.provider, model: r.model, latencyMs: r.latencyMs };
    const keySet = new Set(flags.map((f) => f.key));
    const cleaned: FlagRecommendation[] = [];
    for (const x of arr) {
      if (!x || typeof x !== "object" || Array.isArray(x)) continue;
      const key = String((x as { key?: unknown }).key ?? "");
      const action = (x as { action?: unknown }).action;
      const rationale = String((x as { rationale?: unknown }).rationale ?? "").trim();
      if (!keySet.has(key) || !isValidAction(action) || rationale.length === 0) continue;
      cleaned.push({
        key,
        action,
        rationale: rationale.length > 220 ? `${rationale.slice(0, 217)}...` : rationale,
      });
    }
    if (cleaned.length === 0) return { ...fallback, provider: r.provider, model: r.model, latencyMs: r.latencyMs };
    return { recommendations: cleaned, aiUsed: true, provider: r.provider, model: r.model, latencyMs: r.latencyMs };
  } catch {
    return fallback;
  }
}
