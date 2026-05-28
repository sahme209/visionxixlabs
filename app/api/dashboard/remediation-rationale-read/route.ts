/**
 * GET /api/dashboard/remediation-rationale-read?proposalId=... — Phase 520.
 *
 * Returns the cached AI rationale enrichment for a remediation proposal,
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

  const proposalId = req.nextUrl.searchParams.get("proposalId");
  if (!proposalId) {
    return NextResponse.json(
      { ok: false, error: "invalid_payload", hint: "Pass ?proposalId=..." },
      { status: 400 },
    );
  }

  const r = await buildEnrichmentReadResponse(
    prisma as unknown as EnrichmentRepo,
    ctx.organizationId,
    proposalId,
    "remediation",
  );
  return NextResponse.json(r.body, { status: r.status });
}
