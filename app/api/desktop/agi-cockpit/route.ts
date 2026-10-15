/**
 * Paired-desktop AGI cockpit.
 *
 * This boundary deliberately does not rely on browser cookies: every read and
 * manual tick resolves the current device credential, membership and role.
 */

import { NextResponse, type NextRequest } from "next/server";
import { resolveRequestDesktopSession } from "@/lib/desktop/resolveRequestDesktopSession";
import { prisma } from "@/lib/db";
import { buildAgiCockpitResponse, type AgiCockpitRepo } from "@/lib/releaseops/agiCockpitResponder";
import { runAgiCockpitNowForOrganization } from "@/app/api/dashboard/agi-cockpit-run-now/route";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: NextRequest): Promise<Response> {
  const session = await resolveRequestDesktopSession(request, {
    requiredScope: "pipeline:read",
    route: "GET /api/desktop/agi-cockpit",
    allowApiKey: false,
  });
  if (!session) return NextResponse.json({ ok: false, error: "desktop_session_required" }, { status: 401 });
  const result = await buildAgiCockpitResponse(prisma as unknown as AgiCockpitRepo, String(session.organizationId));
  return NextResponse.json(result.body, { status: result.status });
}

export async function POST(request: NextRequest): Promise<Response> {
  const session = await resolveRequestDesktopSession(request, {
    requiredScope: "pipeline:trigger",
    route: "POST /api/desktop/agi-cockpit",
    allowApiKey: false,
    requiredCapability: "deploy:execute",
  });
  if (!session) return NextResponse.json({ ok: false, error: "desktop_session_required" }, { status: 401 });
  return runAgiCockpitNowForOrganization(String(session.organizationId), String(session.userId));
}
