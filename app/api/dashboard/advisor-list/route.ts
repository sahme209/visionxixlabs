/**
 * GET /api/dashboard/advisor-list — Phase 506.
 * Optional ?releaseId=...&operatorDecision=... filters.
 */

import { NextResponse, type NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import {
  buildAdvisorListResponse,
  type AdvisorRepo,
} from "@/lib/releaseops/advisorRecommendationResponder";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId) {
    return NextResponse.json({ ok: false, error: "auth_required" }, { status: 401 });
  }
  const url = new URL(req.url);
  const releaseId = url.searchParams.get("releaseId");
  const operatorDecision = url.searchParams.get("operatorDecision");
  const input: { organizationId: string; releaseId?: string; operatorDecision?: string } = { organizationId: ctx.organizationId };
  if (releaseId) input.releaseId = releaseId;
  if (operatorDecision) input.operatorDecision = operatorDecision;

  const r = await buildAdvisorListResponse(
    prisma as unknown as AdvisorRepo,
    input,
  );
  return NextResponse.json(r.body, { status: r.status });
}
