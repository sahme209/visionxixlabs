/**
 * POST /api/desktop/identity-providers/[id]/revoke
 *
 * Admin/owner-only. Design doc's session-revocation rule ("IdP connection
 * being set to revoked" triggers revocation for anyone signed in through
 * it) is not implemented here — no sign-in path exists yet for this
 * config to affect, so there is nothing to revoke sessions for today.
 */

import { NextResponse, type NextRequest } from "next/server";
import { resolveRequestDesktopSession } from "@/lib/desktop/resolveRequestDesktopSession";
import { prisma } from "@/lib/db";
import { buildIdentityProviderRevokeResponse, type IdentityProviderRepo } from "@/lib/identity/identityProviderResponder";
import { appendAuditEvent, type AuditEventRepo } from "@/lib/releaseops/auditEventResponder";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const session = await resolveRequestDesktopSession(request, {
    requiredScope: "pipeline:read",
    route: "POST /api/desktop/identity-providers/[id]/revoke",
    allowApiKey: false,
    requireWorkspaceAdmin: true,
  });
  if (!session) {
    return NextResponse.json({ ok: false, error: "desktop_session_required" }, { status: 401 });
  }

  const { id } = await params;
  const r = await buildIdentityProviderRevokeResponse(prisma as unknown as IdentityProviderRepo, String(session.organizationId), id);

  if (r.body.ok) {
    try {
      await appendAuditEvent(prisma as unknown as AuditEventRepo, {
        organizationId: String(session.organizationId),
        kind: "identity.sso_revoked",
        subjectKind: "identity_provider",
        subjectId: id,
        summary: `Revoked identity provider ${id} from desktop`,
        actorUserId: String(session.userId),
      });
    } catch { /* best-effort */ }
  }
  return NextResponse.json(r.body, { status: r.status });
}
