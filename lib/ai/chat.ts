/** Legacy chat response - uses @google/genai */
export interface ChatOptions {
  systemPrompt: string;
  messages: { role: string; content: string }[];
  maxTokens?: number;
  temperature?: number;
}

export interface ChatResult {
  text: string;
}

export async function generateChatResponse(opts: ChatOptions): Promise<ChatResult> {
  const { GoogleGenAI } = await import("@google/genai");
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey?.trim()) throw new Error("GEMINI_API_KEY not set");

  const ai = new GoogleGenAI({ apiKey });
  const prompt = [opts.systemPrompt, ...opts.messages.map((m) => `${m.role}: ${m.content}`)].join("\n\n");

  const response = await ai.models.generateContent({
    model: "gemini-2.0-flash-001",
    contents: prompt,
  });

  const text = response.text ?? "";
  return { text };
}
