import {assertOnlineAIDispatch} from "@/lib/ai/installationDispatchMode";
import { consumeCodingProviderDispatchForRequest } from "@/lib/ai/codingRequestQuote";
import {sendSmallSonnet55Messages} from "./sonnet55Messages";
import { boundedAIInput } from "../inputByteBound";
import { denyIsolatedExternalIO } from "@/lib/billing/isolatedApplication/runtime";
import "server-only";

import { generateText, streamText, Output, type TextStreamPart, type ToolSet } from "ai";
import { consumeSmallSonnetDispatch } from "@/lib/billing/smallSonnetRequest";
import { boundedAIOutputTokens } from "@/lib/billing/requestReservationCents";
import { redact } from "@/lib/security/redaction";
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

/** Internal stream envelope. A terminal event is accounting evidence, not an
 * admission grant. Text is display-only and never an executable Agent action. */
export type GatewayAdmittedStreamChunk =
  | { text: string; done: false }
  | { text: ""; done: true; response: AITextResponse };

function jsonText(value: string): string {
  return value.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
}

/** Parsing is separate so admitted callers durably account for a returned
 * paid envelope even when its JSON requires a separately admitted repair. */
export function parseGatewayStructuredResponse<T>(response: AITextResponse): AIStructuredResponse<T> {
  return {
    data: JSON.parse(jsonText(response.text)) as T,
    raw: response.text,
    provider: response.provider,
    model: response.model,
    latencyMs: response.latencyMs,
    usage: response.usage,
    gatewayGenerationId: response.gatewayGenerationId,
  };
}

