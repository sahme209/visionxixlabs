import "server-only";

import { generateText } from "ai";
import {
  AIProviderError,
  type AIClassifyResponse,
  type AIHealthCheck,
  type AIProvider,
  type AIRequestOptions,
  type AIStructuredResponse,
  type AIStreamChunk,
  type AITextResponse,
} from "../AIProvider";

const SERVICE_DEFAULT = "service-default";

function jsonText(value: string): string {
  return value.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
}

export class VercelGatewayProvider implements AIProvider {
  readonly name = "vercel_gateway" as const;
  readonly defaultModel: string;

  constructor(private readonly configuredModel = process.env.AI_GATEWAY_MODEL) {
    this.defaultModel = configuredModel || SERVICE_DEFAULT;
  }

  isConfigured(): boolean {
    return Boolean(this.configuredModel && (process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN));
  }

  private model(options?: AIRequestOptions): string {
    const selected = options?.model;
    const model = selected && selected !== SERVICE_DEFAULT ? selected : this.configuredModel;
    if (!model || !model.includes("/")) {
      throw new AIProviderError({ provider: this.name, kind: "not_configured", message: "AI Gateway model is not configured" });
    }
    return model;
  }

  async generateText(prompt: string, options?: AIRequestOptions): Promise<AITextResponse> {
    if (!this.isConfigured()) {
      throw new AIProviderError({ provider: this.name, kind: "not_configured", message: "AI Gateway is not configured" });
    }
    const startedAt = Date.now();
    const model = this.model(options);
    const correlationTag = options?.correlationId
      ? `correlation:${options.correlationId}`.slice(0, 64)
      : "request:unattributed";
    try {
      const result = await generateText({
        model,
        prompt,
        system: options?.system,
        temperature: options?.temperature,
        maxOutputTokens: options?.maxTokens,
        abortSignal: options?.timeoutMs ? AbortSignal.timeout(options.timeoutMs) : undefined,
        providerOptions: {
          gateway: {
            user: options?.organizationId,
            tags: ["product:axiom-agent", correlationTag],
          },
        },
      });
      const finishReason = result.finishReason === "stop" || result.finishReason === "length" || result.finishReason === "content-filter"
        ? (result.finishReason === "content-filter" ? "filter" : result.finishReason)
        : "unknown";
      return {
        text: result.text,
        provider: this.name,
        model,
        latencyMs: Date.now() - startedAt,
        finishReason,
        usage: {
          promptTokens: result.usage.inputTokens,
          completionTokens: result.usage.outputTokens,
          totalTokens: result.usage.totalTokens,
        },
      };
    } catch (error) {
      if (error instanceof AIProviderError) throw error;
      const message = error instanceof Error ? error.message : "AI Gateway request failed";
      const lower = message.toLowerCase();
      const kind = lower.includes("abort") || lower.includes("timeout") ? "timeout"
        : lower.includes("429") || lower.includes("rate") ? "rate_limited"
        : lower.includes("401") || lower.includes("403") ? "invalid_key"
        : lower.includes("model") ? "model_unavailable"
        : "network";
      throw new AIProviderError({ provider: this.name, kind, message: "AI Gateway request failed", retryable: kind !== "invalid_key", latencyMs: Date.now() - startedAt });
    }
  }

  async *streamText(prompt: string, options?: AIRequestOptions): AsyncIterable<AIStreamChunk> {
    const result = await this.generateText(prompt, options);
    if (result.text) yield { text: result.text, done: false };
    yield { text: "", done: true, finishReason: result.finishReason };
  }

  summarize(text: string, options?: AIRequestOptions): Promise<AITextResponse> {
    return this.generateText(text, { ...options, system: options?.system ?? "Summarize accurately and concisely." });
  }

  async classify(text: string, labels: readonly string[], options?: AIRequestOptions): Promise<AIClassifyResponse> {
    const response = await this.generateText(text, {
      ...options,
      temperature: 0,
      system: `Choose exactly one label from ${JSON.stringify(labels)}. Return JSON only: {"label":"...","score":0.0}`,
    });
    const parsed = JSON.parse(jsonText(response.text)) as { label?: unknown; score?: unknown };
    const label = typeof parsed.label === "string" && labels.includes(parsed.label) ? parsed.label : labels[0] ?? "unknown";
    const score = typeof parsed.score === "number" ? Math.min(1, Math.max(0, parsed.score)) : 0;
    return { label, score, scores: labels.map((candidate) => ({ label: candidate, score: candidate === label ? score : 0 })), provider: this.name, model: response.model, latencyMs: response.latencyMs };
  }

  async extractStructuredData<T>(text: string, schemaHint: string, options?: AIRequestOptions): Promise<AIStructuredResponse<T>> {
    const response = await this.generateText(text, {
      ...options,
      temperature: options?.temperature ?? 0,
      system: `Return valid JSON only. The required shape is: ${schemaHint}`,
    });
    return { data: JSON.parse(jsonText(response.text)) as T, raw: response.text, provider: this.name, model: response.model, latencyMs: response.latencyMs };
  }

  async healthCheck(options?: AIRequestOptions): Promise<AIHealthCheck> {
    if (!this.isConfigured()) return { ok: false, provider: this.name, model: this.defaultModel, latencyMs: 0, reason: "not_configured" };
    const startedAt = Date.now();
    try {
      const response = await this.generateText("Reply with OK.", { ...options, maxTokens: 8, temperature: 0 });
      return { ok: response.finishReason !== "error", provider: this.name, model: response.model, latencyMs: Date.now() - startedAt };
    } catch (error) {
      return { ok: false, provider: this.name, model: this.defaultModel, latencyMs: Date.now() - startedAt, reason: error instanceof AIProviderError ? error.kind : "unknown" };
    }
  }
}
