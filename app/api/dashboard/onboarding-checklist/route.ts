/**
 * GET /api/dashboard/onboarding-checklist — Phase 503.
 */

import { NextResponse, type NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import {
  buildOnboardingChecklistResponse,
  type OnboardingChecklistRepo,
} from "@/lib/releaseops/onboardingChecklistResponder";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId) {
    return NextResponse.json({ ok: false, error: "auth_required" }, { status: 401 });
  }
  const r = await buildOnboardingChecklistResponse(
    prisma as unknown as OnboardingChecklistRepo,
    ctx.organizationId,
  );
  return NextResponse.json(r.body, { status: r.status });
}
