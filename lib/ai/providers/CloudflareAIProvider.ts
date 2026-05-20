/**
 * CloudflareAIProvider — Workers AI free tier.
 *
 * Endpoint: https://api.cloudflare.com/client/v4/accounts/${id}/ai/run/${model}
 * Auth:     Authorization: Bearer CLOUDFLARE_API_TOKEN
 *
 * Workers AI exposes a "messages" array compatible with OpenAI's role
 * format. Response shape: { result: { response: "..." } }.
 */

import "server-only";
import {
  AIProviderError, type AIClassifyResponse, type AIHealthCheck,
  type AIProvider, type AIRequestOptions, type AIStreamChunk,
  type AIStructuredResponse, type AITextResponse,
} from "../AIProvider";
import { aiFetch, extractJsonBlock, safeJson } from "../aiFetch";
import { defaultModelFor } from "../AIModelRegistry";

const BASE_URL = "https://api.cloudflare.com/client/v4/accounts";

interface CFResp { result?: { response?: string }; success?: boolean }

export class CloudflareAIProvider implements AIProvider {
  readonly name = "cloudflare" as const;
  readonly defaultModel: string;
  private readonly accountId: string;
  private readonly apiToken: string;

  constructor(env: { accountId?: string; apiToken?: string; modelName?: string }) {
    this.accountId = env.accountId ?? "";
    this.apiToken = env.apiToken ?? "";
    this.defaultModel = env.modelName ?? defaultModelFor("cloudflare");
  }

  isConfigured(): boolean { return Boolean(this.accountId && this.apiToken); }

  private async call(prompt: string, options?: AIRequestOptions): Promise<AITextResponse> {
    if (!this.isConfigured()) {
      throw new AIProviderError({ provider: this.name, kind: "not_configured", message: "CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_API_TOKEN required" });
    }
    const model = options?.model ?? this.defaultModel;
    const url = `${BASE_URL}/${encodeURIComponent(this.accountId)}/ai/run/${model}`;
    const messages: Array<{ role: string; content: string }> = [];
    if (options?.system) messages.push({ role: "system", content: options.system });
    messages.push({ role: "user", content: prompt });
    const { res, latencyMs } = await aiFetch({
      provider: this.name,
      url,
      headers: { authorization: `Bearer ${this.apiToken}` },
      body: {
        messages,
        max_tokens: options?.maxTokens ?? 1024,
        temperature: typeof options?.temperature === "number" ? Math.max(0, Math.min(2, options.temperature)) : 0.4,
      },
      timeoutMs: options?.timeoutMs,
    });
    const json = safeJson<CFResp>(await res.text());
    if (!json || !json.success) {
      throw new AIProviderError({ provider: this.name, kind: "bad_response", message: "cloudflare reported success=false", latencyMs });
    }
    const text = json.result?.response ?? "";
    return {
      text,
      provider: this.name,
      model,
      latencyMs,
      finishReason: text ? "stop" : "error",
      usage: null,
    };
  }

  generateText(prompt: string, options?: AIRequestOptions): Promise<AITextResponse> { return this.call(prompt, options); }

  async *streamText(prompt: string, options?: AIRequestOptions): AsyncIterable<AIStreamChunk> {
    const r = await this.call(prompt, options);
    yield { text: r.text, done: false };
    yield { text: "", done: true, finishReason: r.finishReason };
  }

  summarize(text: string, options?: AIRequestOptions): Promise<AITextResponse> {
    return this.call(text, { ...options, system: options?.system ?? "Summarize in 2-3 sentences." });
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
