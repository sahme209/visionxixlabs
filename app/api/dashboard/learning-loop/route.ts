/**
 * GET /api/dashboard/learning-loop — Phase 511.
 */

import { NextResponse, type NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import {
  buildLearningLoopResponse,
  type LearningLoopRepo,
} from "@/lib/releaseops/learningLoopResponder";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId) {
    return NextResponse.json({ ok: false, error: "auth_required" }, { status: 401 });
  }
  const r = await buildLearningLoopResponse(
    prisma as unknown as LearningLoopRepo,
    ctx.organizationId,
  );
  return NextResponse.json(r.body, { status: r.status });
}
