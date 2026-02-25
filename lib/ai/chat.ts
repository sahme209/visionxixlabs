/**
 * AI chat abstraction — OpenAI primary, Gemini fallback.
 * Env: OPENAI_API_KEY (required), GEMINI_API_KEY (optional fallback).
 * MODEL_NAME: gpt-4o-mini | gpt-4o | gpt-4.1 (default: gpt-4o for smarter answers).
 */

export type ChatMessage = { role: "user" | "assistant" | "system"; content: string };

export interface ChatOptions {
  systemPrompt: string;
  messages: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
}

export interface ChatResult {
  text: string;
  provider: "openai" | "gemini";
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

export async function generateChatResponse(opts: ChatOptions): Promise<ChatResult> {
  let lastError: Error | null = null;

  if (process.env.OPENAI_API_KEY?.trim()) {
    try {
      return await chatWithOpenAI(opts);
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      if (process.env.GEMINI_API_KEY?.trim()) {
        try {
          return await chatWithGemini(opts);
        } catch (geminiErr) {
          throw lastError;
        }
      }
      throw lastError;
    }
  }

  if (process.env.GEMINI_API_KEY?.trim()) {
    try {
      return await chatWithGemini(opts);
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
    }
  }

  throw lastError ?? new Error("No AI provider configured. Set OPENAI_API_KEY or GEMINI_API_KEY.");
}
