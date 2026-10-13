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
import { redact } from "@/lib/security/redaction";
import { recordAIUsageEvent } from "@/lib/billing/recordAIUsageEvent";
import { VercelGatewayProvider } from "./providers/VercelGatewayProvider";

let SINGLETON: AIProviderManager | null = null;

export interface AIEnvSnapshot {
  AI_GATEWAY_AUTH: boolean;
  AI_GATEWAY_MODEL: boolean;
  OPENAI_API_KEY: boolean;
  ANTHROPIC_API_KEY: boolean;
  XAI_API_KEY: boolean;
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
      ["vercel_gateway", new VercelGatewayProvider(env.AI_GATEWAY_MODEL)],
    ]);
  }

  /** Production inference is Gateway-only. Missing configuration fails closed. */
  private chain(opts?: { only?: AIProviderName; allowedProviders?: readonly AIProviderName[]; fallbackOrder?: readonly AIProviderName[] }): AIProvider[] {
    const gateway = this.providers.get("vercel_gateway");
    if (!gateway?.isConfigured()) return [];
    if (opts?.only && opts.only !== "vercel_gateway") return [];
    if (opts?.allowedProviders && !opts.allowedProviders.includes("vercel_gateway")) return [];
    return [gateway];
  }

  private optionsForProvider(provider: AIProvider, options?: AIRequestOptions & { only?: AIProviderName }): AIRequestOptions | undefined {
    if (!options) return undefined;
    // A direct request model is already checked by the route. Fallbacks use
    // their own approved selection so a model identifier never crosses into a
    // different provider family.
    return { ...options, model: options.model ?? options.modelSelections?.[provider.name] };
  }

  status(): ProviderStatusRow[] {
    return PROVIDER_PRIORITY.map((name, i) => {
      const p = this.providers.get(name)!;
      return { provider: name, configured: p.isConfigured(), defaultModel: p.defaultModel, priority: i };
    });
  }

  /** True only for the configured service Gateway. */
  isServiceProviderAvailable(name: AIProviderName): boolean {
    return name === "vercel_gateway" && this.providers.get(name)?.isConfigured() === true;
  }

  envSnapshot(): AIEnvSnapshot {
    const e = process.env;
    return {
      AI_GATEWAY_AUTH: Boolean(e.AI_GATEWAY_API_KEY || e.VERCEL_OIDC_TOKEN),
      AI_GATEWAY_MODEL: Boolean(e.AI_GATEWAY_MODEL),
      OPENAI_API_KEY: Boolean(e.OPENAI_API_KEY),
      ANTHROPIC_API_KEY: Boolean(e.ANTHROPIC_API_KEY),
      XAI_API_KEY: Boolean(e.XAI_API_KEY),
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
    // Governance boundary: this is the one place every production call
    // path funnels through before a prompt leaves the service for an
    // external provider (Anthropic, OpenAI, etc.). Scrub known secret/
    // credential patterns here — not just at the logging layer — so an
    // accidentally-pasted key or connection string in a user prompt, or
    // in auto-generated release/incident context, never reaches a
    // third-party API unredacted.
    const safePrompt = redact(prompt);
    const out = await runWithFallback<AITextResponse>(
      this.chain({ only: options?.only, allowedProviders: options?.allowedProviders, fallbackOrder: options?.fallbackOrder }),
      (p) => p.generateText(safePrompt, this.optionsForProvider(p, options)),
      { task: "generate_text", correlationId: options?.correlationId, organizationId: options?.organizationId },
    );
    return out.result;
  }

  async summarize(text: string, options?: AIRequestOptions & { only?: AIProviderName }): Promise<AITextResponse> {
    const safeText = redact(text);
    const out = await runWithFallback<AITextResponse>(
      this.chain({ only: options?.only, allowedProviders: options?.allowedProviders, fallbackOrder: options?.fallbackOrder }),
      (p) => p.summarize(safeText, this.optionsForProvider(p, options)),
      { task: "summarize", correlationId: options?.correlationId, organizationId: options?.organizationId },
    );
    return out.result;
  }

  async classify(text: string, labels: readonly string[], options?: AIRequestOptions & { only?: AIProviderName }): Promise<AIClassifyResponse> {
    const safeText = redact(text);
    const out = await runWithFallback<AIClassifyResponse>(
      this.chain({ only: options?.only, allowedProviders: options?.allowedProviders, fallbackOrder: options?.fallbackOrder }),
      (p) => p.classify(safeText, labels, this.optionsForProvider(p, options)),
      { task: "classify", correlationId: options?.correlationId, organizationId: options?.organizationId },
    );
    return out.result;
  }

  async extractStructuredData<T = unknown>(
    text: string,
    schemaHint: string,
    options?: AIRequestOptions & { only?: AIProviderName },
  ): Promise<AIStructuredResponse<T>> {
    const safeText = redact(text);
    const out = await runWithFallback<AIStructuredResponse<T>>(
      this.chain({ only: options?.only, allowedProviders: options?.allowedProviders, fallbackOrder: options?.fallbackOrder }),
      (p) => p.extractStructuredData<T>(safeText, schemaHint, this.optionsForProvider(p, options)),
      { task: "extract_structured_data", correlationId: options?.correlationId, organizationId: options?.organizationId },
    );
    if (options?.organizationId && out.result.provider === "vercel_gateway") {
      const usage = out.result.usage;
      const recorded = await recordAIUsageEvent({
        organizationId: options.organizationId,
        provider: out.result.provider,
        model: out.result.model,
        inputTokens: usage?.promptTokens ?? 0,
        outputTokens: usage?.completionTokens ?? 0,
        externalUsageId: out.result.gatewayGenerationId,
        correlationId: options.correlationId,
        metadata: { task: "extract_structured_data" },
      });
      if (!recorded.recorded) {
        throw new AIProviderError({
          provider: "vercel_gateway",
          kind: "bad_response",
          message: "AI Gateway usage could not be reserved for settlement",
          retryable: true,
        });
      }
    }
    return out.result;
  }

  async *streamText(prompt: string, options?: AIRequestOptions & { only?: AIProviderName }): AsyncIterable<AIStreamChunk> {
    // Streaming uses the first configured provider; we don't try to
    // re-stream from a fallback mid-stream. If it fails before yielding,
    // we surface a single error chunk and end.
    const chain = this.chain({ only: options?.only, allowedProviders: options?.allowedProviders, fallbackOrder: options?.fallbackOrder });
    const head = chain[0];
    // A workspace-governed request has no mock fallback. If the policy
    // resolves to no live provider, end the stream honestly instead of
    // dereferencing an empty chain or fabricating a response.
    if (!head) {
      yield { text: "", done: true, finishReason: "error" };
      return;
    }
    const t0 = Date.now();
    try {
      for await (const chunk of head.streamText(redact(prompt), this.optionsForProvider(head, options))) {
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

  async healthCheckAll(allowedProviders?: readonly AIProviderName[]): Promise<AIHealthCheck[]> {
    const rows: AIHealthCheck[] = [];
    const allowed = allowedProviders ? new Set(allowedProviders) : null;
    for (const name of PROVIDER_PRIORITY) {
      if (allowed && !allowed.has(name)) continue;
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
