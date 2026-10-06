/**
 * POST /api/desktop/identity-providers/scim-preview
 * Body: { employees, currentGrants }
 *
 * Stage-only joiner/mover/leaver plan from an uploaded directory
 * snapshot — see lib/iam/scimLifecycleHelper.ts. No execution path
 * exists; this never grants or revokes anything, it only computes what
 * would need confirming. Admin/owner-only, same as the rest of identity
 * configuration.
 */

import { NextResponse, type NextRequest } from "next/server";
import { resolveRequestDesktopSession } from "@/lib/desktop/resolveRequestDesktopSession";
import { buildScimLifecyclePreviewResponse } from "@/lib/iam/scimLifecyclePreviewResponder";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest): Promise<Response> {
  const session = await resolveRequestDesktopSession(request, {
    requiredScope: "pipeline:read",
    route: "POST /api/desktop/identity-providers/scim-preview",
    allowApiKey: false,
    requireWorkspaceAdmin: true,
  });
  if (!session) {
    return NextResponse.json({ ok: false, error: "desktop_session_required" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { employees?: unknown; currentGrants?: unknown } | null;
  if (!body) {
    return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
  }
  const r = buildScimLifecyclePreviewResponse({ employees: body.employees, currentGrants: body.currentGrants });
  return NextResponse.json(r.body, { status: r.status });
}
