import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { currentContext } from "@/lib/auth/currentContext";
import { isAdminOrOwner } from "@/lib/auth/platformAdmin";
import { isSameOriginRequest } from "@/lib/auth/requestOrigin";
import { record as auditRecord } from "@/lib/audit/secureAudit";
import type { CorrelationId, OrganizationId, UserId } from "@/lib/domain/ids";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const noStore = { "Cache-Control": "private, no-store" };
const fail = (error: string, status: number) => NextResponse.json({ ok: false, error }, { status, headers: noStore });
/** Custom roles narrow these built-in roles only; owners and admins keep their full role. */
const ASSIGNABLE = new Set(["operator", "security_reviewer", "finance_viewer", "read_only"]);
const schema = z.object({ userId: z.string().min(1).max(64), customRoleId: z.string().min(1).max(64).nullable() }).strict();

/** POST: give a member a custom role, or clear it (customRoleId null). Owners and admins only. */
export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isSameOriginRequest(request)) return fail("cross_origin_refused", 403);
  const c = await currentContext();
  if (!c.isAuthenticated || !c.organizationId || !c.userId || !c.roles.length) return fail("workspace_membership_required", 403);
  if (!isAdminOrOwner({ email: c.email, roles: c.roles })) return fail("workspace_admin_required", 403);
  const body = schema.safeParse(await request.json().catch(() => null));
  if (!body.success) return fail("invalid_payload", 400);
  const organizationId = String(c.organizationId);
  try {
    const target = await prisma.orgMembership.findUnique({ where: { userId_organizationId: { userId: body.data.userId, organizationId } }, select: { role: true, acceptedAt: true } });
    if (!target?.acceptedAt) return fail("member_not_found", 404);
    if (body.data.customRoleId && !ASSIGNABLE.has(target.role)) return fail("role_not_assignable_to_owner_or_admin", 409);
    if (body.data.customRoleId && !(await prisma.workspaceCustomRole.findFirst({ where: { id: body.data.customRoleId, organizationId }, select: { id: true } }))) return fail("role_not_found", 404);
    await prisma.orgMembership.update({ where: { userId_organizationId: { userId: body.data.userId, organizationId } }, data: { customRoleId: body.data.customRoleId } });
    try { await auditRecord({ organizationId: organizationId as OrganizationId, actorUserId: String(c.userId) as UserId, action: "governance.update", outcome: "success", entityRef: `org_membership:${body.data.userId}`, correlationId: randomUUID() as CorrelationId, detail: { kind: "custom_role.assign", customRoleId: body.data.customRoleId } }); } catch { /* best-effort */ }
    return NextResponse.json({ ok: true }, { headers: noStore });
  } catch { return fail("roles_unavailable", 503); }
}
