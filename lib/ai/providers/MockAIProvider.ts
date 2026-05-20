/**
 * MockAIProvider — deterministic last-resort fallback.
 *
 * No network. No keys. Always succeeds. Used when every real provider
 * is unconfigured / unavailable, so callers never see a hard failure
 * just because the operator hasn't wired GITHUB_TOKEN yet.
 *
 * The text it produces is intentionally honest ("MOCK") so an operator
 * never confuses mock output with a real model's response.
 */

import type {
  AIClassifyResponse, AIHealthCheck, AIProvider, AIRequestOptions,
  AIStreamChunk, AIStructuredResponse, AITextResponse,
} from "../AIProvider";

const NAME = "mock" as const;
const DEFAULT_MODEL = "mock-v1";

const t0 = (): number => Date.now();

function mockText(prompt: string, opts?: AIRequestOptions): string {
  const head = (opts?.system ?? "").slice(0, 60);
  const tail = prompt.slice(0, 60);
  return `[MOCK ${DEFAULT_MODEL}] system="${head}" prompt="${tail}"`;
}

export class MockAIProvider implements AIProvider {
  readonly name = NAME;
  readonly defaultModel = DEFAULT_MODEL;

  isConfigured(): boolean { return true; }

  async generateText(prompt: string, options?: AIRequestOptions): Promise<AITextResponse> {
    const start = t0();
    return {
      text: mockText(prompt, options),
      provider: NAME,
      model: options?.model ?? DEFAULT_MODEL,
      latencyMs: Date.now() - start,
      finishReason: "stop",
      usage: null,
    };
  }

  async *streamText(prompt: string, options?: AIRequestOptions): AsyncIterable<AIStreamChunk> {
    const full = mockText(prompt, options);
    const parts = full.split(" ");
    for (const p of parts) {
      yield { text: `${p} `, done: false };
    }
    yield { text: "", done: true, finishReason: "stop" };
  }

  async summarize(text: string, options?: AIRequestOptions): Promise<AITextResponse> {
    const summary = text.length > 120 ? text.slice(0, 117) + "..." : text;
    return {
      text: `[MOCK summary] ${summary}`,
      provider: NAME,
      model: options?.model ?? DEFAULT_MODEL,
      latencyMs: 0,
      finishReason: "stop",
      usage: null,
    };
  }

  async classify(text: string, labels: readonly string[], options?: AIRequestOptions): Promise<AIClassifyResponse> {
    // Deterministic: pick the label that shares the most lowercased characters
    // with the input text — good enough for tests + UI smoke checks.
    const lower = text.toLowerCase();
    const scored = labels.map((label) => {
      const l = label.toLowerCase();
      let overlap = 0;
      for (const ch of l) if (lower.includes(ch)) overlap += 1;
      return { label, score: labels.length === 0 ? 0 : Math.min(1, overlap / Math.max(1, l.length)) };
    });
    scored.sort((a, b) => b.score - a.score);
    return {
      label: scored[0]?.label ?? "unknown",
      score: scored[0]?.score ?? 0,
      scores: scored,
      provider: NAME,
      model: options?.model ?? DEFAULT_MODEL,
      latencyMs: 0,
    };
  }

  async extractStructuredData<T = unknown>(text: string, schemaHint: string, options?: AIRequestOptions): Promise<AIStructuredResponse<T>> {
    const raw = `{"_mock":true,"echo":${JSON.stringify(text.slice(0, 80))},"schemaHint":${JSON.stringify(schemaHint)}}`;
    return {
      data: JSON.parse(raw) as T,
      raw,
      provider: NAME,
      model: options?.model ?? DEFAULT_MODEL,
      latencyMs: 0,
    };
  }

  async healthCheck(): Promise<AIHealthCheck> {
    return { ok: true, provider: NAME, model: DEFAULT_MODEL, latencyMs: 0 };
  }
}
