/**
 * GitHubModelsProvider — primary free provider.
 *
 * Endpoint: https://models.github.ai/inference (OpenAI-compatible).
 * Auth:     Authorization: Bearer GITHUB_TOKEN
 *
 * One API key unlocks many models (OpenAI, Llama, Mistral, Phi,
 * DeepSeek, etc.). Model is selected via the AIModelRegistry default
 * for "github_models" or the per-call options.model override.
 */

import "server-only";
import { defaultModelFor } from "../AIModelRegistry";
import { OpenAICompatProvider } from "./openaiCompat";

const BASE_URL = "https://models.github.ai/inference";

export class GitHubModelsProvider extends OpenAICompatProvider {
  constructor(env: { token?: string; modelName?: string }) {
    super({
      provider: "github_models",
      defaultModel: env.modelName ?? defaultModelFor("github_models"),
      baseUrl: BASE_URL,
      apiKey: env.token ?? "",
    });
  }
}
