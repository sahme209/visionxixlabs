/**
 * AI release-note generator.
 *
 * Given a list of merged commits + the linked issue refs, draft a
 * 3-5 bullet release note for the operator. Never throws. Falls back
 * to deterministic 1-bullet-per-commit when AI is unavailable.
 */

import "server-only";
import { getAIProviderManager } from "@/lib/ai/AIProviderManager";

export interface CommitSummary {
  sha: string;             // short
  subject: string;         // first line of commit
  area?: string | null;    // optional area tag like "security" / "billing"
  prNumber?: number | null;
}

export interface ReleaseNoteResult {
  bullets: string[];       // operator-readable, max 5
  aiUsed: boolean;
  provider: string | null;
  model: string | null;
  latencyMs: number;
}

const SYSTEM = [
  "You summarize a list of merged commits into 3-5 release-note bullets.",
  "Style: factual, customer-facing, no emojis, no marketing fluff.",
  "Group by area when possible. Reference PR numbers in parentheses when supplied.",
  "Reply strictly as JSON: { \"bullets\": [\"...\", \"...\"] }.",
  "Never invent commits beyond the supplied list.",
].join(" ");

function templateFallback(commits: readonly CommitSummary[]): string[] {
  return commits.slice(0, 5).map((c) => {
    const tag = c.area ? `[${c.area}] ` : "";
    const pr = c.prNumber ? ` (#${c.prNumber})` : "";
    return `${tag}${c.subject}${pr}`;
  });
}

export async function generateReleaseNotes(commits: readonly CommitSummary[]): Promise<ReleaseNoteResult> {
  const fallback: ReleaseNoteResult = {
    bullets: templateFallback(commits),
    aiUsed: false, provider: null, model: null, latencyMs: 0,
  };
  if (commits.length === 0) return fallback;

  try {
    const mgr = getAIProviderManager();
    const commitList = commits
      .map((c) => `- ${c.sha} ${c.area ? `[${c.area}] ` : ""}${c.subject}${c.prNumber ? ` (#${c.prNumber})` : ""}`)
      .join("\n");
    const r = await mgr.extractStructuredData<{ bullets?: unknown }>(
      commitList,
      `{ "bullets": ["string, <= 140 chars each"] }`,
      { system: SYSTEM, temperature: 0.2, maxTokens: 4096, timeoutMs: 12_000 },
    );
    if (r.provider === "mock") return { ...fallback, latencyMs: r.latencyMs };
    const arr = (r.data as { bullets?: unknown }).bullets;
    if (!Array.isArray(arr)) return { ...fallback, provider: r.provider, model: r.model, latencyMs: r.latencyMs };
    const cleaned = (arr as unknown[])
      .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
      .map((s) => (s.length > 200 ? `${s.slice(0, 197)}...` : s))
      .slice(0, 5);
    if (cleaned.length === 0) return { ...fallback, provider: r.provider, model: r.model, latencyMs: r.latencyMs };
    return { bullets: cleaned, aiUsed: true, provider: r.provider, model: r.model, latencyMs: r.latencyMs };
  } catch {
    return fallback;
  }
}
