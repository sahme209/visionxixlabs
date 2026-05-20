/**
 * GeminiProvider — Google AI Studio (Gemini) free tier.
 *
 * Endpoint: https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent
 * Auth:     ?key=GEMINI_API_KEY (query string)
 *
 * Distinct request shape: { contents: [{ role, parts: [{ text }] }] }.
 */

import "server-only";
import {
  AIProviderError, type AIClassifyResponse, type AIHealthCheck,
  type AIProvider, type AIRequestOptions, type AIStreamChunk,
  type AIStructuredResponse, type AITextResponse,
} from "../AIProvider";
import { aiFetch, extractJsonBlock, safeJson } from "../aiFetch";
import { defaultModelFor } from "../AIModelRegistry";

const BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";

interface GeminiResp {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number };
}

const FINISH: Record<string, AITextResponse["finishReason"]> = {
  STOP: "stop", MAX_TOKENS: "length", SAFETY: "filter", RECITATION: "filter", OTHER: "unknown",
};

export class GeminiProvider implements AIProvider {
  readonly name = "gemini" as const;
  readonly defaultModel: string;
  private readonly apiKey: string;

  constructor(env: { apiKey?: string; modelName?: string }) {
    this.apiKey = env.apiKey ?? "";
    this.defaultModel = env.modelName ?? defaultModelFor("gemini");
  }

  isConfigured(): boolean { return Boolean(this.apiKey); }

  private async call(prompt: string, options?: AIRequestOptions): Promise<AITextResponse> {
    if (!this.isConfigured()) {
      throw new AIProviderError({ provider: this.name, kind: "not_configured", message: "GEMINI_API_KEY not set" });
    }
    const model = options?.model ?? this.defaultModel;
    const url = `${BASE_URL}/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(this.apiKey)}`;
    // Gemini 2.5 family consumes "thinking" tokens out of maxOutputTokens
    // before producing visible text — small budgets often yield empty
    // responses. Default to a high cap so the visible reply has room.
    const isThinking = model.startsWith("gemini-2.5");
    const requested = options?.maxTokens;
    const maxOutputTokens =
      typeof requested === "number"
        ? requested
        : isThinking ? 4096 : 1024;
    const body: Record<string, unknown> = {
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: typeof options?.temperature === "number" ? Math.max(0, Math.min(2, options.temperature)) : 0.4,
        maxOutputTokens,
      },
    };
    if (options?.system) body.systemInstruction = { role: "system", parts: [{ text: options.system }] };

    const { res, latencyMs } = await aiFetch({
      provider: this.name,
      url,
      body,
      timeoutMs: options?.timeoutMs,
    });
    const json = safeJson<GeminiResp>(await res.text());
    if (!json) {
      throw new AIProviderError({ provider: this.name, kind: "bad_response", message: "non-JSON response", latencyMs });
    }
    const cand = json.candidates?.[0];
    const text = cand?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    return {
      text,
      provider: this.name,
      model,
      latencyMs,
      finishReason: FINISH[cand?.finishReason ?? "STOP"] ?? "unknown",
      usage: json.usageMetadata
        ? {
          promptTokens: json.usageMetadata.promptTokenCount,
          completionTokens: json.usageMetadata.candidatesTokenCount,
          totalTokens: json.usageMetadata.totalTokenCount,
        }
        : null,
    };
  }

  generateText(prompt: string, options?: AIRequestOptions): Promise<AITextResponse> { return this.call(prompt, options); }

  async *streamText(prompt: string, options?: AIRequestOptions): AsyncIterable<AIStreamChunk> {
    const r = await this.call(prompt, options);
    yield { text: r.text, done: false };
    yield { text: "", done: true, finishReason: r.finishReason };
  }

  summarize(text: string, options?: AIRequestOptions): Promise<AITextResponse> {
    return this.call(text, { ...options, system: options?.system ?? "Summarize the user's text in 2-3 sentences." });
  }

  async classify(text: string, labels: readonly string[], options?: AIRequestOptions): Promise<AIClassifyResponse> {
    const list = labels.join(", ");
    const system = options?.system ?? `Classify the user text into one of: ${list}. Reply only with JSON {"label":"...","score":0..1}.`;
    const resp = await this.call(text, { ...options, system });
    const parsed = safeJson<{ label?: string; score?: number }>(extractJsonBlock(resp.text)) ?? {};
    const chosen = labels.find((l) => l.toLowerCase() === String(parsed.label ?? "").toLowerCase()) ?? labels[0] ?? "unknown";
    const score = typeof parsed.score === "number" ? Math.max(0, Math.min(1, parsed.score)) : 0.5;
    const scores = labels.map((l) => ({ label: l, score: l === chosen ? score : (1 - score) / Math.max(1, labels.length - 1) }));
    scores.sort((a, b) => b.score - a.score);
    return { label: chosen, score, scores, provider: this.name, model: resp.model, latencyMs: resp.latencyMs };
  }

  async extractStructuredData<T = unknown>(text: string, schemaHint: string, options?: AIRequestOptions): Promise<AIStructuredResponse<T>> {
    const system = options?.system ?? `Extract JSON matching:\n${schemaHint}\nReply with strictly one JSON object.`;
    const resp = await this.call(text, { ...options, system, temperature: options?.temperature ?? 0 });
    const raw = extractJsonBlock(resp.text);
    const data = safeJson<T>(raw);
    if (data === null) {
      throw new AIProviderError({ provider: this.name, kind: "bad_response", message: "non-JSON extraction", latencyMs: resp.latencyMs });
    }
    return { data, raw, provider: this.name, model: resp.model, latencyMs: resp.latencyMs };
  }

  async healthCheck(options?: AIRequestOptions): Promise<AIHealthCheck> {
    if (!this.isConfigured()) return { ok: false, provider: this.name, model: this.defaultModel, latencyMs: 0, reason: "not_configured" };
    try {
      const r = await this.call("Reply with: OK", { ...options, maxTokens: 8, temperature: 0, timeoutMs: options?.timeoutMs ?? 10_000 });
      return { ok: r.text.toUpperCase().includes("OK"), provider: this.name, model: r.model, latencyMs: r.latencyMs };
    } catch (err) {
      const e = err as AIProviderError;
      return { ok: false, provider: this.name, model: this.defaultModel, latencyMs: e?.latencyMs ?? 0, reason: e?.kind ?? "unknown" };
    }
  }
}
