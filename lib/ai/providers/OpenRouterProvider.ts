/**
 * OpenRouterProvider — free-model routing aggregator.
 *
 * Endpoint: https://openrouter.ai/api/v1 (OpenAI-compatible).
 * Auth:     Authorization: Bearer OPENROUTER_API_KEY
 *
 * OpenRouter prefers a recognizable HTTP-Referer header; we send one
 * but never embed user content there.
 */

import "server-only";
import { defaultModelFor } from "../AIModelRegistry";
import { OpenAICompatProvider } from "./openaiCompat";

const BASE_URL = "https://openrouter.ai/api/v1";

export class OpenRouterProvider extends OpenAICompatProvider {
  constructor(env: { apiKey?: string; modelName?: string; referer?: string }) {
    super({
      provider: "openrouter",
      defaultModel: env.modelName ?? defaultModelFor("openrouter"),
      baseUrl: BASE_URL,
      apiKey: env.apiKey ?? "",
      extraHeaders: {
        "http-referer": env.referer ?? "https://visionxixlabs.com",
        "x-title": "Axiom",
      },
    });
  }
}
