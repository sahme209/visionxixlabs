/**
 * AIProviderManager — singleton that:
 *   - wires every provider from env (no secrets in logs)
 *   - exposes the priority-ordered list (configured providers first,
 *     then mock)
 *   - delegates each AIProvider method through runWithFallback so a
 *     failure cleanly slides to the next provider
 *
 * Server-only. Lazy-initialized.
 */

import "server-only";
import {
  AIProviderError,
  type AIClassifyResponse, type AIHealthCheck, type AIProvider, type AIProviderName,
  type AIRequestOptions, type AIStreamChunk, type AIStructuredResponse, type AITextResponse,
} from "./AIProvider";
import { PROVIDER_PRIORITY } from "./AIModelRegistry";
import { runWithFallback } from "./AIFallbackHandler";
import { recordUsage } from "./AIUsageLogger";
import { GitHubModelsProvider } from "./providers/GitHubModelsProvider";
import { OllamaProvider } from "./providers/OllamaProvider";
import { LMStudioProvider } from "./providers/LMStudioProvider";
import { GroqProvider } from "./providers/GroqProvider";
import { HuggingFaceProvider } from "./providers/HuggingFaceProvider";
import { OpenRouterProvider } from "./providers/OpenRouterProvider";
import { GeminiProvider } from "./providers/GeminiProvider";
import { CloudflareAIProvider } from "./providers/CloudflareAIProvider";
import { MockAIProvider } from "./providers/MockAIProvider";

let SINGLETON: AIProviderManager | null = null;

export interface AIEnvSnapshot {
  GITHUB_TOKEN: boolean;
  GROQ_API_KEY: boolean;
  HUGGINGFACE_API_KEY: boolean;
  OPENROUTER_API_KEY: boolean;
  GEMINI_API_KEY: boolean;
  CLOUDFLARE_ACCOUNT_ID: boolean;
  CLOUDFLARE_API_TOKEN: boolean;
  OLLAMA_BASE_URL: string;
  LM_STUDIO_BASE_URL: string;
}

export interface ProviderStatusRow {
  provider: AIProviderName;
  configured: boolean;
  defaultModel: string;
  /** Index in the priority list (lower = higher priority). */
  priority: number;
}

export class AIProviderManager {
  private readonly providers: Map<AIProviderName, AIProvider>;

  constructor() {
    const env = process.env;
    this.providers = new Map<AIProviderName, AIProvider>([
      ["github_models", new GitHubModelsProvider({ token: env.GITHUB_TOKEN, modelName: env.GITHUB_MODEL_NAME })],
      ["ollama",        new OllamaProvider({ baseUrl: env.OLLAMA_BASE_URL })],
      ["lm_studio",     new LMStudioProvider({ baseUrl: env.LM_STUDIO_BASE_URL })],
      ["groq",          new GroqProvider({ apiKey: env.GROQ_API_KEY })],
      ["hugging_face",  new HuggingFaceProvider({ apiKey: env.HUGGINGFACE_API_KEY })],
      ["openrouter",    new OpenRouterProvider({ apiKey: env.OPENROUTER_API_KEY })],
      ["gemini",        new GeminiProvider({ apiKey: env.GEMINI_API_KEY })],
      ["cloudflare",    new CloudflareAIProvider({ accountId: env.CLOUDFLARE_ACCOUNT_ID, apiToken: env.CLOUDFLARE_API_TOKEN })],
      ["mock",          new MockAIProvider()],
    ]);
  }

  /** Configured providers in declared priority, then Mock last. */
  private chain(opts?: { only?: AIProviderName }): AIProvider[] {
    if (opts?.only) {
      const p = this.providers.get(opts.only);
      return p ? [p] : [this.providers.get("mock")!];
    }
    const out: AIProvider[] = [];
    for (const name of PROVIDER_PRIORITY) {
      if (name === "mock") continue;
      const p = this.providers.get(name);
      if (p && p.isConfigured()) out.push(p);
    }
    // Mock always last so we never fail entirely.
    out.push(this.providers.get("mock")!);
    return out;
  }

  status(): ProviderStatusRow[] {
    return PROVIDER_PRIORITY.map((name, i) => {
      const p = this.providers.get(name)!;
      return { provider: name, configured: p.isConfigured(), defaultModel: p.defaultModel, priority: i };
    });
  }

