/**
 * AI rollback narrator.
 *
 * Wraps the deterministic decideAutoRollback output in a 2-3 sentence
 * operator-facing summary explaining WHY we are recommending the
 * rollback and which signals drove the verdict. NEVER throws; falls
 * back to a one-line template.
 */

import "server-only";
import { getAIProviderManager } from "@/lib/ai/AIProviderManager";
import type { RollbackRecommendation } from "./autoRollbackDecider";

export interface RollbackNarrativeInput {
  service: string;
  rec: RollbackRecommendation;
  /** Minutes since deploy at time of evaluation. */
  minutesSinceDeploy: number;
}

export interface RollbackNarrative {
  paragraph: string;
  aiUsed: boolean;
  provider: string | null;
  model: string | null;
  latencyMs: number;
}

const SYSTEM = [
  "You summarize an auto-rollback recommendation for an AGI ops operator.",
  "2-3 sentences. Plain English. No emojis.",
  "Mention the verdict, the service, the supplied reasons, and that the rollback is an ADVISORY only — operators approve.",
  "Never invent reasons beyond the supplied list.",
].join(" ");

const MAX_OUT = 600;

function templateFallback(input: RollbackNarrativeInput): string {
  const verdict = input.rec.verdict.replace("_", " ");
  const reasons = input.rec.reasons.length === 0 ? "no signals tripped" : input.rec.reasons.join("; ");
  return `${verdict} for ${input.service} (${input.minutesSinceDeploy}m post-deploy). Reasons: ${reasons}. Advisory only — operator approves.`;
}

export async function narrateRollbackDecision(input: RollbackNarrativeInput): Promise<RollbackNarrative> {
  const fallback = templateFallback(input);
  try {
    const mgr = getAIProviderManager();
    const prompt = [
      `Service: ${input.service}`,
      `Verdict: ${input.rec.verdict}`,
      `Confidence: ${input.rec.confidence.toFixed(2)}`,
      `Minutes since deploy: ${input.minutesSinceDeploy}`,
      `Signals: ${input.rec.reasons.length === 0 ? "(none)" : input.rec.reasons.join("; ")}`,
    ].join("\n");
    const r = await mgr.generateText(prompt, {
      system: SYSTEM,
      maxTokens: 4096,
      temperature: 0.3,
      timeoutMs: 10_000,
    });
    const text = (r.text ?? "").trim();
    if (!text || r.provider === "mock") {
      return { paragraph: fallback, aiUsed: false, provider: null, model: null, latencyMs: r.latencyMs };
    }
    const paragraph = text.length > MAX_OUT ? `${text.slice(0, MAX_OUT - 3)}...` : text;
    return { paragraph, aiUsed: true, provider: r.provider, model: r.model, latencyMs: r.latencyMs };
  } catch {
    return { paragraph: fallback, aiUsed: false, provider: null, model: null, latencyMs: 0 };
  }
}
