/**
 * GET /api/dashboard/drift-list — Phase 485.
 * Drift finding inbox for the caller's org.
 */

import { NextResponse, type NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import {
  buildDriftListResponse,
  ALL_DRIFT_STATUSES,
  type DriftListRepo,
  type DriftStatus,
} from "@/lib/releaseops/driftListResponder";
import {
  ALL_DRIFT_SEVERITIES,
  type DriftSeverity,
} from "@/lib/releaseops/driftDetector";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId) {
    return NextResponse.json({ ok: false, error: "auth_required" }, { status: 401 });
  }
  const statusParam = req.nextUrl.searchParams.get("status");
  const severityParam = req.nextUrl.searchParams.get("severity");
  const statusFilter: DriftStatus[] = statusParam
    ? statusParam.split(",").filter((s): s is DriftStatus =>
        (ALL_DRIFT_STATUSES as readonly string[]).includes(s),
      )
    : [];
  const severityFilter: DriftSeverity[] = severityParam
    ? severityParam.split(",").filter((s): s is DriftSeverity =>
        (ALL_DRIFT_SEVERITIES as readonly string[]).includes(s),
      )
    : [];

  const r = await buildDriftListResponse(
    prisma as unknown as DriftListRepo,
    ctx.organizationId,
    {
      ...(statusFilter.length > 0 ? { statusFilter } : {}),
      ...(severityFilter.length > 0 ? { severityFilter } : {}),
      take: 200,
    },
  );
  return NextResponse.json(r.body, { status: r.status });
}
