import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateChatResponse } from "@/lib/ai/chat";
import { getPlanLimits } from "@/lib/planLimits";

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
    if (!process.env.OPENAI_API_KEY?.trim() && !process.env.GEMINI_API_KEY?.trim()) {
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
      include: { sources: true, user: true },
    });
    if (!bot) {
      return NextResponse.json({ error: "Bot not found" }, { status: 404 });
    }

    const limits = getPlanLimits(bot.user?.plan ?? null);
    const totalMessages = await prisma.bot.aggregate({
      where: { userId: bot.userId },
      _sum: { messageCount: true },
    });
    const used = totalMessages._sum.messageCount ?? 0;
    if (used >= limits.messages) {
      return NextResponse.json(
        { error: `Message limit reached (${limits.messages}/mo). Upgrade your plan for more.` },
        { status: 403 }
      );
    }

    const knowledgeContent = bot.sources.map((s) => s.content || "").join("\n\n");
    const context = buildBotContext(knowledgeContent);

    const systemPrompt = `You are a helpful, knowledgeable site assistant trained on the following content.

Guidelines:
- Answer questions accurately based on the training content below.
- If the answer is not in the content, say so and offer to help with related topics.
- Respond in the same language as the user when possible.
- Be concise, clear, and helpful. Use bullet points or short paragraphs when useful.
- If asked about topics outside the content (e.g., pricing, contact), infer reasonable answers or suggest contacting the site owner.

--- Training content ---
${context}
--- End training content ---`;

    const chatMessages = messages.slice(-20).map((m) => ({
      role: (m.role === "assistant" ? "assistant" : "user") as "user" | "assistant",
      content: String(m.content).slice(0, 4000),
    }));

    const { text } = await generateChatResponse({
      systemPrompt,
      messages: chatMessages,
      maxTokens: 1536,
      temperature: 0.4,
    });

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
