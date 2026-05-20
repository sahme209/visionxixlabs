/**
 * AI postmortem drafter.
 *
 * Operators provide a structured incident summary + a list of events
 * + impact + root-cause hint. The drafter emits a blameless
 * postmortem skeleton (summary / timeline / impact / root cause /
 * action items). NEVER throws. Falls back to a deterministic
 * template.
 */

import "server-only";
import { getAIProviderManager } from "@/lib/ai/AIProviderManager";

export interface PostmortemSeed {
  title: string;                       // "checkout-api p95 spike 2026-05-20"
  startedAtIso: string;
  resolvedAtIso: string;
  impactSummary: string;               // <= 500 chars
  timeline: ReadonlyArray<{ tsIso: string; summary: string }>;
  rootCauseHint?: string;
  affectedServices: readonly string[];
}

export interface PostmortemResult {
  body: string;                        // markdown, <= 2400 chars
  aiUsed: boolean;
  provider: string | null;
  model: string | null;
  latencyMs: number;
}

const SYSTEM = [
  "You draft a BLAMELESS incident postmortem.",
  "Style: factual, no individual blame, no emojis, no marketing.",
  "Structure: '## Summary' (1-2 sentences), '## Timeline' (bullets, UTC ISO), '## Impact' (paragraph),",
  "'## Root cause' (paragraph), '## Action items' (- [ ] tasks).",
  "Reply with the markdown body only.",
].join(" ");

const MAX_OUT = 2400;

function templateFallback(seed: PostmortemSeed): string {
  const tl = seed.timeline.map((e) => `- ${e.tsIso} — ${e.summary}`).join("\n");
  return [
    `# ${seed.title}`,
    "",
    "## Summary",
    `Incident ran from ${seed.startedAtIso} to ${seed.resolvedAtIso}. Affected: ${seed.affectedServices.join(", ") || "(none recorded)"}.`,
    "",
    "## Timeline",
    tl || "- (no events recorded)",
    "",
    "## Impact",
    seed.impactSummary || "(impact summary not supplied)",
    "",
    "## Root cause",
    seed.rootCauseHint || "Root cause analysis pending operator review.",
    "",
    "## Action items",
    "- [ ] Confirm the root cause is fully understood.",
    "- [ ] File or update any runbooks that would have shortened MTTR.",
    "- [ ] Add a regression check (alert / test / dashboard).",
  ].join("\n").slice(0, MAX_OUT);
}

export async function draftPostmortem(seed: PostmortemSeed): Promise<PostmortemResult> {
  const fallback = templateFallback(seed);
  try {
    const mgr = getAIProviderManager();
    const tl = seed.timeline.map((e) => `- ${e.tsIso}: ${e.summary}`).join("\n");
    const prompt = [
      `Title: ${seed.title}`,
      `Window: ${seed.startedAtIso} → ${seed.resolvedAtIso}`,
      `Affected services: ${seed.affectedServices.join(", ") || "(none)"}`,
      `Impact: ${seed.impactSummary}`,
      `Root-cause hint: ${seed.rootCauseHint ?? "(none)"}`,
      `Timeline:`,
      tl || "(none)",
    ].join("\n");
    const r = await mgr.generateText(prompt, {
      system: SYSTEM,
      maxTokens: 4096,
      temperature: 0.3,
      timeoutMs: 20_000,
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
