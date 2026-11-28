import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { resolveRequestDesktopSession } from "@/lib/desktop/resolveRequestDesktopSession";
import { prisma } from "@/lib/db";
import { appendAuditEvent, type AuditEventRepo } from "@/lib/releaseops/auditEventResponder";

/** Workspace owner/admin with a desktop session; API keys never configure sign-in. */
export async function ssoAdmin(request: NextRequest, route: string) {
  const session = await resolveRequestDesktopSession(request, { requiredScope: "pipeline:read", route, allowApiKey: false, requireWorkspaceAdmin: true });
  return session ? { organizationId: String(session.organizationId), userId: String(session.userId) } : null;
}
export const unauthorized = () => NextResponse.json({ ok: false, error: "desktop_session_required" }, { status: 401 });

export async function ssoAudit(organizationId: string, userId: string, id: string, kind: string, summary: string) {
  try {
    await appendAuditEvent(prisma as unknown as AuditEventRepo, { organizationId, kind, subjectKind: "identity_provider", subjectId: id, summary, actorUserId: userId });
  } catch { /* best-effort */ }
}
