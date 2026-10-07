/**
 * OllamaProvider — local fallback when GitHub Models is unavailable.
 *
 * Endpoint: `${OLLAMA_BASE_URL}/v1` (OpenAI-compatible chat endpoint).
 * Default base URL: http://localhost:11434
 *
 * No auth is required, but a server deployment must explicitly set
 * OLLAMA_BASE_URL. Falling back to localhost inside Vercel would advertise a
 * model that can only resolve inside the remote function container, not on
 * the customer's Mac.
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
      allowEmptyKey: Boolean(env.baseUrl?.trim()),
    });
  }
}
