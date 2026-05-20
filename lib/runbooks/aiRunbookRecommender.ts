/**
 * AI runbook recommender.
 *
 * Given a problem statement + a catalog of available runbook ids, ask
 * the AI provider to recommend ONE id from the catalog with a one-line
 * rationale. The recommender REJECTS hallucinated ids and falls back
 * to the first catalog entry.
 *
 * Pure orchestration. NEVER throws. Approval-only-no-execution —
 * the recommendation is just a suggestion; nothing runs.
 */

import "server-only";
import { getAIProviderManager } from "@/lib/ai/AIProviderManager";

export interface RunbookCandidate {
  id: string;
  title: string;
  category: "incident_response" | "remediation" | "rollout" | "compliance";
  description: string;       // <= 200 chars
}

export interface RunbookRecommendation {
  bestId: string;
  rationale: string;
  aiUsed: boolean;
  provider: string | null;
  model: string | null;
  latencyMs: number;
  rejectionReason?: string;
}

const SYSTEM = [
  "You recommend ONE runbook from the supplied catalog that best fits the operator's problem.",
  "Reply strictly as JSON: { \"bestId\": \"<one of the catalog ids>\", \"rationale\": \"<= 25 words\" }.",
  "Never invent ids. Never include prose outside the JSON.",
  "Mention that the runbook is a SUGGESTION — runbooks are not auto-executed.",
].join(" ");

export async function recommendRunbook(input: {
  problem: string;
  catalog: readonly RunbookCandidate[];
}): Promise<RunbookRecommendation> {
  const fallback: RunbookRecommendation = {
    bestId: input.catalog[0]?.id ?? "",
    rationale: input.catalog[0] ? `Top deterministic match (${input.catalog[0].title}).` : "No runbooks supplied.",
    aiUsed: false,
    provider: null,
    model: null,
    latencyMs: 0,
  };
  if (input.catalog.length === 0) return fallback;

  try {
    const mgr = getAIProviderManager();
    const list = input.catalog
      .map((c, i) => `${i + 1}. id=${c.id} | ${c.category} | ${c.title}\n   ${c.description.slice(0, 200)}`)
      .join("\n");
    const prompt = `Problem:\n${input.problem}\n\nCatalog:\n${list}`;
    const r = await mgr.extractStructuredData<{ bestId?: string; rationale?: string }>(
      prompt,
      `{ "bestId": "string (must be one of the catalog ids)", "rationale": "string, 25 words max" }`,
      { system: SYSTEM, temperature: 0, maxTokens: 4096, timeoutMs: 12_000 },
    );
    if (r.provider === "mock") {
      return { ...fallback, latencyMs: r.latencyMs };
    }
    const bestId = String(r.data?.bestId ?? "");
    if (!input.catalog.some((c) => c.id === bestId)) {
      return { ...fallback, provider: r.provider, model: r.model, latencyMs: r.latencyMs, rejectionReason: "model_returned_unknown_id" };
    }
    const rationale = String(r.data?.rationale ?? "").trim() || "AI picked best contextual match (advisory).";
    return {
      bestId,
      rationale: rationale.length > 240 ? `${rationale.slice(0, 237)}...` : rationale,
      aiUsed: true,
      provider: r.provider,
      model: r.model,
      latencyMs: r.latencyMs,
    };
  } catch {
    return { ...fallback, rejectionReason: "provider_threw" };
  }
}
