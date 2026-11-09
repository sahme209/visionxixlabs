/**
 * POST /api/support/answer — Ask Axiom support agent, grounded mode (B5 / C2).
 * Body: { question: string }
 *
 * Answers only from the public, versioned knowledge base (FAQ, docs headings,
 * reviewed facts) and always cites sources. No AI model is called, so there is
 * no cost and nothing is invented. Pasted secrets are refused and never logged
 * or stored; workspace-specific and action requests are routed to the app.
 */
import { NextResponse, type NextRequest } from "next/server";
import { checkRateLimit } from "@/lib/rateLimit";
import { answerQuestion, buildIndex, type AnswerIndex } from "@/lib/support/answerKernel";
import { KNOWLEDGE_VERSION, knowledgeEntries } from "@/lib/support/knowledgeBase";

export const runtime = "nodejs";
let index: AnswerIndex | null = null;

export async function POST(req: NextRequest): Promise<Response> {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "anon";
  if (!checkRateLimit(`support-answer:${ip}`)) return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
  const body = await req.json().catch(() => null) as { question?: unknown } | null;
  const question = typeof body?.question === "string" ? body.question.trim() : "";
  if (!question || question.length > 1000) return NextResponse.json({ ok: false, error: "question_required" }, { status: 400 });
  index ??= buildIndex(knowledgeEntries());
  const answer = answerQuestion(index, question);
  return NextResponse.json({ ok: true, mode: "grounded", knowledgeVersion: KNOWLEDGE_VERSION, ...answer }, { headers: { "Cache-Control": "no-store" } });
}
