/**
 * GET /api/dashboard/deployment-incident-list — Phase 501.
 * Optional ?releaseId=...&status=... filters.
 */

import { NextResponse, type NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import {
  buildIncidentListResponse,
  type DeploymentIncidentRepo,
} from "@/lib/releaseops/deploymentIncidentResponder";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId) {
    return NextResponse.json({ ok: false, error: "auth_required" }, { status: 401 });
  }
  const url = new URL(req.url);
  const releaseId = url.searchParams.get("releaseId");
  const status = url.searchParams.get("status");
  const input: { organizationId: string; releaseId?: string; status?: string } = { organizationId: ctx.organizationId };
  if (releaseId) input.releaseId = releaseId;
  if (status) input.status = status;

  const r = await buildIncidentListResponse(
    prisma as unknown as DeploymentIncidentRepo,
    input,
  );
  return NextResponse.json(r.body, { status: r.status });
}
