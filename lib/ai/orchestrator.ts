/**
 * AI Orchestrator — multi-provider routing by task type.
 * Routes by task type, user plan, and cost caps. Fallback chain with timeout/retry.
 * Server-side only. Use in app/api routes or server actions.
 */

import { openaiGenerate, anthropicGenerate, geminiGenerate } from "@/lib/ai/providers";
import type { ProviderName } from "@/lib/ai/providers";
import { logAIInvocation } from "@/lib/ai/instrumentation";

export type TaskType =
  | "CHAT_FAST"
  | "PLAN_STRONG"
  | "CODE_STRONG"
  | "DESIGN_STRONG"
  | "RAG_ANSWER"
  | "TOOL_CALLING"
  | "SUMMARIZE";

/** Legacy task types — mapped to new TaskType for backward compat */
export type LegacyTaskType =
  | "content_generation"
  | "code_generation"
  | "cloud_automation"
  | "reasoning_planning"
  | "chat";

const LEGACY_TO_NEW: Record<LegacyTaskType, TaskType> = {
  content_generation: "PLAN_STRONG",
  code_generation: "CODE_STRONG",
  cloud_automation: "CODE_STRONG",
  reasoning_planning: "PLAN_STRONG",
  chat: "CHAT_FAST",
};

type UserPlan = "starter" | "growth" | "scale" | "enterprise" | null | undefined;

export interface RouteModelOptions {
  taskType: TaskType | LegacyTaskType;
  userPlan?: UserPlan;
  userId?: string | null;
}

export interface RouteModelResult {
  provider: ProviderName;
  model: string;
  fallbackOrder: ProviderName[];
}

const DEFAULT_MODELS: Record<ProviderName, string> = {
  openai: process.env.OPENAI_MODEL || process.env.MODEL_NAME || "gpt-4o",
  anthropic: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-20250514",
  gemini: process.env.GEMINI_MODEL || "gemini-2.0-flash",
};

/** Per-task-type config: preferred provider, fallback order, model env overrides */
const TASK_CONFIG: Record<
  TaskType,
  { preferred: ProviderName; fallback: ProviderName[]; modelEnv?: Partial<Record<ProviderName, string>> }
> = {
  CHAT_FAST: {
    preferred: "openai",
    fallback: ["openai", "anthropic", "gemini"],
    modelEnv: {
      openai: process.env.AI_MODEL_CHAT || process.env.OPENAI_MODEL,
      anthropic: process.env.AI_MODEL_CHAT_ANTHROPIC || process.env.ANTHROPIC_MODEL,
      gemini: process.env.AI_MODEL_CHAT_GEMINI || process.env.GEMINI_MODEL,
    },
  },
  PLAN_STRONG: {
    preferred: "anthropic",
    fallback: ["anthropic", "openai", "gemini"],
    modelEnv: {
      openai: process.env.AI_MODEL_CONTENT || process.env.OPENAI_MODEL,
      anthropic: process.env.AI_MODEL_CONTENT_ANTHROPIC || process.env.ANTHROPIC_MODEL,
      gemini: process.env.AI_MODEL_CONTENT_GEMINI || process.env.GEMINI_MODEL,
    },
  },
  CODE_STRONG: {
    preferred: "anthropic",
    fallback: ["anthropic", "openai", "gemini"],
    modelEnv: {
      openai: process.env.AI_MODEL_CODE || process.env.OPENAI_MODEL,
      anthropic: process.env.AI_MODEL_CODE_ANTHROPIC || process.env.ANTHROPIC_MODEL,
      gemini: process.env.AI_MODEL_CODE_GEMINI || process.env.GEMINI_MODEL,
    },
  },
  DESIGN_STRONG: {
    preferred: "anthropic",
    fallback: ["anthropic", "openai", "gemini"],
  },
  RAG_ANSWER: {
    preferred: "openai",
    fallback: ["openai", "anthropic", "gemini"],
  },
  TOOL_CALLING: {
    preferred: "openai",
    fallback: ["openai", "anthropic", "gemini"],
  },
  SUMMARIZE: {
    preferred: "openai",
    fallback: ["openai", "gemini", "anthropic"],
  },
};

function hasProvider(p: ProviderName): boolean {
  switch (p) {
    case "openai":
      return !!process.env.OPENAI_API_KEY?.trim();
    case "anthropic":
      return !!process.env.ANTHROPIC_API_KEY?.trim();
    case "gemini":
      return !!process.env.GEMINI_API_KEY?.trim();
    default:
      return false;
  }
}

function getModel(provider: ProviderName, taskType: TaskType): string {
  const cfg = TASK_CONFIG[taskType];
  const envModel = cfg?.modelEnv?.[provider] || process.env[`${provider.toUpperCase()}_MODEL` as const];
  return envModel?.trim() || DEFAULT_MODELS[provider];
}

/**
 * Select provider + model for a task. Considers task type, user plan, and available keys.
 */
export function routeModel(opts: RouteModelOptions): RouteModelResult {
  const task = (LEGACY_TO_NEW[opts.taskType as LegacyTaskType] ?? opts.taskType) as TaskType;
  const cfg = TASK_CONFIG[task] ?? TASK_CONFIG.CHAT_FAST;
  const envPreferred = process.env.AI_PROVIDER?.toLowerCase() as ProviderName | undefined;

  let order = [...cfg.fallback];
  if (envPreferred && ["openai", "anthropic", "gemini"].includes(envPreferred)) {
    order = [envPreferred, ...order.filter((p) => p !== envPreferred)];
  }

  const available = order.filter(hasProvider);
  const provider = available[0] ?? "openai";
  const model = getModel(provider, task);

  return { provider, model, fallbackOrder: available };
}

