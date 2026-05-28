/**
 * GET /api/dashboard/policy-proposal-list — Phase 507.
 * Optional ?operatorDecision filter.
 */

import { NextResponse, type NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import {
  buildProposalListResponse,
  type PolicyProposalRepo,
} from "@/lib/releaseops/policyProposalResponder";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId) {
    return NextResponse.json({ ok: false, error: "auth_required" }, { status: 401 });
  }
  const url = new URL(req.url);
  const operatorDecision = url.searchParams.get("operatorDecision");
  const input: { organizationId: string; operatorDecision?: string } = { organizationId: ctx.organizationId };
  if (operatorDecision) input.operatorDecision = operatorDecision;

  const r = await buildProposalListResponse(
    prisma as unknown as PolicyProposalRepo,
    input,
  );
  return NextResponse.json(r.body, { status: r.status });
}
