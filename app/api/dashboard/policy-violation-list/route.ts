/**
 * GET /api/dashboard/policy-violation-list — Phase 477.
 * Session-auth read of PolicyViolation rows for the caller's org.
 */

import { NextResponse, type NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import {
  buildPolicyViolationListResponse,
  ALL_VIOLATION_STATUSES,
  type PolicyViolationListRepo,
  type ViolationStatus,
} from "@/lib/releaseops/policyViolationListResponder";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId) {
    return NextResponse.json({ ok: false, error: "auth_required" }, { status: 401 });
  }
  const statusParam = req.nextUrl.searchParams.get("status");
  const statusFilter: ViolationStatus[] = statusParam
    ? statusParam.split(",").filter((s): s is ViolationStatus =>
        (ALL_VIOLATION_STATUSES as readonly string[]).includes(s),
      )
    : [];

  const r = await buildPolicyViolationListResponse(
    prisma as unknown as PolicyViolationListRepo,
    ctx.organizationId,
    {
      ...(statusFilter.length > 0 ? { statusFilter } : {}),
      take: 200,
    },
  );
  return NextResponse.json(r.body, { status: r.status });
}
