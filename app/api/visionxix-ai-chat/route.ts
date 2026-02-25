import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { SUPPORT_EMAIL } from "@/lib/constants/company";
import { getVisionXIXKnowledgeContext } from "@/lib/data/visionxix-knowledge";

export const runtime = "nodejs";

function buildSystemPrompt(): string {
  const knowledge = getVisionXIXKnowledgeContext();
  return `You are the Vision XIX Labs Site Assistant — a helpful cloud & AI engineer representing Vision XIX Labs.

Your role:
- Help visitors understand Vision XIX Labs' cloud and AI engineering services.
- Explain how we work across AWS, Azure, and GCP with IaC, automation, security, and observability.
- Describe how we build production AI systems (internal assistants, RAG, extraction, automation).
- Provide practical guidance and suggest next steps like a Free Cloud & AI Review or talking to an engineer.

Important:
- Always identify as the Vision XIX Labs Site Assistant.
- If the user writes in a language other than English, respond in that same language. We support 95+ languages.
- Do NOT give immigration or legal advice (that belongs to VisaNova).
- For detailed questions, suggest contacting ${SUPPORT_EMAIL}.

--- Knowledge Base ---
${knowledge}
--- End Knowledge Base ---`;
}

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

export async function POST(req: NextRequest): Promise<Response> {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey || apiKey.trim() === "") {
      console.error("[VisionXIX AI Chat] Missing or empty OPENAI_API_KEY environment variable.");
      return NextResponse.json(
        { error: "AI assistant is not configured. Please add OPENAI_API_KEY." },
        { status: 503 }
      );
    }

    let body: { messages?: Message[] };
    try {
      body = await req.json();
    } catch (parseErr) {
      console.error("[VisionXIX AI Chat] Invalid JSON body:", parseErr);
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const messages = body.messages;
    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: "messages array is required and must not be empty" },
        { status: 400 }
      );
    }

    const trimmed = messages.slice(-20).map((m) => ({
      role: m.role === "system" ? "system" : m.role === "assistant" ? "assistant" : "user",
      content: String(m.content).slice(0, 4000),
    })) as OpenAI.Chat.Completions.ChatCompletionMessageParam[];

    const openai = new OpenAI({ apiKey });

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "system", content: buildSystemPrompt() }, ...trimmed],
      max_tokens: 1024,
      temperature: 0.7,
    });

    const text = completion.choices?.[0]?.message?.content ?? "";

    return NextResponse.json({ message: text });
  } catch (e) {
    const err = e as Error & { status?: number; code?: string };
    console.error("[VisionXIX AI Chat] Full error:", err);
    console.error("[VisionXIX AI Chat] Error message:", err?.message ?? String(e));
    console.error("[VisionXIX AI Chat] Error stack:", err?.stack);
    if ("status" in err) console.error("[VisionXIX AI Chat] Error status:", (err as { status?: number }).status);
    if ("code" in err) console.error("[VisionXIX AI Chat] Error code:", (err as { code?: string }).code);

    let errorMessage = "AI service temporarily unavailable. Please try again later.";
    let statusCode = 500;

    if (err?.message?.includes("401") || err?.message?.includes("Incorrect API key")) {
      errorMessage = "API key invalid or expired. Please check your OpenAI configuration.";
      statusCode = 503;
    } else if (err?.message?.includes("429") || err?.message?.includes("rate limit")) {
      errorMessage = "Too many requests. Please try again in a moment.";
      statusCode = 429;
    } else if (err?.message?.includes("500") || err?.message?.includes("503")) {
      errorMessage = "OpenAI servers are busy. Please try again in a few minutes.";
      statusCode = 502;
    }

    return NextResponse.json({ error: errorMessage }, { status: statusCode });
  }
}
