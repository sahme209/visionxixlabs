/**
 * OpenAI-compatible adapter — shared by GitHub Models, Groq, OpenRouter,
 * Ollama, LM Studio. Every one of these exposes a /v1/chat/completions
 * endpoint that follows the OpenAI shape, so we factor the parsing +
 * timing once and let each provider pass its base URL + auth header.
 *
 * Implementations should NEVER throw — they return AIProviderError
 * with a typed kind so the fallback handler can pick the next provider.
 */

import "server-only";
import {
  AIProviderError, type AIClassifyResponse, type AIHealthCheck,
  type AIProvider, type AIProviderName, type AIRequestOptions,
  type AIStreamChunk, type AIStructuredResponse, type AITextResponse,
} from "../AIProvider";
import { aiFetch, extractJsonBlock, safeJson } from "../aiFetch";

export interface OpenAICompatConfig {
  provider: AIProviderName;
  defaultModel: string;
  baseUrl: string;
  /** Bearer token; if empty string we treat the provider as not configured. */
  apiKey: string;
  /** True if a missing key is OK (Ollama / LM Studio). */
  allowEmptyKey?: boolean;
  /** Optional extra headers (e.g. OpenRouter referer). */
  extraHeaders?: Record<string, string>;
}

interface ChatCompletionResp {
  choices?: Array<{
    message?: { role?: string; content?: string };
    finish_reason?: string;
  }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
  model?: string;
}

const FINISH: Record<string, AITextResponse["finishReason"]> = {
  stop: "stop", length: "length", content_filter: "filter", function_call: "stop", tool_calls: "stop",
};

const clampTemp = (t?: number): number => (typeof t !== "number" ? 0.4 : Math.max(0, Math.min(2, t)));

export class OpenAICompatProvider implements AIProvider {
  readonly name: AIProviderName;
  readonly defaultModel: string;
  protected readonly cfg: OpenAICompatConfig;

  constructor(cfg: OpenAICompatConfig) {
    this.name = cfg.provider;
    this.defaultModel = cfg.defaultModel;
    this.cfg = cfg;
  }

  isConfigured(): boolean {
    if (this.cfg.allowEmptyKey) return Boolean(this.cfg.baseUrl);
    return Boolean(this.cfg.apiKey) && Boolean(this.cfg.baseUrl);
  }

  protected buildHeaders(): Record<string, string> {
    const h: Record<string, string> = { ...(this.cfg.extraHeaders ?? {}) };
    if (this.cfg.apiKey) h["authorization"] = `Bearer ${this.cfg.apiKey}`;
    return h;
  }

  protected chatBody(prompt: string, opts: AIRequestOptions | undefined): Record<string, unknown> {
    const messages: Array<{ role: string; content: string }> = [];
    if (opts?.system) messages.push({ role: "system", content: opts.system });
    messages.push({ role: "user", content: prompt });
    return {
      model: opts?.model ?? this.defaultModel,
      messages,
      temperature: clampTemp(opts?.temperature),
      max_tokens: opts?.maxTokens ?? 1024,
      stream: false,
    };
  }

  async generateText(prompt: string, options?: AIRequestOptions): Promise<AITextResponse> {
    if (!this.isConfigured()) {
      throw new AIProviderError({ provider: this.name, kind: "not_configured", message: `${this.name} not configured`, retryable: false });
    }
    const { res, latencyMs } = await aiFetch({
      provider: this.name,
      url: `${this.cfg.baseUrl}/chat/completions`,
      headers: this.buildHeaders(),
      body: this.chatBody(prompt, options),
      timeoutMs: options?.timeoutMs,
    });
    const json = safeJson<ChatCompletionResp>(await res.text());
    if (!json) {
      throw new AIProviderError({ provider: this.name, kind: "bad_response", message: "non-JSON response", latencyMs });
    }
    const choice = json.choices?.[0];
    const text = choice?.message?.content ?? "";
    return {
      text,
      provider: this.name,
      model: json.model ?? options?.model ?? this.defaultModel,
      latencyMs,
      finishReason: FINISH[choice?.finish_reason ?? "stop"] ?? "unknown",
      usage: json.usage
        ? { promptTokens: json.usage.prompt_tokens, completionTokens: json.usage.completion_tokens, totalTokens: json.usage.total_tokens }
        : null,
    };
  }

  async *streamText(prompt: string, options?: AIRequestOptions): AsyncIterable<AIStreamChunk> {
    // Many free endpoints don't honor stream=true reliably — we degrade
    // to a single chunk so the contract is preserved without spamming
    // partial bytes. Providers that want true SSE can override this.
    const full = await this.generateText(prompt, options);
    yield { text: full.text, done: false };
    yield { text: "", done: true, finishReason: full.finishReason };
  }

  async summarize(text: string, options?: AIRequestOptions): Promise<AITextResponse> {
    return this.generateText(text, {
      ...options,
      system: options?.system ?? "Summarize the user's text in 2–3 sentences. Be concise and factual.",
    });
  }

  async classify(text: string, labels: readonly string[], options?: AIRequestOptions): Promise<AIClassifyResponse> {
    const list = labels.join(", ");
    const system =
      options?.system ??
      `Classify the user's text into exactly one of: ${list}. Reply with strictly a JSON object: {"label": "<one of the labels>", "score": <0..1>}.`;
    const resp = await this.generateText(text, { ...options, system });
    const parsed = safeJson<{ label?: string; score?: number }>(extractJsonBlock(resp.text)) ?? {};
    const chosen = labels.find((l) => l.toLowerCase() === String(parsed.label ?? "").toLowerCase()) ?? labels[0] ?? "unknown";
    const score = typeof parsed.score === "number" ? Math.max(0, Math.min(1, parsed.score)) : 0.5;
    const scores = labels.map((l) => ({ label: l, score: l === chosen ? score : (1 - score) / Math.max(1, labels.length - 1) }));
    scores.sort((a, b) => b.score - a.score);
    return { label: chosen, score, scores, provider: this.name, model: resp.model, latencyMs: resp.latencyMs };
  }

  async extractStructuredData<T = unknown>(text: string, schemaHint: string, options?: AIRequestOptions): Promise<AIStructuredResponse<T>> {
    const system =
      options?.system ??
      `Extract structured data matching this schema hint:\n${schemaHint}\nReply with strictly a single JSON object — no prose.`;
    const resp = await this.generateText(text, { ...options, system, temperature: options?.temperature ?? 0 });
    const raw = extractJsonBlock(resp.text);
    const data = safeJson<T>(raw);
    if (data === null) {
      throw new AIProviderError({ provider: this.name, kind: "bad_response", message: "non-JSON extraction", latencyMs: resp.latencyMs });
    }
    return { data, raw, provider: this.name, model: resp.model, latencyMs: resp.latencyMs };
  }

  async healthCheck(options?: AIRequestOptions): Promise<AIHealthCheck> {
    if (!this.isConfigured()) {
      return { ok: false, provider: this.name, model: this.defaultModel, latencyMs: 0, reason: "not_configured" };
    }
    try {
      const r = await this.generateText("Reply with the single token: OK", {
        ...options, maxTokens: 8, temperature: 0, timeoutMs: options?.timeoutMs ?? 10_000,
      });
      const ok = r.text.toUpperCase().includes("OK");
      return { ok, provider: this.name, model: r.model, latencyMs: r.latencyMs, reason: ok ? undefined : "response_did_not_include_ok" };
    } catch (err) {
      const e = err as AIProviderError;
      return { ok: false, provider: this.name, model: this.defaultModel, latencyMs: e?.latencyMs ?? 0, reason: e?.kind ?? "unknown" };
    }
  }
}
