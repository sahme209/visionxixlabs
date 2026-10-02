/**
 * xAI / Grok adapter. xAI documents an OpenAI-compatible chat-completions
 * endpoint at https://api.x.ai/v1. The key is server-only and this provider
 * stays unavailable until XAI_API_KEY is configured by the service.
 */

import "server-only";
import { defaultModelFor } from "../AIModelRegistry";
import { OpenAICompatProvider } from "./openaiCompat";

const BASE_URL = "https://api.x.ai/v1";

export class XAIProvider extends OpenAICompatProvider {
  constructor(env: { apiKey?: string; modelName?: string }) {
    super({
      provider: "xai",
      defaultModel: env.modelName ?? defaultModelFor("xai"),
      baseUrl: BASE_URL,
      apiKey: env.apiKey ?? "",
    });
  }
}
