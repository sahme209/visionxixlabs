/**
 * Anthropic Messages API adapter. It deliberately uses the shared request
 * helper rather than an SDK so request timeouts, error handling, and secret
 * boundaries match every other governed provider.
 */

import "server-only";
import {
  AIProviderError, type AIClassifyResponse, type AIHealthCheck, type AIProvider,
  type AIRequestOptions, type AIStreamChunk, type AIStructuredResponse, type AITextResponse,
} from "../AIProvider";
import { aiFetch, extractJsonBlock, safeJson } from "../aiFetch";
import { defaultModelFor } from "../AIModelRegistry";

interface AnthropicResponse {
  content?: Array<{ type?: string; text?: string }>;
  stop_reason?: string;
  model?: string;
  usage?: { input_tokens?: number; output_tokens?: number };
}

const FINISH: Record<string, AITextResponse["finishReason"]> = {
  end_turn: "stop", max_tokens: "length", stop_sequence: "stop", tool_use: "stop",
};

export class AnthropicProvider implements AIProvider {
  readonly name = "anthropic" as const;
  readonly defaultModel: string;
  private readonly apiKey: string;

  constructor(env: { apiKey?: string; modelName?: string }) {
    this.apiKey = env.apiKey ?? "";
    this.defaultModel = env.modelName ?? defaultModelFor("anthropic");
  }

  isConfigured(): boolean { return Boolean(this.apiKey); }

  private async call(prompt: string, options?: AIRequestOptions): Promise<AITextResponse> {
    if (!this.isConfigured()) throw new AIProviderError({ provider: this.name, kind: "not_configured", message: "ANTHROPIC_API_KEY not set" });
    const model = options?.model ?? this.defaultModel;
    const { res, latencyMs } = await aiFetch({
      provider: this.name,
      url: "https://api.anthropic.com/v1/messages",
      headers: { "x-api-key": this.apiKey, "anthropic-version": "2023-06-01" },
      body: {
        model,
        max_tokens: options?.maxTokens ?? 1024,
        temperature: typeof options?.temperature === "number" ? Math.max(0, Math.min(2, options.temperature)) : 0.4,
        ...(options?.system ? { system: options.system } : {}),
        messages: [{ role: "user", content: prompt }],
      },
      timeoutMs: options?.timeoutMs,
    });
    const json = safeJson<AnthropicResponse>(await res.text());
    if (!json) throw new AIProviderError({ provider: this.name, kind: "bad_response", message: "non-JSON response", latencyMs });
    const text = json.content?.filter((block) => block.type === "text").map((block) => block.text ?? "").join("") ?? "";
    return {
      text, provider: this.name, model: json.model ?? model, latencyMs,
      finishReason: FINISH[json.stop_reason ?? "end_turn"] ?? "unknown",
      usage: json.usage ? { promptTokens: json.usage.input_tokens, completionTokens: json.usage.output_tokens, totalTokens: (json.usage.input_tokens ?? 0) + (json.usage.output_tokens ?? 0) } : null,
    };
  }

  generateText(prompt: string, options?: AIRequestOptions): Promise<AITextResponse> { return this.call(prompt, options); }
  async *streamText(prompt: string, options?: AIRequestOptions): AsyncIterable<AIStreamChunk> {
    const result = await this.call(prompt, options);
    yield { text: result.text, done: false };
    yield { text: "", done: true, finishReason: result.finishReason };
  }
  summarize(text: string, options?: AIRequestOptions): Promise<AITextResponse> { return this.call(text, { ...options, system: options?.system ?? "Summarize the user's text in 2–3 factual sentences." }); }
  async classify(text: string, labels: readonly string[], options?: AIRequestOptions): Promise<AIClassifyResponse> {
    const response = await this.call(text, { ...options, system: options?.system ?? `Classify the text into exactly one of: ${labels.join(", ")}. Reply only with JSON {"label":"...","score":0..1}.` });
    const parsed = safeJson<{ label?: string; score?: number }>(extractJsonBlock(response.text)) ?? {};
    const label = labels.find((item) => item.toLowerCase() === String(parsed.label ?? "").toLowerCase()) ?? labels[0] ?? "unknown";
    const score = typeof parsed.score === "number" ? Math.max(0, Math.min(1, parsed.score)) : 0.5;
    const scores = labels.map((item) => ({ label: item, score: item === label ? score : (1 - score) / Math.max(1, labels.length - 1) })).sort((a, b) => b.score - a.score);
    return { label, score, scores, provider: this.name, model: response.model, latencyMs: response.latencyMs };
  }
  async extractStructuredData<T = unknown>(text: string, schemaHint: string, options?: AIRequestOptions): Promise<AIStructuredResponse<T>> {
    const response = await this.call(text, { ...options, system: options?.system ?? `Extract JSON matching this schema: ${schemaHint}. Reply with strictly one JSON object.`, temperature: options?.temperature ?? 0 });
    const raw = extractJsonBlock(response.text);
    const data = safeJson<T>(raw);
    if (data === null) throw new AIProviderError({ provider: this.name, kind: "bad_response", message: "non-JSON extraction", latencyMs: response.latencyMs });
    return { data, raw, provider: this.name, model: response.model, latencyMs: response.latencyMs };
  }
  async healthCheck(options?: AIRequestOptions): Promise<AIHealthCheck> {
    if (!this.isConfigured()) return { ok: false, provider: this.name, model: this.defaultModel, latencyMs: 0, reason: "not_configured" };
    try {
      const result = await this.call("Reply with the single token: OK", { ...options, maxTokens: 8, temperature: 0, timeoutMs: options?.timeoutMs ?? 10_000 });
      return { ok: result.text.toUpperCase().includes("OK"), provider: this.name, model: result.model, latencyMs: result.latencyMs, reason: result.text.toUpperCase().includes("OK") ? undefined : "response_did_not_include_ok" };
    } catch (error) {
      const typed = error as AIProviderError;
      return { ok: false, provider: this.name, model: this.defaultModel, latencyMs: typed?.latencyMs ?? 0, reason: typed?.kind ?? "unknown" };
    }
  }
}
