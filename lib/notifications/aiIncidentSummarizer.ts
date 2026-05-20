/**
 * AI-powered incident summarizer.
 *
 * Outbound notifications today render a fixed `headline` + optional
 * `detail` from a deterministic template. This module offers an
 * optional AI-rewritten short summary intended for Slack/Teams
 * pre-text. It is best-effort: any failure (provider down, mock
 * fallback, parse error) returns the original headline unchanged.
 *
 * Pure orchestration around the AI subsystem — never throws.
 */

import "server-only";
import { getAIProviderManager } from "@/lib/ai/AIProviderManager";

export interface IncidentSummarizeInput {
  /** Original event headline (e.g. "Approval packet ready"). */
  headline: string;
  /** Operator-readable detail/context that the model can compress. */
  detail?: string;
  /** Caller-supplied severity hint. */
  severity?: "low" | "medium" | "high" | "critical";
  /** Optional correlation id surfaced to the usage logger. */
  correlationId?: string;
}

export interface IncidentSummarizeResult {
  /** Final pre-text to show. Always safe to use, even on failure. */
  summary: string;
  /** True iff an AI provider returned a non-empty rewritten summary. */
  aiUsed: boolean;
  /** Provider that answered, or null when AI wasn't used. */
  provider: string | null;
  model: string | null;
  latencyMs: number;
}

const SYSTEM_PROMPT = [
  "You write one-sentence operator-facing incident summaries for Slack/Teams.",
  "Style: factual, 18 words max, no emojis, no exclamation points.",
  "Start with the severity word in [brackets] when supplied.",
  "Never invent facts beyond what the input provides.",
].join(" ");

const MAX_OUT = 240;

const isNonMockProvider = (provider: string | null): boolean =>
  provider !== null && provider !== "mock";

function clipFallback(input: IncidentSummarizeInput): string {
  const sev = input.severity ? `[${input.severity.toUpperCase()}] ` : "";
  const base = input.detail ? `${input.headline} — ${input.detail}` : input.headline;
  const clipped = base.length > MAX_OUT ? `${base.slice(0, MAX_OUT - 3)}...` : base;
  return `${sev}${clipped}`;
}

export async function summarizeIncident(input: IncidentSummarizeInput): Promise<IncidentSummarizeResult> {
  const fallback = clipFallback(input);
  try {
    const mgr = getAIProviderManager();
    const sev = input.severity ? `[${input.severity.toUpperCase()}] ` : "";
    const prompt = `${sev}${input.headline}${input.detail ? `\n\nContext:\n${input.detail}` : ""}`;
    const r = await mgr.generateText(prompt, {
      system: SYSTEM_PROMPT,
      maxTokens: 4096,        // 2.5-flash needs room for thinking
      temperature: 0.2,
      timeoutMs: 8_000,
      correlationId: input.correlationId,
    });
    const text = (r.text ?? "").trim();
    if (!text || !isNonMockProvider(r.provider)) {
      return { summary: fallback, aiUsed: false, provider: null, model: null, latencyMs: r.latencyMs };
    }
    // Clip overlong AI responses (some providers ignore maxTokens).
    const summary = text.length > MAX_OUT ? `${text.slice(0, MAX_OUT - 3)}...` : text;
    return { summary, aiUsed: true, provider: r.provider, model: r.model, latencyMs: r.latencyMs };
  } catch {
    return { summary: fallback, aiUsed: false, provider: null, model: null, latencyMs: 0 };
  }
}
