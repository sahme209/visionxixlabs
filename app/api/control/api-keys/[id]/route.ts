/** DELETE /api/control/api-keys/{id} — a workspace owner/admin revokes one of this workspace's keys. */
import { NextResponse, type NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import { authorizedForOrganization } from "@/lib/axiom/workspaceAuthority";
import { appendAuditEvent, type AuditEventRepo } from "@/lib/releaseops/auditEventResponder";

export const dynamic = "force-dynamic";

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const c = await currentContext();
  if (!c.isAuthenticated || !c.organizationId || !c.sessionUserId) return NextResponse.json({ ok: false, error: "sign_in_required" }, { status: 401 });
  const organizationId = String(c.organizationId);
  if (!await authorizedForOrganization(String(c.sessionUserId), organizationId, true)) return NextResponse.json({ ok: false, error: "owner_or_admin_required" }, { status: 403 });
  const { id } = await ctx.params;
  // Scoped to this workspace: another workspace's key id revokes nothing.
  const saved = await prisma.apiKey.updateMany({ where: { id, organizationId, revokedAt: null }, data: { revokedAt: new Date(), revokedReason: "revoked_by_workspace_admin" } });
  if (saved.count !== 1) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  try { await appendAuditEvent(prisma as unknown as AuditEventRepo, { organizationId, kind: "api_key.revoked", subjectKind: "api_key", subjectId: id, summary: "Workspace admin revoked an API key", actorUserId: String(c.sessionUserId) }); } catch { /* best-effort */ }
  return NextResponse.json({ ok: true, revoked: true });
}
