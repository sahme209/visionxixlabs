/**
 * Phase 524 — AGI Memory Chat (engine).
 *
 * Operator asks a free-form question about the AGI's recent reasoning;
 * Claude reads the rationale memory feed (and optionally the persisted
 * summary timeline) as context and answers, citing the entries it
 * drew from.
 *
 * Pure function: no I/O, no DB. The injected fetcher matches the same
 * shape used by the per-decision rationale enricher so the AIProviderManager
 * wiring is identical.
 *
 * Output is shape-stable across paths:
 *   • outcome="ai_generated"  → Claude answered, structured citations
 *   • outcome="fallback_rules" → deterministic "I can only see N entries…"
 *   • outcome="error"         → fetcher threw, falls back to rules
 */

import type { RationaleAiFetcher } from "./aiRationaleEnricherEngine";

export const MEMORY_CHAT_ENGINE_VERSION = "ai-memory-chat-v1.0.0";

export const CHAT_OUTCOMES = ["ai_generated", "fallback_rules", "error"] as const;
export type ChatOutcome = (typeof CHAT_OUTCOMES)[number];

/* ──────────────────────────────────────────────────────────────────
   I/O shapes.
   ────────────────────────────────────────────────────────────── */

export interface ChatContextEntry {
  /** Stable id the model can echo back as a citation token. */
  citationId: string;
  targetKind: string;
  targetId: string;
  narrative: string;
  outcome: string;
  generatedAtIso: string;
}

export interface ChatContextSummary {
  citationId: string;
  targetKind: string | null;
  narrative: string;
  generatedAtIso: string;
}

export interface ChatInput {
  question: string;
  entries: ChatContextEntry[];
  summaries: ChatContextSummary[];
}

export interface ChatAnswer {
  outcome: ChatOutcome;
  answer: string;
  /** Stable citationIds the model echoed back (filtered to ones we sent). */
  citations: string[];
  modelHint: string | null;
  errorMessage: string | null;
  engineVersion: string;
}

/* ──────────────────────────────────────────────────────────────────
   Question validation.
   ────────────────────────────────────────────────────────────── */

const MIN_QUESTION_LEN = 4;
const MAX_QUESTION_LEN = 500;

export function isValidQuestion(q: unknown): q is string {
  if (typeof q !== "string") return false;
  const t = q.trim();
  return t.length >= MIN_QUESTION_LEN && t.length <= MAX_QUESTION_LEN;
}

/* ──────────────────────────────────────────────────────────────────
   Prompt.
   ────────────────────────────────────────────────────────────── */

export function buildChatPrompt(input: ChatInput): string {
  const lines: string[] = [
    "You are answering an operator's question about an AI release-operations platform's recent reasoning.",
    "Reply with a JSON object of shape { answer, citations } where:",
    `  - answer is a SINGLE plain-English paragraph (1-5 sentences) answering the operator's question directly.`,
    `  - citations is an array of 0-10 citationId strings drawn ONLY from the entries / summaries below — never invent ids.`,
    `  - If the context is insufficient to answer, say so plainly in the answer and return an empty citations array.`,
    `  - Do NOT speculate beyond the supplied context.`,
    "",
    `Operator question: ${truncate(input.question.trim(), 500)}`,
    "",
    "Recent rationale entries (newest first):",
    ...input.entries.map((e) => `  [${e.citationId}] ${e.targetKind} · ${e.outcome} · ${e.generatedAtIso} — ${truncate(e.narrative, 220)}`),
    "",
    "Recent meta-summaries (newest first):",
    ...input.summaries.map((s) => `  [${s.citationId}] ${s.targetKind ?? "all"} · ${s.generatedAtIso} — ${truncate(s.narrative, 220)}`),
    "",
    "Respond with ONLY the JSON object. No prose before or after.",
  ];
  return lines.join("\n");
}

/* ──────────────────────────────────────────────────────────────────
   Parsing.
   ────────────────────────────────────────────────────────────── */

