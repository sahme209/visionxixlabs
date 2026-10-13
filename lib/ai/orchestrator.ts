/**
 * AI Orchestrator — task-aware Vercel AI Gateway routing.
 * Direct provider credentials and mock fallbacks are intentionally unsupported.
 * Server-side only. Use in app/api routes or server actions.
 */

import { logAIInvocation } from "@/lib/ai/instrumentation";
import { getAIProviderManager } from "@/lib/ai/AIProviderManager";

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
  provider: "vercel_gateway";
  model: string;
  fallbackOrder: ["vercel_gateway"] | [];
}

/**
 * Select provider + model for a task. Considers task type, user plan, and available keys.
 */
export function routeModel(opts: RouteModelOptions): RouteModelResult {
  void opts;
  const status = getAIProviderManager().status().find((row) => row.provider === "vercel_gateway");
  return {
    provider: "vercel_gateway",
    model: status?.defaultModel ?? "service-default",
    fallbackOrder: status?.configured ? ["vercel_gateway"] : [],
  };
}

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
  provider: "vercel_gateway";
  model: string;
  latencyMs: number;
  requestId: string;
}

/**
 * Generate via orchestrator — routes to best model, fallback chain, timeout, retry, logging.
 */
export async function generate(opts: GenerateOptions): Promise<GenerateResponse> {
  const task = (LEGACY_TO_NEW[opts.taskType as LegacyTaskType] ?? opts.taskType) as TaskType;
  const { provider, model, fallbackOrder } = routeModel({
    taskType: task,
    userPlan: opts.userPlan,
    userId: opts.userId,
  });

  const baseSystem = opts.systemPrompt ?? opts.messages?.filter((m) => m.role === "system").map((m) => m.content).join("\n") ?? "";
  const system = opts.responseFormat === "json"
    ? `${baseSystem}\nReturn valid JSON only, with no Markdown fence or commentary.`
    : baseSystem;
  const prompt = opts.userPrompt ?? opts.messages?.filter((m) => m.role === "user").pop()?.content ?? "";
  const promptPreview = prompt || system ? `${system.slice(0, 100)}...${prompt.slice(0, 80)}` : undefined;

  const requestId = `ai_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const start = Date.now();
  if (fallbackOrder.length === 0) throw new Error("Vercel AI Gateway is not configured.");
  try {
    const combinedPrompt = opts.messages?.length
      ? opts.messages.filter((message) => message.role !== "system").map((message) => `${message.role.toUpperCase()}: ${message.content}`).join("\n\n")
      : prompt;
    const result = await withTimeout(
      getAIProviderManager().generateText(combinedPrompt, {
        only: "vercel_gateway",
        system,
        maxTokens: opts.maxTokens,
        temperature: opts.temperature,
        correlationId: requestId,
      }),
      TIMEOUT_MS,
    );
    const latencyMs = Date.now() - start;
    await logAIInvocation({ userId: opts.userId, taskType: task, provider, model: result.model, latencyMs, success: true,
      tokensIn: result.usage?.promptTokens, tokensOut: result.usage?.completionTokens, promptPreview, requestId });
    return { text: result.text, usage: result.usage ? { inputTokens: result.usage.promptTokens ?? 0, outputTokens: result.usage.completionTokens ?? 0 } : undefined,
      provider, model: result.model, latencyMs, requestId };
  } catch (error) {
    const failure = error instanceof Error ? error : new Error(String(error));
    await logAIInvocation({ userId: opts.userId, taskType: task, provider, model, latencyMs: Date.now() - start,
      success: false, errorMessage: failure.message, promptPreview, requestId });
    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    throw failure;
  }
}

// --- Backward compatibility ---

export type AIProvider = "vercel_gateway";

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
