/**
 * AI chat abstraction — OpenAI, Gemini, Anthropic.
 * Env: AI_PROVIDER (optional) or fallback order: OpenAI → Gemini → Anthropic.
 */

export type ChatMessage = { role: "user" | "assistant" | "system"; content: string };

export interface ChatOptions {
  systemPrompt: string;
  messages: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
  /** Orchestrator override: force provider */
  _orchestratorProvider?: "openai" | "gemini" | "anthropic";
  _orchestratorTaskType?: string;
}

export interface ChatResult {
  text: string;
  provider: "openai" | "gemini" | "anthropic";
}

async function chatWithOpenAI(opts: ChatOptions): Promise<ChatResult> {
  const OpenAI = (await import("openai")).default;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey?.trim()) throw new Error("OPENAI_API_KEY not set");

  const model = process.env.MODEL_NAME || "gpt-4o";
  const maxTokens = opts.maxTokens ?? 1536;
  const temperature = opts.temperature ?? 0.4;

  const openai = new OpenAI({ apiKey });
  const msgs = opts.messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: String(m.content).slice(0, 4000),
    }));

  const completion = await openai.chat.completions.create({
    model,
    messages: [{ role: "system", content: opts.systemPrompt }, ...msgs.slice(-20)],
    max_tokens: maxTokens,
    temperature,
  });

  const text = completion.choices?.[0]?.message?.content ?? "";
  return { text, provider: "openai" };
}

async function chatWithGemini(opts: ChatOptions): Promise<ChatResult> {
  const { GoogleGenAI } = await import("@google/genai");
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey?.trim()) throw new Error("GEMINI_API_KEY not set");

  const ai = new GoogleGenAI({ apiKey });
  const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";
  const msgs = opts.messages
    .filter((m) => m.role !== "system")
    .slice(-20)
    .map((m) => ({
      role: m.role === "assistant" ? ("model" as const) : ("user" as const),
      parts: [{ text: String(m.content).slice(0, 4000) }],
    }));

  const lastUserIdx = msgs.map((h) => h.role).lastIndexOf("user");
  const lastUserMsg =
    (lastUserIdx >= 0 ? msgs[lastUserIdx]?.parts[0]?.text : msgs[msgs.length - 1]?.parts[0]?.text) ?? "";
  const priorHistory = lastUserIdx >= 0 ? msgs.slice(0, lastUserIdx) : [];

  if (!lastUserMsg.trim()) throw new Error("No user message to respond to");

  const chat = await ai.chats.create({
    model,
    config: {
      systemInstruction: opts.systemPrompt,
      maxOutputTokens: opts.maxTokens ?? 1536,
      temperature: opts.temperature ?? 0.4,
    },
    history: priorHistory,
  });

  const response = await chat.sendMessage({ message: lastUserMsg });
  const text = response.text ?? "";
  return { text, provider: "gemini" };
}

async function chatWithAnthropic(opts: ChatOptions): Promise<ChatResult> {
  const Anthropic = (await import("@anthropic-ai/sdk")).default;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey?.trim()) throw new Error("ANTHROPIC_API_KEY not set");

  const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-20250514";
  const maxTokens = opts.maxTokens ?? 1536;
  const temperature = opts.temperature ?? 0.4;

  const msgs = opts.messages
    .filter((m) => m.role !== "system")
    .slice(-20)
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: String(m.content).slice(0, 4000),
    }));

  const client = new Anthropic({ apiKey });
  const message = await client.messages.create({
    model,
    max_tokens: maxTokens,
    temperature,
    system: opts.systemPrompt,
    messages: msgs,
  });

  const block = message.content.find((b) => b.type === "text");
  const text = block && "text" in block ? block.text : "";
  return { text, provider: "anthropic" };
}

function getChatProviderOrder(opts?: ChatOptions): ("openai" | "gemini" | "anthropic")[] {
  if (opts?._orchestratorProvider) {
    return [opts._orchestratorProvider];
  }
  const preferred = process.env.AI_PROVIDER?.toLowerCase();
  const order: ("openai" | "gemini" | "anthropic")[] = ["openai", "gemini", "anthropic"];
  if (preferred === "gemini" || preferred === "anthropic" || preferred === "openai") {
    return [preferred, ...order.filter((p) => p !== preferred)];
  }
  return order;
}

const CHAT_PROVIDERS = {
  openai: chatWithOpenAI,
  gemini: chatWithGemini,
  anthropic: chatWithAnthropic,
} as const;

function hasChatProvider(p: "openai" | "gemini" | "anthropic"): boolean {
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

export async function generateChatResponse(opts: ChatOptions): Promise<ChatResult> {
  const order = getChatProviderOrder(opts);
  let lastError: Error | null = null;

  for (const p of order) {
    if (!hasChatProvider(p)) continue;
    try {
      return await CHAT_PROVIDERS[p](opts);
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
    }
  }

  throw (
    lastError ??
    new Error("No AI provider configured. Set OPENAI_API_KEY, GEMINI_API_KEY, or ANTHROPIC_API_KEY.")
  );
}
