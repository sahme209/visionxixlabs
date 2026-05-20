/**
 * AI-powered decision-rationale narrator.
 *
 * The autonomy loop already produces machine-readable rationale rows
 * (decision_kind, candidate_id, support/oppose weights, dissenters,
 * boundary verdicts). For the operator UI + audit packets, a short
 * natural-language paragraph is a lot more readable. This module
 * orchestrates that translation through the free AI provider chain.
 *
 * Pure orchestration. Never throws. Falls back to a deterministic
 * template when AI is unavailable.
 */

import "server-only";
import { getAIProviderManager } from "@/lib/ai/AIProviderManager";

export interface RationaleSeed {
  decisionKind: string;          // e.g. "approve_proposal", "skip_runbook"
  candidateLabel: string;        // operator-readable candidate name
  supportWeight: number;         // 0..(n agents)
  opposeWeight: number;
  dissenters: readonly string[]; // agent names that voted against
  policyVerdict: "pass" | "fail" | "unknown";
  boundaryVerdict: "pass" | "fail" | "unknown";
}

export interface RationaleNarrative {
  paragraph: string;             // 2-4 sentences
  aiUsed: boolean;
  provider: string | null;
  model: string | null;
  latencyMs: number;
}

const SYSTEM = [
  "You translate AGI ops decision data into a 2-4 sentence operator-facing rationale.",
  "Style: factual, plain English, no marketing fluff, no emojis.",
  "Include: what was decided, the council vote weights, the policy + boundary verdicts.",
  "Never invent agents or weights beyond what the input provides.",
].join(" ");

const MAX_OUT = 500;

function templateFallback(seed: RationaleSeed): string {
  const pol = seed.policyVerdict === "pass" ? "policy passed" : seed.policyVerdict === "fail" ? "policy blocked" : "policy unknown";
  const bnd = seed.boundaryVerdict === "pass" ? "boundary passed" : seed.boundaryVerdict === "fail" ? "boundary blocked" : "boundary unknown";
  const dissenters = seed.dissenters.length > 0 ? ` Dissenters: ${seed.dissenters.join(", ")}.` : "";
  return [
    `${seed.decisionKind} for "${seed.candidateLabel}".`,
    `Council support=${seed.supportWeight} vs oppose=${seed.opposeWeight}.`,
    `${pol}; ${bnd}.${dissenters}`,
  ].join(" ");
}

export async function narrateRationale(seed: RationaleSeed): Promise<RationaleNarrative> {
  const fallback = templateFallback(seed);
  try {
    const mgr = getAIProviderManager();
    const prompt = [
      `Decision: ${seed.decisionKind}`,
      `Candidate: ${seed.candidateLabel}`,
      `Support weight: ${seed.supportWeight}`,
      `Oppose weight: ${seed.opposeWeight}`,
      `Policy gate: ${seed.policyVerdict}`,
      `Boundary gate: ${seed.boundaryVerdict}`,
      `Dissenting agents: ${seed.dissenters.length ? seed.dissenters.join(", ") : "(none)"}`,
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
