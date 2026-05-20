/**
 * Tenant insights synthesizer.
 *
 * Takes a digest of the tenant's recent activity (proposals decided,
 * outbound failure rate, autonomy cycles, dissent count) and produces
 * a 3-5 sentence operator-facing summary via the AI manager. Best-
 * effort: deterministic template on AI failure.
 *
 * The input is intentionally aggregate (no raw events) so the prompt
 * stays small AND we never accidentally send tenant prompts/secrets to
 * the model.
 */

import "server-only";
import { getAIProviderManager } from "@/lib/ai/AIProviderManager";

export interface InsightsSeed {
  tenantId: string;
  windowDays: number;             // e.g. 7
  proposalsDecided: number;
  proposalsApproved: number;
  proposalsApplied: number;
  proposalsRejected: number;
  autonomyCycles: number;
  outboundSends: number;
  outboundFailures: number;
  dissentCount: number;           // total council dissenters in window
  topAuthorAgent: string | null;  // most active improver agent name
}

export interface InsightsNarrative {
  paragraph: string;
  aiUsed: boolean;
  provider: string | null;
  model: string | null;
  latencyMs: number;
}

const SYSTEM = [
  "You write a 3-5 sentence operator-facing summary of an AGI ops tenant's last week.",
  "Style: factual, plain English, no marketing, no emojis.",
  "Mention the proposal funnel (decided / approved / applied / rejected), outbound success ratio, autonomy throughput, and any notable dissent.",
  "Never invent numbers beyond the input.",
].join(" ");

const MAX_OUT = 700;

function templateFallback(s: InsightsSeed): string {
  const outboundRatio = s.outboundSends === 0 ? "no outbound sends" : `${s.outboundSends - s.outboundFailures}/${s.outboundSends} sends ok`;
  const topAuthor = s.topAuthorAgent ? ` Most active improver: ${s.topAuthorAgent}.` : "";
  return [
    `Last ${s.windowDays} day(s): ${s.proposalsDecided} proposal(s) decided`,
    `(${s.proposalsApproved} approved, ${s.proposalsApplied} applied, ${s.proposalsRejected} rejected).`,
    `${s.autonomyCycles} autonomy cycle(s). ${outboundRatio}.`,
    `${s.dissentCount} council dissenter(s) recorded.${topAuthor}`,
  ].join(" ");
}

export async function synthesizeInsights(seed: InsightsSeed): Promise<InsightsNarrative> {
  const fallback = templateFallback(seed);
  try {
    const mgr = getAIProviderManager();
    const prompt = [
      `Tenant id: ${seed.tenantId}`,
      `Window: last ${seed.windowDays} day(s)`,
      `Proposals decided: ${seed.proposalsDecided}`,
      `Proposals approved: ${seed.proposalsApproved}`,
      `Proposals applied: ${seed.proposalsApplied}`,
      `Proposals rejected: ${seed.proposalsRejected}`,
      `Autonomy cycles: ${seed.autonomyCycles}`,
      `Outbound sends: ${seed.outboundSends}`,
      `Outbound failures: ${seed.outboundFailures}`,
      `Council dissent count: ${seed.dissentCount}`,
      `Top improver agent: ${seed.topAuthorAgent ?? "(none)"}`,
    ].join("\n");
    const r = await mgr.generateText(prompt, {
      system: SYSTEM,
      maxTokens: 4096,
      temperature: 0.3,
      timeoutMs: 15_000,
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
