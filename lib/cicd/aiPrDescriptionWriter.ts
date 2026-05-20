/**
 * AI PR-description writer.
 *
 * Takes a list of commit summaries + an optional PR title and emits a
 * structured description (summary + test plan + risk callouts).
 * NEVER throws. Falls back to a deterministic template.
 */

import "server-only";
import { getAIProviderManager } from "@/lib/ai/AIProviderManager";

export interface PrDescriptionInput {
  title: string;
  commits: ReadonlyArray<{ sha: string; subject: string }>;
  /** Optional risk hints from prRiskScorer / lintSummary. */
  riskNotes?: readonly string[];
}

export interface PrDescriptionResult {
  body: string;          // markdown-ish, <= 1400 chars
  aiUsed: boolean;
  provider: string | null;
  model: string | null;
  latencyMs: number;
}

const SYSTEM = [
  "You write a GitHub PR description.",
  "Structure: '## Summary' (2-3 bullets), '## Test plan' (operator checklist), '## Risk' (1 short paragraph).",
  "Reply with the body markdown only. Plain English. No emojis. No marketing fluff.",
].join(" ");

const MAX_OUT = 1400;

function templateFallback(input: PrDescriptionInput): string {
  const bullets = input.commits
    .slice(0, 5)
    .map((c) => `- ${c.subject}`)
    .join("\n");
  const risk = input.riskNotes && input.riskNotes.length > 0
    ? input.riskNotes.map((r) => `- ${r}`).join("\n")
    : "- No special risk callouts.";
  return [
    `# ${input.title || "Untitled PR"}`,
    "",
    "## Summary",
    bullets || "- (no commits)",
    "",
    "## Test plan",
    "- [ ] Re-run unit tests locally.",
    "- [ ] Spot-check the affected dashboards.",
    "- [ ] Verify the deploy is Ready on Vercel.",
    "",
    "## Risk",
    risk,
  ].join("\n").slice(0, MAX_OUT);
}

export async function writePrDescription(input: PrDescriptionInput): Promise<PrDescriptionResult> {
  const fallback = templateFallback(input);
  try {
    const mgr = getAIProviderManager();
    const commitList = input.commits.map((c) => `- ${c.sha} ${c.subject}`).join("\n");
    const risk = input.riskNotes && input.riskNotes.length > 0 ? input.riskNotes.join("; ") : "(none supplied)";
    const prompt = [
      `Title: ${input.title}`,
      `Commits:`,
      commitList,
      `Risk hints: ${risk}`,
    ].join("\n");
    const r = await mgr.generateText(prompt, {
      system: SYSTEM,
      maxTokens: 4096,
      temperature: 0.3,
      timeoutMs: 15_000,
    });
    const text = (r.text ?? "").trim();
    if (!text || r.provider === "mock") {
      return { body: fallback, aiUsed: false, provider: null, model: null, latencyMs: r.latencyMs };
    }
    const clipped = text.length > MAX_OUT ? `${text.slice(0, MAX_OUT - 3)}...` : text;
    return { body: clipped, aiUsed: true, provider: r.provider, model: r.model, latencyMs: r.latencyMs };
  } catch {
    return { body: fallback, aiUsed: false, provider: null, model: null, latencyMs: 0 };
  }
}
