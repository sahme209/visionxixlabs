/**
 * AI "explain this" — operator-facing natural-language explanation of
 * a finding, resource, alert, or runbook step. Used by the help system
 * and the ops cockpit's "?" affordances.
 *
 * Best-effort: NEVER throws. Falls back to a template when AI is
 * unavailable. Capped output length so it can fit in a tooltip.
 */

import "server-only";
import { getAIProviderManager } from "@/lib/ai/AIProviderManager";

export interface ExplainInput {
  /** Closed union of supported subjects so prompts are predictable. */
  kind: "security_finding" | "cloud_resource" | "alert" | "runbook_step" | "control" | "metric";
  /** Short label of the thing being explained. */
  label: string;
  /** Operator-readable context (<= 1000 chars). */
  context?: string;
  /** Audience — tightens the prompt. Default 'operator'. */
  audience?: "operator" | "executive" | "engineer";
}

export interface ExplainResult {
  text: string;
  aiUsed: boolean;
  provider: string | null;
  model: string | null;
  latencyMs: number;
}

const SYSTEM_OPERATOR = "You explain ops platform concepts to an operator. 2-3 sentences. Plain English. No emojis. No marketing fluff.";
const SYSTEM_EXEC = "You explain ops platform concepts to an executive. 1-2 sentences. Plain English. Avoid jargon.";
const SYSTEM_ENG = "You explain ops platform concepts to a senior engineer. 2-3 sentences. Precise, but no code snippets.";

const MAX_OUT = 500;

function templateFallback(input: ExplainInput): string {
  const audience = input.audience ?? "operator";
  return `[${input.kind}] ${input.label}${input.context ? `\n${input.context.slice(0, 200)}` : ""}\n(AI fallback for ${audience} — provider unavailable)`;
}

export async function explainSubject(input: ExplainInput): Promise<ExplainResult> {
  const fallback = templateFallback(input);
  try {
    const mgr = getAIProviderManager();
    const aud = input.audience ?? "operator";
    const system = aud === "executive" ? SYSTEM_EXEC : aud === "engineer" ? SYSTEM_ENG : SYSTEM_OPERATOR;
    const prompt = [
      `Subject kind: ${input.kind}`,
      `Subject label: ${input.label}`,
      input.context ? `Context: ${input.context.slice(0, 1000)}` : "Context: (none)",
    ].join("\n");
    const r = await mgr.generateText(prompt, {
      system,
      maxTokens: 4096,
      temperature: 0.3,
      timeoutMs: 10_000,
    });
    const text = (r.text ?? "").trim();
    if (!text || r.provider === "mock") {
      return { text: fallback, aiUsed: false, provider: null, model: null, latencyMs: r.latencyMs };
    }
    const clipped = text.length > MAX_OUT ? `${text.slice(0, MAX_OUT - 3)}...` : text;
    return { text: clipped, aiUsed: true, provider: r.provider, model: r.model, latencyMs: r.latencyMs };
  } catch {
    return { text: fallback, aiUsed: false, provider: null, model: null, latencyMs: 0 };
  }
}
