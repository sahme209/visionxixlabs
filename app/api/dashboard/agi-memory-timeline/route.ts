/**
 * GET /api/dashboard/agi-memory-timeline?targetKind=&take=50 — Phase 523.
 *
 * Returns the recent persisted AGI meta-summaries for the timeline
 * view. Pass `targetKind=null` (literal string) to scope to all-surface
 * summaries; pass a kind ("council", "triage", ...) to scope to one
 * surface; omit to return all summaries regardless of scope.
 */

import { NextResponse, type NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import {
  buildMemorySummaryTimelineResponse,
  type MemorySummaryRepo,
} from "@/lib/releaseops/aiMemorySummaryResponder";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId) {
    return NextResponse.json({ ok: false, error: "auth_required" }, { status: 401 });
  }

  const rawTargetKind = req.nextUrl.searchParams.get("targetKind");
  const takeRaw = req.nextUrl.searchParams.get("take");
  const take = takeRaw ? Number.parseInt(takeRaw, 10) : undefined;

  // Three semantics:
  //   - omitted        → all summaries
  //   - "null"         → all-surface summaries only (targetKind IS NULL)
  //   - "<surface>"    → that surface only
  let targetKind: string | null | undefined;
  if (rawTargetKind === null) targetKind = undefined;
  else if (rawTargetKind === "null") targetKind = null;
  else targetKind = rawTargetKind;

  const r = await buildMemorySummaryTimelineResponse(
    prisma as unknown as MemorySummaryRepo,
    {
      organizationId: ctx.organizationId,
      ...(targetKind !== undefined ? { targetKind } : {}),
      ...(typeof take === "number" && Number.isFinite(take) ? { take } : {}),
    },
  );
  return NextResponse.json(r.body, { status: r.status });
}