interface ParsedChatResponse {
  answer: string;
  citations: string[];
}

export function parseChatResponse(raw: string, validIds: Set<string>): ParsedChatResponse | null {
  const trimmed = raw.trim();
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace < 0 || lastBrace < firstBrace) return null;
  const slice = trimmed.slice(firstBrace, lastBrace + 1);
  let parsed: unknown;
  try { parsed = JSON.parse(slice); } catch { return null; }
  if (!parsed || typeof parsed !== "object") return null;
  const p = parsed as Record<string, unknown>;
  if (typeof p.answer !== "string" || p.answer.trim().length === 0) return null;
  if (!Array.isArray(p.citations)) return null;
  const citations: string[] = [];
  const seen = new Set<string>();
  for (const c of p.citations) {
    if (typeof c !== "string") continue;
    const id = c.trim();
    if (!id || seen.has(id) || !validIds.has(id)) continue;
    seen.add(id);
    citations.push(id);
    if (citations.length >= 10) break;
  }
  return {
    answer: p.answer.trim(),
    citations,
  };
}

/* ──────────────────────────────────────────────────────────────────
   Fallback.
   ────────────────────────────────────────────────────────────── */

export function buildChatFallback(input: ChatInput, reason: string): ChatAnswer {
  const parts: string[] = [];
  if (input.entries.length === 0 && input.summaries.length === 0) {
    parts.push("There's no AGI memory yet, so I can't answer questions about recent reasoning.");
    parts.push("Run any AGI engine (council / triage / remediation) to start populating memory.");
  } else {
    parts.push(`I can see ${input.entries.length} rationale entr${input.entries.length === 1 ? "y" : "ies"} and ${input.summaries.length} meta-summar${input.summaries.length === 1 ? "y" : "ies"} in memory, but I can't reason about them without the AI provider — fell back to deterministic rules.`);
    parts.push("Try the Summarize panel or scroll the memory feed directly to find what you need.");
  }
  return {
    outcome: "fallback_rules",
    answer: parts.join(" "),
    citations: [],
    modelHint: null,
    errorMessage: reason,
    engineVersion: MEMORY_CHAT_ENGINE_VERSION,
  };
}

/* ──────────────────────────────────────────────────────────────────
   Engine entrypoint.
   ────────────────────────────────────────────────────────────── */

export async function askAgiMemory(
  input: ChatInput,
  fetcher: RationaleAiFetcher | null,
): Promise<ChatAnswer> {
  if (!fetcher) {
    return buildChatFallback(input, "no_ai_fetcher_configured");
  }
  if (!isValidQuestion(input.question)) {
    return {
      ...buildChatFallback(input, "invalid_question"),
      answer: "Question is too short or too long. Please ask a question between 4 and 500 characters.",
    };
  }
  if (input.entries.length === 0 && input.summaries.length === 0) {
    return buildChatFallback(input, "empty_memory");
  }

  let raw: string;
  let modelHint: string | null = null;
  try {
    const res = await fetcher(buildChatPrompt(input));
    raw = res.text ?? "";
    modelHint = res.modelHint ?? null;
  } catch (err) {
    return {
      ...buildChatFallback(input, err instanceof Error ? err.message : "ai_fetcher_threw"),
      outcome: "error",
    };
  }
  if (!raw.trim()) {
    return buildChatFallback(input, "empty_ai_response");
  }

  const validIds = new Set<string>([
    ...input.entries.map((e) => e.citationId),
    ...input.summaries.map((s) => s.citationId),
  ]);
  const parsed = parseChatResponse(raw, validIds);
  if (!parsed) {
    return buildChatFallback(input, "unparseable_ai_response");
  }

  return {
    outcome: "ai_generated",
    answer: parsed.answer,
    citations: parsed.citations,
    modelHint,
    errorMessage: null,
    engineVersion: MEMORY_CHAT_ENGINE_VERSION,
  };
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : `${s.slice(0, n - 1)}…`;
}