const PROVIDER_FNS = {
  openai: openaiGenerate,
  anthropic: anthropicGenerate,
  gemini: geminiGenerate,
} as const;

const TIMEOUT_MS = Number(process.env.AI_ORCHESTRATOR_TIMEOUT_MS) || 90_000;
const RETRY_DELAY_MS = 500;

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<never>((_, rej) =>
      setTimeout(() => rej(new Error(`AI request timed out after ${ms}ms`)), ms)
    ),
  ]);
}

export interface GenerateOptions {
  taskType: TaskType | LegacyTaskType;
  systemPrompt?: string;
  userPrompt?: string;
  messages?: { role: "user" | "assistant" | "system"; content: string }[];
  maxTokens?: number;
  temperature?: number;
  responseFormat?: "text" | "json";
  userId?: string | null;
  userPlan?: UserPlan;
}

export interface GenerateResponse {
  text: string;
  toolCalls?: Array<{ name: string; arguments: string }>;
  usage?: { inputTokens: number; outputTokens: number };
  provider: ProviderName;
  model: string;
  latencyMs: number;
  requestId: string;
}

/**
 * Generate via orchestrator — routes to best model, fallback chain, timeout, retry, logging.
 */
export async function generate(opts: GenerateOptions): Promise<GenerateResponse> {
  const task = (LEGACY_TO_NEW[opts.taskType as LegacyTaskType] ?? opts.taskType) as TaskType;
  const { provider, fallbackOrder } = routeModel({
    taskType: task,
    userPlan: opts.userPlan,
    userId: opts.userId,
  });

  const system = opts.systemPrompt ?? opts.messages?.filter((m) => m.role === "system").map((m) => m.content).join("\n") ?? "";
  const prompt = opts.userPrompt ?? opts.messages?.filter((m) => m.role === "user").pop()?.content ?? "";
  const promptPreview = prompt || system ? `${system.slice(0, 100)}...${prompt.slice(0, 80)}` : undefined;

  const requestId = `ai_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const start = Date.now();
  let lastError: Error | null = null;

  for (const p of fallbackOrder) {
    if (!hasProvider(p)) continue;
    try {
      const fn = PROVIDER_FNS[p];
      const result = await withTimeout(
        fn({
          system,
          prompt,
          messages: opts.messages,
          maxTokens: opts.maxTokens,
          temperature: opts.temperature,
          jsonSchema: opts.responseFormat === "json",
        }),
        TIMEOUT_MS
      );
      const latencyMs = Date.now() - start;

      await logAIInvocation({
        userId: opts.userId,
        taskType: task,
        provider: p,
        model: getModel(p, task),
        latencyMs,
        success: true,
        tokensIn: result.usage?.inputTokens,
        tokensOut: result.usage?.outputTokens,
        promptPreview,
        requestId,
      });

      return {
        text: result.text,
        toolCalls: result.toolCalls,
        usage: result.usage,
        provider: p,
        model: getModel(p, task),
        latencyMs,
        requestId,
      };
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      await logAIInvocation({
        userId: opts.userId,
        taskType: task,
        provider: p,
        model: getModel(p, task),
        latencyMs: Date.now() - start,
        success: false,
        errorMessage: lastError.message,
        promptPreview,
        requestId,
      });
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
    }
  }

  throw (
    lastError ??
    new Error("No AI provider configured. Set OPENAI_API_KEY, ANTHROPIC_API_KEY, or GEMINI_API_KEY.")
  );
}

// --- Backward compatibility ---

export type AIProvider = "openai" | "anthropic" | "gemini";

export interface OrchestrateGenerateOptions {
  taskType: LegacyTaskType;
  systemPrompt: string;
  userPrompt: string;
  maxTokens?: number;
  temperature?: number;
  responseFormat?: "text" | "json";
}

export interface OrchestrateChatOptions {
  taskType: LegacyTaskType;
  systemPrompt: string;
  messages: { role: "user" | "assistant" | "system"; content: string }[];
  maxTokens?: number;
  temperature?: number;
}

/**
 * @deprecated Use generate() for new code. Kept for backward compatibility.
 */
export async function orchestrateGenerate(
  opts: OrchestrateGenerateOptions
): Promise<{ text: string; provider: AIProvider }> {
  const res = await generate({
    taskType: opts.taskType,
    systemPrompt: opts.systemPrompt,
    userPrompt: opts.userPrompt,
    maxTokens: opts.maxTokens,
    temperature: opts.temperature,
    responseFormat: opts.responseFormat,
  });
  return { text: res.text, provider: res.provider as AIProvider };
}

/**
 * @deprecated Use generate() for new code. Kept for backward compatibility.
 */
export async function orchestrateChat(
  opts: OrchestrateChatOptions
): Promise<{ text: string; provider: AIProvider }> {
  const res = await generate({
    taskType: opts.taskType,
    systemPrompt: opts.systemPrompt,
    messages: opts.messages,
    maxTokens: opts.maxTokens,
    temperature: opts.temperature,
  });
  return { text: res.text, provider: res.provider as AIProvider };
}
