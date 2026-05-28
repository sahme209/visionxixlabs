/**
 * GET /api/dashboard/agi-suggestions-list — Phase 525.
 * Query: ?operatorDecision=pending|acted|dismissed&kind=<kind>&take=50
 */

import { NextResponse, type NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import {
  buildSuggestionListResponse,
  type ProactiveSuggestionRepo,
} from "@/lib/releaseops/proactiveAgiSuggestionResponder";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId) {
    return NextResponse.json({ ok: false, error: "auth_required" }, { status: 401 });
  }

  const operatorDecision = req.nextUrl.searchParams.get("operatorDecision");
  const kind = req.nextUrl.searchParams.get("kind");
  const takeRaw = req.nextUrl.searchParams.get("take");
  const take = takeRaw ? Number.parseInt(takeRaw, 10) : undefined;

  const r = await buildSuggestionListResponse(
    prisma as unknown as ProactiveSuggestionRepo,
    {
      organizationId: ctx.organizationId,
      ...(operatorDecision ? { operatorDecision } : {}),
      ...(kind ? { kind } : {}),
      ...(typeof take === "number" && Number.isFinite(take) ? { take } : {}),
    },
  );
  return NextResponse.json(r.body, { status: r.status });
}
