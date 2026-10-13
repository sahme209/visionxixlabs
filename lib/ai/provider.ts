/**
 * Legacy completion facade.
 *
 * Kept for older call sites, but all production inference is executed by the
 * Gateway-only AIProviderManager. Direct provider keys and silent mock
 * responses are intentionally unsupported.
 */

import "server-only";
import { getAIProviderManager } from "./AIProviderManager";

export type AIProvider = "vercel_gateway";

export interface GenerateOptions {
  systemPrompt: string;
  userPrompt: string;
  maxTokens?: number;
  temperature?: number;
  responseFormat?: "text" | "json";
  /** Deprecated compatibility fields; direct-provider overrides are ignored. */
  _orchestratorProvider?: AIProvider;
  _orchestratorTaskType?: string;
}

export interface GenerateResult {
  text: string;
  provider: AIProvider;
}

export async function generateCompletion(opts: GenerateOptions): Promise<GenerateResult> {
  const jsonInstruction = opts.responseFormat === "json"
    ? "\nReturn valid JSON only, with no Markdown fence or commentary."
    : "";
  const result = await getAIProviderManager().generateText(opts.userPrompt, {
    only: "vercel_gateway",
    system: `${opts.systemPrompt}${jsonInstruction}`,
    maxTokens: opts.maxTokens,
    temperature: opts.temperature,
  });
  return { text: result.text, provider: "vercel_gateway" };
}

export function getAvailableProviders(): AIProvider[] {
  return getAIProviderManager().isServiceProviderAvailable("vercel_gateway")
    ? ["vercel_gateway"]
    : [];
}
