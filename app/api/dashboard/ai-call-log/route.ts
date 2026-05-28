/**
 * GET /api/dashboard/ai-call-log — Phase 531.
 * Query: ?engineName=council_voter&scope=org|global&take=100
 *
 * Engineer-facing log of every AI provider call. Per-engine
 * breakdown includes circuit state + latency p50/p95 + token
 * totals + success rate.
 */

import { NextResponse, type NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import {
  buildAiCallLogResponse,
  type AiCallLogRepo,
} from "@/lib/releaseops/aiCallLogResponder";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId) {
    return NextResponse.json({ ok: false, error: "auth_required" }, { status: 401 });
  }

  const engineName = req.nextUrl.searchParams.get("engineName") ?? undefined;
  const scope = req.nextUrl.searchParams.get("scope") ?? "org";
  const takeRaw = req.nextUrl.searchParams.get("take");
  const take = takeRaw ? Number.parseInt(takeRaw, 10) : undefined;

  // scope=org → restrict by organizationId
  // scope=global → no org filter (engineer ops view)
  // Anything else → fall back to org-scoped
  const organizationId = scope === "global" ? undefined : ctx.organizationId;

  const r = await buildAiCallLogResponse(
    prisma as unknown as AiCallLogRepo,
    {
      ...(engineName ? { engineName } : {}),
      ...(organizationId !== undefined ? { organizationId } : {}),
      ...(typeof take === "number" && Number.isFinite(take) ? { take } : {}),
    },
  );
  return NextResponse.json(r.body, { status: r.status });
}
