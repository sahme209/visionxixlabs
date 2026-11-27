import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { currentContext } from "@/lib/auth/currentContext";
import { isSameOriginRequest } from "@/lib/auth/requestOrigin";
import { checkRateLimit } from "@/lib/rateLimit";
import { founderContext } from "@/lib/founder/founderAccess";
import { rankTopics } from "@/lib/founder/business";
import { buildSupportDraftPrompt, SUPPORT_DRAFT_SCHEMA, validateSupportDraft, type SupportDraft } from "@/lib/founder/supportDrafts";
import { resolveGovernedAiCall } from "@/lib/axiom/agentRuntime/governedAiCall";
import { GovernedAiCallRefusal } from "@/lib/axiom/agentRuntime/governedAiCallRefusal";
import { buildIndex, guard, retrieve, type AnswerIndex } from "@/lib/support/answerKernel";
import { knowledgeEntries } from "@/lib/support/knowledgeBase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;
const noStore = { "Cache-Control": "private, no-store" };
const MAX_TOPICS = 3;
let index: AnswerIndex | null = null;

/**
 * POST: draft answers for the most-asked questions Ask V19 could not answer in the last 30 days.
 * Founder only, explicit per click. Uses the governed AI path of the founder's current workspace
 * (opt-in, provider policy and credit admission, all fail closed). Drafts are returned for review;
 * nothing is saved or published.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isSameOriginRequest(request)) return NextResponse.json({ ok: false, error: "cross_origin_refused" }, { status: 403, headers: noStore });
  if (!await founderContext()) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404, headers: noStore });
  const c = await currentContext();
  if (!c.organizationId || !c.sessionUserId) return NextResponse.json({ ok: false, error: "workspace_required" }, { status: 409, headers: noStore });
  const userId = String(c.sessionUserId), organizationId = String(c.organizationId);
  if (!checkRateLimit(`founder-support-drafts:${userId}`)) return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429, headers: noStore });
  let questions: string[];
  try {
    const rows = await prisma.helpQueryRecord.findMany({ where: { verdict: "ask_axiom_unanswered", createdAt: { gte: new Date(Date.now() - 30 * 86_400_000) } }, orderBy: { createdAt: "desc" }, take: 5_000, select: { query: true } });
    questions = rows.map((r) => r.query);
  } catch { return NextResponse.json({ ok: false, error: "questions_unavailable" }, { status: 503, headers: noStore }); }
  const topics = rankTopics(questions, MAX_TOPICS).filter((t) => !guard(t.example));
  if (!topics.length) return NextResponse.json({ ok: true, data: { drafts: [] } }, { headers: noStore });
  const governed = await resolveGovernedAiCall(organizationId, undefined, userId);
  if (!governed.ok) return NextResponse.json({ ok: false, error: governed.error }, { status: 200, headers: noStore });
  index ??= buildIndex(knowledgeEntries());
  const drafts: Array<{ question: string; count: number; draft: SupportDraft | null }> = [];
  for (const t of topics) {
    const passages = retrieve(index, t.example, 5);
    try {
      const { data } = await governed.extract<unknown>(buildSupportDraftPrompt(t.example, passages), SUPPORT_DRAFT_SCHEMA, `founder_support_draft_${Date.now().toString(36)}`);
      drafts.push({ question: t.example, count: t.count, draft: validateSupportDraft(data, passages) });
    } catch (error) {
      if (error instanceof GovernedAiCallRefusal) return NextResponse.json({ ok: false, error: error.message, data: { drafts } }, { status: 200, headers: noStore });
      drafts.push({ question: t.example, count: t.count, draft: null });
    }
  }
  return NextResponse.json({ ok: true, data: { drafts } }, { headers: noStore });
}
