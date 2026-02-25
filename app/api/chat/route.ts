import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

const MAX_CONTEXT_CHARS = 30000; // ~7.5k tokens

function buildBotContext(content: string): string {
  if (!content || content.trim().length === 0) {
    return "No training content yet. Please add URLs or text to train this chatbot.";
  }
  const truncated = content.length > MAX_CONTEXT_CHARS ? content.slice(0, MAX_CONTEXT_CHARS) + "\n[Content truncated...]" : content;
  return truncated;
}

export async function POST(req: NextRequest): Promise<Response> {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey?.trim()) {
      return NextResponse.json({ error: "AI service unavailable." }, { status: 503 });
    }

    let body: { botId?: string; messages?: { role: string; content: string }[] };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { botId, messages } = body;
    if (!botId || typeof botId !== "string" || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "botId and messages required" }, { status: 400 });
    }

    const bot = await prisma.bot.findUnique({
      where: { id: botId },
      include: { sources: true },
    });
    if (!bot) {
      return NextResponse.json({ error: "Bot not found" }, { status: 404 });
    }

    // Check message limit (per-month; for MVP we check total count as proxy)
    if (bot.messageCount >= bot.messageLimit) {
      return NextResponse.json({ error: "Message limit reached. Upgrade your plan." }, { status: 403 });
    }

    const knowledgeContent = bot.sources.map((s) => s.content || "").join("\n\n");
    const context = buildBotContext(knowledgeContent);

    const systemPrompt = `You are a helpful site assistant trained on the following content. Answer questions based on this knowledge. If the answer is not in the content, say so. Respond in the same language as the user when possible. Be concise and helpful.

--- Training content ---
${context}
--- End training content ---`;

    const trimmed = messages.slice(-20).map((m) => ({
      role: (m.role === "system" ? "system" : m.role === "assistant" ? "assistant" : "user") as "system" | "user" | "assistant",
      content: String(m.content).slice(0, 4000),
    }));

    const openai = new OpenAI({ apiKey });
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "system", content: systemPrompt }, ...trimmed],
      max_tokens: 1024,
      temperature: 0.7,
    });

    const text = completion.choices?.[0]?.message?.content ?? "";

    await prisma.bot.update({
      where: { id: botId },
      data: { messageCount: { increment: 1 } },
    });

    return NextResponse.json({ message: text });
  } catch (e) {
    console.error("[Chat API]", e);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
