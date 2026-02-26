import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { SUPPORT_EMAIL, PARENT_WEBSITE } from "@/lib/constants/company";
import { getAIKnowledgeContext } from "@/lib/data/ai-knowledge";

export const runtime = "nodejs";

function buildSystemPrompt(): string {
  const knowledge = getAIKnowledgeContext();
  return `You are the Vision XIX Labs AI Assistant — a helpful, knowledgeable immigration assistant for VisaNova (visanova.app), built by Vision XIX Labs (${PARENT_WEBSITE}).

Your role:
- Answer questions about USCIS cases, processing times, statuses, forms (I-130, I-129F, I-485, I-751, N-400), NVC, consular processing, and immigration timelines.
- Use the knowledge base below as your primary source. Prefer verified FAQ and status decoder content.
- Guide users to VisaNova tools when helpful: Processing Times (/processing-times), Status Decoder (/status-decoder), Fee Calculator (/fees), Help Center (/help).

Response style:
- Be clear, concise, and supportive. Use markdown (bold, bullet points, numbered lists, links) to make answers scannable.
- For status questions, explain what the status means and typical next steps.
- When suggesting tools, include the path (e.g. "Check [Processing Times](/processing-times) for your form and office").
- If unsure, say so and suggest checking official USCIS/State Dept sources or an immigration attorney.

Rules:
- Identify as the Vision XIX Labs AI Assistant.
- This is not legal advice. For complex legal questions, recommend an immigration attorney.
- For account or billing, direct to ${SUPPORT_EMAIL} and suggest "Talk to support".

--- Knowledge Base ---
${knowledge}
--- End Knowledge Base ---`;
}

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

function jsonError(message: string, status: number): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey || typeof apiKey !== "string" || apiKey.trim() === "") {
      console.error("[AI Chat] OPENAI_API_KEY is missing or empty.");
      return jsonError("AI service is temporarily unavailable. Please try again later.", 503);
    }

    let body: { messages?: Message[] };
    try {
      body = (await req.json()) as { messages?: Message[] };
    } catch {
      return jsonError("Invalid JSON body", 400);
    }

    const messages = body?.messages;
    if (!Array.isArray(messages) || messages.length === 0) {
      return jsonError("messages array is required and must not be empty", 400);
    }

    const trimmed = messages.slice(-20).map((m) => ({
      role: (m.role === "system" ? "system" : m.role === "assistant" ? "assistant" : "user") as "user" | "assistant" | "system",
      content: String(m.content ?? "").slice(0, 4000),
    }));

    const openai = new OpenAI({ apiKey });

    const systemContent = buildSystemPrompt();
    const apiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: systemContent },
      ...trimmed,
    ];

    const createCompletion = async (): Promise<OpenAI.Chat.ChatCompletion> => {
      return openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: apiMessages,
        max_tokens: 1536,
        temperature: 0.6,
      });
    };

    let completion: OpenAI.Chat.ChatCompletion | null = null;

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        if (attempt === 1) {
          await new Promise((r) => setTimeout(r, 2000));
        }
        completion = await createCompletion();
        break;
      } catch (openaiErr: unknown) {
        const err = openaiErr as { status?: number; message?: string; code?: string };
        const status = err?.status ?? 0;
        console.error("[AI Chat] OpenAI API error:", { status, message: err?.message, code: err?.code, attempt: attempt + 1 });
        console.error("[AI Chat] Full error:", openaiErr);

        if (status === 429 && attempt === 0) {
          continue;
        }
        if (status === 401) {
          return jsonError("API key invalid or expired. Please check your OpenAI configuration.", 502);
        }
        if (status === 429) {
          return jsonError("Too many requests. Please try again in a moment.", 502);
        }
        if (status >= 500) {
          return jsonError("OpenAI servers are busy. Please try again in a few minutes.", 502);
        }
        return jsonError("AI service temporarily unavailable. Please try again later.", 502);
      }
    }

    if (!completion) {
      return jsonError("AI service temporarily unavailable. Please try again later.", 502);
    }

    const text = completion.choices?.[0]?.message?.content ?? "";
    return NextResponse.json({ message: text });
  } catch (e: unknown) {
    console.error("[AI Chat] Unexpected error:", e);
    if (e instanceof Error) {
      console.error("[AI Chat] Error stack:", e.stack);
    }
    return NextResponse.json(
      { error: "AI service temporarily unavailable. Please try again later." },
      { status: 500 }
    );
  }
}
