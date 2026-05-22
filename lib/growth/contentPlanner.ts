/**
 * Internal content planner.
 *
 * Pure module: given a target date + channel, produces typed
 * ContentIdea + SocialPostDraft objects (in-memory). Uses the
 * Anthropic API when ANTHROPIC_API_KEY is set; otherwise returns
 * deterministic typed placeholders so unit tests + dev builds work
 * without an LLM key.
 *
 * Internal only. Drafts NEVER leave this process without an explicit
 * PublishingApproval downstream.
 */

import "server-only";

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
  /** True when the planner used the LLM; false when it returned deterministic placeholders. */
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

const DETERMINISTIC_PROMPTS: Readonly<Record<ContentTopicCategory, string[]>> = {
  product_education: [
    "How VisionXIXLabs agents detect IAM drift across AWS + Azure + GCP in one pass.",
    "Tier-1 service health: from telemetry → alert → incident → postmortem, in one calm view.",
    "Connector setup that takes seconds, not days — paste creds, get green ticks.",
  ],
  thought_leadership: [
    "Why approval-only-no-execution is a more honest default than autopilot.",
    "Distributed traces are only useful if you can read them under stress — here's how we redesigned ours.",
    "The case for closed-union safety in AI-ops platforms.",
  ],
  launch_announcement: [
    "Shipped: native service catalog auto-discovery across AWS + GCP + GitHub.",
    "Shipped: per-tenant calm UX — no fake counts for fresh workspaces.",
    "Shipped: agent tool access matrix — read / write / approval per agent per tool.",
  ],
  case_study: [
    "Case study: an engineering team replaced 5 dashboards with one approval queue.",
    "Case study: from 12 alerts/hour to 2/day after the noise reducer landed.",
  ],
  founder_voice: [
    "Building VisionXIXLabs — week N notes on tradeoffs between autonomy and approvals.",
    "Why we said no to a freemium trial and what we shipped instead.",
  ],
  technical_deep_dive: [
    "How we make Claude reason over your real cloud inventory without leaking PII.",
    "Closed-union types as a runtime safety mechanism — patterns we use every day.",
  ],
  marketing_campaign: [
    "Week 1: connectors. Week 2: agents. Week 3: approvals. The 3-week tour of VisionXIXLabs.",
  ],
};

export async function planContent(input: PlannerInput): Promise<PlannerOutput> {
  const max = Math.max(1, Math.min(input.maxDrafts ?? 3, 10));
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  const hashtags = DEFAULT_HASHTAGS[input.channel];

  // LLM path — generate a fresh idea + post for each requested draft.
  if (apiKey) {
    try {
      const Anthropic = (await import("@anthropic-ai/sdk")).default;
      const client = new Anthropic({ apiKey });
      const ideas: ContentIdea[] = [];
      const drafts: SocialPostDraft[] = [];

      for (let i = 0; i < max; i++) {
        const prompt = buildPrompt(input.channel, input.category, input.topicHint, i);
        const response = await client.messages.create({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 600,
          messages: [{ role: "user", content: prompt }],
        });
        const block = response.content.find((b) => b.type === "text");
        const text = block && "text" in block ? block.text : "";
        const parsed = parseDraft(text);

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
    } catch {
      // Fall through to deterministic placeholders.
    }
  }

  // Deterministic placeholder path — used in dev / when LLM key missing.
  const prompts = DETERMINISTIC_PROMPTS[input.category] ?? [];
  const ideas: ContentIdea[] = [];
  const drafts: SocialPostDraft[] = [];
  for (let i = 0; i < max && i < prompts.length; i++) {
    const title = prompts[i];
    const idea: ContentIdea = {
      id: `idea_det_${Date.now()}_${i}`,
      title,
      category: input.category,
      channels: [input.channel],
      angle: title,
      rationale: "Deterministic placeholder — LLM key not configured.",
      priority: prompts.length - i,
      generatedAt: new Date().toISOString(),
      generatedBy: "daily_content_workflow",
    };
    const draft: SocialPostDraft = {
      id: `draft_det_${Date.now()}_${i}`,
      ideaId: idea.id,
      channel: input.channel,
      body: title,
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
  return { ideas, drafts, usedLlm: false };
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