/** Inspect only bounded status/cause metadata; never expose upstream text or bodies. */
function gatewayStreamFailure(error: unknown, latencyMs: number): AIProviderError {
  let current = error;
  for (let depth = 0; depth < 4 && current && typeof current === "object"; depth++) {
    const value = current as {statusCode?: unknown; cause?: unknown};
    if (value.statusCode === 401) return new AIProviderError({provider: "vercel_gateway", kind: "invalid_key", message: "AI Gateway authentication was rejected.", latencyMs});
    if (value.statusCode === 403) return new AIProviderError({provider: "vercel_gateway", kind: "model_unavailable", message: "The configured AI Gateway account cannot access this model.", latencyMs});
    if (value.statusCode === 404) return new AIProviderError({provider: "vercel_gateway", kind: "model_unavailable", message: "The configured AI Gateway model or provider route is unavailable.", latencyMs});
    current = value.cause;
  }
  return new AIProviderError({provider: "vercel_gateway", kind: "network", message: "AI Gateway stream failed", latencyMs});
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
    let maxTokens: number;
    try {
      maxTokens = boundedAIOutputTokens(options?.maxTokens);
    } catch {
      throw new AIProviderError({ provider: this.name, kind: "bad_response", message: "governed output token bound is invalid" });
    }
    return this.generateTextWithRetries(prompt, { ...options, maxTokens });
  }

  private async generateTextWithRetries(prompt: string, options?: AIRequestOptions, maxRetries?: 0): Promise<AITextResponse> {
    denyIsolatedExternalIO();assertOnlineAIDispatch();
    if (options?.codingDispatch && (options.smallAgentDispatch || options.smallAgent55Dispatch)) {
      throw new AIProviderError({ provider: this.name, kind: "bad_response", message: "coding dispatch cannot be mixed with extraction dispatch" });
    }
    if (!this.isConfigured()) {
      throw new AIProviderError({ provider: this.name, kind: "not_configured", message: "AI Gateway is not configured" });
    }
    const startedAt = Date.now();
    const model = this.model(options);
    if(options?.smallAgent55Dispatch) return sendSmallSonnet55Messages(prompt,{...options,model});
    const correlationTag = options?.correlationId
      ? `correlation:${options.correlationId}`.slice(0, 64)
      : "request:unattributed";
    try {
      const payload = boundedAIInput(prompt, options?.system);
      const coding = options?.codingDispatch
        ? consumeCodingProviderDispatchForRequest(options.codingDispatch, { ...payload, model, maxTokens: options.maxTokens, temperature: options.temperature, organizationId: options.organizationId, correlationId: options.correlationId }, Date.now())
        : undefined;
      const bounded = options?.smallAgentDispatch
        ? consumeSmallSonnetDispatch(options.smallAgentDispatch, { ...options, model, prompt: redact(prompt), system: options.system === undefined ? undefined : redact(options.system) })
        : undefined;
      assertOnlineAIDispatch();
      const result = await generateText({
        // SDK7 defaults to auto even without tools; this adapter is text-only.
        toolChoice: "none",
        model,
        // Scrub after composing schema/label instructions, including callers
        // that reach this provider without going through the manager.
        ...(coding ? { prompt: coding.prompt, ...(coding.system === undefined ? {} : { system: coding.system }) } : payload),
        temperature: coding?.temperature ?? options?.temperature,
        maxOutputTokens: coding?.maxOutputTokens ?? options?.maxTokens,
        ...(maxRetries === 0 || bounded || coding ? { maxRetries: 0 } : {}),
        abortSignal: options?.timeoutMs ? AbortSignal.timeout(options.timeoutMs) : undefined,
        providerOptions: {
          ...(coding ? { anthropic: coding.providerOptions.anthropic } : bounded ? { anthropic: bounded.anthropic } : {}),
          gateway: {
            user: options?.organizationId,
            tags: ["product:axiom-agent", correlationTag],
            ...(coding?.providerOptions.gateway ?? bounded?.gateway ?? {}),
          },
        },
      });
      const finishReason = result.finishReason === "stop" || result.finishReason === "length" || result.finishReason === "content-filter"
        ? (result.finishReason === "content-filter" ? "filter" : result.finishReason)
        : "unknown";
      const gatewayMetadata = result.providerMetadata?.gateway as { generationId?: unknown } | undefined;
      const gatewayGenerationId = typeof gatewayMetadata?.generationId === "string"
        ? gatewayMetadata.generationId
        : undefined;
      if (!gatewayGenerationId) {
        throw new AIProviderError({
          provider: this.name,
          kind: "bad_response",
          message: "AI Gateway response is missing its metering identifier",
          retryable: true,
          latencyMs: Date.now() - startedAt,
        });
      }
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
        gatewayGenerationId,
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

  /** Single SDK attempt for admitted streaming. JSON output is an internal
   * formatting request, never permission or a substitute for final validation.
   * Never buffer text or turn an interrupted response into terminal success. */
  async *streamTextOnce(
    prompt: string,
    options?: AIRequestOptions & { abortSignal?: AbortSignal },
    format?: "json",
  ): AsyncGenerator<GatewayAdmittedStreamChunk, void, unknown> {
    denyIsolatedExternalIO();assertOnlineAIDispatch();
    if (options?.codingDispatch) throw new AIProviderError({ provider: this.name, kind: "bad_response", message: "coding dispatch does not authorize streaming" });
    if (!this.isConfigured()) {
      throw new AIProviderError({ provider: this.name, kind: "not_configured", message: "AI Gateway is not configured" });
    }
    let maxTokens: number;
    try {
      maxTokens = boundedAIOutputTokens(options?.maxTokens);
    } catch {
      throw new AIProviderError({ provider: this.name, kind: "bad_response", message: "governed output token bound is invalid" });
    }
    const model = this.model(options);
    if(options?.smallAgent55Dispatch){
      const response=await sendSmallSonnet55Messages(prompt,{...options,model});
      if(response.text)yield {text:response.text,done:false};
      yield {text:"",done:true,response};return;
    }
    const startedAt = Date.now();
    const controller = new AbortController();
    const signal = AbortSignal.any([
      controller.signal,
      ...(options?.abortSignal ? [options.abortSignal] : []),
      AbortSignal.timeout(options?.timeoutMs ?? 30_000),
    ]);
    let upstream: AsyncIterator<TextStreamPart<ToolSet>> | undefined;
    try {
      signal.throwIfAborted();
      const payload = boundedAIInput(prompt, options?.system);
      const bounded = options?.smallAgentDispatch
        ? consumeSmallSonnetDispatch(options.smallAgentDispatch, { ...options, model, prompt: redact(prompt), system: options.system === undefined ? undefined : redact(options.system) })
        : undefined;
      assertOnlineAIDispatch();
      const result = streamText({
        toolChoice: "none",
        ...(format === "json" && !bounded ? {output: Output.json()} : {}),
        // fullStream below returns a fixed safe error. The SDK default handler
        // logs raw upstream payloads, which may contain prompts or account data.
        onError: () => {},
        model,
        ...payload,
        temperature: options?.temperature,
        maxOutputTokens: maxTokens,
        maxRetries: 0,
        abortSignal: signal,
        providerOptions: { ...(bounded ? { anthropic: bounded.anthropic } : {}), gateway: {
          ...(bounded?.gateway ?? {}),
          user: options?.organizationId,
          tags: ["product:axiom-agent", options?.correlationId ? `correlation:${options.correlationId}`.slice(0, 64) : "request:unattributed"],
        } },
      });
      let finishReason: AITextResponse["finishReason"] | undefined;
      upstream = result.fullStream[Symbol.asyncIterator]();
      while (true) {
        const next = await upstream.next();
        if (next.done) break;
        const part = next.value;
        signal.throwIfAborted();
        if (part.type === "error") throw gatewayStreamFailure(part.error, Date.now() - startedAt);
        if (part.type === "abort") throw new AIProviderError({provider: this.name, kind: "timeout", message: "AI Gateway stream interrupted"});
        if (part.type === "text-delta" && part.text) yield { text: part.text, done: false };
        if (part.type === "finish") {
          if (!["stop", "length", "content-filter"].includes(part.finishReason)) {
            throw new AIProviderError({ provider: this.name, kind: "bad_response", message: "AI Gateway stream did not finish successfully" });
          }
          finishReason = part.finishReason === "content-filter" ? "filter" : part.finishReason as "stop" | "length";
        }
      }
      signal.throwIfAborted();
      if (!finishReason) throw new AIProviderError({ provider: this.name, kind: "bad_response", message: "AI Gateway stream ended without completion" });
      const [usage, metadata] = await Promise.all([result.totalUsage, result.providerMetadata]);
      signal.throwIfAborted();
      const generationId = (metadata?.gateway as { generationId?: unknown } | undefined)?.generationId;
      if (typeof generationId !== "string" || !generationId || ![usage.inputTokens, usage.outputTokens].every(n => Number.isSafeInteger(n) && n! >= 0)) {
        throw new AIProviderError({ provider: this.name, kind: "bad_response", message: "AI Gateway stream is missing metering evidence" });
      }
      yield { text: "", done: true, response: {
        text: "", provider: this.name, model, latencyMs: Date.now() - startedAt, finishReason,
        gatewayGenerationId: generationId,
        usage: { promptTokens: usage.inputTokens, completionTokens: usage.outputTokens, totalTokens: usage.totalTokens },
      } };
    } catch (error) {
      if (error instanceof AIProviderError) throw error;
      if (!signal.aborted) throw gatewayStreamFailure(error, Date.now() - startedAt);
      throw new AIProviderError({ provider: this.name, kind: "timeout", message: "AI Gateway stream failed", latencyMs: Date.now() - startedAt });
    } finally {
      // Includes return()/break from a consumer after any partial text.
      controller.abort();
      await upstream?.return?.();
    }
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
    return parseGatewayStructuredResponse<T>(response);
  }

  /** Internal single-attempt lane: returns the paid envelope before parsing.
   * This is a retry restriction, never a public metering/authorization switch. */
  generateTextOnce(prompt: string, options?: AIRequestOptions): Promise<AITextResponse> {
    let maxTokens: number;
    try {
      maxTokens = boundedAIOutputTokens(options?.maxTokens);
    } catch {
      throw new AIProviderError({ provider: this.name, kind: "bad_response", message: "governed output token bound is invalid" });
    }
    return this.generateTextWithRetries(prompt, {
      ...options,
      maxTokens,
    }, 0);
  }

  generateStructuredTextOnce(text: string, schemaHint: string, options?: AIRequestOptions): Promise<AITextResponse> {
    return this.generateTextOnce(text, {
      ...options,
      temperature: options?.temperature ?? 0,
      system: `Return valid JSON only. The required shape is: ${schemaHint}`,
    });
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
