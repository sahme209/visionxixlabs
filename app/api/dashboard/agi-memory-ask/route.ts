/**
 * POST /api/dashboard/agi-memory-ask — Phase 524.
 * Body: { question: string, targetKind?: string }
 *
 * Operator asks a free-form question about the AGI's recent reasoning.
 * The route loads the last 100 rationale entries + 20 persisted
 * meta-summaries as context, hands them to Claude with the question,
 * and returns a structured answer with citations.
 *
 * Best-effort: missing AI provider / unparseable response degrade to
 * a deterministic fallback so the UI always renders.
 */

import { NextResponse, type NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import {
  buildAgiMemoryListResponse,
  type EnrichmentRepo,
} from "@/lib/releaseops/aiRationaleEnricherResponder";
import {
  buildMemorySummaryTimelineResponse,
  type MemorySummaryRepo,
} from "@/lib/releaseops/aiMemorySummaryResponder";
import {
  askAgiMemory,
  isValidQuestion,
  type ChatContextEntry,
  type ChatContextSummary,
} from "@/lib/releaseops/aiMemoryChatEngine";
import { makeLiveRationaleFetcher } from "@/lib/releaseops/aiRationaleFetcher";
import { appendAuditEvent, type AuditEventRepo } from "@/lib/releaseops/auditEventResponder";
import {
  persistChatTurn,
  type ChatTurnRepo,
} from "@/lib/releaseops/aiMemoryChatResponder";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId) {
    return NextResponse.json({ ok: false, error: "auth_required" }, { status: 401 });
  }

  let body: { question?: unknown; targetKind?: unknown } = {};
  try { body = await req.json(); } catch { /* fall through */ }

  if (!isValidQuestion(body.question)) {
    return NextResponse.json(
      { ok: false, error: "invalid_question", hint: "Question must be a string between 4 and 500 characters." },
      { status: 400 },
    );
  }
  const question = body.question as string;
  const targetKind = typeof body.targetKind === "string" && body.targetKind.length > 0 ? body.targetKind : undefined;

  // Load the context windows. Both lookups are best-effort — when the
  // schema migration is pending or returns no rows, the engine still
  // emits a sensible fallback answer.
  const memoryListResp = await buildAgiMemoryListResponse(
    prisma as unknown as EnrichmentRepo,
    {
      organizationId: ctx.organizationId,
      ...(targetKind ? { targetKind } : {}),
      take: 100,
    },
  );
  const timelineResp = await buildMemorySummaryTimelineResponse(
    prisma as unknown as MemorySummaryRepo,
    {
      organizationId: ctx.organizationId,
      take: 20,
    },
  );

  const entries: ChatContextEntry[] = memoryListResp.body.ok
    ? memoryListResp.body.data.entries.map((e, i) => ({
        citationId: `e${i + 1}`,
        targetKind: e.targetKind,
        targetId: e.targetId,
        narrative: e.narrative,
        outcome: e.outcome,
        generatedAtIso: e.generatedAtIso,
      }))
    : [];

  const summaries: ChatContextSummary[] = timelineResp.body.ok
    ? timelineResp.body.data.entries.map((s, i) => ({
        citationId: `s${i + 1}`,
        targetKind: s.targetKind,
        narrative: s.narrative,
        generatedAtIso: s.generatedAtIso,
      }))
    : [];

  const answer = await askAgiMemory(
    { question, entries, summaries },
    makeLiveRationaleFetcher(),
  );

  // Phase 529 — Persist the turn so the operator's chat archive
  // survives across sessions. Best-effort: a failure here never
  // affects the response.
  await persistChatTurn(
    prisma as unknown as ChatTurnRepo,
    {
      organizationId: ctx.organizationId,
      userId: ctx.userId ?? null,
      question,
      answer,
      contextEntriesCount: entries.length,
      contextSummariesCount: summaries.length,
    },
  );

  await appendAuditEvent(prisma as unknown as AuditEventRepo, {
    organizationId: ctx.organizationId,
    kind: "agi_memory.ask",
    subjectKind: "agi_memory",
    subjectId: targetKind ?? "all",
    summary: `AGI chat ${answer.outcome} · question="${question.slice(0, 80)}${question.length > 80 ? "…" : ""}" · ${answer.citations.length} citations`,
    actorUserId: ctx.userId ?? null,
  });

  // Map citationIds back to (targetKind, targetId) pairs so the UI can
  // link straight through to the source decision.
  const entryById = new Map<string, ChatContextEntry>();
  for (const e of entries) entryById.set(e.citationId, e);
  const summaryById = new Map<string, ChatContextSummary>();
  for (const s of summaries) summaryById.set(s.citationId, s);

  const citationDetails = answer.citations.map((citationId) => {
    const e = entryById.get(citationId);
    if (e) {
      return {
        citationId,
        kind: "entry" as const,
        targetKind: e.targetKind,
        targetId: e.targetId,
        narrative: e.narrative,
        generatedAtIso: e.generatedAtIso,
      };
    }
    const s = summaryById.get(citationId);
    if (s) {
      return {
        citationId,
        kind: "summary" as const,
        targetKind: s.targetKind,
        targetId: null,
        narrative: s.narrative,
        generatedAtIso: s.generatedAtIso,
      };
    }
    return null;
  }).filter((x): x is NonNullable<typeof x> => x !== null);

  return NextResponse.json({
    ok: true,
    data: {
      generatedAt: new Date().toISOString(),
      answer: {
        outcome: answer.outcome,
        answer: answer.answer,
        citations: answer.citations,
        modelHint: answer.modelHint,
        errorMessage: answer.errorMessage,
        engineVersion: answer.engineVersion,
      },
      contextSize: {
        entries: entries.length,
        summaries: summaries.length,
      },
      citationDetails,
    },
  }, { status: 200 });
}
