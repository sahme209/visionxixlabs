/**
 * LMStudioProvider — second-tier local fallback.
 *
 * Endpoint: `${LM_STUDIO_BASE_URL}/v1` (OpenAI-compatible).
 * Default base URL: http://localhost:1234
 *
 * No auth is required, but LM_STUDIO_BASE_URL must be explicitly configured.
 * A hosted API cannot reach a model server on the desktop's localhost.
 */

import "server-only";
import { defaultModelFor } from "../AIModelRegistry";
import { OpenAICompatProvider } from "./openaiCompat";

export class LMStudioProvider extends OpenAICompatProvider {
  constructor(env: { baseUrl?: string; modelName?: string }) {
    const base = (env.baseUrl ?? "http://localhost:1234").replace(/\/+$/, "");
    super({
      provider: "lm_studio",
      defaultModel: env.modelName ?? defaultModelFor("lm_studio"),
      baseUrl: `${base}/v1`,
      apiKey: "",
      allowEmptyKey: Boolean(env.baseUrl?.trim()),
    });
  }
}
