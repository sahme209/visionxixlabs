/** OpenAI chat-completions adapter. Credentials remain server-only. */

import "server-only";
import { defaultModelFor } from "../AIModelRegistry";
import { OpenAICompatProvider } from "./openaiCompat";

export class OpenAIProvider extends OpenAICompatProvider {
  constructor(env: { apiKey?: string; modelName?: string }) {
    super({
      provider: "openai",
      defaultModel: env.modelName ?? defaultModelFor("openai"),
      baseUrl: "https://api.openai.com/v1",
      apiKey: env.apiKey ?? "",
    });
  }
}
