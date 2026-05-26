/**
 * Brand image generator — gpt-image-1 (OpenAI).
 *
 * Generates a 1024x1024 image tuned to the VisionXIXLabs brand palette
 * (dark navy + violet + coral). Per-category prompt scaffold makes the
 * outputs visually consistent across the feed.
 *
 * Returns the image bytes + the prompt used (for audit / reproducibility).
 * Caller is responsible for storing the binary + uploading to LinkedIn.
 *
 * Skips silently when OPENAI_API_KEY isn't set — returns `kind: "disabled"`.
 */

import "server-only";

import type { ContentTopicCategory } from "./growthModels";

export type ImageGenResult =
  | { kind: "ok"; bytes: Buffer; mimeType: "image/png"; prompt: string }
  | { kind: "disabled"; reason: string }
  | { kind: "error"; message: string };

interface GenerateImageInput {
  category: ContentTopicCategory;
  /** Short summary of the post body — used to flavor the image prompt. */
  postSummary: string;
}

// ---------------------------------------------------------------------------
// Per-category scaffolds — all share dark base + violet/coral accents to
// stay visually consistent in a LinkedIn feed.
// ---------------------------------------------------------------------------

const BRAND_PALETTE = "Deep navy / charcoal background. Electric violet (#8B5CF6) and coral pink (#F472B6) as accent colors. Pixel-precise. Premium SaaS aesthetic.";

const PROMPT_SCAFFOLD: Readonly<Record<ContentTopicCategory, string>> = {
  product_education:
    "Clean editorial illustration showing a cloud operations dashboard with subtle line art and data visualizations. Minimalist. No people, no text.",
  thought_leadership:
    "Abstract geometric composition expressing thoughtfulness and depth. Architectural lines, subtle gradients, single focal point. No people, no text, no faces.",
  launch_announcement:
    "Bold abstract visual representing momentum and 'shipped'. Diagonal energy lines, gradient orbs. No text.",
  case_study:
    "Editorial-style abstract showing transformation from chaos to calm. Two contrasting halves connected by a smooth gradient. No text, no people.",
  founder_voice:
    "Quiet, contemplative composition. A single illuminated object on a dark stage. Minimal, thoughtful. No text, no people.",
  technical_deep_dive:
    "Blueprint / schematic aesthetic — circuit-board hints, hairline grid, monospace data fragments. Technical but elegant. No text.",
  marketing_campaign:
    "Series of small connected visual elements suggesting a multi-part story. Flat with depth. No text.",
};

const NEGATIVE_PROMPT =
  "DO NOT include any text, words, letters, numbers, or characters in the image. DO NOT include faces, hands, or human figures. DO NOT include corporate logos or competitor branding. Avoid cliché tech imagery (handshakes, lightbulbs, gears).";

export function buildImagePrompt(input: GenerateImageInput): string {
  const scaffold = PROMPT_SCAFFOLD[input.category];
  const summary = input.postSummary.slice(0, 240).replace(/\n+/g, " ");
  return [
    `Editorial brand image for a LinkedIn post about: ${summary}`,
    scaffold,
    BRAND_PALETTE,
    "1:1 square composition. High visual contrast.",
    NEGATIVE_PROMPT,
  ].join("\n\n");
}

// ---------------------------------------------------------------------------
// Main entry point — calls OpenAI images API and returns PNG bytes.
// ---------------------------------------------------------------------------

export async function generateBrandImage(input: GenerateImageInput): Promise<ImageGenResult> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return { kind: "disabled", reason: "OPENAI_API_KEY not set" };
  }
  if ((process.env.IMAGE_GENERATION_ENABLED ?? "true").toLowerCase() === "false") {
    return { kind: "disabled", reason: "IMAGE_GENERATION_ENABLED=false" };
  }

  const prompt = buildImagePrompt(input);
  const model = process.env.IMAGE_GENERATION_MODEL ?? "gpt-image-1";

  try {
    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method:  "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type":  "application/json",
      },
      body: JSON.stringify({
        model,
        prompt,
        size: "1024x1024",
        n: 1,
        // gpt-image-1 returns base64 by default; dall-e-3 returns URL unless response_format set
        response_format: model === "dall-e-3" ? "b64_json" : undefined,
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { kind: "error", message: `OpenAI HTTP ${res.status}: ${text.slice(0, 400)}` };
    }

    const json = (await res.json()) as { data?: Array<{ b64_json?: string; url?: string }> };
    const first = json.data?.[0];
    if (!first) {
      return { kind: "error", message: "OpenAI returned no image data" };
    }

    let bytes: Buffer;
    if (first.b64_json) {
      bytes = Buffer.from(first.b64_json, "base64");
    } else if (first.url) {
      const imgRes = await fetch(first.url);
      if (!imgRes.ok) {
        return { kind: "error", message: `Image URL fetch failed: ${imgRes.status}` };
      }
      bytes = Buffer.from(await imgRes.arrayBuffer());
    } else {
      return { kind: "error", message: "OpenAI returned neither b64_json nor url" };
    }

    return { kind: "ok", bytes, mimeType: "image/png", prompt };
  } catch (err) {
    return { kind: "error", message: err instanceof Error ? err.message : String(err) };
  }
}
