/**
 * Unified AI provider — OpenAI, Google Gemini, Anthropic Claude.
 * Env: AI_PROVIDER (optional, "openai"|"gemini"|"anthropic") to set priority.
 * Falls back in order: OpenAI → Gemini → Anthropic.
 * Required: at least one of OPENAI_API_KEY, GEMINI_API_KEY, ANTHROPIC_API_KEY.
 */

export type AIProvider = "openai" | "gemini" | "anthropic";

export interface GenerateOptions {
  systemPrompt: string;
  userPrompt: string;
  maxTokens?: number;
  temperature?: number;
  responseFormat?: "text" | "json";
  /** Orchestrator override: force provider and optionally model */
  _orchestratorProvider?: AIProvider;
  _orchestratorTaskType?: string;
}

export interface GenerateResult {
  text: string;
  provider: AIProvider;
}

function getProviderOrder(opts?: { _orchestratorProvider?: AIProvider }): AIProvider[] {
  if (opts?._orchestratorProvider) {
    return [opts._orchestratorProvider];
  }
  const preferred = process.env.AI_PROVIDER?.toLowerCase();
  const order: AIProvider[] = ["openai", "gemini", "anthropic"];
  if (preferred === "gemini" || preferred === "anthropic" || preferred === "openai") {
    return [preferred, ...order.filter((p) => p !== preferred)];
  }
  return order;
}

function hasProvider(p: AIProvider): boolean {
  switch (p) {
    case "openai":
      return !!process.env.OPENAI_API_KEY?.trim();
    case "gemini":
      return !!process.env.GEMINI_API_KEY?.trim();
    case "anthropic":
      return !!process.env.ANTHROPIC_API_KEY?.trim();
    default:
      return false;
  }
}

async function generateWithOpenAI(opts: GenerateOptions): Promise<GenerateResult> {
  const OpenAI = (await import("openai")).default;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey?.trim()) throw new Error("OPENAI_API_KEY not set");

  const model = process.env.OPENAI_MODEL || process.env.MODEL_NAME || "gpt-4o";
  const maxTokens = opts.maxTokens ?? 4096;
  const temperature = opts.temperature ?? 0.4;

  const openai = new OpenAI({ apiKey });
  const completion = await openai.chat.completions.create({
    model,
    messages: [
      { role: "system", content: opts.systemPrompt },
      { role: "user", content: opts.userPrompt },
    ],
    max_tokens: maxTokens,
    temperature,
    ...(opts.responseFormat === "json" ? { response_format: { type: "json_object" } } : {}),
  });

  const text = completion.choices?.[0]?.message?.content ?? "";
  return { text, provider: "openai" };
}

async function generateWithGemini(opts: GenerateOptions): Promise<GenerateResult> {
  const { GoogleGenAI } = await import("@google/genai");
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey?.trim()) throw new Error("GEMINI_API_KEY not set");

  const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";
  const maxTokens = opts.maxTokens ?? 4096;
  const temperature = opts.temperature ?? 0.4;

  const ai = new GoogleGenAI({ apiKey });
  const fullPrompt = `${opts.systemPrompt}\n\n---\n\n${opts.userPrompt}`;

  const response = await ai.models.generateContent({
    model,
    contents: fullPrompt,
    config: {
      maxOutputTokens: maxTokens,
      temperature,
      ...(opts.responseFormat === "json" ? { responseMimeType: "application/json" } : {}),
    },
  });

  const text = (response.text ?? "").trim();
  return { text, provider: "gemini" };
}

async function generateWithAnthropic(opts: GenerateOptions): Promise<GenerateResult> {
  const Anthropic = (await import("@anthropic-ai/sdk")).default;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey?.trim()) throw new Error("ANTHROPIC_API_KEY not set");

  const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-20250514";
  const maxTokens = opts.maxTokens ?? 4096;
  const temperature = opts.temperature ?? 0.4;

  const client = new Anthropic({ apiKey });
  const message = await client.messages.create({
    model,
    max_tokens: maxTokens,
    temperature,
    system: opts.systemPrompt,
    messages: [{ role: "user", content: opts.userPrompt }],
  });

  const block = message.content.find((b) => b.type === "text");
  const text = block && "text" in block ? block.text : "";
  return { text, provider: "anthropic" };
}

const PROVIDER_IMPL: Record<AIProvider, (opts: GenerateOptions) => Promise<GenerateResult>> = {
  openai: generateWithOpenAI,
  gemini: generateWithGemini,
  anthropic: generateWithAnthropic,
};

/**
 * Generate completion using best available provider.
 * Tries providers in AI_PROVIDER order, then fallback chain.
 */
export async function generateCompletion(opts: GenerateOptions): Promise<GenerateResult> {
  const order = getProviderOrder(opts);
  let lastError: Error | null = null;

  for (const p of order) {
    if (!hasProvider(p)) continue;
    try {
      return await PROVIDER_IMPL[p](opts);
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
    }
  }

  throw (
    lastError ??
    new Error(
      "No AI provider configured. Set OPENAI_API_KEY, GEMINI_API_KEY, or ANTHROPIC_API_KEY."
    )
  );
}

/** Check which providers are configured (for UI / health) */
export function getAvailableProviders(): AIProvider[] {
  return (["openai", "gemini", "anthropic"] as const).filter(hasProvider);
}
