/**
 * Vitest unit tests for the AI compliance Q&A fallback path.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { answerComplianceQuestion, type QaCapabilityRow } from "../aiComplianceQa";
import { _resetAIProviderManagerForTests } from "@/lib/ai/AIProviderManager";

const ROWS: QaCapabilityRow[] = [
  { id: "enc.at_rest", capability: "All Postgres data encrypted at rest via Neon-managed keys.", evidence: "ops/db/encryption.md" },
  { id: "audit.bus", capability: "Agent message bus persists every published message via Prisma audit row.", evidence: "lib/agents/agentBus.ts" },
  { id: "ai.no_keys_logged", capability: "AI usage logger NEVER records API keys, tokens, or prompts.", evidence: "lib/ai/AIUsageLogger.ts" },
];

describe("aiComplianceQa", () => {
  beforeEach(() => {
    delete process.env.GITHUB_TOKEN;
    delete process.env.GROQ_API_KEY;
    delete process.env.GEMINI_API_KEY;
    delete process.env.HUGGINGFACE_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.CLOUDFLARE_ACCOUNT_ID;
    delete process.env.CLOUDFLARE_API_TOKEN;
    process.env.OLLAMA_BASE_URL = "http://127.0.0.1:1";
    process.env.LM_STUDIO_BASE_URL = "http://127.0.0.1:2";
    _resetAIProviderManagerForTests();
  });

  it("Mock-only fall-through cites the keyword-matching rows", async () => {
    const r = await answerComplianceQuestion({
      question: "Are Postgres records encrypted at rest?",
      rows: ROWS,
    });
    expect(r.aiUsed).toBe(false);
    expect(r.citedIds).toContain("enc.at_rest");
  }, 60_000);

  it("returns 'no exact matches' when nothing keyword-overlaps", async () => {
    const r = await answerComplianceQuestion({
      question: "Do you ship physical hardware?",
      rows: ROWS,
    });
    expect(r.citedIds).toEqual([]);
    expect(r.text.toLowerCase()).toContain("no exact matches");
  }, 60_000);

  it("empty rows → fallback never throws", async () => {
    const r = await answerComplianceQuestion({ question: "x", rows: [] });
    expect(r.aiUsed).toBe(false);
    expect(r.citedIds).toEqual([]);
  });

  it("citedIds always come from the supplied row list", async () => {
    const r = await answerComplianceQuestion({
      question: "Do you log secrets in AI usage?",
      rows: ROWS,
    });
    const ids = new Set(ROWS.map((row) => row.id));
    for (const c of r.citedIds) expect(ids.has(c)).toBe(true);
  }, 60_000);
});
