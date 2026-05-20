/**
 * GroqProvider — fast free-tier inference for Llama / Mixtral / Gemma.
 *
 * Endpoint: https://api.groq.com/openai/v1 (OpenAI-compatible).
 * Auth:     Authorization: Bearer GROQ_API_KEY
 */

import "server-only";
import { defaultModelFor } from "../AIModelRegistry";
import { OpenAICompatProvider } from "./openaiCompat";

const BASE_URL = "https://api.groq.com/openai/v1";

export class GroqProvider extends OpenAICompatProvider {
  constructor(env: { apiKey?: string; modelName?: string }) {
    super({
      provider: "groq",
      defaultModel: env.modelName ?? defaultModelFor("groq"),
      baseUrl: BASE_URL,
      apiKey: env.apiKey ?? "",
    });
  }
}
