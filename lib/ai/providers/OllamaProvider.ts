/**
 * OllamaProvider — local fallback when GitHub Models is unavailable.
 *
 * Endpoint: `${OLLAMA_BASE_URL}/v1` (OpenAI-compatible chat endpoint).
 * Default base URL: http://localhost:11434
 *
 * No auth required. We mark `allowEmptyKey: true` so isConfigured()
 * returns true even without a key.
 */

import "server-only";
import { defaultModelFor } from "../AIModelRegistry";
import { OpenAICompatProvider } from "./openaiCompat";

export class OllamaProvider extends OpenAICompatProvider {
  constructor(env: { baseUrl?: string; modelName?: string }) {
    const base = (env.baseUrl ?? "http://localhost:11434").replace(/\/+$/, "");
    super({
      provider: "ollama",
      defaultModel: env.modelName ?? defaultModelFor("ollama"),
      baseUrl: `${base}/v1`,
      apiKey: "",
      allowEmptyKey: true,
    });
  }
}
