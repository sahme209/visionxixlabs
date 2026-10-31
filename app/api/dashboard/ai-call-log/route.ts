/**
 * GET /api/dashboard/ai-call-log — Phase 531.
 * Query: ?engineName=council_voter&take=100 (workspace-scoped only)
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

  // Workspace roles do not authorize cross-tenant operations.
  if (scope === "global") return NextResponse.json({ ok: false, error: "global_scope_unavailable" }, { status: 403 });
  const organizationId = String(ctx.organizationId);

  const r = await buildAiCallLogResponse(
    prisma as unknown as AiCallLogRepo,
    {
      ...(engineName ? { engineName } : {}),
      organizationId,
      ...(typeof take === "number" && Number.isFinite(take) ? { take } : {}),
    },
  );
  return NextResponse.json(r.body, { status: r.status });
}
