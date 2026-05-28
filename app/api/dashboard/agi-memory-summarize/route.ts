/**
 * POST /api/dashboard/agi-memory-summarize — Phase 522.
 * Body: { take?: number, targetKind?: string }
 *
 * Loads the most recent rationale enrichments and asks Claude to
 * produce a meta-narrative summary across the window. The AGI
 * summarizing the AGI's own thinking.
 *
 * Best-effort: when the AI provider is unavailable, returns a
 * deterministic fallback summary so the UI always has something to
 * render.
 */

import { NextResponse, type NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import {
  buildAgiMemoryListResponse,
  type EnrichmentRepo,
} from "@/lib/releaseops/aiRationaleEnricherResponder";
import { summarizeAgiMemory, type MemoryEntryForSummary } from "@/lib/releaseops/aiMemorySummaryEngine";
import { makeLiveRationaleFetcher } from "@/lib/releaseops/aiRationaleFetcher";
import { appendAuditEvent, type AuditEventRepo } from "@/lib/releaseops/auditEventResponder";
import { persistMemorySummary, type MemorySummaryRepo } from "@/lib/releaseops/aiMemorySummaryResponder";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId) {
    return NextResponse.json({ ok: false, error: "auth_required" }, { status: 401 });
  }

  let body: { take?: unknown; targetKind?: unknown } = {};
  try { body = await req.json(); } catch { /* fall through */ }
  const take = typeof body.take === "number" && Number.isFinite(body.take) ? body.take : 50;
  const targetKind = typeof body.targetKind === "string" && body.targetKind.length > 0 ? body.targetKind : undefined;

  const listResp = await buildAgiMemoryListResponse(
    prisma as unknown as EnrichmentRepo,
    {
      organizationId: ctx.organizationId,
      ...(targetKind ? { targetKind } : {}),
      take,
    },
  );
  if (!listResp.body.ok) {
    return NextResponse.json(listResp.body, { status: listResp.status });
  }

  const entries: MemoryEntryForSummary[] = listResp.body.data.entries.map((e) => ({
    targetKind: e.targetKind,
    targetId: e.targetId,
    narrative: e.narrative,
    outcome: e.outcome,
    modelHint: e.modelHint,
    generatedAtIso: e.generatedAtIso,
  }));

  const summary = await summarizeAgiMemory(entries, makeLiveRationaleFetcher());

  // Phase 523 — Persist the summary for the timeline view. Best-effort:
  // the route response is unaffected by persistence failure (e.g. when
  // the schema migration hasn't been applied yet).
  await persistMemorySummary(
    prisma as unknown as MemorySummaryRepo,
    ctx.organizationId,
    targetKind ?? null,
    summary,
  );

  await appendAuditEvent(prisma as unknown as AuditEventRepo, {
    organizationId: ctx.organizationId,
    kind: "agi_memory.summarize",
    subjectKind: "agi_memory",
    subjectId: targetKind ?? "all",
    summary: `AGI memory summary ${summary.outcome} · ${summary.windowSize} entries · ${summary.aiAvailabilityPct}% AI`,
    actorUserId: ctx.userId ?? null,
  });

  return NextResponse.json({
    ok: true,
    data: {
      generatedAt: new Date().toISOString(),
      summary,
    },
  }, { status: 200 });
}
