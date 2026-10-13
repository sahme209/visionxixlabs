/**
 * Brand image generator through Vercel AI Gateway.
 *
 * Generates a 1024x1024 image tuned to the VisionXIXLabs brand palette
 * (near-black surfaces with restrained Axiom orange). Per-category prompt scaffold makes the
 * outputs visually consistent across the feed.
 *
 * Returns the image bytes + the prompt used (for audit / reproducibility).
 * Caller is responsible for storing the binary + uploading to LinkedIn.
 *
 * Returns an explicit disabled result when Gateway configuration is absent.
 */

import "server-only";
import { generateImage } from "ai";

import type { ContentTopicCategory } from "./growthModels";

export type ImageGenResult =
  | { kind: "ok"; bytes: Buffer; mimeType: string; prompt: string }
  | { kind: "disabled"; reason: string }
  | { kind: "error"; message: string };

interface GenerateImageInput {
  category: ContentTopicCategory;
  /** Short summary of the post body — used to flavor the image prompt. */
  postSummary: string;
}

// ---------------------------------------------------------------------------
// Per-category scaffolds — all share a neutral dark base and orange accents to
// stay visually consistent in a LinkedIn feed.
// ---------------------------------------------------------------------------

const BRAND_PALETTE = "Near-black and charcoal background. Warm Axiom orange (#F54E00 / #FF783D) used sparingly as the only accent. Pixel-precise, restrained editorial aesthetic.";

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
  const hasGatewayAuth = Boolean(process.env.AI_GATEWAY_API_KEY?.trim() || process.env.VERCEL_OIDC_TOKEN?.trim());
  const model = process.env.AI_GATEWAY_IMAGE_MODEL?.trim();
  if (!hasGatewayAuth || !model) {
    return { kind: "disabled", reason: "AI_GATEWAY_IMAGE_MODEL or Gateway authentication is not configured" };
  }
  if ((process.env.IMAGE_GENERATION_ENABLED ?? "true").toLowerCase() === "false") {
    return { kind: "disabled", reason: "IMAGE_GENERATION_ENABLED=false" };
  }

  const prompt = buildImagePrompt(input);
  try {
    const result = await generateImage({
      model,
      prompt,
      size: "1024x1024",
      n: 1,
      providerOptions: { gateway: { tags: ["product:axiom-agent", "task:growth-image"] } },
    });
    return { kind: "ok", bytes: Buffer.from(result.image.uint8Array), mimeType: result.image.mediaType, prompt };
  } catch (err) {
    return { kind: "error", message: err instanceof Error ? err.message : String(err) };
  }
}
