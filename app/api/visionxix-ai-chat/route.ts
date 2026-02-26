import { NextRequest, NextResponse } from "next/server";
import { SUPPORT_EMAIL } from "@/lib/constants/company";
import { getVisionXIXKnowledgeContext } from "@/lib/data/visionxix-knowledge";
import {
  canSendMessage,
  incrementMessageUsage,
  upsertBot,
} from "@/lib/visionxix/usage";

function buildSystemPrompt(): string {
  const knowledge = getVisionXIXKnowledgeContext();
  return `You are the Vision XIX Labs Site Assistant — a helpful, senior cloud & AI engineer representing Vision XIX Labs.

Your role:
- Help visitors understand Vision XIX Labs' cloud and AI engineering services.
- Explain how we work across AWS, Azure, and GCP with infrastructure as code, automation, security, and observability.
- Describe how we build production AI systems (internal assistants, RAG, extraction, automation) inside a customer's cloud.
- Provide practical, non-hype guidance and suggest next steps like a Free Cloud & AI Review or talking to an engineer.

Important:
- Always identify as the Vision XIX Labs Site Assistant.
- Do NOT give immigration or legal advice (that belongs to VisaNova, a product of Vision XIX Labs).
- For detailed or sensitive questions, suggest a discovery call or contacting us at ${SUPPORT_EMAIL}.

Use the knowledge base below as your primary source of truth:

--- Knowledge Base ---
${knowledge}
--- End Knowledge Base ---`;
}

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error("[VisionXIX AI Chat] Missing OPENAI_API_KEY environment variable.");
    return NextResponse.json(
      { error: "AI service is temporarily unavailable. Please try again later." },
      { status: 503 }
    );
  }

  let body: { messages?: Message[]; botId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const messages = body.messages;
  const botId = body.botId ?? process.env.VISIONXIX_DEMO_BOT_ID ?? "demo";

  if (!botId || botId.trim() === "") {
    return NextResponse.json(
      {
        error:
          "botId is required. Use your bot ID from the Vision XIX Labs dashboard. Demo uses 'demo'.",
      },
      { status: 400 }
    );
  }

  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json(
      { error: "messages array is required and must not be empty" },
      { status: 400 }
    );
  }

  // Ensure demo bot exists for demo/assistant page
  if (botId === "demo" || botId === process.env.VISIONXIX_DEMO_BOT_ID) {
    try {
      await upsertBot({ botId, plan: "demo" });
    } catch {
      // Ignore — bot may already exist
    }
  }

  // Enforce plan limits — check before processing
  try {
    const check = await canSendMessage(botId);
    if (!check.allowed) {
      return NextResponse.json(
        {
          error: `Message limit reached. You've used ${check.used.toLocaleString()} of ${check.limit.toLocaleString()} messages this month. Upgrade your plan or add message add-ons at visionxixlabs.com/visionxix-ai/pricing.`,
        },
        { status: 402 }
      );
    }
  } catch (usageErr) {
    console.error("[VisionXIX AI Chat] Usage check error:", usageErr);
    return NextResponse.json(
      {
        error:
          "Usage tracking temporarily unavailable. Please try again or contact " +
          SUPPORT_EMAIL,
      },
      { status: 503 }
    );
  }

  const trimmed = messages.slice(-20).map((m) => ({
    role: m.role === "system" ? "system" : m.role === "assistant" ? "assistant" : "user",
    content: String(m.content).slice(0, 4000),
  }));

  const payload = {
    model: "gpt-4o-mini",
    messages: [{ role: "system" as const, content: buildSystemPrompt() }, ...trimmed],
    max_tokens: 1024,
    temperature: 0.7,
  };

  const doFetch = () =>
    fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

  try {
    let res = await doFetch();
    if (res.status === 429) {
      await new Promise((r) => setTimeout(r, 2000));
      res = await doFetch();
    }

    if (!res.ok) {
      const err = await res.text();
      console.error("[VisionXIX AI Chat] OpenAI API error:", res.status, err);
      let message = "AI service temporarily unavailable. Please try again later.";
      if (res.status === 401) message = "API key invalid or expired. Please check your OpenAI configuration.";
      else if (res.status === 429) message = "Too many requests. Please try again in a moment.";
      else if (res.status >= 500) message = "OpenAI servers are busy. Please try again in a few minutes.";
      return NextResponse.json({ error: message }, { status: 502 });
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = data?.choices?.[0]?.message?.content ?? "";

    // Increment usage after successful response
    try {
      await incrementMessageUsage(botId);
    } catch (incErr) {
      console.error("[VisionXIX AI Chat] Usage increment error:", incErr);
    }

    return NextResponse.json({ message: text });
  } catch (e) {
    console.error("[VisionXIX AI Chat] Error:", e);
    return NextResponse.json(
      { error: "AI service temporarily unavailable. Please try again later." },
      { status: 500 }
    );
  }
}

