/**
 * GET /api/dashboard/branch-protection-list — Phase 499.
 * Optional ?repositoryId filter.
 */

import { NextResponse, type NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import {
  buildBranchProtectionListResponse,
  type BranchProtectionRepo,
} from "@/lib/releaseops/branchProtectionResponder";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId) {
    return NextResponse.json({ ok: false, error: "auth_required" }, { status: 401 });
  }
  const url = new URL(req.url);
  const repositoryId = url.searchParams.get("repositoryId");
  const input: { organizationId: string; repositoryId?: string } = { organizationId: ctx.organizationId };
  if (repositoryId) input.repositoryId = repositoryId;

  const r = await buildBranchProtectionListResponse(
    prisma as unknown as BranchProtectionRepo,
    input,
  );
  return NextResponse.json(r.body, { status: r.status });
}