  envSnapshot(): AIEnvSnapshot {
    const e = process.env;
    return {
      GITHUB_TOKEN: Boolean(e.GITHUB_TOKEN),
      GROQ_API_KEY: Boolean(e.GROQ_API_KEY),
      HUGGINGFACE_API_KEY: Boolean(e.HUGGINGFACE_API_KEY),
      OPENROUTER_API_KEY: Boolean(e.OPENROUTER_API_KEY),
      GEMINI_API_KEY: Boolean(e.GEMINI_API_KEY),
      CLOUDFLARE_ACCOUNT_ID: Boolean(e.CLOUDFLARE_ACCOUNT_ID),
      CLOUDFLARE_API_TOKEN: Boolean(e.CLOUDFLARE_API_TOKEN),
      OLLAMA_BASE_URL: e.OLLAMA_BASE_URL ? "set" : "default(11434)",
      LM_STUDIO_BASE_URL: e.LM_STUDIO_BASE_URL ? "set" : "default(1234)",
    };
  }

  async generateText(prompt: string, options?: AIRequestOptions & { only?: AIProviderName }): Promise<AITextResponse> {
    const out = await runWithFallback<AITextResponse>(
      this.chain({ only: options?.only }),
      (p) => p.generateText(prompt, options),
      { task: "generate_text", correlationId: options?.correlationId, organizationId: options?.organizationId },
    );
    return out.result;
  }

  async summarize(text: string, options?: AIRequestOptions & { only?: AIProviderName }): Promise<AITextResponse> {
    const out = await runWithFallback<AITextResponse>(
      this.chain({ only: options?.only }),
      (p) => p.summarize(text, options),
      { task: "summarize", correlationId: options?.correlationId, organizationId: options?.organizationId },
    );
    return out.result;
  }

  async classify(text: string, labels: readonly string[], options?: AIRequestOptions & { only?: AIProviderName }): Promise<AIClassifyResponse> {
    const out = await runWithFallback<AIClassifyResponse>(
      this.chain({ only: options?.only }),
      (p) => p.classify(text, labels, options),
      { task: "classify", correlationId: options?.correlationId, organizationId: options?.organizationId },
    );
    return out.result;
  }

  async extractStructuredData<T = unknown>(
    text: string,
    schemaHint: string,
    options?: AIRequestOptions & { only?: AIProviderName },
  ): Promise<AIStructuredResponse<T>> {
    const out = await runWithFallback<AIStructuredResponse<T>>(
      this.chain({ only: options?.only }),
      (p) => p.extractStructuredData<T>(text, schemaHint, options),
      { task: "extract_structured_data", correlationId: options?.correlationId, organizationId: options?.organizationId },
    );
    return out.result;
  }

  async *streamText(prompt: string, options?: AIRequestOptions & { only?: AIProviderName }): AsyncIterable<AIStreamChunk> {
    // Streaming uses the first configured provider; we don't try to
    // re-stream from a fallback mid-stream. If it fails before yielding,
    // we surface a single error chunk and end.
    const chain = this.chain({ only: options?.only });
    const head = chain[0]!;
    const t0 = Date.now();
    try {
      for await (const chunk of head.streamText(prompt, options)) {
        yield chunk;
      }
      recordUsage({
        provider: head.name, model: options?.model ?? head.defaultModel,
        task: "stream_text", latencyMs: Date.now() - t0, status: "ok", correlationId: options?.correlationId, organizationId: options?.organizationId,
      });
    } catch (err) {
      const e = err instanceof AIProviderError ? err : new AIProviderError({ provider: head.name, kind: "unknown", message: "stream failed" });
      recordUsage({
        provider: head.name, model: head.defaultModel, task: "stream_text",
        latencyMs: e.latencyMs || Date.now() - t0, status: "error", errorKind: e.kind, correlationId: options?.correlationId, organizationId: options?.organizationId,
      });
      yield { text: "", done: true, finishReason: "error" };
    }
  }

  async healthCheckAll(): Promise<AIHealthCheck[]> {
    const rows: AIHealthCheck[] = [];
    for (const name of PROVIDER_PRIORITY) {
      const p = this.providers.get(name)!;
      try {
        rows.push(await p.healthCheck({ timeoutMs: 8_000 }));
      } catch (err) {
        const e = err as AIProviderError;
        rows.push({ ok: false, provider: p.name, model: p.defaultModel, latencyMs: e?.latencyMs ?? 0, reason: e?.kind ?? "unknown" });
      }
    }
    return rows;
  }
}

export function getAIProviderManager(): AIProviderManager {
  if (SINGLETON === null) SINGLETON = new AIProviderManager();
  return SINGLETON;
}

/** Tests-only: discard the cached singleton (e.g. after env mutation). */
export function _resetAIProviderManagerForTests(): void {
  SINGLETON = null;
}
