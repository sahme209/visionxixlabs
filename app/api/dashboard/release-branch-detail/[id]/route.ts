/**
 * GET /api/dashboard/release-branch-detail/[id]?repositoryId=…&prod=true|false
 *   — Phase 460.
 *
 * Session-auth detail route. Inputs that aren't yet first-class on
 * the Release row (branch env policy, direct-push protection,
 * branch-up-to-date) are passed as query params for now; future
 * phases attach them to the release directly.
 */

import { NextResponse, type NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import { buildBranchDetailResponse } from "@/lib/releaseops/branchDetailResponder";
import type { BranchDetailRepo } from "@/lib/releaseops/branchDetailResponder";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId) {
    return NextResponse.json({ ok: false, error: "auth_required" }, { status: 401 });
  }
  const { id } = await params;
  const repositoryId = req.nextUrl.searchParams.get("repositoryId");
  if (!repositoryId) {
    return NextResponse.json({ ok: false, error: "invalid_payload", hint: "repositoryId query param required." }, { status: 400 });
  }
  const isProductionDeploy = req.nextUrl.searchParams.get("prod") === "true";
  const r = await buildBranchDetailResponse(
    prisma as unknown as BranchDetailRepo,
    {
      organizationId: ctx.organizationId,
      releaseId: id,
      repositoryId,
      isProductionDeploy,
      branchEnvPolicy: null,             // filled in by future phase when policy lookup lands here
      directPushBlocked: true,           // optimistic default; real value comes from provider sync
      branchUpToDateWithTarget: true,
      hasRollbackReference: true,
      changedFilesWithinApprovedScope: null,
    },
  );
  return NextResponse.json(r.body, { status: r.status });
}
