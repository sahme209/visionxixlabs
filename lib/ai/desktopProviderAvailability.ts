import "server-only";

import { getAIProviderManager } from "@/lib/ai/AIProviderManager";

export interface DesktopAIProviderAvailability {
  provider: string;
  configured: boolean;
  defaultModel: string;
}

/**
 * The desktop has two established server-side AI routes today:
 *
 * - AIProviderManager: the adapter chain used by the multi-provider tools.
 * - the task orchestrator: the GPT / Claude / Gemini route used by governed
 *   task types.
 *
 * This single read-only projection keeps the desktop Provider Center honest.
 * It exposes only a family name, its enabled state, and its service default
 * model. Keys, account identity, policy, usage, and routing detail remain on
 * the service.
 */
export function listDesktopAIProviderAvailability(): DesktopAIProviderAvailability[] {
  const managed = getAIProviderManager().status()
    .filter((provider) => provider.provider !== "mock")
    .map((provider) => ({
      provider: provider.provider,
      configured: provider.configured,
      defaultModel: provider.defaultModel,
    }));

  const orchestrated: DesktopAIProviderAvailability[] = [
    {
      provider: "openai",
      configured: Boolean(process.env.OPENAI_API_KEY?.trim()),
      defaultModel: process.env.OPENAI_MODEL?.trim() || process.env.MODEL_NAME?.trim() || "gpt-4o",
    },
    {
      provider: "anthropic",
      configured: Boolean(process.env.ANTHROPIC_API_KEY?.trim()),
      defaultModel: process.env.ANTHROPIC_MODEL?.trim() || "claude-sonnet-4-20250514",
    },
  ];

  const byProvider = new Map<string, DesktopAIProviderAvailability>();
  for (const provider of [...orchestrated, ...managed]) {
    byProvider.set(provider.provider, provider);
  }
  return [...byProvider.values()];
}
