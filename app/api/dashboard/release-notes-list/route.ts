/**
 * GET /api/dashboard/release-notes-list — Phase 500.
 */

import { NextResponse, type NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import {
  buildReleaseNotesListResponse,
  type ReleaseNotesRepo,
} from "@/lib/releaseops/releaseNotesResponder";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId) {
    return NextResponse.json({ ok: false, error: "auth_required" }, { status: 401 });
  }
  const r = await buildReleaseNotesListResponse(
    prisma as unknown as ReleaseNotesRepo,
    ctx.organizationId,
  );
  return NextResponse.json(r.body, { status: r.status });
}
