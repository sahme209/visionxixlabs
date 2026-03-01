/**
 * Anthropic provider.
 */

import type { GenerateTextOptions, GenerateTextResult } from "./types";

export async function generateText(
  opts: GenerateTextOptions
): Promise<GenerateTextResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

  const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-20250514";
  const maxTokens = opts.maxTokens ?? 4096;
  const temperature = opts.temperature ?? 0.4;

  const Anthropic = (await import("@anthropic-ai/sdk")).default;
  const client = new Anthropic({ apiKey });

  const system = opts.system ?? opts.messages?.filter((m) => m.role === "system").map((m) => m.content).join("\n") ?? "";
  const msgs = opts.messages?.filter((m) => m.role !== "system") ?? [];
  const userContent = opts.prompt ?? msgs.filter((m) => m.role === "user").pop()?.content ?? "";

  const messageList =
    msgs.length > 0
      ? msgs.map((m) => ({ role: m.role as "user" | "assistant", content: m.content }))
      : [{ role: "user" as const, content: userContent }];

  const response = await client.messages.create({
    model,
    max_tokens: maxTokens,
    temperature,
    system,
    messages: messageList,
  });

  const block = response.content.find((b) => b.type === "text");
  const text = block && "text" in block ? block.text : "";

  return {
    text,
    usage: response.usage
      ? {
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
        }
      : undefined,
  };
}
