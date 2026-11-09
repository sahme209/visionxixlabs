/**
 * POST /api/support/ai-answer — Ask Axiom AI answer (support roadmap step 2).
 * Body: { question }
 *
 * Signed-in members only, explicit per click. Uses the governed AI path
 * (opt-in per workspace, provider policy and prepaid credit admission, all
 * fail closed). The model sees only retrieved public passages and must cite
 * them; an answer without a valid citation is discarded and the grounded docs
 * answer is returned instead. Pasted secrets never reach a model.
 */
import { NextResponse, type NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { authorizedForOrganization } from "@/lib/axiom/workspaceAuthority";
import { checkRateLimit } from "@/lib/rateLimit";
import { resolveGovernedAiCall } from "@/lib/axiom/agentRuntime/governedAiCall";
import { GovernedAiCallRefusal } from "@/lib/axiom/agentRuntime/governedAiCallRefusal";
import { answerQuestion, buildIndex, guard, retrieve, type AnswerIndex } from "@/lib/support/answerKernel";
import { AI_ANSWER_SCHEMA, buildAiAnswerPrompt, validateAiAnswer } from "@/lib/support/aiAnswerKernel";
import { knowledgeEntries } from "@/lib/support/knowledgeBase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
let index: AnswerIndex | null = null;

export async function POST(req: NextRequest): Promise<Response> {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId || !ctx.sessionUserId) return NextResponse.json({ ok: false, error: "sign_in_required" }, { status: 401 });
  const userId = String(ctx.sessionUserId); const organizationId = String(ctx.organizationId);
  if (!checkRateLimit(`support-ai:${userId}`)) return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
  if (!await authorizedForOrganization(userId, organizationId)) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  const body = await req.json().catch(() => null) as { question?: unknown } | null;
  const question = typeof body?.question === "string" ? body.question.trim() : "";
  if (!question || question.length > 1000) return NextResponse.json({ ok: false, error: "question_required" }, { status: 400 });
  index ??= buildIndex(knowledgeEntries());
  if (guard(question)) return NextResponse.json({ ok: true, mode: "grounded", ...answerQuestion(index, question) });
  const passages = retrieve(index, question, 5);
  const fallback = () => NextResponse.json({ ok: true, mode: "grounded", ...answerQuestion(index!, question) });
  if (passages.length === 0) return fallback();

  const governed = await resolveGovernedAiCall(organizationId, undefined, userId);
  if (!governed.ok) return NextResponse.json({ ok: false, error: governed.error, ...answerQuestion(index, question), mode: "grounded" }, { status: 200 });
  try {
    const { data } = await governed.extract<unknown>(buildAiAnswerPrompt(question, passages), AI_ANSWER_SCHEMA, `support_ai_${Date.now().toString(36)}`);
    const verdict = validateAiAnswer(data, passages);
    if (!verdict.ok) return fallback();
    const byId = new Map(passages.map((p) => [p.id, p]));
    return NextResponse.json({ ok: true, mode: "ai", answer: verdict.answer, sources: verdict.citations.map((id) => ({ title: byId.get(id)!.title, href: byId.get(id)!.href, kind: byId.get(id)!.kind })), note: "AI answer from the cited docs, paid from prepaid credits. Check the sources." }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof GovernedAiCallRefusal) return NextResponse.json({ ok: false, error: error.message, ...answerQuestion(index, question), mode: "grounded" });
    return fallback();
  }
}
