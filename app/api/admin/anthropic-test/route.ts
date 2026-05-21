/**
 * GET /api/admin/anthropic-test — admin only.
 *
 * Proves the Anthropic API key works by making a tiny one-prompt
 * completion call. Uses claude-haiku-4-5 (cheap, fast) to minimise
 * cost. Returns the model's response text + token usage. Never
 * echoes the API key.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;

  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  const envDebug = {
    keySet: !!apiKey,
    keyLength: apiKey?.length ?? 0,
    keyPrefix: apiKey?.slice(0, 7) ?? "",      // expect "sk-ant-"
    keyHasWhitespace: apiKey ? /\s/.test(apiKey) : false,
    keyHasQuotes: apiKey ? (apiKey.includes('"') || apiKey.includes("'")) : false,
  };

  if (!apiKey) {
    return NextResponse.json({
      ok: false,
      stage: "env_check",
      reason: "ANTHROPIC_API_KEY not set in environment.",
      envDebug,
    });
  }

  try {
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 50,
      messages: [
        { role: "user", content: "Reply with exactly: AGI online." },
      ],
    });

    const block = response.content.find((b) => b.type === "text");
    const text = block && "text" in block ? block.text : "";

    return NextResponse.json({
      ok: true,
      stage: "anthropic_messages_create",
      model: response.model,
      reply: text,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
      envDebug,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({
      ok: false,
      stage: "anthropic_messages_create",
      reason: msg,
      envDebug,
    });
  }
}
