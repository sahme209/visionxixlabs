/**
 * GET /api/dashboard/council-rationale-read?decisionId=... — Phase 518.
 *
 * Returns the cached AI rationale enrichment for a council decision,
 * or { enrichment: null } when none has been generated.
 */

import { NextResponse, type NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import {
  buildEnrichmentReadResponse,
  type EnrichmentRepo,
} from "@/lib/releaseops/aiRationaleEnricherResponder";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId) {
    return NextResponse.json({ ok: false, error: "auth_required" }, { status: 401 });
  }

  const decisionId = req.nextUrl.searchParams.get("decisionId");
  if (!decisionId) {
    return NextResponse.json(
      { ok: false, error: "invalid_payload", hint: "Pass ?decisionId=..." },
      { status: 400 },
    );
  }

  const r = await buildEnrichmentReadResponse(
    prisma as unknown as EnrichmentRepo,
    ctx.organizationId,
    decisionId,
  );
  return NextResponse.json(r.body, { status: r.status });
}
