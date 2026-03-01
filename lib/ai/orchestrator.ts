/**
 * AI Orchestration Layer — multi-model routing by task type.
 * All AI calls route through here. No direct GPT-4-mini or single-model hard-coding.
 *
 * Task routing:
 * - Website layout / design → strongest design-capable model
 * - Terraform / infra / code → strongest reasoning model
 * - Chat responses → fast + cost-optimized model
 * - Cloud fix plan → reasoning + validation chain
 */

import { generateCompletion } from "@/lib/ai/provider";
import { generateChatResponse } from "@/lib/ai/chat";
import type { AIProvider } from "@/lib/ai/provider";

export type TaskType =
  | "content_generation"
  | "code_generation"
  | "cloud_automation"
  | "reasoning_planning"
  | "chat";

/** Env overrides for model selection per task. Falls back to defaults. */
const MODEL_CONFIG: Record<
  TaskType,
  {
    openai?: string;
    anthropic?: string;
    gemini?: string;
    /** Preferred provider for this task type */
    preferred?: AIProvider;
  }
> = {
  content_generation: {
    openai: process.env.AI_MODEL_CONTENT ?? process.env.OPENAI_MODEL ?? "gpt-4o",
    anthropic: process.env.AI_MODEL_CONTENT_ANTHROPIC ?? process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-20250514",
    gemini: process.env.AI_MODEL_CONTENT_GEMINI ?? process.env.GEMINI_MODEL ?? "gemini-2.0-flash",
    preferred: "openai",
  },
  code_generation: {
    openai: process.env.AI_MODEL_CODE ?? process.env.OPENAI_MODEL ?? "gpt-4o",
    anthropic: process.env.AI_MODEL_CODE_ANTHROPIC ?? process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-20250514",
    gemini: process.env.AI_MODEL_CODE_GEMINI ?? process.env.GEMINI_MODEL ?? "gemini-2.0-flash",
    preferred: "anthropic",
  },
  cloud_automation: {
    openai: process.env.AI_MODEL_CLOUD ?? process.env.OPENAI_MODEL ?? "gpt-4o",
    anthropic: process.env.AI_MODEL_CLOUD_ANTHROPIC ?? process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-20250514",
    gemini: process.env.AI_MODEL_CLOUD_GEMINI ?? process.env.GEMINI_MODEL ?? "gemini-2.0-flash",
    preferred: "anthropic",
  },
  reasoning_planning: {
    openai: process.env.AI_MODEL_REASONING ?? process.env.OPENAI_MODEL ?? "gpt-4o",
    anthropic: process.env.AI_MODEL_REASONING_ANTHROPIC ?? process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-20250514",
    gemini: process.env.AI_MODEL_REASONING_GEMINI ?? process.env.GEMINI_MODEL ?? "gemini-2.0-flash",
    preferred: "anthropic",
  },
  chat: {
    openai: process.env.AI_MODEL_CHAT ?? process.env.OPENAI_MODEL ?? "gpt-4o",
    anthropic: process.env.AI_MODEL_CHAT_ANTHROPIC ?? process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-20250514",
    gemini: process.env.AI_MODEL_CHAT_GEMINI ?? process.env.GEMINI_MODEL ?? "gemini-2.0-flash",
    preferred: "openai",
  },
};

export interface OrchestrateGenerateOptions {
  taskType: TaskType;
  systemPrompt: string;
  userPrompt: string;
  maxTokens?: number;
  temperature?: number;
  responseFormat?: "text" | "json";
}

export interface OrchestrateChatOptions {
  taskType: TaskType;
  systemPrompt: string;
  messages: { role: "user" | "assistant" | "system"; content: string }[];
  maxTokens?: number;
  temperature?: number;
}

/** Apply task-type-specific model preference via AI_PROVIDER override. */
function getProviderOrderForTask(taskType: TaskType): AIProvider[] {
  const preferred = MODEL_CONFIG[taskType].preferred;
  const order: AIProvider[] = ["openai", "gemini", "anthropic"];
  if (preferred && order.includes(preferred)) {
    return [preferred, ...order.filter((p) => p !== preferred)];
  }
  const envPreferred = process.env.AI_PROVIDER?.toLowerCase();
  if (envPreferred === "openai" || envPreferred === "gemini" || envPreferred === "anthropic") {
    return [envPreferred, ...order.filter((p) => p !== envPreferred)];
  }
  return order;
}

/**
 * Generate completion via orchestrator — routes to best model for task type.
 */
export async function orchestrateGenerate(
  opts: OrchestrateGenerateOptions
): Promise<{ text: string; provider: AIProvider }> {
  const order = getProviderOrderForTask(opts.taskType);
  let lastError: Error | null = null;

  for (const provider of order) {
    try {
      const result = await generateCompletion({
        systemPrompt: opts.systemPrompt,
        userPrompt: opts.userPrompt,
        maxTokens: opts.maxTokens,
        temperature: opts.temperature,
        responseFormat: opts.responseFormat,
        _orchestratorProvider: provider,
        _orchestratorTaskType: opts.taskType,
      });
      return result;
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
    }
  }

  throw (
    lastError ??
    new Error("No AI provider configured. Set OPENAI_API_KEY, GEMINI_API_KEY, or ANTHROPIC_API_KEY.")
  );
}

/**
 * Chat completion via orchestrator — routes to best model for task type.
 */
export async function orchestrateChat(
  opts: OrchestrateChatOptions
): Promise<{ text: string; provider: "openai" | "gemini" | "anthropic" }> {
  const order = getProviderOrderForTask(opts.taskType);
  let lastError: Error | null = null;

  for (const provider of order) {
    try {
      const result = await generateChatResponse({
        systemPrompt: opts.systemPrompt,
        messages: opts.messages,
        maxTokens: opts.maxTokens,
        temperature: opts.temperature,
        _orchestratorProvider: provider,
        _orchestratorTaskType: opts.taskType,
      });
      return result;
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
    }
  }

  throw (
    lastError ??
    new Error("No AI provider configured. Set OPENAI_API_KEY, GEMINI_API_KEY, or ANTHROPIC_API_KEY.")
  );
}
