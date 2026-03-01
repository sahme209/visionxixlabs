/**
 * Gemini provider.
 */

import type { GenerateTextOptions, GenerateTextResult } from "./types";

export async function generateText(
  opts: GenerateTextOptions
): Promise<GenerateTextResult> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new Error("GEMINI_API_KEY not set");

  const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";
  const maxTokens = opts.maxTokens ?? 4096;
  const temperature = opts.temperature ?? 0.4;

  const { GoogleGenAI } = await import("@google/genai");
  const ai = new GoogleGenAI({ apiKey });

  const system = opts.system ?? "";
  const userContent = opts.prompt ?? opts.messages?.filter((m) => m.role === "user").pop()?.content ?? "";
  const fullContent = system ? `${system}\n\n---\n\n${userContent}` : userContent;

  const response = await ai.models.generateContent({
    model,
    contents: fullContent,
    config: {
      maxOutputTokens: maxTokens,
      temperature,
      ...(opts.jsonSchema ? { responseMimeType: "application/json" } : {}),
    },
  });

  const text = (response.text ?? "").trim();
  const usage = response.usageMetadata;

  return {
    text,
    usage: usage
      ? {
          inputTokens: usage.promptTokenCount ?? 0,
          outputTokens: usage.candidatesTokenCount ?? usage.totalTokenCount ?? 0,
        }
      : undefined,
  };
}
