import { NextRequest, NextResponse } from "next/server";
import { SUPPORT_EMAIL } from "@/lib/constants/company";
import { getVisionXIXKnowledgeContext } from "@/lib/data/visionxix-knowledge";
import { orchestrateChat } from "@/lib/ai/orchestrator";

export const runtime = "nodejs";

function buildSystemPrompt(): string {
  const knowledge = getVisionXIXKnowledgeContext();
  return `You are the Vision XIX Labs Site Assistant — a knowledgeable cloud & AI engineer representing Vision XIX Labs.

Your role:
- Help visitors understand Vision XIX Labs' cloud and AI engineering services.
- Explain how we work across AWS, Azure, and GCP with IaC, automation, security, and observability.
- Describe how we build production AI systems (internal assistants, RAG, extraction, automation).
- Provide practical, actionable guidance. Suggest next steps like a Free Cloud & AI Review or talking to an engineer.
- Be conversational, clear, and concise. Use examples when helpful.

Important:
- Always identify as the Vision XIX Labs Site Assistant.
- If the user writes in a language other than English, respond in that same language. We support 95+ languages.
- Do NOT give immigration or legal advice (that belongs to VisaNova).
- For detailed questions, suggest contacting ${SUPPORT_EMAIL}.
- When asked about our AI product (Vision XIX AI), explain features, pricing, and invite them to request a demo.

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
    if (!process.env.OPENAI_API_KEY?.trim() && !process.env.GEMINI_API_KEY?.trim()) {
      console.error("[VisionXIX AI Chat] Missing OPENAI_API_KEY and GEMINI_API_KEY.");
      return NextResponse.json(
        { error: "AI assistant is not configured. Please add OPENAI_API_KEY or GEMINI_API_KEY." },
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

    const chatMessages = messages.slice(-20).map((m) => ({
      role: (m.role === "assistant" ? "assistant" : "user") as "user" | "assistant",
      content: String(m.content).slice(0, 4000),
    }));

    const { text } = await orchestrateChat({
      taskType: "chat",
      systemPrompt: buildSystemPrompt(),
      messages: chatMessages,
      maxTokens: 1536,
      temperature: 0.4,
    });

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

    if (err?.message?.includes("401") || err?.message?.includes("Incorrect API key") || err?.message?.includes("API key")) {
      errorMessage = "AI provider API key invalid or expired. Please check your configuration.";
      statusCode = 503;
    } else if (err?.message?.includes("429") || err?.message?.includes("rate limit")) {
      errorMessage = "Too many requests. Please try again in a moment.";
      statusCode = 429;
    } else if (err?.message?.includes("500") || err?.message?.includes("503")) {
      errorMessage = "AI service is busy. Please try again in a few minutes.";
      statusCode = 502;
    }

    return NextResponse.json({ error: errorMessage }, { status: statusCode });
  }
}
