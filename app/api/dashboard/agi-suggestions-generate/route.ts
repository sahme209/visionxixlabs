/**
 * POST /api/dashboard/agi-suggestions-generate — Phase 525.
 * Body: {}
 *
 * Runs the proactive suggestion engine. Loads the last 100 rationale
 * entries + 20 persisted summaries as context, asks Claude (or falls
 * back to rules) for 0-5 concrete operator next-actions, supersedes
 * any prior pending suggestions, and persists the fresh set.
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
  buildSuggestionGenerateResponse,
  type ProactiveSuggestionRepo,
} from "@/lib/releaseops/proactiveAgiSuggestionResponder";
import type {
  SuggestionContextEntry,
  SuggestionContextSummary,
} from "@/lib/releaseops/proactiveAgiSuggestionEngine";
import { makeLiveRationaleFetcher } from "@/lib/releaseops/aiRationaleFetcher";
import { appendAuditEvent, type AuditEventRepo } from "@/lib/releaseops/auditEventResponder";

export const dynamic = "force-dynamic";

export async function POST(_req: NextRequest) {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId) {
    return NextResponse.json({ ok: false, error: "auth_required" }, { status: 401 });
  }

  // Pull context from memory + timeline (both best-effort: when either
  // is empty the engine emits a sensible fallback).
  const memoryResp = await buildAgiMemoryListResponse(
    prisma as unknown as EnrichmentRepo,
    { organizationId: ctx.organizationId, take: 100 },
  );
  const timelineResp = await buildMemorySummaryTimelineResponse(
    prisma as unknown as MemorySummaryRepo,
    { organizationId: ctx.organizationId, take: 20 },
  );

  const entries: SuggestionContextEntry[] = memoryResp.body.ok
    ? memoryResp.body.data.entries.map((e, i) => ({
        citationId: `e${i + 1}`,
        targetKind: e.targetKind,
        targetId: e.targetId,
        rowTargetKind: e.targetKind,
        rowTargetId: e.targetId,
        narrative: e.narrative,
        outcome: e.outcome,
        modelHint: e.modelHint,
        generatedAtIso: e.generatedAtIso,
      }))
    : [];

  const summaries: SuggestionContextSummary[] = timelineResp.body.ok
    ? timelineResp.body.data.entries.map((s, i) => ({
        citationId: `s${i + 1}`,
        targetKind: s.targetKind,
        narrative: s.narrative,
        generatedAtIso: s.generatedAtIso,
      }))
    : [];

  const r = await buildSuggestionGenerateResponse(
    prisma as unknown as ProactiveSuggestionRepo,
    {
      organizationId: ctx.organizationId,
      entries,
      summaries,
      fetcher: makeLiveRationaleFetcher({ engineName: "proactive_suggestion", organizationId: ctx.organizationId }),
    },
  );

  if (r.body.ok) {
    await appendAuditEvent(prisma as unknown as AuditEventRepo, {
      organizationId: ctx.organizationId,
      kind: "proactive_suggestion.generate",
      subjectKind: "agi_memory",
      subjectId: "all",
      summary: `Generated ${r.body.data.suggestions.length} suggestion(s) · ${r.body.data.outcome} · superseded ${r.body.data.supersededCount} prior`,
      actorUserId: ctx.userId ?? null,
    });
  }
  return NextResponse.json(r.body, { status: r.status });
}
