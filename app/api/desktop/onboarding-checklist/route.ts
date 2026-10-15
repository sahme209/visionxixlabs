/** Tenant-scoped first-run checklist for paired desktop sessions. */
import { NextResponse, type NextRequest } from "next/server";
import { resolveRequestDesktopSession } from "@/lib/desktop/resolveRequestDesktopSession";
import { prisma } from "@/lib/db";
import { buildOnboardingChecklistResponse, type OnboardingChecklistRepo } from "@/lib/releaseops/onboardingChecklistResponder";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest): Promise<Response> {
  const session = await resolveRequestDesktopSession(request, {
    requiredScope: "pipeline:read", route: "GET /api/desktop/onboarding-checklist", allowApiKey: false,
  });
  if (!session) return NextResponse.json({ ok: false, error: "desktop_session_required" }, { status: 401 });

  const r = await buildOnboardingChecklistResponse(prisma as unknown as OnboardingChecklistRepo, String(session.organizationId));
  return NextResponse.json(r.body, { status: r.status });
}
