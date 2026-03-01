/**
 * OpenAI provider — uses Responses API.
 */

import type { GenerateTextOptions, GenerateTextResult } from "./types";

export async function generateText(
  opts: GenerateTextOptions
): Promise<GenerateTextResult> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error("OPENAI_API_KEY not set");

  const model = process.env.OPENAI_MODEL || process.env.MODEL_NAME || "gpt-4o";
  const maxTokens = opts.maxTokens ?? 4096;
  const temperature = opts.temperature ?? 0.4;

  const OpenAI = (await import("openai")).default;
  const openai = new OpenAI({ apiKey });

  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [];
  if (opts.system) messages.push({ role: "system", content: opts.system });
  if (opts.messages?.length) {
    for (const m of opts.messages) {
      if (m.role !== "system") {
        messages.push({
          role: m.role as "user" | "assistant",
          content: m.content,
        });
      } else if (!opts.system) {
        messages.push({ role: "system", content: m.content });
      }
    }
  }
  if (opts.prompt && !opts.messages?.length) {
    messages.push({ role: "user", content: opts.prompt });
  }

  const completion = await openai.chat.completions.create({
    model,
    messages: messages as Parameters<typeof openai.chat.completions.create>[0]["messages"],
    max_tokens: maxTokens,
    temperature,
    ...(opts.jsonSchema ? { response_format: { type: "json_object" } } : {}),
  });

  const choice = completion.choices?.[0];
  const text = choice?.message?.content ?? "";
  const rawCalls = (choice?.message as { tool_calls?: Array<{ function?: { name?: string; arguments?: string } }> } | undefined)?.tool_calls;
  const toolCalls =
    Array.isArray(rawCalls) && rawCalls.length > 0
      ? rawCalls.map((tc) => ({
          name: tc.function?.name ?? "",
          arguments: tc.function?.arguments ?? "{}",
        }))
      : undefined;

  return {
    text,
    toolCalls: toolCalls?.length ? toolCalls : undefined,
    usage: completion.usage
      ? { inputTokens: completion.usage.prompt_tokens, outputTokens: completion.usage.completion_tokens }
      : undefined,
  };
}
