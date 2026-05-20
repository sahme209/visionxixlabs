/**
 * AI compliance Q&A.
 *
 * Operator types a compliance / audit question (e.g. "do you encrypt
 * data at rest?") and we send it to the AI manager along with a
 * pre-fetched list of relevant validation-matrix capability rows.
 * Output is constrained: the model must cite at least one row id
 * from the supplied list. Hallucinated ids are rejected.
 *
 * Pure orchestration. NEVER throws. Falls back to a deterministic
 * answer that lists the top matching rows by simple keyword overlap.
 */

import "server-only";
import { getAIProviderManager } from "@/lib/ai/AIProviderManager";

export interface QaCapabilityRow {
  id: string;
  capability: string;
  evidence: string;
}

export interface QaAnswer {
  text: string;
  citedIds: string[];
  aiUsed: boolean;
  provider: string | null;
  model: string | null;
  latencyMs: number;
  rejectionReason?: string;
}

const SYSTEM = [
  "You are an AGI ops platform's compliance Q&A assistant.",
  "Answer the operator's question in 2-4 sentences using ONLY the supplied capability rows.",
  "Reply strictly as JSON: { \"text\": \"<= 600 chars\", \"citedIds\": [\"row.id\", ...] }.",
  "Every cited id must appear in the supplied list. Never invent ids. Never include prose outside the JSON.",
].join(" ");

const MAX_OUT = 600;

function deterministicAnswer(question: string, rows: readonly QaCapabilityRow[]): QaAnswer {
  const q = question.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
  const scored = rows.map((r) => {
    const text = `${r.capability} ${r.evidence}`.toLowerCase();
    let overlap = 0;
    for (const w of q) if (text.includes(w)) overlap += 1;
    return { row: r, overlap };
  });
  scored.sort((a, b) => b.overlap - a.overlap);
  const top = scored.slice(0, 3).filter((s) => s.overlap > 0);
  if (top.length === 0) {
    return {
      text: `No exact matches in the validation matrix for: "${question.slice(0, 80)}". Try /dashboard/help or contact compliance@ for follow-up.`,
      citedIds: [],
      aiUsed: false, provider: null, model: null, latencyMs: 0,
    };
  }
  const summary = top.map((s) => `${s.row.id}: ${s.row.capability.slice(0, 100)}…`).join(" | ");
  return {
    text: `Top matching capabilities for your question: ${summary}`.slice(0, MAX_OUT),
    citedIds: top.map((s) => s.row.id),
    aiUsed: false, provider: null, model: null, latencyMs: 0,
  };
}

export async function answerComplianceQuestion(input: {
  question: string;
  rows: readonly QaCapabilityRow[];
}): Promise<QaAnswer> {
  const fallback = deterministicAnswer(input.question, input.rows);
  if (input.rows.length === 0) return fallback;
  try {
    const mgr = getAIProviderManager();
    const ctx = input.rows.slice(0, 30).map((r) => `- ${r.id}: ${r.capability.slice(0, 200)}`).join("\n");
    const prompt = `Question:\n${input.question}\n\nCapability rows (only cite ids from this list):\n${ctx}`;
    const r = await mgr.extractStructuredData<{ text?: string; citedIds?: unknown }>(
      prompt,
      `{ "text": "string, 600 chars max", "citedIds": ["string (must be one of the supplied ids)"] }`,
      { system: SYSTEM, temperature: 0, maxTokens: 4096, timeoutMs: 12_000 },
    );
    if (r.provider === "mock") return { ...fallback, latencyMs: r.latencyMs };
    const text = String(r.data?.text ?? "").trim();
    const citedRaw = (r.data as { citedIds?: unknown }).citedIds;
    if (text.length === 0 || !Array.isArray(citedRaw)) {
      return { ...fallback, provider: r.provider, model: r.model, latencyMs: r.latencyMs, rejectionReason: "invalid_shape" };
    }
    const idSet = new Set(input.rows.map((row) => row.id));
    const cited = (citedRaw as unknown[]).filter((c): c is string => typeof c === "string" && idSet.has(c));
    if (cited.length === 0) {
      return { ...fallback, provider: r.provider, model: r.model, latencyMs: r.latencyMs, rejectionReason: "no_valid_citations" };
    }
    return {
      text: text.length > MAX_OUT ? `${text.slice(0, MAX_OUT - 3)}...` : text,
      citedIds: cited.slice(0, 5),
      aiUsed: true,
      provider: r.provider,
      model: r.model,
      latencyMs: r.latencyMs,
    };
  } catch {
    return { ...fallback, rejectionReason: "provider_threw" };
  }
}
