/**
 * Hallucination + brand-safety pass.
 *
 * Secondary Claude call that scores a draft 0..1 on "would a careful
 * brand manager approve this?" — independent of the generator. Catches:
 *   - feature claims for things we haven't shipped
 *   - overpromises like "fully replaces engineers"
 *   - fake customer names or fabricated stats
 *   - mentions of competitors that read as bashing
 *   - autonomous-production-change promises (against our brand stance)
 *
 * Returns a structured score + notes so the autopilot can decide whether
 * to auto-publish or queue for review.
 *
 * Falls back to a deterministic neutral 0.5 when ANTHROPIC_API_KEY is
 * missing — so the autopilot can still run in dev but won't auto-publish.
 */

import "server-only";

import type { ContentTopicCategory } from "./growthModels";

export interface HallucinationCheckInput {
  body: string;
  category: ContentTopicCategory;
}

export type HallucinationCheckResult =
  | { kind: "ok"; score: number; notes: string; flags: readonly string[] }
  | { kind: "disabled"; reason: string; score: 0.5; notes: string; flags: [] }
  | { kind: "error"; message: string; score: 0; notes: string; flags: [] };

const SYSTEM_PROMPT = `You are a careful, slightly cynical B2B brand manager reviewing a draft LinkedIn post for VisionXIXLabs.

VisionXIXLabs is an AI cloud-operations platform with these brand stances:
- AI ASSISTS humans; humans approve every production change. Approval-only-no-execution.
- We do NOT promise "fully replaces engineers", AGI, or autonomous production changes.
- We do NOT have named paying customers yet — never fabricate one.
- Concrete claims must be plausible. Numbers (% savings, MTTR, etc.) should be order-of-magnitude reasonable, not specific accounts we can't back up.
- Competitors (Datadog, PagerDuty, etc.) can be referenced respectfully if at all, never bashed.

You score 0..1 on "would I approve this for our Company Page TODAY without edits?"
- 1.0 = ship as-is, on-brand, accurate, useful
- 0.85+ = strong, safe to auto-publish
- 0.5..0.85 = directionally fine but needs a human eye
- < 0.5 = problematic — fabrication, overpromise, off-brand, or just weak

Return ONLY JSON: {"score": <0..1>, "notes": "<one sentence>", "flags": ["<short tag>", ...]}
Flags are short tags like: "fabricated-customer", "overpromise", "weak-hook", "off-brand", "claims-unshipped-feature".
`;

export async function checkHallucination(input: HallucinationCheckInput): Promise<HallucinationCheckResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    return {
      kind: "disabled",
      reason: "ANTHROPIC_API_KEY not set",
      score: 0.5,
      notes: "Hallucination check disabled — neutral score returned. Autopilot will NOT auto-publish without a real score.",
      flags: [],
    };
  }

  try {
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const client = new Anthropic({ apiKey });

    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      system: SYSTEM_PROMPT,
      messages: [{
        role: "user",
        content: `Category: ${input.category}\n\nDraft body:\n---\n${input.body}\n---\n\nReturn the JSON only.`,
      }],
    });

    const block = response.content.find((b) => b.type === "text");
    const text = block && "text" in block ? block.text : "";
    const parsed = parseScore(text);
    return { kind: "ok", ...parsed };
  } catch (err) {
    return {
      kind: "error",
      message: err instanceof Error ? err.message : String(err),
      score: 0,
      notes: "Hallucination check threw — refusing to auto-publish.",
      flags: [],
    };
  }
}

function parseScore(text: string): { score: number; notes: string; flags: readonly string[] } {
  const trimmed = text.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try {
      const json = JSON.parse(trimmed.slice(start, end + 1)) as {
        score?: number; notes?: string; flags?: string[];
      };
      const score = typeof json.score === "number" ? clamp01(json.score) : 0;
      const notes = (json.notes ?? "").slice(0, 280);
      const flags = Array.isArray(json.flags) ? json.flags.slice(0, 10).map((f) => String(f).slice(0, 40)) : [];
      return { score, notes, flags };
    } catch {
      // Fall through to default.
    }
  }
  return { score: 0, notes: "Brand check returned unparseable response — refusing to auto-publish.", flags: [] };
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}
