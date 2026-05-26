/**
 * GET /api/dashboard/repository-list — Phase 459.
 * Session-auth route over the Phase 451 + 441 repository inventory.
 */

import { NextResponse, type NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import { buildRepositoryListResponse } from "@/lib/releaseops/repositoryListResponder";
import type { RepositoryListRepo } from "@/lib/releaseops/repositoryListResponder";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId) {
    return NextResponse.json({ ok: false, error: "auth_required" }, { status: 401 });
  }
  const r = await buildRepositoryListResponse(
    prisma as unknown as RepositoryListRepo,
    ctx.organizationId,
  );
  return NextResponse.json(r.body, { status: r.status });
}
