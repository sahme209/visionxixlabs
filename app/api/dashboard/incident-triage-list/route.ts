/**
 * GET /api/dashboard/incident-triage-list — Phase 509.
 * Optional ?incidentId / ?operatorDecision filters.
 */

import { NextResponse, type NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import {
  buildTriageListResponse,
  type IncidentTriageRepo,
} from "@/lib/releaseops/incidentTriageResponder";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId) {
    return NextResponse.json({ ok: false, error: "auth_required" }, { status: 401 });
  }
  const url = new URL(req.url);
  const incidentId = url.searchParams.get("incidentId");
  const operatorDecision = url.searchParams.get("operatorDecision");
  const input: { organizationId: string; incidentId?: string; operatorDecision?: string } = { organizationId: ctx.organizationId };
  if (incidentId) input.incidentId = incidentId;
  if (operatorDecision) input.operatorDecision = operatorDecision;

  const r = await buildTriageListResponse(
    prisma as unknown as IncidentTriageRepo,
    input,
  );
  return NextResponse.json(r.body, { status: r.status });
}
