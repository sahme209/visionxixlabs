/**
 * GET /api/dashboard/agi-memory-list — Phase 521.
 * Query: ?targetKind=council|triage|remediation&take=100
 *
 * Lists every AI rationale enrichment across the AGI surfaces,
 * sorted newest-first. The unified memory feed for the AGI Memory
 * dashboard surface.
 */

import { NextResponse, type NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import {
  buildAgiMemoryListResponse,
  type EnrichmentRepo,
} from "@/lib/releaseops/aiRationaleEnricherResponder";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId) {
    return NextResponse.json({ ok: false, error: "auth_required" }, { status: 401 });
  }

  const targetKind = req.nextUrl.searchParams.get("targetKind");
  const takeRaw = req.nextUrl.searchParams.get("take");
  const take = takeRaw ? Number.parseInt(takeRaw, 10) : undefined;

  const r = await buildAgiMemoryListResponse(
    prisma as unknown as EnrichmentRepo,
    {
      organizationId: ctx.organizationId,
      ...(targetKind ? { targetKind } : {}),
      ...(typeof take === "number" && Number.isFinite(take) ? { take } : {}),
    },
  );
  return NextResponse.json(r.body, { status: r.status });
}
