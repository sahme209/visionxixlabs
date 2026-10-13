/**
 * Internal content planner.
 *
 * Pure module: given a target date + channel, produces typed
 * ContentIdea + SocialPostDraft objects (in-memory). All inference is routed
 * through Vercel AI Gateway. Missing configuration fails explicitly.
 *
 * Internal only. Drafts NEVER leave this process without an explicit
 * PublishingApproval downstream.
 */

import "server-only";
import { getAIProviderManager } from "@/lib/ai/AIProviderManager";

import type {
  ContentIdea,
  ContentTopicCategory,
  SocialChannel,
  SocialPostDraft,
} from "./growthModels";

interface PlannerInput {
  channel: SocialChannel;
  category: ContentTopicCategory;
  /** What we want the post to be about — operator hint. */
  topicHint?: string;
  /** Maximum number of drafts to produce. */
  maxDrafts?: number;
}

export interface PlannerOutput {
  ideas: readonly ContentIdea[];
  drafts: readonly SocialPostDraft[];
  /** Always true for successful results; retained for UI compatibility. */
  usedLlm: boolean;
}

const DEFAULT_HASHTAGS: Record<SocialChannel, readonly string[]> = {
  linkedin: ["#CloudOps", "#DevOps", "#AIAgents", "#PlatformEngineering", "#VisionXIXLabs"],
  x:        ["#AGI", "#CloudOps", "#DevOps", "#Engineering"],
  blog:     [],
  website:  [],
  newsletter: [],
  youtube_short: [],
};

const SAFE_CTAS: Readonly<Record<SocialChannel, string>> = {
  linkedin: "Wire your cloud once → let agents do the heavy lifting. → visionxixlabs.com",
  x:        "Try VisionXIXLabs → visionxixlabs.com",
  blog:     "Read more on the VisionXIXLabs blog.",
  website:  "Start your workspace →",
  newsletter: "Subscribe for weekly cloud ops insights.",
  youtube_short: "Subscribe for more →",
};

export async function planContent(input: PlannerInput): Promise<PlannerOutput> {
  const max = Math.max(1, Math.min(input.maxDrafts ?? 3, 10));
  const hashtags = DEFAULT_HASHTAGS[input.channel];
  const manager = getAIProviderManager();

  if (!manager.isServiceProviderAvailable("vercel_gateway")) {
    throw new Error("Vercel AI Gateway is not configured.");
  }

  // Generate a fresh idea + post for each requested draft.
  try {
      const ideas: ContentIdea[] = [];
      const drafts: SocialPostDraft[] = [];

      for (let i = 0; i < max; i++) {
        const prompt = buildPrompt(input.channel, input.category, input.topicHint, i);
        const response = await manager.generateText(prompt, {
          only: "vercel_gateway", maxTokens: 600, temperature: 0.4, correlationId: `growth-content-${i}`,
        });
        const parsed = parseDraft(response.text);

        const idea: ContentIdea = {
          id: `idea_${Date.now()}_${i}`,
          title: parsed.title,
          category: input.category,
          channels: [input.channel],
          angle: parsed.angle,
          rationale: `Generated for ${input.channel} from category ${input.category}.`,
          priority: max - i,
          generatedAt: new Date().toISOString(),
          generatedBy: "daily_content_workflow",
        };
        const draft: SocialPostDraft = {
          id: `draft_${Date.now()}_${i}`,
          ideaId: idea.id,
          channel: input.channel,
          body: parsed.body,
          hashtags,
          cta: SAFE_CTAS[input.channel],
          status: "drafted",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          draftedByAgent: "marketingContentDrafter",
        };
        ideas.push(idea);
        drafts.push(draft);
      }
      return { ideas, drafts, usedLlm: true };
  } catch (error) {
    throw new Error("Gateway content generation failed.", { cause: error });
  }
}

function buildPrompt(channel: SocialChannel, category: ContentTopicCategory, topicHint: string | undefined, seed: number): string {
  const persona = "VisionXIXLabs — AI ops platform that connects cloud + DevOps + security + monitoring with approval-only-no-execution defaults.";
  const channelGuide = channel === "linkedin"
    ? "Audience: platform engineering leads, CTOs. 90-150 words. Authoritative but human. One concrete claim, one specific example, one CTA at the end."
    : channel === "x"
      ? "Audience: developers + ops engineers on X. Either a single tight post under 280 chars, or a 3-tweet thread. No fluff."
      : "Web/blog style. 200-300 words.";
  const cat = `Category: ${category}. ${topicHint ? `Operator hint: ${topicHint}.` : ""}`;
  const dont = "DO NOT promise 'AGI replaces engineers'. DO NOT make claims about features we haven't shipped. Honest, specific, useful.";

  return `${persona}\n\n${channelGuide}\n${cat}\nSeed: ${seed}.\n\n${dont}\n\nReturn JSON with these exact keys: {"title": short headline, "angle": one-sentence hook, "body": the actual post body}. JSON only, no surrounding markdown.`;
}

function parseDraft(text: string): { title: string; angle: string; body: string } {
  // Try strict JSON first
  const trimmed = text.trim();
  const jsonStart = trimmed.indexOf("{");
  const jsonEnd = trimmed.lastIndexOf("}");
  if (jsonStart >= 0 && jsonEnd > jsonStart) {
    const slice = trimmed.slice(jsonStart, jsonEnd + 1);
    try {
      const parsed = JSON.parse(slice) as { title?: string; angle?: string; body?: string };
      return {
        title: parsed.title ?? "Untitled draft",
        angle: parsed.angle ?? "",
        body:  parsed.body  ?? trimmed,
      };
    } catch {
      // fall through
    }
  }
  // Fallback — use the raw text as the body
  return { title: "Draft", angle: "", body: trimmed };
}
