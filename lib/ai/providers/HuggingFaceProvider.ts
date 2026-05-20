/**
 * HuggingFaceProvider — HF Inference API (free tier).
 *
 * Endpoint: https://api-inference.huggingface.co/models/${model}
 * Auth:     Authorization: Bearer HUGGINGFACE_API_KEY
 *
 * HF returns a JSON array `[{ "generated_text": "..." }]` for text
 * generation models — not OpenAI-compatible, so we implement the
 * adapter inline.
 */

import "server-only";
import {
  AIProviderError, type AIClassifyResponse, type AIHealthCheck,
  type AIProvider, type AIRequestOptions, type AIStreamChunk,
  type AIStructuredResponse, type AITextResponse,
} from "../AIProvider";
import { aiFetch, extractJsonBlock, safeJson } from "../aiFetch";
import { defaultModelFor } from "../AIModelRegistry";

const BASE_URL = "https://api-inference.huggingface.co/models";

interface HFResponseItem { generated_text?: string }

export class HuggingFaceProvider implements AIProvider {
  readonly name = "hugging_face" as const;
  readonly defaultModel: string;
  private readonly apiKey: string;

  constructor(env: { apiKey?: string; modelName?: string }) {
    this.apiKey = env.apiKey ?? "";
    this.defaultModel = env.modelName ?? defaultModelFor("hugging_face");
  }

  isConfigured(): boolean { return Boolean(this.apiKey); }

  private async callTextGen(prompt: string, options?: AIRequestOptions): Promise<AITextResponse> {
    if (!this.isConfigured()) {
      throw new AIProviderError({ provider: this.name, kind: "not_configured", message: "HUGGINGFACE_API_KEY not set" });
    }
    const model = options?.model ?? this.defaultModel;
    const merged = options?.system ? `[SYSTEM]\n${options.system}\n[USER]\n${prompt}` : prompt;
    const { res, latencyMs } = await aiFetch({
      provider: this.name,
      url: `${BASE_URL}/${encodeURIComponent(model)}`,
      headers: { authorization: `Bearer ${this.apiKey}` },
      body: {
        inputs: merged,
        parameters: {
          max_new_tokens: options?.maxTokens ?? 512,
          temperature: typeof options?.temperature === "number" ? Math.max(0, Math.min(2, options.temperature)) : 0.4,
          return_full_text: false,
        },
        options: { wait_for_model: true },
      },
      timeoutMs: options?.timeoutMs,
    });
    const json = safeJson<HFResponseItem[] | HFResponseItem>(await res.text());
    let text = "";
    if (Array.isArray(json)) text = json[0]?.generated_text ?? "";
    else if (json && typeof json === "object") text = json.generated_text ?? "";
    return {
      text,
      provider: this.name,
      model,
      latencyMs,
      finishReason: text ? "stop" : "error",
      usage: null,
    };
  }

  generateText(prompt: string, options?: AIRequestOptions): Promise<AITextResponse> {
    return this.callTextGen(prompt, options);
  }

  async *streamText(prompt: string, options?: AIRequestOptions): AsyncIterable<AIStreamChunk> {
    const r = await this.callTextGen(prompt, options);
    yield { text: r.text, done: false };
    yield { text: "", done: true, finishReason: r.finishReason };
  }

  summarize(text: string, options?: AIRequestOptions): Promise<AITextResponse> {
    return this.callTextGen(text, {
      ...options,
      system: options?.system ?? "Summarize the following text in 2-3 sentences. Be concise and factual.",
    });
  }

  async classify(text: string, labels: readonly string[], options?: AIRequestOptions): Promise<AIClassifyResponse> {
    const list = labels.join(", ");
    const system = options?.system ?? `Classify the user text into one of: ${list}. Reply only with JSON {"label":"...","score":0..1}.`;
    const resp = await this.callTextGen(text, { ...options, system });
    const parsed = safeJson<{ label?: string; score?: number }>(extractJsonBlock(resp.text)) ?? {};
    const chosen = labels.find((l) => l.toLowerCase() === String(parsed.label ?? "").toLowerCase()) ?? labels[0] ?? "unknown";
    const score = typeof parsed.score === "number" ? Math.max(0, Math.min(1, parsed.score)) : 0.5;
    const scores = labels.map((l) => ({ label: l, score: l === chosen ? score : (1 - score) / Math.max(1, labels.length - 1) }));
    scores.sort((a, b) => b.score - a.score);
    return { label: chosen, score, scores, provider: this.name, model: resp.model, latencyMs: resp.latencyMs };
  }

  async extractStructuredData<T = unknown>(text: string, schemaHint: string, options?: AIRequestOptions): Promise<AIStructuredResponse<T>> {
    const system = options?.system ?? `Extract structured JSON matching:\n${schemaHint}\nReply with strictly one JSON object — no prose.`;
    const resp = await this.callTextGen(text, { ...options, system, temperature: options?.temperature ?? 0 });
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
      const r = await this.callTextGen("Reply with: OK", { ...options, maxTokens: 8, temperature: 0, timeoutMs: options?.timeoutMs ?? 15_000 });
      return { ok: r.text.toUpperCase().includes("OK"), provider: this.name, model: r.model, latencyMs: r.latencyMs };
    } catch (err) {
      const e = err as AIProviderError;
      return { ok: false, provider: this.name, model: this.defaultModel, latencyMs: e?.latencyMs ?? 0, reason: e?.kind ?? "unknown" };
    }
  }
}
