/**
 * AIModelRegistry — recommended model identifiers per provider. Operators
 * (and the manager) consult this to pick a
 * default + offer a switcher.
 *
 * Hard rule: no hard-coded "one model forever". The registry stores an
 * ordered list per provider; the manager picks the first available and
 * the AISettings UI lets operators rotate the list.
 */

import type { AIProviderName } from "./AIProvider";

export interface RegisteredModel {
  /** Identifier the provider expects in its API. */
  id: string;
  /** Operator-readable label. */
  label: string;
  /** Coarse capability ranking — manager prefers higher when no override. */
  tier: "preferred" | "balanced" | "fast" | "fallback";
  /** Family/origin tag for the settings UI. */
  family: "openai" | "llama" | "qwen" | "mistral" | "gemma" | "phi" | "deepseek" | "anthropic" | "gemini" | "xai" | "cloudflare" | "other";
  /** Access note. Strictly informational; we never quote pricing or SLAs. */
  freeNote: string;
}

const MODELS: Record<AIProviderName, RegisteredModel[]> = {
  openai: [
    { id: "gpt-4o", label: "GPT-4o", tier: "preferred", family: "openai", freeNote: "Service-managed OpenAI access" },
    { id: "gpt-4o-mini", label: "GPT-4o mini", tier: "fast", family: "openai", freeNote: "Service-managed OpenAI access" },
  ],
  anthropic: [
    { id: "claude-sonnet-4-20250514", label: "Claude Sonnet", tier: "preferred", family: "anthropic", freeNote: "Service-managed Anthropic access" },
    { id: "claude-3-5-haiku-latest", label: "Claude Haiku", tier: "fast", family: "anthropic", freeNote: "Service-managed Anthropic access" },
  ],
  xai: [
    { id: "grok-4.7", label: "Grok 4.7", tier: "preferred", family: "xai", freeNote: "Service-managed xAI access" },
  ],
  github_models: [
    { id: "openai/gpt-4o-mini",                label: "GPT-4o mini",                 tier: "preferred", family: "openai",   freeNote: "GitHub Models free tier" },
    { id: "openai/gpt-4o",                     label: "GPT-4o",                      tier: "balanced",  family: "openai",   freeNote: "GitHub Models free tier (limits apply)" },
    { id: "meta/llama-3.1-70b-instruct",       label: "Llama 3.1 70B Instruct",      tier: "balanced",  family: "llama",    freeNote: "GitHub Models free tier" },
    { id: "meta/llama-3.1-8b-instruct",        label: "Llama 3.1 8B Instruct",       tier: "fast",      family: "llama",    freeNote: "GitHub Models free tier" },
    { id: "mistral-ai/mistral-large",          label: "Mistral Large",               tier: "balanced",  family: "mistral",  freeNote: "GitHub Models free tier" },
    { id: "microsoft/phi-3.5-mini-instruct",   label: "Phi 3.5 Mini Instruct",       tier: "fast",      family: "phi",      freeNote: "GitHub Models free tier" },
    { id: "deepseek/deepseek-r1-distill-llama",label: "DeepSeek R1 Distill Llama",   tier: "balanced",  family: "deepseek", freeNote: "GitHub Models free tier" },
  ],
  ollama: [
    { id: "llama3.2",         label: "Llama 3.2 (local)",           tier: "preferred", family: "llama",    freeNote: "Local, no key required" },
    { id: "llama3.1",         label: "Llama 3.1 (local)",           tier: "balanced",  family: "llama",    freeNote: "Local" },
    { id: "qwen2.5",          label: "Qwen 2.5 (local)",            tier: "balanced",  family: "qwen",     freeNote: "Local" },
    { id: "mistral",          label: "Mistral (local)",             tier: "fast",      family: "mistral",  freeNote: "Local" },
    { id: "phi3.5",           label: "Phi 3.5 (local)",             tier: "fast",      family: "phi",      freeNote: "Local" },
    { id: "gemma2",           label: "Gemma 2 (local)",             tier: "fast",      family: "gemma",    freeNote: "Local" },
  ],
  lm_studio: [
    { id: "default",                          label: "LM Studio loaded model",      tier: "preferred", family: "other",   freeNote: "Whatever is currently loaded in LM Studio" },
    { id: "llama-3.2-3b-instruct",            label: "Llama 3.2 3B (LM Studio)",    tier: "balanced",  family: "llama",   freeNote: "Local" },
    { id: "qwen2.5-7b-instruct",              label: "Qwen 2.5 7B (LM Studio)",     tier: "balanced",  family: "qwen",    freeNote: "Local" },
  ],
  groq: [
    { id: "llama-3.1-70b-versatile",          label: "Llama 3.1 70B (Groq)",        tier: "preferred", family: "llama",   freeNote: "Groq free tier" },
    { id: "llama-3.1-8b-instant",             label: "Llama 3.1 8B Instant (Groq)", tier: "fast",      family: "llama",   freeNote: "Groq free tier" },
    { id: "mixtral-8x7b-32768",               label: "Mixtral 8x7B (Groq)",         tier: "balanced",  family: "mistral", freeNote: "Groq free tier" },
    { id: "gemma2-9b-it",                     label: "Gemma 2 9B IT (Groq)",        tier: "fast",      family: "gemma",   freeNote: "Groq free tier" },
  ],
  hugging_face: [
    { id: "meta-llama/Meta-Llama-3.1-8B-Instruct",   label: "Llama 3.1 8B Instruct (HF)",  tier: "preferred", family: "llama",    freeNote: "HF Inference free" },
    { id: "mistralai/Mistral-7B-Instruct-v0.3",      label: "Mistral 7B v0.3 (HF)",        tier: "balanced",  family: "mistral",  freeNote: "HF Inference free" },
    { id: "Qwen/Qwen2.5-7B-Instruct",                label: "Qwen 2.5 7B Instruct (HF)",   tier: "balanced",  family: "qwen",     freeNote: "HF Inference free" },
    { id: "google/gemma-2-9b-it",                    label: "Gemma 2 9B IT (HF)",          tier: "fast",      family: "gemma",    freeNote: "HF Inference free" },
  ],
  openrouter: [
    { id: "meta-llama/llama-3.1-8b-instruct:free",   label: "Llama 3.1 8B (OpenRouter free)",  tier: "preferred", family: "llama",   freeNote: "OpenRouter free models" },
    { id: "mistralai/mistral-7b-instruct:free",      label: "Mistral 7B (OpenRouter free)",    tier: "balanced",  family: "mistral", freeNote: "OpenRouter free" },
    { id: "google/gemma-2-9b-it:free",               label: "Gemma 2 9B IT (OpenRouter free)", tier: "fast",      family: "gemma",   freeNote: "OpenRouter free" },
    { id: "qwen/qwen-2.5-7b-instruct:free",          label: "Qwen 2.5 7B (OpenRouter free)",   tier: "balanced",  family: "qwen",    freeNote: "OpenRouter free" },
  ],
  gemini: [
    // 2.5-flash is the broadest free model on the AI Studio key tier — accept
    // the thinking-token overhead and budget for it in GeminiProvider.
    { id: "gemini-2.5-flash",                  label: "Gemini 2.5 Flash",           tier: "preferred", family: "gemini",   freeNote: "Gemini free tier · uses thinking tokens" },
    { id: "gemini-2.0-flash",                  label: "Gemini 2.0 Flash",           tier: "balanced",  family: "gemini",   freeNote: "Gemini free tier (project-dependent)" },
    { id: "gemini-2.0-flash-lite",             label: "Gemini 2.0 Flash-Lite",      tier: "fast",      family: "gemini",   freeNote: "Gemini free tier (project-dependent)" },
    { id: "gemini-2.5-pro",                    label: "Gemini 2.5 Pro",             tier: "balanced",  family: "gemini",   freeNote: "Gemini free tier (project-dependent)" },
  ],
  cloudflare: [
    { id: "@cf/meta/llama-3.1-8b-instruct",            label: "Llama 3.1 8B (Workers AI)",   tier: "preferred", family: "llama",   freeNote: "Cloudflare Workers AI free" },
    { id: "@cf/mistral/mistral-7b-instruct-v0.2",      label: "Mistral 7B v0.2 (Workers AI)",tier: "balanced",  family: "mistral", freeNote: "Cloudflare Workers AI free" },
    { id: "@cf/qwen/qwen1.5-7b-chat-awq",              label: "Qwen 1.5 7B Chat (Workers AI)",tier: "balanced", family: "qwen",   freeNote: "Cloudflare Workers AI free" },
    { id: "@cf/google/gemma-7b-it",                    label: "Gemma 7B IT (Workers AI)",    tier: "fast",      family: "gemma",   freeNote: "Cloudflare Workers AI free" },
  ],
  mock: [
    { id: "mock-v1",                           label: "Deterministic mock",         tier: "fallback",  family: "other",   freeNote: "Local stub — no network" },
  ],
};

/** Return the recommended list for a provider (never empty). */
export function listModels(provider: AIProviderName): RegisteredModel[] {
  const arr = MODELS[provider];
  return arr.length > 0 ? [...arr] : MODELS.mock;
}

/** Pick the default model for a provider (first preferred, else first). */
export function defaultModelFor(provider: AIProviderName): string {
  const arr = MODELS[provider];
  const pref = arr.find((m) => m.tier === "preferred");
  return (pref ?? arr[0])?.id ?? "mock-v1";
}

/** Sanity check used by tests + the settings UI. */
export function isKnownModel(provider: AIProviderName, modelId: string): boolean {
  return MODELS[provider].some((m) => m.id === modelId);
}

/** Provider declaration order = fallback priority (ties broken by index). */
export const PROVIDER_PRIORITY: AIProviderName[] = [
  "openai", "anthropic", "xai", "github_models", "ollama", "lm_studio", "groq",
  "hugging_face", "openrouter", "gemini", "cloudflare", "mock",
];
