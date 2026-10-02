/**
 * AIProvider — single contract every provider implements.
 *
 * Design intent:
 *   - Free / free-to-start providers only by default (GitHub Models,
 *     Ollama, LM Studio, Groq, Hugging Face, OpenRouter free, Gemini
 *     free, Cloudflare Workers AI free). Paid OpenAI / Anthropic SDKs
 *     are deliberately NOT used.
 *   - Provider implementations are pure adapters around HTTP — no
 *     vendor SDKs, so swapping or removing one provider doesn't ripple
 *     into the dependency graph.
 *   - All methods return a typed envelope that carries timing + model
 *     metadata so the fallback handler + usage logger can do their job
 *     without re-instrumenting every call site.
 *
 * Pure types — safe to import on the client. Implementations live in
 * lib/ai/providers and are server-only.
 */

export type AIProviderName =
  | "github_models"
  | "ollama"
  | "lm_studio"
  | "groq"
  | "hugging_face"
  | "openrouter"
  | "gemini"
  | "cloudflare"
  | "mock";

export type AITaskKind =
  | "generate_text"
  | "stream_text"
  | "summarize"
  | "classify"
  | "extract_structured_data"
  | "health_check";

export interface AIRequestOptions {
  /** Server-side workspace attribution for audit and usage only; never sent to a provider. */
  organizationId?: string;
  /** Optional override for the provider's default model. */
  model?: string;
  /** Max tokens / max_new_tokens hint. Providers map this best-effort. */
  maxTokens?: number;
  /** 0..2 temperature hint. Clamped per provider. */
  temperature?: number;
  /** Hard timeout in ms (default 30_000). */
  timeoutMs?: number;
  /** Optional system prompt. */
  system?: string;
  /** Optional correlation id, surfaced in logs. */
  correlationId?: string;
}

export interface AITextResponse {
  text: string;
  provider: AIProviderName;
  model: string;
  latencyMs: number;
  finishReason: "stop" | "length" | "filter" | "error" | "unknown";
  /** Provider-reported usage when available; otherwise null. */
  usage: { promptTokens?: number; completionTokens?: number; totalTokens?: number } | null;
}

export interface AIClassifyResponse {
  label: string;
  /** 0..1 confidence. */
  score: number;
  /** All considered labels, scored. Sorted by score desc. */
  scores: Array<{ label: string; score: number }>;
  provider: AIProviderName;
  model: string;
  latencyMs: number;
}

export interface AIStructuredResponse<T = unknown> {
  data: T;
  raw: string;
  provider: AIProviderName;
  model: string;
  latencyMs: number;
}

export interface AIHealthCheck {
  ok: boolean;
  provider: AIProviderName;
  model: string;
  latencyMs: number;
  /** Human-readable reason for failures. Never contains secrets. */
  reason?: string;
}

export type AIStreamChunk = { text: string; done: false } | { text: ""; done: true; finishReason: AITextResponse["finishReason"] };

/**
 * The contract.
 *
 * Implementations MUST:
 *   - Never throw on network errors — return an AIProviderError or a
 *     typed response with finishReason: "error".
 *   - Never log keys, tokens, or full prompts.
 *   - Honour timeoutMs.
 */
export interface AIProvider {
  readonly name: AIProviderName;
  readonly defaultModel: string;
  /** True iff env is wired (keys present, base URLs reachable in principle). */
  isConfigured(): boolean;

  generateText(prompt: string, options?: AIRequestOptions): Promise<AITextResponse>;
  streamText(prompt: string, options?: AIRequestOptions): AsyncIterable<AIStreamChunk>;
  summarize(text: string, options?: AIRequestOptions): Promise<AITextResponse>;
  classify(text: string, labels: readonly string[], options?: AIRequestOptions): Promise<AIClassifyResponse>;
  extractStructuredData<T = unknown>(
    text: string,
    schemaHint: string,
    options?: AIRequestOptions,
  ): Promise<AIStructuredResponse<T>>;
  healthCheck(options?: AIRequestOptions): Promise<AIHealthCheck>;
}

/**
 * Provider-side error type. Carries enough metadata for the fallback
 * handler to decide whether to retry the same provider, switch
 * providers, or give up.
 */
export class AIProviderError extends Error {
  readonly provider: AIProviderName;
  readonly kind:
    | "not_configured"
    | "invalid_key"
    | "rate_limited"
    | "model_unavailable"
    | "timeout"
    | "network"
    | "bad_response"
    | "unknown";
  readonly retryable: boolean;
  readonly latencyMs: number;
  constructor(input: {
    provider: AIProviderName;
    kind: AIProviderError["kind"];
    message: string;
    retryable?: boolean;
    latencyMs?: number;
  }) {
    super(input.message);
    this.name = "AIProviderError";
    this.provider = input.provider;
    this.kind = input.kind;
    this.retryable = input.retryable ?? false;
    this.latencyMs = input.latencyMs ?? 0;
  }
}

/** Helper: redact a secret-looking string for logs. Never logs the secret itself. */
export function redactSecret(s: string | undefined): string {
  if (!s) return "(unset)";
  if (s.length <= 6) return "***";
  return `${s.slice(0, 3)}***${s.slice(-2)}`;
}
