/**
 * AI-powered help re-ranker.
 *
 * Given a user's natural-language query and a deterministic shortlist
 * from helpSearchEngine, ask an AI provider to pick the single best
 * match and emit a one-line operator-readable rationale. Pure
 * orchestration — never throws, falls back to the deterministic order
 * on any failure.
 *
 * Strict: the model can only choose from `candidateIds`. Hallucinated
 * ids are rejected and we fall back to the first deterministic match.
 */

import "server-only";
import { getAIProviderManager } from "@/lib/ai/AIProviderManager";

export interface RerankCandidate {
  id: string;
  title: string;
  category: string;
  /** Brief operator-readable snippet (truncated by the caller). */
  snippet: string;
}

export interface RerankResult {
  bestId: string;
  rationale: string;
  aiUsed: boolean;
  provider: string | null;
  model: string | null;
  latencyMs: number;
}

const SYSTEM = [
  "You re-rank help-doc candidates for an AGI ops platform.",
  "Pick exactly one id from the provided candidates that best answers the user's query.",
  "Reply only with strict JSON of the shape {\"bestId\": \"<id>\", \"rationale\": \"<= 18 words>\"}.",
  "Never invent ids. Never include prose outside the JSON.",
].join(" ");

const isValidJson = (s: unknown): s is { bestId?: string; rationale?: string } =>
  s !== null && typeof s === "object" && !Array.isArray(s);

export async function rerankHelpCandidates(input: {
  query: string;
  candidates: readonly RerankCandidate[];
}): Promise<RerankResult> {
  const candidates = input.candidates;
  // Deterministic fallback: first candidate from the input order.
  const fallback: RerankResult = {
    bestId: candidates[0]?.id ?? "",
    rationale: candidates[0] ? `Top deterministic match (${candidates[0].title}).` : "No candidates supplied.",
    aiUsed: false,
    provider: null,
    model: null,
    latencyMs: 0,
  };
  if (candidates.length === 0) return fallback;

  try {
    const mgr = getAIProviderManager();
    const list = candidates
      .map((c, i) => `${i + 1}. id=${c.id} | category=${c.category} | title=${c.title}\n   ${c.snippet}`)
      .join("\n");
    const prompt = `User query:\n${input.query}\n\nCandidates:\n${list}`;
    const r = await mgr.extractStructuredData<{ bestId?: string; rationale?: string }>(
      prompt,
      `{ "bestId": "string (must be one of the candidate ids)", "rationale": "string, 18 words max" }`,
      { system: SYSTEM, temperature: 0, maxTokens: 4096, timeoutMs: 10_000 },
    );
    if (r.provider === "mock" || !isValidJson(r.data)) return fallback;
    const bestId = String(r.data.bestId ?? "");
    if (!candidates.some((c) => c.id === bestId)) return fallback;
    const rationale = String(r.data.rationale ?? "").trim() || "AI picked best contextual match.";
    return {
      bestId,
      rationale: rationale.length > 200 ? `${rationale.slice(0, 197)}...` : rationale,
      aiUsed: true,
      provider: r.provider,
      model: r.model,
      latencyMs: r.latencyMs,
    };
  } catch {
    return fallback;
  }
}
